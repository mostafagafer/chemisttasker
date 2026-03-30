from django.urls import path, include
from users.views import DeleteAccountView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static
from .sitemap import sitemap_web
from .admin_site import otp_admin_site
from two_factor.urls import urlpatterns as two_factor_urlpatterns

urlpatterns = [
    path('', include(two_factor_urlpatterns, namespace='two_factor')),
    path(settings.ADMIN_URL, otp_admin_site.urls),
    path('sitemap.xml', sitemap_web, name='sitemap-web'),
    path('api/users/', include('users.urls')),
    path('api/client-profile/', include(('client_profile.urls', 'client_profile'), namespace='client_profile')),
    path('api/billing/', include('billing.urls', namespace='billing')),
    path('api/account/', DeleteAccountView.as_view(), name='delete-account'),
]

# append this in DEBUG mode so Django serves your uploads
if settings.DEBUG:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
    ]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
