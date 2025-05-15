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

  if (isLoading) {
    return <div>Loading authentication…</div>;
  }
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const hasBaseRole = user?.role === requiredRole;
    // const hasOrgRole = user?.memberships?.some(m =>
    //   ORG_ROLES.includes(m.role as any)
    // );
    const hasOrgRole = Array.isArray(user?.memberships)
      ? user.memberships.some(m => m?.role && ORG_ROLES.includes(m.role as any))
      : false;

    const allowOrgZone = requiredRole === 'ORG_ADMIN' && hasOrgRole;

    if (!hasBaseRole && !allowOrgZone) {
      // redirect to their own base dashboard
      if (user) {
        return <Navigate to={`/dashboard/${user.role.toLowerCase()}/overview`} replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
