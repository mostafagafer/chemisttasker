from django.urls import path
from .consumers import RoomConsumer, NotificationConsumer

websocket_urlpatterns = [
    path("ws/chat/rooms/<int:room_id>/", RoomConsumer.as_asgi()),
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
