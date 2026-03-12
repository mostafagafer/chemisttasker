from django.urls import path
from . import views

app_name = 'billing'

urlpatterns = [
    path('subscribe/', views.create_subscription_checkout, name='subscribe'),
    path('charge-fulfillment/<int:shift_id>/', views.charge_shift_fulfillment, name='charge_fulfillment'),
    path('charge-penalty/<int:shift_id>/', views.charge_penalty, name='charge_penalty'),
    
    # Stripe Webhook
    path('webhook/', views.stripe_webhook, name='stripe_webhook'),
]
