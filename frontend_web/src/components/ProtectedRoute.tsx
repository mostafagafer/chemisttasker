// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ORG_ROLES } from "../constants/roles";

type ProtectedRouteProps = {
  children: React.ReactElement;
  requiredRole?: string;
  requireAdmin?: boolean;
};

export default function ProtectedRoute({
  children,
  requiredRole,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { token, user, isLoading, isAdminUser } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!requiredRole && !requireAdmin) {
    return children;
  }

  if (!user) {
    return <div>Loading user...</div>;
  }

  // If the route requires admin and the user is an admin, allow access.
  // This is the key fix: it prevents the role-based checks below from incorrectly
  // redirecting an admin user who is in their 'admin' persona.
  if (requireAdmin && isAdminUser) {
    return children;
  }

  if (requireAdmin && !isAdminUser) {
    return (
      <Navigate
        to={`/dashboard/${(user.role || "explorer").toLowerCase()}/overview`}
        replace
      />
    );
  }

  const hasBaseRole = user.role === requiredRole;
  const hasOrgRole =
    Array.isArray(user.memberships) &&
    user.memberships.some((m: any) => ORG_ROLES.includes(m.role as any));
  const hasOwnerAccess = isAdminUser || user.role === "OWNER";

  if (hasBaseRole) {
    return children;
  }

  if (requiredRole === "ORG_ADMIN" && hasOrgRole) {
    return children;
  }

  if (requiredRole === "OWNER" && hasOwnerAccess) {
    return children;
  }

  return (
    <Navigate
      to={`/dashboard/${(user.role || "explorer").toLowerCase()}/overview`}
      replace
    />
  );
}
