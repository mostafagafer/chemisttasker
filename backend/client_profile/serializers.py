# client_profile/serializers.py
from rest_framework import serializers
from .models import *
from users.models import OrganizationMembership
from users.serializers import UserProfileSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
from client_profile.utils import q6, send_referee_emails, clean_email
from datetime import date, timedelta
from django.utils import timezone
from django_q.tasks import async_task
import logging
logger = logging.getLogger(__name__)
User = get_user_model()
from django_q.models import Schedule
from client_profile.tasks import schedule_referee_reminder



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
            'organization', 'organization_claimed', 'progress_percent',
            'ahpra_verified',
            'ahpra_registration_status',
            'ahpra_registration_type',
            'ahpra_expiry_date',
            'ahpra_verification_note',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
            'organization': {'read_only': True},
            'organization_claimed': {'read_only': True},
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
            'username', 'first_name', 'last_name',
            'government_id', 'role_type', 'phone_number',
            'interests',
            'referee1_name', 'referee1_relation', 'referee1_email', 'referee1_confirmed',
            'referee2_name', 'referee2_relation', 'referee2_email', 'referee2_confirmed',
            'short_bio', 'resume',
            'verified', 'progress_percent', 'gov_id_verified', 'gov_id_verification_note',

            'submitted_for_verification',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
            'submitted_for_verification': {'required': False},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name':  {'required': False, 'allow_blank': True},
            'government_id': {'required': False, 'allow_null': True},
            'role_type': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
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
            obj.phone_number,
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


    latitude  = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=18, decimal_places=12, required=False, allow_null=True)

    tfn = serializers.CharField(
        source='tfn_number', write_only=True, required=False, allow_blank=True, allow_null=True
    )
    tfn_masked = serializers.SerializerMethodField(read_only=True)

    # write-only control flags
    tab = serializers.CharField(write_only=True, required=False)
    submitted_for_verification = serializers.BooleanField(write_only=True, required=False)

    # computed
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = PharmacistOnboarding
        fields = [
            # ---------- BASIC ----------
            'username','first_name','last_name','phone_number',
            'government_id','ahpra_number',
            'street_address','suburb','state','postcode','google_place_id','latitude','longitude',
            'gov_id_verified','gov_id_verification_note',
            'ahpra_verified','ahpra_registration_status','ahpra_registration_type','ahpra_expiry_date',
            'ahpra_verification_note',


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
            'ahpra_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'government_id': {'required': False, 'allow_null': True},

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

    # -------- progress --------
    def get_progress_percent(self, obj):
        user = getattr(obj, 'user', None)
        checks = [
            bool(getattr(user, 'username', None)),
            bool(getattr(user, 'first_name', None)),
            bool(getattr(user, 'last_name', None)),
            bool(obj.phone_number),
            bool(obj.gov_id_verified),
            bool(obj.ahpra_verified),
            bool(getattr(obj, 'referee1_confirmed', False)),
            bool(getattr(obj, 'referee2_confirmed', False)),
        ]

        # Payment contribution
        pref = (obj.payment_preference or '').upper()
        if pref == 'ABN':
            # count only when ABN exists and has been verified by the task
            checks.append(bool(obj.abn) and bool(obj.abn_verified))
        elif pref == 'TFN':
            # count when TFN text exists (we never return raw value)
            checks.append(bool(getattr(obj, 'tfn_number', None)))
        # if no preference yet -> contributes nothing

        filled = sum(1 for x in checks if x)
        total = len(checks) or 1
        return int(100 * filled / total)

    # -------- update --------
    def update(self, instance, validated_data):
        tab = (self.initial_data.get('tab') or 'basic').strip().lower()
        submit = bool(self.initial_data.get('submitted_for_verification'))

        if tab == 'basic':
            return self._basic_tab(instance, validated_data, submit)
        if tab == 'payment':
            return self._payment_tab(instance, validated_data, submit)
        if tab == 'referees':
            return self._referees_tab(instance, validated_data, submit)


        # pass-through (shouldn’t happen)
        return super().update(instance, validated_data)

    # ---------------- BASIC TAB ----------------
    def _basic_tab(self, instance: PharmacistOnboarding, vdata: dict, submit: bool):
        # nested user data
        user_data = vdata.pop('user', {})

        if user_data:
            changed_user_fields = []
            for k in ('username', 'first_name', 'last_name'):
                if k in user_data:
                    setattr(instance.user, k, user_data[k])
                    changed_user_fields.append(k)
            if changed_user_fields:
                instance.user.save(update_fields=changed_user_fields)

        # fields written directly (exclude lat/lon to handle rounding)
        direct_fields = [
            'phone_number', 'ahpra_number', 'government_id',
            'street_address', 'suburb', 'state', 'postcode', 'google_place_id',
        ]

        # detect changes that affect verification flags
        def _fname(f): return getattr(f, 'name', None) if f else None
        ahpra_changed = 'ahpra_number' in vdata and (vdata.get('ahpra_number') != getattr(instance, 'ahpra_number'))
        gov_id_changed = 'government_id' in vdata and (_fname(vdata.get('government_id')) != _fname(getattr(instance, 'government_id')))

        update_fields = []
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

        if gov_id_changed:
            instance.gov_id_verified = False
            instance.gov_id_verification_note = ""
            update_fields += ['gov_id_verified', 'gov_id_verification_note']

        # full profile remains unverified until all tabs pass
        if submit:
            instance.verified = False
            update_fields.append('verified')

        if update_fields:
            instance.save(update_fields=list(set(update_fields)))

        # trigger ONLY the basic-tab tasks when submitting
        if submit:
            ahpra = vdata.get('ahpra_number', instance.ahpra_number)
            gov   = vdata.get('government_id', instance.government_id)
            errors = {}
            if not ahpra:
                errors['ahpra_number'] = ['AHPRA number is required to submit.']
            if not gov:
                errors['government_id'] = ['Government ID file is required to submit.']
            if errors:
                raise serializers.ValidationError(errors)            # AHPRA: changed OR not verified yet
            if instance.ahpra_number and (ahpra_changed or not instance.ahpra_verified):
                async_task(
                    'client_profile.tasks.verify_ahpra_task',
                    instance._meta.model_name, instance.pk,
                    instance.ahpra_number, instance.user.first_name,
                    instance.user.last_name, instance.user.email,
                )

            # GOV ID: file changed OR not verified yet
            if instance.government_id and (gov_id_changed or not instance.gov_id_verified):
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
        ]

        read_only_fields = ["owner", "organization", "verified"]
    def get_has_chain(self, obj):
        # “Does this owner have at least one Chain?”
        return Chain.objects.filter(owner=obj.owner).exists()

    def get_claimed(self, obj):
        # “Has the owner been claimed by an Organization?”
        return getattr(obj.owner, 'organization_claimed', False)

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

