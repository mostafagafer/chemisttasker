# client_profile/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from client_profile.models import Message
from django.utils.text import slugify
import logging
from client_profile.serializers import MessageSerializer
from .models import Membership, Conversation, Participant

log = logging.getLogger("client_profile.signals")

ROOM_GROUP_FMT = "room.{room_id}"

def _user_initials(user):
    try:
        fn = (user.first_name or "").strip()[:1]
        ln = (user.last_name or "").strip()[:1]
        if not (fn or ln):
            # fallback: split full_name or username
            base = (getattr(user, "full_name", None) or user.get_username() or "").strip()
            parts = base.split()
            fn = (parts[0][:1] if parts else "") or "?"
            ln = (parts[1][:1] if len(parts) > 1 else "")
        return (fn + ln).upper() or "?"
    except Exception:
        return "?"

@receiver(post_save, sender=Message)
def broadcast_new_message(sender, instance, created, **kwargs):
    """
    Broadcast AFTER commit with fully-populated sender_details so the client
    can render name/avatar immediately (no extra fetch / no refresh needed).
    """
    if not created:
        return

    def _notify():
        try:
            layer = get_channel_layer()
            if not layer:
                log.warning("No channel layer configured; cannot broadcast message.created")
                return

            # Re-fetch with related user so the serializer can include user_details
            msg = (
                Message.objects
                .select_related("sender__user")
                .get(pk=instance.pk)
            )

            # 🔄 Build payload exactly like REST does
            payload = MessageSerializer(msg).data  # matches fields: id, conversation, sender{ id, user_details{...} }, body, attachment, attachment_url, created_at

            group_name = ROOM_GROUP_FMT.format(room_id=msg.conversation_id)
            async_to_sync(layer.group_send)(
                group_name,
                {
                    "type": "message.created",   # consumer.message_created
                    "message": payload,          # keep nested "message" as before
                },
            )
        except Exception:
            log.exception("Error while broadcasting message.created")

    transaction.on_commit(_notify)


@receiver(post_save, sender=Membership)
def sync_membership_to_community_chat(sender, instance, created, **kwargs):
    if instance.is_active and instance.pharmacy:
        community_chat, chat_created = Conversation.objects.get_or_create(
            pharmacy=instance.pharmacy,
            type=Conversation.Type.GROUP,
            defaults={
                'title': instance.pharmacy.name,
                'created_by': instance.invited_by or instance.user
            }
        )
        Participant.objects.get_or_create(
            conversation=community_chat,
            membership=instance
        )
