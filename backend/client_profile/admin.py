from django.contrib import admin
from .models import *


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display  = ['id', 'name']
    search_fields = ['name']
    def save_model(self, request, obj, form, change):
        obj.full_clean()  # Enforces model-level validation (e.g. PHARMACIST only)
        super().save_model(request, obj, form, change)


@admin.register(OwnerOnboarding)
class OwnerOnboardingAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'role', 'chain_pharmacy', 'verified',
        'organization', 'organization_claimed'
    ]
    list_filter = [
        'role', 'chain_pharmacy', 'verified',
        'organization', 'organization_claimed'
    ]
    search_fields = [
        'user__username', 'user__email',
        'phone_number', 'organization__name'
    ]
    fields = [
        'user', 'phone_number', 'role', 'chain_pharmacy',
        'ahpra_number', 'verified', 'organization', 'organization_claimed'
    ]
    def save_model(self, request, obj, form, change):
        obj.full_clean()
        super().save_model(request, obj, form, change)

@admin.register(PharmacistOnboarding)
class PharmacistOnboardingAdmin(admin.ModelAdmin):
    list_display = ['user', 'payment_preference', 'verified', 'member_of_chain']
    list_filter  = ['verified', 'member_of_chain', 'payment_preference']
    search_fields = [
        'user__username', 'user__email', 'user__first_name', 'user__last_name', 'ahpra_number'
    ]
    fields = [
        'user',
        'government_id', 'ahpra_number', 'phone_number', 'short_bio', 'resume',
        'skills', 'software_experience', 'payment_preference',
        'abn', 'gst_registered', 'gst_file',
        'tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number',
        'referee1_email', 'referee2_email',
        'rate_preference', 'verified', 'member_of_chain',
    ]
    def save_model(self, request, obj, form, change):
        obj.full_clean()
        super().save_model(request, obj, form, change)

@admin.register(OtherStaffOnboarding)
class OtherStaffOnboardingAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'role_type', 'classification_level', 'student_year',
        'intern_half', 'payment_preference', 'verified'
    ]
    list_filter = [
        'verified', 'payment_preference', 'role_type',
        'classification_level', 'student_year', 'intern_half'
    ]
    search_fields = [
        'user__username', 'user__email', 'user__first_name', 'user__last_name', 'role_type'
    ]
    fields = [
        'user', 'government_id', 'role_type', 'phone_number', 'skills', 'years_experience',
        'payment_preference', 'classification_level', 'student_year', 'intern_half',
        'ahpra_proof', 'hours_proof', 'certificate', 'university_id', 'cpr_certificate', 's8_certificate',
        'abn', 'gst_registered', 'gst_file', 'tfn_declaration', 'super_fund_name', 'super_usi', 'super_member_number',
        'referee1_email', 'referee2_email', 'short_bio', 'resume', 'verified',
    ]
    def save_model(self, request, obj, form, change):
        obj.full_clean()
        super().save_model(request, obj, form, change)

@admin.register(ExplorerOnboarding)
class ExplorerOnboardingAdmin(admin.ModelAdmin):
    list_display = ['user', 'role_type', 'verified']
    list_filter  = ['verified', 'role_type']
    search_fields = [
        'user__username', 'user__email', 'user__first_name', 'user__last_name', 'role_type'
    ]
    fields = [
        'user', 'government_id', 'role_type', 'phone_number', 'interests',
        'referee1_email', 'referee2_email', 'short_bio', 'resume', 'verified'
    ]
    def save_model(self, request, obj, form, change):
        obj.full_clean()
        super().save_model(request, obj, form, change)

@admin.register(Chain)
class ChainAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'owner',
        'organization',
        'primary_contact_email',
        'is_active',
        'created_at',
        'updated_at',
    )
    list_filter = (
        'is_active',
        'owner',
        'organization',
    )
    search_fields = (
        'name',
        'primary_contact_email',
        'owner__user__email',
        'organization__name',
    )
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('pharmacies',)
    raw_id_fields = ('owner',)   # ← makes owner searchable by ID/email
    fieldsets = (
        (None, {
            'fields': (
                'name',
                'logo',
                'primary_contact_email',
                'subscription_plan',
                'pharmacies',
                'is_active',
            )
        }),
        ('Ownership', {
            'fields': ('owner', 'organization'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'owner',
        'organization',
        'verified',
        'abn',
        'asic_number',
        'state',
    )
    list_filter = (
        'verified',
        'owner',
        'organization',
        'state',
    )
    search_fields = (
        'name',
        'owner__user__email',
        'organization__name',
        'state',
    )
    fieldsets = (
        (None, {
            'fields': (
                'name',
                'state',
                'owner',
                'organization',
                'verified',
                'abn',
                'asic_number',
            ),
        }),
    )

@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'pharmacy',
        'is_active',
        'created_at',
        'updated_at',
    )
    list_filter = ('is_active', 'pharmacy')
    search_fields = ('user__email', 'pharmacy__name')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('user', 'pharmacy', 'is_active'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

class ShiftSlotInline(admin.TabularInline):
    model = ShiftSlot
    extra = 1

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    inlines = [ShiftSlotInline]
    list_display = [
        'id','pharmacy','role_needed','employment_type',
        'visibility','reveal_count','single_user_only','created_at', 'created_by'
    ]
    list_filter = [
        'role_needed','employment_type','single_user_only','visibility'
    ]
    search_fields = ['pharmacy__name','role_needed']

@admin.register(ShiftSlotAssignment)
class ShiftSlotAssignmentAdmin(admin.ModelAdmin):
    list_display = ('id','shift','slot','user','assigned_at')
    list_filter  = ('shift','user')
    search_fields = ('user__username','shift__pharmacy__name')

@admin.register(ShiftInterest)
class ShiftInterestAdmin(admin.ModelAdmin):
    list_display = ('id','shift','slot','user','revealed','expressed_at')
    list_filter  = ('revealed','slot','shift')
    search_fields = ('user__username','shift__pharmacy__name')

class InvoiceLineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 0
    fields = (
        'category_code','unit','description',
        'quantity','unit_price','discount','total',
        'gst_applicable','super_applicable','is_manual'
    )
    readonly_fields = ('total',)

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'id','user','status','invoice_date',
        'due_date','total'
    )
    list_filter  = ('status','gst_registered')
    inlines      = [InvoiceLineItemInline]
    readonly_fields = ('subtotal','gst_amount','super_amount','total')

admin.site.register(ExplorerPost)
