from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView  
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, filters, generics, status, mixins
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.utils.crypto import get_random_string
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from .models import OrganizationMembership
from client_profile.admin_helpers import admin_assignments_for
from .serializers import InviteOrgUserSerializer
from .permissions import OrganizationRolePermission
from .org_roles import (
    ADMIN_LEVEL_DEFINITIONS,
    ROLE_DEFINITIONS,
    # ROLE_DESCRIPTION_SUMMARY,
    OrgCapability,
    membership_capabilities,
)
from django.conf import settings
from django_q.tasks import async_task
from rest_framework.views import APIView
from users.tasks import send_async_email
from users.utils import get_frontend_onboarding_url, build_org_invite_context
from datetime import timedelta
from django.utils import timezone
import random
import logging
from .serializers import (
    UserRegistrationSerializer,
    CustomTokenObtainPairSerializer,
    UserProfileSerializer,
    CustomTokenRefreshSerializer,
    OrganizationMembershipDetailSerializer,
)
User = get_user_model()
import requests
from requests.auth import HTTPBasicAuth
from django.db.models import Q


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

    # Allow role-based access; capability checks enforce fine-grained control.
    required_roles     = ['ORG_ADMIN', 'CHIEF_ADMIN', 'REGION_ADMIN']
    permission_classes = [permissions.IsAuthenticated, OrganizationRolePermission]

    def perform_create(self, serializer):
        data = serializer.validated_data
        organization = data['organization']

        actor_membership = self.request.user.organization_memberships.filter(
            organization=organization
        ).first()
        if not actor_membership or OrgCapability.INVITE_STAFF not in membership_capabilities(actor_membership):
            raise PermissionDenied("You do not have permission to invite staff for this organization.")

        # 1) Find or create the User
        try:
            user = User.objects.get(email=data['email'])
            temp_password = None
        except User.DoesNotExist:
            temp_password = get_random_string(length=12)
            user = User.objects.create_user(
                email    = data['email'],
                password = temp_password,
                role     = 'ORG_STAFF'
            )

        if user.role != 'ORG_STAFF':
            user.role = 'ORG_STAFF'
            user.save(update_fields=['role'])

        # 2) Find or create the membership; update if it already exists
        invitee_membership, created = OrganizationMembership.objects.get_or_create(
            user         = user,
            organization = organization,
            defaults     = {
                'role':        data['role'],
                'region':      data.get('region', ''),
                'job_title':   data.get('job_title', ''),
                'admin_level': data['admin_level'],
            }
        )
        update_fields = {'role', 'region', 'job_title', 'admin_level'}
        invitee_membership.role = data['role']
        invitee_membership.region = data.get('region', '')
        invitee_membership.job_title = data.get('job_title', '')
        invitee_membership.admin_level = data['admin_level']
        invitee_membership.save(update_fields=sorted(update_fields))

        pharmacies = data.get('pharmacies') or []
        if pharmacies:
            invitee_membership.pharmacies.set(pharmacies)
        else:
            invitee_membership.pharmacies.clear()

        # 3) Build the front-end reset link
        uid   = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_url = settings.FRONTEND_BASE_URL
        front_end_link = f"{frontend_url}/reset-password/{uid}/{token}/"

        invitee_membership = OrganizationMembership.objects.select_related(
            "organization"
        ).prefetch_related("pharmacies").get(pk=invitee_membership.pk)

        # 4) Prepare async email context and send
        context = build_org_invite_context(
            membership=invitee_membership,
            inviter=self.request.user,
            magic_link=front_end_link,
            dashboard_link=f"{frontend_url}/dashboard/organization/overview",
            temp_password=temp_password,
        )
        recipient_list = [user.email]

        async_task(
            'users.tasks.send_async_email',
            subject=f"You've been invited to join {organization.name} on ChemistTasker",
            recipient_list=recipient_list,
            template_name="emails/org_invite_new_user.html",
            context=context,
            text_template="emails/org_invite_new_user.txt",
        )

        # 5) Return success
        return Response({'detail': 'Invitation sent.'}, status=status.HTTP_201_CREATED)


