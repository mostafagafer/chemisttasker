# client_profile/serializers.py

# This is smsm update
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field, OpenApiTypes
from .models import *
from users.models import OrganizationMembership
from users.serializers import UserProfileSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
from client_profile.utils import q6, send_referee_emails, clean_email, enforce_public_shift_daily_limit
from client_profile.admin_helpers import has_admin_capability, CAPABILITY_MANAGE_ROSTER
from datetime import date, timedelta
from django.utils import timezone
from django_q.tasks import async_task
import logging
logger = logging.getLogger(__name__)
User = get_user_model()
from django_q.models import Schedule
from client_profile.tasks import schedule_referee_reminder
import os
import json
from django.utils.text import slugify
from django.core.files.storage import default_storage


# === Onboardings ===
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name']
        read_only_fields = ['id']




def verification_fields_changed(instance, validated_data, fields):
    for field in fields:
        old = getattr(instance, field, None)
        if field in validated_data:
            new = validated_data[field]
        else:
            continue
        if hasattr(old, "name") or hasattr(new, "name"):
            old_name = getattr(old, "name", None)
            new_name = getattr(new, "name", None)
            if (old_name or "").strip() != (new_name or "").strip():
                return True
        else:
            # Important: Convert both to string to handle bools, numbers, etc.
            if str(old or "").strip() != str(new or "").strip():
                return True
    return False

class RemoveOldFilesMixin:
    file_fields: list[str] = []
    def update(self, instance, validated_data):
        for field_name in self.file_fields:
            if field_name in validated_data:
                new_file, old_file = validated_data[field_name], getattr(instance, field_name)
                if old_file and old_file.name and (new_file is None or old_file.name != new_file.name):
                    old_file.delete(save=False)
            elif field_name in validated_data and validated_data[field_name] is None:
                old_file = getattr(instance, field_name)
                if old_file:
                    old_file.delete(save=False)
        return super().update(instance, validated_data)


def user_can_view_full_pharmacy(user, pharmacy) -> bool:
    """
    Mirrors BaseShiftViewSet._user_can_manage_pharmacy so serializers can reuse it.
    """
    if not user or not getattr(user, "is_authenticated", False) or pharmacy is None:
        return False

    owner = getattr(pharmacy, "owner", None)
    if owner and getattr(owner, "user", None) == user:
        return True

    if OrganizationMembership.objects.filter(
        user=user,
        role='ORG_ADMIN',
        organization_id=pharmacy.organization_id,
    ).exists():
        return True

    if OrganizationMembership.objects.filter(
        user=user,
        role__in=['CHIEF_ADMIN', 'REGION_ADMIN'],
        pharmacies=pharmacy,
    ).exists():
        return True

    if has_admin_capability(user, pharmacy, CAPABILITY_MANAGE_ROSTER):
        return True

    return False


def anonymize_pharmacy_detail(detail: dict | None) -> dict | None:
    """
    Strip sensitive pharmacy fields. Keep only the suburb-level context.
    """
    if not isinstance(detail, dict):
        return detail

    suburb = detail.get('suburb')
    state = detail.get('state')
    postcode = detail.get('postcode')

    masked = {
        'id': detail.get('id'),
        'name': 'Anonymous Pharmacy',
        'suburb': suburb,
    }
    if state is not None:
        masked['state'] = state
    if postcode is not None:
        masked['postcode'] = postcode

    return masked


class SyncUserMixin:
    USER_FIELDS = ['username', 'first_name', 'last_name']
    @staticmethod
    def sync_user_fields(user_data_from_pop, user_instance):
        updated_fields = []
        for attr in SyncUserMixin.USER_FIELDS:
            if attr in user_data_from_pop and getattr(user_instance, attr) != user_data_from_pop[attr]:
                setattr(user_instance, attr, user_data_from_pop[attr])
                updated_fields.append(attr)
        if updated_fields:
            user_instance.save(update_fields=updated_fields)


# === OnboardingVerificationMixin ===
class OnboardingVerificationMixin:
    """
    Triggers individual verification tasks and one initial evaluation task.
    """
    def _trigger_verification_tasks(self, instance, is_create=False):
        # Reset automated verification fields
        verification_fields_to_reset = [f for f in instance._meta.fields if f.name.endswith('_verified')]
        for field in verification_fields_to_reset:
            setattr(instance, field.name, False)
        
        note_fields_to_reset = [f for f in instance._meta.fields if f.name.endswith('_verification_note')]
        for field in note_fields_to_reset:
            setattr(instance, field.name, "")
            
        instance.verified = False
        
        update_fields = [f.name for f in verification_fields_to_reset] + [f.name for f in note_fields_to_reset] + ['verified']

        # FIX: ADD THIS BLOCK TO RESET REFEREE STATUSES
        # This ensures that when a referee is changed, the old rejection/confirmation is cleared.
        referee_fields_to_reset = [
            'referee1_confirmed', 'referee1_rejected',
            'referee2_confirmed', 'referee2_rejected'
        ]
        for field_name in referee_fields_to_reset:
            if hasattr(instance, field_name):
                setattr(instance, field_name, False)
                update_fields.append(field_name)

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        def schedule_orchestrator():
            Schedule.objects.create(
                func='client_profile.tasks.run_all_verifications',
                args=f"'{instance._meta.model_name}',{instance.pk}",
                kwargs={'is_create': is_create},
                schedule_type=Schedule.ONCE,
                next_run=timezone.now() + timedelta(minutes=1),
            )
        transaction.on_commit(schedule_orchestrator)


class OwnerOnboardingSerializer(SyncUserMixin, serializers.ModelSerializer):
    file_fields = []

    username   = serializers.CharField(source='user.username',   required=False)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model  = OwnerOnboarding
        fields = [
            'username', 'first_name', 'last_name',
            'phone_number', 'role', 'chain_pharmacy',
            'ahpra_number', 'verified',
            'organization', 'progress_percent',
            'ahpra_verified',
            'ahpra_registration_status',
            'ahpra_registration_type',
            'ahpra_expiry_date',
            'ahpra_verification_note',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
            'organization': {'read_only': True},
        }
        read_only_fields = [
            'ahpra_verified',
            'ahpra_registration_status',
            'ahpra_registration_type',
            'ahpra_expiry_date',
            'ahpra_verification_note',
        ]

    def _schedule_verification(self, instance):
        Schedule.objects.create(
            func='client_profile.tasks.run_all_verifications',
            args=f"'{instance._meta.model_name}',{instance.pk}",
            schedule_type=Schedule.ONCE,
            next_run=timezone.now() + timedelta(seconds=10)
        )

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        self.sync_user_fields(user_data, user)
        instance = OwnerOnboarding.objects.create(user=user, **validated_data)
        self._schedule_verification(instance)
        return instance

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        self.sync_user_fields(user_data, instance.user)

        if verification_fields_changed(instance, validated_data, ["ahpra_number", "role"]):
            instance.ahpra_verified = False
            instance.ahpra_verification_note = ""
            instance.verified = False
            instance.save(update_fields=['ahpra_verified', 'ahpra_verification_note', 'verified'])
            self._schedule_verification(instance)

        return super().update(instance, validated_data)

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.phone_number,
            obj.role,
        ]
        # Only count AHPRA verification for pharmacists
        if obj.role == "PHARMACIST":
            required_fields.append(obj.ahpra_verified)
        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields)) if required_fields else 0
        return percent



class OtherStaffOnboardingSerializer(RemoveOldFilesMixin, SyncUserMixin, serializers.ModelSerializer):
    file_fields = [
        'government_id', 'ahpra_proof', 'hours_proof',
        'certificate', 'university_id', 'cpr_certificate', 's8_certificate',
        'gst_file', 'tfn_declaration', 'resume'
    ]
    username   = serializers.CharField(source='user.username',   required=False)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model  = OtherStaffOnboarding
        fields = [
            'username', 'first_name', 'last_name',
            'government_id', 'role_type', 'phone_number',
            'skills', 'years_experience', 'payment_preference',
            'classification_level', 'student_year', 'intern_half',
            'ahpra_proof', 'hours_proof', 'certificate', 'university_id',
            'cpr_certificate', 's8_certificate',
            'abn', 'gst_registered', 'gst_file', 'tfn_declaration',
            'super_fund_name', 'super_usi', 'super_member_number',
            'referee1_name', 'referee1_relation', 'referee1_email', 'referee1_confirmed',
            'referee2_name', 'referee2_relation', 'referee2_email', 'referee2_confirmed',
            'short_bio', 'resume',
            'verified', 'progress_percent',
            'submitted_for_verification',
            # verification fields (including new note fields):
            'gov_id_verified', 'gov_id_verification_note',
            'ahpra_proof_verified', 'ahpra_proof_verification_note',
            'hours_proof_verified', 'hours_proof_verification_note',
            'certificate_verified', 'certificate_verification_note',
            'university_id_verified', 'university_id_verification_note',
            'cpr_certificate_verified', 'cpr_certificate_verification_note',
            's8_certificate_verified', 's8_certificate_verification_note',
            'gst_file_verified', 'gst_file_verification_note',
            'tfn_declaration_verified', 'tfn_declaration_verification_note',
            'abn_verified', 'abn_verification_note',
            # ahpra_verified and related fields removed from model, so removed from fields too
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
            'submitted_for_verification': {'required': False},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name':  {'required': False, 'allow_blank': True},
            'government_id': {'required': False, 'allow_null': True},
            'role_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'skills': {'required': False, 'allow_null': True},
            'years_experience': {'required': False, 'allow_blank': True, 'allow_null': True},
            'payment_preference': {'required': False, 'allow_blank': True, 'allow_null': True},
            'classification_level': {'required': False, 'allow_blank': True, 'allow_null': True},
            'student_year': {'required': False, 'allow_blank': True, 'allow_null': True},
            'intern_half': {'required': False, 'allow_blank': True, 'allow_null': True},
            'ahpra_proof': {'required': False, 'allow_null': True},
            'hours_proof': {'required': False, 'allow_null': True},
            'certificate': {'required': False, 'allow_null': True},
            'university_id': {'required': False, 'allow_null': True},
            'cpr_certificate': {'required': False, 'allow_null': True},
            's8_certificate': {'required': False, 'allow_null': True},
            'abn': {'required': False, 'allow_blank': True, 'allow_null': True},
            'gst_file': {'required': False, 'allow_null': True},
            'tfn_declaration': {'required': False, 'allow_null': True},
            'super_fund_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'super_usi': {'required': False, 'allow_blank': True, 'allow_null': True},
            'super_member_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_confirmed': {'required': False},
            'referee2_name': {'required': False, 'allow_blank': True},
            'referee2_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_confirmed': {'required': False},
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume': {'required': False, 'allow_null': True},
        }

        read_only_fields = [
            'gov_id_verified', 'gov_id_verification_note',
            'ahpra_proof_verified', 'ahpra_proof_verification_note',
            'hours_proof_verified', 'hours_proof_verification_note',
            'certificate_verified', 'certificate_verification_note',
            'university_id_verified', 'university_id_verification_note',
            'cpr_certificate_verified', 'cpr_certificate_verification_note',
            's8_certificate_verified', 's8_certificate_verification_note',
            'gst_file_verified', 'gst_file_verification_note',
            'tfn_declaration_verified', 'tfn_declaration_verification_note',
            'abn_verified', 'abn_verification_note',
            'verified',
            'progress_percent',
        ]

    def _schedule_verification(self, instance):
        Schedule.objects.filter(func='client_profile.tasks.run_all_verifications', args=f"'{instance._meta.model_name}',{instance.pk}").delete()
        Schedule.objects.create(
            func='client_profile.tasks.run_all_verifications',
            args=f"'{instance._meta.model_name}',{instance.pk}",
            schedule_type=Schedule.ONCE,
            next_run=timezone.now() + timedelta(seconds=10)
        )

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        self.sync_user_fields(user_data, user)
        instance = OtherStaffOnboarding.objects.create(user=user, **validated_data)
        if validated_data.get('submitted_for_verification', False):
            self._schedule_verification(instance)
        return instance

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        self.sync_user_fields(user_data, instance.user)

        submitted_before = instance.submitted_for_verification
        fields_to_reset = []
        
        verifiable_fields = {
            "gov_id": ["government_id"], "payment": ["payment_preference", "abn", "gst_registered", "gst_file", "tfn_declaration"],
            "role_docs": ["role_type", "ahpra_proof", "hours_proof", "certificate", "university_id", "cpr_certificate", "s8_certificate"],
            "referee1": ["referee1_name", "referee1_relation", "referee1_email"], "referee2": ["referee2_name", "referee2_relation", "referee2_email"],
        }
        
        for key, fields in verifiable_fields.items():
            if verification_fields_changed(instance, validated_data, fields):
                if key == "gov_id": fields_to_reset.extend(['gov_id_verified', 'gov_id_verification_note'])
                if key == "payment": fields_to_reset.extend(['abn_verified', 'abn_verification_note', 'gst_file_verified', 'gst_file_verification_note', 'tfn_declaration_verified', 'tfn_declaration_verification_note'])
                if key == "role_docs": fields_to_reset.extend(['ahpra_proof_verified', 'ahpra_proof_verification_note', 'hours_proof_verified', 'hours_proof_verification_note', 'certificate_verified', 'certificate_verification_note', 'university_id_verified', 'university_id_verification_note', 'cpr_certificate_verified', 'cpr_certificate_verification_note', 's8_certificate_verified', 's8_certificate_verification_note'])
                if key == "referee1": fields_to_reset.extend(['referee1_confirmed', 'referee1_rejected'])
                if key == "referee2": fields_to_reset.extend(['referee2_confirmed', 'referee2_rejected'])
        
        instance = super().update(instance, validated_data)
        
        submitted_now = instance.submitted_for_verification
        needs_reschedule = bool(fields_to_reset)

        if not submitted_before and submitted_now:
            for f in instance._meta.fields:
                if f.name.endswith(('_verified', '_confirmed', '_rejected')):
                    setattr(instance, f.name, False)
                    fields_to_reset.append(f.name)
                elif f.name.endswith('_verification_note'):
                    setattr(instance, f.name, "")
                    fields_to_reset.append(f.name)
            instance.verified = False
            fields_to_reset.append('verified')
            needs_reschedule = True
        elif needs_reschedule:
            for field in fields_to_reset:
                setattr(instance, field, False if field.endswith(('_verified', '_confirmed', '_rejected')) else "")
            instance.verified = False
            fields_to_reset.append('verified')

        if needs_reschedule:
            instance.save(update_fields=list(set(fields_to_reset)))
            self._schedule_verification(instance)
            
        return instance

    def validate(self, data):
        submit = data.get('submitted_for_verification') \
            or (self.instance and getattr(self.instance, 'submitted_for_verification', False))
        errors = {}

        must_have = [
            'username', 'first_name', 'last_name',
            'government_id', 'role_type', 'phone_number', 'payment_preference',
            'referee1_name', 'referee1_relation', 'referee1_email',
            'referee2_name', 'referee2_relation', 'referee2_email',
        ]

        user_data = data.get('user', {})

        if submit:
            for f in must_have:
                if f in ['username', 'first_name', 'last_name']:
                    val = (
                        user_data.get(f)
                        or (self.instance and hasattr(self.instance, 'user') and getattr(self.instance.user, f, None))
                    )
                    if not val:
                        errors[f] = 'This field is required to submit for verification.'
                else:
                    value = data.get(f)
                    if value is None and self.instance:
                        value = getattr(self.instance, f, None)
                    if not value:
                        errors[f] = 'This field is required to submit for verification.'

            pay = data.get('payment_preference') or (self.instance and getattr(self.instance, 'payment_preference', None))
            if pay:
                if pay.lower() == "abn":
                    abn = data.get('abn') or (self.instance and getattr(self.instance, 'abn', None))
                    if not abn:
                        errors['abn'] = 'ABN required when payment preference is ABN.'
                    gst = data.get('gst_registered')
                    if gst is None and self.instance:
                        gst = getattr(self.instance, 'gst_registered', None)
                    if gst:
                        gst_file = data.get('gst_file') or (self.instance and getattr(self.instance, 'gst_file', None))
                        if not gst_file:
                            errors['gst_file'] = 'GST certificate required if GST registered.'
                elif pay.lower() == "tfn":
                    for f in ['tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number']:
                        val = data.get(f)
                        if val is None and self.instance:
                            val = getattr(self.instance, f, None)
                        if not val:
                            errors[f] = f'{f.replace("_", " ").title()} required when payment preference is TFN.'

            role = data.get('role_type') or (self.instance and getattr(self.instance, 'role_type', None))
            if role == 'STUDENT':
                if not (data.get('student_year') or (self.instance and getattr(self.instance, 'student_year', None))):
                    errors['student_year'] = 'Required for Pharmacy Students.'
                if not (data.get('university_id') or (self.instance and getattr(self.instance, 'university_id', None))):
                    errors['university_id'] = 'Required for Pharmacy Students.'
            if role == 'ASSISTANT':
                if not (data.get('classification_level') or (self.instance and getattr(self.instance, 'classification_level', None))):
                    errors['classification_level'] = 'Required for Pharmacy Assistants.'
                if not (data.get('certificate') or (self.instance and getattr(self.instance, 'certificate', None))):
                    errors['certificate'] = 'Certificate required for Pharmacy Assistants.'
            if role == 'TECHNICIAN':
                if not (data.get('certificate') or (self.instance and getattr(self.instance, 'certificate', None))):
                    errors['certificate'] = 'Certificate required for Dispensary Technicians.'
            if role == 'INTERN':
                if not (data.get('intern_half') or (self.instance and getattr(self.instance, 'intern_half', None))):
                    errors['intern_half'] = 'Intern half required for Intern Pharmacists.'
                if not (data.get('ahpra_proof') or (self.instance and getattr(self.instance, 'ahpra_proof', None))):
                    errors['ahpra_proof'] = 'AHPRA proof required for Intern Pharmacists.'
                if not (data.get('hours_proof') or (self.instance and getattr(self.instance, 'hours_proof', None))):
                    errors['hours_proof'] = 'Hours proof required for Intern Pharmacists.'

        if errors:
            raise serializers.ValidationError(errors)
        return data

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.phone_number,
            obj.role_type,
            obj.payment_preference,
            obj.referee1_confirmed,
            obj.referee2_confirmed,
            obj.resume,
            obj.short_bio,
            obj.gov_id_verified,
        ]

        # Student
        if obj.role_type == "STUDENT":
            required_fields.append(obj.student_year)
            required_fields.append(obj.university_id_verified)   # << Use verified field
        # Assistant
        if obj.role_type == "ASSISTANT":
            required_fields.append(obj.classification_level)
            required_fields.append(obj.certificate_verified)     # << Use verified field
        # Technician
        if obj.role_type == "TECHNICIAN":
            required_fields.append(obj.certificate_verified)     # << Use verified field
        # Intern
        if obj.role_type == "INTERN":
            required_fields.append(obj.intern_half)
            required_fields.append(obj.ahpra_proof_verified)     # << Use verified field
            required_fields.append(obj.hours_proof_verified)     # << Use verified field

        # Common certificates if present
        # If your model logic means all should do these, always append
        required_fields.append(obj.cpr_certificate_verified)
        required_fields.append(obj.s8_certificate_verified)

        # ABN is only required if payment_preference is "abn"
        if obj.payment_preference and obj.payment_preference.lower() == "abn":
            required_fields.append(obj.abn_verified)            # << Use verified field
            if obj.gst_registered is True:
                required_fields.append(obj.gst_file_verified)   # << Use verified field

        # TFN is only required if payment_preference is "TFN"
        if obj.payment_preference and obj.payment_preference.lower() == "tfn":
            required_fields.append(obj.tfn_declaration_verified) # << Use verified field
            required_fields.append(obj.super_fund_name)
            required_fields.append(obj.super_usi)
            required_fields.append(obj.super_member_number)


        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields)) if required_fields else 0
        return percent


class ExplorerOnboardingSerializer(OnboardingVerificationMixin, RemoveOldFilesMixin, SyncUserMixin, serializers.ModelSerializer):
    file_fields = ['government_id', 'resume']

    username   = serializers.CharField(source='user.username',   required=False)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model  = ExplorerOnboarding
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'government_id', 'role_type', 
            'interests',
            'referee1_name', 'referee1_relation', 'referee1_email', 'referee1_confirmed',
            'referee2_name', 'referee2_relation', 'referee2_email', 'referee2_confirmed',
            'short_bio', 'resume',
            'verified', 'progress_percent', 'gov_id_verified', 'gov_id_verification_note',

            'submitted_for_verification',
        ]
        extra_kwargs = {
            'id': {'read_only': True},  # <-- optional but nice
            'verified': {'read_only': True},
            'submitted_for_verification': {'required': False},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name':  {'required': False, 'allow_blank': True},
            'government_id': {'required': False, 'allow_null': True},
            'role_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'interests': {'required': False, 'allow_null': True},
            'referee1_name': {'required': False, 'allow_blank': True},
            'referee1_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_confirmed': {'required': False},
            'referee2_name': {'required': False, 'allow_blank': True},
            'referee2_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_confirmed': {'required': False},
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume': {'required': False, 'allow_null': True},
        }

        read_only_fields = [
            'gov_id_verified', 'gov_id_verification_note',
            'verified',
            'progress_percent',
        ]

    def _schedule_verification(self, instance):
        Schedule.objects.filter(func='client_profile.tasks.run_all_verifications', args=f"'{instance._meta.model_name}',{instance.pk}").delete()
        Schedule.objects.create(
            func='client_profile.tasks.run_all_verifications',
            args=f"'{instance._meta.model_name}',{instance.pk}",
            schedule_type=Schedule.ONCE,
            next_run=timezone.now() + timedelta(seconds=10)
        )

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        self.sync_user_fields(user_data, user)
        instance = ExplorerOnboarding.objects.create(user=user, **validated_data)
        if validated_data.get('submitted_for_verification', False):
            self._schedule_verification(instance)
        return instance

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        self.sync_user_fields(user_data, instance.user)

        submitted_before = instance.submitted_for_verification
        fields_to_reset = []

        if verification_fields_changed(instance, validated_data, ["government_id"]):
            fields_to_reset.extend(['gov_id_verified', 'gov_id_verification_note'])
        if verification_fields_changed(instance, validated_data, ["referee1_name", "referee1_relation", "referee1_email"]):
            fields_to_reset.extend(['referee1_confirmed', 'referee1_rejected'])
        if verification_fields_changed(instance, validated_data, ["referee2_name", "referee2_relation", "referee2_email"]):
            fields_to_reset.extend(['referee2_confirmed', 'referee2_rejected'])

        instance = super().update(instance, validated_data)
        
        submitted_now = instance.submitted_for_verification
        needs_reschedule = bool(fields_to_reset)

        if not submitted_before and submitted_now:
            for f in instance._meta.fields:
                if f.name.endswith(('_verified', '_confirmed', '_rejected')):
                    setattr(instance, f.name, False)
                    fields_to_reset.append(f.name)
                elif f.name.endswith('_verification_note'):
                    setattr(instance, f.name, "")
                    fields_to_reset.append(f.name)
            instance.verified = False
            fields_to_reset.append('verified')
            needs_reschedule = True
        elif needs_reschedule:
            for field in fields_to_reset:
                setattr(instance, field, False if field.endswith(('_verified', '_confirmed', '_rejected')) else "")
            instance.verified = False
            fields_to_reset.append('verified')

        if needs_reschedule:
            instance.save(update_fields=list(set(fields_to_reset)))
            self._schedule_verification(instance)
            
        return instance

    def validate(self, data):
        submit = data.get('submitted_for_verification') \
            or (self.instance and getattr(self.instance, 'submitted_for_verification', False))
        errors = {}

        must_have = [
            'username', 'first_name', 'last_name',
            'government_id', 'role_type', 'phone_number',
            'referee1_name', 'referee1_relation', 'referee1_email',
            'referee2_name', 'referee2_relation', 'referee2_email',
        ]

        user_data = data.get('user', {})

        if submit:
            for f in must_have:
                if f in ['username', 'first_name', 'last_name']:
                    val = (
                        user_data.get(f)
                        or (self.instance and hasattr(self.instance, 'user') and getattr(self.instance.user, f, None))
                    )
                    if not val:
                        errors[f] = 'This field is required to submit for verification.'
                else:
                    value = data.get(f)
                    if value is None and self.instance:
                        value = getattr(self.instance, f, None)
                    if not value:
                        errors[f] = 'This field is required to submit for verification.'

        if errors:
            raise serializers.ValidationError(errors)
        return data

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.gov_id_verified,        # Only count as complete if verified!
            obj.role_type,
            # obj.phone_number,
            obj.referee1_confirmed,
            obj.referee2_confirmed,
            obj.resume,
            obj.short_bio,
        ]
        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields)) if required_fields else 0
        return percent

