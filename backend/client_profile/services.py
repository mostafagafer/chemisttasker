import json
from datetime import datetime, timedelta, date, time
from decimal import Decimal
from pathlib import Path
from django.conf import settings
from client_profile.models import PharmacistOnboarding, OtherStaffOnboarding, Pharmacy, Shift, ShiftSlotAssignment, InvoiceLineItem, Invoice, Membership

# Load static JSON data
BASE_DIR = Path(settings.BASE_DIR)
AWARD_RATES = json.load(open(BASE_DIR / 'client_profile/data/updated_award_rates.json'))
PUBLIC_HOLIDAYS = json.load(open(BASE_DIR / 'client_profile/data/public_holidays.json'))

EARLY_MORNING_END = time(7, 0)
LATE_NIGHT_START = time(20, 0)


def is_public_holiday(slot_date, state):
    return str(slot_date) in PUBLIC_HOLIDAYS.get(state.upper(), [])

def get_day_type(slot_date, state):
    if is_public_holiday(slot_date, state):
        return 'public_holiday'
    weekday = slot_date.weekday()
    return 'saturday' if weekday == 5 else 'sunday' if weekday == 6 else 'weekday'

def get_time_category(start, end):
    if start < EARLY_MORNING_END:
        return 'early_morning'
    if end > LATE_NIGHT_START:
        return 'late_night'
    return None

def get_locked_rate_for_slot(slot, shift, user, override_date=None):
    """
    Calculates the correct rate for a given user and shift slot,
    considering role, classification, employment type, day, and time.
    """
    slot_date = override_date or slot.date
    start_time = slot.start_time
    end_time = slot.end_time
    state = shift.pharmacy.state

    # Determine the context for the rate lookup
    day_type = get_day_type(slot_date, state)
    time_category = get_time_category(start_time, end_time)
    rate_lookup_key = time_category or day_type # e.g., 'early_morning' or 'weekday'

    # Determine employment type (full/part-time vs. casual)
    membership = Membership.objects.filter(user=user, pharmacy=shift.pharmacy).first()
    employment_category = 'casual' # Default to casual
    if membership and membership.employment_type in ['FULL_TIME', 'PART_TIME']:
        employment_category = 'full_part_time'

    # Handle Pharmacist Rates
    if shift.role_needed == 'PHARMACIST':
        # For pharmacists, the award level is stored on the Membership model
        award_level = 'PHARMACIST' # Default if not set
        if membership and membership.pharmacist_award_level:
            award_level = membership.pharmacist_award_level

        try:
            # Correctly look up the rate using all necessary keys
            rate = AWARD_RATES['PHARMACIST'][award_level][employment_category][rate_lookup_key]
            reason = {
                "type": rate_lookup_key,
                "role_key": award_level,
                "employment": employment_category,
                "source": "Award"
            }
            return Decimal(rate), reason
        except KeyError:
            # Fallback if the specific rate combination is not found
            return Decimal('0.00'), {"error": "Rate not found for pharmacist classification"}

    # Handle Other Staff Rates (Intern, Student, Assistant, Technician)
    else:
        try:
            onboarding = OtherStaffOnboarding.objects.get(user=user)
            classification_key = None
            
            if shift.role_needed == 'INTERN':
                classification_key = onboarding.intern_half or 'FIRST_HALF'
            elif shift.role_needed == 'STUDENT':
                classification_key = onboarding.student_year or 'YEAR_1'
            elif shift.role_needed in ['ASSISTANT', 'TECHNICIAN']:
                # Both Assistant and Technician use the same LEVEL_1-4 keys in the JSON
                classification_key = onboarding.classification_level or 'LEVEL_1'

            if not classification_key:
                 return Decimal('0.00'), {"error": "User classification not found in onboarding profile."}

            # Correctly look up the rate for other staff
            rate = AWARD_RATES[shift.role_needed][classification_key][employment_category][rate_lookup_key]
            
            # Add owner bonus only for casual staff, as per original logic
            owner_bonus = shift.owner_adjusted_rate or Decimal('0.00')
            final_rate = Decimal(rate)
            bonus_applied = False
            if employment_category == 'casual' and owner_bonus > 0:
                final_rate += owner_bonus
                bonus_applied = True

            reason = {
                "type": rate_lookup_key,
                "role_key": classification_key,
                "employment": employment_category,
                "source": "Award",
                "bonus_applied": bonus_applied
            }
            return final_rate, reason

        except OtherStaffOnboarding.DoesNotExist:
            return Decimal('0.00'), {"error": "OtherStaffOnboarding profile not found for user."}
        except KeyError:
            return Decimal('0.00'), {"error": f"Rate not found for {shift.role_needed} classification"}


