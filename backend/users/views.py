from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView  
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, filters, generics, status
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.utils.crypto import get_random_string
from rest_framework.response import Response
from .models import OrganizationMembership
from client_profile.admin_helpers import admin_assignments_for
from .serializers import InviteOrgUserSerializer
from .permissions import OrganizationRolePermission
from django.conf import settings
from django_q.tasks import async_task
from rest_framework.views import APIView
from users.tasks import send_async_email
from users.utils import get_frontend_onboarding_url
from datetime import timedelta
from django.utils import timezone
import random
import logging
from .serializers import (
    UserRegistrationSerializer,
    CustomTokenObtainPairSerializer,
    UserProfileSerializer,
    CustomTokenRefreshSerializer
)
User = get_user_model()
import requests
from requests.auth import HTTPBasicAuth


def verify_recaptcha(token):
    from django.conf import settings
    secret_key = settings.RECAPTCHA_SECRET_KEY
    url = 'https://www.google.com/recaptcha/api/siteverify'
    data = {'secret': secret_key, 'response': token}

    try:
        response = requests.post(url, data=data, timeout=5)
        response.raise_for_status()
    except requests.RequestException as exc:
        logging.getLogger(__name__).warning("reCAPTCHA verification failed: %s", exc)
        return False

    try:
        result = response.json()
    except ValueError:
        logging.getLogger(__name__).warning("reCAPTCHA response was not valid JSON")
        return False
    return result.get('success', False)

class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        captcha_token = request.data.get('captcha_token')
        if not captcha_token or not verify_recaptcha(captcha_token):
            return Response(
                {'captcha': ['reCAPTCHA validation failed. Please try again.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = serializer.save()
        otp_subject = "Your ChemistTasker Verification Code"
        otp_context = {"otp": user.otp_code, "user": user}
        send_async_email(
            subject=otp_subject,
            recipient_list=[user.email],
            template_name="emails/otp_email.html",
            context=otp_context,
            text_template="emails/otp_email.txt"
        )

class VerifyOTPView(APIView):
    OTP_EXPIRY_MINUTES = 10

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp")
        user = User.objects.filter(email__iexact=email).first()

        if not user or not otp:
            return Response({"detail": "Invalid credentials."}, status=400)

        # --- Check if OTP is expired ---
        if not user.otp_created_at or (timezone.now() - user.otp_created_at > timedelta(minutes=self.OTP_EXPIRY_MINUTES)):
            return Response({"detail": "OTP has expired. Please request a new code."}, status=400)

        # --- Check if OTP matches ---
        if user.otp_code != otp:
            return Response({"detail": "Incorrect OTP."}, status=400)

        # --- Success: verify user and clear OTP ---
        user.is_otp_verified = True
        user.otp_code = None
        user.otp_created_at = None
        user.save()

        # --- Send welcome email (kept exactly as you have) ---
        onboarding_link = get_frontend_onboarding_url(user)
        ctx = {
            "first_name": user.first_name,
            "email": user.email,
            "onboarding_link": onboarding_link,
        }
        async_task(
            'users.tasks.send_async_email',
            subject="🎉 Welcome to ChemistTasker! Let’s Get You Started 🌟",
            recipient_list=[user.email],
            template_name="emails/welcome_email.html",
            context=ctx,
            text_template="emails/welcome_email.txt"
        )

        # --- Also return tokens + user payload so frontend can call mobile-verify authenticated ---
        refresh = RefreshToken.for_user(user)

        # Build memberships payload exactly like your serializers
        from .models import OrganizationMembership
        from client_profile.models import Membership as PharmacyMembership

        org_memberships = OrganizationMembership.objects.filter(user=user)
        org_payload = [
            {
                'organization_id':   m.organization_id,
                'organization_name': m.organization.name,
                'role':              m.role,
                'region':            m.region,
            }
            for m in org_memberships
        ]

        pharm_memberships = PharmacyMembership.objects.filter(
            user=user,
            is_active=True,
        ).select_related('pharmacy')

        pharm_payload = [
            {
                'pharmacy_id':   pm.pharmacy_id,
                'pharmacy_name': pm.pharmacy.name if pm.pharmacy else None,
                'role':          pm.role,
            }
              for pm in pharm_memberships
          ]

        admin_assignments = (
            admin_assignments_for(user)
            .select_related("pharmacy")
        )
        admin_payload = [
            {
                "pharmacy_id": assignment.pharmacy_id,
                "pharmacy_name": assignment.pharmacy.name if assignment.pharmacy else None,
                "admin_level": assignment.admin_level,
                "capabilities": sorted(list(assignment.capabilities)),
                "staff_role": assignment.staff_role,
                "job_title": assignment.job_title,
            }
            for assignment in admin_assignments
        ]

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "memberships": org_payload + pharm_payload,
                "admin_assignments": admin_payload,
                "is_pharmacy_admin": bool(admin_payload),
                # helpful flags for frontend:
                "is_otp_verified": True,
                "is_mobile_verified": bool(getattr(user, "is_mobile_verified", False)),
            }
        }, status=200)

