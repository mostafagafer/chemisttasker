// src/App.tsx
import { Outlet } from 'react-router-dom'
import { ReactRouterAppProvider } from '@toolpad/core/react-router'
import { useAuth } from './contexts/AuthContext'
import { ORG_ROLES } from './constants/roles'
import {
  ORGANIZATION_NAV,
  OWNER_NAV,
  PHARMACIST_NAV,
  OTHERSTAFF_NAV,
  EXPLORER_NAV,
} from './navigation'

export default function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null  // or a spinner

  // user is guaranteed here by ProtectedRoute
  const isOrg = user!.memberships?.some(m => ORG_ROLES.includes(m.role as any))
  const nav = isOrg
    ? ORGANIZATION_NAV
    : user!.role === 'OWNER'
    ? OWNER_NAV
    : user!.role === 'PHARMACIST'
    ? PHARMACIST_NAV
    : user!.role === 'OTHER_STAFF'
    ? OTHERSTAFF_NAV
    : EXPLORER_NAV

  return (
    <ReactRouterAppProvider navigation={nav} branding={{ title: 'ChemistTasker' }}>
      <Outlet />
    </ReactRouterAppProvider>
  )
}

