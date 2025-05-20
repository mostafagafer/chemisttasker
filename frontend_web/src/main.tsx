import React from 'react';
import ReactDOM from 'react-dom/client';
import { Outlet } from 'react-router-dom';

import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import App from './App';
import LandingPage     from './pages/LandingPage';
import Login           from './pages/login';
import Register        from './pages/register';
import ResetPasswordPage from './pages/ResetPasswordPage';

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



import ProtectedRoute from './components/ProtectedRoute';
import OwnerDashboardWrapper from './layouts/ownerDashboard';
import PharmacistDashboardWrapper from './layouts/pharmacistDashboard';
import OtherstaffDashboardWrapper from './layouts/otherStaffDashboard';
import ExplorerDashboardWrapper from './layouts/explorerDashboard';



// owner stub pages
import OverviewPage          from './pages/dashboard/sidebar/OverviewPage';
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

// Invoice
import InvoiceManagePage   from './pages/dashboard/sidebar/InvoiceManagePage';
import InvoiceGeneratePage   from './pages/dashboard/sidebar/InvoiceGeneratePage';
import InvoiceDetailPage   from './pages/dashboard/sidebar/ManageInvoicesPage';

import { AuthProvider } from './contexts/AuthContext';

const router = createBrowserRouter([
  {
    Component: App,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login',    element: <Login /> },
      { path: 'register', element: <Register /> },
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
          {
            path: 'manage-pharmacies',
            children: [
              { index: true, element: <PharmacyPage /> },
              { path: 'my-pharmacies',    element: <PharmacyPage /> },
              { path: 'my-chain', element: <ChainPage /> },
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
          { index: true, element: <OverviewPage /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'onboarding', element: <OwnerOnboarding /> },
          {
            path: 'manage-pharmacies',
            children: [
              { index: true, element: <PharmacyPage /> },
              { path: 'my-pharmacies',    element: <PharmacyPage /> },
              { path: 'my-chain', element: <ChainPage /> },
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
                ],
          },
          // { path: 'availability', element: <SetAvailabilityPage /> },
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
          { index: true, element: <OverviewPage /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'onboarding', element: <PharmacistOnboarding /> },
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
              { path: 'confirmed', element: <MyConfirmedShiftsPage /> },
              { path: 'history',   element: <MyHistoryShiftsPage /> },
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
          { index: true, element: <OverviewPage /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'onboarding', element: <OtherStaffOnboarding /> },
          {
            path: 'shifts',
            children: [
              { index: true, element: <PublicShiftsPage /> },
              { path: 'public',    element: <PublicShiftsPage /> },
              { path: 'community', element: <CommunityShiftsPage /> },
              { path: 'confirmed', element: <MyConfirmedShiftsPage /> },
              { path: 'history',   element: <MyHistoryShiftsPage /> },
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
          { index: true, element: <OverviewPage /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'onboarding', element: <ExplorerOnboarding /> },
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
      { path: '*', element: <LandingPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* AuthProvider must wrap RouterProvider */}
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
