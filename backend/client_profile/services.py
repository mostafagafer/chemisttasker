import json
from datetime import datetime, timedelta, date, time
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from .models import Invoice, InvoiceLineItem
from client_profile.models import Shift, ShiftSlotAssignment, Pharmacy, PharmacistOnboarding, OtherStaffOnboarding

# Load static JSON data
BASE_DIR = Path(settings.BASE_DIR)
AWARD_RATES = json.load(open(BASE_DIR / 'client_profile/data/award_rates.json'))
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
    slot_date = override_date or slot.date
    start_time  = slot.start_time
    end_time    = slot.end_time
    state       = shift.pharmacy.state
    day_type    = get_day_type(slot_date, state)         # eg. 'sunday', 'public_holiday'
    time_type   = get_time_category(start_time, end_time)  # eg. 'late_night'
    owner_bonus = shift.owner_adjusted_rate or Decimal('0.00')

    try:
        ob = PharmacistOnboarding.objects.get(user=user)
        preference = ob.rate_preference or {}

        if shift.rate_type == 'FIXED':
            rate = Decimal(shift.fixed_rate)
            reason = {
                "type": day_type,
                "role_key": None,
                "source": "Fixed",
                "bonus_applied": False
            }
            return rate, reason

        if shift.rate_type == 'PHARMACIST_PROVIDED':
            key = time_type or day_type
            rate_str = preference.get(key)
            if rate_str is None:
                return Decimal('0.00'), {
                    "type": key,
                    "role_key": None,
                    "source": "Pharmacist Provided",
                    "bonus_applied": False,
                    "error": f"Missing rate for key: {key}"
                }
            rate = Decimal(rate_str)
            reason = {
                "type": key,
                "role_key": None,
                "source": "Pharmacist Provided",
                "bonus_applied": False
            }
            return rate, reason

        # fallback: FLEXIBLE
        key = time_type or day_type
        rate_str = preference.get(key)
        rate = Decimal(rate_str or '0.00')
        reason = {
            "type": key,
            "role_key": None,
            "source": "Flexible",
            "bonus_applied": False
        }
        return rate, reason

    except PharmacistOnboarding.DoesNotExist:
        # Fallback: Non-pharmacist (Intern, Tech, Student)
        ob = OtherStaffOnboarding.objects.get(user=user)

        if shift.role_needed == 'INTERN':
            key = 'FIRST_HALF' if ob.intern_half == 'FIRST_HALF' else 'SECOND_HALF'
        elif shift.role_needed == 'STUDENT':
            key = ob.student_year
        else:
            key = ob.classification_level

        base_rate = Decimal(AWARD_RATES[shift.role_needed][key][time_type or day_type])
        rate = base_rate + owner_bonus
        reason = {
            "type": time_type or day_type,
            "role_key": key,
            "source": "Award",
            "bonus_applied": owner_bonus > 0
        }
        return rate, reason

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
        hours = entry['hours']
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
            "quantity": float(hours),
            "unit_price": float(rate),
            "discount": 0,
            "total": float(total),
            "was_modified": False,
            "rate_reason": reason  # Optional: frontend may use
        })

    return line_items


def generate_invoice_from_shifts(user, pharmacy_id=None, shift_ids=None, custom_lines=None, external=False, billing_data=None, due_date=None):
    try:
        ob = PharmacistOnboarding.objects.get(user=user)
    except PharmacistOnboarding.DoesNotExist:
        ob = OtherStaffOnboarding.objects.get(user=user)

    invoice = Invoice.objects.create(
        user=user,
        external=external,
        issuer_first_name=ob.first_name,
        issuer_last_name=ob.last_name,
        issuer_abn=ob.abn or '',
        issuer_email=billing_data['issuer_email'],
        gst_registered=billing_data['gst_registered'],
        super_rate_snapshot=Decimal(str(billing_data['super_rate_snapshot'])),
        bank_account_name=billing_data['bank_account_name'],
        bsb=billing_data['bsb'],
        account_number=billing_data['account_number'],
        cc_emails=billing_data.get('cc_emails', ''),
        due_date=due_date,
    )

    subtotal = Decimal('0.00')

    if not external:
        pharmacy = Pharmacy.objects.get(pk=pharmacy_id)
        invoice.pharmacy = pharmacy
        invoice.pharmacy_name_snapshot = pharmacy.name
        invoice.pharmacy_address_snapshot = pharmacy.address
        invoice.pharmacy_abn_snapshot = pharmacy.abn

        shift = Shift.objects.get(pk=shift_ids[0])
        invoice.bill_to_first_name = shift.created_by.first_name
        invoice.bill_to_last_name = shift.created_by.last_name
        invoice.bill_to_abn = shift.created_by.onboarding.abn
        invoice.bill_to_email = shift.created_by.email

    for shift in Shift.objects.filter(pk__in=shift_ids):
        for entry in expand_shift_slots(shift):
            slot = entry['slot']
            slot_date = entry['date']
            try:
                assn = ShiftSlotAssignment.objects.get(slot=slot, slot_date=slot_date)
            except ShiftSlotAssignment.DoesNotExist:
                continue

            qty = entry['hours']
            rate = assn.unit_rate or Decimal('0.00')
            reason = assn.rate_reason or ""
            slot_date = entry['date']

            # Format readable reason
            if isinstance(reason, dict):
                parts = []
                if reason.get('type'):
                    parts.append(reason['type'])
                if reason.get('role_key'):
                    parts.append(reason['role_key'])
                if reason.get('source'):
                    parts.append(reason['source'])
                if reason.get('bonus_applied'):
                    parts.append("bonus")
                reason_str = ' / '.join(parts)
            else:
                reason_str = str(reason)

            start_str = entry['start_time'].strftime('%H:%M')
            end_str = entry['end_time'].strftime('%H:%M')
            date_str = slot_date.strftime('%d/%m')
            description = f"{start_str}–{end_str} {date_str} — {reason_str}"

            total = (qty * rate).quantize(Decimal('0.01'))

            InvoiceLineItem.objects.create(
                invoice=invoice,
                description=description,
                unit='Hours',
                quantity=qty,
                unit_price=rate,
                discount=Decimal('0.00'),
                total=total,
                gst_applicable=invoice.gst_registered,
                super_applicable=True,
                shift=shift,
                was_modified=False
            )
            subtotal += total

    for ln in (custom_lines or []):
        qty = Decimal(str(ln['quantity']))
        rate = Decimal(str(ln['unit_price']))
        discount = Decimal(str(ln.get('discount', 0))) / Decimal('100')
        total = (qty * rate * (1 - discount)).quantize(Decimal('0.01'))

        InvoiceLineItem.objects.create(
            invoice=invoice,
            description=ln['description'],
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

    gst_amt = (subtotal * Decimal('0.10')).quantize(Decimal('0.01')) if invoice.gst_registered else Decimal('0.00')
    super_amt = (subtotal * (invoice.super_rate_snapshot / Decimal('100'))).quantize(Decimal('0.01'))

    invoice.subtotal = subtotal
    invoice.gst_amount = gst_amt
    invoice.super_amount = super_amt
    invoice.total = (subtotal + gst_amt + super_amt).quantize(Decimal('0.01'))
    invoice.save()

    if super_amt > 0:
        InvoiceLineItem.objects.create(
            invoice=invoice,
            description="Superannuation",
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
