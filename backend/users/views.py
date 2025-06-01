from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions
from rest_framework import viewsets, permissions, filters
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.utils.crypto import get_random_string
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import OrganizationMembership
from .serializers import InviteOrgUserSerializer
from .permissions import OrganizationRolePermission  # our consolidated guard
from django.conf import settings

from rest_framework.views import APIView
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from users.tasks import send_async_email
from users.utils import get_frontend_onboarding_url
from datetime import timedelta
from django.utils import timezone
import random

from .serializers import (
    UserRegistrationSerializer,
    CustomTokenObtainPairSerializer,
    UserProfileSerializer,
    CustomTokenRefreshSerializer
)
User = get_user_model()

class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def perform_create(self, serializer):
        user = serializer.save()
        # onboarding_link = get_frontend_onboarding_url(user)
        # ctx = {
        #     "first_name": user.first_name,
        #     "email": user.email,
        #     "onboarding_link": onboarding_link,
        # }
        # send_async_email.defer(
        #     subject="🎉 Welcome to ChemistTasker! Let’s Get You Started 🌟",
        #     recipient_list=[user.email],
        #     template_name="emails/welcome_email.html",
        #     context=ctx,
        #     text_template="emails/welcome_email.txt"
        # )
        otp_subject = "Your ChemistTasker Verification Code"
        otp_context = {"otp": user.otp_code, "user": user}
        send_async_email(
            subject=otp_subject,
            recipient_list=[user.email],
            template_name="emails/otp_email.html",  # You need to create this template
            context=otp_context,
            text_template="emails/otp_email.txt"
       )

class VerifyOTPView(APIView):
    OTP_EXPIRY_MINUTES = 10

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")
        user = User.objects.filter(email=email).first()

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

        # --- Send welcome email ---
        onboarding_link = get_frontend_onboarding_url(user)
        ctx = {
            "first_name": user.first_name,
            "email": user.email,
            "onboarding_link": onboarding_link,
        }
        send_async_email.defer(
            subject="🎉 Welcome to ChemistTasker! Let’s Get You Started 🌟",
            recipient_list=[user.email],
            template_name="emails/welcome_email.html",
            context=ctx,
            text_template="emails/welcome_email.txt"
        )
        return Response({"detail": "OTP verified. Welcome email sent."}, status=200)

class ResendOTPView(APIView):
    def post(self, request):
        email = request.data.get("email")
        user = User.objects.filter(email=email).first()
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

        send_async_email.defer(
            subject=f"You've been invited to join {data['organization'].name} on ChemistTasker",
            recipient_list=recipient_list,
            template_name="emails/org_invite_new_user.html",
            context=context,
            text_template="emails/org_invite_new_user.txt",
        )

        # 5) Return success
        return Response({'detail': 'Invitation sent.'}, status=status.HTTP_201_CREATED)
