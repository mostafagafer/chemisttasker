// src/components/ProtectedRoute.tsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ORG_ROLES } from '../constants/roles';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';

type ProtectedRouteProps = {
  children: React.ReactElement;
  requiredRole?: string;
};

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { token, user, isLoading } = useAuth();
  const location = useLocation();

  // 1) Still loading a refresh?
  if (isLoading) {
    return <div>Loading authentication…</div>;
  }

  // 2) Not logged in at all?
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3) No specific role required → grant access
  if (!requiredRole) {
    return children;
  }

  // 4) Token exists but user object is not set yet
  if (!user) {
    return <div>Loading user…</div>;
  }

  // 5) Base role checks
  const hasBaseRole = user.role === requiredRole;
  const hasOrgRole = Array.isArray(user.memberships)
    ? user.memberships.some((m: any) => ORG_ROLES.includes(m.role as any))
    : false;
  const allowOrgZone = requiredRole === 'ORG_ADMIN' && hasOrgRole;

  // NEW: recognize Pharmacy Admins (membership-based, not user.role)
  const isPharmacyAdmin =
    Array.isArray(user.memberships) &&
    user.memberships.some((m: any) => m?.role === 'PHARMACY_ADMIN');

  // 6) If route wants OWNER, allow it for users who can actually hit the Owner dashboard (Owners or Pharmacy Admins)
  const [ownerLikeOK, setOwnerLikeOK] = useState<boolean | null>(null);

  useEffect(() => {
    let aborted = false;

    async function probeOwnerLike() {
      // Only probe if this route requires OWNER and the base check failed
      if (requiredRole === 'OWNER' && !hasBaseRole && !allowOrgZone) {
        try {
          const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ownerDashboard}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!aborted) setOwnerLikeOK(res.ok); // backend returns 200 for Owners *and* Pharmacy Admins
        } catch {
          if (!aborted) setOwnerLikeOK(false);
        }
      } else {
        if (!aborted) setOwnerLikeOK(null);
      }
    }

    probeOwnerLike();
    return () => {
      aborted = true;
    };
  }, [requiredRole, hasBaseRole, allowOrgZone, token]);

  // 7) Final decision
  // If base checks pass, allow immediately
  if (hasBaseRole || allowOrgZone || (requiredRole === 'OWNER' && isPharmacyAdmin)) {
    return children;
  }

  // If this route wants OWNER, rely on the probe result
  if (requiredRole === 'OWNER') {
    if (ownerLikeOK === null) {
      // waiting for probe to finish
      return <div>Loading…</div>;
    }
    if (ownerLikeOK) {
      // backend confirmed owner-like access (Owner or Pharmacy Admin)
      return children;
    }
  }

  // Otherwise, redirect to the user's primary dashboard
  return (
    <Navigate
      to={`/dashboard/${(user.role || 'explorer').toLowerCase()}/overview`}
      replace
    />
  );
}
