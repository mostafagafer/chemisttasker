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
router.register(r'membership-invite-links', MembershipInviteLinkViewSet, basename='membership-invite-link')
router.register(r'membership-applications', MembershipApplicationViewSet, basename='membership-application')

router.register(r'community-shifts', CommunityShiftViewSet, basename='community-shifts')
router.register(r'public-shifts',    PublicShiftViewSet,    basename='public-shifts')
# My shifts by status for posters
router.register(r'user-availability', UserAvailabilityViewSet, basename='user-availability')
router.register(r'shifts/active',    ActiveShiftViewSet,    basename='active-shifts')
router.register(r'shifts/confirmed', ConfirmedShiftViewSet, basename='confirmed-shifts')
router.register(r'shifts/history',   HistoryShiftViewSet,   basename='history-shifts')
router.register(r'shifts', ShiftDetailViewSet, basename='shift')

# Roster endpoints
router.register(r'roster-owner', RosterOwnerViewSet, basename='roster-owner')
router.register(r'roster-worker', RosterWorkerViewSet, basename='roster-worker')
router.register(r'roster/manage-shifts', RosterShiftManageViewSet, basename='roster-manage-shift')
# Interest endpoint
router.register(r'shift-interests', ShiftInterestViewSet,  basename='shift-interests')
router.register(r'shift-rejections', ShiftRejectionViewSet, basename='shift-rejections')

router.register(r'my-confirmed-shifts',MyConfirmedShiftsViewSet,basename='my-confirmed-shifts')
router.register(r'my-history-shifts',MyHistoryShiftsViewSet,basename='my-history-shifts')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leaverequest')

#chat app
router.register(r'rooms', ConversationViewSet, basename='conversation')
router.register(r'my-memberships', MyMembershipsViewSet, basename='my-memberships')
router.register(r'messages', MessageViewSet, basename='message')

urlpatterns = [
    path('owner/onboarding/', OwnerOnboardingCreate.as_view(), name='owner-onboarding-create'),
    path('owner/onboarding/me/', OwnerOnboardingDetail.as_view(), name='owner-onboarding-detail'),
    # path('pharmacist/onboarding/', PharmacistOnboardingCreateView.as_view(), name='pharmacist-onboarding-create'),
    # path('pharmacist/onboarding/me/', PharmacistOnboardingDetailView.as_view(), name='pharmacist-onboarding-detail'),
    path('otherstaff/onboarding/', OtherStaffOnboardingCreateView.as_view(), name='otherstaff-onboarding-create'),
    path('otherstaff/onboarding/me/', OtherStaffOnboardingDetailView.as_view(), name='otherstaff-onboarding-detail'),
    path('explorer/onboarding/', ExplorerOnboardingCreateView.as_view(), name='explorer-onboarding-create'),
    path('explorer/onboarding/me/', ExplorerOnboardingDetailView.as_view(), name='explorer-onboarding-detail'),


    # === New Onboarding ===
    path('pharmacist/onboarding-v2/me/', PharmacistOnboardingV2MeView.as_view(), name='pharmacist-onboarding-v2-me'),

    # path('onboarding/referee-confirm/<int:profile_pk>/<int:ref_idx>/', RefereeConfirmView.as_view(), name='referee-confirm'),
    path('onboarding/submit-reference/<str:token>/', RefereeSubmitResponseView.as_view(), name='submit-referee-response'),
    path('onboarding/referee-reject/<int:profile_pk>/<int:ref_idx>/', RefereeRejectView.as_view(), name='referee-reject'),

    path('magic/memberships/<str:token>/', MagicLinkInfoView.as_view(), name='magic-membership-detail'),
    path('magic/memberships/<str:token>/apply/', SubmitMembershipApplication.as_view(), name='magic-membership-apply'),

    path('dashboard/organization/', OrganizationDashboardView.as_view(), name='organization-dashboard'),
    path('dashboard/organization/<int:organization_pk>/',OrganizationDashboardView.as_view(), name='organization-dashboard'),
    path('dashboard/owner/', OwnerDashboard.as_view()),
    path('dashboard/pharmacist/', PharmacistDashboard.as_view()),
    path('dashboard/otherstaff/', OtherStaffDashboard.as_view()),
    path('dashboard/explorer/', ExplorerDashboard.as_view()),
    
    # Claim endpoint for OwnerOnboarding
    path('owner-onboarding/claim/',  OwnerOnboardingClaim.as_view(), name='owneronboarding-claim' ),

    path('public-job-board/', PublicJobBoardView.as_view(), name='public-job-board'),
    path('view-shared-shift/', SharedShiftDetailView.as_view(), name='view-shared-shift'),


    path('roster/create-and-assign-shift/', CreateShiftAndAssignView.as_view(), name='create-shift-and-assign'),

    # Invoice
    # list and create (manual or via shifts)
    path('invoices/', InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/preview/<int:shift_id>/', preview_invoice_lines, name='invoice-preview'),
    # retrieve/update/delete
    path('invoices/<int:pk>/', InvoiceDetailView.as_view(), name='invoice-detail'),
    # alternate generate endpoint (optional—your front end can use POST to /invoices/ directly)
    path('invoices/generate/', GenerateInvoiceView.as_view(), name='generate-invoice'),
    path('invoices/<int:invoice_id>/pdf/', invoice_pdf_view, name='invoice_pdf'),
    path('invoices/<int:invoice_id>/send/', send_invoice_email, name='send-invoice-email'),


    path('messages/<int:message_id>/react/', MessageReactionView.as_view(), name='message-react'),

    # Include the API routes for CRUD operations
    path('', include(router.urls)),
]