def _canon(value: str, mapping: dict[str, str]) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    return mapping.get(v)

class RefereeResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefereeResponse
        # List all the fields that the referee will fill out in the form
        fields = [
            'referee_name',
            'referee_position',
            'relationship_to_candidate',
            'association_period',
            'contact_details',
            'role_and_responsibilities',
            'reliability_rating',
            'professionalism_notes',
            'skills_rating',
            'skills_strengths_weaknesses',
            'teamwork_communication_notes',
            'feedback_conflict_notes',
            'conduct_concerns',
            'conduct_explanation',
            'compliance_adherence',
            'compliance_incidents',
            'would_rehire',
            'rehire_explanation',
            'additional_comments',
        ]

    def validate(self, attrs):
        # Canonical maps (case-insensitive input -> canonical stored value)
        reh_map = {'yes': 'Yes', 'no': 'No', 'with reservations': 'With Reservations'}
        rate_map = {
            'excellent': 'Excellent',
            'good': 'Good',
            'satisfactory': 'Satisfactory',
            'needs improvement': 'Needs Improvement',
        }
        comp_map = {'yes': 'Yes', 'no': 'No', 'unsure': 'Unsure'}

        # Normalize choices if provided
        would = _canon(attrs.get('would_rehire'), reh_map)
        if attrs.get('would_rehire') is not None:
            if not would:
                raise serializers.ValidationError({'would_rehire': 'Choose Yes / No / With Reservations.'})
            attrs['would_rehire'] = would

        reliability = _canon(attrs.get('reliability_rating'), rate_map)
        if attrs.get('reliability_rating') is not None:
            if not reliability:
                raise serializers.ValidationError({'reliability_rating': 'Invalid rating.'})
            attrs['reliability_rating'] = reliability

        skills = _canon(attrs.get('skills_rating'), rate_map)
        if attrs.get('skills_rating') is not None:
            if not skills:
                raise serializers.ValidationError({'skills_rating': 'Invalid rating.'})
            attrs['skills_rating'] = skills

        compliance = _canon(attrs.get('compliance_adherence'), comp_map)
        if attrs.get('compliance_adherence') is not None:
            if not compliance:
                raise serializers.ValidationError({'compliance_adherence': 'Choose Yes / No / Unsure.'})
            attrs['compliance_adherence'] = compliance

        # Conditional requireds
        if would in ('No', 'With Reservations') and not (attrs.get('rehire_explanation') or '').strip():
            raise serializers.ValidationError({'rehire_explanation': 'Please add a brief explanation.'})

        if attrs.get('conduct_concerns') and not (attrs.get('conduct_explanation') or '').strip():
            raise serializers.ValidationError({'conduct_explanation': 'Please explain the conduct concern.'})

        return attrs





# === New Onboarding ===

