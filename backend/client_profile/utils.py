from django.conf import settings

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


import re

def clean_email(email):
    """Remove hidden unicode chars and spaces from email."""
    if not email:
        return email
    # Remove LTR/RTL, bidi, zero-width space, and all whitespace
    # \u200e (LTR), \u200f (RTL), \u202a-\u202e (bidi), \u200b (zero-width space), \s (any space)
    return re.sub(r'[\u200e\u200f\u202a-\u202e\u200b\s]', '', email)