def expand_shift_slots(shift):
    entries = []
    for slot in shift.slots.all():
        # ✅ Use slot.recurring_days directly — no remapping
        mapped_days = slot.recurring_days if slot.is_recurring else []

        def get_hours(start, end):
            dt_start = datetime.combine(slot.date, start)
            dt_end = datetime.combine(slot.date, end)
            return Decimal((dt_end - dt_start).total_seconds() / 3600).quantize(Decimal('0.01'))

        if slot.is_recurring:
            current = slot.date
            while current <= slot.recurring_end_date:
                # ✅ Match slot.recurring_days where 0 = Sunday
                adjusted_weekday = (current.weekday() + 1) % 7
                if adjusted_weekday in mapped_days:
                    entries.append({
                        'date': current,
                        'start_time': slot.start_time,
                        'end_time': slot.end_time,
                        'hours': get_hours(slot.start_time, slot.end_time),
                        'slot': slot
                    })
                current += timedelta(days=1)
        else:
            entries.append({
                'date': slot.date,
                'start_time': slot.start_time,
                'end_time': slot.end_time,
                'hours': get_hours(slot.start_time, slot.end_time),
                'slot': slot
            })
    return entries

def generate_preview_invoice_lines(shift, user):
    line_items = []
    for entry in expand_shift_slots(shift):
        slot = entry['slot']
        slot_date = entry['date']
        try:
            assn = ShiftSlotAssignment.objects.get(slot=slot, slot_date=slot_date)
        except ShiftSlotAssignment.DoesNotExist:
            continue

        if assn.user != user:
            continue  # 🔒 Only include slots assigned to the current user

        slot_date = entry['date']
        start_time = entry['start_time']
        end_time = entry['end_time']
        hours = Decimal(str(entry['hours']))   # <--- ensure Decimal
        rate = assn.unit_rate or Decimal('0.00')
        reason = assn.rate_reason or {}

        total = (hours * rate).quantize(Decimal('0.01'))

        line_items.append({
            "id": f"{shift.id}-{slot.id}-{slot_date}",
            "shiftSlotId": slot.id,
            "date": str(slot_date),
            "start_time": start_time.strftime('%H:%M:%S'),
            "end_time": end_time.strftime('%H:%M:%S'),
            "category": "ProfessionalServices",
            "unit": "Hours",
            "quantity": float(hours),         # Only now convert for JSON
            "unit_price": float(rate),
            "discount": 0,
            "total": float(total),
            "was_modified": False,
            "rate_reason": reason  # Optional: frontend may use
        })

    return line_items