class PharmacistOnboardingV2Serializer(serializers.ModelSerializer):
    """
    V2 single-endpoint, tab-aware serializer.
    Implements ONLY the Basic tab (as requested).
    """

    # user fields (read/write through User)
    username   = serializers.CharField(source='user.username',   required=False, allow_blank=True)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    phone_number = serializers.CharField(source='user.mobile_number', required=False, allow_blank=True, allow_null=True)


    latitude  = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)

    tfn = serializers.CharField(
        source='tfn_number', write_only=True, required=False, allow_blank=True, allow_null=True
    )
    tfn_masked = serializers.SerializerMethodField(read_only=True)


    skills = serializers.ListField(child=serializers.CharField(), required=False)
    skill_certificates = serializers.SerializerMethodField(read_only=True)
   
    # write-only control flags
    tab = serializers.CharField(write_only=True, required=False)
    submitted_for_verification = serializers.BooleanField(write_only=True, required=False)

    # computed
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = PharmacistOnboarding
        fields = [
            # ---------- BASIC ----------
            'username','first_name','last_name','phone_number','date_of_birth',
            'ahpra_number',
            'street_address','suburb','state','postcode','google_place_id','latitude','longitude',
            'ahpra_verified','ahpra_registration_status','ahpra_registration_type','ahpra_expiry_date',
            'ahpra_verification_note',

            # -------- IDENTITY (new tab) --------
            'government_id','identity_secondary_file','government_id_type','identity_meta','gov_id_verified','gov_id_verification_note',

            # -------- PAYMENT (add tfn here) --------
            'payment_preference',
            'abn','gst_registered',
            'tfn',            # <— NEW write-only alias to tfn_number
            'tfn_masked',     # <— read-only masked view
            'super_fund_name','super_usi','super_member_number',
            'abn_verified','abn_verification_note',
            'abn_entity_name','abn_entity_type','abn_status',
            'abn_gst_registered','abn_gst_from','abn_gst_to','abn_last_checked',
            'abn_entity_confirmed',


            # ----- REFEREES -----
            'referee1_name','referee1_relation','referee1_email','referee1_workplace',
            'referee1_confirmed','referee1_rejected','referee1_last_sent',
            'referee2_name','referee2_relation','referee2_email','referee2_workplace',
            'referee2_confirmed','referee2_rejected','referee2_last_sent',


            # ---------- SKILLS ----------
            'skills',
            'skill_certificates',   # read-only summary


            # ---------- Rete preferences ----------
            'rate_preference',

            # ---------- Profile preferences ----------
            'short_bio', 'resume',

            'verified','progress_percent',
            'tab','submitted_for_verification',
        ]
        extra_kwargs = {
            # user names are optional
            'username': {'required': False, 'allow_blank': True},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},

            # pharmacist fields optional here
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'date_of_birth': {'required': False, 'allow_null': True},
            'ahpra_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'government_id': {'required': False, 'allow_null': True},
            'government_id_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'gov_id_verified': {'read_only': True},
            'gov_id_verification_note': {'read_only': True},
            'identity_secondary_file': {'required': False, 'allow_null': True},
            'identity_meta': {'required': False},

            # address optional
            'street_address':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'suburb':          {'required': False, 'allow_blank': True, 'allow_null': True},
            'state':           {'required': False, 'allow_blank': True, 'allow_null': True},
            'postcode':        {'required': False, 'allow_blank': True, 'allow_null': True},
            'google_place_id': {'required': False, 'allow_blank': True, 'allow_null': True},
            'latitude':        {'required': False, 'allow_null': True},
            'longitude':       {'required': False, 'allow_null': True},

            # payment (optional – tab decides what’s required)
            'payment_preference': {'required': False, 'allow_blank': True},
            'abn':                {'required': False, 'allow_blank': True},
            'gst_registered':     {'required': False},
            'super_fund_name':    {'required': False, 'allow_blank': True},
            'super_usi':          {'required': False, 'allow_blank': True},
            'super_member_number':{'required': False, 'allow_blank': True},
            'abn_entity_confirmed': {'required': False},
            'tfn_masked': {'read_only': True},


            # read-only verification outputs
            'gov_id_verified': {'read_only': True},
            'gov_id_verification_note': {'read_only': True},
            'ahpra_verified': {'read_only': True},
            'ahpra_registration_status': {'read_only': True},
            'ahpra_registration_type': {'read_only': True},
            'ahpra_expiry_date': {'read_only': True},
            'ahpra_verification_note': {'read_only': True},

            'abn_verified': {'read_only': True},
            'abn_verification_note': {'read_only': True},
            'abn_entity_name': {'read_only': True},
            'abn_entity_type': {'read_only': True},
            'abn_status': {'read_only': True},
            'abn_gst_registered': {'read_only': True},
            'abn_gst_from': {'read_only': True},
            'abn_gst_to': {'read_only': True},
            'abn_last_checked': {'read_only': True},


            # referees input
            'referee1_name':       {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_relation':   {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email':      {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_workplace':  {'required': False, 'allow_blank': True, 'allow_null': True},

            'referee2_name':       {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_relation':   {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email':      {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_workplace':  {'required': False, 'allow_blank': True, 'allow_null': True},

            # status/read-only
            'referee1_confirmed':  {'read_only': True},
            'referee1_rejected':   {'read_only': True},
            'referee1_last_sent':  {'read_only': True},
            'referee2_confirmed':  {'read_only': True},
            'referee2_rejected':   {'read_only': True},
            'referee2_last_sent':  {'read_only': True},

            # Skills
            'skills': {'required': False},          # optional tab
            'skill_certificates': {'read_only': True},


            # Rate
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume':    {'required': False, 'allow_null': True},

            # Rate Preferences
            'rate_preference': {'required': False, 'allow_null': True},
            'verified': {'read_only': True},
            'progress_percent': {'read_only': True},
        }


    # ---------------- representation helpers ----------------
    def get_tfn_masked(self, obj):
        """
        Never expose raw TFN back to the client.
        If you store TFN in the model as `tfn_number`, mask it on output.
        """
        tfn = getattr(obj, 'tfn_number', '') or ''
        if not tfn:
            return ''
        return f'*** *** {tfn[-3:]}'

    def _files_by_skill(self):
        """
        Accept files either as flat keys ('CBR') or nested 'skill_files[CBR]'.
        """
        req = self.context.get("request")
        out = {}
        if not req or not hasattr(req, "FILES"):
            return out
        for key, f in req.FILES.items():
            if key.startswith("skill_files[") and key.endswith("]"):
                code = key[len("skill_files["):-1]
                out[code] = f
            else:
                out[key] = f
        return out

    def _save_skill_file(self, user_id: int, code: str, uploaded_file):
        """
        Save to: skill_certs/<user_id>/<CODE>/<base>_<CODE>_<YYYYmmddHHMMSS>.<ext>
        (keeps historical versions; no deletes)
        """
        base, ext = os.path.splitext(uploaded_file.name or "certificate")
        safe = slugify(base) or "certificate"
        code_up = (code or "UNKNOWN").upper()
        ts = timezone.now().strftime("%Y%m%d%H%M%S")
        rel_path = f"skill_certs/{user_id}/{code_up}/{safe}_{code_up}_{ts}{ext.lower()}"
        return default_storage.save(rel_path, uploaded_file)

    def _list_existing(self, user_id: int, code: str):
        folder = f"skill_certs/{user_id}/{(code or 'UNKNOWN').upper()}/"
        try:
            _dirs, files = default_storage.listdir(folder)
        except Exception:
            return []
        return sorted(folder + name for name in files)

    # -------- progress --------
    def get_progress_percent(self, obj):
        user = getattr(obj, 'user', None)

        def _filled_str(x):
            return bool(x and str(x).strip())

        checks = [
            bool(getattr(user, 'username', None)),
            bool(getattr(user, 'first_name', None)),
            bool(getattr(user, 'last_name', None)),
            bool(getattr(user, 'mobile_number', None)),
            bool(obj.gov_id_verified),
            bool(obj.ahpra_verified),
            bool(getattr(obj, 'referee1_confirmed', False)),
            bool(getattr(obj, 'referee2_confirmed', False)),
        ]

        # Address completeness counts as one unit
        addr_ok = all([
            _filled_str(getattr(obj, 'street_address', None)),
            _filled_str(getattr(obj, 'suburb', None)),
            _filled_str(getattr(obj, 'state', None)),
            _filled_str(getattr(obj, 'postcode', None)),
        ])
        checks.append(addr_ok)

        # Profile tab
        checks.append(bool(getattr(obj, 'resume', None)))
        checks.append(_filled_str(getattr(obj, 'short_bio', None)))

        # Payment contribution
        pref = (obj.payment_preference or '').upper()
        if pref == 'ABN':
            checks.append(bool(obj.abn) and bool(obj.abn_verified))
        elif pref == 'TFN':
            checks.append(bool(getattr(obj, 'tfn_number', None)))

        # Rates contribution (all fields)
        rp = getattr(obj, 'rate_preference', None) or {}
        checks.append(_filled_str(rp.get('weekday')))
        checks.append(_filled_str(rp.get('saturday')))
        checks.append(_filled_str(rp.get('sunday')))
        checks.append(_filled_str(rp.get('public_holiday')))
        early_ok = bool(rp.get('early_morning_same_as_day')) or _filled_str(rp.get('early_morning'))
        late_ok  = bool(rp.get('late_night_same_as_day'))   or _filled_str(rp.get('late_night'))
        checks.append(early_ok)
        checks.append(late_ok)

        # ---------- NEW: flip overall verified here, based on your gate ----------
        phone_ok = bool(getattr(user, 'is_mobile_verified', False))
        gate_ok = (
            bool(getattr(obj, 'referee1_confirmed', False)) and
            bool(getattr(obj, 'referee2_confirmed', False)) and
            bool(getattr(obj, 'ahpra_verified', False)) and
            phone_ok
        )
        if gate_ok and not bool(getattr(obj, 'verified', False)):
            try:
                obj.verified = True
                obj.save(update_fields=['verified'])
                print("[VERIFY DEBUG] progress flip -> verified=True", {"pk": obj.pk}, flush=True)
            except Exception as e:
                print("[VERIFY DEBUG] progress flip failed", {"pk": obj.pk, "err": str(e)}, flush=True)
        # ------------------------------------------------------------------------

        filled = sum(1 for x in checks if x)
        total = len(checks) or 1
        return int(100 * filled / total)

    # -------- update --------
    def update(self, instance, validated_data):
        tab = (self.initial_data.get('tab') or 'basic').strip().lower()
        submit = bool(self.initial_data.get('submitted_for_verification'))

        # --- Superuser notify: first-time submission gate (BASIC tab only) ---
        first_submit = submit and (tab == 'basic') and not bool(getattr(instance, 'submitted_for_verification', False))
        if first_submit:
            # Persist first submission so we don't email again
            instance.submitted_for_verification = True
            instance.save(update_fields=['submitted_for_verification'])

            # Local import avoids circular dependencies
            from .utils import notify_superuser_on_onboarding
            try:
                notify_superuser_on_onboarding(instance)
            except Exception:
                # Never block user flow on email issues
                pass

        if tab == 'basic':
            return self._basic_tab(instance, validated_data, submit)
        if tab == 'payment':
            return self._payment_tab(instance, validated_data, submit)
        if tab == 'referees':
            return self._referees_tab(instance, validated_data, submit)
        if tab == 'skills':
            return self._skills_tab(instance, validated_data, submit)
        if tab == 'rate':
            return self._rate_tab(instance, validated_data, submit)
        if tab == 'profile':
            return self._profile_tab(instance, validated_data, submit)
        if tab == 'identity':
            return self._identity_tab(instance, validated_data, submit)

        return super().update(instance, validated_data)

    # ---------------- BASIC TAB ----------------
    def _basic_tab(self, instance: PharmacistOnboarding, vdata: dict, submit: bool):
        # nested user data
        user_data = vdata.pop('user', {})

        if user_data:
            changed_user_fields = []
            for k in ('username', 'first_name', 'last_name', 'mobile_number'):
                if k in user_data:
                    setattr(instance.user, k, user_data[k])
                    changed_user_fields.append(k)
            if changed_user_fields:
                instance.user.save(update_fields=changed_user_fields)

        # helper to compare file names safely
        def _fname(f): 
            return getattr(f, 'name', None) if f else None

        # We will handle government_id explicitly (to delete old files safely),
        # so do NOT include it in direct_fields.
        direct_fields = [
        'ahpra_number',
        'street_address', 'suburb', 'state', 'postcode', 'google_place_id',
        'date_of_birth',
        ]

        # Detect changes that affect verification flags
        ahpra_changed = 'ahpra_number' in vdata and (vdata.get('ahpra_number') != getattr(instance, 'ahpra_number'))

        update_fields = []

        # --- government_id: delete old file on replace or explicit clear ---
        # gov_id_changed = False
        # if 'government_id' in vdata:
        #     new_file = vdata.get('government_id')  # may be a file object or None
        #     old_file = getattr(instance, 'government_id', None)
        #     gov_id_changed = (_fname(new_file) != _fname(old_file))

        #     if new_file is None:
        #         # explicit clear
        #         if old_file:
        #             try:
        #                 old_file.delete(save=False)   # Azure/local safe
        #             except Exception:
        #                 pass
        #         instance.government_id = None
        #         update_fields.append('government_id')
        #     else:
        #         # replacing: delete old first if it's different
        #         if old_file and _fname(old_file) and _fname(old_file) != _fname(new_file):
        #             try:
        #                 old_file.delete(save=False)
        #             except Exception:
        #                 pass
        #         instance.government_id = new_file
        #         update_fields.append('government_id')

        # regular writes for other basic fields
        for f in direct_fields:
            if f in vdata:
                setattr(instance, f, vdata[f])
                update_fields.append(f)

        # round/quantize lat/lon to 6 dp if provided
        if 'latitude' in vdata:
            instance.latitude = q6(vdata.get('latitude'))
            update_fields.append('latitude')
        if 'longitude' in vdata:
            instance.longitude = q6(vdata.get('longitude'))
            update_fields.append('longitude')

        # reset only relevant flags when inputs changed
        if ahpra_changed:
            instance.ahpra_verified = False
            instance.ahpra_verification_note = ""
            update_fields += ['ahpra_verified', 'ahpra_verification_note']

        # if gov_id_changed:
        #     instance.gov_id_verified = False
        #     instance.gov_id_verification_note = ""
        #     update_fields += ['gov_id_verified', 'gov_id_verification_note']

        # full profile remains unverified until all tabs pass
        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # trigger ONLY the basic-tab tasks when submitting
        if submit:
            ahpra = vdata.get('ahpra_number', instance.ahpra_number)
            # gov   = vdata.get('government_id', instance.government_id)
            errors = {}
            if not ahpra:
                errors['ahpra_number'] = ['AHPRA number is required to submit.']
            # if not gov:
            #     errors['government_id'] = ['Government ID file is required to submit.']
            if errors:
                raise serializers.ValidationError(errors)

            # AHPRA: changed OR not verified yet
            if instance.ahpra_number and (ahpra_changed or not instance.ahpra_verified):
                async_task(
                    'client_profile.tasks.verify_ahpra_task',
                    instance._meta.model_name, instance.pk,
                    instance.ahpra_number, instance.user.first_name,
                    instance.user.last_name, instance.user.email,
                )

            # GOV ID: file changed OR not verified yet
            # if instance.government_id and (gov_id_changed or not instance.gov_id_verified):
            #     async_task(
            #         'client_profile.tasks.verify_filefield_task',
            #         instance._meta.model_name, instance.pk,
            #         'government_id',
            #         instance.user.first_name or '',
            #         instance.user.last_name or '',
            #         instance.user.email or '',
            #         verification_field='gov_id_verified',
            #         note_field='gov_id_verification_note',
            #     )

        return instance


    # ---------------- Identity TAB (new) ----------------
    def _identity_tab(self, instance: PharmacistOnboarding, vdata: dict, submit: bool):
        """
        Handles:
        - government_id_type (dropdown)
        - government_id (primary file)
        - identity_secondary_file (secondary file for paired docs)
        - identity_meta (JSON with per-type fields)
        Normalises per document type and validates on submit.
        """
        update_fields = []

        # helper to compare file names safely
        def _fname(f):
            return getattr(f, 'name', None) if f else None

        # Track changes to drive verification resets
        type_changed = False
        gov_id_changed = False
        sec_changed = False
        meta_changed = False

        # --- type (dropdown) – optional
        if 'government_id_type' in vdata:
            new_type = vdata.get('government_id_type')
            type_changed = (new_type != getattr(instance, 'government_id_type'))
            instance.government_id_type = new_type
            update_fields.append('government_id_type')

            # If switching to a type that doesn't need a secondary file, clear it
            if new_type in ('DRIVER_LICENSE', 'AUS_PASSPORT', 'AGE_PROOF'):
                old_sec = getattr(instance, 'identity_secondary_file', None)
                if old_sec:
                    try:
                        old_sec.delete(save=False)
                    except Exception:
                        pass
                    instance.identity_secondary_file = None
                    update_fields.append('identity_secondary_file')
                    sec_changed = True

            # If type changes and no new meta provided, wipe old meta to avoid stale keys
            if 'identity_meta' not in vdata:
                instance.identity_meta = {}
                update_fields.append('identity_meta')
                meta_changed = True

        # --- primary file handling (replace / clear)
        if 'government_id' in vdata:
            new_file = vdata.get('government_id')
            old_file = getattr(instance, 'government_id', None)
            gov_id_changed = (_fname(new_file) != _fname(old_file))

            if new_file is None:
                if old_file:
                    try:
                        old_file.delete(save=False)
                    except Exception:
                        pass
                instance.government_id = None
                update_fields.append('government_id')
            else:
                if old_file and _fname(old_file) and _fname(old_file) != _fname(new_file):
                    try:
                        old_file.delete(save=False)
                    except Exception:
                        pass
                instance.government_id = new_file
                update_fields.append('government_id')

        # --- secondary file handling (replace / clear)
        if 'identity_secondary_file' in vdata:
            new_sec = vdata.get('identity_secondary_file')  # may be file or None
            old_sec = getattr(instance, 'identity_secondary_file', None)
            sec_changed = (_fname(new_sec) != _fname(old_sec))

            if new_sec is None:
                if old_sec:
                    try:
                        old_sec.delete(save=False)
                    except Exception:
                        pass
                instance.identity_secondary_file = None
                update_fields.append('identity_secondary_file')
            else:
                if old_sec and _fname(old_sec) and _fname(old_sec) != _fname(new_sec):
                    try:
                        old_sec.delete(save=False)
                    except Exception:
                        pass
                instance.identity_secondary_file = new_sec
                update_fields.append('identity_secondary_file')

        # --- identity_meta (JSON) – normalise per document type
        if 'identity_meta' in vdata:
            incoming_meta = vdata.get('identity_meta') or {}
            meta = dict(incoming_meta)  # shallow copy
            doc_type = getattr(instance, 'government_id_type')

            if doc_type == 'DRIVER_LICENSE':
                keep = {'state', 'expiry'}
                meta = {k: v for k, v in meta.items() if k in keep}

            elif doc_type == 'VISA':
                # Visa + Overseas passport (secondary file)
                keep = {'visa_type_number', 'valid_to', 'passport_country', 'passport_expiry'}
                meta = {k: v for k, v in meta.items() if k in keep}

            elif doc_type == 'AUS_PASSPORT':
                keep = {'expiry'}
                meta = {k: v for k, v in meta.items() if k in keep}
                meta['country'] = 'Australia'

            elif doc_type == 'OTHER_PASSPORT':
                # Overseas passport + Visa (secondary file)
                keep = {'country', 'expiry', 'visa_type_number', 'valid_to'}
                meta = {k: v for k, v in meta.items() if k in keep}

            elif doc_type == 'AGE_PROOF':
                keep = {'state', 'expiry'}
                meta = {k: v for k, v in meta.items() if k in keep}

            # Detect change
            if meta != (instance.identity_meta or {}):
                instance.identity_meta = meta
                update_fields.append('identity_meta')
                meta_changed = True

        # --- reset verification flags if any relevant identity input changed
        if gov_id_changed or sec_changed or type_changed or meta_changed:
            instance.gov_id_verified = False
            instance.gov_id_verification_note = ""
            update_fields += ['gov_id_verified', 'gov_id_verification_note']

        # submitting this tab does not make the whole profile verified by itself
        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # --- Validate on submit (per type)
        if submit:
            errors = {}
            doc_type = getattr(instance, 'government_id_type')
            meta_now = getattr(instance, 'identity_meta') or {}

            if not doc_type:
                errors['government_id_type'] = ['Select a document type.']

            # Primary file required for all types
            if not getattr(instance, 'government_id', None):
                errors['government_id'] = ['This file is required.']

            if doc_type == 'DRIVER_LICENSE':
                if not meta_now.get('state'):  errors['identity_meta.state'] = ['Required.']
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']

            elif doc_type == 'VISA':
                if not meta_now.get('visa_type_number'):  errors['identity_meta.visa_type_number'] = ['Required.']
                if not meta_now.get('valid_to'):         errors['identity_meta.valid_to'] = ['Required.']
                if not getattr(instance, 'identity_secondary_file', None):
                    errors['identity_secondary_file'] = ['Overseas passport file is required with a Visa.']
                if not meta_now.get('passport_country'): errors['identity_meta.passport_country'] = ['Required.']
                if not meta_now.get('passport_expiry'):  errors['identity_meta.passport_expiry'] = ['Required.']

            elif doc_type == 'AUS_PASSPORT':
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']
                # country forced to Australia in normalisation

            elif doc_type == 'OTHER_PASSPORT':
                if not meta_now.get('country'): errors['identity_meta.country'] = ['Required.']
                if not meta_now.get('expiry'):  errors['identity_meta.expiry'] = ['Required.']
                if not getattr(instance, 'identity_secondary_file', None):
                    errors['identity_secondary_file'] = ['Visa file is required with an Overseas passport.']
                if not meta_now.get('visa_type_number'): errors['identity_meta.visa_type_number'] = ['Required.']
                if not meta_now.get('valid_to'):         errors['identity_meta.valid_to'] = ['Required.']

            elif doc_type == 'AGE_PROOF':
                if not meta_now.get('state'):  errors['identity_meta.state'] = ['Required.']
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']

            if errors:
                raise serializers.ValidationError(errors)

            # On submit: schedule verification task if needed (primary file)
            if instance.government_id and (gov_id_changed or type_changed or meta_changed or not instance.gov_id_verified):
                async_task(
                    'client_profile.tasks.verify_filefield_task',
                    instance._meta.model_name, instance.pk,
                    'government_id',
                    instance.user.first_name or '',
                    instance.user.last_name or '',
                    instance.user.email or '',
                    verification_field='gov_id_verified',
                    note_field='gov_id_verification_note',
                )

        # Recompute final verified gate on every pass
        return instance

    # ---------------- Payment TAB ----------------
    def _payment_tab(self, instance: PharmacistOnboarding, vdata: dict, submit: bool):
        """
        Payment fields only. No GST file in V2.
        - ABN: task scrapes ABR fields; user must confirm => abn_verified=True
        - TFN: store raw in model.tfn_number, show only tfn_masked on reads
        - When pref=TFN and submit=True -> TFN + super_* are required
        """
        payment_fields = [
            'payment_preference', 'abn', 'gst_registered',
            'super_fund_name', 'super_usi', 'super_member_number',
            'abn_entity_confirmed',
        ]
        update_fields: list[str] = []

        # normalize pref for logic below
        pref_in = (vdata.get('payment_preference') or instance.payment_preference or '').upper()

        # 1) regular writes
        for f in payment_fields:
            if f in vdata:
                setattr(instance, f, vdata[f])
                update_fields.append(f)

        # 2) TFN payload – client sends "tfn" (source='tfn_number'), DRF puts it in vdata['tfn_number']
        if 'tfn_number' in vdata:
            instance.tfn_number = (vdata['tfn_number'] or '').strip()
            update_fields.append('tfn_number')

        # 3) if ABN changed -> reset verification + confirmation
        abn_changed = ('abn' in vdata) and (vdata.get('abn') != getattr(instance, 'abn'))
        if abn_changed:
            instance.abn_verified = False
            instance.abn_entity_confirmed = False
            instance.abn_verification_note = ""
            update_fields += ['abn_verified', 'abn_entity_confirmed', 'abn_verification_note']

        # 4) confirmation gate: only user confirmation can set abn_verified=True
        if 'abn_entity_confirmed' in vdata:
            confirmed = bool(vdata['abn_entity_confirmed'])
            if confirmed and instance.abn_entity_name:   # must have scraped data to confirm
                instance.abn_verified = True
                if not instance.abn_verification_note:
                    instance.abn_verification_note = 'User confirmed ABN entity details.'
                update_fields += ['abn_verified', 'abn_verification_note']
            else:
                if instance.abn_verified:
                    instance.abn_verified = False
                    update_fields.append('abn_verified')

        # 5) optional sync of boolean gst_registered from ABR result if client didn’t send it
        if 'gst_registered' not in vdata:
            if instance.abn_gst_registered is True and not instance.gst_registered:
                instance.gst_registered = True
                update_fields.append('gst_registered')

        # 6) TFN validation: when submitting TFN path, enforce super_* required
        if submit and (pref_in or instance.payment_preference):
            pref_effective = (pref_in or instance.payment_preference or '').upper()
            if pref_effective == 'TFN':
                errors = {}
                if not instance.tfn_number:
                    errors['tfn'] = ['TFN is required.']
                if not instance.super_fund_name:
                    errors['super_fund_name'] = ['Super fund name is required for TFN.']
                if not instance.super_usi:
                    errors['super_usi'] = ['USI is required for TFN.']
                if not instance.super_member_number:
                    errors['super_member_number'] = ['Member number is required for TFN.']
                if errors:
                    raise serializers.ValidationError(errors)

        # 7) submitting this tab keeps the whole profile unverified until all tabs pass
        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # 8) run ABN task on submit (TFN has no task)
        if submit:
            pref_effective = (pref_in or instance.payment_preference or '').upper()
            if pref_effective == 'ABN' and instance.abn:
                async_task(
                    'client_profile.tasks.verify_abn_task',
                    instance._meta.model_name,
                    instance.pk,
                    instance.abn,
                    instance.user.first_name or '',
                    instance.user.last_name or '',
                    instance.user.email or '',
                    note_field='abn_verification_note',  # task will only fill ABR fields + note
                )
        return instance

    # ---------------- Referees TAB ----------------
    def _referees_tab(self, instance, vdata: dict, submit: bool):
        """
        Two referees are required on submit.
        Required per referee: name, relation, workplace, email.
        If referee is already confirmed -> ignore edits (lock).
        On change for a pending referee -> reset confirmed/rejected + last_sent.
        On submit -> send referee emails (no final-eval). Scheduling happens in utils.
        """
        from .utils import send_referee_emails  # local import to avoid cycles
        update_fields = []

        def apply_ref(idx: int):
            prefix = f"referee{idx}_"
            locked = bool(getattr(instance, f"{prefix}confirmed", False))

            incoming = {
                'name': vdata.get(f"{prefix}name", getattr(instance, f"{prefix}name")),
                'relation': vdata.get(f"{prefix}relation", getattr(instance, f"{prefix}relation")),
                'email': clean_email(vdata.get(f"{prefix}email", getattr(instance, f"{prefix}email"))),
                'workplace': vdata.get(f"{prefix}workplace", getattr(instance, f"{prefix}workplace")),
            }

            if locked:
                return

            changed = False
            for key in ['name', 'relation', 'email', 'workplace']:
                field = f"{prefix}{key}"
                if field in vdata and getattr(instance, field) != incoming[key]:
                    setattr(instance, field, incoming[key])
                    update_fields.append(field)
                    changed = True

            if changed:
                if getattr(instance, f"{prefix}confirmed", False):
                    setattr(instance, f"{prefix}confirmed", False)
                    update_fields.append(f"{prefix}confirmed")
                if getattr(instance, f"{prefix}rejected", False):
                    setattr(instance, f"{prefix}rejected", False)
                    update_fields.append(f"{prefix}rejected")
                if getattr(instance, f"{prefix}last_sent", None) is not None:
                    setattr(instance, f"{prefix}last_sent", None)
                    update_fields.append(f"{prefix}last_sent")

        apply_ref(1)
        apply_ref(2)

        if submit:
            errors = {}
            for idx in [1, 2]:
                prefix = f"referee{idx}_"
                name = getattr(instance, f"{prefix}name")
                relation = getattr(instance, f"{prefix}relation")
                email = getattr(instance, f"{prefix}email")
                workplace = getattr(instance, f"{prefix}workplace")
                if not name:
                    errors[prefix + 'name'] = ['Required.']
                if not relation:
                    errors[prefix + 'relation'] = ['Required.']
                if not email:
                    errors[prefix + 'email'] = ['Required.']
                if not workplace:
                    errors[prefix + 'workplace'] = ['Required.']
            if errors:
                raise serializers.ValidationError(errors)

            if not instance.verified:
                instance.verified = False
                update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        if submit:
            send_referee_emails(instance, is_reminder=False)  # schedules per-ref inside
        return instance

    # ---------------- Skills tab ----------------
    def _skills_tab(self, instance, vdata: dict, submit: bool):
        """
        Rules:
        - Checking a skill is optional.
        - If a skill is checked, a certificate MUST exist (already saved or uploaded now).
        - We store per-skill file metadata in instance.skill_certificates (JSON).
        - This version deletes old files when replacing (and when a skill is unchecked) unless KEEP_SKILL_HISTORY=True.
        """
        # accept JSON string or list
        raw = self.initial_data.get("skills", vdata.get("skills", []))
        if isinstance(raw, str):
            try:
                skills = json.loads(raw)
            except Exception:
                raise serializers.ValidationError({"skills": "Must be a JSON array or list."})
        else:
            skills = list(raw or [])

        uploads = self._files_by_skill()
        cert_map = dict(instance.skill_certificates or {})
        user_id = instance.user_id

        # (A) If a skill was **unchecked/removed**, optionally delete its last stored file
        if not getattr(self, "KEEP_SKILL_HISTORY", False):
            removed_codes = [code for code in list(cert_map.keys()) if code not in skills]
            for code in removed_codes:
                old_path = (cert_map.get(code) or {}).get("path")
                if old_path:
                    try:
                        default_storage.delete(old_path)  # works with Azure Blob via django-storages
                    except Exception:
                        pass
                cert_map.pop(code, None)

        # (B) Save any uploaded files for checked skills
        #     Safe order: save the new file first; if it succeeds, delete the old one (if any).
        for code, f in uploads.items():
            if code in skills:
                # remember old path (if any)
                old_path = (cert_map.get(code) or {}).get("path")

                # save new file
                saved = self._save_skill_file(user_id, code, f)

                # delete old file unless we're keeping history
                if old_path and not getattr(self, "KEEP_SKILL_HISTORY", False):
                    try:
                        default_storage.delete(old_path)
                    except Exception:
                        # swallow storage deletion errors; user flow should not break
                        pass

                # point to the new file
                cert_map[code] = {
                    "path": saved,
                    "uploaded_at": timezone.now().isoformat(),
                }

        # (C) Validation: each checked skill must have a certificate (either from before or uploaded now)
        missing = [code for code in skills if code not in cert_map]
        if missing:
            raise serializers.ValidationError(
                {"skills": f"Certificate required for checked skill(s): {', '.join(missing)}"}
            )

        # Persist
        instance.skills = skills
        instance.skill_certificates = cert_map
        instance.save(update_fields=["skills", "skill_certificates"])
        return instance

    # --------------- read-only summary for UI ---------------
    def get_skill_certificates(self, obj):
        """
        Return latest file per skill (by name sort). If you want all versions, expand here.
        """
        data = []
        for code, meta in (obj.skill_certificates or {}).items():
            path = (meta or {}).get("path")
            if not path:
                continue
            try:
                url = default_storage.url(path)
            except Exception:
                url = None
            data.append({"skill_code": code, "path": path, "url": url, "uploaded_at": meta.get("uploaded_at")})
        # stable order
        return sorted(data, key=lambda r: r["skill_code"])

    # ---------------- Rate tab ----------------
    def _rate_tab(self, instance, vdata: dict, submit: bool):
        """
        Stores rate_preference JSON.
        Accepts stringified JSON or dict with keys:
        weekday, saturday, sunday, public_holiday, early_morning, late_night (strings),
        early_morning_same_as_day (bool), late_night_same_as_day (bool)
        """
        raw = self.initial_data.get('rate_preference', vdata.get('rate_preference'))
        if raw is None:
            # allow clearing: leave as-is if not provided
            return instance

        try:
            rp = json.loads(raw) if isinstance(raw, str) else dict(raw)
        except Exception:
            raise serializers.ValidationError({"rate_preference": "Must be a JSON object."})

        # Soft sanitize: ensure keys exist, store as strings/booleans
        def to_s(x): return '' if x is None else str(x)
        rp_norm = {
            "weekday": to_s(rp.get("weekday")),
            "saturday": to_s(rp.get("saturday")),
            "sunday": to_s(rp.get("sunday")),
            "public_holiday": to_s(rp.get("public_holiday")),
            "early_morning": to_s(rp.get("early_morning")),
            "late_night": to_s(rp.get("late_night")),
            "early_morning_same_as_day": bool(rp.get("early_morning_same_as_day", False)),
            "late_night_same_as_day": bool(rp.get("late_night_same_as_day", False)),
        }

        instance.rate_preference = rp_norm
        if submit:
            instance.verified = False  # stays unverified until all tabs pass
            instance.save(update_fields=["rate_preference", "verified"])
        else:
            instance.save(update_fields=["rate_preference"])

        return instance

    # ---------------- Profile tab ----------------
    def _profile_tab(self, instance, vdata: dict, submit: bool):
        """
        Profile tab: resume file + short note (short_bio).
        Behavior:
        - If a new resume is uploaded, delete the old file first (Azure + dev parity).
        - If resume is explicitly set to None, delete existing file.
        - short_bio is plain text, optional.
        """
        update_fields = []

        # Handle short_bio (optional)
        if 'short_bio' in vdata:
            instance.short_bio = vdata['short_bio']
            update_fields.append('short_bio')

        # Handle resume
        if 'resume' in vdata:
            new_file = vdata['resume']  # may be a file object or None
            old_file = getattr(instance, 'resume', None)

            if new_file is None:
                # explicit clear
                if old_file:
                    old_file.delete(save=False)  # Azure/local safe
                instance.resume = None
                update_fields.append('resume')
            else:
                # replace file: delete old first to mimic overwrite behavior everywhere
                if old_file:
                    try:
                        # delete only if name differs (optional; safe to always delete)
                        if getattr(old_file, 'name', None) != getattr(new_file, 'name', None):
                            old_file.delete(save=False)
                    except Exception:
                        # swallow storage deletion errors to avoid blocking user save
                        pass
                instance.resume = new_file
                update_fields.append('resume')

        # Submit does not auto-verify anything here; keep profile unverified until all tabs pass
        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))
        return instance


class OtherStaffOnboardingV2Serializer(serializers.ModelSerializer):
    """
    V2 single-endpoint, tab-aware serializer for OtherStaff.
    Mirrors the Pharmacist V2 procedure but without AHPRA and with a Regulatory tab.
    """

    # user fields (read/write through User)
    username     = serializers.CharField(source='user.username',   required=False, allow_blank=True)
    first_name   = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name    = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    phone_number = serializers.CharField(source='user.mobile_number', required=False, allow_blank=True, allow_null=True)

    latitude  = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)

    # TFN aliasing (store raw; only expose masked)
    tfn = serializers.CharField(
        source='tfn_number', write_only=True, required=False, allow_blank=True, allow_null=True
    )
    tfn_masked = serializers.SerializerMethodField(read_only=True)

    # Skills
    skills = serializers.ListField(child=serializers.CharField(), required=False)
    skill_certificates = serializers.SerializerMethodField(read_only=True)

    # write-only control flags
    tab = serializers.CharField(write_only=True, required=False)
    submitted_for_verification = serializers.BooleanField(write_only=True, required=False)

    # computed
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = OtherStaffOnboarding
        fields = [
            # ---------- BASIC ----------
            'username','first_name','last_name','phone_number','date_of_birth',
            'street_address','suburb','state','postcode','google_place_id','latitude','longitude',

            # ---------- IDENTITY ----------
            'government_id','identity_secondary_file','government_id_type','identity_meta',
            'gov_id_verified','gov_id_verification_note',

            # ---------- REGULATORY DOCS (role + files) ----------
            'role_type','classification_level','student_year','intern_half',
            'ahpra_proof','hours_proof','certificate','university_id','cpr_certificate','s8_certificate',
            'ahpra_proof_verified','ahpra_proof_verification_note',
            'hours_proof_verified','hours_proof_verification_note',
            'certificate_verified','certificate_verification_note',
            'university_id_verified','university_id_verification_note',
            'cpr_certificate_verified','cpr_certificate_verification_note',
            's8_certificate_verified','s8_certificate_verification_note',

            # ---------- PAYMENT ----------
            'payment_preference',
            'abn','gst_registered',
            'tfn', 'tfn_masked',
            'super_fund_name','super_usi','super_member_number',
            'abn_verified','abn_verification_note',
            'abn_entity_name','abn_entity_type','abn_status',
            'abn_gst_registered','abn_gst_from','abn_gst_to','abn_last_checked',
            'abn_entity_confirmed',

            # ---------- REFEREES ----------
            'referee1_name','referee1_relation','referee1_email','referee1_workplace',
            'referee1_confirmed','referee1_rejected','referee1_last_sent',
            'referee2_name','referee2_relation','referee2_email','referee2_workplace',
            'referee2_confirmed','referee2_rejected','referee2_last_sent',

            # ---------- SKILLS ----------
            'skills',
            'skill_certificates',   # read-only summary
            'years_experience',  

            # ---------- PROFILE ----------
            'short_bio','resume',

            'verified','progress_percent',
            'tab','submitted_for_verification',
        ]
        extra_kwargs = {
            # user names optional
            'username': {'required': False, 'allow_blank': True},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},

            # basic optional
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'date_of_birth': {'required': False, 'allow_null': True},
            'street_address':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'suburb':          {'required': False, 'allow_blank': True, 'allow_null': True},
            'state':           {'required': False, 'allow_blank': True, 'allow_null': True},
            'postcode':        {'required': False, 'allow_blank': True, 'allow_null': True},
            'google_place_id': {'required': False, 'allow_blank': True, 'allow_null': True},
            'latitude':        {'required': False, 'allow_null': True},
            'longitude':       {'required': False, 'allow_null': True},

            # identity optional (tab handles requiredness)
            'government_id': {'required': False, 'allow_null': True},
            'government_id_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'identity_secondary_file': {'required': False, 'allow_null': True},
            'identity_meta': {'required': False},
            'gov_id_verified': {'read_only': True},
            'gov_id_verification_note': {'read_only': True},

            # regulatory files optional (tab decides requiredness)
            'role_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'classification_level': {'required': False, 'allow_blank': True, 'allow_null': True},
            'student_year': {'required': False, 'allow_blank': True, 'allow_null': True},
            'intern_half': {'required': False, 'allow_blank': True, 'allow_null': True},

            'ahpra_proof': {'required': False, 'allow_null': True},
            'hours_proof': {'required': False, 'allow_null': True},
            'certificate': {'required': False, 'allow_null': True},
            'university_id': {'required': False, 'allow_null': True},
            'cpr_certificate': {'required': False, 'allow_null': True},
            's8_certificate': {'required': False, 'allow_null': True},

            'ahpra_proof_verified': {'read_only': True},
            'ahpra_proof_verification_note': {'read_only': True},
            'hours_proof_verified': {'read_only': True},
            'hours_proof_verification_note': {'read_only': True},
            'certificate_verified': {'read_only': True},
            'certificate_verification_note': {'read_only': True},
            'university_id_verified': {'read_only': True},
            'university_id_verification_note': {'read_only': True},
            'cpr_certificate_verified': {'read_only': True},
            'cpr_certificate_verification_note': {'read_only': True},
            's8_certificate_verified': {'read_only': True},
            's8_certificate_verification_note': {'read_only': True},

            # payment (tab decides requiredness)
            'payment_preference': {'required': False, 'allow_blank': True},
            'abn':                {'required': False, 'allow_blank': True},
            'gst_registered':     {'required': False},
            'super_fund_name':    {'required': False, 'allow_blank': True},
            'super_usi':          {'required': False, 'allow_blank': True},
            'super_member_number':{'required': False, 'allow_blank': True},
            'abn_entity_confirmed': {'required': False},
            'tfn_masked': {'read_only': True},

            # ABR outputs read-only
            'abn_verified': {'read_only': True},
            'abn_verification_note': {'read_only': True},
            'abn_entity_name': {'read_only': True},
            'abn_entity_type': {'read_only': True},
            'abn_status': {'read_only': True},
            'abn_gst_registered': {'read_only': True},
            'abn_gst_from': {'read_only': True},
            'abn_gst_to': {'read_only': True},
            'abn_last_checked': {'read_only': True},

            # referees
            'referee1_name':       {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_relation':   {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email':      {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_workplace':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_name':       {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_relation':   {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email':      {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_workplace':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_confirmed':  {'read_only': True},
            'referee1_rejected':   {'read_only': True},
            'referee1_last_sent':  {'read_only': True},
            'referee2_confirmed':  {'read_only': True},
            'referee2_rejected':   {'read_only': True},
            'referee2_last_sent':  {'read_only': True},

            # skills
            'skills': {'required': False},
            'skill_certificates': {'read_only': True},
            'years_experience': {'required': False, 'allow_blank': True, 'allow_null': True},

            # profile
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume':    {'required': False, 'allow_null': True},

            'verified': {'read_only': True},
            'progress_percent': {'read_only': True},
        }

    # ---------------- representation helpers ----------------
    def get_tfn_masked(self, obj):
        tfn = getattr(obj, 'tfn_number', '') or ''
        if not tfn:
            return ''
        return f'*** *** {tfn[-3:]}'  # never expose full TFN

    def _files_by_skill(self):
        req = self.context.get("request")
        out = {}
        if not req or not hasattr(req, "FILES"):
            return out
        for key, f in req.FILES.items():
            if key.startswith("skill_files[") and key.endswith("]"):
                code = key[len("skill_files["):-1]
                out[code] = f
            else:
                out[key] = f
        return out

    def _save_skill_file(self, user_id: int, code: str, uploaded_file):
        base, ext = os.path.splitext(uploaded_file.name or "certificate")
        safe = slugify(base) or "certificate"
        code_up = (code or "UNKNOWN").upper()
        ts = timezone.now().strftime("%Y%m%d%H%M%S")
        rel_path = f"skill_certs/{user_id}/{code_up}/{safe}_{code_up}_{ts}{ext.lower()}"
        return default_storage.save(rel_path, uploaded_file)

    def _list_existing(self, user_id: int, code: str):
        folder = f"skill_certs/{user_id}/{(code or 'UNKNOWN').upper()}/"
        try:
            _dirs, files = default_storage.listdir(folder)
        except Exception:
            return []
        return sorted(folder + name for name in files)

    # -------- utility: regulatory requirements by role --------
    def _required_docs_for_role(self, instance):
        """
        Returns list of (field_name, verified_flag, note_field) tuples required for the selected role.
        """
        role = (instance.role_type or '').upper()
        mapping = {
            'INTERN': [
                ('ahpra_proof', 'ahpra_proof_verified', 'ahpra_proof_verification_note'),
                ('hours_proof', 'hours_proof_verified', 'hours_proof_verification_note'),
            ],
            'TECHNICIAN': [
                ('certificate', 'certificate_verified', 'certificate_verification_note'),
            ],
            'ASSISTANT': [
                ('certificate', 'certificate_verified', 'certificate_verification_note'),
            ],
            'STUDENT': [
                ('university_id', 'university_id_verified', 'university_id_verification_note'),
            ],
        }
        return mapping.get(role, [])

    # -------- progress --------
    def get_progress_percent(self, obj):
        user = getattr(obj, 'user', None)

        def _filled_str(x):
            return bool(x and str(x).strip())

        checks = [
            bool(getattr(user, 'username', None)),
            bool(getattr(user, 'first_name', None)),
            bool(getattr(user, 'last_name', None)),
            bool(getattr(user, 'mobile_number', None)),
            bool(obj.gov_id_verified),
            bool(getattr(obj, 'referee1_confirmed', False)),
            bool(getattr(obj, 'referee2_confirmed', False)),
        ]

        # Address completeness counts as one unit
        addr_ok = all([
            _filled_str(getattr(obj, 'street_address', None)),
            _filled_str(getattr(obj, 'suburb', None)),
            _filled_str(getattr(obj, 'state', None)),
            _filled_str(getattr(obj, 'postcode', None)),
        ])
        checks.append(addr_ok)

        # Profile tab
        checks.append(bool(getattr(obj, 'resume', None)))
        checks.append(_filled_str(getattr(obj, 'short_bio', None)))

        # Payment contribution
        pref = (obj.payment_preference or '').upper()
        if pref == 'ABN':
            checks.append(bool(obj.abn) and bool(obj.abn_verified))
        elif pref == 'TFN':
            checks.append(bool(getattr(obj, 'tfn_number', None)))

        # Regulatory docs gate: all required docs for the role must be verified
        req = self._required_docs_for_role(obj)
        docs_ok = all(getattr(obj, verified_flag, False) for _, verified_flag, _ in req)
        checks.append(docs_ok)

        # Final verified flip (role-specific)
        phone_ok = bool(getattr(user, 'is_mobile_verified', False))
        gate_ok = (
            bool(getattr(obj, 'referee1_confirmed', False)) and
            bool(getattr(obj, 'referee2_confirmed', False)) and
            bool(getattr(obj, 'gov_id_verified', False))   and
            docs_ok and
            phone_ok
        )
        if gate_ok and not bool(getattr(obj, 'verified', False)):
            try:
                obj.verified = True
                obj.save(update_fields=['verified'])
                print("[VERIFY DEBUG] otherstaff progress flip -> verified=True", {"pk": obj.pk}, flush=True)
            except Exception as e:
                print("[VERIFY DEBUG] otherstaff progress flip failed", {"pk": obj.pk, "err": str(e)}, flush=True)

        filled = sum(1 for x in checks if x)
        total = len(checks) or 1
        return int(100 * filled / total)

    # ---------------- update router ----------------
    def update(self, instance, validated_data):
        tab = (self.initial_data.get('tab') or 'basic').strip().lower()
        submit = bool(self.initial_data.get('submitted_for_verification'))

        # --- Superuser notify: first-time submission gate (BASIC tab only) ---
        first_submit = submit and (tab == 'basic') and not bool(getattr(instance, 'submitted_for_verification', False))
        if first_submit:
            instance.submitted_for_verification = True
            instance.save(update_fields=['submitted_for_verification'])
            from .utils import notify_superuser_on_onboarding
            try:
                notify_superuser_on_onboarding(instance)
            except Exception:
                pass

        if tab == 'basic':
            return self._basic_tab(instance, validated_data, submit)
        if tab == 'identity':
            return self._identity_tab(instance, validated_data, submit)
        if tab == 'regulatory':
            return self._regulatory_tab(instance, validated_data, submit)
        if tab == 'payment':
            return self._payment_tab(instance, validated_data, submit)
        if tab == 'referees':
            return self._referees_tab(instance, validated_data, submit)
        if tab == 'skills':
            return self._skills_tab(instance, validated_data, submit)
        if tab == 'profile':
            return self._profile_tab(instance, validated_data, submit)

        return super().update(instance, validated_data)

    # ---------------- BASIC TAB ----------------
    def _basic_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        # nested user data
        user_data = vdata.pop('user', {})
        if user_data:
            changed_user_fields = []
            for k in ('username', 'first_name', 'last_name', 'mobile_number'):
                if k in user_data:
                    setattr(instance.user, k, user_data[k])
                    changed_user_fields.append(k)
            if changed_user_fields:
                instance.user.save(update_fields=changed_user_fields)

        update_fields = []

        # regular writes for basic fields (address + dob)
        direct_fields = [
            'street_address','suburb','state','postcode','google_place_id','date_of_birth',
            'role_type','classification_level','student_year','intern_half',  # allow role data in Basic if FE sends them early
        ]
        for f in direct_fields:
            if f in vdata:
                setattr(instance, f, vdata[f])
                update_fields.append(f)

        # lat/lon rounding to 6 dp
        if 'latitude' in vdata:
            instance.latitude = q6(vdata.get('latitude'))
            update_fields.append('latitude')
        if 'longitude' in vdata:
            instance.longitude = q6(vdata.get('longitude'))
            update_fields.append('longitude')

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))
        return instance

    # ---------------- Identity TAB ----------------
    def _identity_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        update_fields = []

        def _fname(f):
            return getattr(f, 'name', None) if f else None

        # track changes
        type_changed = False
        gov_id_changed = False
        sec_changed = False
        meta_changed = False

        # type
        if 'government_id_type' in vdata:
            new_type = vdata.get('government_id_type')
            type_changed = (new_type != getattr(instance, 'government_id_type'))
            instance.government_id_type = new_type
            update_fields.append('government_id_type')

            # wipe secondary doc when not needed
            if new_type in ('DRIVER_LICENSE', 'AUS_PASSPORT', 'AGE_PROOF'):
                old_sec = getattr(instance, 'identity_secondary_file', None)
                if old_sec:
                    try: old_sec.delete(save=False)
                    except Exception: pass
                instance.identity_secondary_file = None
                update_fields.append('identity_secondary_file')
                sec_changed = True

            # clear stale meta if not provided
            if 'identity_meta' not in vdata:
                instance.identity_meta = {}
                update_fields.append('identity_meta')
                meta_changed = True

        # primary file
        if 'government_id' in vdata:
            new_file = vdata.get('government_id')
            old_file = getattr(instance, 'government_id', None)
            gov_id_changed = (_fname(new_file) != _fname(old_file))
            if new_file is None:
                if old_file:
                    try: old_file.delete(save=False)
                    except Exception: pass
                instance.government_id = None
                update_fields.append('government_id')
            else:
                if old_file and _fname(old_file) and _fname(old_file) != _fname(new_file):
                    try: old_file.delete(save=False)
                    except Exception: pass
                instance.government_id = new_file
                update_fields.append('government_id')

        # secondary file
        if 'identity_secondary_file' in vdata:
            new_sec = vdata.get('identity_secondary_file')
            old_sec = getattr(instance, 'identity_secondary_file', None)
            sec_changed = (_fname(new_sec) != _fname(old_sec)) or sec_changed
            if new_sec is None:
                if old_sec:
                    try: old_sec.delete(save=False)
                    except Exception: pass
                instance.identity_secondary_file = None
                update_fields.append('identity_secondary_file')
            else:
                if old_sec and _fname(old_sec) and _fname(old_sec) != _fname(new_sec):
                    try: old_sec.delete(save=False)
                    except Exception: pass
                instance.identity_secondary_file = new_sec
                update_fields.append('identity_secondary_file')

        # identity_meta normalisation per type
        if 'identity_meta' in vdata:
            incoming_meta = vdata.get('identity_meta') or {}
            meta = dict(incoming_meta)
            doc_type = getattr(instance, 'government_id_type')

            if doc_type == 'DRIVER_LICENSE':
                meta = {k: v for k, v in meta.items() if k in {'state','expiry'}}

            elif doc_type == 'VISA':
                meta = {k: v for k, v in meta.items() if k in {'visa_type_number','valid_to','passport_country','passport_expiry'}}

            elif doc_type == 'AUS_PASSPORT':
                meta = {k: v for k, v in meta.items() if k in {'expiry'}}
                meta['country'] = 'Australia'

            elif doc_type == 'OTHER_PASSPORT':
                meta = {k: v for k, v in meta.items() if k in {'country','expiry','visa_type_number','valid_to'}}

            elif doc_type == 'AGE_PROOF':
                meta = {k: v for k, v in meta.items() if k in {'state','expiry'}}

            if meta != (instance.identity_meta or {}):
                instance.identity_meta = meta
                update_fields.append('identity_meta')
                meta_changed = True

        # reset verification if any identity input changed
        if gov_id_changed or sec_changed or type_changed or meta_changed:
            instance.gov_id_verified = False
            instance.gov_id_verification_note = ""
            update_fields += ['gov_id_verified', 'gov_id_verification_note']

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # Validate on submit
        if submit:
            errors = {}
            doc_type = getattr(instance, 'government_id_type')
            meta_now = getattr(instance, 'identity_meta') or {}

            if not doc_type:
                errors['government_id_type'] = ['Select a document type.']
            if not getattr(instance, 'government_id', None):
                errors['government_id'] = ['This file is required.']

            if doc_type == 'DRIVER_LICENSE':
                if not meta_now.get('state'):  errors['identity_meta.state'] = ['Required.']
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']
            elif doc_type == 'VISA':
                if not meta_now.get('visa_type_number'):  errors['identity_meta.visa_type_number'] = ['Required.']
                if not meta_now.get('valid_to'):         errors['identity_meta.valid_to'] = ['Required.']
                if not getattr(instance, 'identity_secondary_file', None):
                    errors['identity_secondary_file'] = ['Overseas passport file is required with a Visa.']
                if not meta_now.get('passport_country'): errors['identity_meta.passport_country'] = ['Required.']
                if not meta_now.get('passport_expiry'):  errors['identity_meta.passport_expiry'] = ['Required.']
            elif doc_type == 'AUS_PASSPORT':
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']
            elif doc_type == 'OTHER_PASSPORT':
                if not meta_now.get('country'): errors['identity_meta.country'] = ['Required.']
                if not meta_now.get('expiry'):  errors['identity_meta.expiry'] = ['Required.']
                if not getattr(instance, 'identity_secondary_file', None):
                    errors['identity_secondary_file'] = ['Visa file is required with an Overseas passport.']
                if not meta_now.get('visa_type_number'): errors['identity_meta.visa_type_number'] = ['Required.']
                if not meta_now.get('valid_to'):         errors['identity_meta.valid_to'] = ['Required.']
            elif doc_type == 'AGE_PROOF':
                if not meta_now.get('state'):  errors['identity_meta.state'] = ['Required.']
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']

            if errors:
                raise serializers.ValidationError(errors)

            # schedule verification task if needed
            if instance.government_id and (gov_id_changed or type_changed or meta_changed or not instance.gov_id_verified):
                async_task(
                    'client_profile.tasks.verify_filefield_task',
                    instance._meta.model_name, instance.pk,
                    'government_id',
                    instance.user.first_name or '',
                    instance.user.last_name or '',
                    instance.user.email or '',
                    verification_field='gov_id_verified',
                    note_field='gov_id_verification_note',
                )
        return instance

    # ---------------- Regulatory TAB ----------------
    def _regulatory_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        """
        Keeps your current role/subrole logic and per-role docs,
        but runs per-field resets and schedules file verifications.
        """
        update_fields = []
        file_fields = [
            'ahpra_proof','hours_proof','certificate','university_id','cpr_certificate','s8_certificate'
        ]

        def _fname(f):
            return getattr(f, 'name', None) if f else None

        # role classification inputs
        for f in ['role_type','classification_level','student_year','intern_half']:
            if f in vdata:
                if getattr(instance, f) != vdata[f]:
                    setattr(instance, f, vdata[f])
                    update_fields.append(f)

        # Handle each file: replace/clear safely; reset its verified flag on change
        def handle_file(field):
            changed = False
            if field in vdata:
                new_file = vdata.get(field)  # may be file or None
                old_file = getattr(instance, field, None)
                changed = (_fname(new_file) != _fname(old_file))
                if new_file is None:
                    if old_file:
                        try: old_file.delete(save=False)
                        except Exception: pass
                    setattr(instance, field, None)
                    update_fields.append(field)
                else:
                    if old_file and _fname(old_file) and _fname(old_file) != _fname(new_file):
                        try: old_file.delete(save=False)
                        except Exception: pass
                    setattr(instance, field, new_file)
                    update_fields.append(field)

                # reset verification when changed
                if changed:
                    vflag = f"{field}_verified"
                    vnote = f"{field}_verification_note"
                    if hasattr(instance, vflag):
                        setattr(instance, vflag, False)
                        update_fields.append(vflag)
                    if hasattr(instance, vnote):
                        setattr(instance, vnote, "")
                        update_fields.append(vnote)
            return changed

        changed_map = {f: handle_file(f) for f in file_fields}

        if submit:
            instance.verified = False
            update_fields.append('verified')

            # Validate required per role
            req = self._required_docs_for_role(instance)
            errors = {}
            for field, _, _ in req:
                if not getattr(instance, field, None):
                    errors[field] = ['This file is required for the selected role.']
            if errors:
                raise serializers.ValidationError(errors)

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # schedule verification tasks for any provided file that changed or is not verified
        if submit:
            for field, changed in changed_map.items():
                vflag = f"{field}_verified"
                if getattr(instance, field, None) and (changed or not getattr(instance, vflag, False)):
                    async_task(
                        'client_profile.tasks.verify_filefield_task',
                        instance._meta.model_name, instance.pk,
                        field,
                        instance.user.first_name or '',
                        instance.user.last_name or '',
                        instance.user.email or '',
                        verification_field=f"{field}_verified",
                        note_field=f"{field}_verification_note",
                    )
        return instance

    # ---------------- Payment TAB ----------------
    def _payment_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        payment_fields = [
            'payment_preference','abn','gst_registered',
            'super_fund_name','super_usi','super_member_number',
            'abn_entity_confirmed',
        ]
        update_fields: list[str] = []
        pref_in = (vdata.get('payment_preference') or instance.payment_preference or '').upper()

        # regular writes
        for f in payment_fields:
            if f in vdata:
                setattr(instance, f, vdata[f])
                update_fields.append(f)

        # TFN
        if 'tfn_number' in vdata:
            instance.tfn_number = (vdata['tfn_number'] or '').strip()
            update_fields.append('tfn_number')

        # ABN changed -> reset
        abn_changed = ('abn' in vdata) and (vdata.get('abn') != getattr(instance, 'abn'))
        if abn_changed:
            instance.abn_verified = False
            instance.abn_entity_confirmed = False
            instance.abn_verification_note = ""
            update_fields += ['abn_verified','abn_entity_confirmed','abn_verification_note']

        # confirmation gate
        if 'abn_entity_confirmed' in vdata:
            confirmed = bool(vdata['abn_entity_confirmed'])
            if confirmed and instance.abn_entity_name:
                instance.abn_verified = True
                if not instance.abn_verification_note:
                    instance.abn_verification_note = 'User confirmed ABN entity details.'
                update_fields += ['abn_verified','abn_verification_note']
            else:
                if instance.abn_verified:
                    instance.abn_verified = False
                    update_fields.append('abn_verified')

        # optional sync gst_registered from ABR
        if 'gst_registered' not in vdata:
            if instance.abn_gst_registered is True and not instance.gst_registered:
                instance.gst_registered = True
                update_fields.append('gst_registered')

        # TFN path validation on submit
        if submit and (pref_in or instance.payment_preference):
            pref_effective = (pref_in or instance.payment_preference or '').upper()
            if pref_effective == 'TFN':
                errors = {}
                if not instance.tfn_number:
                    errors['tfn'] = ['TFN is required.']
                if not instance.super_fund_name:
                    errors['super_fund_name'] = ['Super fund name is required for TFN.']
                if not instance.super_usi:
                    errors['super_usi'] = ['USI is required for TFN.']
                if not instance.super_member_number:
                    errors['super_member_number'] = ['Member number is required for TFN.']
                if errors:
                    raise serializers.ValidationError(errors)

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # run ABN task on submit
        if submit:
            pref_effective = (pref_in or instance.payment_preference or '').upper()
            if pref_effective == 'ABN' and instance.abn:
                async_task(
                    'client_profile.tasks.verify_abn_task',
                    instance._meta.model_name, instance.pk,
                    instance.abn,
                    instance.user.first_name or '',
                    instance.user.last_name or '',
                    instance.user.email or '',
                    note_field='abn_verification_note',
                )
        return instance

    # ---------------- Referees TAB ----------------
    def _referees_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        from .utils import send_referee_emails
        update_fields = []

        def apply_ref(idx: int):
            prefix = f"referee{idx}_"
            locked = bool(getattr(instance, f"{prefix}confirmed", False))

            incoming = {
                'name': vdata.get(f"{prefix}name", getattr(instance, f"{prefix}name")),
                'relation': vdata.get(f"{prefix}relation", getattr(instance, f"{prefix}relation")),
                'email': clean_email(vdata.get(f"{prefix}email", getattr(instance, f"{prefix}email"))),
                'workplace': vdata.get(f"{prefix}workplace", getattr(instance, f"{prefix}workplace")),
            }
            if locked:
                return

            changed = False
            for key in ['name','relation','email','workplace']:
                field = f"{prefix}{key}"
                if field in vdata and getattr(instance, field) != incoming[key]:
                    setattr(instance, field, incoming[key])
                    update_fields.append(field)
                    changed = True

            if changed:
                for flag in ['confirmed','rejected']:
                    f = f"{prefix}{flag}"
                    if getattr(instance, f, False):
                        setattr(instance, f, False)
                        update_fields.append(f)
                last = f"{prefix}last_sent"
                if getattr(instance, last, None) is not None:
                    setattr(instance, last, None)
                    update_fields.append(last)

        apply_ref(1)
        apply_ref(2)

        if submit:
            errors = {}
            for idx in [1,2]:
                prefix = f"referee{idx}_"
                if not getattr(instance, f"{prefix}name"):       errors[prefix+'name'] = ['Required.']
                if not getattr(instance, f"{prefix}relation"):   errors[prefix+'relation'] = ['Required.']
                if not getattr(instance, f"{prefix}email"):      errors[prefix+'email'] = ['Required.']
                if not getattr(instance, f"{prefix}workplace"):  errors[prefix+'workplace'] = ['Required.']
            if errors:
                raise serializers.ValidationError(errors)
            if not instance.verified:
                instance.verified = False
                update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        if submit:
            send_referee_emails(instance, is_reminder=False)
        return instance

    # ---------------- Skills TAB ----------------
    def _skills_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        """
        Legacy-aligned Skills tab:
        - `skills`: list of codes (string or JSON array)
        - Per-skill certificate upload (must exist if the skill is selected)
        - `years_experience`: simple string bucket stored on the model
        """
        # 1) Parse skills array (accept JSON string or list)
        raw = self.initial_data.get("skills", vdata.get("skills", []))
        if isinstance(raw, str):
            try:
                skills = json.loads(raw)
            except Exception:
                raise serializers.ValidationError({"skills": "Must be a JSON array or list."})
        else:
            skills = list(raw or [])

        # 2) Years of experience (optional)
        yrs = self.initial_data.get("years_experience", vdata.get("years_experience", None))
        if yrs is not None:
            # store as plain string; keep legacy buckets (e.g. '', '0-1', '1-2', '2-3', '3-5', '5+')
            instance.years_experience = (yrs or "").strip()

        uploads = self._files_by_skill()                    # accepts both flat keys and skill_files[CODE]
        cert_map = dict(instance.skill_certificates or {})  # latest file per skill
        user_id = instance.user_id

        # 3) If a skill was unchecked, remove its stored certificate (unless keeping history)
        if not getattr(self, "KEEP_SKILL_HISTORY", False):
            removed = [code for code in list(cert_map.keys()) if code not in skills]
            for code in removed:
                old_path = (cert_map.get(code) or {}).get("path")
                if old_path:
                    try:
                        default_storage.delete(old_path)
                    except Exception:
                        pass
                cert_map.pop(code, None)

        # 4) Save any uploaded files for checked skills
        for code, f in uploads.items():
            if code in skills and f:
                # remember old path (if any)
                old_path = (cert_map.get(code) or {}).get("path")

                # save new file (keeps historical versions if you change _save_skill_file to do so)
                saved = self._save_skill_file(user_id, code, f)

                # delete old file unless keeping history
                if old_path and not getattr(self, "KEEP_SKILL_HISTORY", False):
                    try:
                        default_storage.delete(old_path)
                    except Exception:
                        pass

                # record new pointer
                cert_map[code] = {
                    "path": saved,
                    "uploaded_at": timezone.now().isoformat(),
                }

        # 5) Validation: every selected skill must have a certificate (existing or uploaded now)
        missing = [code for code in skills if code not in cert_map]
        if missing:
            raise serializers.ValidationError(
                {"skills": f"Certificate required for: {', '.join(missing)}"}
            )

        # 6) Persist changes
        instance.skills = skills
        instance.skill_certificates = cert_map

        # Save only the changed fields; include years_experience if we set it above
        update_fields = ["skills", "skill_certificates"]
        if yrs is not None:
            update_fields.append("years_experience")

        instance.save(update_fields=update_fields)
        return instance

    # ---------------- Profile TAB ----------------
    def _profile_tab(self, instance: OtherStaffOnboarding, vdata: dict, submit: bool):
        update_fields = []
        if 'short_bio' in vdata:
            instance.short_bio = vdata['short_bio']
            update_fields.append('short_bio')

        if 'resume' in vdata:
            new_file = vdata['resume']
            old_file = getattr(instance, 'resume', None)
            if new_file is None:
                if old_file:
                    old_file.delete(save=False)
                instance.resume = None
                update_fields.append('resume')
            else:
                if old_file:
                    try:
                        if getattr(old_file, 'name', None) != getattr(new_file, 'name', None):
                            old_file.delete(save=False)
                    except Exception:
                        pass
                instance.resume = new_file
                update_fields.append('resume')

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))
        return instance

    # ---------------- read-only summary for UI ----------------
    def get_skill_certificates(self, obj):
        data = []
        for code, meta in (obj.skill_certificates or {}).items():
            path = (meta or {}).get("path")
            if not path:
                continue
            try:
                url = default_storage.url(path)
            except Exception:
                url = None
            data.append({"skill_code": code, "path": path, "url": url, "uploaded_at": meta.get("uploaded_at")})
        return sorted(data, key=lambda r: r["skill_code"])

