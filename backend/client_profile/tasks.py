import logging
import sys
import os
import json
import tempfile
import traceback
import shutil
from pathlib import Path
from datetime import timedelta
from django.apps import apps
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.storage import default_storage
from django_q.tasks import async_task
import time
import requests
import re
import dateutil.parser
from bs4 import BeautifulSoup
from scrapingbee import ScrapingBeeClient
from users.tasks import send_async_email
from client_profile.models import ShiftSlotAssignment
from client_profile.utils import build_shift_email_context, simple_name_match

from environ import Env

# ==== ENV SETUP ====
BASE_DIR = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parent.parent))
ENV_PATH = BASE_DIR / "core" / ".env"
env = Env()
if ENV_PATH.exists():
    env.read_env(str(ENV_PATH))
    print(f"[ENV] Loaded environment variables from {ENV_PATH}")
else:
    print(f"[ENV] No .env file at {ENV_PATH}, using system environment.")

# ==== OUTPUTS DIRECTORY ====
OUTPUT_DIR = BASE_DIR / "verification_outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)
print(f"[SETUP] Output files will be saved to {OUTPUT_DIR}")

logger = logging.getLogger(__name__)

def fetch_instance_with_retries(model, pk, max_retries=10, sleep_sec=0.4):
    for i in range(max_retries):
        try:
            return model.objects.get(pk=pk)
        except ObjectDoesNotExist:
            print(f"[fetch_instance_with_retries] Not found pk={pk}, try {i+1}/{max_retries}", file=sys.stderr)
            time.sleep(sleep_sec)
    raise model.DoesNotExist(f"Object with pk={pk} not found after {max_retries} tries")

def get_local_file_or_download(filefield):
    if not filefield:
        print("[get_local_file_or_download] filefield is empty.")
        return None
    try:
        if hasattr(filefield, "path") and os.path.exists(filefield.path):
            print(f"[get_local_file_or_download] Using local path: {filefield.path}")
            return filefield.path
    except Exception as e:
        print(f"[get_local_file_or_download] Could not access .path: {e}")
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=Path(filefield.name).suffix)
    with default_storage.open(filefield.name, "rb") as remote_file:
        shutil.copyfileobj(remote_file, temp_file)
    temp_file.close()
    print(f"[get_local_file_or_download] Downloaded to temp: {temp_file.name}")
    return temp_file.name

def save_output_file(task_name, object_pk, extension="json"):
    out_path = OUTPUT_DIR / f"{task_name}_{object_pk}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    print(f"[save_output_file] Will write output to: {out_path}")
    return str(out_path)

# --- Inline OCR with Azure (direct call, not subprocess!) ---
def azure_ocr(file_path):
    """Run OCR using Azure Vision, returns lines of text."""
    from azure.ai.vision.imageanalysis import ImageAnalysisClient
    from azure.ai.vision.imageanalysis.models import VisualFeatures
    from azure.core.credentials import AzureKeyCredential
    # Assumes env has already been loaded
    endpoint = env("AZURE_OCR_ENDPOINT")
    key = env("AZURE_OCR_KEY")
    if not endpoint or not key:
        raise Exception("Missing AZURE_OCR_ENDPOINT or AZURE_OCR_KEY in env")
    client = ImageAnalysisClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(key)
    )
    with open(file_path, "rb") as image_stream:
        result = client.analyze(
            image_data=image_stream,
            visual_features=[VisualFeatures.READ]
        )
    lines = []
    if result.read and result.read.blocks:
        for block in result.read.blocks:
            for line in block.lines:
                lines.append(line.text)
    print(f"[azure_ocr] OCR done for {file_path}, found {len(lines)} lines.")
    return {"lines": lines}

