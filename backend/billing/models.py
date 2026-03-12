from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class OwnerSubscription(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('canceled', 'Canceled'),
    )
    
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='inactive')
    staff_count = models.IntegerField(default=5)
    current_period_end = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.owner.email} - {self.status} ({self.staff_count} staff)"

class ShiftPayment(models.Model):
    PAYMENT_TYPE_CHOICES = (
        ('fulfillment', 'Shift Fulfillment Fee'),
        ('cancellation', 'Cancellation Penalty'),
        ('subscription', 'Subscription'),
    )
    
    PAYMENT_METHOD_CHOICES = (
        ('card', 'Credit Card'),
        ('invoice', 'Invoice / Bank Transfer'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    )

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    shift = models.ForeignKey('client_profile.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_invoice_id = models.CharField(max_length=255, blank=True, null=True)
    
    payment_type = models.CharField(max_length=50, choices=PAYMENT_TYPE_CHOICES)
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending')
    
    amount_aud = models.DecimalField(max_digits=10, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.get_payment_type_display()} - {self.owner.email} - ${self.amount_aud} ({self.status})"
