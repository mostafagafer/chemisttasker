import sys
import os
import json
import tempfile
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
import dateutil.parser
from bs4 import BeautifulSoup
from scrapingbee import ScrapingBeeClient
from users.tasks import send_async_email
from client_profile.models import ShiftSlotAssignment, OnboardingNotification
from django.contrib.contenttypes.models import ContentType
from client_profile.utils import build_shift_email_context, simple_name_match, get_frontend_dashboard_url 
import logging
logger = logging.getLogger(__name__)
from environ import Env

# ==== ENV SETUP ====
BASE_DIR = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parent.parent))
ENV_PATH = BASE_DIR / "core" / ".env"
env = Env()
if ENV_PATH.exists():
    env.read_env(str(ENV_PATH))
    logger.info(f"[ENV] Loaded environment variables from {ENV_PATH}")
else:
    logger.info(f"[ENV] No .env file at {ENV_PATH}, using system environment.")

# ==== OUTPUTS DIRECTORY ====
OUTPUT_DIR = BASE_DIR / "verification_outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)
logger.info(f"[SETUP] Output files will be saved to {OUTPUT_DIR}")


def fetch_instance_with_retries(model, pk, max_retries=10, sleep_sec=0.4):
    for i in range(max_retries):
        try:
            return model.objects.get(pk=pk)
        except ObjectDoesNotExist:
            logger.error(f"[fetch_instance_with_retries] Not found pk={pk}, try {i+1}/{max_retries}", file=sys.stderr)
            time.sleep(sleep_sec)
    raise model.DoesNotExist(f"Object with pk={pk} not found after {max_retries} tries")

def get_local_file_or_download(filefield):
    if not filefield:
        logger.info("[get_local_file_or_download] filefield is empty.")
        return None
    try:
        if hasattr(filefield, "path") and os.path.exists(filefield.path):
            logger.info(f"[get_local_file_or_download] Using local path: {filefield.path}")
            return filefield.path
    except Exception as e:
        logger.info(f"[get_local_file_or_download] Could not access .path: {e}")
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=Path(filefield.name).suffix)
    with default_storage.open(filefield.name, "rb") as remote_file:
        shutil.copyfileobj(remote_file, temp_file)
    temp_file.close()
    logger.info(f"[get_local_file_or_download] Downloaded to temp: {temp_file.name}")
    return temp_file.name

def save_output_file(task_name, object_pk, extension="json"):
    out_path = OUTPUT_DIR / f"{task_name}_{object_pk}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    logger.info(f"[save_output_file] Will write output to: {out_path}")
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
    logger.info(f"[azure_ocr] OCR done for {file_path}, found {len(lines)} lines.")
    return {"lines": lines}