class ResendOTPView(APIView):
    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "No account with this email."}, status=400)

        # Only allow resending if not verified
        if user.is_otp_verified:
            return Response({"detail": "User already verified."}, status=400)

        # Generate new OTP
        otp = str(random.randint(100000, 999999))
        user.otp_code = otp
        user.otp_created_at = timezone.now()
        user.save()

        # Send OTP email (same as initial registration)
        context = {"otp": otp, "user": user}
        send_async_email(
            subject="Your ChemistTasker Verification Code",
            recipient_list=[user.email],
            template_name="emails/otp_email.html",
            context=context,
            text_template="emails/otp_email.txt",  # if using text version
        )

        return Response({"detail": "A new OTP has been sent to your email."}, status=200)

# --- views.py (excerpt): mobile OTP flow ---

import random
from datetime import timedelta
from django.utils import timezone
from django.conf import settings

import requests
from requests.auth import HTTPBasicAuth

from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response


# Helpers
def generate_otp() -> str:
    """Return a 6-digit OTP as a string."""
    return f"{random.randint(100000, 999999)}"


def normalize_au_mobile(raw: str) -> str:
    """
    Normalize Australian numbers to 61XXXXXXXXX format.
    Accepts: 0412..., +61412..., 61412..., with spaces/dashes.
    """
    if not raw:
        return ""
    n = raw.replace(" ", "").replace("-", "")
    if n.startswith("+"):
        n = n[1:]
    if n.startswith("0") and len(n) >= 2:
        n = "61" + n[1:]
    return n


def valid_otp_format(otp: str) -> bool:
    """OTP must be exactly 6 digits."""
    return bool(otp and otp.isdigit() and len(otp) == 6)