class OrganizationMembershipViewSet(mixins.ListModelMixin,
                                    mixins.RetrieveModelMixin,
                                    mixins.UpdateModelMixin,
                                    mixins.DestroyModelMixin,
                                    viewsets.GenericViewSet):
    serializer_class = OrganizationMembershipDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _user_org_admin_ids(self, user):
        org_ids = set()
        memberships = user.organization_memberships.select_related('organization').prefetch_related('pharmacies')
        for membership in memberships:
            caps = membership_capabilities(membership)
            if OrgCapability.MANAGE_ADMINS in caps or OrgCapability.MANAGE_STAFF in caps:
                org_ids.add(membership.organization_id)
        return org_ids

    def get_queryset(self):
        user = self.request.user
        org_ids = self._user_org_admin_ids(user)
        if not org_ids:
            return OrganizationMembership.objects.none()
        queryset = OrganizationMembership.objects.filter(
            organization_id__in=org_ids
        ).select_related('user', 'organization').prefetch_related('pharmacies')

        organization_param = self.request.query_params.get('organization')
        if organization_param:
            try:
                organization_id = int(organization_param)
            except (TypeError, ValueError):
                raise PermissionDenied("Invalid organization id.")
            if organization_id not in org_ids:
                raise PermissionDenied("Not allowed to manage this organization.")
            queryset = queryset.filter(organization_id=organization_id)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            if search:
                queryset = queryset.filter(
                    Q(user__first_name__icontains=search) |
                    Q(user__last_name__icontains=search) |
                    Q(user__email__icontains=search) |
                    Q(job_title__icontains=search)
                )
        return queryset

    def get_object(self):
        obj = super().get_object()
        if obj.organization_id not in self._user_org_admin_ids(self.request.user):
            raise PermissionDenied("Not allowed to access this membership.")
        return obj

    def perform_destroy(self, instance):
        request_user = self.request.user
        if instance.user_id == request_user.id:
            raise PermissionDenied("You cannot remove your own organization membership.")
        if instance.role == 'ORG_ADMIN':
            remaining = OrganizationMembership.objects.filter(
                organization=instance.organization,
                role='ORG_ADMIN'
            ).exclude(pk=instance.pk).count()
            if remaining == 0:
                raise PermissionDenied("Each organization must retain at least one Org Admin.")
        instance.delete()

    def perform_update(self, serializer):
        instance = serializer.instance
        new_role = serializer.validated_data.get('role', instance.role)
        if instance.role == 'ORG_ADMIN' and new_role != 'ORG_ADMIN':
            remaining = OrganizationMembership.objects.filter(
                organization=instance.organization,
                role='ORG_ADMIN'
            ).exclude(pk=instance.pk).count()
            if remaining == 0:
                raise PermissionDenied("Each organization must retain at least one Org Admin.")
        serializer.save()


class OrganizationRoleDefinitionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role_payload = []
        for definition in ROLE_DEFINITIONS.values():
            role_payload.append(
                {
                    'key': definition.key,
                    'label': definition.label,
                    'description': definition.description,
                    'default_admin_level': definition.default_admin_level,
                    'allowed_admin_levels': list(definition.allowed_admin_levels),
                    'requires_job_title': definition.requires_job_title,
                    'requires_region': definition.requires_region,
                    'requires_pharmacies': definition.requires_pharmacies,
                    'capabilities': sorted(definition.consolidated_capabilities()),
                }
            )

        admin_payload = []
        for definition in ADMIN_LEVEL_DEFINITIONS.values():
            admin_payload.append(
                {
                    'key': definition.key,
                    'label': definition.label,
                    'description': definition.description,
                    'capabilities': list(definition.pharmacy_capabilities),
                }
            )

        return Response(
            {
                'roles': role_payload,
                'admin_levels': admin_payload,
                # 'documentation': ROLE_DESCRIPTION_SUMMARY.strip(),
            }
        )
