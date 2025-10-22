import React from 'react';
import ReactDOM from 'react-dom/client';
import { Outlet } from 'react-router-dom';
import { WorkspaceProvider } from './contexts/WorkspaceContext'; // Add this import

import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import App from './App';
import LandingPage     from './pages/LandingPage';
import Login           from './pages/login';
import Register        from './pages/register';
import OTPVerify        from './pages/OTPVerify';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PasswordResetRequestPage from './pages/PasswordResetRequestPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import NotFoundPage     from './pages/NotFoundPage';
import MobileOTPVerify from './pages/MobileOTPVerify';

import PublicJobBoardPage from './pages/PublicJobBoardPage';
import SharedShiftLandingPage from './pages/SharedShiftLandingPage';
import MembershipApplyPage from './pages/MembershipApplyPage';

// Orgnization
import OrganizationOverviewPage from './pages/dashboard/organization/OrganizationOverviewPage';
import InviteStaffPage          from './pages/dashboard/organization/InviteStaffPage';
import ClaimPharmaciesPage      from './pages/dashboard/organization/ClaimPharmaciesPage';
import OrganizationDashboardWrapper from './layouts/OrganizationDashboardWrapper';

// Other users types
import OwnerOnboarding from './pages/onboarding/OwnerOnboarding';
import PharmacistOnboarding from './pages/onboarding/PharmacistOnboarding';
import OtherStaffOnboarding from './pages/onboarding/OtherStaffOnboarding';
import ExplorerOnboarding from './pages/onboarding/ExplorerOnboarding';
// import c from './pages/onboarding/RefereeConfirmPage';
import RefereeQuestionnairePage from './pages/onboarding/RefereeQuestionnairePage';
import RefereeRejectPage from './pages/onboarding/RefereeRejectPage';
import RosterOwnerPage from './pages/dashboard/sidebar/RosterOwnerPage';
import RosterWorkerPage from './pages/dashboard/sidebar/RosterWorkerPage';




import ProtectedRoute from './components/ProtectedRoute';
import OwnerDashboardWrapper from './layouts/ownerDashboard';
import PharmacistDashboardWrapper from './layouts/pharmacistDashboard';
import OtherstaffDashboardWrapper from './layouts/otherStaffDashboard';
import ExplorerDashboardWrapper from './layouts/explorerDashboard';



// owner stub pages
// import OverviewPageOwner          from './pages/dashboard/sidebar/OverviewPageOwner';
import OwnerOverviewContainer from './pages/dashboard/sidebar/owner/OwnerOverviewContainer';

import OverviewPageStaff          from './pages/dashboard/sidebar/OverviewPageStaff';
import ChainPage       from './pages/dashboard/sidebar/ChainPage';
import PharmacyPage          from './pages/dashboard/sidebar/PharmacyPage';
import PostShiftPage         from './pages/dashboard/sidebar/PostShiftPage';
import PublicShiftsPage      from './pages/dashboard/sidebar/PublicShiftsPage';
import CommunityShiftsPage   from './pages/dashboard/sidebar/CommunityShiftsPage';
import SetAvailabilityPage   from './pages/dashboard/sidebar/SetAvailabilityPage';
import ExplorerInterestsPage from './pages/dashboard/sidebar/ExplorerInterestsPage';
import LearningMaterialsPage from './pages/dashboard/sidebar/LearningMaterialsPage';
import LogoutPage            from './pages/dashboard/sidebar/LogoutPage';
import ActiveShiftsPage    from './pages/dashboard/sidebar/ActiveShiftsPage';
import ConfirmedShiftsPage from './pages/dashboard/sidebar/ConfirmedShiftsPage';
import HistoryShiftsPage   from './pages/dashboard/sidebar/HistoryShiftsPage';
import MyConfirmedShiftsPage from './pages/dashboard/sidebar/MyConfirmedShiftsPage';
import MyHistoryShiftsPage   from './pages/dashboard/sidebar/MyHistoryShiftsPage';
import PosterShiftDetailPage from './pages/dashboard/sidebar/PosterShiftDetailPage';
import WorkerShiftDetailPage from './pages/dashboard/sidebar/WorkerShiftDetailPage';
import ChatPage from './pages/dashboard/sidebar/chat/ChatPage';
import PharmacyHubPage from './pages/dashboard/sidebar/pharmacyHub/PharmacyHubPage';
import OrganizationHubPage from './pages/dashboard/sidebar/pharmacyHub/OrganizationHubPage';
import CommunityGroupsPage from './pages/dashboard/sidebar/chat/CommunityGroupsPage';


