# users/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens      import RefreshToken
from client_profile.models import Organization
from .models import OrganizationMembership
import random
from django.utils import timezone

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # note: username removed here; you'll collect it later in onboarding
        fields = ['email', 'password', 'confirm_password', 'role']

    def validate(self, attrs):
        if attrs.get('password') != attrs.pop('confirm_password'):
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })
        return attrs

    def create(self, validated_data):
        # validated_data now has: email, password, role
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data['role']
        )

        # ---- ONLY THIS BLOCK IS NEW ----
        otp = str(random.randint(100000, 999999))
        user.otp_code = otp
        user.otp_created_at = timezone.now()
        user.is_otp_verified = False
        user.save()
        # ---- END NEW BLOCK ----

        return user


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    user_email   = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ['id', 'user', 'user_email', 'role', 'region']
        extra_kwargs = {'user': {'write_only': True}}

class UserProfileSerializer(serializers.ModelSerializer):
    memberships = OrganizationMembershipSerializer(
        source='organization_memberships',
        many=True,
        read_only=True
    )
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'memberships']
        read_only_fields = fields


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        if not user.is_otp_verified:
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed("Please verify your email address (check your inbox for your OTP code).")

        # pull in all org memberships for this user
        memberships = OrganizationMembership.objects.filter(user=self.user)
        data['user'] = {
            'id':       self.user.id,
            'username': self.user.username,
            'email':    self.user.email,
            'role':     self.user.role,
            'memberships': [
                {
                    'organization_id':   m.organization_id,
                    'organization_name': m.organization.name,
                    'role':              m.role,
                    'region':            m.region,
                }
                for m in memberships
            ]
        }
        return data

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # exactly the same payload shape you build in your login-serializer:
        refresh = RefreshToken(attrs['refresh'])
        user    = User.objects.get(id=refresh['user_id'])
        memberships = OrganizationMembership.objects.filter(user=user)
        data['user'] = {
            'id':       user.id,
            'username': user.username,
            'email':    user.email,
            'role':     user.role,
            'memberships': [
                {
                    'organization_id':   m.organization_id,
                    'organization_name': m.organization.name,
                    'role':              m.role,
                    'region':            m.region,
                }
                for m in memberships
            ]
        }
        return data


class InviteOrgUserSerializer(serializers.Serializer):
    email        = serializers.EmailField()
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    role         = serializers.ChoiceField(choices=OrganizationMembership.ROLE_CHOICES)
    region       = serializers.CharField(required=False, allow_blank=True)
