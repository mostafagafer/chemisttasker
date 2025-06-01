# client_profile/serializers.py
from rest_framework import serializers
from .models import *
from users.models import OrganizationMembership
from users.serializers import UserProfileSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal

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
    Mixin to sync nested user fields on create/update.
    """
    def _sync_user(self, user, data):
        if not isinstance(data, dict):
            return
        updated = []
        for attr, val in data.items():
            setattr(user, attr, val)
            updated.append(attr)
        if updated:
            user.save(update_fields=updated)

    def perform_user_sync(self, validated_data):
        user_data = validated_data.pop('user', {})
        self._sync_user(self.context['request'].user, user_data)

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
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
            'organization': {'read_only': True},  # only Org-Admins may set
            'organization_claimed': {'read_only': True},
        }

    def create(self, validated_data):
        self.perform_user_sync(validated_data)
        return OwnerOnboarding.objects.create(
            user=self.context['request'].user,
            **validated_data
        )

    def update(self, instance, validated_data):
        self.perform_user_sync(validated_data)
        return super().update(instance, validated_data)

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.phone_number,
            obj.role,
        ]
        # Only count AHPRA for pharmacists:
        if obj.role == "PHARMACIST":
            required_fields.append(obj.ahpra_number)
        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields))
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
            'referee1_email', 'referee2_email',
            'rate_preference', 'verified', 'member_of_chain', 'progress_percent',
        ]
        extra_kwargs = {
            'verified':        {'read_only': True},
            'member_of_chain': {'read_only': True},
        }

    def create(self, validated_data):
        self.perform_user_sync(validated_data)
        return PharmacistOnboarding.objects.create(
            user=self.context['request'].user,
            **validated_data
        )

    def update(self, instance, validated_data):
        self.perform_user_sync(validated_data)
        return super().update(instance, validated_data)

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.government_id,
            obj.ahpra_number,
            obj.phone_number,
            obj.payment_preference,
            obj.referee1_email,
            obj.referee2_email,
            obj.resume,
            obj.short_bio,
        ]
        # ABN is only required if payment_preference is "abn"
        if obj.payment_preference and obj.payment_preference.lower() == "abn":
            required_fields.append(obj.abn)
            if obj.gst_registered ==True:
                required_fields.append(obj.gst_file)

        # TFN is only required if payment_preference is "TFN"
        if obj.payment_preference and obj.payment_preference.lower() == "tfn":
            required_fields.append(obj.tfn_declaration)
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
            'classification_level',
            'student_year',
            'intern_half',
            'ahpra_proof', 'hours_proof', 'certificate', 'university_id',
            'cpr_certificate', 's8_certificate',
            'abn', 'gst_registered', 'gst_file', 'tfn_declaration',
            'super_fund_name', 'super_usi', 'super_member_number',
            'referee1_email', 'referee2_email', 'short_bio', 'resume',
            'verified', 'progress_percent',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
        }
    def validate(self, data):
        role = data.get('role_type')

        if role == 'STUDENT' and not data.get('student_year'):
            raise serializers.ValidationError({'student_year': 'Required for Pharmacy Students.'})
        if role == 'ASSISTANT' and not data.get('classification_level'):
            raise serializers.ValidationError({'classification_level': 'Required for Pharmacy Assistants.'})
        if role == 'INTERN' and not data.get('intern_half'):
            raise serializers.ValidationError({'intern_half': 'Required for Intern Pharmacists.'})

        return data

    def create(self, validated_data):
        self.perform_user_sync(validated_data)
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self.perform_user_sync(validated_data)
        return super().update(instance, validated_data)

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.government_id,
            obj.phone_number,
            obj.role_type,
            obj.payment_preference,
            obj.referee1_email,
            obj.referee2_email,
            obj.resume,
            obj.short_bio,
        ]
        if obj.role_type == "STUDENT":
            required_fields.append(obj.student_year)
            required_fields.append(obj.university_id)
        if obj.role_type == "ASSISTANT":
            required_fields.append(obj.classification_level)
            required_fields.append(obj.certificate)
        if obj.role_type == "TECHNICIAN":
            required_fields.append(obj.certificate)
        if obj.role_type == "INTERN":
            required_fields.append(obj.intern_half)
            required_fields.append(obj.ahpra_proof)
            required_fields.append(obj.hours_proof)

        # ABN is only required if payment_preference is "abn"
        if obj.payment_preference and obj.payment_preference.lower() == "abn":
            required_fields.append(obj.abn)
            if obj.gst_registered ==True:
                required_fields.append(obj.gst_file)

        # TFN is only required if payment_preference is "TFN"
        if obj.payment_preference and obj.payment_preference.lower() == "tfn":
            required_fields.append(obj.tfn_declaration)
            required_fields.append(obj.super_fund_name)
            required_fields.append(obj.super_usi)
            required_fields.append(obj.super_member_number)


        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields))
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
            'interests', 'referee1_email', 'referee2_email',
            'short_bio', 'resume', 'verified', 'progress_percent',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
        }

    def create(self, validated_data):
        self.perform_user_sync(validated_data)
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self.perform_user_sync(validated_data)
        return super().update(instance, validated_data)

    def get_progress_percent(self, obj):
        required_fields = [
            obj.user.username,
            obj.user.first_name,
            obj.user.last_name,
            obj.government_id,
            obj.phone_number,
            obj.role_type,
            obj.referee1_email,
            obj.referee2_email,
            obj.resume,
            obj.short_bio,
        ]
        filled = sum(bool(field) for field in required_fields)
        percent = int(100 * filled / len(required_fields))
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
            'id',
            'user',
            'user_details',
            'pharmacy',
            'invited_by',
            'invited_by_details',
            'invited_name',
            'role',
            'employment_type',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['invited_by', 'invited_by_details', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and not validated_data.get('invited_by'):
            validated_data['invited_by'] = request.user
        return super().create(validated_data)


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

    class Meta:
        model = Shift
        fields = [
            'id', 'created_by','created_at', 'pharmacy',  'pharmacy_detail','role_needed', 'employment_type', 'visibility',
            'escalation_level', 'escalate_to_owner_chain', 'escalate_to_org_chain', 'escalate_to_platform',
            'must_have', 'nice_to_have', 'rate_type', 'fixed_rate', 'owner_adjusted_rate','slots','single_user_only',
            'interested_users_count', 'reveal_quota', 'reveal_count', 'workload_tags','slot_assignments',
        ]
        read_only_fields = [
            'id', 'created_by', 'escalation_level',
            'interested_users_count', 'reveal_count'
        ]
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
        """Return the escalation path based on Org-Admin status, chain, and claim."""
        is_org_admin = OrganizationMembership.objects.filter(
            user=user, role='ORG_ADMIN', organization_id=pharmacy.organization_id
        ).exists()

        owner    = pharmacy.owner
        claimed  = getattr(owner, 'organization_claimed', False) if owner else False
        has_chain = Chain.objects.filter(owner=owner).exists() if owner else False

        # 1) Org-Admins always get every tier
        if is_org_admin:
            return ['PHARMACY', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM']

        # 2) If no chain AND not claimed, start at PLATFORM only
        if not has_chain and not claimed:
            return ['PLATFORM']

        # 3) Otherwise build from PHARMACY…
        tiers = ['PHARMACY']

        # …then OWNER_CHAIN if there’s a paid chain
        if has_chain:
            tiers.append('OWNER_CHAIN')

        # …then ORG_CHAIN if claimed
        if claimed:
            tiers.append('ORG_CHAIN')

        # …and finally PLATFORM
        tiers.append('PLATFORM')
        return tiers

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
    def get_slot_assignments(self, shift):
        return [
        {'slot_id': a.slot.id, 'user_id': a.user.id}
            for a in shift.slot_assignments.all()
        ]

class ShiftInterestSerializer(serializers.ModelSerializer):
    user     = serializers.StringRelatedField(read_only=True)
    user_id  = serializers.IntegerField(source='user.id', read_only=True)
    slot_id  = serializers.IntegerField(source='slot.id', read_only=True)
    slot_time = serializers.SerializerMethodField()

    # ← SWITCH from MethodField to direct BooleanField
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
            'revealed',        # ← now comes from the model
            'expressed_at',
        ]
        read_only_fields = [
            'id','user','user_id','slot_time','revealed','expressed_at'
        ]

    def get_slot_time(self, obj):
        slot = obj.slot
        if not slot:
            return ''
        date_str  = slot.date.strftime('%Y-%m-%d')
        start_str = slot.start_time.strftime('%H:%M')
        end_str   = slot.end_time.strftime('%H:%M')
        return f"{date_str} {start_str}–{end_str}"

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