def verify_filefield_task(model_name, object_pk, file_field, first_name, last_name, email, verification_field):
    print(f"[VERIFY FILEFIELD TASK] model={model_name}, pk={object_pk}, field={file_field}")
    Model = apps.get_model("client_profile", model_name)
    obj = fetch_instance_with_retries(Model, object_pk)
    file_obj = getattr(obj, file_field)
    if not file_obj:
        print("[verify_filefield_task] No file found. Setting as not verified.")
        setattr(obj, verification_field, False)
        obj.save(update_fields=[verification_field])
        return

    local_path = get_local_file_or_download(file_obj)
    if not local_path or not os.path.exists(local_path):
        print(f"[verify_filefield_task] Could not obtain file for OCR: {local_path}")
        setattr(obj, verification_field, False)
        obj.save(update_fields=[verification_field])
        return

    try:
        ocr_data = azure_ocr(local_path)
        output_json = save_output_file("ocr", object_pk, "json")
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(ocr_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[verify_filefield_task] OCR failed: {e}")
        setattr(obj, verification_field, False)
        obj.save(update_fields=[verification_field])
        return

    lines = ocr_data.get("lines", [])
    text = " ".join(lines)
    is_match = simple_name_match(text, first_name, last_name)
    print(f"[verify_filefield_task] Name match result: {is_match} (first={first_name}, last={last_name})")
    setattr(obj, verification_field, is_match)
    obj.save(update_fields=[verification_field])

# --- Inline ABN scraping (no subprocess, no scripts) ---
def abn_lookup(abn_number):
    """Fetch the ABN details using the exact logic in your script."""
    url = f"https://abr.business.gov.au/ABN/View?id={abn_number}"
    print(f"[abn_lookup] Fetching {url}")
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[abn_lookup] Error fetching ABN: {e}")
        return None, None

    soup = BeautifulSoup(resp.text, "html.parser")
    legal_name_tag = soup.find("span", {"itemprop": "legalName"})
    abn_legal_name = legal_name_tag.get_text(strip=True) if legal_name_tag else ""
    return abn_legal_name, resp.text

def verify_abn_task(model_name, object_pk, abn_number, first_name, last_name, email):
    print(f"[VERIFY ABN TASK] model={model_name}, pk={object_pk}, abn={abn_number}")
    Model = apps.get_model("client_profile", model_name)
    obj = fetch_instance_with_retries(Model, object_pk)

    abn_legal_name, html = abn_lookup(abn_number)
    if not abn_legal_name:
        print("[verify_abn_task] Failed to fetch ABN details. Marking as not verified.")
        obj.abn_verified = False
        obj.save(update_fields=["abn_verified"])
        return

    name_match = simple_name_match(abn_legal_name, first_name, last_name)
    print(f"[verify_abn_task] Name match: {name_match} (expected: {first_name} {last_name}, actual: {abn_legal_name})")
    
    # Save both the HTML and the result for debugging/records
    output_html = save_output_file("abn_html", object_pk, "html")
    with open(output_html, "w", encoding="utf-8") as f:
        f.write(html)
    output_json = save_output_file("abn", object_pk, "json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({
            "legal_name": abn_legal_name,
            "input_first_name": first_name,
            "input_last_name": last_name,
            "name_match": name_match
        }, f, indent=2)
    
    obj.abn_verified = name_match
    obj.save(update_fields=["abn_verified"])

# --- Inline AHPRA scraping and parsing ---
def ahpra_lookup(ahpra_number, output_html_path, api_key=None):
    """
    Scrape AHPRA using ScrapingBee, run the full JS sequence, and save HTML.
    """
    api_key = api_key or os.environ.get("SCRAPINGBEE_API_KEY")
    assert api_key, "SCRAPINGBEE_API_KEY must be set in environment or passed in"
    client = ScrapingBeeClient(api_key=api_key)

    url = "https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx"

    js_instructions = [
        {"fill": ["#name-reg", ahpra_number]},
        {"wait": 1500},
        {"click": {"selector": "#predictiveSearchHomeBtn", "selector_type": "css"}},
        {"wait_for": {"selector": ".search-results-table", "selector_type": "css"}},
        {"wait": 2000},
        {"click": {"selector": ".search-results-table-row .search-results-table-col .text a", "selector_type": "css"}},
        {"wait_for": {"selector": ".practitioner-detail-header .practitioner-name", "selector_type": "css"}},
        {"wait": 2000},
    ]

    params = {
        "render_js": True,
        "premium_proxy": True,
        "js_scenario": {"instructions": js_instructions},
        "wait_browser": "networkidle0",
        "window_width": 1600,
        "window_height": 1200,
    }

    print(f"[ahpra_lookup] Requesting ScrapingBee for: {ahpra_number}")
    response = client.get(url, params=params)
    print(f"[ahpra_lookup] ScrapingBee status: {response.status_code}")

    # Save the HTML so you can parse and debug
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(response.text)

    return output_html_path

