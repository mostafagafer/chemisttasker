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
    list_display   = [
        'user', 'role', 'chain_pharmacy', 'verified',
        'organization', 'organization_claimed'
    ]
    list_filter    = [
        'role', 'chain_pharmacy', 'verified',
        'organization', 'organization_claimed'
    ]
    search_fields  = [
        'user__username', 'user__email',
        'phone_number', 'organization__name'
    ]
    def save_model(self, request, obj, form, change):
        obj.full_clean()  # Enforces model-level validation (e.g. PHARMACIST only)
        super().save_model(request, obj, form, change)


@admin.register(PharmacistOnboarding)
class PharmacistOnboardingAdmin(admin.ModelAdmin):
    list_display = ['user', 'payment_preference', 'verified', 'member_of_chain']
    list_filter = ['verified', 'member_of_chain', 'payment_preference']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'ahpra_number']

    def save_model(self, request, obj, form, change):
        obj.full_clean()  # Enforces model-level validation (e.g. PHARMACIST only)
        super().save_model(request, obj, form, change)

@admin.register(OtherStaffOnboarding)
class OtherStaffOnboardingAdmin(admin.ModelAdmin):
    list_display = ['user','role_type','payment_preference','verified',]
    list_filter = [ 'verified','payment_preference','role_type', ]
    search_fields = ['user__email','user__first_name','user__last_name','role_type',]

    def save_model(self, request, obj, form, change):
        # Enforce model-level validation before saving
        obj.full_clean()
        super().save_model(request, obj, form, change)

@admin.register(ExplorerOnboarding)
class ExplorerOnboardingAdmin(admin.ModelAdmin):
    list_display = ['user','role_type','verified',]
    list_filter = ['verified','role_type',]
    search_fields = ['user__email','user__first_name','user__last_name','role_type',]

    def save_model(self, request, obj, form, change):
        # Enforce model-level validation before saving
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
    )
    list_filter = (
        'verified',
        'owner',
        'organization',
    )
    search_fields = (
        'name',
        'owner__user__email',
        'organization__name',
    )
    readonly_fields = (
        # add any fields you want read-only, e.g.:
        # 'verified',
    )
    fieldsets = (
        (None, {
            'fields': (
                'name',
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
        'visibility','reveal_count','single_user_only',
        'accepted_user','created_at'
    ]
    list_filter = [
        'role_needed','employment_type','single_user_only','visibility'
    ]
    list_editable = ['accepted_user']
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

admin.site.register(ExplorerPost)


class InvoiceLineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 0
    fields = (
        'category_code','unit','description',
        'quantity','unit_price','discount','total',
        'gst_applicable','super_applicable','is_manual'
    )
    readonly_fields = ('total',)

# @admin.register(Invoice)
# class InvoiceAdmin(admin.ModelAdmin):
#     list_display = (
#         'id', 'invoice_date', 'client_display', 'total', 'status', 'external'
#     )
#     list_filter = ('status', 'external', 'gst_registered')
#     search_fields = (
#         'pharmacy_name_snapshot', 'custom_bill_to_name', 'bill_to_email'
#     )
#     inlines = [InvoiceLineItemInline]
#     fieldsets = (
#         (None, {
#             'fields': ('user', 'status', 'external', 'pharmacy')
#         }),
#         ('Client Snapshot', {
#             'fields': (
#                 'pharmacy_name_snapshot', 'pharmacy_address_snapshot',
#                 'pharmacy_abn_snapshot',
#                 'custom_bill_to_name', 'custom_bill_to_address'
#             )
#         }),
#         ('Billing Details', {
#             'fields': (
#                 'pharmacist_abn', 'gst_registered', 'super_rate_snapshot',
#                 'bank_account_name', 'bsb', 'account_number',
#                 'super_fund_name', 'super_usi', 'super_member_number',
#                 'bill_to_email', 'cc_emails'
#             )
#         }),
#         ('Totals & Dates', {
#             'fields': (
#                 'invoice_date', 'due_date',
#                 'subtotal', 'gst_amount', 'super_amount', 'total'
#             )
#         }),
#     )

#     def client_display(self, obj):
#         """
#         Show the correct client name in list_display
#         """
#         return (
#             obj.custom_bill_to_name if obj.external
#             else obj.pharmacy_name_snapshot
#         )
#     client_display.short_description = 'Client'


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'id','user','status','invoice_date',
        'due_date','total'
    )
    list_filter  = ('status','gst_registered')
    inlines      = [InvoiceLineItemInline]
    readonly_fields = ('subtotal','gst_amount','super_amount','total')
