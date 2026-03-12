import logging
import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from .models import OwnerSubscription, ShiftPayment

# NOTE: Will be importing shared-core pricing methods shortly
# from billing.pricing import calculateFulfillmentFee ...

stripe.api_key = settings.STRIPE_SECRET_KEY

# Fallback for local dev (settings.py doesn't define WEBSITE_HOSTING)
SITE_HOST = getattr(settings, 'WEBSITE_HOSTING', 'localhost:8000')
logger = logging.getLogger(__name__)


# Product & Price IDs (from MCP)
BASE_SUB_PRICE = 'price_1T52ikBQXaySV5ukpVrv7EcZ' # $30 AUD
EXTRA_SEAT_PRICE = 'price_1T52ilBQXaySV5uk2fmUWXlw' # $5 AUD


def _finalize_pending_offers_for_shift(shift, *, candidate_id=None, slot_id=None):
    """
    Finalize shift offers waiting on payment.
    If candidate_id/slot_id are provided, narrow the target set.
    """
    from client_profile.models import ShiftOffer
    from client_profile.utils import finalize_shift_offer

    offers = ShiftOffer.objects.filter(
        shift=shift,
        status=ShiftOffer.Status.ACCEPTED_AWAITING_PAYMENT,
    ).order_by("created_at")

    if candidate_id:
        offers = offers.filter(user_id=candidate_id)
    if slot_id:
        offers = offers.filter(slot_id=slot_id)

    finalized = 0
    for offer in offers:
        finalize_shift_offer(offer)
        finalized += 1
    return finalized

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def create_subscription_checkout(request):
    """
    Creates a Stripe Subscription directly (if Invoice) or a Checkout Session (if Card).
    Payload:
      - staff_count (int, default=5)
      - payment_method: 'card' | 'invoice'
    """
    user = request.user
    staff_count = int(request.data.get('staff_count', 5))
    payment_method_input = request.data.get('payment_method', 'card')

    if staff_count < 5:
        staff_count = 5

    extra_seats = staff_count - 5
    
    # 1. Ensure owner has a Stripe customer ID
    subscription, created = OwnerSubscription.objects.get_or_create(owner=user)
    if not subscription.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=f"{user.first_name} {user.last_name}"
            )
            subscription.stripe_customer_id = customer.id
            subscription.save()
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # 2. Line Items Configuration
    line_items = [
        {'price': BASE_SUB_PRICE, 'quantity': 1}
    ]
    if extra_seats > 0:
        line_items.append({'price': EXTRA_SEAT_PRICE, 'quantity': extra_seats})

    try:
        # 3. IF INVOICE: Create subscription directly without checkout, set to send_invoice
        if payment_method_input == 'invoice':
            sub = stripe.Subscription.create(
                customer=subscription.stripe_customer_id,
                items=line_items,
                collection_method='send_invoice',
                days_until_due=7,
                metadata={'staff_count': staff_count, 'user_id': user.id}
            )
            # Sync to local DB
            subscription.stripe_subscription_id = sub.id
            subscription.staff_count = staff_count
            subscription.status = 'inactive' # remains inactive until invoice is paid
            subscription.save()
            return Response({
                'message': 'Invoice sent. Check your email.', 
                'subscription_id': sub.id
            })

        # 4. IF CARD: Create a Stripe Checkout Session for collection
        else:
            checkout_session = stripe.checkout.Session.create(
                customer=subscription.stripe_customer_id,
                payment_method_types=['card'],
                line_items=line_items,
                mode='subscription',
                success_url=f"https://{SITE_HOST}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"https://{SITE_HOST}/billing/cancel",
                metadata={'staff_count': staff_count, 'user_id': user.id}
            )
            return Response({'url': checkout_session.url})

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def charge_shift_fulfillment(request, shift_id):
    """
    Called when a shift is FILLED (worker assigned and approves).
    Generates a checkout session for the fulfillment fee.
    """
    user = request.user
    from client_profile.models import Shift
    from django.shortcuts import get_object_or_404
    from billing.utils import (
        BILLING_STATE_FREE_TRIAL,
        BILLING_STATE_PRE_LIVE,
        get_billing_state,
    )

    shift = get_object_or_404(Shift, id=shift_id)

    # 0. Authorization check
    if getattr(shift.pharmacy.owner, 'user', None) != user:
        return Response({'error': 'Not authorized to charge this shift.'}, status=status.HTTP_403_FORBIDDEN)

    billing_state = get_billing_state(user)

    # --- Honeymoon period / free trial: finalize for free ---
    if billing_state in [BILLING_STATE_PRE_LIVE, BILLING_STATE_FREE_TRIAL]:
        shift.payment_status = 'PAID'
        shift.save(update_fields=['payment_status'])
        finalized_count = _finalize_pending_offers_for_shift(
            shift,
            candidate_id=request.data.get('candidate_id'),
            slot_id=request.data.get('slot_id'),
        )
        if billing_state == BILLING_STATE_PRE_LIVE:
            return Response({
                'free': True,
                'billing_state': billing_state,
                'finalized_offers': finalized_count,
                'message': 'Payments not active yet - shift confirmed for free.',
            })
        return Response({
            'free': True,
            'billing_state': billing_state,
            'finalized_offers': finalized_count,
            'message': 'Free trial applied - shift confirmed for free.',
        })


    # Price Logic
    # We could also use `shared-core` logic if we had a node backend, 
    # but since this is Django, we map it internally here for the Stripe Price IDs.
    
    is_subscriber = False
    try:
        sub = OwnerSubscription.objects.get(owner=user)
        # Check standard active status
        if sub.status == 'active' or sub.stripe_subscription_id:
            # We assume active if they have a stripe sub ID linked, 
            # ideally we check real status via webhook.
            is_subscriber = True
    except OwnerSubscription.DoesNotExist:
        pass

    # Determine base price based on shift type
    # PT/FT standard: price_1T52ilBQXaySV5uksvQy2RTk ($80)
    # PT/FT subscriber: price_1T52imBQXaySV5ukuwLH3ikI ($40)
    # Locum standard: price_1T52jFBQXaySV5ukezd5JmzS ($30)
    # Locum subscriber: price_1T52jFBQXaySV5ukkXOKPHSV ($15)
    
    is_locum = shift.employment_type == 'LOCUM'

    if is_locum:
        price_id = 'price_1T52jFBQXaySV5ukkXOKPHSV' if is_subscriber else 'price_1T52jFBQXaySV5ukezd5JmzS'
    else:
        price_id = 'price_1T52imBQXaySV5ukuwLH3ikI' if is_subscriber else 'price_1T52ilBQXaySV5uksvQy2RTk'

    candidate_id = request.data.get('candidate_id')
    slot_id = request.data.get('slot_id')

    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=user.email,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"https://{settings.WEBSITE_HOSTING}/dashboard/shifts/{shift.id}?payment=success",
            cancel_url=f"https://{settings.WEBSITE_HOSTING}/dashboard/shifts/{shift.id}?payment=cancel",
            metadata={
                'shift_id': shift.id, 
                'user_id': user.id, 
                'type': 'fulfillment',
                'candidate_id': candidate_id,
                'slot_id': slot_id
            }
        )
        return Response({'url': checkout_session.url})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ScopedRateThrottle])
