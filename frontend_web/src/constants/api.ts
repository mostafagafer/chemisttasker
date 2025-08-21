// export const API_BASE_URL = 'http://localhost:8000';
export const API_BASE_URL = import.meta.env.VITE_API_URL
// console.log("✅ VITE_API_URL (live):", API_BASE_URL);

export const API_ENDPOINTS = {
  // Auth
  login: '/users/login/',
  register: '/users/register/',
  refresh: '/users/token/refresh/',  
  verifyOtp: "/users/verify-otp/",
  resendOtp: "/users/resend-otp/",
  
  // Dashboards
  organizations: '/client_profile/organizations/',

  // organizationDashboard: '/client-profile/dashboard/organization/',
  organizationDashboard: (orgId: number) =>`/client-profile/dashboard/organization/${orgId}/`,
  ownerDashboard: '/client-profile/dashboard/owner/',
  pharmacistDashboard: '/client-profile/dashboard/pharmacist/',
  otherStaffDashboard: '/client-profile/dashboard/otherstaff/',
  explorerDashboard: '/client-profile/dashboard/explorer/',

  // Onboarding
  onboardingDetail: (role: string) => {
    const safeRole = role === 'other_staff' ? 'otherstaff' : role;
    return `/client-profile/${safeRole}/onboarding/me/`;
  },
  onboardingCreate: (role: string) => {
    const safeRole = role === 'other_staff' ? 'otherstaff' : role;
    return `/client-profile/${safeRole}/onboarding/`;
  },


  onboardingV2Detail: (role: 'pharmacist'|'owner'|'otherstaff'|'explorer') =>
  `/client-profile/${role}/onboarding-v2/me/`,

  // refereeConfirm: (pk: string | number, refIndex: string | number) =>
  //   `/client-profile/onboarding/referee-confirm/${pk}/${refIndex}/`,

  submitRefereeResponse: (token: string) =>
  `/client-profile/onboarding/submit-reference/${token}/`,

  refereeReject: (pk: string | number, refIndex: string | number) =>
  `/client-profile/onboarding/referee-reject/${pk}/${refIndex}/`,

  // invite & claim
  inviteOrgUser: '/users/invite-org-user/',
  passwordReset: '/users/password-reset/', 
  passwordResetConfirm: '/users/password-reset-confirm/',
  claimOnboarding: '/client-profile/owner-onboarding/claim/',

  // Pharmacies
  pharmacies:       '/client-profile/pharmacies/',
  pharmacyDetail:   (pharmacyId: string) => `/client-profile/pharmacies/${pharmacyId}/`,

  // **User Availability**  ← updated to include client-profile
  userAvailabilityList:   '/client-profile/user-availability/',
  userAvailabilityDetail: (id: number) => `/client-profile/user-availability/${id}/`,

  // Chains
  chains:       '/client-profile/chains/',
  chainDetail:  (chainId: string) => `/client-profile/chains/${chainId}/`,
  addPharmacyToChain:   (chainId: string) => `/client-profile/chains/${chainId}/add_pharmacy/`,
  removePharmacyFromChain:(chainId: string)=> `/client-profile/chains/${chainId}/remove_pharmacy/`,
  addUserToChain:       (chainId: string) => `/client-profile/chains/${chainId}/add_user/`,

  // Users (for invitations/search)
  users: '/users/',

  // Memberships (chain users)
  membershipList:   '/client-profile/memberships/',
  membershipCreate: '/client-profile/memberships/',
  membershipBulkInvite: '/client-profile/memberships/bulk_invite/',
  membershipDelete: (membershipId: string) => `/client-profile/memberships/${membershipId}/`,

  // Shifts
  // Create & marketplace
  createShift:           '/client-profile/community-shifts/',
  getCommunityShifts:    '/client-profile/community-shifts/',
  getPublicShifts:       '/client-profile/public-shifts/',

  // My-Shifts by status
  getActiveShifts:       '/client-profile/shifts/active/',
  getConfirmedShifts:    '/client-profile/shifts/confirmed/',
  getHistoryShifts:      '/client-profile/shifts/history/',
  getMyConfirmedShifts: '/client-profile/my-confirmed-shifts/',
  getMyHistoryShifts:   '/client-profile/my-history-shifts/',
  // list interest and rejections records separately
  getShiftInterests:     '/client-profile/shift-interests/',
  getShiftRejections: '/client-profile/shift-rejections/',

  // Actions on individual shifts
  expressInterestInShift: (shiftId: string|number) => `/client-profile/shifts/${shiftId}/express_interest/`,
  revealProfile:         (shiftId: string|number) => `/client-profile/shifts/${shiftId}/reveal_profile/`,
  acceptUserToShift:     (shiftId: string|number) => `/client-profile/shifts/${shiftId}/accept_user/`,
  getCommunityShiftDetail: (id: string | number) => `/client-profile/community-shifts/${id}`,
  getPublicShiftDetail:    (id: string | number) => `/client-profile/public-shifts/${id}`,
  getActiveShiftDetail:    (id: string | number) => `/client-profile/shifts/active/${id}`,
  getConfirmedShiftDetail: (id: string | number) => `/client-profile/shifts/confirmed/${id}/`,
  escalateCommunityShift: (shiftId: string | number) => `/client-profile/community-shifts/${shiftId}/escalate/`,
  getCommunityShiftMemberStatus: (shiftId: string | number) => `/client-profile/community-shifts/${shiftId}/member_status/`,
  rejectCommunityShift: (shiftId: string | number) => `/client-profile/community-shifts/${shiftId}/reject/`,
  getWorkerShiftDetail: (id: string | number) => `/client-profile/shifts/${id}/`,
  viewAssignedShiftProfile: (shiftId: string | number) => `/client-profile/shifts/confirmed/${shiftId}/view_assigned_profile/`,

  // Publicshifts
  generateShareLink: (shiftId: string | number) => `/client-profile/shifts/${shiftId}/generate-share-link/`,
  getPublicJobBoard: '/client-profile/public-job-board/',
  getViewSharedShift: '/client-profile/view-shared-shift/',

  // Roster
  getRosterOwner: '/client-profile/roster-owner/',
  getRosterWorker: '/client-profile/roster-worker/',
  createShiftAndAssign: '/client-profile/roster/create-and-assign-shift/',

  // Leave Requests
  leaveRequests: '/client-profile/leave-requests/',
  createLeaveRequest: '/client-profile/leave-requests/',
  approveLeaveRequest: (leaveId: number) => `/client-profile/leave-requests/${leaveId}/approve/`,
  rejectLeaveRequest: (leaveId: number) => `/client-profile/leave-requests/${leaveId}/reject/`,

  // NEW: Endpoints for managing a SHIFT from the roster view
  rosterManageShift: (shiftId: number) => `/client-profile/roster/manage-shifts/${shiftId}/`, // For EDIT (PATCH) and DELETE
  rosterEscalateShift: (shiftId: number) => `/client-profile/roster/manage-shifts/${shiftId}/escalate/`, // For ESCALATE (POST)

  // NOTE: Deleting an ASSIGNMENT still uses getRosterOwner
  rosterDeleteAssignment: (assignmentId: number) => `/client-profile/roster-owner/${assignmentId}/`,

  // invoice
  // Create (manual or shift-based) & list invoices
  invoices: '/client-profile/invoices/',
  // Retrieve / update / delete a specific invoice
  invoiceDetail: (id: number) => `/client-profile/invoices/${id}/`,
  // Shortcut to generate from shifts
  generateInvoice: '/client-profile/invoices/generate/',
  invoicePreview: (id: number) => `/client-profile/invoices/preview/${id}/`,
  invoicePdf: (id: number) => `/client-profile/invoices/${id}/pdf/`,
  sendInvoice: (id: number) => `/client-profile/invoices/${id}/send/`,

};

