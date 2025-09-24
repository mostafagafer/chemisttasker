# # core/mw_security.py
# from django.conf import settings

# CSP = (
#     "default-src 'self'; "
#     "img-src 'self' data: blob: https:; "
#     "script-src 'self' 'unsafe-inline'; "
#     "style-src 'self' 'unsafe-inline'; "
#     f"connect-src 'self' https://{settings.env('WEBSITE_HOSTING')} https://{settings.env('AZURE_ACCOUNT_NAME')}.blob.core.windows.net; "
#     "frame-ancestors 'none'; "
#     "base-uri 'self'; "
#     "object-src 'none'; "
# )

# class SecurityHeadersMiddleware:
#     def __init__(self, get_response):
#         self.get_response = get_response
#     def __call__(self, request):
#         resp = self.get_response(request)
#         # CSP (addresses “CSP header not implemented” + modern replacement for XFO)
#         resp.headers.setdefault("Content-Security-Policy", CSP)
#         # Keep XFO for legacy scanners (you already set X_FRAME_OPTIONS=DENY)
#         resp.headers.setdefault("X-Frame-Options", "DENY")
#         # Permissions Policy (quiet SecurityHeaders “missing”)
#         resp.headers.setdefault(
#             "Permissions-Policy",
#             "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
#         )
#         # Cross-Origin Resource Policy (CORP)
#         resp.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
#         return resp