// Invoice
import InvoiceManagePage   from './pages/dashboard/sidebar/InvoiceManagePage';
import InvoiceGeneratePage   from './pages/dashboard/sidebar/InvoiceGeneratePage';
import InvoiceDetailPage   from './pages/dashboard/sidebar/InvoiceDetailPage';

import { AuthProvider } from './contexts/AuthContext';


// Version2
import PharmacistOnboardingV2Layout from './pages/onboarding/onboarding_pharmacist/PharmacistOnboardingV2Layout';
import OtherStaffOnboardingV2Layout from './pages/onboarding/onboarding_staff/OtherStaffOnboardingV2Layout';
import ExplorerOnboardingV2Layout from './pages/onboarding/onboarding_explorer/ExplorerOnboardingV2Layout';

const router = createBrowserRouter([
  {
    Component: App,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login',    element: <Login /> },
      { path: 'otp-verify', element: <OTPVerify /> },
      { path: 'mobile-verify', element: <MobileOTPVerify /> },
      { path: 'register', element: <Register /> },
      { path: 'password-reset', element: <PasswordResetRequestPage /> },
      { path: '/terms-of-service', element: <TermsOfServicePage /> },


      { path: 'shifts/public-board', element: <PublicJobBoardPage /> },
      { path: 'shifts/link',         element: <SharedShiftLandingPage /> },

      { path: 'membership/apply/:token', element: <MembershipApplyPage /> },

      // PUBLIC referee confirmation page (add here)
      { path: 'referee/questionnaire/:token', element: <RefereeQuestionnairePage /> },
      { path: 'onboarding/referee-reject/:pk/:refIndex', element: <RefereeRejectPage /> },

      // Password reset confirm route
      { path: 'reset-password/:uid/:token', element: <ResetPasswordPage /> },

      // Orgnization
      {
        path: 'dashboard/organization',
        Component: () => (
          <ProtectedRoute requiredRole="ORG_ADMIN">
            <OrganizationDashboardWrapper />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <OrganizationOverviewPage /> },
          { path: 'overview', element: <OrganizationOverviewPage /> },
          { path: 'invite',   element: <InviteStaffPage /> },
          { path: 'claim',    element: <ClaimPharmaciesPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'community-groups', element: <CommunityGroupsPage /> },
          { path: 'organization-hub', element: <OrganizationHubPage /> },
          {
            path: 'manage-pharmacies',
            children: [
              { index: true, element: <PharmacyPage /> },
              { path: 'my-pharmacies',    element: <PharmacyPage /> },
              { path: 'my-chain', element: <ChainPage /> },
              { path: 'roster', element: <RosterOwnerPage /> },

            ],
          },
          { path: 'post-shift', element: <PostShiftPage /> },
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
              { path: 'active',    element: <ActiveShiftsPage /> },
              { path: 'confirmed', element: <ConfirmedShiftsPage /> },
              { path: 'history',   element: <HistoryShiftsPage /> },
              { path: ':id', element: <PosterShiftDetailPage /> },

                ],
          },
        ],
      },

      // standalone owner onboarding
      {
        path: 'onboarding/owner',
        element: (
          <ProtectedRoute requiredRole="OWNER">
            <OwnerOnboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: 'onboarding/pharmacist',
        element: (
          <ProtectedRoute requiredRole="PHARMACIST">
            <PharmacistOnboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: 'onboarding/otherstaff',
        element: (
          <ProtectedRoute requiredRole="OTHER_STAFF">
            <OtherStaffOnboarding />
          </ProtectedRoute>
        ),
      },
      {
        path: 'onboarding/explorer',
        element: (
          <ProtectedRoute requiredRole="EXPLORER">
            <ExplorerOnboarding />
          </ProtectedRoute>
        ),
      },

      // dashboard/owner
      {
        path: 'dashboard/owner',
        Component: () => (
          <ProtectedRoute requiredRole="OWNER">
            <OwnerDashboardWrapper />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <OwnerOverviewContainer /> },
          { path: 'overview', element: <OwnerOverviewContainer /> },
          { path: 'onboarding', element: <OwnerOnboarding /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'community-groups', element: <CommunityGroupsPage /> },
          { path: 'pharmacy-hub', element: <PharmacyHubPage /> },
          {
            path: 'manage-pharmacies',
            children: [
              { index: true, element: <PharmacyPage /> },
              { path: 'my-pharmacies',    element: <PharmacyPage /> },
              { path: 'my-chain', element: <ChainPage /> },
              { path: 'roster', element: <RosterOwnerPage /> },
            ],
          },
          { path: 'post-shift', element: <PostShiftPage /> },
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
              { path: 'active',    element: <ActiveShiftsPage /> },
              { path: 'confirmed', element: <ConfirmedShiftsPage /> },
              { path: 'history',   element: <HistoryShiftsPage /> },
              { path: ':id', element: <PosterShiftDetailPage /> },
                ],
          },
          { path: 'interests',    element: <ExplorerInterestsPage /> },
          { path: 'learning',     element: <LearningMaterialsPage /> },
          { path: 'logout',       element: <LogoutPage /> },
        ],
      },

      // dashboard/pharmacist
      {
        path: 'dashboard/pharmacist',
        Component: () => (
          <ProtectedRoute requiredRole="PHARMACIST">
            <PharmacistDashboardWrapper />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <OverviewPageStaff /> },
          { path: 'overview', element: <OverviewPageStaff /> },
          // { path: 'onboarding', element: <PharmacistOnboarding /> },
          
            // NEW: V2 onboarding (tab-per-page layout with nested routes)
          // V2 — single page with its own left-buttons + progress bar
          { path: 'onboarding-v2', element: <PharmacistOnboardingV2Layout  /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'community-groups', element: <CommunityGroupsPage /> },
          { path: 'pharmacy-hub', element: <PharmacyHubPage /> },

 
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
              { path: 'confirmed', element: <MyConfirmedShiftsPage /> },
              { path: 'history',   element: <MyHistoryShiftsPage /> },
              { path: ':id', element: <WorkerShiftDetailPage /> },
              { path: 'roster', element: <RosterWorkerPage /> },
            ],
          },
          { path: 'availability', element: <SetAvailabilityPage /> },
          {
            path: 'invoice',
            element: <Outlet />,
            children: [
              { index: true, element: <InvoiceManagePage /> },
              { path: 'new', element: <InvoiceGeneratePage /> },
              { path: ':id', element: <InvoiceDetailPage /> },
            ],
          },

          { path: 'interests',    element: <ExplorerInterestsPage /> },
          { path: 'learning',     element: <LearningMaterialsPage /> },
          { path: 'logout',       element: <LogoutPage /> },
        ],
      },

      // dashboard/OtherStaff
      {
        path: 'dashboard/otherstaff',
        Component: () => (
          <ProtectedRoute requiredRole="OTHER_STAFF">
            <OtherstaffDashboardWrapper />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <OverviewPageStaff /> },
          { path: 'overview', element: <OverviewPageStaff /> },
          // { path: 'onboarding', element: <OtherStaffOnboarding /> },
          { path: 'onboarding-v2', element: <OtherStaffOnboardingV2Layout   /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'community-groups', element: <CommunityGroupsPage /> },
          { path: 'pharmacy-hub', element: <PharmacyHubPage /> },
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
              { path: 'confirmed', element: <MyConfirmedShiftsPage /> },
              { path: 'history',   element: <MyHistoryShiftsPage /> },
              { path: ':id', element: <WorkerShiftDetailPage /> },
              { path: 'roster', element: <RosterWorkerPage /> },
            ],
          },
          { path: 'availability', element: <SetAvailabilityPage /> },
          {
            path: 'invoice',
            element: <Outlet />,
            children: [
              { index: true, element: <InvoiceManagePage /> },
              { path: 'new', element: <InvoiceGeneratePage /> },
              { path: ':id', element: <InvoiceDetailPage /> },
            ],
          },
          { path: 'interests',    element: <ExplorerInterestsPage /> },
          { path: 'learning',     element: <LearningMaterialsPage /> },
          { path: 'logout',       element: <LogoutPage /> },
        ],
      },
      

      // dashboard/explorer
      {
        path: 'dashboard/explorer',
        Component: () => (
          <ProtectedRoute requiredRole="EXPLORER">
            <ExplorerDashboardWrapper />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <OverviewPageStaff /> },
          { path: 'overview', element: <OverviewPageStaff /> },
          // { path: 'onboarding', element: <ExplorerOnboarding /> },
          { path: 'onboarding-v2', element: <ExplorerOnboardingV2Layout  /> },
          { path: 'chat', element: <ChatPage /> },
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
            ],
          },
          { path: 'interests',    element: <ExplorerInterestsPage /> },
          { path: 'learning',     element: <LearningMaterialsPage /> },
          { path: 'logout',       element: <LogoutPage /> },
        ],
      },      
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* AuthProvider must wrap RouterProvider */}
    <AuthProvider>
      <WorkspaceProvider> {/* Add this wrapper */}
      <RouterProvider router={router} />
      </WorkspaceProvider> {/* Close wrapper */}
    </AuthProvider>
  </React.StrictMode>
);