# helpers (reuse from your codebase if they already exist)
def q6(val):
    if val in (None, ""):
        return None
    try:
        return round(float(val), 6)
    except Exception:
        return None

def clean_email(s):
    return (s or "").strip().lower()

class ExplorerOnboardingV2Serializer(serializers.ModelSerializer):
    """
    V2 tab-aware serializer for Explorer.
    Tabs: basic, identity, interests, referees, profile.
    """

    # user pass-through
    username     = serializers.CharField(source='user.username',   required=False, allow_blank=True)
    first_name   = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name    = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    phone_number = serializers.CharField(source='user.mobile_number', required=False, allow_blank=True, allow_null=True)

    latitude  = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)

    # write-only control flags
    tab = serializers.CharField(write_only=True, required=False)
    submitted_for_verification = serializers.BooleanField(write_only=True, required=False)

    # computed
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = ExplorerOnboarding
        fields = [
            # ---------- BASIC ----------
            'username','first_name','last_name','phone_number',
            'role_type',
            'street_address','suburb','state','postcode','google_place_id','latitude','longitude',

            # ---------- IDENTITY ----------
            'government_id','identity_secondary_file','government_id_type','identity_meta',
            'gov_id_verified','gov_id_verification_note',

            # ---------- INTERESTS ----------
            'interests',   # JSON (array of codes, e.g. ["SHADOWING","VOLUNTEERING","PLACEMENT","JUNIOR_ASSISTANT"])

            # ---------- REFEREES ----------
            'referee1_name','referee1_relation','referee1_email','referee1_workplace',
            'referee1_confirmed','referee1_rejected','referee1_last_sent',
            'referee2_name','referee2_relation','referee2_email','referee2_workplace',
            'referee2_confirmed','referee2_rejected','referee2_last_sent',

            # ---------- PROFILE ----------
            'short_bio','resume',

            'verified','progress_percent',
            'tab','submitted_for_verification',
        ]
        extra_kwargs = {
            # user names optional
            'username': {'required': False, 'allow_blank': True},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},

            # basic
            'role_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'street_address':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'suburb':          {'required': False, 'allow_blank': True, 'allow_null': True},
            'state':           {'required': False, 'allow_blank': True, 'allow_null': True},
            'postcode':        {'required': False, 'allow_blank': True, 'allow_null': True},
            'google_place_id': {'required': False, 'allow_blank': True, 'allow_null': True},
            'latitude':        {'required': False, 'allow_null': True},
            'longitude':       {'required': False, 'allow_null': True},

            # identity (tab decides requiredness)
            'government_id': {'required': False, 'allow_null': True},
            'government_id_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'identity_secondary_file': {'required': False, 'allow_null': True},
            'identity_meta': {'required': False},
            'gov_id_verified': {'read_only': True},
            'gov_id_verification_note': {'read_only': True},

            # interests
            'interests': {'required': False},

            # referees
            'referee1_name':       {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_relation':   {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email':      {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_workplace':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_name':       {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_relation':   {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email':      {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_workplace':  {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_confirmed':  {'read_only': True},
            'referee1_rejected':   {'read_only': True},
            'referee1_last_sent':  {'read_only': True},
            'referee2_confirmed':  {'read_only': True},
            'referee2_rejected':   {'read_only': True},
            'referee2_last_sent':  {'read_only': True},

            # profile
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume':    {'required': False, 'allow_null': True},

            'verified': {'read_only': True},
            'progress_percent': {'read_only': True},
        }

    # ---------------- progress gate ----------------
    def get_progress_percent(self, obj):
        user = getattr(obj, 'user', None)

        def _filled_str(x):
            return bool(x and str(x).strip())

        checks = [
            bool(getattr(user, 'username', None)),
            bool(getattr(user, 'first_name', None)),
            bool(getattr(user, 'last_name', None)),
            bool(getattr(user, 'mobile_number', None)),
            bool(obj.gov_id_verified),
            bool(getattr(obj, 'referee1_confirmed', False)),
            bool(getattr(obj, 'referee2_confirmed', False)),
        ]

        # Address as one unit
        addr_ok = all([
            _filled_str(getattr(obj, 'street_address', None)),
            _filled_str(getattr(obj, 'suburb', None)),
            _filled_str(getattr(obj, 'state', None)),
            _filled_str(getattr(obj, 'postcode', None)),
        ])
        checks.append(addr_ok)

        # Interests present?
        interests_ok = bool(getattr(obj, 'interests', None))
        checks.append(interests_ok)

        # Profile
        checks.append(bool(getattr(obj, 'resume', None)))
        checks.append(_filled_str(getattr(obj, 'short_bio', None)))

        # Final flip
        phone_ok = bool(getattr(user, 'is_mobile_verified', False))
        gate_ok = (
            bool(getattr(obj, 'referee1_confirmed', False)) and
            bool(getattr(obj, 'referee2_confirmed', False)) and
            bool(getattr(obj, 'gov_id_verified', False))    and
            phone_ok
        )
        if gate_ok and not bool(getattr(obj, 'verified', False)):
            try:
                obj.verified = True
                obj.save(update_fields=['verified'])
            except Exception:
                pass

        filled = sum(1 for x in checks if x)
        total = len(checks) or 1
        return int(100 * filled / total)

    # ---------------- update router ----------------
    def update(self, instance, validated_data):
        tab = (self.initial_data.get('tab') or 'basic').strip().lower()
        submit = bool(self.initial_data.get('submitted_for_verification'))

        # first-time submission notify (Basic only)
        first_submit = submit and (tab == 'basic') and not bool(getattr(instance, 'submitted_for_verification', False))
        if first_submit:
            instance.submitted_for_verification = True
            instance.save(update_fields=['submitted_for_verification'])
            from .utils import notify_superuser_on_onboarding
            try:
                notify_superuser_on_onboarding(instance)
            except Exception:
                pass

        if tab == 'basic':
            return self._basic_tab(instance, validated_data, submit)
        if tab == 'identity':
            return self._identity_tab(instance, validated_data, submit)
        if tab == 'interests':
            return self._interests_tab(instance, validated_data, submit)
        if tab == 'referees':
            return self._referees_tab(instance, validated_data, submit)
        if tab == 'profile':
            return self._profile_tab(instance, validated_data, submit)

        return super().update(instance, validated_data)

    # ---------------- BASIC TAB ----------------
    def _basic_tab(self, instance: ExplorerOnboarding, vdata: dict, submit: bool):
        # nested user data
        user_data = vdata.pop('user', {})
        if user_data:
            changed_user_fields = []
            for k in ('username', 'first_name', 'last_name', 'mobile_number'):
                if k in user_data:
                    setattr(instance.user, k, user_data[k])
                    changed_user_fields.append(k)
            if changed_user_fields:
                instance.user.save(update_fields=changed_user_fields)

        update_fields = []

        # role + address
        direct_fields = [
            'role_type',
            'street_address','suburb','state','postcode','google_place_id',
        ]
        for f in direct_fields:
            if f in vdata:
                setattr(instance, f, vdata[f])
                update_fields.append(f)

        # lat/lon rounding
        if 'latitude' in vdata:
            instance.latitude = q6(vdata.get('latitude'))
            update_fields.append('latitude')
        if 'longitude' in vdata:
            instance.longitude = q6(vdata.get('longitude'))
            update_fields.append('longitude')

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))
        return instance

    # ---------------- Identity TAB (identical behavior) ----------------
    def _identity_tab(self, instance: ExplorerOnboarding, vdata: dict, submit: bool):
        update_fields = []

        def _fname(f):
            return getattr(f, 'name', None) if f else None

        type_changed = False
        gov_id_changed = False
        sec_changed = False
        meta_changed = False

        # type
        if 'government_id_type' in vdata:
            new_type = vdata.get('government_id_type')
            type_changed = (new_type != getattr(instance, 'government_id_type'))
            instance.government_id_type = new_type
            update_fields.append('government_id_type')

            # clear secondary when not needed
            if new_type in ('DRIVER_LICENSE', 'AUS_PASSPORT', 'AGE_PROOF'):
                old_sec = getattr(instance, 'identity_secondary_file', None)
                if old_sec:
                    try: old_sec.delete(save=False)
                    except Exception: pass
                instance.identity_secondary_file = None
                update_fields.append('identity_secondary_file')
                sec_changed = True

            # clear stale meta if not provided
            if 'identity_meta' not in vdata:
                instance.identity_meta = {}
                update_fields.append('identity_meta')
                meta_changed = True

        # primary file
        if 'government_id' in vdata:
            new_file = vdata.get('government_id')
            old_file = getattr(instance, 'government_id', None)
            gov_id_changed = (_fname(new_file) != _fname(old_file))
            if new_file is None:
                if old_file:
                    try: old_file.delete(save=False)
                    except Exception: pass
                instance.government_id = None
                update_fields.append('government_id')
            else:
                if old_file and _fname(old_file) and _fname(old_file) != _fname(new_file):
                    try: old_file.delete(save=False)
                    except Exception: pass
                instance.government_id = new_file
                update_fields.append('government_id')

        # secondary file
        if 'identity_secondary_file' in vdata:
            new_sec = vdata.get('identity_secondary_file')
            old_sec = getattr(instance, 'identity_secondary_file', None)
            sec_changed = (_fname(new_sec) != _fname(old_sec)) or sec_changed
            if new_sec is None:
                if old_sec:
                    try: old_sec.delete(save=False)
                    except Exception: pass
                instance.identity_secondary_file = None
                update_fields.append('identity_secondary_file')
            else:
                if old_sec and _fname(old_sec) and _fname(old_sec) != _fname(new_sec):
                    try: old_sec.delete(save=False)
                    except Exception: pass
                instance.identity_secondary_file = new_sec
                update_fields.append('identity_secondary_file')

        # meta normalization
        if 'identity_meta' in vdata:
            incoming = vdata.get('identity_meta') or {}
            meta = dict(incoming)
            doc_type = getattr(instance, 'government_id_type')

            if doc_type == 'DRIVER_LICENSE':
                meta = {k: v for k, v in meta.items() if k in {'state','expiry'}}
            elif doc_type == 'VISA':
                meta = {k: v for k, v in meta.items() if k in {'visa_type_number','valid_to','passport_country','passport_expiry'}}
            elif doc_type == 'AUS_PASSPORT':
                meta = {k: v for k, v in meta.items() if k in {'expiry'}}
                meta['country'] = 'Australia'
            elif doc_type == 'OTHER_PASSPORT':
                meta = {k: v for k, v in meta.items() if k in {'country','expiry','visa_type_number','valid_to'}}
            elif doc_type == 'AGE_PROOF':
                meta = {k: v for k, v in meta.items() if k in {'state','expiry'}}

            if meta != (instance.identity_meta or {}):
                instance.identity_meta = meta
                update_fields.append('identity_meta')
                meta_changed = True

        # reset verification
        if gov_id_changed or sec_changed or type_changed or meta_changed:
            instance.gov_id_verified = False
            instance.gov_id_verification_note = ""
            update_fields += ['gov_id_verified','gov_id_verification_note']

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # validate + schedule on submit
        if submit:
            errors = {}
            doc_type = getattr(instance, 'government_id_type')
            meta_now = getattr(instance, 'identity_meta') or {}

            if not doc_type:
                errors['government_id_type'] = ['Select a document type.']
            if not getattr(instance, 'government_id', None):
                errors['government_id'] = ['This file is required.']

            if doc_type == 'DRIVER_LICENSE':
                if not meta_now.get('state'):  errors['identity_meta.state'] = ['Required.']
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']
            elif doc_type == 'VISA':
                if not meta_now.get('visa_type_number'):  errors['identity_meta.visa_type_number'] = ['Required.']
                if not meta_now.get('valid_to'):         errors['identity_meta.valid_to'] = ['Required.']
                if not getattr(instance, 'identity_secondary_file', None):
                    errors['identity_secondary_file'] = ['Overseas passport file is required with a Visa.']
                if not meta_now.get('passport_country'): errors['identity_meta.passport_country'] = ['Required.']
                if not meta_now.get('passport_expiry'):  errors['identity_meta.passport_expiry'] = ['Required.']
            elif doc_type == 'AUS_PASSPORT':
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']
            elif doc_type == 'OTHER_PASSPORT':
                if not meta_now.get('country'): errors['identity_meta.country'] = ['Required.']
                if not meta_now.get('expiry'):  errors['identity_meta.expiry'] = ['Required.']
                if not getattr(instance, 'identity_secondary_file', None):
                    errors['identity_secondary_file'] = ['Visa file is required with an Overseas passport.']
                if not meta_now.get('visa_type_number'): errors['identity_meta.visa_type_number'] = ['Required.']
                if not meta_now.get('valid_to'):         errors['identity_meta.valid_to'] = ['Required.']
            elif doc_type == 'AGE_PROOF':
                if not meta_now.get('state'):  errors['identity_meta.state'] = ['Required.']
                if not meta_now.get('expiry'): errors['identity_meta.expiry'] = ['Required.']

            if errors:
                raise serializers.ValidationError(errors)

            # schedule verification task
            if instance.government_id and (gov_id_changed or type_changed or meta_changed or not instance.gov_id_verified):
                from django_q.tasks import async_task
                async_task(
                    'client_profile.tasks.verify_filefield_task',
                    instance._meta.model_name, instance.pk,
                    'government_id',
                    instance.user.first_name or '',
                    instance.user.last_name or '',
                    instance.user.email or '',
                    verification_field='gov_id_verified',
                    note_field='gov_id_verification_note',
                )
        return instance

    # ---------------- Interests TAB ----------------
    def _interests_tab(self, instance: ExplorerOnboarding, vdata: dict, submit: bool):
        """
        Accepts list or JSON string.
        Allowed (suggested) values: SHADOWING, VOLUNTEERING, PLACEMENT, JUNIOR_ASSISTANT
        """
        raw = self.initial_data.get('interests', vdata.get('interests'))
        if raw is None:
            return instance

        if isinstance(raw, str):
            try:
                vals = json.loads(raw)
            except Exception:
                raise serializers.ValidationError({"interests": "Must be a JSON array or list."})
        else:
            vals = list(raw or [])

        instance.interests = vals
        if submit:
            instance.verified = False
            instance.save(update_fields=['interests','verified'])
        else:
            instance.save(update_fields=['interests'])
        return instance

    # ---------------- Referees TAB ----------------
    def _referees_tab(self, instance: ExplorerOnboarding, vdata: dict, submit: bool):
        from .utils import send_referee_emails
        update_fields = []

        def apply_ref(idx: int):
            prefix = f"referee{idx}_"
            locked = bool(getattr(instance, f"{prefix}confirmed", False))
            incoming = {
                'name': vdata.get(f"{prefix}name", getattr(instance, f"{prefix}name")),
                'relation': vdata.get(f"{prefix}relation", getattr(instance, f"{prefix}relation")),
                'email': clean_email(vdata.get(f"{prefix}email", getattr(instance, f"{prefix}email"))),
                'workplace': vdata.get(f"{prefix}workplace", getattr(instance, f"{prefix}workplace")),
            }
            if locked:
                return
            changed = False
            for key in ['name','relation','email','workplace']:
                field = f"{prefix}{key}"
                if field in vdata and getattr(instance, field) != incoming[key]:
                    setattr(instance, field, incoming[key])
                    update_fields.append(field)
                    changed = True
            if changed:
                for flag in ['confirmed','rejected']:
                    f = f"{prefix}{flag}"
                    if getattr(instance, f, False):
                        setattr(instance, f, False)
                        update_fields.append(f)
                last = f"{prefix}last_sent"
                if getattr(instance, last, None) is not None:
                    setattr(instance, last, None)
                    update_fields.append(last)

        apply_ref(1)
        apply_ref(2)

        if submit:
            errors = {}
            for idx in [1,2]:
                prefix = f"referee{idx}_"
                if not getattr(instance, f"{prefix}name"):       errors[prefix+'name'] = ['Required.']
                if not getattr(instance, f"{prefix}relation"):   errors[prefix+'relation'] = ['Required.']
                if not getattr(instance, f"{prefix}email"):      errors[prefix+'email'] = ['Required.']
                if not getattr(instance, f"{prefix}workplace"):  errors[prefix+'workplace'] = ['Required.']
            if errors:
                raise serializers.ValidationError(errors)
            if not instance.verified:
                instance.verified = False
                update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        if submit:
            send_referee_emails(instance, is_reminder=False)
        return instance

    # ---------------- Profile TAB ----------------
    def _profile_tab(self, instance: ExplorerOnboarding, vdata: dict, submit: bool):
        update_fields = []
        if 'short_bio' in vdata:
            instance.short_bio = vdata['short_bio']
            update_fields.append('short_bio')

        if 'resume' in vdata:
            new_file = vdata['resume']
            old_file = getattr(instance, 'resume', None)
            if new_file is None:
                if old_file:
                    old_file.delete(save=False)
                instance.resume = None
                update_fields.append('resume')
            else:
                if old_file:
                    try:
                        if getattr(old_file, 'name', None) != getattr(new_file, 'name', None):
                            old_file.delete(save=False)
                    except Exception:
                        pass
                instance.resume = new_file
                update_fields.append('resume')

        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))
        return instance

