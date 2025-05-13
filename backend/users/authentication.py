# users/authentication.py

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailBackend(ModelBackend):
    """
    Authenticate using email (case‑insensitive) instead of username.
    Falls back to ModelBackend for admin/site‑wide lookups.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # here `username` is actually the email address
        if username is None or password is None:
            return None
        try:
            user = User.objects.get(email__iexact=username)
        except User.DoesNotExist:
            return None
        return user if user.check_password(password) and self.user_can_authenticate(user) else None
