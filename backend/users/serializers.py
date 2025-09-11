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
from client_profile.models import Pharmacy, Membership as PharmacyMembership

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    accepted_terms = serializers.BooleanField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'confirm_password', 'role', 'accepted_terms']

    def validate(self, attrs):
        if attrs.get('password') != attrs.pop('confirm_password'):
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })
        return attrs
    
    def validate_accepted_terms(self, value):
        if not value:
            raise serializers.ValidationError("You must accept the Terms of Service to register.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered. Did you forget your password?")
        return value

    def create(self, validated_data):
        validated_data['email'] = validated_data['email'].strip().lower()
        accepted_terms = validated_data.pop('accepted_terms')
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data['role']
        )
        user.accepted_terms = accepted_terms
        if accepted_terms:
            user.accepted_terms_at = timezone.now()
        user.save()

        # ---- OTP verification ----
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

        # 1) Organization memberships
        org_memberships = OrganizationMembership.objects.filter(user=self.user)
        org_payload = [
            {
                'organization_id':   m.organization_id,
                'organization_name': m.organization.name,
                'role':              m.role,
                'region':            m.region,
            }
            for m in org_memberships
        ]

        # 2) Pharmacy memberships
        pharm_memberships = PharmacyMembership.objects.filter(
            user=self.user,
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

        # 3) Combined user payload (+ is_mobile_verified added)
        data['user'] = {
            'id':       self.user.id,
            'username': self.user.username,
            'email':    self.user.email,
            'role':     self.user.role,
            'memberships': org_payload + pharm_payload,
            'is_pharmacy_admin': any(pm.role == 'PHARMACY_ADMIN' for pm in pharm_memberships),
            'is_mobile_verified': bool(getattr(self.user, 'is_mobile_verified', False)),  # <— added
        }
        return data

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs['refresh'])
        user    = User.objects.get(id=refresh['user_id'])

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

        data['user'] = {
            'id':       user.id,
            'username': user.username,
            'email':    user.email,
            'role':     user.role,
            'memberships': org_payload + pharm_payload,
            'is_pharmacy_admin': any(pm.role == 'PHARMACY_ADMIN' for pm in pharm_memberships),
            'is_mobile_verified': bool(getattr(user, 'is_mobile_verified', False)),  # <— added
        }

        return data

class InviteOrgUserSerializer(serializers.Serializer):
    email        = serializers.EmailField()
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    role         = serializers.ChoiceField(choices=OrganizationMembership.ROLE_CHOICES)
    region       = serializers.CharField(required=False, allow_blank=True)