# === Dashboards ===
class ShiftSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    pharmacy_name = serializers.CharField()
    date = serializers.DateField()

class OwnerDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    upcoming_shifts_count = serializers.IntegerField()
    confirmed_shifts_count = serializers.IntegerField()
    shifts = ShiftSummarySerializer(many=True)
    bills_summary = serializers.DictField()

class PharmacistDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    upcoming_shifts_count = serializers.IntegerField()
    confirmed_shifts_count = serializers.IntegerField()
    community_shifts_count = serializers.IntegerField()
    shifts = ShiftSummarySerializer(many=True)
    community_shifts = ShiftSummarySerializer(many=True)
    bills_summary = serializers.DictField()

class OtherStaffDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    upcoming_shifts_count = serializers.IntegerField()
    confirmed_shifts_count = serializers.IntegerField()
    community_shifts_count = serializers.IntegerField()
    shifts = ShiftSummarySerializer(many=True)
    community_shifts = ShiftSummarySerializer(many=True)
    bills_summary = serializers.DictField()

class ExplorerDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()

class PharmacySerializer(RemoveOldFilesMixin, serializers.ModelSerializer):
    # explicitly declare your FileFields so DRF will return the URLs
    methadone_s8_protocols = serializers.FileField(
        use_url=True, allow_null=True, required=False
    )
    qld_sump_docs = serializers.FileField(
        use_url=True, allow_null=True, required=False
    )
    sops = serializers.FileField(
        use_url=True, allow_null=True, required=False
    )
    induction_guides = serializers.FileField(
        use_url=True, allow_null=True, required=False
    )
    has_chain = serializers.SerializerMethodField()
    claimed   = serializers.SerializerMethodField()
    claim_status = serializers.SerializerMethodField()
    claim_request_id = serializers.SerializerMethodField()
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    file_fields = [
        'methadone_s8_protocols',
        'qld_sump_docs',
        'sops',
        'induction_guides',
    ]
    abn = serializers.CharField(required=True, allow_blank=False)

    class Meta:
        model = Pharmacy

        fields = [
            "id",
            "name",
            "email",
            "street_address",
            "suburb",
            "postcode",
            "google_place_id",
            "latitude",
            "longitude",
            "state",
            "owner",
            "organization",
            "verified",
            "abn",
            # "asic_number",
            # your file fields:
            "methadone_s8_protocols",
            "qld_sump_docs",
            "sops",
            "induction_guides",
            # hours:
            "weekdays_start",
            "weekdays_end",
            "saturdays_start",
            "saturdays_end",
            "sundays_start",
            "sundays_end",
            "public_holidays_start",
            "public_holidays_end",
            # arrays:
            "employment_types",
            "roles_needed",
            # rates & about:
            "default_rate_type",
            "default_fixed_rate",
            "about",

            'has_chain',
            'claimed',
            'claim_status',
            'claim_request_id',
        ]

        read_only_fields = ["owner", "organization", "verified"]

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_has_chain(self, obj) -> bool:
        if not obj.owner:
            return False
        return Chain.objects.filter(owner=obj.owner, pharmacies=obj).exists()



    @extend_schema_field(OpenApiTypes.BOOL)
    def get_claimed(self, obj) -> bool:
        if obj.organization_id:
            return True
        return obj.claims.filter(status__in=["PENDING", "ACCEPTED"]).exists()

    def _get_active_claim(self, obj):
        cached = getattr(obj, "_active_pharmacy_claim", None)
        if cached is not None:
            return cached
        claim = obj.claims.filter(status__in=["PENDING", "ACCEPTED"]).order_by('-created_at').first()
        setattr(obj, "_active_pharmacy_claim", claim)
        return claim

    def get_claim_status(self, obj):
        claim = self._get_active_claim(obj)
        return claim.status if claim else None

    def get_claim_request_id(self, obj):
        claim = self._get_active_claim(obj)
        return claim.id if claim else None

    def validate_abn(self, value: str) -> str:
        digits = ''.join(ch for ch in value if ch.isdigit())
        if len(digits) != 11:
            raise serializers.ValidationError("ABN must be 11 digits.")
        # store normalized (digits only)
        return digits

    def validate_state(self, value):
        if not value:
            return value
        v = value.strip()
        long_to_short = {
            "NEW SOUTH WALES": "NSW",
            "QUEENSLAND": "QLD",
            "VICTORIA": "VIC",
            "SOUTH AUSTRALIA": "SA",
            "WESTERN AUSTRALIA": "WA",
            "TASMANIA": "TAS",
            "AUSTRALIAN CAPITAL TERRITORY": "ACT",
            "NORTHERN TERRITORY": "NT",
        }
        upper = v.upper()
        if upper in long_to_short:
            return long_to_short[upper]
        allowed = {"QLD","NSW","VIC","SA","WA","TAS","ACT","NT"}
        if upper not in allowed:
            raise serializers.ValidationError("Invalid Australian state/territory.")
        return upper


