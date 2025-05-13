# invoicing/services.py
from datetime import datetime, timedelta
from decimal import Decimal
from .models import Invoice, InvoiceLineItem
from client_profile.models import Shift, Pharmacy

def expand_recurring_slots(slots):
    """
    Turn each ShiftSlot into per-day entries:
      - Uses slot.date, start_time, end_time
      - If slot.is_recurring: repeats on slot.recurring_days (0=Sun..6=Sat)
        until slot.recurring_end_date
    Returns: [{'date': date, 'hours': Decimal}, ...]
    """
    entries = []
    for slot in slots:
        # Map [0=Sun..6=Sat] → Python weekday [0=Mon..6=Sun]
        mapped_days = [ (d + 6) % 7 for d in slot.recurring_days ] if slot.is_recurring else []

        # Helper to compute hours for a given day
        def hours_on(day):
            start = datetime.combine(day, slot.start_time)
            end   = datetime.combine(day, slot.end_time)
            return Decimal((end - start).total_seconds() / 3600).quantize(Decimal('0.01'))

        if slot.is_recurring:
            current = slot.date
            last    = slot.recurring_end_date
            while current <= last:
                if current.weekday() in mapped_days:
                    entries.append({'date': current, 'hours': hours_on(current)})
                current += timedelta(days=1)
        else:
            # One-off
            entries.append({'date': slot.date, 'hours': hours_on(slot.date)})

    return entries

def generate_invoice_from_shifts(
    user,
    pharmacy_id=None,
    shift_ids=None,
    custom_lines=None,
    external=False,
    billing_data=None,
    due_date=None
):
    # 1) Build invoice fields
    fields = {
        'user': user,
        'external': external,
        'pharmacist_abn': billing_data['pharmacist_abn'],
        'gst_registered': billing_data['gst_registered'],
        'super_rate_snapshot': Decimal(str(billing_data['super_rate_snapshot'])),
        'bank_account_name': billing_data['bank_account_name'],
        'bsb': billing_data['bsb'],
        'account_number': billing_data['account_number'],
        'bill_to_email': billing_data['bill_to_email'],
        'cc_emails': billing_data.get('cc_emails', ''),
        'due_date': due_date,
    }

    # 2) Snapshot client info
    if not external:
        pharmacy = Pharmacy.objects.get(pk=pharmacy_id)
        fields.update({
            'pharmacy': pharmacy,
            'pharmacy_name_snapshot': pharmacy.name,
            'pharmacy_address_snapshot': pharmacy.address,
            'pharmacy_abn_snapshot': pharmacy.abn,
        })
    else:
        fields.update({
            'custom_bill_to_name': billing_data['custom_bill_to_name'],
            'custom_bill_to_address': billing_data['custom_bill_to_address'],
        })

    invoice = Invoice.objects.create(**fields)
    subtotal = Decimal('0.00')

    # 3) Shift-derived items
    if shift_ids:
        shifts = Shift.objects.filter(pk__in=shift_ids, accepted_user=user)
        for shift in shifts:
            for entry in expand_recurring_slots(shift.slots.all()):
                qty      = entry['hours']
                rate     = shift.fixed_rate
                discount = Decimal('0.00')
                total    = (qty * rate * (1 - discount)).quantize(Decimal('0.01'))

                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    description=f"{shift.role_needed.title()} on {entry['date']}",
                    category_code='4-1300',
                    unit='Hours',
                    quantity=qty,
                    unit_price=rate,
                    discount=discount * Decimal('100'),
                    total=total,
                    gst_applicable=invoice.gst_registered,
                    super_applicable=True,
                    shift=shift
                )
                subtotal += total

    # 4) Manual lines
    for ln in (custom_lines or []):
        qty      = Decimal(str(ln['quantity']))
        rate     = Decimal(str(ln['unit_price']))
        discount = Decimal(str(ln.get('discount', 0))) / Decimal('100')
        total    = (qty * rate * (1 - discount)).quantize(Decimal('0.01'))

        InvoiceLineItem.objects.create(
            invoice=invoice,
            description=ln['description'],
            category_code=ln.get('category_code', '2-1800'),
            unit=ln.get('unit', 'Hours'),
            quantity=qty,
            unit_price=rate,
            discount=discount * Decimal('100'),
            total=total,
            gst_applicable=ln.get('gst_applicable', True),
            super_applicable=ln.get('super_applicable', True),
            is_manual=True
        )
        subtotal += total

    # 5) Totals
    gst_amt   = (subtotal * Decimal('0.10')).quantize(Decimal('0.01')) if invoice.gst_registered else Decimal('0.00')
    super_amt = (subtotal * (invoice.super_rate_snapshot / Decimal('100'))).quantize(Decimal('0.01'))

    invoice.subtotal    = subtotal
    invoice.gst_amount  = gst_amt
    invoice.super_amount = super_amt
    invoice.total       = (subtotal + gst_amt + super_amt).quantize(Decimal('0.01'))
    invoice.save()

    # 6) Insert Superannuation line as a manual child
    if super_amt > 0:
        InvoiceLineItem.objects.create(
            invoice=invoice,
            description="Superannuation",
            category_code="6-4200",
            unit="Lump Sum",
            quantity=Decimal('1.00'),
            unit_price=super_amt,
            discount=Decimal('0.00'),
            total=super_amt,
            gst_applicable=False,
            super_applicable=False,
            is_manual=True,
        )

    return invoice
