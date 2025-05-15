// src/components/ProtectedRoute.tsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ORG_ROLES } from '../constants/roles'

type ProtectedRouteProps = {
  children: React.ReactElement
  requiredRole?: string
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { token, user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div>Loading authentication…</div>
  }

  // 1) If you don’t even have a token, kick back to /login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 2) If no specific role is required, let them through
  if (!requiredRole) {
    return children
  }

  // 3) **Short-circuit if user is still null** (so you never do user.role)
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 4) Now it's safe to inspect user.role & user.memberships
  const hasBaseRole = user.role === requiredRole
  const hasOrgRole = Array.isArray(user.memberships)
    ? user.memberships.some(m => m?.role && ORG_ROLES.includes(m.role as any))
    : false

  const allowOrgZone = requiredRole === 'ORG_ADMIN' && hasOrgRole

  if (!hasBaseRole && !allowOrgZone) {
    // pick the “dashboard for their base role”
    return (
      <Navigate
        to={`/dashboard/${user.role.toLowerCase()}/overview`}
        replace
      />
    )
  }

  return children
}