class PharmacyClaimSerializer(serializers.ModelSerializer):
    pharmacy = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()
    requested_by_user = UserProfileSerializer(source='requested_by', read_only=True)
    responded_by_user = UserProfileSerializer(source='responded_by', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_respond = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyClaim
        fields = [
            'id',
            'pharmacy',
            'organization',
            'status',
            'status_display',
            'message',
            'response_message',
            'requested_by',
            'requested_by_user',
            'responded_by',
            'responded_by_user',
            'responded_at',
            'can_respond',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'pharmacy',
            'organization',
            'requested_by_user',
            'responded_by_user',
            'responded_at',
            'created_at',
            'updated_at',
            'status_display',
            'requested_by',
            'responded_by',
            'can_respond',
        ]

    def get_pharmacy(self, obj):
        pharmacy = obj.pharmacy
        owner = getattr(pharmacy, "owner", None)
        owner_user = getattr(owner, "user", None)
        owner_payload = None
        if owner_user:
            owner_payload = {
                "id": owner.id,
                "user_id": owner_user.id,
                "email": owner_user.email,
                "first_name": owner_user.first_name,
                "last_name": owner_user.last_name,
            }
        return {
            "id": pharmacy.id,
            "name": pharmacy.name,
            "email": pharmacy.email,
            "organization_id": pharmacy.organization_id,
            "owner": owner_payload,
        }

    def get_organization(self, obj):
        org = obj.organization
        return {"id": org.id, "name": org.name}

    def get_can_respond(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return False
        user = request.user
        if not user or not user.is_authenticated:
            return False
        owner = getattr(obj.pharmacy, "owner", None)
        owner_user = getattr(owner, "user", None)
        return owner_user and owner_user.id == user.id and obj.status == PharmacyClaim.Status.PENDING


class PharmacyClaimCreateSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(required=False)
    pharmacy_email = serializers.EmailField(required=False)
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("pharmacy_id") and not attrs.get("pharmacy_email"):
            raise serializers.ValidationError("Provide either pharmacy_id or pharmacy_email.")
        return attrs

class ChainSerializer(RemoveOldFilesMixin, serializers.ModelSerializer):
    file_fields = ['logo']
    # nested readout of pharmacies
    pharmacies = PharmacySerializer(many=True, read_only=True)
    # write-only field to set pharmacies by ID list
    pharmacy_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=Pharmacy.objects.all(),
        source='pharmacies'
    )

    class Meta:
        model = Chain
        fields = [
            'id', 'owner', 'organization', 'name', 'logo',
            'subscription_plan','primary_contact_email',
            'is_active','created_at','updated_at',
            'pharmacies','pharmacy_ids'
        ]
        read_only_fields = ['owner','organization','created_at','updated_at', 'is_active']

MAX_ACTIVE_PHARMACY_MEMBERSHIPS = 3


def _count_active_memberships(user, exclude_membership_id=None):
    if not user:
        return 0
    qs = Membership.objects.filter(user=user, is_active=True)
    if exclude_membership_id:
        qs = qs.exclude(pk=exclude_membership_id)
    return qs.count()

ROLE_REQUIRED_USER_ROLE = {
    "PHARMACIST": "PHARMACIST",
    "INTERN": "OTHER_STAFF",
    "STUDENT": "OTHER_STAFF",
    "TECHNICIAN": "OTHER_STAFF",
    "ASSISTANT": "OTHER_STAFF",
}


def required_user_role_for_membership(role):
    if not role:
        return None
    return ROLE_REQUIRED_USER_ROLE.get(role)


class MembershipSerializer(serializers.ModelSerializer):
    user_details = UserProfileSerializer(source='user', read_only=True)
    invited_by_details = UserProfileSerializer(source='invited_by', read_only=True)
    pharmacy_detail = PharmacySerializer(source='pharmacy', read_only=True)
    is_pharmacy_owner = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = [
            'id', 'user', 'user_details', 'pharmacy', 'pharmacy_detail', 'invited_by', 'invited_by_details',
            'invited_name', 'role', 'employment_type', 'is_active', 'created_at', 'updated_at',
            # All classification fields are included and will be handled automatically
            'pharmacist_award_level',
            'otherstaff_classification_level',
            'intern_half',
            'student_year',
            'staff_category',
            'is_pharmacy_owner',
        ]
        read_only_fields = [
            'invited_by', 'invited_by_details', 'created_at', 'updated_at', 'is_pharmacy_owner',
        ]

    # No 'create' method needed. The default ModelSerializer.create() works perfectly
    # because all the classification fields are listed in Meta.fields. It will
    # create the new Membership object and save all provided fields in one step.


    def validate(self, attrs):
        """
        Validate and keep Membership data consistent:
        - Prevent assigning a role that conflicts with user's onboarding profile.
        - Enforce maximum active memberships per user.
        - Default employment_type for Pharmacy Admin if missing.
        - Clear irrelevant classification fields when role changes.
        """

        user = attrs.get('user', getattr(self.instance, 'user', None))
        role = attrs.get('role', getattr(self.instance, 'role', None))
        employment_type = attrs.get('employment_type', getattr(self.instance, 'employment_type', None))

        if role == 'PHARMACY_ADMIN':
            raise serializers.ValidationError({
                'role': 'Use the pharmacy admin management endpoints to assign admin roles.'
            })

        # --- (1) Enforce active membership limit ---
        if user:
            if self.instance:
                will_be_active = attrs.get('is_active', self.instance.is_active)
                if will_be_active and not self.instance.is_active:
                    current_active = _count_active_memberships(user, exclude_membership_id=self.instance.pk)
                    if current_active >= MAX_ACTIVE_PHARMACY_MEMBERSHIPS:
                        raise serializers.ValidationError({
                            'is_active': f'User already belongs to {MAX_ACTIVE_PHARMACY_MEMBERSHIPS} pharmacies.'
                        })
            else:
                if _count_active_memberships(user) >= MAX_ACTIVE_PHARMACY_MEMBERSHIPS:
                    raise serializers.ValidationError({
                        'user': f'User already belongs to {MAX_ACTIVE_PHARMACY_MEMBERSHIPS} pharmacies.'
                    })

        # --- (2) Enforce role consistency with user onboarding ---
        if user:
            pharmacist_onboard = getattr(user, 'pharmacistonboarding', None)
            otherstaff_onboard = getattr(user, 'otherstaffonboarding', None)
            explorer_onboard = getattr(user, 'exploreronboarding', None)

            # Pharmacist accounts
            if pharmacist_onboard and role not in ['PHARMACIST']:
                raise serializers.ValidationError({
                    'role': 'This user is a Pharmacist and can only be assigned as PHARMACIST.'
                })

            # Other staff (interns, assistants, etc.)
            if otherstaff_onboard:
                onboard_role = otherstaff_onboard.role_type
                if onboard_role == 'INTERN' and role != 'INTERN':
                    raise serializers.ValidationError({
                        'role': 'This user is onboarded as an Intern and cannot be invited as another role.'
                    })
                elif onboard_role == 'TECHNICIAN' and role != 'TECHNICIAN':
                    raise serializers.ValidationError({
                        'role': 'This user is onboarded as a Technician and cannot be invited as another role.'
                    })
                elif onboard_role == 'ASSISTANT' and role != 'ASSISTANT':
                    raise serializers.ValidationError({
                        'role': 'This user is onboarded as an Assistant and cannot be invited as another role.'
                    })

            # Explorer users
            if explorer_onboard:
                raise serializers.ValidationError({
                    'role': 'Explorer users cannot be added to pharmacies.'
                })

        # --- (3) Enforce user-role mapping if defined globally ---
        required_user_role = required_user_role_for_membership(role)
        user_role = getattr(user, 'role', None) if user else None
        if required_user_role and user_role and user_role != required_user_role:
            role_label = dict(Membership.ROLE_CHOICES).get(role, role)
            required_label = dict(User.ROLE_CHOICES).get(required_user_role, required_user_role)
            actual_label = dict(User.ROLE_CHOICES).get(user_role, user_role)
            identifier = getattr(user, 'email', getattr(user, 'username', 'This user'))
            raise serializers.ValidationError({
                'role': (
                    f'{identifier} is registered as {actual_label} and cannot be assigned the {role_label} role. '
                    f'Ask them to complete the {required_label} onboarding first.'
                )
            })

        # --- (4) Default employment type for Pharmacy Admin ---
        # --- (5) Role-based cleanup of classification fields ---
        def clear(*fields):
            for f in fields:
                if f in attrs:
                    attrs[f] = None

        if role == 'PHARMACIST':
            clear('otherstaff_classification_level', 'intern_half', 'student_year')
        elif role in ('ASSISTANT', 'TECHNICIAN'):
            clear('pharmacist_award_level', 'intern_half', 'student_year')
        elif role == 'INTERN':
            clear('pharmacist_award_level', 'otherstaff_classification_level', 'student_year')
        elif role == 'STUDENT':
            clear('pharmacist_award_level', 'otherstaff_classification_level', 'intern_half')

        return attrs

    def get_is_pharmacy_owner(self, obj):
        owner = getattr(obj.pharmacy, "owner", None)
        owner_user_id = getattr(owner, "user_id", None) if owner else None
        return owner_user_id == obj.user_id

    def update(self, instance, validated_data):
        """
        This override is only needed to add one piece of custom logic: if the user's role
        is changing, we want to clear out the old, irrelevant classification level.
        """
        # Check if the role is being changed to something different.
        if 'role' in validated_data and instance.role != validated_data['role']:
            # If so, reset all classification fields to None.
            # This prevents keeping old data (e.g., a pharmacist_award_level for a user now assigned as a STUDENT).
            instance.pharmacist_award_level = None
            instance.otherstaff_classification_level = None
            instance.intern_half = None
            instance.student_year = None

        # After our custom logic, we let the default .update() method do the rest.
        # It will efficiently update all fields from validated_data in a single database operation.
        return super().update(instance, validated_data)

class MembershipInviteLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipInviteLink
        fields = ['id', 'pharmacy', 'created_by', 'category', 'token', 'expires_at', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_by', 'token', 'created_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

class MembershipApplicationSerializer(serializers.ModelSerializer):
    invite_link = serializers.PrimaryKeyRelatedField(
    queryset=MembershipInviteLink.objects.all(),
    write_only=True
    )
    email = serializers.EmailField(required=True, allow_blank=False)

    
    pharmacy_name = serializers.CharField(source='pharmacy.name', read_only=True)

    class Meta:
        model = MembershipApplication
        fields = [
            'id', 'invite_link', 'pharmacy', 'pharmacy_name', 'category',
            'role', 'first_name', 'last_name', 'mobile_number',
            'pharmacist_award_level', 'otherstaff_classification_level',
            'intern_half', 'student_year', 'email',
            'submitted_by', 'status', 'submitted_at', 'decided_at', 'decided_by'
        ]
        read_only_fields = [
            'id', 'pharmacy', 'pharmacy_name', 'category',
            'submitted_by', 'status', 'submitted_at', 'decided_at', 'decided_by'
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['submitted_by'] = request.user
        # Freeze category from the link at submission time
        link = validated_data['invite_link']
        validated_data['category'] = link.category
        validated_data['pharmacy'] = link.pharmacy
        return super().create(validated_data)


class PharmacyAdminSerializer(serializers.ModelSerializer):
    user_details = UserProfileSerializer(source='user', read_only=True)
    pharmacy_detail = PharmacySerializer(source='pharmacy', read_only=True)
    capabilities = serializers.SerializerMethodField()
    can_remove = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyAdmin
        fields = [
            "id",
            "user",
            "user_details",
            "pharmacy",
            "pharmacy_detail",
            "membership",
            "admin_level",
            "staff_role",
            "job_title",
            "is_active",
            "capabilities",
            "can_remove",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "capabilities",
            "can_remove",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        user = attrs.get("user", getattr(self.instance, "user", None))
        pharmacy = attrs.get("pharmacy", getattr(self.instance, "pharmacy", None))
        admin_level = attrs.get("admin_level", getattr(self.instance, "admin_level", None))

        if not user or not pharmacy:
            raise serializers.ValidationError("user and pharmacy are required.")

        existing = PharmacyAdmin.objects.filter(
            user=user,
            pharmacy=pharmacy,
        )
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("This user is already an admin for the selected pharmacy.")

        owner_user_id = getattr(getattr(pharmacy, "owner", None), "user_id", None)
        if owner_user_id and owner_user_id == getattr(user, "id", None):
            if admin_level != PharmacyAdmin.AdminLevel.OWNER:
                raise serializers.ValidationError({
                    "admin_level": "Pharmacy owners must remain OWNER admin level."
                })
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data.setdefault("created_by", request.user)
        return super().create(validated_data)

    def get_capabilities(self, obj) -> list[str]:
        return sorted(list(obj.capabilities))

    def get_can_remove(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.can_be_removed_by(request.user)


# === Shifts ===
class ShiftSlotSerializer(serializers.ModelSerializer):
    recurring_days = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        required=False,
        allow_empty=True
    )
    recurring_end_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = ShiftSlot
        fields = [
            'id', 'date', 'start_time', 'end_time',
            'is_recurring', 'recurring_days', 'recurring_end_date',
        ]

class ShiftSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    slots = ShiftSlotSerializer(many=True)
    interested_users_count = serializers.IntegerField(read_only=True)
    pharmacy = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Shift._meta.get_field('pharmacy').related_model.objects.all()
    )
    # read‐only nested for listing
    pharmacy_detail = PharmacySerializer(source='pharmacy', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    # for multi-slot shifts
    slot_assignments = serializers.SerializerMethodField()


    # fixed_rate = serializers.DecimalField(max_digits=6, decimal_places=2)
    owner_adjusted_rate = serializers.DecimalField(max_digits=6,decimal_places=2,required=False,allow_null=True)

    allowed_escalation_levels = serializers.SerializerMethodField()
    is_single_user = serializers.BooleanField(source='single_user_only', read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id', 'created_by','created_at', 'pharmacy',  'pharmacy_detail','role_needed', 'employment_type', 'visibility',
            'escalation_level', 'escalate_to_owner_chain', 'escalate_to_org_chain', 'escalate_to_platform',
            'must_have', 'nice_to_have', 'rate_type', 'fixed_rate', 'owner_adjusted_rate','slots','single_user_only',
            'post_anonymously',
            'escalate_to_locum_casual',
            'interested_users_count', 'reveal_quota', 'reveal_count', 'workload_tags','slot_assignments',
            'allowed_escalation_levels','is_single_user', 'description' ]
        read_only_fields = [
            'id', 'created_by', 'escalation_level',
            'interested_users_count', 'reveal_count',
            'allowed_escalation_levels']

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')

        # Only restrict rate fields on write methods
        if request and request.method in ['POST', 'PUT', 'PATCH']:
            # ⬇️ replace this line:
            # role = request.data.get('role_needed') or self.initial_data.get('role_needed')

            # ⬇️ with this guarded version (so schema gen doesn't crash):
            idata = getattr(self, 'initial_data', {}) or {}
            req_role = getattr(request, 'data', {}).get('role_needed') if hasattr(request, 'data') else None
            role = req_role or idata.get('role_needed')

            if role != 'PHARMACIST':
                fields.pop('fixed_rate', None)
                fields.pop('rate_type', None)

        return fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if instance.post_anonymously and not user_can_view_full_pharmacy(user, instance.pharmacy):
            data['pharmacy_detail'] = anonymize_pharmacy_detail(data.get('pharmacy_detail'))
        return data

    @staticmethod
    def build_allowed_tiers(pharmacy):
        """
        Determine which escalation tiers are available for this pharmacy.
        Chain escalation is only available when the pharmacy belongs to at least
        one of the owner's chains. Organization escalation requires the pharmacy
        to be claimed by an organization.
        """
        tiers = ['FULL_PART_TIME', 'LOCUM_CASUAL']

        owner = getattr(pharmacy, 'owner', None)
        if owner and Chain.objects.filter(owner=owner, pharmacies=pharmacy).exists():
            tiers.append('OWNER_CHAIN')

        if pharmacy.organization_id:
            tiers.append('ORG_CHAIN')

        tiers.append('PLATFORM')
        return tiers



    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_escalation_levels(self, obj) -> list[str]:
        return self.build_allowed_tiers(obj.pharmacy)

    @staticmethod
    def _ensure_escalation_stamps(shift, allowed_tiers, target_index):
        field_map = {
            'LOCUM_CASUAL': 'escalate_to_locum_casual',
            'OWNER_CHAIN': 'escalate_to_owner_chain',
            'ORG_CHAIN': 'escalate_to_org_chain',
            'PLATFORM': 'escalate_to_platform',
        }
        stamp_time = timezone.now()
        for idx in range(1, target_index + 1):
            if idx >= len(allowed_tiers):
                break
            tier = allowed_tiers[idx]
            field = field_map.get(tier)
            if field and not getattr(shift, field):
                setattr(shift, field, stamp_time)

    def _normalize_slots_payload(self, slots_data):
        normalized = []
        for idx, raw_slot in enumerate(slots_data, start=1):
            slot = dict(raw_slot)
            recurring_days = slot.get('recurring_days') or []
            slot['recurring_days'] = sorted({int(day) for day in recurring_days if day is not None})

            if slot.get('is_recurring'):
                if not slot['recurring_days']:
                    raise serializers.ValidationError({
                        'slots': [f"Recurring slot #{idx} must include at least one weekday."]
                    })
                slot['recurring_end_date'] = slot.get('recurring_end_date') or slot['date']
            else:
                slot['recurring_days'] = []
                slot['recurring_end_date'] = None

            normalized.append(slot)
        return normalized

    def create(self, validated_data):
        slots_data = self._normalize_slots_payload(validated_data.pop('slots'))
        user        = self.context['request'].user
        pharmacy    = validated_data['pharmacy']

        # Build the correct path
        allowed_tiers = self.build_allowed_tiers(pharmacy)

        # Ensure the front-end’s choice is valid
        chosen = validated_data.get('visibility')
        if chosen not in allowed_tiers:
            raise serializers.ValidationError({
                'visibility': f"Invalid choice; must be one of {allowed_tiers}"
            })

        if chosen == 'PLATFORM':
            enforce_public_shift_daily_limit(pharmacy)
            if not validated_data.get('escalate_to_platform'):
                validated_data['escalate_to_platform'] = timezone.now()

        # Index of that choice becomes the escalation_level
        validated_data['escalation_level'] = allowed_tiers.index(chosen)
        validated_data['created_by']       = user

        with transaction.atomic():
            shift = Shift.objects.create(**validated_data)
            for slot in slots_data:
                ShiftSlot.objects.create(shift=shift, **slot)

        return shift

    def update(self, instance, validated_data):
        # If visibility is changing, recalc escalation_level
        if 'visibility' in validated_data:
            allowed_tiers = self.build_allowed_tiers(instance.pharmacy)
            new_vis = validated_data['visibility']
            if new_vis not in allowed_tiers:
                raise serializers.ValidationError({
                    'visibility': f"Invalid choice; must be one of {allowed_tiers}"
                })
            target_index = allowed_tiers.index(new_vis)
            instance.escalation_level = target_index
            if new_vis == 'PLATFORM' and not validated_data.get('escalate_to_platform') and not instance.escalate_to_platform:
                validated_data['escalate_to_platform'] = timezone.now()
            self._ensure_escalation_stamps(instance, allowed_tiers, target_index)

        # Apply other fields
        for attr, val in validated_data.items():
            if attr != 'slots':
                setattr(instance, attr, val)
        instance.save()

        # Replace slots if provided
        if 'slots' in validated_data:
            instance.slots.all().delete()
            for slot in validated_data['slots']:
                ShiftSlot.objects.create(shift=instance, **slot)

        return instance

    def get_slots(self, obj): # NEW METHOD
        """
        Filters and returns only relevant slots for the shift (future and unassigned).
        This mirrors the logic from ActiveShiftViewSet's get_queryset.
        """
        now = timezone.now()
        today = date.today()

        # Get all slots for this shift
        all_slots = obj.slots.all()

        # Filter out past slots and assigned slots
        filtered_slots = []
        for slot in all_slots:
            slot_is_future = (
                slot.date > today
                or (slot.date == today and slot.end_time >= now.time()) # Use >= now.time() for active shifts
            )

            # Check if this specific slot has any assignments
            # Note: This checks if ANY assignment exists for this slot, regardless of date.
            # If you need to check for assignments on a specific date for recurring slots,
            # the logic would need to be more complex, potentially involving expand_shift_slots.
            # For simplicity for an 'unassigned' shift, this assumes the whole slot is unassigned.
            slot_is_assigned = ShiftSlotAssignment.objects.filter(slot=slot).exists()

            if slot_is_future and not slot_is_assigned:
                filtered_slots.append(slot)
        
        return ShiftSlotSerializer(filtered_slots, many=True).data

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_slot_assignments(self, shift) -> list[dict]:
        return [
        {'slot_id': a.slot.id, 'user_id': a.user.id}
            for a in shift.slot_assignments.all()
        ]

class ShiftInterestSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    user_id  = serializers.IntegerField(source='user.id', read_only=True)
    slot_id  = serializers.IntegerField(source='slot.id', read_only=True)
    slot_time = serializers.SerializerMethodField()
    revealed = serializers.BooleanField(read_only=True)

    class Meta:
        model  = ShiftInterest
        fields = [
            'id',
            'shift',
            'slot',
            'slot_id',
            'slot_time',
            'user',
            'user_id',
            'revealed',
            'expressed_at',
        ]
        read_only_fields = [
            'id','user','user_id','slot_time','revealed','expressed_at'
        ]

    def get_user(self, obj):
        request = self.context.get('request')
        if obj.shift.visibility == 'PLATFORM' and not obj.revealed:
            # For debugging, return a distinct anonymous string.
            return "Anonymous Interest User"
        # For debugging, return the full name if revealed or not public.
        return obj.user.get_full_name()

    def get_slot_time(self, obj):
        slot = obj.slot
        if not slot:
            # For debugging, return a default string if slot is None.
            return "N/A Slot Time"
        date_str  = slot.date.strftime('%Y-%m-%d')
        start_str = slot.start_time.strftime('%H:%M')
        end_str   = slot.end_time.strftime('%H:%M')
        return f"{date_str} {start_str}–{end_str}"

class ShiftRejectionSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    slot_id = serializers.IntegerField(source='slot.id', read_only=True)
    class Meta:
        model = ShiftRejection
        fields = [
            'id', 'shift', 'slot', 'slot_id', 'slot_date', 'user', 'user_id', 'rejected_at'
        ]
        read_only_fields = ['id', 'user', 'user_id', 'slot_id', 'rejected_at']

class MyShiftSerializer(serializers.ModelSerializer):
    # reuse the full PharmacySerializer (with all the file‐fields)
    pharmacy_detail = PharmacySerializer(source='pharmacy', read_only=True)
    created_by_first_name = serializers.CharField(source='created_by.first_name', read_only=True)
    created_by_last_name  = serializers.CharField(source='created_by.last_name',  read_only=True)
    created_by_email      = serializers.EmailField(source='created_by.email',      read_only=True)

    # bring rate_type, fixed_rate, workload_tags straight through
    rate_type     = serializers.CharField(read_only=True)
    fixed_rate    = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    workload_tags = serializers.ListField(child=serializers.CharField(), read_only=True)

    # only return the slots that this user is actually assigned to
    slots = serializers.SerializerMethodField()

    # Lineitems from service.py
    line_items = serializers.SerializerMethodField()
    owner_adjusted_rate = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id',
            'pharmacy_detail',
            'created_by_first_name',
            'created_by_last_name',
            'created_by_email',
            'role_needed',
            'rate_type',
            'fixed_rate',
            'workload_tags',
            'slots',
            'line_items',
            'owner_adjusted_rate',
        ]
        read_only_fields = ['was_modified']  # ✅ this protects it

    def get_slots(self, obj):
        user = self.context['request'].user

        # Show only the slots where the user has assignments
        slot_ids = obj.slot_assignments.filter(user=user).values_list('slot_id', flat=True)
        qs = obj.slots.filter(id__in=slot_ids)

        return ShiftSlotSerializer(qs, many=True).data

        return ShiftSlotSerializer(qs, many=True).data
    def get_line_items(self, obj):
        user = self.context['request'].user
        from client_profile.services import generate_preview_invoice_lines

        try:
            return generate_preview_invoice_lines(shift=obj, user=user)
        except Exception:
            return []

class SharedShiftSerializer(serializers.ModelSerializer):
    """
    A simplified serializer specifically for a shared shift link.
    Excludes any sensitive or internal information.
    """
    pharmacy_detail = PharmacySerializer(source='pharmacy', read_only=True)
    slots = ShiftSlotSerializer(many=True, read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id',
            'pharmacy_detail',
            'role_needed',
            'employment_type',
            'workload_tags',
            'must_have',
            'nice_to_have',
            'rate_type',
            'fixed_rate',
            'owner_adjusted_rate',
            'slots',
            'created_at',
            'single_user_only',
            'post_anonymously',
            'description',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if instance.post_anonymously and not user_can_view_full_pharmacy(user, instance.pharmacy):
            data['pharmacy_detail'] = anonymize_pharmacy_detail(data.get('pharmacy_detail'))
        return data

class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'slot_assignment', 'user', 'leave_type', 'note',
            'status', 'date_applied', 'date_resolved'
        ]
        read_only_fields = ['id', 'user', 'status', 'date_applied', 'date_resolved']

class WorkerShiftRequestSerializer(serializers.ModelSerializer):
    requested_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    pharmacy_name = serializers.CharField(source="pharmacy.name", read_only=True)
    requester_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)

    class Meta:
        model = WorkerShiftRequest
        fields = [
            "id",
            "pharmacy",
            "pharmacy_name",
            "requested_by",
            "requester_name",
            "shift",
            "role",
            "slot_date",
            "start_time",
            "end_time",
            "note",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "created_at", "updated_at"]

    def create(self, validated_data):
        user = self.context["request"].user

        # Explicitly link requester
        validated_data["requested_by"] = user
        validated_data["status"] = "PENDING"

        return super().create(validated_data)

# === Rosters ===
class RosterUserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email']

class RosterShiftDetailSerializer(serializers.ModelSerializer):
    pharmacy_name = serializers.CharField(source='pharmacy.name', read_only=True)
    # ADD THIS LINE:
    allowed_escalation_levels = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = ['id', 'role_needed', 'pharmacy_name', 'visibility', 'allowed_escalation_levels']

    def get_allowed_escalation_levels(self, obj):
        return ShiftSerializer.build_allowed_tiers(obj.pharmacy)

class RosterAssignmentSerializer(serializers.ModelSerializer):
    user_detail = RosterUserDetailSerializer(source='user', read_only=True)
    slot_detail = ShiftSlotSerializer(source='slot', read_only=True)
    shift_detail = RosterShiftDetailSerializer(source='shift', read_only=True)
    leave_request = serializers.SerializerMethodField()

    class Meta:
        model = ShiftSlotAssignment
        fields = [
            "id", "slot_date", "unit_rate", "rate_reason", "is_rostered",
            "user", "slot", "shift",
            "user_detail",
            "slot_detail",
            "shift_detail",
            "leave_request",
        ]

    def get_leave_request(self, obj):
        # Get latest leave request with status PENDING or APPROVED
        leave = obj.leave_requests.filter(status__in=['PENDING', 'APPROVED']).order_by('-date_applied').first()
        if leave:
            return {
                "id": leave.id,
                "leave_type": leave.leave_type,
                "status": leave.status,
                "note": leave.note,
                "date_applied": leave.date_applied,
                "date_resolved": leave.date_resolved,
            }
        return None


class OpenShiftSerializer(serializers.ModelSerializer):
    slots = ShiftSlotSerializer(many=True, read_only=True)
    pharmacy_name = serializers.CharField(source='pharmacy.name', read_only=True)

    class Meta:
        model = Shift
        fields = [
            "id",
            "pharmacy",
            "pharmacy_name",
            "role_needed",
            "description",
            "slots",
        ]

# === Invoice ===
class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = [
            'id',
            'description',
            'category_code',
            'unit',
            'quantity',
            'unit_price',
            'discount',
            'total',
            'gst_applicable',
            'super_applicable',
            'is_manual',
            'shift',
        ]
        read_only_fields = ['total']

    def create(self, validated_data):
        qty      = validated_data['quantity']
        rate     = validated_data['unit_price']
        discount = validated_data.get('discount', Decimal('0')) / Decimal('100')
        validated_data['total'] = (qty * rate * (1 - discount)).quantize(Decimal('0.01'))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        discount = validated_data.get('discount', instance.discount) / Decimal('100')
        instance.total = (instance.quantity * instance.unit_price * (1 - discount)).quantize(Decimal('0.01'))
        instance.save()
        return instance

class InvoiceSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'user', 'external', 'pharmacy',
            'pharmacy_name_snapshot', 'pharmacy_address_snapshot', 'pharmacy_abn_snapshot',
            'custom_bill_to_name', 'custom_bill_to_address',
            'gst_registered', 'super_rate_snapshot',
            'bank_account_name', 'bsb', 'account_number',
            'super_fund_name', 'super_usi', 'super_member_number',
            'bill_to_email', 'cc_emails',
            'invoice_date', 'due_date',
            'subtotal', 'gst_amount', 'super_amount', 'total',
            'status', 'created_at',
            'line_items',
            # Recipient snapshot
            'bill_to_first_name', 'bill_to_last_name', 'bill_to_abn',

            # Issuer snapshot
            'issuer_first_name', 'issuer_last_name', 'issuer_abn',
        ]
        read_only_fields = [
            'subtotal', 'gst_amount', 'super_amount', 'total', 'created_at'
        ]

    def create(self, validated_data):
        items = validated_data.pop('line_items', [])
        invoice = Invoice.objects.create(**validated_data)
        for item in items:
            item['invoice'] = invoice
            InvoiceLineItemSerializer().create(item)

        # Recompute totals
        invoice.refresh_from_db()
        subtotal = sum(li.total for li in invoice.line_items.all())
        gst_amt = subtotal * Decimal('0.10') if invoice.gst_registered else Decimal('0.00')
        super_amt = subtotal * (invoice.super_rate_snapshot / Decimal('100'))
        invoice.subtotal = subtotal
        invoice.gst_amount = gst_amt
        invoice.super_amount = super_amt
        invoice.total = subtotal + gst_amt + super_amt
        invoice.save()
        return invoice

    def update(self, instance, validated_data):
        items = validated_data.pop('line_items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if items is not None:
            instance.line_items.all().delete()
            for item in items:
                item['invoice'] = instance
                InvoiceLineItemSerializer().create(item)

        # Recompute totals
        subtotal = sum(li.total for li in instance.line_items.all())
        gst_amt = subtotal * Decimal('0.10') if instance.gst_registered else Decimal('0.00')
        super_amt = subtotal * (instance.super_rate_snapshot / Decimal('100'))
        instance.subtotal = subtotal
        instance.gst_amount = gst_amt
        instance.super_amount = super_amt
        instance.total = subtotal + gst_amt + super_amt
        instance.save()
        return instance

# ExplorerPost Serializer
class ExplorerPostAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExplorerPostAttachment
        fields = ["id", "kind", "file", "caption", "created_at"]
        read_only_fields = ["id", "created_at"]


class ExplorerPostReadSerializer(serializers.ModelSerializer):
    explorer_name = serializers.CharField(source='explorer_profile.user.get_full_name', read_only=True)
    # --- ADD THESE TWO FIELDS ---
    explorer_user_id = serializers.IntegerField(source='explorer_profile.user.id', read_only=True)
    explorer_role_type = serializers.CharField(source='explorer_profile.role_type', read_only=True)
    
    attachments = ExplorerPostAttachmentSerializer(many=True, read_only=True)
    is_liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = ExplorerPost
        fields = [
            "id",
            "explorer_profile",
            "headline",
            "body",
            "view_count",
            "like_count",
            "reply_count",
            "created_at",
            "updated_at",
            "attachments",
            "explorer_name",
            # --- ADD THE NEW FIELDS TO THE LIST ---
            "explorer_user_id",
            "explorer_role_type",
            "is_liked_by_me",
        ]
        read_only_fields = fields  # read serializer only

    def get_explorer_name(self, obj):
        u = getattr(obj.explorer_profile, "user", None)
        return u.get_full_name() if u else ""

    def get_is_liked_by_me(self, obj):
        req = self.context.get("request")
        if not req or not req.user or not req.user.is_authenticated:
            return False
        return ExplorerPostReaction.objects.filter(post=obj, user=req.user).exists()


class ExplorerPostWriteSerializer(serializers.ModelSerializer):
    """
    Write serializer; you can optionally pass initial attachments:
    attachments=[{file, kind, caption}, ...]
    """
    attachments = ExplorerPostAttachmentSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = ExplorerPost
        fields = ["id", "explorer_profile", "headline", "body", "attachments"]

    def validate(self, attrs):
        """
        Ensure the creator owns the explorer_profile.
        (We re-check in perform_create too, but this gives nice 400s earlier.)
        """
        request = self.context.get("request")
        profile = attrs.get("explorer_profile")
        if request and request.user.is_authenticated and profile:
            if getattr(profile, "user_id", None) != request.user.id:
                raise serializers.ValidationError("You can only post from your own explorer profile.")
        return attrs

    def create(self, validated_data):
        atts = validated_data.pop("attachments", [])
        post = ExplorerPost.objects.create(**validated_data)
        for a in atts:
            ExplorerPostAttachment.objects.create(post=post, **a)
        return post

    def update(self, instance, validated_data):
        # editing text only; attachments are handled by the attachments endpoint
        instance.headline = validated_data.get("headline", instance.headline)
        instance.body = validated_data.get("body", instance.body)
        instance.save(update_fields=["headline", "body", "updated_at"])
        return instance

# Availability
class UserAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAvailability
        fields = [
            'id', 'date', 'start_time', 'end_time',
            'is_all_day', 'is_recurring', 'recurring_days',
            'recurring_end_date', 'notes'
        ]
        read_only_fields = ['id']


#  Ratings  
class RatingReadSerializer(serializers.ModelSerializer):
    rater_user_id = serializers.IntegerField(source="rater_user.id", read_only=True)
    ratee_user_id = serializers.IntegerField(source="ratee_user.id", read_only=True)
    ratee_pharmacy_id = serializers.IntegerField(source="ratee_pharmacy.id", read_only=True)

    class Meta:
        model = Rating
        fields = [
            "id", "direction", "stars", "comment",
            "rater_user_id", "ratee_user_id", "ratee_pharmacy_id",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class RatingWriteSerializer(serializers.ModelSerializer):
    """
    Upsert semantics: if a rating already exists for (direction, rater, target),
    we update stars/comment; otherwise we create it.
    rater_user is taken from request.user in the view.
    """
    class Meta:
        model = Rating
        fields = ["direction", "ratee_user", "ratee_pharmacy", "stars", "comment"]

    def validate(self, attrs):
        direction = attrs.get("direction")
        ratee_user = attrs.get("ratee_user")
        ratee_pharmacy = attrs.get("ratee_pharmacy")

        if direction == Rating.Direction.OWNER_TO_WORKER:
            if not ratee_user or ratee_pharmacy is not None:
                raise serializers.ValidationError("OWNER_TO_WORKER requires ratee_user and no ratee_pharmacy.")
        elif direction == Rating.Direction.WORKER_TO_PHARMACY:
            if not ratee_pharmacy or ratee_user is not None:
                raise serializers.ValidationError("WORKER_TO_PHARMACY requires ratee_pharmacy and no ratee_user.")
        else:
            raise serializers.ValidationError({"direction": "Unknown direction."})

        stars = attrs.get("stars")
        if stars is None or not (1 <= int(stars) <= 5):
            raise serializers.ValidationError({"stars": "Stars must be between 1 and 5."})
        return attrs


class RatingSummarySerializer(serializers.Serializer):
    """
    Read-only aggregate: average + count for a target.
    Used by GET /ratings/summary?target_type=...&target_id=...
    """
    average = serializers.FloatField()
    count = serializers.IntegerField()


class MyRatingSerializer(serializers.Serializer):
    """
    Read-only: current user's rating (if any) on a target.
    Used by GET /ratings/mine?target_type=...&target_id=...
    """
    id = serializers.IntegerField(allow_null=True)
    direction = serializers.CharField()
    stars = serializers.IntegerField(allow_null=True)
    comment = serializers.CharField(allow_blank=True, allow_null=True)


class PendingRatingsSerializer(serializers.Serializer):
    """
    Read-only: IDs the user can still rate.
    Used by GET /ratings/pending
    """
    workers_to_rate = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)
    pharmacies_to_rate = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)

# --- Chat Serializers --------------------------------------------------------
class ChatMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email"]

class ChatMembershipSerializer(serializers.ModelSerializer):
    user_details = ChatMemberSerializer(source='user', read_only=True)
    class Meta:
        model = Membership
        fields = ["id", "user_details"]

class ReactionSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id')
    class Meta:
        model = MessageReaction
        fields = ['reaction', 'user_id']

class MessageSerializer(serializers.ModelSerializer):
    sender = ChatMembershipSerializer(read_only=True)
    attachment_url = serializers.SerializerMethodField()
    reactions = ReactionSerializer(many=True, read_only=True)
    attachment_filename = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()
    class Meta:
        model = Message
        fields = [
            "id", "conversation", "sender", "body", "attachment", "attachment_url",
            "attachment_filename", "created_at", "is_deleted", "is_edited",
            "original_body", "reactions",  "is_pinned",
        ]
        read_only_fields = fields
    def get_attachment_url(self, obj):
        try:
            return obj.attachment.url if obj.attachment else None
        except Exception:
            return None
 
    def get_attachment_filename(self, obj):
        if obj.attachment and hasattr(obj.attachment, 'name'):
            import os
            return os.path.basename(obj.attachment.name)
        return None
 
    def get_is_pinned(self, obj):
        # A message is pinned if its ID matches the conversation's pinned_message_id
        return obj.conversation.pinned_message_id == obj.id

class ConversationListSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    participant_ids = serializers.SerializerMethodField()
    my_last_read_at = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    my_membership_id = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()
    pinned_message = MessageSerializer(read_only=True)
    created_by_user_id = serializers.IntegerField(source='created_by_id', read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id", "created_by", "type", "title","pharmacy","updated_at", "last_message",
            "unread_count", "participant_ids", "my_last_read_at", "my_membership_id",
            "is_pinned", "pinned_message", "created_by_user_id",

        ]

    def get_title(self, obj: Conversation) -> str:
            # --- START OF FIX ---
            # Prioritize the pharmacy link to guarantee the correct name for community chats.
            if hasattr(obj, 'pharmacy') and obj.pharmacy:
                return obj.pharmacy.name
            
            # Fallback for DMs and custom groups that use the title field.
            if obj.type == Conversation.Type.DM:
                request = self.context.get("request")
                if request and hasattr(request, 'user'):
                    # This correctly finds the other user's name for DMs
                    other_participant = obj.participants.exclude(membership__user=request.user).first()
                    if other_participant:
                        partner_user = other_participant.membership.user
                        return partner_user.get_full_name() or partner_user.email
            
            # If it's a custom group or a DM where the partner can't be found, use the stored title.
            if obj.title:
                return obj.title
            
            # Final fallback.
            return "Group Chat"

    def _get_my_participant(self, obj):
        request = self.context.get("request")
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
        if not hasattr(self, '_participant_cache'):
            self._participant_cache = {}
        cache_key = (request.user.id, obj.id)
        if cache_key not in self._participant_cache:
            self._participant_cache[cache_key] = Participant.objects.filter(conversation=obj, membership__user=request.user).first()
        return self._participant_cache[cache_key]
    
    def get_is_pinned(self, obj):
        my_part = self._get_my_participant(obj)
        return my_part.is_pinned if my_part else False

    def get_my_membership_id(self, obj):
        my_part = self._get_my_participant(obj)
        return my_part.membership_id if my_part else None

    def get_my_last_read_at(self, obj):
        my_part = self._get_my_participant(obj)
        return my_part.last_read_at.isoformat() if my_part and my_part.last_read_at else None

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if not msg: return None
        return {"id": msg.id, "body": msg.body[:200], "created_at": msg.created_at.isoformat(), "sender": msg.sender_id}

    def get_unread_count(self, obj):
        my_part = self._get_my_participant(obj)
        if not my_part: return 0
        since = my_part.last_read_at
        if not since: return obj.messages.count()
        return obj.messages.filter(created_at__gt=since).count()

    def get_participant_ids(self, obj):
        return list(obj.participants.values_list("membership_id", flat=True))

class ConversationCreateSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.filter(is_active=True), 
        many=True, 
        write_only=True,
        required=False
    )

    class Meta:
        model = Conversation
        fields = ["id", "type", "title", "participants", "created_by"]
        read_only_fields = ["id", "created_by", "type"]

    def create(self, validated_data):
        participants_data = validated_data.pop("participants", [])
        validated_data['created_by'] = self.context['request'].user

        conv = Conversation.objects.create(**validated_data)

        # Add creator + dedupe, mark creator admin
        creator_membership = (
            Membership.objects.filter(user=self.context['request'].user, is_active=True).first()
        )
        if creator_membership:
            # Normalise & dedupe incoming participants (can be Membership instances)
            participant_memberships = {m if isinstance(m, Membership) else None for m in participants_data}
            participant_memberships = {m for m in participant_memberships if isinstance(m, Membership)}
            participant_memberships.add(creator_membership)

            # Insert; mark creator as admin; ignore conflicts if client sent creator too
            Participant.objects.bulk_create(
                [
                    Participant(
                        conversation=conv,
                        membership=m,
                        is_admin=(m.id == creator_membership.id)
                    )
                    for m in participant_memberships
                    if getattr(m, "is_active", True)
                ],
                ignore_conflicts=True,
            )
        return conv


    def update(self, instance, validated_data):
        if 'participants' in validated_data:
            # Incoming can be a queryset or list of Membership objects
            new_participants_qs = validated_data.pop('participants')
            new_participant_ids = {p.id for p in new_participants_qs}

            # Current links
            current_participant_ids = set(
                instance.participants.values_list('membership_id', flat=True)
            )

            # Ensure creator is always included
            creator_user = instance.created_by
            creator_mem = (
                Membership.objects.filter(user=creator_user, is_active=True).first()
                or Membership.objects.filter(user=creator_user).first()
            )
            if creator_mem:
                new_participant_ids.add(creator_mem.id)

            # Add missing memberships (keep creator admin)
            ids_to_add = new_participant_ids - current_participant_ids
            if ids_to_add:
                memberships_to_add = list(Membership.objects.filter(id__in=ids_to_add))
                Participant.objects.bulk_create(
                    [
                        Participant(
                            conversation=instance,
                            membership=m,
                            is_admin=(creator_mem and m.id == creator_mem.id)
                        )
                        for m in memberships_to_add
                    ],
                    ignore_conflicts=True,
                )

            # Remove those no longer present (but never remove creator)
            if creator_mem:
                current_participant_ids.discard(creator_mem.id)
            ids_to_remove = current_participant_ids - new_participant_ids
            if ids_to_remove:
                instance.participants.filter(membership_id__in=ids_to_remove).delete()

        return super().update(instance, validated_data)

