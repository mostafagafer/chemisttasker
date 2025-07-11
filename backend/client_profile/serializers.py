# client_profile/serializers.py
from rest_framework import viewsets, permissions, serializers
from .models import *
from users.models import OrganizationMembership
from users.serializers import UserProfileSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
from client_profile.utils import send_referee_emails, notify_superuser_on_onboarding
from datetime import date
from django.utils import timezone
from django_q.tasks import async_task
from django.db.models import Q

User = get_user_model()


class RemoveOldFilesMixin:
    """
    Mixin to delete old file blobs before saving new uploads on specified file fields.
    """
    file_fields: list[str] = []

    def update(self, instance, validated_data):
        # Delete old blobs for any file_fields being replaced
        for field in self.file_fields:
            if field in validated_data:
                old = getattr(instance, field)
                if old:
                    old.delete(save=False)
        return super().update(instance, validated_data)

class SyncUserMixin:
    """
    Mixin to sync user fields (username, first_name, last_name) from validated_data.
    """
    USER_FIELDS = ['username', 'first_name', 'last_name']

    def perform_user_sync(self, validated_data):
        user = getattr(self, 'instance', None)
        if user and hasattr(user, 'user'):
            user = user.user
        else:
            user = self.context['request'].user

        user_data = validated_data.pop('user', {})  # Remove 'user' dict if present
        updated = []
        for attr in self.USER_FIELDS:
            if attr in user_data:
                val = user_data[attr]
                setattr(user, attr, val)
                updated.append(attr)
        if updated:
            user.save(update_fields=updated)

# Onboardings
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name']
        read_only_fields = ['id']

class OwnerOnboardingSerializer(SyncUserMixin, serializers.ModelSerializer):
    file_fields = []  # no file uploads on owner onboarding

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

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        obj = OwnerOnboarding.objects.create(user=user, **validated_data)
        old_ahpra_number = ''
        new_ahpra_number = (validated_data.get('ahpra_number') or '').strip().lower()
        self._trigger_verification_tasks(
            obj, validated_data, old_ahpra_number=old_ahpra_number, new_ahpra_number=new_ahpra_number, is_create=True
        )
        notify_superuser_on_onboarding(obj)
        self._maybe_auto_verify(obj)
        return obj

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        old_ahpra_number = (instance.ahpra_number or '').strip().lower()
        obj = super().update(instance, validated_data)
        user = obj.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        new_ahpra_number = (validated_data.get('ahpra_number') or '').strip().lower()
        self._trigger_verification_tasks(
            obj, validated_data, old_ahpra_number=old_ahpra_number, new_ahpra_number=new_ahpra_number, is_create=False
        )
        notify_superuser_on_onboarding(obj)
        self._maybe_auto_verify(obj)
        return obj


    def _maybe_auto_verify(self, obj):
        checks = []
        # Only verify if ahpra_number present
        if obj.ahpra_number:
            checks.append(obj.ahpra_verified)
        # Add any other fields if needed for your business logic

        if checks and all(checks):
            if not obj.verified:
                obj.verified = True
                obj.save(update_fields=['verified'])
        else:
            if obj.verified:
                obj.verified = False
                obj.save(update_fields=['verified'])

    def _trigger_verification_tasks(self, instance, validated_data, old_ahpra_number=None, new_ahpra_number=None, is_create=False):
        """
        Triggers AHPRA verification only if ahpra_number is actually changed or on create.
        """
        if old_ahpra_number is None:
            old_ahpra_number = ''
        if new_ahpra_number is None:
            new_ahpra_number = (validated_data.get('ahpra_number') or '').strip().lower()
        print(f"[AHPRA DEBUG] old_num='{old_ahpra_number}', new_num='{new_ahpra_number}'")
        if is_create or old_ahpra_number != new_ahpra_number:
            print(f"[AHPRA DEBUG] Number changed, triggering verify_ahpra_task for {instance.pk}")
            instance.ahpra_verified = False
            instance.save(update_fields=["ahpra_verified"])
            async_task(
                'client_profile.tasks.verify_ahpra_task',
                model_name='OwnerOnboarding',
                object_pk=instance.pk,
                ahpra_number=new_ahpra_number,
                first_name=instance.user.first_name,
                last_name=instance.user.last_name,
                email=instance.user.email,
            )
        else:
            print(f"[AHPRA DEBUG] Number unchanged, not triggering async task for {instance.pk}")

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


