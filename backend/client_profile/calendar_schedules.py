from __future__ import annotations

from typing import Iterable


def ensure_calendar_schedules() -> None:
    """
    Create or update Django-Q schedules for calendar tasks.
    """
    from django_q.models import Schedule

    schedule_defs: Iterable[dict] = [
        {
            "name": "calendar-birthdays-daily",
            "func": "client_profile.calendar_tasks.generate_all_birthday_events",
            "schedule_type": Schedule.DAILY,
            "repeats": -1,
        },
        {
            "name": "calendar-work-notes-hourly",
            "func": "client_profile.calendar_tasks.send_shift_start_work_note_notifications",
            "schedule_type": Schedule.HOURLY,
            "repeats": -1,
        },
        {
            "name": "calendar-work-notes-9am-fallback",
            "func": "client_profile.calendar_tasks.send_9am_work_note_fallback",
            "schedule_type": Schedule.HOURLY,
            "repeats": -1,
        },
    ]

    for definition in schedule_defs:
        name = definition["name"]
        defaults = {k: v for k, v in definition.items() if k != "name"}
        schedule, created = Schedule.objects.get_or_create(name=name, defaults=defaults)
        if created:
            continue
        changed_fields = []
        for field, value in defaults.items():
            if getattr(schedule, field) != value:
                setattr(schedule, field, value)
                changed_fields.append(field)
        if changed_fields:
            schedule.save(update_fields=changed_fields)