def parse_ahpra_html(html_file_path):
    with open(html_file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    header = soup.find('div', class_='practitioner-detail-header')
    name = ""
    reg_type = ""
    if header:
        name_tag = header.find('h2', class_='practitioner-name')
        name = name_tag.get_text(strip=True) if name_tag else ""
        reg_types = header.find('div', class_='reg-types')
        if reg_types:
            reg_type_tag = reg_types.find('span')
            reg_type = reg_type_tag.get_text(strip=True) if reg_type_tag else ""

    main = soup.find('div', class_='practitioner-detail-body')
    sections = main.find_all('div', class_='practitioner-detail-section') if main else []

    reg_status = ""
    expiry_date = ""
    for section in sections:
        rows = section.find_all('div', class_='section-row')
        for row in rows:
            label = row.find('div', class_='field-title')
            value = row.find('div', class_='field-entry')
            label_text = label.get_text(strip=True) if label else ""
            value_text = value.get_text(strip=True) if value else ""
            if "Registration status" in label_text:
                reg_status = value_text
            if "Expiry Date" in label_text and not expiry_date:
                expiry_date = value_text

    return {
        "practitioner_name": name,
        "registration_type": reg_type,
        "registration_status": reg_status,
        "expiry_date": expiry_date
    }

def verify_ahpra_task(model_name, object_pk, ahpra_number, first_name, last_name, email):
    print(f"[VERIFY AHPRA TASK] model={model_name}, pk={object_pk}, ahpra={ahpra_number}")
    Model = apps.get_model("client_profile", model_name)
    obj = fetch_instance_with_retries(Model, object_pk)
    output_html = save_output_file("ahpra_html", object_pk, "html")
    ahpra_lookup(ahpra_number, output_html)  # <-- Actually runs ScrapingBee, fills form, gets real HTML

    ahpra_data = parse_ahpra_html(output_html)
    print(f"[verify_ahpra_task] Parsed data: {ahpra_data}")

    practitioner_name = ahpra_data.get("practitioner_name", "")
    registration_type = ahpra_data.get("registration_type", "")
    registration_status = ahpra_data.get("registration_status", "")
    expiry_date_str = ahpra_data.get("expiry_date", "")

    is_name_match = simple_name_match(practitioner_name, first_name, last_name)
    print(f"[verify_ahpra_task] Name match result: {is_name_match} (expected={first_name} {last_name}, actual={practitioner_name})")

    note = ""
    expiry_date = None
    if not is_name_match:
        note = f"AHPRA name mismatch: '{first_name} {last_name}' vs '{practitioner_name}'"
        _update_ahpra_fields(
            model_name, object_pk, False, note,
            reg_type=registration_type, reg_status=registration_status, expiry_date=None
        )
        return

    if expiry_date_str:
        try:
            expiry_date = dateutil.parser.parse(expiry_date_str, dayfirst=True).date()
        except Exception:
            note = f"Could not parse expiry date: {expiry_date_str}"

    is_verified = True
    if registration_status.lower() == "suspended":
        is_verified = False
        note = "Registration suspended."
    elif registration_type.lower() == "provisional":
        is_verified = False
        note = "Registration provisional."
    elif not expiry_date:
        is_verified = False
        note = "Expiry date missing or invalid."
    elif expiry_date and expiry_date < timezone.now().date():
        is_verified = False
        note = "Registration expired."
    elif registration_type.lower() != "general":
        is_verified = False
        note = f"Registration type not 'General': {registration_type}."

    note = (note or "")[:255]
    _update_ahpra_fields(
        model_name, object_pk, is_verified, note,
        reg_type=registration_type, reg_status=registration_status, expiry_date=expiry_date
    )

def _update_ahpra_fields(model_name, object_pk, verified, note, reg_type=None, reg_status=None, expiry_date=None):
    note = (note or "")[:255]
    Model = apps.get_model("client_profile", model_name)
    try:
        obj = fetch_instance_with_retries(Model, object_pk)
    except Model.DoesNotExist:
        print(f"[AHPRA TASK] Skipping update: record {model_name} with pk={object_pk} does not exist.")
        return
    obj.ahpra_verified = verified
    obj.ahpra_verification_note = note
    if reg_type is not None:
        obj.ahpra_registration_type = reg_type
    if reg_status is not None:
        obj.ahpra_registration_status = reg_status
    if expiry_date is not None:
        obj.ahpra_expiry_date = expiry_date
    obj.save(update_fields=[
        "ahpra_verified", "ahpra_verification_note",
        "ahpra_registration_type", "ahpra_registration_status", "ahpra_expiry_date"
    ])
    print(f"[AHPRA TASK] Saved verification note for {model_name} pk={object_pk}: {note}")

# ========== Shift Reminder (Scheduled) ==========

def send_shift_reminders():
    now = timezone.now()
    window_start = now + timedelta(hours=12)
    window_end = now + timedelta(hours=13)

    assignments = ShiftSlotAssignment.objects.select_related('shift', 'slot', 'user') \
        .filter(
            slot_date=window_start.date(),
            slot__start_time__gte=window_start.time(),
            slot__start_time__lt=window_end.time(),
        )

    print(f"[send_shift_reminders] Found {assignments.count()} assignments for reminders.")
    for assignment in assignments:
        shift = assignment.shift
        candidate = assignment.user
        slot = assignment.slot
        slot_time = f"{assignment.slot_date} {slot.start_time.strftime('%H:%M')}–{slot.end_time.strftime('%H:%M')}"

        async_task(
            'users.tasks.send_async_email',
            subject=f"Reminder: Your upcoming shift at {shift.pharmacy.name}",
            recipient_list=[candidate.email],
            template_name="emails/shift_reminder.html",
            context=build_shift_email_context(
                shift,
                user=candidate,
                role=getattr(candidate, "role", "pharmacist").lower() if hasattr(candidate, "role") else "pharmacist",
                extra={"slot_time": slot_time}
            ),
            text_template="emails/shift_reminder.txt"
        )

    print("[send_shift_reminders] Completed sending reminders.")

# # --- For periodic scheduling (Q2) ---
# from django_q.tasks import schedule
# from django_q.models import Schedule

# schedule(
#     'client_profile.tasks.send_shift_reminders',
#     schedule_type=Schedule.MINUTES,
#     minutes=720,    # 12 hours = 720 minutes
#     repeats=-1
# )