class PharmacistOnboardingSerializer(RemoveOldFilesMixin, SyncUserMixin, serializers.ModelSerializer):
    file_fields = ['government_id', 'gst_file', 'tfn_declaration', 'resume']

    username   = serializers.CharField(source='user.username',   required=False)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model  = PharmacistOnboarding
        fields = [
            'username', 'first_name', 'last_name',
            'government_id', 'ahpra_number', 'phone_number', 'short_bio', 'resume',
            'skills', 'software_experience', 'payment_preference',
            'abn', 'gst_registered', 'gst_file',
            'tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number',

            'referee1_name', 'referee1_relation', 'referee1_email', 'referee1_confirmed',
            'referee2_name', 'referee2_relation', 'referee2_email', 'referee2_confirmed',

            'rate_preference', 'verified', 'member_of_chain', 'progress_percent',
            'submitted_for_verification',
            # Add the new verification fields here
            'gov_id_verified',
            'gst_file_verified',
            'tfn_declaration_verified',
            'abn_verified',
            'ahpra_verified',
            'ahpra_registration_status',
            'ahpra_registration_type',
            'ahpra_expiry_date',
            'ahpra_verification_note',
        ]
        extra_kwargs = {
            'verified':        {'read_only': True},
            'member_of_chain': {'read_only': True},
            'submitted_for_verification': {'required': False},
            # For PATCH compatibility, so you don't get errors on partial updates:
            'first_name': {'required': False, 'allow_blank': True},
            'last_name':  {'required': False, 'allow_blank': True},
            'government_id': {'required': False, 'allow_null': True},
            'ahpra_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
            'payment_preference': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_name': {'required': False, 'allow_blank': True},
            'referee1_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_confirmed': {'required': False},
            'referee2_name': {'required': False, 'allow_blank': True},
            'referee2_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_confirmed': {'required': False},
            'resume': {'required': False, 'allow_null': True},
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'abn': {'required': False, 'allow_blank': True, 'allow_null': True},
            'gst_file': {'required': False, 'allow_null': True},
            'tfn_declaration': {'required': False, 'allow_null': True},
            'super_fund_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'super_usi': {'required': False, 'allow_blank': True, 'allow_null': True},
            'super_member_number': {'required': False, 'allow_blank': True, 'allow_null': True},
        }
    
        read_only_fields = [
            'gov_id_verified',
            'gst_file_verified',
            'tfn_declaration_verified',
            'abn_verified',
            'ahpra_verified',
            'ahpra_registration_status',
            'ahpra_registration_type',
            'ahpra_expiry_date',
            'ahpra_verification_note',
            'verified',
            'progress_percent',
        ]
        
    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        obj = PharmacistOnboarding.objects.create(user=user, **validated_data)

        submitted_now = validated_data.get('submitted_for_verification', False)
        if submitted_now:
            send_referee_emails(obj, validated_data, creation=True)
            notify_superuser_on_onboarding(obj)
            self._trigger_verification_tasks(obj, validated_data, is_create=True)
        else:
            # Reset all verifications
            for field in [
                'gov_id_verified', 'abn_verified', 'ahpra_verified', 
                'gst_file_verified', 'tfn_declaration_verified'
            ]:
                setattr(obj, field, False)
            obj.save(update_fields=[
                'gov_id_verified', 'abn_verified', 'ahpra_verified',
                'gst_file_verified', 'tfn_declaration_verified'
            ])
        self._maybe_auto_verify(obj)
        return obj

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()

        # Save current fields to compare for changes
        old_data = {
            "abn": (instance.abn or '').strip(),
            "ahpra_number": (instance.ahpra_number or '').strip().lower(),
            "government_id": instance.government_id,
            "gst_file": instance.gst_file,
            "tfn_declaration": instance.tfn_declaration,
        }

        obj = super().update(instance, validated_data)

        submitted_now = validated_data.get('submitted_for_verification', False)
        if submitted_now:
            send_referee_emails(obj, validated_data, creation=False)
            notify_superuser_on_onboarding(obj)
            self._trigger_verification_tasks(obj, validated_data, old_data=old_data, is_create=False)
        else:
            # Reset all verifications
            for field in [
                'gov_id_verified', 'abn_verified', 'ahpra_verified', 
                'gst_file_verified', 'tfn_declaration_verified'
            ]:
                setattr(obj, field, False)
            obj.save(update_fields=[
                'gov_id_verified', 'abn_verified', 'ahpra_verified',
                'gst_file_verified', 'tfn_declaration_verified'
            ])
        self._maybe_auto_verify(obj)
        return obj

    def _trigger_verification_tasks(self, instance, validated_data, old_data=None, is_create=False):
        """
        Run only if the key field changed or on create.
        """
        user = instance.user

        # 1. Government ID (OCR)
        new_gov_id = instance.government_id
        changed = is_create or (old_data and old_data.get("government_id") != new_gov_id)
        if new_gov_id and changed:
            print("[DEBUG] Gov ID changed, re-running OCR verification.")
            instance.gov_id_verified = False
            instance.save(update_fields=["gov_id_verified"])
            async_task('client_profile.tasks.verify_filefield_task', 
                model_name=instance._meta.model_name, object_pk=instance.pk,
                file_field='government_id',
                first_name=user.first_name, last_name=user.last_name,
                email=user.email,
                verification_field='gov_id_verified',
            )

        # 2. ABN Verification
        new_abn = (instance.abn or '').strip()
        changed = is_create or (old_data and old_data.get("abn") != new_abn)
        if new_abn and changed:
            print("[DEBUG] ABN changed, re-running ABN verification.")
            instance.abn_verified = False
            instance.save(update_fields=["abn_verified"])
            async_task('client_profile.tasks.verify_abn_task',
                model_name=instance._meta.model_name, object_pk=instance.pk,
                abn_number=new_abn, first_name=user.first_name, last_name=user.last_name, email=user.email
            )

        # 3. AHPRA Verification
        new_ahpra = (instance.ahpra_number or '').strip().lower()
        changed = is_create or (old_data and old_data.get("ahpra_number") != new_ahpra)
        if new_ahpra and changed:
            print("[DEBUG] AHPRA number changed, re-running AHPRA verification.")
            instance.ahpra_verified = False
            instance.save(update_fields=["ahpra_verified"])
            async_task('client_profile.tasks.verify_ahpra_task',
                model_name=instance._meta.model_name, object_pk=instance.pk,
                ahpra_number=new_ahpra, first_name=user.first_name, last_name=user.last_name, email=user.email
            )

        # 4. GST File
        gst_file = instance.gst_file
        changed = is_create or (old_data and old_data.get("gst_file") != gst_file)
        if instance.gst_registered and gst_file and changed:
            print("[DEBUG] GST File changed, re-running GST verification.")
            instance.gst_file_verified = False
            instance.save(update_fields=["gst_file_verified"])
            async_task('client_profile.tasks.verify_filefield_task', 
                model_name=instance._meta.model_name, object_pk=instance.pk,
                file_field='gst_file',
                first_name=user.first_name, last_name=user.last_name,
                email=user.email,
                verification_field='gst_file_verified',
            )

        # 5. TFN Declaration
        tfn_file = instance.tfn_declaration
        changed = is_create or (old_data and old_data.get("tfn_declaration") != tfn_file)
        if instance.payment_preference and instance.payment_preference.lower() == "tfn" and tfn_file and changed:
            print("[DEBUG] TFN Declaration changed, re-running TFN verification.")
            instance.tfn_declaration_verified = False
            instance.save(update_fields=["tfn_declaration_verified"])
            async_task('client_profile.tasks.verify_filefield_task', 
                model_name=instance._meta.model_name, object_pk=instance.pk,
                file_field='tfn_declaration',
                first_name=user.first_name, last_name=user.last_name,
                email=user.email,
                verification_field='tfn_declaration_verified',
            )

    def _maybe_auto_verify(self, obj):
        checks = [obj.gov_id_verified]
        pay = (obj.payment_preference or '').lower() if obj.payment_preference else ''
        if pay == 'abn':
            checks.append(obj.abn_verified)
            if obj.gst_registered:
                checks.append(obj.gst_file_verified)
        elif pay == 'tfn':
            checks.append(obj.tfn_declaration_verified)
        checks.append(obj.ahpra_verified)

        if all(checks):
            if not obj.verified:
                obj.verified = True
                obj.save(update_fields=['verified'])
        else:
            if obj.verified:
                obj.verified = False
                obj.save(update_fields=['verified'])

    def validate(self, data):
        submit = data.get('submitted_for_verification') \
            or (self.instance and getattr(self.instance, 'submitted_for_verification', False))
        errors = {}

        must_have = [
            'username', 'first_name', 'last_name',
            'government_id', 'ahpra_number', 'phone_number', 'payment_preference',
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

        if errors:
            raise serializers.ValidationError(errors)
        return data
    
    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.phone_number,
            obj.payment_preference,
            obj.resume,
            obj.short_bio,
            obj.referee1_confirmed,
            obj.referee2_confirmed,
            obj.gov_id_verified,
            obj.ahpra_verified,
        ]
        # ABN/GST
        if obj.payment_preference and obj.payment_preference.lower() == "abn":
            required_fields.append(obj.abn_verified)
            if obj.gst_registered is True:
                required_fields.append(obj.gst_file_verified)
        # TFN
        if obj.payment_preference and obj.payment_preference.lower() == "tfn":
            required_fields.append(obj.tfn_declaration_verified)
            required_fields.append(obj.super_fund_name)
            required_fields.append(obj.super_usi)
            required_fields.append(obj.super_member_number)

        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields))
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
            # verification fields:
            'gov_id_verified',
            'ahpra_proof_verified',
            'hours_proof_verified',
            'certificate_verified',
            'university_id_verified',
            'cpr_certificate_verified',
            's8_certificate_verified',
            'gst_file_verified',
            'tfn_declaration_verified',
            'abn_verified',
            'ahpra_verified',

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
            'referee2_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_confirmed': {'required': False},
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume': {'required': False, 'allow_null': True},
        }

        read_only_fields = [
            'gov_id_verified',
            'ahpra_proof_verified',
            'hours_proof_verified',
            'certificate_verified',
            'university_id_verified',
            'cpr_certificate_verified',
            's8_certificate_verified',
            'gst_file_verified',
            'tfn_declaration_verified',
            'abn_verified',
            'ahpra_verified',
            'verified',
            'progress_percent',
        ]

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        obj = OtherStaffOnboarding.objects.create(user=user, **validated_data)
        submitted_now = validated_data.get('submitted_for_verification', False)
        if submitted_now:
            send_referee_emails(obj, validated_data, creation=True)
            notify_superuser_on_onboarding(obj)
            self._trigger_verification_tasks(obj, validated_data, old_data=None, is_create=True)
        else:
            # Reset all verifications
            for field in self.Meta.read_only_fields:
                if field.endswith('_verified'):
                    setattr(obj, field, False)
            obj.save(update_fields=[f for f in self.Meta.read_only_fields if f.endswith('_verified')])
        self._maybe_auto_verify(obj)
        return obj

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        # Track old values for change detection
        verification_fields = [
            'abn', 'ahpra_number', 'government_id', 'ahpra_proof',
            'hours_proof', 'certificate', 'university_id', 'cpr_certificate',
            's8_certificate', 'gst_file', 'tfn_declaration'
        ]
        old_data = {f: getattr(instance, f, None) for f in verification_fields}
        obj = super().update(instance, validated_data)
        submitted_now = validated_data.get('submitted_for_verification', False)
        if submitted_now:
            send_referee_emails(obj, validated_data, creation=False)
            notify_superuser_on_onboarding(obj)
            self._trigger_verification_tasks(obj, validated_data, old_data=old_data, is_create=False)
        else:
            for field in self.Meta.read_only_fields:
                if field.endswith('_verified'):
                    setattr(obj, field, False)
            obj.save(update_fields=[f for f in self.Meta.read_only_fields if f.endswith('_verified')])
        self._maybe_auto_verify(obj)
        return obj

    def _trigger_verification_tasks(self, instance, validated_data, old_data=None, is_create=False):
        user = instance.user
        # --- ABN ---
        abn = getattr(instance, 'abn', None)
        abn_changed = is_create or (old_data and old_data.get('abn') != abn)
        if abn and abn_changed:
            async_task(
                'client_profile.tasks.verify_abn_task',
                'OtherStaffOnboarding', instance.pk,
                abn, user.first_name, user.last_name, user.email,
            )
        # --- AHPRA ---
        ahpra_number = getattr(instance, 'ahpra_number', None)
        ahpra_changed = is_create or (old_data and old_data.get('ahpra_number') != ahpra_number)
        if ahpra_number and ahpra_changed:
            async_task(
                'client_profile.tasks.verify_ahpra_task',
                'OtherStaffOnboarding', instance.pk,
                ahpra_number, user.first_name, user.last_name, user.email,
            )
        # --- Filefield verifications ---
        for ffield in [
            ('government_id', 'gov_id_verified'),
            ('ahpra_proof', 'ahpra_proof_verified'),
            ('hours_proof', 'hours_proof_verified'),
            ('certificate', 'certificate_verified'),
            ('university_id', 'university_id_verified'),
            ('cpr_certificate', 'cpr_certificate_verified'),
            ('s8_certificate', 's8_certificate_verified'),
            ('gst_file', 'gst_file_verified'),
            ('tfn_declaration', 'tfn_declaration_verified'),
        ]:
            field, ver_field = ffield
            fval = getattr(instance, field, None)
            changed = is_create or (old_data and old_data.get(field) != fval)
            if fval and changed:
                async_task(
                    'client_profile.tasks.verify_filefield_task',
                    'OtherStaffOnboarding', instance.pk,
                    field, user.first_name, user.last_name, user.email, ver_field
                )

    def _maybe_auto_verify(self, obj):
        checks = [obj.gov_id_verified]
        if obj.ahpra_proof:
            checks.append(obj.ahpra_proof_verified)
        if obj.hours_proof:
            checks.append(obj.hours_proof_verified)
        if obj.certificate:
            checks.append(obj.certificate_verified)
        if obj.university_id:
            checks.append(obj.university_id_verified)
        if obj.cpr_certificate:
            checks.append(obj.cpr_certificate_verified)
        if obj.s8_certificate:
            checks.append(obj.s8_certificate_verified)
        if obj.gst_registered:
            checks.append(obj.gst_file_verified)
        if obj.payment_preference and obj.payment_preference.lower() == 'abn':
            checks.append(obj.abn_verified)
        if obj.payment_preference and obj.payment_preference.lower() == 'tfn':
            checks.append(obj.tfn_declaration_verified)
        # ADD referee confirmations here!
        checks.append(obj.referee1_confirmed)
        checks.append(obj.referee2_confirmed)

        # Only consider as verified if ALL submitted/required docs have their verified flags True
        if all(checks):
            if not obj.verified:
                obj.verified = True
                obj.save(update_fields=['verified'])
        else:
            if obj.verified:
                obj.verified = False
                obj.save(update_fields=['verified'])

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
            obj.gov_id_verified,             # << Use verified field
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

