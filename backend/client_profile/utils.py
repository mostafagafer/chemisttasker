from django.conf import settings
import re
from django.contrib.auth import get_user_model
import time
from django_q.tasks import async_task
import sys

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
        # Org admin check via memberships (most specific!)
        if hasattr(user, 'organization_memberships') and user.organization_memberships.filter(role='ORG_ADMIN').exists():
            roster_link = f"{frontend_url}/dashboard/organization/manage-pharmacies/roster"
        elif getattr(user, 'role', None) == 'OWNER':
            roster_link = f"{frontend_url}/dashboard/owner/manage-pharmacies/roster"
        elif getattr(user, 'role', None) == 'PHARMACIST':
            roster_link = f"{frontend_url}/dashboard/pharmacist/shifts/roster"
        elif getattr(user, 'role', None) == 'OTHER_STAFF' or getattr(user, 'role', None) == 'ASSISTANT' or getattr(user, 'role', None) == 'INTERN':
            roster_link = f"{frontend_url}/dashboard/otherstaff/shifts/roster"
        elif getattr(user, 'role', None) == 'EXPLORER':
            roster_link = f"{frontend_url}/dashboard/explorer/roster"
        else:
            frontend_role = getattr(user, 'role', 'owner').lower()
            roster_link = f"{frontend_url}/dashboard/{frontend_role}/roster"
    else:
        roster_link = f"{frontend_url}/dashboard/owner/manage-pharmacies/roster"

    # You can extend here to add ?pharmacy={pharmacy.id} if desired in the future
    return roster_link

def clean_email(email):
    """Remove hidden unicode chars and spaces from email."""
    if not email:
        return email
    # Remove LTR/RTL, bidi, zero-width space, and all whitespace
    # \u200e (LTR), \u200f (RTL), \u202a-\u202e (bidi), \u200b (zero-width space), \s (any space)
    return re.sub(r'[\u200e\u200f\u202a-\u202e\u200b\s]', '', email)

def send_referee_emails(obj, validated_data, creation=False):
    submitted_now = validated_data.get('submitted_for_verification', False)
    if submitted_now:
        for idx in [1, 2]:
            email_raw = getattr(obj, f'referee{idx}_email', None)
            confirmed = getattr(obj, f'referee{idx}_confirmed', None)
            name = getattr(obj, f'referee{idx}_name', '')
            relation = getattr(obj, f'referee{idx}_relation', '')
            email = clean_email(email_raw)
            if email and not confirmed:
                confirm_url = f"{settings.FRONTEND_BASE_URL}/onboarding/referee-confirm/{obj.pk}/{idx}"
                async_task(
                    'users.tasks.send_async_email',

                    subject="Reference Request: Please Confirm for ChemistTasker",
                    recipient_list=[email],
                    template_name="emails/referee_request.html",
                    context={
                        "referee_name": name,
                        "referee_relation": relation,
                        "candidate_name": obj.user.get_full_name(),
                        "candidate_first_name": obj.user.first_name,
                        "candidate_last_name": obj.user.last_name,
                        "confirm_url": confirm_url,
                    },
                    text_template="emails/referee_request.txt"
                )

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

def simple_name_match(extracted_text, first_name, last_name):
    """
    Returns True if BOTH first_name and last_name (case-insensitive, stripped) appear in the extracted_text.
    Ignores word order, spacing, and case.
    """
    # Defensive: handle None
    if not extracted_text or not first_name or not last_name:
        return False

    # Clean up: lowercase and strip accents/whitespace
    text = extracted_text.lower()
    f_name = first_name.lower().strip()
    l_name = last_name.lower().strip()

    # Optional: Remove common prefixes/titles
    text = re.sub(r'\b(mr|mrs|ms|dr|miss|prof|sir)\b[.]*', '', text)

    # Check both names exist somewhere (can be far apart)
    return f_name in text and l_name in text


# def run_abn(): # No kwargs here either
#     print('running verify_abn_task code in utils', file=sys.stderr, flush=True)
#     async_task('client_profile.tasks.verify_abn_new')
#     time.sleep(2)

# def run_ahpra(): # No kwargs here either
#     print('running verify_ahpra_task code in utils', file=sys.stderr, flush=True)
#     async_task('client_profile.tasks.verify_ahpra_new')
#     time.sleep(2)

# def run_filefield(): # No kwargs here either
#     print('running verify_filefield_task code in utils', file=sys.stderr, flush=True)
#     async_task('client_profile.tasks.verify_file_new')
#     time.sleep(2)