class ConversationDetailSerializer(ConversationListSerializer):
    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields

class ChatParticipantSerializer(serializers.ModelSerializer):
    """
    A specific serializer to provide user details for all participants
    in a user's conversations, regardless of their active status.
    """
    user_details = ChatMemberSerializer(source='user', read_only=True)
    class Meta:
        model = Membership
        fields = [
            "id",
            "user_details",
            "role",
            "employment_type",
            "invited_name",
        ]

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "title",
            "body",
            "payload",
            "action_url",
            "created_at",
            "read_at",
        ]
        read_only_fields = fields


# --- Pharmacy Hub Serializers --------------------------------------------------------

def _build_absolute_media_url(request, file_field):
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    if request:
        try:
            return request.build_absolute_uri(url)
        except Exception:
            return url
    return url


class HubPharmacySerializer(serializers.ModelSerializer):
    cover_image = serializers.ImageField(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    can_manage_profile = serializers.SerializerMethodField()
    can_create_group = serializers.SerializerMethodField()
    can_create_post = serializers.SerializerMethodField()

    class Meta:
        model = Pharmacy
        fields = [
            "id",
            "name",
            "about",
            "cover_image",
            "cover_image_url",
            "organization_id",
            "organization_name",
            "can_manage_profile",
            "can_create_group",
            "can_create_post",
        ]
        read_only_fields = fields

    def _permission_for(self, obj, key, default=False):
        perms = self.context.get("pharmacy_permissions", {})
        return perms.get(obj.id, {}).get(key, default)

    def get_cover_image_url(self, obj):
        return _build_absolute_media_url(self.context.get("request"), obj.cover_image)

    def get_can_manage_profile(self, obj):
        return self._permission_for(obj, "can_manage_profile")

    def get_can_create_group(self, obj):
        return self._permission_for(obj, "can_create_group")

    def get_can_create_post(self, obj):
        return self._permission_for(obj, "can_create_post", True)


class HubOrganizationSerializer(serializers.ModelSerializer):
    cover_image = serializers.ImageField(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    can_manage_profile = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "about",
            "cover_image",
            "cover_image_url",
            "can_manage_profile",
        ]
        read_only_fields = fields

    def get_cover_image_url(self, obj):
        return _build_absolute_media_url(self.context.get("request"), obj.cover_image)

    def get_can_manage_profile(self, obj):
        perms = self.context.get("organization_permissions", {})
        return perms.get(obj.id, {}).get("can_manage_profile", False)


class HubPharmacyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pharmacy
        fields = ["about", "cover_image"]


class HubOrganizationProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["about", "cover_image"]


class HubMembershipSerializer(serializers.ModelSerializer):
    user_details = ChatMemberSerializer(source="user", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "role", "employment_type", "user_details"]
        read_only_fields = fields


class PharmacyCommunityGroupMemberSerializer(serializers.ModelSerializer):
    membership_id = serializers.IntegerField(read_only=True)
    member = HubMembershipSerializer(source="membership", read_only=True)

    class Meta:
        model = PharmacyCommunityGroupMembership
        fields = ["membership_id", "member", "is_admin", "joined_at"]
        read_only_fields = ["membership_id", "member", "joined_at"]


class HubCommunityGroupSerializer(serializers.ModelSerializer):
    members = PharmacyCommunityGroupMemberSerializer(
        source="memberships", many=True, read_only=True
    )
    member_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    member_count = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    pharmacy_name = serializers.CharField(source="pharmacy.name", read_only=True)
    organization_id = serializers.IntegerField(
        source="pharmacy.organization_id", read_only=True
    )
    is_creator = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyCommunityGroup
        fields = [
            "id",
            "pharmacy",
            "pharmacy_name",
            "organization_id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "members",
            "member_ids",
            "member_count",
            "is_admin",
            "is_member",
            "is_creator",
        ]
        read_only_fields = [
            "id",
            "pharmacy",
            "pharmacy_name",
            "organization_id",
            "created_at",
            "updated_at",
            "members",
            "member_count",
            "is_admin",
            "is_member",
            "is_creator",
        ]

    def _resolve_memberships(self, pharmacy, member_ids):
        if not member_ids:
            return []
        allowed_pharmacy_ids = set(
            self.context.get("allowed_pharmacy_ids") or []
        )
        if pharmacy:
            allowed_pharmacy_ids.add(pharmacy.id)
        memberships_qs = Membership.objects.filter(
            id__in=member_ids,
            is_active=True,
        )
        if allowed_pharmacy_ids:
            memberships_qs = memberships_qs.filter(
                pharmacy_id__in=allowed_pharmacy_ids
            )
        memberships = list(memberships_qs)
        found_ids = {m.id for m in memberships}
        missing = sorted(set(member_ids) - found_ids)
        if missing:
            raise serializers.ValidationError(
                {
                    "member_ids": (
                        "Invalid membership IDs for manageable pharmacies: "
                        f"{missing}"
                    )
                }
            )
        return memberships

    def _ensure_creator_membership(self, pharmacy):
        request_membership = self.context.get("request_membership")
        if request_membership and request_membership.pharmacy_id == pharmacy.id:
            return request_membership
        user = self.context["request"].user if "request" in self.context else None
        if not user:
            return None
        return (
            Membership.objects.filter(
                user=user,
                pharmacy=pharmacy,
                is_active=True,
            )
            .order_by("id")
            .first()
        )

    def create(self, validated_data):
        member_ids = set(validated_data.pop("member_ids", []) or [])
        pharmacy = validated_data["pharmacy"]
        creator_membership = self._ensure_creator_membership(pharmacy)
        if creator_membership:
            member_ids.add(creator_membership.id)
        memberships = self._resolve_memberships(pharmacy, member_ids)
        with transaction.atomic():
            group = PharmacyCommunityGroup.objects.create(**validated_data)
            bulk_links = [
                PharmacyCommunityGroupMembership(
                    group=group,
                    membership=membership,
                    is_admin=(membership == creator_membership),
                )
                for membership in memberships
            ]
            PharmacyCommunityGroupMembership.objects.bulk_create(bulk_links)
        return group

    def update(self, instance, validated_data):
        membership_ids = validated_data.pop("member_ids", None)
        response = super().update(instance, validated_data)
        if membership_ids is not None:
            membership_ids = set(membership_ids)
            memberships = self._resolve_memberships(instance.pharmacy, membership_ids)
            desired_ids = {membership.id for membership in memberships}
            existing_links = {
                link.membership_id: link
                for link in PharmacyCommunityGroupMembership.objects.filter(
                    group=instance
                )
            }
            new_links = []
            for membership in memberships:
                if membership.id in existing_links:
                    continue
                new_links.append(
                    PharmacyCommunityGroupMembership(
                        group=instance,
                        membership=membership,
                    )
                )
            if new_links:
                PharmacyCommunityGroupMembership.objects.bulk_create(new_links)
            to_remove = set(existing_links.keys()) - desired_ids
            if to_remove:
                PharmacyCommunityGroupMembership.objects.filter(
                    group=instance, membership_id__in=to_remove
                ).delete()
        return response

    def get_member_count(self, obj):
        return getattr(obj, "member_count", obj.memberships.count())

    def get_is_admin(self, obj):
        request = self.context.get("request")
        if request and getattr(request, "user", None):
            if obj.created_by_id == request.user.id:
                return True
        admin_map = self.context.get("group_admin_map", {})
        return admin_map.get(obj.id, False)

    def get_is_member(self, obj):
        member_map = self.context.get("group_member_map", {})
        return member_map.get(obj.id, False)

    def get_is_creator(self, obj):
        request = self.context.get("request")
        if request and getattr(request, "user", None):
            return obj.created_by_id == request.user.id
        return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get("include_members", True):
            data.pop("members", None)
        return data


class HubCommentSerializer(serializers.ModelSerializer):
    author = HubMembershipSerializer(source="author_membership", read_only=True)
    can_edit = serializers.SerializerMethodField()
    is_edited = serializers.BooleanField(read_only=True)
    original_body = serializers.CharField(read_only=True)
    edited_at = serializers.DateTimeField(source="last_edited_at", read_only=True)
    edited_by = serializers.SerializerMethodField()
    is_deleted = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyHubComment
        fields = [
            "id",
            "post",
            "author",
            "body",
            "parent_comment",
            "created_at",
            "updated_at",
            "deleted_at",
            "can_edit",
            "is_edited",
            "original_body",
            "edited_at",
            "edited_by",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "post",
            "author",
            "created_at",
            "updated_at",
            "deleted_at",
            "can_edit",
            "is_edited",
            "original_body",
            "edited_at",
            "edited_by",
            "is_deleted",
        ]

    def get_can_edit(self, obj):
        membership = self.context.get("request_membership")
        if membership and membership == obj.author_membership:
            return True
        return self.context.get("has_admin_permissions", False)

    def get_edited_by(self, obj):
        user = getattr(obj, "last_edited_by", None)
        if not user:
            return None
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    def get_is_deleted(self, obj):
        return obj.deleted_at is not None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("is_deleted"):
            data["body"] = "This comment has been deleted."
        return data


class HubAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyHubAttachment
        fields = ["id", "kind", "url", "filename", "uploaded_at"]
        read_only_fields = fields

    def get_url(self, obj):
        return _build_absolute_media_url(self.context.get("request"), obj.file)

    def get_filename(self, obj):
        if obj.file and hasattr(obj.file, "name"):
            import os

            return os.path.basename(obj.file.name)
        return None


class HubPostSerializer(serializers.ModelSerializer):
    author = HubMembershipSerializer(source="author_membership", read_only=True)
    viewer_reaction = serializers.SerializerMethodField()
    recent_comments = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    attachments = HubAttachmentSerializer(many=True, read_only=True)
    is_edited = serializers.BooleanField(read_only=True)
    original_body = serializers.CharField(read_only=True)
    edited_at = serializers.DateTimeField(source="last_edited_at", read_only=True)
    edited_by = serializers.SerializerMethodField()
    is_deleted = serializers.SerializerMethodField()
    is_pinned = serializers.BooleanField(read_only=True)
    pinned_at = serializers.DateTimeField(read_only=True)
    pinned_by = serializers.SerializerMethodField()
    viewer_is_admin = serializers.SerializerMethodField()
    organization = serializers.IntegerField(source="organization_id", read_only=True)
    organization_name = serializers.SerializerMethodField()
    pharmacy_name = serializers.SerializerMethodField()
    community_group = serializers.IntegerField(
        source="community_group_id", read_only=True
    )
    community_group_name = serializers.SerializerMethodField()
    scope_type = serializers.SerializerMethodField()
    scope_target_id = serializers.SerializerMethodField()
    tagged_members = serializers.SerializerMethodField()
    tagged_member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
        allow_empty=True,
    )

    class Meta:
        model = PharmacyHubPost
        fields = [
            "id",
            "pharmacy",
            "pharmacy_name",
            "community_group",
            "community_group_name",
            "organization",
            "organization_name",
            "scope_type",
            "scope_target_id",
            "author",
            "body",
            "visibility",
            "allow_comments",
            "created_at",
            "updated_at",
            "deleted_at",
            "comment_count",
            "reaction_summary",
            "viewer_reaction",
            "recent_comments",
            "can_manage",
            "attachments",
            "is_edited",
            "is_pinned",
            "pinned_at",
            "pinned_by",
            "original_body",
            "edited_at",
            "edited_by",
            "viewer_is_admin",
            "is_deleted",
            "tagged_members",
            "tagged_member_ids",
        ]
        read_only_fields = [
            "id",
            "pharmacy",
            "pharmacy_name",
            "community_group",
            "community_group_name",
            "organization",
            "organization_name",
            "scope_type",
            "scope_target_id",
            "author",
            "created_at",
            "updated_at",
            "deleted_at",
            "comment_count",
            "reaction_summary",
            "viewer_reaction",
            "recent_comments",
            "can_manage",
            "attachments",
            "is_edited",
            "is_pinned",
            "pinned_at",
            "pinned_by",
            "original_body",
            "edited_at",
            "edited_by",
            "viewer_is_admin",
            "is_deleted",
            "tagged_members",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._newly_tagged_members = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "tagged_member_ids" in getattr(self, "initial_data", {}):
            raw_ids = self.initial_data.get("tagged_member_ids") or []
            memberships = self._resolve_tagged_memberships(raw_ids)
            attrs["_tagged_memberships"] = memberships
        return attrs

    def create(self, validated_data):
        memberships = validated_data.pop("_tagged_memberships", None)
        post = super().create(validated_data)
        self._newly_tagged_members = self._apply_mentions(post, memberships)
        return post

    def update(self, instance, validated_data):
        memberships = validated_data.pop("_tagged_memberships", None)
        post = super().update(instance, validated_data)
        if memberships is not None:
            self._newly_tagged_members = self._apply_mentions(post, memberships)
        return post

    def _resolve_tagged_memberships(self, member_ids):
        if not isinstance(member_ids, list):
            raise serializers.ValidationError({"tagged_member_ids": "Provide a list of membership ids."})
        normalized_ids = []
        for raw in member_ids:
            try:
                normalized_ids.append(int(raw))
            except (TypeError, ValueError):
                raise serializers.ValidationError({"tagged_member_ids": f"Invalid membership id: {raw}"})
        if not normalized_ids:
            return []
        memberships = list(
            Membership.objects.filter(id__in=set(normalized_ids), is_active=True).select_related("pharmacy__organization", "user")
        )
        if len(memberships) != len(set(normalized_ids)):
            found_ids = {m.id for m in memberships}
            missing = [mid for mid in normalized_ids if mid not in found_ids]
            raise serializers.ValidationError({"tagged_member_ids": f"Invalid membership ids: {missing}"})
        context = self.context or {}
        pharmacy = context.get("pharmacy")
        organization = context.get("organization")
        community_group = context.get("community_group")
        if community_group:
            allowed = community_group.pharmacy_id
            invalid = [m.id for m in memberships if m.pharmacy_id != allowed]
            if invalid:
                raise serializers.ValidationError({"tagged_member_ids": f"Memberships must belong to pharmacy #{allowed}."})
        elif pharmacy:
            invalid = [m.id for m in memberships if m.pharmacy_id != pharmacy.id]
            if invalid:
                raise serializers.ValidationError({"tagged_member_ids": f"Memberships must belong to pharmacy #{pharmacy.id}."})
        elif organization:
            invalid = [
                m.id
                for m in memberships
                if not m.pharmacy or m.pharmacy.organization_id != organization.id
            ]
            if invalid:
                raise serializers.ValidationError(
                    {"tagged_member_ids": f"Memberships must belong to organization #{organization.id}."}
                )
        else:
            raise serializers.ValidationError({"tagged_member_ids": "Unable to determine post scope for tagging."})
        return memberships

    def _apply_mentions(self, post, memberships):
        if memberships is None:
            return []
        desired_ids = {m.id for m in memberships}
        existing_ids = set(post.mentions.values_list("membership_id", flat=True))
        to_remove = existing_ids - desired_ids
        if to_remove:
            PharmacyHubPostMention.objects.filter(post=post, membership_id__in=to_remove).delete()
        to_add = desired_ids - existing_ids
        new_links = [
            PharmacyHubPostMention(post=post, membership=membership)
            for membership in memberships
            if membership.id in to_add
        ]
        if new_links:
            PharmacyHubPostMention.objects.bulk_create(new_links)
        return [membership for membership in memberships if membership.id in to_add]

    def get_scope_type(self, obj):
        if obj.community_group_id:
            return "group"
        if obj.pharmacy_id:
            return "pharmacy"
        if obj.organization_id:
            return "organization"
        return None

    def get_scope_target_id(self, obj):
        if obj.community_group_id:
            return obj.community_group_id
        if obj.pharmacy_id:
            return obj.pharmacy_id
        return obj.organization_id

    def get_viewer_reaction(self, obj):
        membership = self.context.get("request_membership")
        if not membership:
            return None
        return (
            obj.reactions.filter(member=membership)
            .values_list("reaction_type", flat=True)
            .first()
        )

    def get_recent_comments(self, obj):
        comments_qs = (
            obj.comments.filter(deleted_at__isnull=True)
            .select_related("author_membership__user")
            .order_by("-created_at")[:2]
        )
        serializer = HubCommentSerializer(
            comments_qs,
            many=True,
            context=self.context,
        )
        return list(reversed(serializer.data))

    def get_can_manage(self, obj):
        membership = self.context.get("request_membership")
        if membership and membership == obj.author_membership:
            return True
        if self.context.get("has_admin_permissions", False):
            return True
        return self.context.get("has_group_admin_permissions", False)

    def get_edited_by(self, obj):
        user = getattr(obj, "last_edited_by", None)
        if not user:
            return None
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    def get_is_deleted(self, obj):
        return obj.deleted_at is not None

    def get_pinned_by(self, obj):
        user = getattr(obj, "pinned_by", None)
        if not user:
            return None
        return {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }

    def get_viewer_is_admin(self, obj):
        if self.context.get("has_admin_permissions"):
            return True
        return bool(self.context.get("has_group_admin_permissions", False))

    def get_organization_name(self, obj):
        organization = getattr(obj, "organization", None)
        if not organization:
            return None
        return organization.name

    def get_pharmacy_name(self, obj):
        pharmacy = getattr(obj, "pharmacy", None)
        if not pharmacy:
            return None
        return pharmacy.name

    def get_community_group_name(self, obj):
        group = getattr(obj, "community_group", None)
        if not group:
            return None
        return group.name

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("is_deleted"):
            data["body"] = "This post has been deleted."
            data["attachments"] = []
        return data

    def get_tagged_members(self, obj):
        tagged = []
        for mention in obj.mentions.all():
            membership = mention.membership
            if not membership:
                continue
            user = getattr(membership, "user", None)
            full_name = ""
            if user:
                full_name = user.get_full_name().strip() or user.email or ""
            if not full_name:
                full_name = membership.display_name if hasattr(membership, "display_name") else ""
            tagged.append(
                {
                    "membership_id": membership.id,
                    "full_name": full_name or "(Unnamed)",
                    "email": user.email if user else None,
                    "role": membership.role,
                }
            )
        return tagged


class HubPollOptionSerializer(serializers.ModelSerializer):
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyHubPollOption
        fields = ["id", "label", "vote_count", "percentage", "position"]
        read_only_fields = ["id", "vote_count", "percentage", "position"]

    def get_percentage(self, obj):
        total = self.context.get("total_votes") or 0
        if total <= 0:
            return 0
        return round((obj.vote_count / total) * 100)


class HubPollSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()
    option_labels = serializers.ListField(
        child=serializers.CharField(max_length=255),
        write_only=True,
        required=True,
        allow_empty=False,
    )
    total_votes = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()
    selected_option_id = serializers.SerializerMethodField()
    scope_type = serializers.SerializerMethodField()
    scope_target_id = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    can_vote = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyHubPoll
        fields = [
            "id",
            "question",
            "pharmacy",
            "organization",
            "community_group",
            "scope_type",
            "scope_target_id",
            "created_at",
            "updated_at",
            "closes_at",
            "is_closed",
            "options",
            "option_labels",
            "total_votes",
            "has_voted",
            "selected_option_id",
            "created_by",
            "can_vote",
        ]
        read_only_fields = [
            "id",
            "pharmacy",
            "organization",
            "community_group",
            "scope_type",
            "scope_target_id",
            "created_at",
            "updated_at",
            "closes_at",
            "is_closed",
            "options",
            "total_votes",
            "has_voted",
            "selected_option_id",
            "created_by",
            "can_vote",
        ]

    def validate_option_labels(self, value):
        normalized = [label.strip() for label in value if label and label.strip()]
        if len(normalized) < 2:
            raise serializers.ValidationError("Provide at least two poll options.")
        if len(normalized) > 5:
            raise serializers.ValidationError("You can specify up to five options.")
        return normalized

    def create(self, validated_data):
        option_labels = validated_data.pop("option_labels", [])
        poll = PharmacyHubPoll.objects.create(
            question=validated_data["question"],
            pharmacy=self.context.get("pharmacy"),
            organization=self.context.get("organization"),
            community_group=self.context.get("community_group"),
            created_by=self.context.get("request_user"),
            created_by_membership=self.context.get("request_membership"),
        )
        options = [
            PharmacyHubPollOption(
                poll=poll,
                label=label,
                position=index,
            )
            for index, label in enumerate(option_labels)
        ]
        PharmacyHubPollOption.objects.bulk_create(options)
        poll.refresh_from_db()
        return poll

    def get_scope_type(self, obj):
        if obj.community_group_id:
            return "group"
        if obj.pharmacy_id:
            return "pharmacy"
        if obj.organization_id:
            return "organization"
        return None

    def get_scope_target_id(self, obj):
        if obj.community_group_id:
            return obj.community_group_id
        if obj.pharmacy_id:
            return obj.pharmacy_id
        return obj.organization_id

    def get_total_votes(self, obj):
        total = getattr(obj, "_total_votes", None)
        if total is None:
            total = sum(option.vote_count for option in obj.options.all())
            obj._total_votes = total
        return total

    def get_options(self, obj):
        total = self.get_total_votes(obj)
        serializer = HubPollOptionSerializer(
            obj.options.all(),
            many=True,
            context={"total_votes": total},
        )
        return serializer.data

    def _get_membership(self):
        return self.context.get("request_membership")

    def get_has_voted(self, obj):
        membership = self._get_membership()
        if not membership:
            return False
        votes = getattr(obj, "_prefetched_votes", None)
        if votes is None:
            return obj.votes.filter(membership=membership).exists()
        return any(v.membership_id == membership.id for v in votes)

    def get_selected_option_id(self, obj):
        membership = self._get_membership()
        if not membership:
            return None
        votes = getattr(obj, "_prefetched_votes", None)
        if votes is None:
            return (
                obj.votes.filter(membership=membership)
                .values_list("option_id", flat=True)
                .first()
            )
        for vote in votes:
            if vote.membership_id == membership.id:
                return vote.option_id
        return None

    def get_created_by(self, obj):
        membership = getattr(obj, "created_by_membership", None)
        if membership:
            return HubMembershipSerializer(membership).data
        creator = getattr(obj, "created_by", None)
        if not creator:
            return None
        full_name = creator.get_full_name().strip()
        return {
            "id": creator.id,
            "firstName": creator.first_name,
            "lastName": creator.last_name,
            "email": creator.email,
            "fullName": full_name or creator.email,
        }

    def get_can_vote(self, obj):
        membership = self._get_membership()
        return bool(membership) and not obj.is_closed


class HubReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacyHubReaction
        fields = ["reaction_type"]

# class PharmacistOnboardingSerializer(RemoveOldFilesMixin, SyncUserMixin, serializers.ModelSerializer):
#     file_fields = ['government_id', 'gst_file', 'tfn_declaration', 'resume']

#     username   = serializers.CharField(source='user.username',   required=False)
#     first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
#     last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
#     progress_percent = serializers.SerializerMethodField()

#     class Meta:
#         model  = PharmacistOnboarding
#         fields = [
#             'username', 'first_name', 'last_name',
#             'government_id', 'ahpra_number', 'phone_number', 'short_bio', 'resume',
#             'skills', 'software_experience', 'payment_preference',
#             'abn', 'gst_registered', 'gst_file',
#             'tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number',

#             'referee1_name', 'referee1_relation', 'referee1_email', 'referee1_confirmed',
#             'referee2_name', 'referee2_relation', 'referee2_email', 'referee2_confirmed',

#             'rate_preference', 'verified', 'member_of_chain', 'progress_percent',
#             'submitted_for_verification',
#             'gov_id_verified', 'gov_id_verification_note',
#             'gst_file_verified', 'gst_file_verification_note',
#             'tfn_declaration_verified', 'tfn_declaration_verification_note',
#             'abn_verified', 'abn_verification_note',
#             'ahpra_verified',
#             'ahpra_registration_status',
#             'ahpra_registration_type',
#             'ahpra_expiry_date',
#             'ahpra_verification_note',
#         ]
#         extra_kwargs = {
#             'verified':        {'read_only': True},
#             'member_of_chain': {'read_only': True},
#             'submitted_for_verification': {'required': False},
#             'first_name': {'required': False, 'allow_blank': True},
#             'last_name':  {'required': False, 'allow_blank': True},
#             'government_id': {'required': False, 'allow_null': True},
#             'ahpra_number': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'payment_preference': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'referee1_name': {'required': False, 'allow_blank': True},
#             'referee1_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'referee1_email': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'referee1_confirmed': {'required': False},
#             'referee2_name': {'required': False, 'allow_blank': True},
#             'referee2_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'referee2_email': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'referee2_confirmed': {'required': False},
#             'resume': {'required': False, 'allow_null': True},
#             'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'abn': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'gst_file': {'required': False, 'allow_null': True},
#             'tfn_declaration': {'required': False, 'allow_null': True},
#             'super_fund_name': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'super_usi': {'required': False, 'allow_blank': True, 'allow_null': True},
#             'super_member_number': {'required': False, 'allow_blank': True, 'allow_null': True},
#         }

#         read_only_fields = [
#             'gov_id_verified', 'gov_id_verification_note',
#             'gst_file_verified', 'gst_file_verification_note',
#             'tfn_declaration_verified', 'tfn_declaration_verification_note',
#             'abn_verified', 'abn_verification_note',
#             'ahpra_verified',
#             'ahpra_registration_status',
#             'ahpra_registration_type',
#             'ahpra_expiry_date',
#             'ahpra_verification_note',
#             'verified',
#             'progress_percent',
#         ]

#     def _schedule_verification(self, instance):
#         """Helper to cancel any old tasks and schedule a new one."""
#         # This is CRITICAL to prevent race conditions from multiple saves.
#         Schedule.objects.filter(
#             func='client_profile.tasks.run_all_verifications',
#             args=f"'{instance._meta.model_name}',{instance.pk}"
#         ).delete()
#         Schedule.objects.create(
#             func='client_profile.tasks.run_all_verifications',
#             args=f"'{instance._meta.model_name}',{instance.pk}",
#             schedule_type=Schedule.ONCE,
#             next_run=timezone.now() + timedelta(seconds=10)
#         )

#     def create(self, validated_data):
#         user_data = validated_data.pop('user', {})
#         user = self.context['request'].user
#         self.sync_user_fields(user_data, user)
#         instance = PharmacistOnboarding.objects.create(user=user, **validated_data)
#         if validated_data.get('submitted_for_verification', False):
#             self._schedule_verification(instance)
#         return instance

#     def update(self, instance, validated_data):
#         user_data = validated_data.pop('user', {})
#         self.sync_user_fields(user_data, instance.user)

#         # IMPORTANT: Check for changes *before* saving the instance
#         submitted_before = instance.submitted_for_verification
        
#         # Check which specific groups of fields have changed
#         ahpra_changed = verification_fields_changed(instance, validated_data, ["ahpra_number"])
#         gov_id_changed = verification_fields_changed(instance, validated_data, ["government_id"])
#         payment_changed = verification_fields_changed(instance, validated_data, ["payment_preference", "abn", "gst_registered", "gst_file", "tfn_declaration"])
#         referee1_changed = verification_fields_changed(instance, validated_data, ["referee1_name", "referee1_relation", "referee1_email"])
#         referee2_changed = verification_fields_changed(instance, validated_data, ["referee2_name", "referee2_relation", "referee2_email"])

#         # Apply the user's changes to the instance
#         instance = super().update(instance, validated_data)

#         # Now, check if we need to do any resets
#         submitted_now = instance.submitted_for_verification
#         needs_reschedule = False
#         update_fields = []

#         # On first-time submission, reset everything
#         if not submitted_before and submitted_now:
#             needs_reschedule = True
#             # Reset all verification fields
#             for f in instance._meta.fields:
#                 if f.name.endswith('_verified') or f.name.endswith('_verification_note'):
#                     setattr(instance, f.name, False if f.name.endswith('_verified') else "")
#                     update_fields.append(f.name)
#             # Reset referee statuses
#             instance.referee1_confirmed, instance.referee1_rejected = False, False
#             instance.referee2_confirmed, instance.referee2_rejected = False, False
#             update_fields.extend(['referee1_confirmed', 'referee1_rejected', 'referee2_confirmed', 'referee2_rejected'])
#         else: # For subsequent updates, only reset what changed
#             if ahpra_changed:
#                 instance.ahpra_verified, instance.ahpra_verification_note = False, ""
#                 update_fields.extend(['ahpra_verified', 'ahpra_verification_note'])
#                 needs_reschedule = True
#             if gov_id_changed:
#                 instance.gov_id_verified, instance.gov_id_verification_note = False, ""
#                 update_fields.extend(['gov_id_verified', 'gov_id_verification_note'])
#                 needs_reschedule = True
#             if payment_changed:
#                 instance.abn_verified, instance.abn_verification_note = False, ""
#                 instance.gst_file_verified, instance.gst_file_verification_note = False, ""
#                 instance.tfn_declaration_verified, instance.tfn_declaration_verification_note = False, ""
#                 update_fields.extend(['abn_verified', 'abn_verification_note', 'gst_file_verified', 'gst_file_verification_note', 'tfn_declaration_verified', 'tfn_declaration_verification_note'])
#                 needs_reschedule = True
#             if referee1_changed:
#                 instance.referee1_confirmed, instance.referee1_rejected = False, False
#                 update_fields.extend(['referee1_confirmed', 'referee1_rejected'])
#                 needs_reschedule = True
#             if referee2_changed:
#                 instance.referee2_confirmed, instance.referee2_rejected = False, False
#                 update_fields.extend(['referee2_confirmed', 'referee2_rejected'])
#                 needs_reschedule = True

#         # If any resets were performed, save them
#         if needs_reschedule:
#             instance.verified = False
#             update_fields.append('verified')
#             instance.save(update_fields=list(set(update_fields)))
#             self._schedule_verification(instance)
            
#         return instance


#     def validate(self, data):
#         submit = data.get('submitted_for_verification') \
#             or (self.instance and getattr(self.instance, 'submitted_for_verification', False))
#         errors = {}

#         must_have = [
#             'username', 'first_name', 'last_name',
#             'government_id', 'ahpra_number', 'phone_number', 'payment_preference',
#             'referee1_name', 'referee1_relation', 'referee1_email',
#             'referee2_name', 'referee2_relation', 'referee2_email',
#         ]

#         user_data = data.get('user', {})

#         if submit:
#             for f in must_have:
#                 if f in ['username', 'first_name', 'last_name']:
#                     val = (
#                         user_data.get(f)
#                         or (self.instance and hasattr(self.instance, 'user') and getattr(self.instance.user, f, None))
#                     )
#                     if not val:
#                         errors[f] = 'This field is required to submit for verification.'
#                 else:
#                     value = data.get(f)
#                     if value is None and self.instance:
#                         value = getattr(self.instance, f, None)
#                     if not value:
#                         errors[f] = 'This field is required to submit for verification.'

#             pay = data.get('payment_preference') or (self.instance and getattr(self.instance, 'payment_preference', None))
#             if pay:
#                 if pay.lower() == "abn":
#                     abn = data.get('abn') or (self.instance and getattr(self.instance, 'abn', None))
#                     if not abn:
#                         errors['abn'] = 'ABN required when payment preference is ABN.'
#                     gst = data.get('gst_registered')
#                     if gst is None and self.instance:
#                         gst = getattr(self.instance, 'gst_registered', None)
#                     if gst:
#                         gst_file = data.get('gst_file') or (self.instance and getattr(self.instance, 'gst_file', None))
#                         if not gst_file:
#                             errors['gst_file'] = 'GST certificate required if GST registered.'
#                 elif pay.lower() == "tfn":
#                     for f in ['tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number']:
#                         val = data.get(f)
#                         if val is None and self.instance:
#                             val = getattr(self.instance, f, None)
#                         if not val:
#                             errors[f] = f'{f.replace("_", " ").title()} required when payment preference is TFN.'

#         if errors:
#             raise serializers.ValidationError(errors)
#         return data

#     def get_progress_percent(self, obj):
#         required_fields = [
#             obj.user.username,
#             obj.user.first_name,
#             obj.user.last_name,
#             obj.phone_number,
#             obj.payment_preference,
#             obj.resume,
#             obj.short_bio,
#             obj.referee1_confirmed,
#             obj.referee2_confirmed,
#             obj.gov_id_verified,
#             obj.ahpra_verified,
#         ]
#         # ABN/GST
#         if obj.payment_preference and obj.payment_preference.lower() == "abn":
#             required_fields.append(obj.abn_verified)
#             if obj.gst_registered is True:
#                 required_fields.append(obj.gst_file_verified)
#         # TFN
#         if obj.payment_preference and obj.payment_preference.lower() == "tfn":
#             required_fields.append(obj.tfn_declaration_verified)
#             required_fields.append(obj.super_fund_name)
#             required_fields.append(obj.super_usi)
#             required_fields.append(obj.super_member_number)

#         filled = sum(bool(field) for field in required_fields)
#         percent = int(100 * filled / len(required_fields))
#         return percent