class ExplorerOnboardingSerializer(RemoveOldFilesMixin, SyncUserMixin, serializers.ModelSerializer):
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
            'verified', 'progress_percent', 'gov_id_verified',

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
            'referee1_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee1_confirmed': {'required': False},
            'referee2_name': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_relation': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'referee2_confirmed': {'required': False},
            'short_bio': {'required': False, 'allow_blank': True, 'allow_null': True},
            'resume': {'required': False, 'allow_null': True},
        }

        read_only_fields = [
            'gov_id_verified',
            'verified',
            'progress_percent',
        ]

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        user = self.context['request'].user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        obj = ExplorerOnboarding.objects.create(user=user, **validated_data)
        submitted_now = validated_data.get('submitted_for_verification', False)
        if submitted_now:
            send_referee_emails(obj, validated_data, creation=True)
            notify_superuser_on_onboarding(obj)
            self._trigger_verification_tasks(obj, validated_data, old_data=None, is_create=True)
        else:
            obj.gov_id_verified = False
            obj.save(update_fields=['gov_id_verified'])
        self._maybe_auto_verify(obj)
        return obj

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        old_data = {'government_id': getattr(instance, 'government_id', None)}
        obj = super().update(instance, validated_data)
        submitted_now = validated_data.get('submitted_for_verification', False)
        if submitted_now:
            send_referee_emails(obj, validated_data, creation=False)
            notify_superuser_on_onboarding(obj)
            self._trigger_verification_tasks(obj, validated_data, old_data=old_data, is_create=False)
        else:
            obj.gov_id_verified = False
            obj.save(update_fields=['gov_id_verified'])
        self._maybe_auto_verify(obj)
        return obj

    def _maybe_auto_verify(self, obj):
        # Only require gov_id_verified for explorers
        checks = [obj.gov_id_verified]
        # ADD referee confirmations here!
        checks.append(obj.referee1_confirmed)
        checks.append(obj.referee2_confirmed)
        if all(checks):
            if not obj.verified:
                obj.verified = True
                obj.save(update_fields=['verified'])
        else:
            if obj.verified:
                obj.verified = False
                obj.save(update_fields=['verified'])

    def _trigger_verification_tasks(self, instance, validated_data, old_data=None, is_create=False):
        user = instance.user
        field = 'government_id'
        ver_field = 'gov_id_verified'
        fval = getattr(instance, field, None)
        changed = is_create or (old_data and old_data.get(field) != fval)
        if fval and changed:
            async_task(
                'client_profile.tasks.verify_filefield_task',
                'ExplorerOnboarding', instance.pk,
                field, user.first_name, user.last_name, user.email, ver_field
            )

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

