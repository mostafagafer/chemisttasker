from django.conf import settings
from users.tasks import send_async_email
import re
from django.contrib.auth import get_user_model

def determine_shift_type_string(shift):
    """
    Convert backend shift visibility or status into the frontend 'type' string for URLs.
    """
    if shift.visibility == 'PLATFORM':
        return 'public'
    elif shift.visibility in ['PHARMACY', 'OWNER_CHAIN', 'ORG_CHAIN']:
        return 'community'
    # You could extend here for 'active', 'confirmed', etc., if you add them.
    return 'public'  # fallback

def build_shift_email_context(shift, user=None, extra=None, role=None, shift_type=None):
    """
    Build the context for shift notification emails.
    Ensures the link is always correct for the ShiftDetailPage.
    """
    # Compute role and type if not explicitly provided
    frontend_role = role or (user.role.lower() if user else 'owner')
    frontend_shift_type = shift_type or determine_shift_type_string(shift)

    ctx = {
        "shift_id": shift.id,
        "pharmacy_name": shift.pharmacy.name,
        "role_needed": shift.role_needed,
        "frontend_role": frontend_role,
        "frontend_shift_type": frontend_shift_type,
        "shift_link": f"{settings.FRONTEND_BASE_URL}/dashboard/{frontend_role}/shifts/{frontend_shift_type}/{shift.id}",
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

def clean_email(email):
    """Remove hidden unicode chars and spaces from email."""
    if not email:
        return email
    # Remove LTR/RTL, bidi, zero-width space, and all whitespace
    # \u200e (LTR), \u200f (RTL), \u202a-\u202e (bidi), \u200b (zero-width space), \s (any space)
    return re.sub(r'[\u200e\u200f\u202a-\u202e\u200b\s]', '', email)

def send_referee_emails(obj, validated_data, creation=False):
    if creation:
        submitted_now = validated_data.get('submitted_for_verification', False)
    else:
        submitted_now = validated_data.get('submitted_for_verification', False) and not obj.submitted_for_verification

    if submitted_now:
        for idx in [1, 2]:
            email_raw = getattr(obj, f'referee{idx}_email', None)
            confirmed = getattr(obj, f'referee{idx}_confirmed', None)
            name = getattr(obj, f'referee{idx}_name', '')
            relation = getattr(obj, f'referee{idx}_relation', '')
            email = clean_email(email_raw)
            if email and not confirmed:
                confirm_url = f"{settings.FRONTEND_BASE_URL}/onboarding/referee-confirm/{obj.pk}/{idx}"
                send_async_email.defer(
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
    send_async_email.defer(
        subject=f"New {model.verbose_name.title()} Submission (ID {obj.pk})",
        recipient_list=list(superusers),
        template_name="emails/admin_onboarding_notification.html",
        context=context,
        text_template="emails/admin_onboarding_notification.txt",
    )
