from django.urls import path, include
from .views import *
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from django.contrib.auth import views as auth_views


router = DefaultRouter()
# since we'll include this at /api/users/, register at the root
router.register('', UserViewSet, basename='user')

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', CustomLoginView.as_view(), name='custom_token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('password-reset-confirm/',PasswordResetConfirmAPIView.as_view(), name='password_reset_confirm_api'),
    path('password-reset/', PasswordResetRequestAPIView.as_view(), name='password-reset-request'),
    path('auth/reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(),name='password_reset_confirm'),
    path('auth/reset/done/',           auth_views.PasswordResetCompleteView.as_view(),name='password_reset_complete'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),

    # ... other user routes ...
    path('invite-org-user/', InviteOrgUserView.as_view(), name='invite-org-user'),

    path('', include(router.urls)),

]
