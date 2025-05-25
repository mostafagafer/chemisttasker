from django.conf import settings

def get_frontend_onboarding_url(user):
    role = user.role.lower() if user.role != 'OTHER_STAFF' else 'otherstaff'
    return f"{settings.FRONTEND_BASE_URL}/onboarding/{role}/"