def verify_filefield_task(model_name, object_pk, file_field, first_name, last_name, email, verification_field, **kwargs):
    note_field = kwargs.get('note_field')
    logger.info(f"[VERIFY FILEFIELD TASK] model={model_name}, pk={object_pk}, field={file_field}")
    Model = apps.get_model("client_profile", model_name)
    obj = fetch_instance_with_retries(Model, object_pk)
    
    # --- THIS IS THE FIX ---
    # If a verification note already exists, the task has already run.
    if note_field and getattr(obj, note_field, None):
        logger.info(f"[FILEFIELD TASK] SKIPPING: Verification for pk={object_pk}, field={file_field} already has a result.")
        return # Exit immediately
    # --- END OF FIX ---

    # Reset fields before running
    setattr(obj, verification_field, False)
    if note_field and hasattr(obj, note_field):
        setattr(obj, note_field, "")
        obj.save(update_fields=[verification_field, note_field])
    else:
        obj.save(update_fields=[verification_field])

    file_obj = getattr(obj, file_field)
    is_verified = False
    failure_note = ""

    if not file_obj:
        failure_note = "No file uploaded for this verification."
        logger.info(f"[verify_filefield_task] {failure_note} Setting as not verified.")
    else:
        local_path = get_local_file_or_download(file_obj)
        if not local_path or not os.path.exists(local_path):
            failure_note = f"Could not obtain file for OCR: {local_path}."
            logger.info(f"[verify_filefield_task] {failure_note}")
        else:
            try:
                ocr_data = azure_ocr(local_path)
                output_json = save_output_file("ocr", object_pk, "json")
                with open(output_json, "w", encoding="utf-8") as f:
                    json.dump(ocr_data, f, indent=2, ensure_ascii=False)

                lines = ocr_data.get("lines", [])
                text = " ".join(lines)
                is_name_match = simple_name_match(text, first_name, last_name)

                if is_name_match:
                    is_verified = True
                    logger.info(f"[verify_filefield_task] Name match result: {is_name_match} (first={first_name}, last={last_name})")
                else:
                    failure_note = f"Name mismatch found in your uploaded document"
                    logger.info(f"[verify_filefield_task] {failure_note}")

            except Exception as e:
                failure_note = f"OCR processing failed: {e}."
                logger.info(f"[verify_filefield_task] {failure_note}")
            finally:
                if local_path and os.path.exists(local_path) and Path(local_path).parent == Path(tempfile.gettempdir()):
                    os.remove(local_path)

    setattr(obj, verification_field, is_verified)
    if note_field and hasattr(obj, note_field):
        setattr(obj, note_field, failure_note[:255])
    obj.save(update_fields=[verification_field] + ([note_field] if note_field and hasattr(obj, note_field) else []))


# --- Inline ABN scraping (no subprocess, no scripts) ---
def abn_lookup(abn_number):
    """Fetch the ABN details using the exact logic in your script."""
    url = f"https://abr.business.gov.au/ABN/View?id={abn_number}"
    logger.info(f"[abn_lookup] Fetching {url}")
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        logger.info(f"[abn_lookup] Error fetching ABN: {e}")
        return None, None

    soup = BeautifulSoup(resp.text, "html.parser")
    legal_name_tag = soup.find("span", {"itemprop": "legalName"})
    abn_legal_name = legal_name_tag.get_text(strip=True) if legal_name_tag else ""
    return abn_legal_name, resp.text

def verify_abn_task(model_name, object_pk, abn_number, first_name, last_name, email, **kwargs):
    note_field = kwargs.get('note_field')
    logger.info(f"[VERIFY ABN TASK] model={model_name}, pk={object_pk}, abn={abn_number}")
    Model = apps.get_model("client_profile", model_name)
    obj = fetch_instance_with_retries(Model, object_pk)
    
    # --- THIS IS THE FIX ---
    # If a verification note already exists, the task has already run.
    if note_field and getattr(obj, note_field, None):
        logger.info(f"[ABN TASK] SKIPPING: Verification for pk={object_pk} already has a result.")
        return # Exit immediately
    # --- END OF FIX ---

    # Reset fields before running
    obj.abn_verified = False
    if note_field and hasattr(obj, note_field):
        setattr(obj, note_field, "")
        obj.save(update_fields=["abn_verified", note_field])
    else:
        obj.save(update_fields=["abn_verified"])

    is_verified = False
    failure_note = ""
    name_match = False
    abn_legal_name, html = abn_lookup(abn_number)

    if not abn_legal_name:
        failure_note = "Failed to fetch ABN details. ABN might be invalid or unresponsive."
        logger.info(f"[verify_abn_task] {failure_note}. Marking as not verified.")
    else:
        name_match = simple_name_match(abn_legal_name, first_name, last_name)

        if name_match:
            is_verified = True
            logger.info(f"[verify_abn_task] Name match: {name_match} (expected: {first_name} {last_name}, actual: {abn_legal_name})")
        else:
            failure_note = f"ABN legal name mismatch: Expected '{first_name} {last_name}', Found '{abn_legal_name}'."
            logger.info(f"[verify_abn_task] {failure_note}")

    output_html = save_output_file("abn_html", object_pk, "html")
    with open(output_html, "w", encoding="utf-8") as f:
        f.write(html if html else "No HTML captured.")
    output_json = save_output_file("abn", object_pk, "json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump({
            "legal_name": abn_legal_name,
            "input_first_name": first_name,
            "input_last_name": last_name,
            "name_match": name_match,
            "failure_note": failure_note
        }, f, indent=2)

    obj.abn_verified = is_verified
    if note_field and hasattr(obj, note_field):
        setattr(obj, note_field, failure_note[:255])
    obj.save(update_fields=["abn_verified"] + ([note_field] if note_field and hasattr(obj, note_field) else []))