def charge_penalty(request, shift_id):
    """
    Called when an owner cancels a filled shift.
    Penalty is dynamic based on hours until shift and worker's expected wage.
    Because the amount is dynamic, we use price_data.
    """
    user = request.user
    from client_profile.models import Shift, ShiftSlotAssignment
    from django.shortcuts import get_object_or_404
    from django.utils import timezone
    
    shift = get_object_or_404(Shift, id=shift_id)

    # 0. Authorization check
    if getattr(shift.pharmacy.owner, 'user', None) != user:
        return Response({'error': 'Not authorized to penalize this shift.'}, status=status.HTTP_403_FORBIDDEN)

    # Calculate expected wage
    assignments = ShiftSlotAssignment.objects.filter(shift=shift)
    total_wage = 0.0

    now = timezone.now()
    earliest_start = None

    for assignment in assignments:
        slot = assignment.slot
        slot_date = assignment.slot_date or slot.date
        
        # Combine date and time
        from datetime import datetime
        start_dt = timezone.make_aware(datetime.combine(slot_date, slot.start_time))
        end_dt = timezone.make_aware(datetime.combine(slot_date, slot.end_time))
        
        if not earliest_start or start_dt < earliest_start:
            earliest_start = start_dt

        hours = (end_dt - start_dt).total_seconds() / 3600.0
        rate = float(assignment.unit_rate or 0)
        total_wage += (hours * rate)

    if not earliest_start or total_wage <= 0:
        return Response({'message': 'No penalty required, shift had no value or assignments.'})

    # Calculate Penalty Percentage
    hours_until_shift = (earliest_start - now).total_seconds() / 3600.0

    penalty_percentage = 0.0
    if hours_until_shift <= 24:
        penalty_percentage = 0.20
    elif hours_until_shift <= 72:
        penalty_percentage = 0.10

    if penalty_percentage == 0.0:
        return Response({'message': 'No penalty required, cancelled > 72 hours in advance.'})

    penalty_amount_aud = total_wage * penalty_percentage
    penalty_amount_cents = int(penalty_amount_aud * 100)

    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=user.email,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'aud',
                    'product_data': {
                        'name': f'Cancellation Penalty for Shift #{shift.id}',
                    },
                    'unit_amount': penalty_amount_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"https://{SITE_HOST}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"https://{SITE_HOST}/billing/cancel",
            metadata={'shift_id': shift.id, 'user_id': user.id, 'type': 'cancellation'}
        )
        return Response({'url': checkout_session.url})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse

