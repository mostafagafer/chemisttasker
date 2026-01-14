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
from client_profile.admin_helpers import admin_assignments_for
from .org_roles import (
    ADMIN_LEVEL_DEFINITIONS,
    ROLE_DEFINITIONS,
    get_admin_level_definition,
    get_role_definition,
    role_capabilities,
    role_requires_field,
)
User = get_user_model()


def serialize_org_memberships(queryset):
    queryset = queryset.select_related('organization').prefetch_related('pharmacies')
    payload = []
    for membership in queryset:
        role_def = get_role_definition(membership.role)
        admin_def = get_admin_level_definition(membership.admin_level)
        pharmacies = getattr(membership, "pharmacies", None)
        pharmacy_data = []
        if pharmacies is not None:
            for pharmacy in sorted(pharmacies.all(), key=lambda p: (p.name or "").lower()):
                pharmacy_data.append(
                    {
                        'id': pharmacy.id,
                        'name': pharmacy.name,
                    }
                )
        payload.append(
            {
                'organization_id': membership.organization_id,
                'organization_name': membership.organization.name,
                'role': membership.role,
                'role_label': getattr(role_def, 'label', membership.role.replace('_', ' ').title()),
                'admin_level': membership.admin_level,
                'admin_level_label': getattr(admin_def, 'label', membership.admin_level.replace('_', ' ').title()),
                'job_title': membership.job_title,
                'region': membership.region,
                'pharmacies': pharmacy_data,
                'capabilities': sorted(role_capabilities(membership.role, membership.admin_level)),
            }
        )
    return payload


ADMIN_LEVEL_CHOICES = tuple(
    (definition.key, definition.label) for definition in ADMIN_LEVEL_DEFINITIONS.values()
)

class UserRegistrationSerializer(serializers.ModelSerializer):
    email_duplicate_message = (
        "There is already an account registered with this email. "
        "Please log in or reset your password."
    )
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all(), message=email_duplicate_message)]
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
            raise serializers.ValidationError(self.email_duplicate_message)
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
    user_email = serializers.EmailField(source='user.email', read_only=True)
    pharmacies = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationMembership
        fields = [
            'id',
            'user',
            'user_email',
            'role',
            'admin_level',
            'job_title',
            'region',
            'pharmacies',
        ]
        extra_kwargs = {'user': {'write_only': True}}

    def get_pharmacies(self, obj):
        qs = obj.pharmacies.all().order_by('name')
        return [{'id': pharmacy.id, 'name': pharmacy.name} for pharmacy in qs]


class OrganizationMembershipDetailSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    admin_level_label = serializers.SerializerMethodField()
    pharmacies = serializers.SerializerMethodField()
    pharmacy_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationMembership
        fields = [
            'id',
            'organization',
            'role',
            'role_label',
            'admin_level',
            'admin_level_label',
            'job_title',
            'region',
            'user',
            'pharmacies',
            'pharmacy_ids',
            'capabilities',
        ]
        read_only_fields = ['id', 'organization', 'user', 'pharmacies', 'capabilities']

    def get_user(self, obj):
        user = obj.user
        if not user:
            return None
        return {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'name': user.get_full_name() or user.email,
        }

    def get_role_label(self, obj):
        definition = get_role_definition(obj.role)
        return definition.label if definition else obj.role.replace('_', ' ').title()

    def get_admin_level_label(self, obj):
        definition = get_admin_level_definition(obj.admin_level)
        return definition.label if definition else obj.admin_level.replace('_', ' ').title()

    def get_pharmacies(self, obj):
        return [
            {'id': pharmacy.id, 'name': pharmacy.name}
            for pharmacy in obj.pharmacies.all().order_by('name')
        ]

    def get_capabilities(self, obj):
        return sorted(role_capabilities(obj.role, obj.admin_level))

    def validate(self, attrs):
        instance = self.instance
        role = attrs.get('role', instance.role if instance else None)
        admin_level = attrs.get('admin_level', instance.admin_level if instance else None)
        job_title = attrs.get('job_title', instance.job_title if instance else '')
        region = attrs.get('region', instance.region if instance else '')
        pharmacy_ids = attrs.get('pharmacy_ids', None)

        definition = get_role_definition(role)
        if not definition:
            raise serializers.ValidationError({'role': 'Invalid organization role.'})

        if admin_level not in definition.allowed_admin_levels:
            raise serializers.ValidationError({
                'admin_level': f"{admin_level} is not allowed for {definition.label}."
            })

        if role_requires_field(role, 'job_title') and not job_title:
            raise serializers.ValidationError({'job_title': 'Job title is required for this role.'})
        if role_requires_field(role, 'region') and not (region or '').strip():
            raise serializers.ValidationError({'region': 'Region is required for this role.'})

        self._validated_pharmacy_ids = None
        if pharmacy_ids is not None:
            if role_requires_field(role, 'pharmacy_ids') and not pharmacy_ids:
                raise serializers.ValidationError({'pharmacy_ids': 'Select at least one pharmacy.'})
            org_id = instance.organization_id if instance else None
            if not org_id:
                raise serializers.ValidationError({'organization': 'Organization is required.'})
            unique_ids = list(dict.fromkeys(pharmacy_ids))
            qs = Pharmacy.objects.filter(id__in=unique_ids, organization_id=org_id)
            if qs.count() != len(unique_ids):
                raise serializers.ValidationError({'pharmacy_ids': 'All pharmacies must belong to this organization.'})
            self._validated_pharmacy_ids = unique_ids

        return attrs

    def update(self, instance, validated_data):
        validated_data.pop('pharmacy_ids', None)
        for field in ['role', 'admin_level', 'job_title', 'region']:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save(update_fields=['role', 'admin_level', 'job_title', 'region'])
        pharmacy_ids = getattr(self, '_validated_pharmacy_ids', None)
        if pharmacy_ids is not None:
            instance.pharmacies.set(pharmacy_ids)
        return instance
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
        org_payload = serialize_org_memberships(org_memberships)

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

        owned_pharmacies = Pharmacy.objects.filter(owner__user=self.user)
        owned_payload = [
            {
                'pharmacy_id':   pharmacy.id,
                'pharmacy_name': pharmacy.name,
                'role':          'OWNER',
            }
            for pharmacy in owned_pharmacies
        ]

        pharmacy_map = {entry['pharmacy_id']: entry for entry in pharm_payload}
        for entry in owned_payload:
            pharmacy_map[entry['pharmacy_id']] = entry

        combined_pharm_payload = list(pharmacy_map.values())

        admin_assignments = admin_assignments_for(self.user).select_related("pharmacy")
        admin_payload = [
            {
                'id': assignment.id,
                'pharmacy_id': assignment.pharmacy_id,
                'pharmacy_name': assignment.pharmacy.name if assignment.pharmacy else None,
                'admin_level': assignment.admin_level,
                'capabilities': sorted(list(assignment.capabilities)),
                'staff_role': assignment.staff_role,
                'job_title': assignment.job_title,
                'is_active': assignment.is_active,
            }
            for assignment in admin_assignments
        ]

        # 3) Combined user payload (+ is_mobile_verified added)
        data['user'] = {
            'id':       self.user.id,
            'username': self.user.username,
            'email':    self.user.email,
            'role':     self.user.role,
            'memberships': org_payload + combined_pharm_payload,
            'admin_assignments': admin_payload,
            'is_pharmacy_admin': bool(admin_payload),
            'is_mobile_verified': bool(getattr(self.user, 'is_mobile_verified', False)),
        }
        return data

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs['refresh'])
        user    = User.objects.get(id=refresh['user_id'])

        org_memberships = OrganizationMembership.objects.filter(user=user)
        org_payload = serialize_org_memberships(org_memberships)

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

        owned_pharmacies = Pharmacy.objects.filter(owner__user=user)
        owned_payload = [
            {
                'pharmacy_id':   pharmacy.id,
                'pharmacy_name': pharmacy.name,
                'role':          'OWNER',
            }
            for pharmacy in owned_pharmacies
        ]

        pharmacy_map = {entry['pharmacy_id']: entry for entry in pharm_payload}
        for entry in owned_payload:
            pharmacy_map[entry['pharmacy_id']] = entry

        combined_pharm_payload = list(pharmacy_map.values())

        admin_assignments = admin_assignments_for(user).select_related("pharmacy")
        admin_payload = [
            {
                'id': assignment.id,
                'pharmacy_id': assignment.pharmacy_id,
                'pharmacy_name': assignment.pharmacy.name if assignment.pharmacy else None,
                'admin_level': assignment.admin_level,
                'capabilities': sorted(list(assignment.capabilities)),
                'staff_role': assignment.staff_role,
                'job_title': assignment.job_title,
                'is_active': assignment.is_active,
            }
            for assignment in admin_assignments
        ]

        data['user'] = {
            'id':       user.id,
            'username': user.username,
            'email':    user.email,
            'role':     user.role,
            'memberships': org_payload + combined_pharm_payload,
            'admin_assignments': admin_payload,
            'is_pharmacy_admin': bool(admin_payload),
            'is_mobile_verified': bool(getattr(user, 'is_mobile_verified', False)),
        }

        return data

class InviteOrgUserSerializer(serializers.Serializer):
    email        = serializers.EmailField()
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    role         = serializers.ChoiceField(choices=OrganizationMembership.ROLE_CHOICES)
    admin_level  = serializers.ChoiceField(choices=ADMIN_LEVEL_CHOICES, required=False)
    job_title    = serializers.CharField(required=False, allow_blank=True)
    region       = serializers.CharField(required=False, allow_blank=True)
    pharmacies   = serializers.PrimaryKeyRelatedField(
        queryset=Pharmacy.objects.all(),
        many=True,
        required=False,
    )

    def validate(self, attrs):
        role = attrs.get('role')
        definition = get_role_definition(role)
        if not definition:
            raise serializers.ValidationError({'role': 'Invalid organization role.'})

        admin_level = attrs.get('admin_level') or definition.default_admin_level
        if admin_level not in definition.allowed_admin_levels:
            raise serializers.ValidationError({
                'admin_level': f"{admin_level} is not allowed for {definition.label}."
            })
        attrs['admin_level'] = admin_level

        if role_requires_field(role, 'job_title') and not attrs.get('job_title'):
            raise serializers.ValidationError({'job_title': 'Job title is required for this role.'})

        if role_requires_field(role, 'region') and not (attrs.get('region') or '').strip():
            raise serializers.ValidationError({'region': 'Region is required for this role.'})

        supplied_pharmacies = list(attrs.get('pharmacies') or [])
        if role_requires_field(role, 'pharmacy_ids') and not supplied_pharmacies:
            raise serializers.ValidationError({'pharmacies': 'Select at least one pharmacy.'})

        organization = attrs['organization']
        invalid = [
            pharmacy for pharmacy in supplied_pharmacies
            if pharmacy.organization_id != organization.id
        ]
        if invalid:
            raise serializers.ValidationError({
                'pharmacies': 'All selected pharmacies must belong to this organization.'
            })

        attrs['pharmacies'] = supplied_pharmacies
        return attrs
