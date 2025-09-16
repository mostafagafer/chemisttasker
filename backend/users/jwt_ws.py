# users/jwt_ws.py
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed


class JWTAuthMiddleware:
    """
    ASGI middleware for Channels that authenticates WebSocket connections
    using SimpleJWT access tokens.

      - Authorization: Bearer <token>
      - ?token=<token>
    """
    def __init__(self, inner):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["user"] = AnonymousUser()

        token = self._get_token_from_scope(scope)
        if token:
            try:
                # Best practice before DB use
                close_old_connections()
                validated = await sync_to_async(self.jwt_auth.get_validated_token, thread_sensitive=True)(token)
                user = await database_sync_to_async(self.jwt_auth.get_user)(validated)
                scope["user"] = user
            except (InvalidToken, AuthenticationFailed):
                # keep AnonymousUser
                pass

        return await self.inner(scope, receive, send)

    def _get_token_from_scope(self, scope):
        headers = dict(scope.get("headers", []))
        auth = headers.get(b"authorization", b"").decode()
        if auth.lower().startswith("bearer "):
            return auth.split(" ", 1)[1].strip()
        query = parse_qs(scope.get("query_string", b"").decode())
        if "token" in query and query["token"]:
            return query["token"][0].strip()
        return None


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
