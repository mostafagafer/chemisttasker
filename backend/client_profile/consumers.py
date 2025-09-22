# client_profile/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from client_profile.models import Conversation, Participant, Membership, Message
import logging

log = logging.getLogger("client_profile.ws")

ROOM_GROUP_FMT = "room.{room_id}"

class RoomConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        try:
            self.room_id = int(self.scope["url_route"]["kwargs"]["room_id"])
        except Exception:
            await self.close(code=4000)
            return

        self.group_name = ROOM_GROUP_FMT.format(room_id=self.room_id)
        user = self.scope.get("user")
        log.debug("CONNECT: room=%s user=%s layer=%s", self.room_id, getattr(user, "id", None), bool(self.channel_layer))
        print(f"[WS] CONNECT room={self.room_id} user={getattr(user,'id',None)}", flush=True)

        if not user or user.is_anonymous:
            log.warning("CONNECT denied: anonymous")
            await self.close(code=4401)
            return

        self.membership = await self._get_membership(self.room_id, user.id)
        if not self.membership:
            log.warning("CONNECT denied: no membership for user=%s in room=%s", user.id, self.room_id)
            await self.close(code=4403)
            return

        if self.channel_layer:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        else:
            log.error("No channel_layer on consumer!")

        await self.accept()
        await self.send_json({"type": "ready", "membership": self.membership.id})
        print(f"[WS] JOINED group={self.group_name} membership={self.membership.id}", flush=True)
        log.info("ACCEPTED: room=%s membership=%s", self.room_id, self.membership.id)

    async def disconnect(self, code):
        print(f"[WS] DISCONNECT code={code} room={getattr(self,'room_id',None)}", flush=True)
        log.info("DISCONNECT: code=%s room=%s", code, getattr(self,'room_id',None))
        if self.channel_layer and hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        print(f"[WS] RECEIVE {content}", flush=True)
        if content.get("type") != "message":
            return
        body = (content.get("body") or "").strip()
        if not body:
            return
        if not getattr(self, "membership", None):
            log.warning("RECEIVE without membership")
            return

        msg = await self._create_message(self.room_id, self.membership, body)
        log.debug("Created message id=%s", msg.id)
        print(f"[WS] CREATED message id={msg.id}", flush=True)
        # No immediate send here; signal will broadcast on commit

    # ---- channel-layer events ----
    async def message_created(self, event):
        payload = event.get("message") or event
        print(f"[WS] EVENT message.created -> id={payload.get('id')} conv={payload.get('conversation')}", flush=True)
        log.debug("EVENT message.created id=%s", payload.get("id"))
        await self.send_json({"type": "message.created", "message": payload})

    async def read_updated(self, event):
        print(f"[WS] EVENT read.updated -> membership={event.get('membership')}", flush=True)
        await self.send_json({
            "type": "read.updated",
            "membership": event.get("membership"),
            "last_read_at": event.get("last_read_at"),
        })


    async def message_updated(self, event):
        await self.send_json({
            "type": "message.updated",
            "message": event.get("message"),
        })

    # ✨ FIX: Add a handler for the 'message.deleted' event
    async def message_deleted(self, event):
        await self.send_json({
            "type": "message.deleted",
            "message_id": event.get("message_id"),
        })


    async def reaction_updated(self, event):
        await self.send_json({
            "type": "reaction.updated",
            "message_id": event.get("message_id"),
            "reactions": event.get("reactions"),
        })

    # ---- DB helpers ----
    @database_sync_to_async
    def _get_membership(self, conversation_id: int, user_id: int):
        participant = (
            Participant.objects
            .filter(
                conversation_id=conversation_id,
                membership__user_id=user_id,
                membership__is_active=True,
            )
            .select_related("membership")
            .first()
        )
        return participant.membership if participant else None

    @database_sync_to_async
    def _create_message(self, conversation_id: int, membership: Membership, body: str):
        msg = Message.objects.create(
            conversation_id=conversation_id,
            sender=membership,
            body=body,
        )
        Conversation.objects.filter(pk=conversation_id).update(updated_at=msg.created_at)
        return msg