def generate_invoice_from_shifts(
    user,
    pharmacy_id=None,
    shift_ids=None,
    custom_lines=None,
    external=False,
    billing_data=None,
    due_date=None
    ):

    try:
        ob = PharmacistOnboarding.objects.get(user=user)
    except PharmacistOnboarding.DoesNotExist:
        ob = OtherStaffOnboarding.objects.get(user=user)

    gst_registered = billing_data.get('gst_registered', False)
    if isinstance(gst_registered, str):
        gst_registered = gst_registered.lower() in ['true', '1', 'yes']

    # Parse shift_ids safely
    shift_ids = billing_data.get('shift_ids')
    if shift_ids:
        if isinstance(shift_ids, str):
            shift_ids = json.loads(shift_ids)
    else:
        shift_ids = []

    external = billing_data.get('external', False)
    if isinstance(external, str):
        external = external.lower() in ['true', '1', 'yes']

    invoice = Invoice.objects.create(
        user=user,
        external=external,
        issuer_first_name=user.first_name,
        issuer_last_name=user.last_name,
        issuer_abn=ob.abn or '',
        issuer_email=user.email,
        gst_registered=gst_registered,
        super_fund_name=billing_data.get('super_fund_name', ''),
        super_usi=billing_data.get('super_usi', ''),
        super_member_number=billing_data.get('super_member_number', ''),
        super_rate_snapshot=Decimal(str(billing_data['super_rate_snapshot'])),
        bank_account_name=billing_data['bank_account_name'],
        bsb=billing_data['bsb'],
        account_number=billing_data['account_number'],
        cc_emails=billing_data.get('cc_emails', ''),
        due_date=due_date,
    )

    subtotal = Decimal('0.00')

    # --- Set snapshot/bill-to fields ---
    if not external:
        pharmacy = Pharmacy.objects.get(pk=pharmacy_id)
        invoice.pharmacy = pharmacy
        invoice.pharmacy_name_snapshot = pharmacy.name

        # Build a printable address from structured fields
        parts = [
            getattr(pharmacy, 'street_address', None),
            getattr(pharmacy, 'suburb', None),
            getattr(pharmacy, 'state', None),
            getattr(pharmacy, 'postcode', None),
        ]
        invoice.pharmacy_address_snapshot = ", ".join([str(p).strip() for p in parts if p])

        invoice.pharmacy_abn_snapshot = pharmacy.abn

        shift = Shift.objects.get(pk=shift_ids[0])
        invoice.bill_to_first_name = shift.created_by.first_name
        invoice.bill_to_last_name = shift.created_by.last_name
        invoice.bill_to_email = shift.created_by.email

    else:
        invoice.custom_bill_to_name = billing_data.get('custom_bill_to_name', '')
        invoice.custom_bill_to_address = billing_data.get('custom_bill_to_address', '')
        invoice.bill_to_email = billing_data.get('bill_to_email', '')
        invoice.bill_to_abn = billing_data.get('bill_to_abn', '')

    invoice.save()

    # --- USE ONLY THE PASSED LINE ITEMS ---
    # Map and save fields as provided by the user
    super_found = False

    if custom_lines:
        for ln in custom_lines:
            # Map category code safely
            category_code = ln.get('category_code') or ln.get('category') or 'ProfessionalServices'
            if category_code.lower() == 'superannuation':
                super_found = True

            qty = Decimal(str(ln.get('quantity', 0)))
            rate = Decimal(str(ln.get('unit_price', 0)))
            discount = Decimal(str(ln.get('discount', 0))) / Decimal('100')
            total = (qty * rate * (1 - discount)).quantize(Decimal('0.01'))

            InvoiceLineItem.objects.create(
                invoice=invoice,
                description=ln.get('description', ''),
                category_code=category_code,
                unit=ln.get('unit', 'Item'),
                quantity=qty,
                unit_price=rate,
                discount=discount * Decimal('100'),
                total=total,
                gst_applicable=ln.get('gst_applicable', True),
                super_applicable=ln.get('super_applicable', True),
                is_manual=True,
                was_modified=True
            )
            subtotal += total

    elif not external and shift_ids:
        # Legacy support: auto-generate from shift slots if no custom lines
        for shift in Shift.objects.filter(pk__in=shift_ids):
            for entry in expand_shift_slots(shift):
                # ... your slot expansion logic ...
                pass

    # --- GST, super, totals ---
    gst_amt = (subtotal * Decimal('0.10')).quantize(Decimal('0.01')) if invoice.gst_registered else Decimal('0.00')
    super_amt = (subtotal * (invoice.super_rate_snapshot / Decimal('100'))).quantize(Decimal('0.01'))

    invoice.subtotal = subtotal
    invoice.gst_amount = gst_amt
    invoice.super_amount = super_amt
    invoice.total = (subtotal + gst_amt + super_amt).quantize(Decimal('0.01'))
    invoice.save()

    # Only add a superannuation line if it is **not already present**
    if super_amt > 0 and not super_found:
        InvoiceLineItem.objects.create(
            invoice=invoice,
            description="Superannuation",
            category_code='Superannuation',
            unit="Lump Sum",
            quantity=Decimal('1.00'),
            unit_price=super_amt,
            discount=Decimal('0.00'),
            total=super_amt,
            gst_applicable=False,
            super_applicable=False,
            is_manual=True,
            was_modified=False
        )

    return invoice



from django.template.loader import render_to_string
from weasyprint import HTML

def render_invoice_to_pdf(invoice):
    line_items = invoice.line_items.all().order_by('id')

    # Always use Decimal for calculations
    decimal_0 = Decimal('0')
    decimal_10 = Decimal('0.10')

    subtotal = sum([li.total for li in line_items if li.category_code != 'Superannuation'], decimal_0)
    transportation = sum([li.total for li in line_items if li.category_code == 'Transportation'], decimal_0)
    accommodation = sum([li.total for li in line_items if li.category_code == 'Accommodation'], decimal_0)
    gst = (
        sum([
            li.total for li in line_items
            if li.category_code not in ['Superannuation', 'Transportation', 'Accommodation']
        ], decimal_0) * decimal_10 if invoice.gst_registered else decimal_0
    )
    super_amount = next((li.total for li in line_items if li.category_code == 'Superannuation'), decimal_0)
    grand_total = subtotal + gst + super_amount

    context = {
        "invoice": invoice,
        "line_items": line_items,
        "subtotal": subtotal,
        "transportation": transportation,
        "accommodation": accommodation,
        "gst": gst,
        "super_amount": super_amount,
        "grand_total": grand_total,
    }
    html_string = render_to_string("invoices/invoice_pdf.html", context)
    pdf_bytes = HTML(string=html_string, base_url=None).write_pdf()
    return pdf_bytes

