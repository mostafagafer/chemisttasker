from django.conf import settings
import re
from django.contrib.auth import get_user_model
from django_q.tasks import async_task
import difflib
from django.utils import timezone
from django.core.signing import TimestampSigner
from urllib.parse import urlencode

def build_shift_email_context(shift, user=None, extra=None, role=None, shift_type=None):
    """
    Build context for shift notification emails with robust worker and owner links.
    """
    frontend_role = role or (user.role.lower() if user else 'owner')
    shift_link = ""

    if user:
        if user.role == 'OWNER':
            shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/owner/shifts/{shift.id}"
        elif hasattr(user, 'organization_memberships') and user.organization_memberships.filter(role='ORG_ADMIN').exists():
            shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/organization/shifts/{shift.id}"
        elif user.role == 'PHARMACIST':
            shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/pharmacist/shifts/{shift.id}"
        elif user.role == 'OTHER_STAFF':
            shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/otherstaff/shifts/{shift.id}"
        elif user.role == 'EXPLORER':
            shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/explorer/shifts/{shift.id}"
        else:
            shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/{frontend_role}/shifts/{shift.id}"

    else:
        shift_link = f"{settings.FRONTEND_BASE_URL}/dashboard/owner/shifts/active/{shift.id}"


    ctx = {
        "shift_id": shift.id,
        "pharmacy_name": shift.pharmacy.name,
        "role_needed": shift.role_needed,
        "frontend_role": frontend_role,
        "shift_link": shift_link,
    }
    if user:
        ctx.update({
            "user_first_name": user.first_name,
            "user_last_name": user.last_name,
            "user_email": user.email,
        })
    if extra:
        ctx.update(extra)
    return ctx

def build_roster_email_link(user, pharmacy=None):
    """
    Build the correct frontend roster URL for the email button,
    using org-admin/role logic (matches build_shift_email_context).
    """
    frontend_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")
    roster_link = ""

    if user:
        # Org admin check via memberships (most specific, matches shift email context)
        if hasattr(user, 'organization_memberships') and user.organization_memberships.filter(role='ORG_ADMIN').exists():
            roster_link = f"{frontend_url}/dashboard/organization/manage-pharmacies/roster"
        elif user.role == 'OWNER':
            roster_link = f"{frontend_url}/dashboard/owner/manage-pharmacies/roster"
        elif user.role == 'PHARMACIST':
            roster_link = f"{frontend_url}/dashboard/pharmacist/shifts/roster"
        elif user.role == 'OTHER_STAFF':
            roster_link = f"{frontend_url}/dashboard/otherstaff/shifts/roster"
        elif user.role == 'EXPLORER':
            roster_link = f"{frontend_url}/dashboard/explorer/roster"
        else:
            frontend_role = getattr(user, 'role', 'owner').lower()
            roster_link = f"{frontend_url}/dashboard/{frontend_role}/roster"
    else:
        roster_link = f"{frontend_url}/dashboard/owner/manage-pharmacies/roster"

    # If you ever want to add a pharmacy param: .../roster?pharmacy={pharmacy.id}
    return roster_link

def clean_email(email):
    """Remove hidden unicode chars and spaces from email."""
    if not email:
        return email
    # Remove LTR/RTL, bidi, zero-width space, and all whitespace
    # \u200e (LTR), \u200f (RTL), \u202a-\u202e (bidi), \u200b (zero-width space), \s (any space)
    return re.sub(r'[\u200e\u200f\u202a-\u202e\u200b\s]', '', email)

# def send_referee_emails(obj, is_reminder=False):
#     """
#     Sends referee email(s). Now handles both initial requests and reminders
#     by choosing the correct template based on the `is_reminder` flag.
#     """
#     for idx in [1, 2]:
#         email_raw = getattr(obj, f'referee{idx}_email', None)
#         confirmed = getattr(obj, f'referee{idx}_confirmed', None)
#         rejected = getattr(obj, f'referee{idx}_rejected', None)
#         name = getattr(obj, f'referee{idx}_name', '')
#         relation = getattr(obj, f'referee{idx}_relation', '')
#         email = clean_email(email_raw)

