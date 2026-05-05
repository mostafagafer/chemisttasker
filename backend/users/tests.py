from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class PasswordResetConfirmTests(TestCase):
    @override_settings(AXES_ENABLED=True)
    def test_successful_password_reset_clears_axes_attempts_for_user(self):
        from axes.models import AccessAttempt

        user = get_user_model().objects.create_user(
            email="locked@example.com",
            password="OldPassword123!",
            role="PHARMACIST",
        )
        AccessAttempt.objects.create(
            username=user.email,
            ip_address="192.168.1.3",
            user_agent="test-client",
            path_info="/api/users/login/",
            failures_since_start=6,
        )

        response = self.client.post(
            reverse("password_reset_confirm_api"),
            {
                "uid": urlsafe_base64_encode(force_bytes(user.pk)),
                "token": default_token_generator.make_token(user),
                "new_password1": "NewPassword123!",
                "new_password2": "NewPassword123!",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(AccessAttempt.objects.filter(username__iexact=user.email).exists())
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewPassword123!"))