class RequestMobileOTPView(APIView):
    """
    Step 1: User submits mobile number; system generates and sends OTP via SMS.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        mobile_number = request.data.get("mobile_number")

        if not mobile_number:
            return Response({"error": "Mobile number is required"}, status=status.HTTP_400_BAD_REQUEST)

        normalized = normalize_au_mobile(mobile_number)
        if not normalized or not normalized.startswith("61"):
            return Response({"error": "Invalid Australian mobile number format"}, status=status.HTTP_400_BAD_REQUEST)

        # 60-second cooldown to prevent spamming
        if user.mobile_otp_created_at and timezone.now() - user.mobile_otp_created_at < timedelta(seconds=60):
            return Response(
                {"error": "Please wait 60 seconds before requesting a new OTP."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Persist to user
        otp_code = generate_otp()
        user.mobile_number = normalized
        user.mobile_otp_code = otp_code
        user.mobile_otp_created_at = timezone.now()
        user.is_mobile_verified = False
        user.save()

        # Send SMS
        sms_payload = {
            "enable_unicode": False,
            "messages": [
                {
                    "to": normalized,
                    "message": f"Your ChemistTasker verification code is {otp_code}",
                    "sender": settings.MOBILEMESSAGE_SENDER,
                }
            ]
        }

        resp = requests.post(
            "https://api.mobilemessage.com.au/v1/messages",
            json=sms_payload,
            auth=HTTPBasicAuth(settings.MOBILEMESSAGE_USERNAME, settings.MOBILEMESSAGE_PASSWORD),
            timeout=20,
        )

        if resp.status_code != 200:
            return Response(
                {"error": "Failed to send OTP", "details": resp.text},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"detail": "OTP sent successfully"}, status=status.HTTP_200_OK)


class VerifyMobileOTPView(APIView):
    """
    Step 2: User submits OTP to verify mobile.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        otp = request.data.get("otp")

        if not valid_otp_format(otp):
            return Response({"error": "Invalid OTP format"}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce 10-minute expiry
        if not user.mobile_otp_created_at or (timezone.now() - user.mobile_otp_created_at) > timedelta(minutes=10):
            return Response({"error": "OTP has expired, please request a new one."},
                            status=status.HTTP_400_BAD_REQUEST)

        if otp != user.mobile_otp_code:
            return Response({"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)

        # Success: mark verified, clear code & (optionally) timestamp
        user.is_mobile_verified = True
        user.mobile_otp_code = None
        user.mobile_otp_created_at = None
        user.save()

        return Response({"detail": "Mobile number verified successfully"}, status=status.HTTP_200_OK)


class ResendMobileOTPView(APIView):
    """
    Step 3: User requests a resend of mobile OTP.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        if not user.mobile_number:
            return Response(
                {"error": "No mobile number associated with this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 60-second cooldown
        if user.mobile_otp_created_at and timezone.now() - user.mobile_otp_created_at < timedelta(seconds=60):
            return Response(
                {"error": "Please wait 60 seconds before resending OTP."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Generate new OTP, invalidate old one
        otp_code = generate_otp()
        user.mobile_otp_code = otp_code
        user.mobile_otp_created_at = timezone.now()
        user.is_mobile_verified = False
        user.save()

        # Send SMS
        sms_payload = {
            "enable_unicode": False,
            "messages": [
                {
                    "to": user.mobile_number,
                    "message": f"Your ChemistTasker verification code is {otp_code}",
                    "sender": settings.MOBILEMESSAGE_SENDER,
                }
            ]
        }

        resp = requests.post(
            "https://api.mobilemessage.com.au/v1/messages",
            json=sms_payload,
            auth=HTTPBasicAuth(settings.MOBILEMESSAGE_USERNAME, settings.MOBILEMESSAGE_PASSWORD),
            timeout=20,
        )

        if resp.status_code != 200:
            return Response(
                {"error": "Failed to resend OTP", "details": resp.text},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"detail": "OTP resent successfully"}, status=status.HTTP_200_OK)


class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/users/       → list all users (with ?search= support)
    GET  /api/users/{id}/  → retrieve one user
    """
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['email', 'username']

class PasswordResetConfirmAPIView(APIView):
    """
    Accepts JSON: { uid, token, new_password1, new_password2 }
    """
    permission_classes = []  # allow any

    def post(self, request):
        uid    = request.data.get('uid')
        token  = request.data.get('token')
        pw1    = request.data.get('new_password1')
        pw2    = request.data.get('new_password2')

        if not all([uid, token, pw1, pw2]):
            return Response({'detail':'Missing fields.'}, status=400)
        if pw1 != pw2:
            return Response({'detail':'Passwords do not match.'}, status=400)

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (TypeError, ValueError, User.DoesNotExist):
            return Response({'detail':'Invalid link.'}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({'detail':'Invalid or expired token.'}, status=400)

        # all good—set the password
        user.set_password(pw1)
        user.is_otp_verified = True
        user.save()
        return Response({'detail':'Password has been reset.'})

class PasswordResetRequestAPIView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password/{uid}/{token}/"
            # send email
            send_async_email(
                subject="Reset your password",
                recipient_list=[user.email],
                template_name="emails/password_reset_email.html",
                context={'reset_url': reset_url, 'user': user},
                text_template="emails/password_reset_email.txt",
            )
        # Always succeed (do not reveal which emails are registered)
        return Response({'detail': 'If this email exists, a reset link has been sent.'})

class InviteOrgUserView(generics.CreateAPIView):
    """
    Only ORG_ADMIN may invite into this organization.
    """
    serializer_class   = InviteOrgUserSerializer

    # ← only users holding ORG_ADMIN on the target org get through
    required_roles     = ['ORG_ADMIN']
    permission_classes = [permissions.IsAuthenticated, OrganizationRolePermission]

    def perform_create(self, serializer):
        data = serializer.validated_data

        # 1) Find or create the User
        try:
            user = User.objects.get(email=data['email'])
            temp_password = None
        except User.DoesNotExist:
            temp_password = get_random_string(length=12)
            user = User.objects.create_user(
                email    = data['email'],
                password = temp_password,
                role     = 'OTHER_STAFF'
            )

        # 2) Find or create the membership; update if it already exists
        membership, created = OrganizationMembership.objects.get_or_create(
            user         = user,
            organization = data['organization'],
            defaults     = {
                'role':   data['role'],
                'region': data.get('region', '')
            }
        )
        if not created:
            membership.role   = data['role']
            membership.region = data.get('region', '')
            membership.save(update_fields=['role', 'region'])

        # 3) Build the front-end reset link
        uid   = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = settings.FRONTEND_BASE_URL
        front_end_link = f"{frontend_url}/reset-password/{uid}/{token}/"

        # 4) Prepare async email context and send
        context = {
            "org_name": data['organization'].name,
            "role": data['role'].title(),
            "magic_link": front_end_link,
            "inviter": self.request.user.get_full_name() or self.request.user.email or "A ChemistTasker admin",
        }
        recipient_list = [user.email]

        async_task(
            'users.tasks.send_async_email',
            subject=f"You've been invited to join {data['organization'].name} on ChemistTasker",
            recipient_list=recipient_list,
            template_name="emails/org_invite_new_user.html",
            context=context,
            text_template="emails/org_invite_new_user.txt",
        )

        # 5) Return success
        return Response({'detail': 'Invitation sent.'}, status=status.HTTP_201_CREATED)
