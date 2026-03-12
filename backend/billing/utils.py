from datetime import date, timedelta
from django.conf import settings

BILLING_STATE_PRE_LIVE = "PRE_LIVE"
BILLING_STATE_FREE_TRIAL = "FREE_TRIAL"
BILLING_STATE_PAYMENT_REQUIRED = "PAYMENT_REQUIRED"


def is_billing_active() -> bool:
    """Returns True if today is on or after the global billing live date."""
    live_date = getattr(settings, 'BILLING_LIVE_DATE', None)
    if live_date is None:
        return True  # no date set → billing is on
    return date.today() >= live_date


def is_in_free_trial(user) -> bool:
    """
    Returns True if the user registered within the FREE_TRIAL_DAYS window.
    Uses Django's built-in user.date_joined field.
    """
    if not is_billing_active():
        return False  # billing not started yet — trial concept irrelevant
    trial_days = getattr(settings, 'FREE_TRIAL_DAYS', 30)
    if not hasattr(user, 'date_joined') or not user.date_joined:
        return False
    cutoff = date.today() - timedelta(days=trial_days)
    return user.date_joined.date() > cutoff


def get_billing_state(user) -> str:
    """
    Returns one of:
      - PRE_LIVE
      - FREE_TRIAL
      - PAYMENT_REQUIRED
    """
    if not is_billing_active():
        return BILLING_STATE_PRE_LIVE
    if is_in_free_trial(user):
        return BILLING_STATE_FREE_TRIAL
    return BILLING_STATE_PAYMENT_REQUIRED
