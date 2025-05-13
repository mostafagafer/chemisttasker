# client_profile/serializers.py
from rest_framework import serializers
from .models import *
from users.models import OrganizationMembership
from jobs.serializers import JobSerializer, JobApplicationSerializer
from users.serializers import UserProfileSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal

User = get_user_model()

# Onboardings
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name']
        read_only_fields = ['id']

class OwnerOnboardingSerializer(serializers.ModelSerializer):
    # sync these onto the User model
    username   = serializers.CharField(source='user.username',   required=False)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)

    class Meta:
        model  = OwnerOnboarding
        fields = [
            'username', 'first_name', 'last_name',
            'phone_number', 'role', 'chain_pharmacy',
            'ahpra_number', 'verified',
            'organization', 'organization_claimed',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
            'organization': {'read_only': True},  # only Org-Admins can set this
            'organization_claimed': {'read_only': True},
       }

    def _sync_user(self, user, data):
        updated = []
        for attr, val in data.items():
            setattr(user, attr, val)
            updated.append(attr)
        if updated:
            user.save(update_fields=updated)

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        validated_data.pop('user', None)
        user = self.context['request'].user
        self._sync_user(user, user_data)
        return OwnerOnboarding.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        validated_data.pop('user', None)
        user = self.context['request'].user
        self._sync_user(user, user_data)
        return super().update(instance, validated_data)

class PharmacistOnboardingSerializer(serializers.ModelSerializer):
    # both read *and* write from/to the nested `user` relation
    username    = serializers.CharField(source='user.username',    required=False)
    first_name  = serializers.CharField(source='user.first_name',  required=False, allow_blank=True)
    last_name   = serializers.CharField(source='user.last_name',   required=False, allow_blank=True)

    class Meta:
        model  = PharmacistOnboarding
        fields = [
            'username', 'first_name', 'last_name',
            'government_id', 'ahpra_number', 'phone_number', 'short_bio', 'resume',
            'skills', 'software_experience', 'payment_preference',
            'abn', 'gst_registered', 'gst_file',
            'tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number',
            'referee1_email', 'referee2_email',
            'rate_preference', 'verified', 'member_of_chain'
        ]
        extra_kwargs = {
            'verified':        {'read_only': True},
            'member_of_chain': {'read_only': True},
        }

    def _sync_user(self, user, data):
        # only proceed if data is actually a dict of fields
        if not isinstance(data, dict):
            return
        updated = []
        for attr, val in data.items():
            setattr(user, attr, val)
            updated.append(attr)
        if updated:
            user.save(update_fields=updated)

    def create(self, validated_data):
        # pop off any nested user info (may come through as a dict or sometimes as a User instance)
        user_data = validated_data.pop('user', {})
        # now sync username/first/last only if we have a dict
        self._sync_user(self.context['request'].user, user_data)

        # create the actual onboarding row
        return PharmacistOnboarding.objects.create(
            user=self.context['request'].user,
            **validated_data
        )

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        self._sync_user(self.context['request'].user, user_data)
        return super().update(instance, validated_data)

class OtherStaffOnboardingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False)

    class Meta:
        model = OtherStaffOnboarding
        fields = [
            'username',
            'government_id',
            'role_type',
            'phone_number',
            'skills',
            'years_experience',
            'payment_preference',
            'ahpra_proof',
            'hours_proof',
            'certificate',
            'university_id',
            'cpr_certificate',
            's8_certificate',
            'abn',
            'gst_registered',
            'gst_file',
            'tfn_declaration',
            'super_fund_name',
            'super_usi',
            'super_member_number',
            'referee1_email',
            'referee2_email',
            'short_bio',
            'resume',
            'verified',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
        }

    def create(self, validated_data):
        # handle username exactly as in pharmacist serializer
        username = validated_data.pop('username', None)
        user = self.context['request'].user
        if username:
            user.username = username
            user.save(update_fields=['username'])

        # attach the user FK
        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # same username logic on update
        username = validated_data.pop('username', None)
        user = self.context['request'].user
        if username:
            user.username = username
            user.save(update_fields=['username'])

        return super().update(instance, validated_data)

class ExplorerOnboardingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False)

    class Meta:
        model = ExplorerOnboarding
        fields = [
            'username',
            'government_id',
            'role_type',
            'phone_number',
            'interests',
            'referee1_email',
            'referee2_email',
            'short_bio',
            'resume',
            'verified',
        ]
        extra_kwargs = {
            'verified': {'read_only': True},
        }

    def create(self, validated_data):
        # same pattern
        username = validated_data.pop('username', None)
        user = self.context['request'].user
        if username:
            user.username = username
            user.save(update_fields=['username'])

        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        username = validated_data.pop('username', None)
        user = self.context['request'].user
        if username:
            user.username = username
            user.save(update_fields=['username'])

        return super().update(instance, validated_data)

# Dashboards
class OwnerDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    posted_jobs = JobSerializer(many=True)
    total_applications_received = serializers.IntegerField()

class PharmacistDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    applications = JobApplicationSerializer(many=True)
    available_jobs = JobSerializer(many=True)

class OtherStaffDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    applications = JobApplicationSerializer(many=True)
    available_jobs = JobSerializer(many=True)

class ExplorerDashboardResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    message = serializers.CharField()
    available_jobs = JobSerializer(many=True)

class PharmacySerializer(serializers.ModelSerializer):
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

    class Meta:
        model = Pharmacy
        fields = [
            "id",
            "name",
            "address",
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

class ChainSerializer(serializers.ModelSerializer):
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

    class Meta:
        model = Membership
        fields = [
            'id','user','user_details','pharmacy',
            'is_active','created_at','updated_at'
        ]

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

     # for single-user shifts
    accepted_user_id   = serializers.IntegerField(source='accepted_user.id',   read_only=True)
    accepted_user_name = serializers.CharField( source='accepted_user.get_full_name', read_only=True)
    # for multi-slot shifts
    slot_assignments = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = [
            'id', 'created_by','created_at', 'pharmacy',  'pharmacy_detail','role_needed', 'employment_type', 'visibility',
            'escalation_level', 'escalate_to_owner_chain', 'escalate_to_org_chain', 'escalate_to_platform',
            'must_have', 'nice_to_have', 'rate_type', 'fixed_rate', 'slots','single_user_only',
            'interested_users_count', 'reveal_quota', 'reveal_count', 'workload_tags',
            'accepted_user_id','accepted_user_name','slot_assignments',
        ]
        read_only_fields = [
            'id', 'created_by', 'escalation_level',
            'interested_users_count', 'reveal_count'
        ]

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

    # bring rate_type, fixed_rate, workload_tags straight through
    rate_type     = serializers.CharField(read_only=True)
    fixed_rate    = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    workload_tags = serializers.ListField(child=serializers.CharField(), read_only=True)

    # only return the slots that this user is actually assigned to
    slots = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = [
            'id',
            'pharmacy_detail',
            'role_needed',
            'rate_type',
            'fixed_rate',
            'workload_tags',
            'slots',
        ]

    def get_slots(self, obj):
        user = self.context['request'].user

        if obj.single_user_only:
            qs = obj.slots.all() if obj.accepted_user_id == user.id else ShiftSlot.objects.none()
        else:
            qs = obj.slots.filter(assignment__user=user)

        return ShiftSlotSerializer(qs, many=True).data

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

    class Meta:
        model = Invoice
        fields = [
            'id', 'user', 'external', 'pharmacy',
            'pharmacy_name_snapshot', 'pharmacy_address_snapshot', 'pharmacy_abn_snapshot',
            'custom_bill_to_name', 'custom_bill_to_address',
            'pharmacist_abn', 'gst_registered', 'super_rate_snapshot',
            'bank_account_name', 'bsb', 'account_number',
            'super_fund_name', 'super_usi', 'super_member_number',
            'bill_to_email', 'cc_emails',
            'invoice_date', 'due_date',
            'subtotal', 'gst_amount', 'super_amount', 'total',
            'status', 'created_at',
            'line_items',
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
