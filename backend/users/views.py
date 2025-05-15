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

from rest_framework.views import APIView
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

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
        front_end_link = f"http://localhost:5173/reset-password/{uid}/{token}/"

        # 4) Send the email via console backend
        send_mail(
            "Set your password",
            f"Click to set your password:\n\n{front_end_link}",
            "no-reply@localhost",
            [user.email],
            fail_silently=False,
        )

        # 5) Return success
        return Response({'detail': 'Invitation sent.'}, status=status.HTTP_201_CREATED)