class MembershipSerializer(serializers.ModelSerializer):
    user_details = UserProfileSerializer(source='user', read_only=True)
    invited_by_details = UserProfileSerializer(source='invited_by', read_only=True)

    class Meta:
        model = Membership
        fields = [
            'id', 'user', 'user_details', 'pharmacy', 'invited_by', 'invited_by_details',
            'invited_name', 'role', 'employment_type', 'is_active', 'created_at', 'updated_at',
            # All classification fields are included and will be handled automatically
            'pharmacist_award_level',
            'otherstaff_classification_level',
            'intern_half',
            'student_year',
        ]
        read_only_fields = [
            'invited_by', 'invited_by_details', 'created_at', 'updated_at',
        ]

    # No 'create' method needed. The default ModelSerializer.create() works perfectly
    # because all the classification fields are listed in Meta.fields. It will
    # create the new Membership object and save all provided fields in one step.

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


# === Shifts ===
class ShiftSlotSerializer(serializers.ModelSerializer):
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
            role = request.data.get('role_needed') or self.initial_data.get('role_needed')
            if role != 'PHARMACIST':
                fields.pop('fixed_rate', None)
                fields.pop('rate_type', None)

        return fields

    def _build_allowed_tiers(self, pharmacy, user):
        """
        Return the escalation path based on Org-Admin status, chain, and claim.
        Supports five-level escalation: FULL_PART_TIME, LOCUM_CASUAL, OWNER_CHAIN, ORG_CHAIN, PLATFORM.
        """
        is_org_admin = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN', organization_id=pharmacy.organization_id
        ).exists()

        owner    = pharmacy.owner
        claimed  = getattr(owner, 'organization_claimed', False) if owner else False
        has_chain = Chain.objects.filter(owner=owner).exists() if owner else False

        # 1) Org-Admins always get every tier
        if is_org_admin:
            return ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM']

        # 2) If no chain AND not claimed, start at PLATFORM only
        if not has_chain and not claimed:
            return ['PLATFORM']

        # 3) Otherwise, escalate from FULL_PART_TIME onward
        tiers = ['FULL_PART_TIME', 'LOCUM_CASUAL']

        # …then OWNER_CHAIN if there’s a chain
        if has_chain:
            tiers.append('OWNER_CHAIN')

        # …then ORG_CHAIN if claimed
        if claimed:
            tiers.append('ORG_CHAIN')

        # …and finally PLATFORM
        tiers.append('PLATFORM')
        return tiers

    def get_allowed_escalation_levels(self, obj):
        request = self.context.get('request')
        if request:
            # Make sure _build_allowed_tiers is also defined within ShiftSerializer
            return self._build_allowed_tiers(obj.pharmacy, request.user)
        return []

    def create(self, validated_data):
        slots_data = validated_data.pop('slots')
        user        = self.context['request'].user
        pharmacy    = validated_data['pharmacy']

        # Build the correct path
        allowed_tiers = self._build_allowed_tiers(pharmacy, user)

        # Ensure the front-end’s choice is valid
        chosen = validated_data.get('visibility')
        if chosen not in allowed_tiers:
            raise serializers.ValidationError({
                'visibility': f"Invalid choice; must be one of {allowed_tiers}"
            })

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
            allowed_tiers = self._build_allowed_tiers(instance.pharmacy, self.context['request'].user)
            new_vis = validated_data['visibility']
            if new_vis not in allowed_tiers:
                raise serializers.ValidationError({
                    'visibility': f"Invalid choice; must be one of {allowed_tiers}"
                })
            instance.escalation_level = allowed_tiers.index(new_vis)

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


    def get_slot_assignments(self, shift):
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
            'description',
        ]

class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'slot_assignment', 'user', 'leave_type', 'note',
            'status', 'date_applied', 'date_resolved'
        ]
        read_only_fields = ['id', 'user', 'status', 'date_applied', 'date_resolved']

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
        request = self.context.get('request')
        if not request:
            return []

        pharmacy = obj.pharmacy
        user = request.user

        # This logic determines which tiers are available based on the user and pharmacy
        is_org_admin = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN', organization_id=pharmacy.organization_id
        ).exists()

        owner = pharmacy.owner
        claimed = getattr(owner, 'organization_claimed', False) if owner else False
        has_chain = Chain.objects.filter(owner=owner).exists() if owner else False

        if is_org_admin:
            return ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM']

        tiers = ['FULL_PART_TIME', 'LOCUM_CASUAL']
        if has_chain:
            tiers.append('OWNER_CHAIN')
        if claimed:
            tiers.append('ORG_CHAIN')
        tiers.append('PLATFORM')
        return tiers

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
class ExplorerPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExplorerPost
        fields = '__all__'

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