@csrf_exempt
@api_view(['POST'])
@permission_classes([])
def stripe_webhook(request):
    """
    Handles Stripe webhooks (e.g., checkout.session.completed, invoice.paid).
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        return HttpResponse(status=400)

    # Handle the event
    if event.type == 'checkout.session.completed':
        session = event.data.object
        metadata = session.get('metadata', {})
        user_id = metadata.get('user_id')
        
        # If it was a subscription checkout
        if session.mode == 'subscription':
            try:
                sub = OwnerSubscription.objects.get(owner_id=user_id)
                sub.stripe_subscription_id = session.subscription
                sub.status = 'active'
                if 'staff_count' in metadata:
                    sub.staff_count = int(metadata['staff_count'])
                sub.save()
            except OwnerSubscription.DoesNotExist:
                pass
                
        # If it was a fulfillment or penalty payment
        elif session.mode == 'payment' and session.payment_status == 'paid':
            shift_id = metadata.get('shift_id')
            payment_type = metadata.get('type')
            if shift_id and payment_type:
                amount_paid = 0
                if session.amount_total is not None:
                    amount_paid = session.amount_total / 100.0

                ShiftPayment.objects.create(
                    owner_id=user_id,
                    stripe_payment_intent_id=session.payment_intent,
                    amount_paid=amount_paid,
                    payment_type=payment_type,
                    payment_method='card',
                    status='paid'
                )

                # Mark shift paid, then finalize pending offers waiting on payment.
                try:
                    from client_profile.models import Shift as ShiftModel
                    ShiftModel.objects.filter(id=shift_id, payment_status='PENDING').update(payment_status='PAID')
                    shift_obj = ShiftModel.objects.filter(id=shift_id).first()
                    if shift_obj:
                        _finalize_pending_offers_for_shift(
                            shift_obj,
                            candidate_id=metadata.get('candidate_id'),
                            slot_id=metadata.get('slot_id'),
                        )
                except Exception as e:
                    logger.warning('Could not finalize paid shift offers: %s', e)


    elif event.type == 'invoice.paid':
        invoice = event.data.object
        sub_id = invoice.subscription
        if sub_id:
            try:
                sub = OwnerSubscription.objects.get(stripe_subscription_id=sub_id)
                sub.status = 'active'
                sub.save()
            except OwnerSubscription.DoesNotExist:
                pass

    elif event.type == 'customer.subscription.deleted':
        sub_id = event.data.object.id
        try:
            sub = OwnerSubscription.objects.get(stripe_subscription_id=sub_id)
            sub.status = 'inactive'
            sub.save()
        except OwnerSubscription.DoesNotExist:
            pass

    return HttpResponse(status=200)
