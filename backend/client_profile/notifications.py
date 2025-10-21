from __future__ import annotations

from typing import Iterable, Optional, Sequence

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.utils import timezone

from client_profile.models import Notification, Participant, Message

USER_GROUP_FMT = "user.{user_id}"


def _serialize_notification(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "payload": notification.payload or {},
        "action_url": notification.action_url or "",
        "created_at": notification.created_at.isoformat(),
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
    }


def _broadcast(user_id: int, event_type: str, payload: dict):
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(layer.group_send)(
        USER_GROUP_FMT.format(user_id=user_id),
        {"type": event_type, **payload},
    )


def notify_users(
    user_ids: Iterable[int],
    *,
    title: str,
    body: str = "",
    notification_type: str = Notification.Type.TASK,
    action_url: Optional[str] = None,
    payload: Optional[dict] = None,
) -> None:
    payload = payload or {}
    users = list(
        get_user_model()
        .objects.filter(id__in=set(user_ids), is_active=True)
        .only("id")
    )
    for user in users:
        notification = Notification.objects.create(
            user=user,
            type=notification_type,
            title=title,
            body=body,
            action_url=action_url or "",
            payload=payload,
        )
        _broadcast(notification.user_id, "notification.created", {"notification": _serialize_notification(notification)})
        _broadcast_notification_counter(notification.user_id)


def mark_notifications_read(user, notification_ids: Optional[Sequence[int]] = None) -> int:
    qs = Notification.objects.filter(user=user, read_at__isnull=True)
    if notification_ids:
        qs = qs.filter(id__in=notification_ids)
    notifications = list(qs)
    if not notifications:
        return 0
    now = timezone.now()
    for n in notifications:
        n.read_at = now
    Notification.objects.bulk_update(notifications, ["read_at"])
    for n in notifications:
        _broadcast(n.user_id, "notification.updated", {"notification": _serialize_notification(n)})
    _broadcast_notification_counter(user.id)
    return len(notifications)


def _broadcast_notification_counter(user_id: int) -> None:
    unread = Notification.objects.filter(user_id=user_id, read_at__isnull=True).count()
    _broadcast(user_id, "notification.counter", {"unread": unread})


def broadcast_message_badge(participant: Participant) -> None:
    user = getattr(participant.membership, "user", None)
    if not user or not user.is_active:
        return
    unread = _calculate_unread_messages(participant)
    latest = (
        Message.objects
        .filter(conversation_id=participant.conversation_id)
        .select_related("sender__user")
        .order_by("-created_at")
        .first()
    )
    sender_name = ""
    body_preview = ""
    if latest:
        sender_user = getattr(latest.sender, "user", None)
        if sender_user:
            sender_name = sender_user.get_full_name() or sender_user.email or ""
        body_preview = (latest.body or "").strip()
    conversation_title = getattr(participant.conversation, "title", "") if hasattr(participant, "conversation") else ""
    _broadcast(user.id, "message.badge", {
        "conversation_id": participant.conversation_id,
        "unread": unread,
        "sender_name": sender_name,
        "body_preview": body_preview[:160] if body_preview else "",
        "conversation_title": conversation_title or "",
    })


def broadcast_message_read(participant: Participant) -> None:
    user = getattr(participant.membership, "user", None)
    if not user or not user.is_active:
        return
    _broadcast(user.id, "message.read", {"conversation_id": participant.conversation_id})
    unread = _calculate_unread_messages(participant)
    _broadcast(user.id, "message.badge", {"conversation_id": participant.conversation_id, "unread": unread})


def _calculate_unread_messages(participant: Participant) -> int:
    qs = Message.objects.filter(conversation_id=participant.conversation_id).exclude(sender=participant.membership)
    if participant.last_read_at:
        qs = qs.filter(created_at__gt=participant.last_read_at)
    return qs.count()


