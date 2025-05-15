// src/components/ProtectedRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ORG_ROLES } from '../constants/roles';

type ProtectedRouteProps = {
  children: React.ReactElement;
  requiredRole?: string;
};

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
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

  // 5) Now safe to read user.role & user.memberships
  const hasBaseRole = user.role === requiredRole;
  const hasOrgRole = Array.isArray(user.memberships)
    ? user.memberships.some(m => ORG_ROLES.includes(m.role as any))
    : false;
  const allowOrgZone = requiredRole === 'ORG_ADMIN' && hasOrgRole;

  if (!hasBaseRole && !allowOrgZone) {
    // redirect them to their own dashboard
    return (
      <Navigate
        to={`/dashboard/${user.role.toLowerCase()}/overview`}
        replace
      />
    );
  }

  // 6) All checks passed
  return children;
}
