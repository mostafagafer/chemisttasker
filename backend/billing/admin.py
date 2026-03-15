from django.contrib import admin

from .models import OwnerSubscription, ShiftPayment


@admin.register(OwnerSubscription)
class OwnerSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'account_type',
        'account_name',
        'billing_contact',
        'status',
        'staff_count',
        'stripe_customer_id',
        'stripe_subscription_id',
        'updated_at',
    )
    list_filter = ('status', 'created_at', 'updated_at')
    search_fields = (
        'owner__email',
        'owner__first_name',
        'owner__last_name',
        'organization__name',
        'billing_contact__email',
        'stripe_customer_id',
        'stripe_subscription_id',
    )
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('owner', 'organization', 'billing_contact')

    def account_type(self, obj):
        return 'Organization' if obj.organization_id else 'Owner'

    account_type.short_description = 'Account type'

    def account_name(self, obj):
        if obj.organization_id:
            return obj.organization.name
        if obj.owner_id:
            return obj.owner.get_full_name() or obj.owner.email
        return '-'

    account_name.short_description = 'Billing account'


@admin.register(ShiftPayment)
class ShiftPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'owner',
        'shift',
        'payment_type',
        'payment_method',
        'status',
        'amount_aud',
        'stripe_payment_intent_id',
        'paid_at',
        'created_at',
    )
    list_filter = ('payment_type', 'payment_method', 'status', 'created_at', 'paid_at')
    search_fields = (
        'owner__email',
        'owner__first_name',
        'owner__last_name',
        'shift__id',
        'stripe_payment_intent_id',
        'stripe_invoice_id',
    )
    readonly_fields = ('created_at', 'paid_at')
    autocomplete_fields = ('owner', 'shift')