# Dashboards
class OwnerDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    total_applications_received = serializers.IntegerField()

class PharmacistDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()

class OtherStaffDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()

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

    class Meta:
        model = Pharmacy
        fields = [
            "id",
            "name",
            "address",
            "state",
            "owner",
            "organization",
            "verified",
            "abn",
            "asic_number",
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
        read_only_fields = ["owner", "verified"]
    def get_has_chain(self, obj):
        # “Does this owner have at least one Chain?”
        return Chain.objects.filter(owner=obj.owner).exists()

    def get_claimed(self, obj):
        # “Has the owner been claimed by an Organization?”
        return getattr(obj.owner, 'organization_claimed', False)

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
            'allowed_escalation_levels','is_single_user']
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
        ]

class RosterUserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email']

class RosterShiftDetailSerializer(serializers.ModelSerializer):
    pharmacy_name = serializers.CharField(source='pharmacy.name', read_only=True)
    class Meta:
        model = Shift
        fields = ['id', 'role_needed', 'pharmacy_name', 'visibility']

# === REPLACE YOUR OLD RosterAssignmentSerializer WITH THIS ===
class RosterAssignmentSerializer(serializers.ModelSerializer):
    user_detail = RosterUserDetailSerializer(source='user', read_only=True)
    slot_detail = ShiftSlotSerializer(source='slot', read_only=True) # Reuses your existing ShiftSlotSerializer
    shift_detail = RosterShiftDetailSerializer(source='shift', read_only=True)

    class Meta:
        model = ShiftSlotAssignment
        fields = [
            "id", "slot_date", "unit_rate", "rate_reason", "is_rostered",
            "user", "slot", "shift",
            "user_detail",
            "slot_detail",
            "shift_detail"
        ]


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