# --- Inline AHPRA scraping and parsing ---
def ahpra_lookup(ahpra_number, output_html_path, api_key=None):
    """
    Scrape AHPRA using ScrapingBee with retries and better error handling.
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

    # --- START OF FIX: Add a retry loop ---
    max_retries = 3
    for attempt in range(max_retries):
        logger.info(f"[ahpra_lookup] Requesting ScrapingBee for: {ahpra_number} (Attempt {attempt + 1}/{max_retries})")
        try:
            response = client.get(url, params=params)
            
            # Check if the response from ScrapingBee itself is an error
            if response.status_code >= 400:
                # This is a ScrapingBee error (e.g., 500, 403)
                logger.info(f"[ahpra_lookup] ScrapingBee returned an error status: {response.status_code}. Content: {response.text[:200]}")
                # If it's the last attempt, raise an exception to be caught by the task
                if attempt == max_retries - 1:
                    raise Exception(f"An Error occured in during the verification of your AHPRA details")
                # Wait before retrying
                time.sleep(3 * (attempt + 1)) # Wait 3, 6 seconds
                continue

            # If the request was successful, save the HTML and exit the loop
            with open(output_html_path, "w", encoding="utf-8") as f:
                f.write(response.text)
            
            logger.info(f"[ahpra_lookup] ScrapingBee request successful.")
            return output_html_path

        except Exception as e:
            logger.info(f"[ahpra_lookup] An exception occurred on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                # If this was the last retry, re-raise the exception so the task fails gracefully
                raise e
            time.sleep(3 * (attempt + 1)) # Wait before retrying

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

def verify_ahpra_task(model_name, object_pk, ahpra_number, first_name, last_name, email, **kwargs):
    full_ahpra_number = f"PHA000{ahpra_number}"
    logger.info(f"[AHPRA TASK] Constructed full AHPRA number for lookup: {full_ahpra_number}")
    # --- END OF CHANGE ---

    Model = apps.get_model("client_profile", model_name)
    obj = fetch_instance_with_retries(Model, object_pk)

    # This logic correctly compares the incoming numeric-only `ahpra_number` 
    # with the numeric-only number stored on the object, so it doesn't need to change.
    if (obj.ahpra_number or '').strip().lower() == ahpra_number.strip().lower() and obj.ahpra_verification_note:
        logger.info(f"[AHPRA TASK] SKIPPING: Verification for pk={object_pk} with number {ahpra_number} already has a result.")
        return # Exit immediately

    # If we are here, it means it's a new AHPRA number or the first attempt.
    # We must clear the old result before starting.
    obj.ahpra_verified = False
    obj.ahpra_verification_note = ""
    obj.save(update_fields=['ahpra_verified', 'ahpra_verification_note'])

    output_html = save_output_file("ahpra_html", object_pk, "html")
    try:
        # Use the newly constructed full AHPRA number for the lookup
        ahpra_lookup(full_ahpra_number, output_html, api_key=env("SCRAPINGBEE_API_KEY"))
    except Exception as e:
        note = f"AHPRA lookup failed: {e}"
        _update_ahpra_fields(model_name, object_pk, False, note)
        return


    ahpra_data = parse_ahpra_html(output_html)
    logger.info(f"[verify_ahpra_task] Parsed: {ahpra_data}")

    practitioner_name = ahpra_data.get("practitioner_name", "")
    registration_type = (ahpra_data.get("registration_type") or "").strip()
    registration_status = (ahpra_data.get("registration_status") or "").strip()
    expiry_date_str = ahpra_data.get("expiry_date", "")

    is_name_match = simple_name_match(practitioner_name, first_name, last_name)
    logger.info(f"[verify_ahpra_task] Name match: {is_name_match} (expected={first_name} {last_name}, found={practitioner_name})")

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

    today = timezone.now().date()
    is_valid_type = registration_type.strip().lower() == "general"
    is_valid_status = registration_status.strip().lower() == "registered"
    expiry_ok = expiry_date and expiry_date > today

    is_verified = False
    fail_reasons = []
    
    if not expiry_ok:
        fail_reasons.append("Registration expired.")
    if not is_valid_type:
        fail_reasons.append(f"Registration type is '{registration_type}' (not 'General').")
    if not is_valid_status:
        fail_reasons.append(f"Registration status is '{registration_status}' (not 'Registered').")

    if expiry_ok and is_valid_type and is_valid_status:
        is_verified = True
        note = "AHPRA registration is valid and current."
    else:
        is_verified = False
        note = " / ".join(fail_reasons) or "AHPRA registration not valid."

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
        logger.info(f"[AHPRA TASK] Skipping update: record {model_name} with pk={object_pk} does not exist.")
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
    logger.info(f"[AHPRA TASK] Saved verification note for {model_name} pk={object_pk}: {note}")


# --- ORCHESTRATOR AND FINAL EVALUATOR ---
def run_all_verifications(model_name, object_pk, is_create=False):
    """
    MODIFIED: This orchestrator now also sends the initial admin notification.
    """
    from django.apps import apps
    from django.utils import timezone
    from datetime import timedelta
    from client_profile.utils import send_referee_emails, notify_superuser_on_onboarding

    Model = apps.get_model("client_profile", model_name)
    try:
        obj = Model.objects.get(pk=object_pk)
    except Model.DoesNotExist:
        logger.error(f"[ORCHESTRATOR] Cannot find {model_name} with pk={object_pk}. Aborting.")
        return

    # --- NOTIFY SUPERUSER IMMEDIATELY ON SUBMISSION ---
    if not notification_already_sent(obj, 'admin_notify'):
        logger.info(f"[ORCHESTRATOR] Sending admin notification for {model_name} pk={object_pk}.")
        notify_superuser_on_onboarding(obj)
        mark_notification_sent(obj, 'admin_notify')

    user = obj.user
    model_name_lower = model_name.lower()


    # --- 1. Trigger all automated verification tasks (ABN, AHPRA, Files) ---
    if model_name_lower == 'pharmacistonboarding':
        if obj.ahpra_number:
            async_task('client_profile.tasks.verify_ahpra_task', model_name, object_pk, obj.ahpra_number, user.first_name, user.last_name, user.email, q_options={'timeout': 300})
        if obj.payment_preference == "ABN" and obj.abn:
            async_task('client_profile.tasks.verify_abn_task', model_name, object_pk, obj.abn, user.first_name, user.last_name, user.email, note_field='abn_verification_note')
        if obj.government_id:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'government_id', user.first_name, user.last_name, user.email, 'gov_id_verified', note_field='gov_id_verification_note')
        if obj.payment_preference == "TFN" and obj.tfn_declaration:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'tfn_declaration', user.first_name, user.last_name, user.email, 'tfn_declaration_verified', note_field='tfn_declaration_verification_note')
        if obj.gst_registered and obj.gst_file:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'gst_file', user.first_name, user.last_name, user.email, 'gst_file_verified', note_field='gst_file_verification_note')

    elif model_name_lower == 'owneronboarding':
        if obj.role == "PHARMACIST" and obj.ahpra_number:
            async_task('client_profile.tasks.verify_ahpra_task', model_name, object_pk, obj.ahpra_number, user.first_name, user.last_name, user.email, q_options={'timeout': 300})

    elif model_name_lower == 'otherstaffonboarding':
        if obj.government_id:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'government_id', user.first_name, user.last_name, user.email, 'gov_id_verified', note_field='gov_id_verification_note')
        if obj.payment_preference == 'ABN' and obj.abn:
            async_task('client_profile.tasks.verify_abn_task', model_name, object_pk, obj.abn, user.first_name, user.last_name, user.email, note_field='abn_verification_note')
        if obj.payment_preference == 'TFN' and obj.tfn_declaration:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'tfn_declaration', user.first_name, user.last_name, user.email, 'tfn_declaration_verified', note_field='tfn_declaration_verification_note')
        if obj.gst_registered and obj.gst_file:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'gst_file', user.first_name, user.last_name, user.email, 'gst_file_verified', note_field='gst_file_verification_note')
        # Role-specific files
        if obj.role_type == 'INTERN' and obj.ahpra_proof:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'ahpra_proof', user.first_name, user.last_name, user.email, 'ahpra_proof_verified', note_field='ahpra_proof_verification_note')
        if obj.role_type == 'INTERN' and obj.hours_proof:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'hours_proof', user.first_name, user.last_name, user.email, 'hours_proof_verified', note_field='hours_proof_verification_note')
        if obj.role_type in ['ASSISTANT', 'TECHNICIAN'] and obj.certificate:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'certificate', user.first_name, user.last_name, user.email, 'certificate_verified', note_field='certificate_verification_note')
        if obj.role_type == 'STUDENT' and obj.university_id:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'university_id', user.first_name, user.last_name, user.email, 'university_id_verified', note_field='university_id_verification_note')
        # Optional files
        if obj.cpr_certificate:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 'cpr_certificate', user.first_name, user.last_name, user.email, 'cpr_certificate_verified', note_field='cpr_certificate_verification_note')
        if obj.s8_certificate:
            async_task('client_profile.tasks.verify_filefield_task', model_name, object_pk, 's8_certificate', user.first_name, user.last_name, user.email, 's8_certificate_verified', note_field='s8_certificate_verification_note')
    elif model_name_lower == 'exploreronboarding':
        if obj.government_id:
            async_task(
                'client_profile.tasks.verify_filefield_task',
                model_name, object_pk, 'government_id',
                user.first_name, user.last_name, user.email,
                'gov_id_verified',
                note_field='gov_id_verification_note'
            )

    # --- 2. Send initial referee emails ---
    referee_models = ['pharmacistonboarding', 'otherstaffonboarding', 'exploreronboarding']
    if model_name_lower in referee_models:
        logger.info(f"[ORCHESTRATOR] Sending initial referee requests for {model_name} pk={object_pk}.")
        send_referee_emails(obj)

    # --- 3. Schedule the final evaluation ---
    logger.info(f"[ORCHESTRATOR] All tasks for {model_name} pk={object_pk} triggered. Scheduling evaluation.")
    async_task(
        'client_profile.tasks.final_evaluation',
        model_name,
        object_pk,
        q_options={'eta': timezone.now() + timedelta(minutes=3)}
    )


def notification_already_sent(obj, notif_type):
    content_type = ContentType.objects.get_for_model(obj)
    return OnboardingNotification.objects.filter(
        content_type=content_type,
        object_id=obj.pk,
        notification_type=notif_type
    ).exists()

def mark_notification_sent(obj, notif_type):
    content_type = ContentType.objects.get_for_model(obj)
    OnboardingNotification.objects.get_or_create(
        content_type=content_type,
        object_id=obj.pk,
        notification_type=notif_type
    )

def final_evaluation(model_name, object_pk, retry_count=0, is_reminder=False):
    """
    REVISED: This task now correctly handles all states and cleans up scheduled tasks.
    """
    from django.apps import apps
    from django.utils import timezone
    from datetime import timedelta
    from django_q.models import Schedule
    from client_profile.utils import get_frontend_dashboard_url, send_referee_emails
    from django.contrib.contenttypes.models import ContentType
    from django_q.tasks import async_task
    import logging

    logger = logging.getLogger("client_profile.tasks")

    Model = apps.get_model("client_profile", model_name)
    try:
        obj = Model.objects.get(pk=object_pk)
    except Model.DoesNotExist:
        logger.error(f"[FINAL EVALUATION] ERROR: No object for pk={object_pk}")
        return

    def cancel_pending_reminders():
        Schedule.objects.filter(
            func='client_profile.tasks.final_evaluation',
            args=f"'{model_name}',{object_pk}"
        ).delete()
        logger.info(f"[FINAL EVALUATION] pk={object_pk} reached a final state. All pending reminders cancelled.")

    # Keep your retry guard
    if retry_count > 15:
        logger.error(f"[FINAL EVALUATION] Timed out waiting for automated tasks for {model_name} pk={object_pk}.")
        cancel_pending_reminders()
        return

    # Build required checks (unchanged)
    required_checks = []
    model_name_lower = model_name.lower()

    if model_name_lower == 'owneronboarding':
        if getattr(obj, 'role', None) == "PHARMACIST":
            required_checks.append('ahpra')

    elif model_name_lower == 'pharmacistonboarding':
        required_checks.extend(['gov_id', 'ahpra'])
        if obj.payment_preference == "ABN":
            if obj.abn:
                required_checks.append('abn')
            if obj.gst_registered:
                required_checks.append('gst_file')
        elif obj.payment_preference == "TFN":
            required_checks.append('tfn_declaration')

    elif model_name_lower == 'otherstaffonboarding':
        required_checks.append('gov_id')
        if obj.payment_preference == 'ABN' and obj.abn:
            required_checks.append('abn')
        if obj.payment_preference == 'TFN' and obj.tfn_declaration:
            required_checks.append('tfn_declaration')
        if obj.gst_registered and obj.gst_file:
            required_checks.append('gst_file')
        if getattr(obj, 'role_type', None) == 'INTERN':
            required_checks.extend(['ahpra_proof', 'hours_proof'])
        if getattr(obj, 'role_type', None) in ['ASSISTANT', 'TECHNICIAN']:
            required_checks.append('certificate')
        if getattr(obj, 'role_type', None) == 'STUDENT':
            required_checks.append('university_id')
        if getattr(obj, 'cpr_certificate', None):
            required_checks.append('cpr_certificate')
        if getattr(obj, 's8_certificate', None):
            required_checks.append('s8_certificate')

    elif model_name_lower == 'exploreronboarding':
        required_checks.append('gov_id')

    # Evaluate checks (unchanged)
    has_failed_check, is_pending_check, failure_reasons = False, False, []
    for check in required_checks:
        verified_flag = f"{check}_verified"
        note_flag = f"{check}_verification_note"
        if hasattr(obj, verified_flag):
            is_verified = getattr(obj, verified_flag)
            note = getattr(obj, note_flag, "")
            if not is_verified and note:
                has_failed_check = True
                failure_reasons.append(note)
            elif not is_verified and not note:
                is_pending_check = True

    # Referee requirements (unchanged)
    referees_needed = model_name_lower in ['pharmacistonboarding', 'otherstaffonboarding', 'exploreronboarding']
    is_pending_referee = False
    if referees_needed:
        for idx in [1, 2]:
            if getattr(obj, f"referee{idx}_rejected", False):
                has_failed_check = True
                failure_reasons.append(f"Referee {idx} has declined the request.")
            elif not getattr(obj, f"referee{idx}_confirmed", False):
                is_pending_referee = True

    # Failed state (unchanged)
    if has_failed_check:
        logger.info(f"[FINAL EVALUATION] pk={object_pk} has FAILED. Reason(s): {failure_reasons}")
        obj.verified = False
        obj.save(update_fields=['verified'])
        if not notification_already_sent(obj, 'failed'):
            async_task(
                'users.tasks.send_async_email',
                subject="Action Required: Your Profile Verification Needs Attention",
                recipient_list=[obj.user.email],
                template_name="emails/profile_verification_failed.html",
                context={
                    "user_first_name": obj.user.first_name,
                    "model_type": model_name,
                    "verification_reasons": failure_reasons,
                    "frontend_profile_link": get_frontend_dashboard_url(obj.user)
                },
                text_template="emails/profile_verification_failed.txt"
            )
            mark_notification_sent(obj, 'failed')
        cancel_pending_reminders()
        return

    # Helper: do we already have a future reminder scheduled for this profile?
    def _has_future_reminder(model_name, object_pk):
        return Schedule.objects.filter(
            func='client_profile.tasks.final_evaluation',
            args=f"'{model_name}',{object_pk}",
            next_run__gt=timezone.now()
        ).exists()

    # Debug timing: 0.1h (~6 min). Use 48 for production.
    REMINDER_DELAY = timedelta(hours=48)
    # Keep your quick re-check loop, but schedule it properly
    RECHECK_DELAY = timedelta(seconds=20)

    if is_pending_referee:
        logger.info(f"[FINAL EVALUATION] pk={object_pk} is waiting for referee confirmation.")
        obj.verified = False
        obj.save(update_fields=['verified'])

        # If this run was triggered by the scheduled reminder, send reminder emails now
        if is_reminder:
            logger.info(f"[FINAL EVALUATION] Sending referee reminder emails for pk={object_pk}.")
            send_referee_emails(obj, is_reminder=True)

        # IMPORTANT: Do NOT cancel here; only cancel in final states.
        # Ensure exactly ONE future reminder exists
        if not _has_future_reminder(model_name, object_pk):
            Schedule.objects.create(
                func='client_profile.tasks.final_evaluation',
                args=f"'{model_name}',{object_pk}",
                kwargs={'is_reminder': True},
                schedule_type=Schedule.ONCE,
                next_run=timezone.now() + REMINDER_DELAY,
            )
            logger.info(f"[FINAL EVALUATION] Scheduled next referee check for pk={object_pk} at {(timezone.now() + REMINDER_DELAY).isoformat()}.")
        else:
            logger.info(f"[FINAL EVALUATION] Future referee reminder already exists for pk={object_pk}; leaving it in place.")

        # If other automated checks are also pending, keep the quick re-check loop alive (properly delayed)
        if is_pending_check:
            Schedule.objects.create(
                func='client_profile.tasks.final_evaluation',
                args=f"'{model_name}',{object_pk}",
                schedule_type=Schedule.ONCE,
                next_run=timezone.now() + RECHECK_DELAY,
            )
        return

    # Automated checks still pending (no referee pending) -> keep quick loop
    if is_pending_check:
        logger.info(f"[FINAL EVALUATION] pk={object_pk} is waiting for automated tasks. Re-checking in 20s.")
        Schedule.objects.create(
            func='client_profile.tasks.final_evaluation',
            args=f"'{model_name}',{object_pk}",
            schedule_type=Schedule.ONCE,
            next_run=timezone.now() + RECHECK_DELAY,
        )
        return

    # Success state (unchanged)
    logger.info(f"[FINAL EVALUATION] pk={object_pk} has been successfully VERIFIED.")
    obj.verified = True
    obj.save(update_fields=['verified'])

    if not notification_already_sent(obj, 'verified'):
        async_task(
            'users.tasks.send_async_email',
            subject="🎉 Your Profile is Verified! 🎉",
            recipient_list=[obj.user.email],
            template_name="emails/profile_verified.html",
            context={
                "user_first_name": obj.user.first_name,
                "model_type": model_name,
                "frontend_profile_link": get_frontend_dashboard_url(obj.user)
            },
            text_template="emails/profile_verified.txt"
        )
        mark_notification_sent(obj, 'verified')

    # Only cancel reminders in a final state
    cancel_pending_reminders()
    return

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

    logger.info(f"[send_shift_reminders] Found {assignments.count()} assignments for reminders.")
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

    logger.info("[send_shift_reminders] Completed sending reminders.")