#         if email and not confirmed and not rejected:
#             # --- FIX: CHOOSE TEMPLATE AND SUBJECT BASED ON THE REMINDER FLAG ---
#             if is_reminder:
#                 subject = f"Gentle Reminder: Reference Request for {obj.user.get_full_name()}"
#                 template_name = "emails/referee_reminder.html"
#                 text_template = "emails/referee_reminder.txt" # Assumes you have a .txt version
#             else:
#                 subject = "Reference Request: Please Confirm for ChemistTasker"
#                 template_name = "emails/referee_request.html"
#                 text_template = "emails/referee_request.txt"
#             # --- END OF FIX ---

#             confirm_url = f"{settings.FRONTEND_BASE_URL}/onboarding/referee-confirm/{obj.pk}/{idx}"
#             reject_url  = f"{settings.FRONTEND_BASE_URL}/onboarding/referee-reject/{obj.pk}/{idx}"
            
#             async_task(
#                 'users.tasks.send_async_email',
#                 subject=subject,
#                 recipient_list=[email],
#                 template_name=template_name,
#                 context={
#                     "referee_name": name,
#                     "referee_relation": relation,
#                     "candidate_name": obj.user.get_full_name(),
#                     "candidate_first_name": obj.user.first_name,
#                     "candidate_last_name": obj.user.last_name,
#                     "confirm_url": confirm_url,
#                     "reject_url": reject_url,
#                 },
#                 text_template=text_template
#             )
#             setattr(obj, f'referee{idx}_last_sent', timezone.now())
            
#     # Save last_sent timestamps if they were updated
#     obj.save(update_fields=['referee1_last_sent', 'referee2_last_sent'])

def get_candidate_role(obj) -> str:
    """
    Pharmacist => 'Pharmacist'
    OtherStaff/Explorer => use whatever role field you already store.
    Falls back gracefully if your field names differ.
    """
    model = obj._meta.model_name
    if model == 'pharmacistonboarding':
        return 'Pharmacist'

    for field in ('position_applied_for', 'desired_role', 'role', 'staff_role', 'explorer_role'):
        val = getattr(obj, field, None)
        if val:
            return str(val)

    rp = getattr(obj, 'rate_preference', None)
    if isinstance(rp, dict):
        for k in ('role', 'position', 'title', 'position_applied_for'):
            if rp.get(k):
                return str(rp[k])

    return model.replace('onboarding', '').replace('_', ' ').title()


def send_referee_emails(obj, is_reminder=False):
    """
    Sends referee email(s). Generates a secure token for the questionnaire link.
    Also schedules a per-referee reminder for each email sent.
    """
    signer = TimestampSigner()

    update_fields = []
    for idx in [1, 2]:
        email_raw = getattr(obj, f'referee{idx}_email', None)
        confirmed = getattr(obj, f'referee{idx}_confirmed', None)
        rejected = getattr(obj, f'referee{idx}_rejected', None)
        name = getattr(obj, f'referee{idx}_name', '')
        workplace = getattr(obj, f'referee{idx}_workplace', '')
        relation = getattr(obj, f'referee{idx}_relation', '')
        email = clean_email(email_raw)

        if email and not confirmed and not rejected:
            if is_reminder:
                subject = f"Gentle Reminder: Reference Request for {obj.user.get_full_name()}"
                template_name = "emails/referee_reminder.html"
                text_template = "emails/referee_reminder.txt"
            else:
                subject = "Reference Request: Please Complete for ChemistTasker"
                template_name = "emails/referee_request.html"
                text_template = "emails/referee_request.txt"

            token = signer.sign(f"{obj._meta.model_name}:{obj.pk}:{idx}")

            # ✅ NEW: include role in the querystring
            query = urlencode({
                "candidate_name": obj.user.get_full_name(),
                "position_applied_for": get_candidate_role(obj),
            })
            confirm_url = f"{settings.FRONTEND_BASE_URL}/referee/questionnaire/{token}?{query}"

            reject_url = f"{settings.FRONTEND_BASE_URL}/onboarding/referee-reject/{obj.pk}/{idx}"

            async_task(
                'users.tasks.send_async_email',
                subject=subject,
                recipient_list=[email],
                template_name=template_name,
                context={
                    "referee_name": name,
                    "referee_relation": relation,
                    "referee_workplace": workplace,
                    "candidate_name": obj.user.get_full_name(),
                    "candidate_first_name": obj.user.first_name,
                    "candidate_last_name": obj.user.last_name,
                    "confirm_url": confirm_url,
                    "reject_url": reject_url,
                    # (optional if your template wants to render it)
                    "position_applied_for": get_candidate_role(obj),
                },
                text_template=text_template
            )
            setattr(obj, f'referee{idx}_last_sent', timezone.now())
            update_fields.append(f'referee{idx}_last_sent')

            # Schedule THIS referee's reminder (initial)
            try:
                from client_profile.tasks import schedule_referee_reminder
                schedule_referee_reminder(obj._meta.model_name, obj.pk, idx, hours=0.1)  # keep your dev interval
            except Exception:
                pass

    if update_fields:
        obj.save(update_fields=list(set(update_fields)))

