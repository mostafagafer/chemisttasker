from django.utils import timezone
from datetime import timedelta, datetime
from users.tasks import send_async_email
from client_profile.models import ShiftSlotAssignment
from client_profile.utils import build_shift_email_context

from procrastinate.contrib.django import app

@app.periodic(cron="0 */12 * * *")
@app.task
def send_shift_reminders(timestamp: int):
    """
    Send a reminder email 12 hours before each assigned shift/slot.
    This task is scheduled to run every 12 hours.
    """
    now = timezone.now()
    window_start = now + timedelta(hours=12)
    window_end = now + timedelta(hours=13)  # 1-hour window

    assignments = ShiftSlotAssignment.objects.select_related('shift', 'slot', 'user')\
        .filter(
            slot_date=window_start.date(),
            slot__start_time__gte=window_start.time(),
            slot__start_time__lt=window_end.time(),
        )

    for assignment in assignments:
        shift = assignment.shift
        candidate = assignment.user
        slot = assignment.slot

        # Calculate the slot_time string
        slot_time = f"{assignment.slot_date} {slot.start_time.strftime('%H:%M')}–{slot.end_time.strftime('%H:%M')}"

        # Always pass role as lower-case (just like other notifications)
        ctx = build_shift_email_context(
            shift,
            user=candidate,
            role=candidate.role.lower() if hasattr(candidate, "role") and candidate.role else "pharmacist",
            extra={"slot_time": slot_time}
        )

        send_async_email.defer(
            subject=f"Reminder: Your upcoming shift at {shift.pharmacy.name}",
            recipient_list=[candidate.email],
            template_name="emails/shift_reminder.html",
            context=ctx,
            text_template="emails/shift_reminder.txt"
        )
