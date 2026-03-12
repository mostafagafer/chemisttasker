# users/authentication.py

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication

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


class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT auth that also accepts access tokens from an HttpOnly cookie.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

        cookie_name = getattr(settings, "JWT_AUTH_COOKIE", "ct_access")
        raw_token = request.COOKIES.get(cookie_name)
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
