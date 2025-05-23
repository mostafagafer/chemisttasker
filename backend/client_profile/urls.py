# client_profile/urls.py
from django.urls import path, include
from .views import *
from rest_framework.routers import DefaultRouter


router = DefaultRouter()

router.register(r'organizations', OrganizationViewSet, basename='organization')

# Register the views with appropriate routes
router.register(r'chains', ChainViewSet, basename='chain')
router.register(r'pharmacies', PharmacyViewSet)
router.register(r'memberships', MembershipViewSet, basename='membership')

router.register(r'community-shifts', CommunityShiftViewSet, basename='community-shifts')
router.register(r'public-shifts',    PublicShiftViewSet,    basename='public-shifts')
# My shifts by status for posters
router.register(r'user-availability', UserAvailabilityViewSet, basename='user-availability')
router.register(r'shifts/active',    ActiveShiftViewSet,    basename='active-shifts')
router.register(r'shifts/confirmed', ConfirmedShiftViewSet, basename='confirmed-shifts')
router.register(r'shifts/history',   HistoryShiftViewSet,   basename='history-shifts')
# Interest endpoint
router.register(r'shift-interests', ShiftInterestViewSet,  basename='shift-interests')
router.register(r'my-confirmed-shifts',MyConfirmedShiftsViewSet,basename='my-confirmed-shifts')
router.register(r'my-history-shifts',MyHistoryShiftsViewSet,basename='my-history-shifts')

urlpatterns = [
    path('owner/onboarding/', OwnerOnboardingCreate.as_view(), name='owner-onboarding-create'),
    path('owner/onboarding/me/', OwnerOnboardingDetail.as_view(), name='owner-onboarding-detail'),
    path('pharmacist/onboarding/', PharmacistOnboardingCreateView.as_view(), name='pharmacist-onboarding-create'),
    path('pharmacist/onboarding/me/', PharmacistOnboardingDetailView.as_view(), name='pharmacist-onboarding-detail'),
    path('otherstaff/onboarding/', OtherStaffOnboardingCreateView.as_view(), name='otherstaff-onboarding-create'),
    path('otherstaff/onboarding/me/', OtherStaffOnboardingDetailView.as_view(), name='otherstaff-onboarding-detail'),
    path('explorer/onboarding/', ExplorerOnboardingCreateView.as_view(), name='explorer-onboarding-create'),
    path('explorer/onboarding/me/', ExplorerOnboardingDetailView.as_view(), name='explorer-onboarding-detail'),
    path('dashboard/organization/', OrganizationDashboardView.as_view(), name='organization-dashboard'),
    path('dashboard/organization/<int:organization_pk>/',OrganizationDashboardView.as_view(), name='organization-dashboard'),

    path('dashboard/owner/', OwnerDashboard.as_view()),
    path('dashboard/pharmacist/', PharmacistDashboard.as_view()),
    path('dashboard/otherstaff/', OtherStaffDashboard.as_view()),
    path('dashboard/explorer/', ExplorerDashboard.as_view()),
    
    # Claim endpoint for OwnerOnboarding
    path('owner-onboarding/claim/',  OwnerOnboardingClaim.as_view(), name='owneronboarding-claim' ),


    # Invoice
    # list and create (manual or via shifts)
    path('invoices/', InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/preview/<int:shift_id>/', preview_invoice_lines, name='invoice-preview'),
    # retrieve/update/delete
    path('invoices/<int:pk>/', InvoiceDetailView.as_view(), name='invoice-detail'),
    # alternate generate endpoint (optional—your front end can use POST to /invoices/ directly)
    path('invoices/generate/', GenerateInvoiceView.as_view(), name='generate-invoice'),

    # Include the API routes for CRUD operations
    path('', include(router.urls)),
]