def summarize_onboarding_fields(obj):
    summary = {}
    for field in obj._meta.fields:
        if field.name in ('id', 'user', 'created', 'modified', 'pk'):
            continue
        value = getattr(obj, field.name, None)
        if value not in [None, '', []]:
            # FieldFile or file: get url if possible, else name, else string
            if hasattr(value, "url"):
                val = value.url
            elif hasattr(value, "name"):
                val = value.name
            else:
                try:
                    val = str(value)
                except Exception:
                    val = "[Unserializable]"
            summary[field.verbose_name.title()] = val
    return summary

def notify_superuser_on_onboarding(obj):
    User = get_user_model()
    superusers = User.objects.filter(is_superuser=True, email__isnull=False).values_list('email', flat=True)
    if not superusers:
        return

    model = obj._meta
    admin_url = f"{settings.BACKEND_BASE_URL}/admin/{model.app_label}/{model.model_name}/{obj.pk}/change/"
    context = {
        "model_verbose_name": model.verbose_name,
        "pk": obj.pk,
        "user": str(getattr(obj, "user", "")),
        "user_full_name": getattr(obj.user, "get_full_name", lambda: str(obj.user))(),
        "user_email": getattr(obj.user, "email", ""),
        "admin_url": admin_url,
        "summary_fields": summarize_onboarding_fields(obj),  # Now always strings
        "created": str(getattr(obj, "created", "")),
    }
    async_task(
        'users.tasks.send_async_email',
        subject=f"New {model.verbose_name.title()} Submission (ID {obj.pk})",
        recipient_list=list(superusers),
        template_name="emails/admin_onboarding_notification.html",
        context=context,
        text_template="emails/admin_onboarding_notification.txt",
    )

def simple_name_match(extracted_text, first_name, last_name, cutoff=0.8):
    if not extracted_text or not first_name or not last_name:
        return False
    text = extracted_text.lower()
    text = re.sub(r'\b(mr|mrs|ms|dr|miss|prof|sir)\b[.]*', '', text)
    words = text.split()
    f_name = first_name.lower().strip()
    l_name = last_name.lower().strip()
    def phrase_match(target, words):
        n = len(words)
        t_len = len(target.split())
        for i in range(n):
            for j in range(i+1, min(i+1+t_len+2, n+1)):
                phrase = " ".join(words[i:j]).strip()
                if target == phrase or difflib.SequenceMatcher(None, phrase, target).ratio() >= cutoff:
                    return True
        for word in words:
            if word == target or difflib.SequenceMatcher(None, word, target).ratio() >= cutoff:
                return True
        return False
    return phrase_match(f_name, words) and phrase_match(l_name, words)

def get_frontend_dashboard_url(user):
    """
    Returns the appropriate frontend dashboard URL based on the user's role.
    Handles 'OTHER_STAFF' to 'otherstaff' conversion.
    """
    if not user or not hasattr(user, 'role'):
        return f"{settings.FRONTEND_BASE_URL}/dashboard/" # Default fallback

    role_slug = user.role.lower()
    if role_slug == 'other_staff': # Your specific conversion rule
        role_slug = 'otherstaff'
    elif role_slug == 'owner':
        # Check for organization admin role first if it influences dashboard path
        # Assuming 'ORGANIZATION' role is handled within the 'owner' dashboard structure or has its own path
        if hasattr(user, 'organization_memberships') and user.organization_memberships.filter(role='ORG_ADMIN').exists():
            return f"{settings.FRONTEND_BASE_URL}/dashboard/organization/" # Or whatever your org admin path is
        else:
            return f"{settings.FRONTEND_BASE_URL}/dashboard/owner/"
    
    return f"{settings.FRONTEND_BASE_URL}/dashboard/{role_slug}/"

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

def q6(v):
    """Quantize to 6 decimal places; return None on blank/invalid."""
    if v in (None, ''):
        return None
    try:
        return Decimal(str(v)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError, TypeError):
        return None
