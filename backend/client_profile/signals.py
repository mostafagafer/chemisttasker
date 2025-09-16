# client_profile/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from client_profile.models import Message
import logging
log = logging.getLogger("client_profile.signals")

ROOM_GROUP_FMT = "room.{room_id}"

@receiver(post_save, sender=Message)
def broadcast_new_message(sender, instance, created, **kwargs):
    """
    Broadcast AFTER commit. Adds very loud prints/logs so you can see
    whether the signal ran, whether a channel layer is present, and
    whether group_send raised.
    """
    if not created:
        return

    def _notify():
        try:
            print(f"[SIGNALS] on_commit() for message={instance.id}, conv={instance.conversation_id}", flush=True)
            layer = get_channel_layer()
            if not layer:
                print("[SIGNALS] get_channel_layer() returned None (no CHANNEL_LAYERS in settings?)", flush=True)
                log.error("No channel layer available. Check CHANNEL_LAYERS.")
                return

            group_name = ROOM_GROUP_FMT.format(room_id=instance.conversation_id)
            payload = {
                "id": instance.id,
                "conversation": instance.conversation_id,
                "sender": instance.sender_id,   # membership id
                "body": instance.body,
                "attachment_url": (
                    instance.attachment.url if getattr(instance, "attachment", None) else None
                ),
                "created_at": instance.created_at.isoformat(),
            }

            log.info("Broadcasting message %s to %s", instance.id, group_name)
            print(f"[SIGNALS] group_send -> {group_name} payload.id={payload['id']}", flush=True)

            async_to_sync(layer.group_send)(
                group_name,
                {
                    "type": "message.created",    # maps to consumer.message_created
                    "message": payload,           # nested
                },
            )
            print("[SIGNALS] group_send DONE", flush=True)
        except Exception as e:
            print(f"[SIGNALS] EXCEPTION in _notify: {e}", flush=True)
            log.exception("Error while broadcasting message.created")

    transaction.on_commit(_notify)
