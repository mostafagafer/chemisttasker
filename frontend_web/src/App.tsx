// src/App.tsx
import { Outlet } from 'react-router-dom';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { useAuth } from './contexts/AuthContext';
import { ORG_ROLES } from './constants/roles';
import {
  ORGANIZATION_NAV,
  OWNER_NAV,
  PHARMACIST_NAV,
  OTHERSTAFF_NAV,
  EXPLORER_NAV,
} from './navigation';

export default function App() {
  const { user, isLoading } = useAuth();

  // 1) While we’re checking tokens/refresh…
  if (isLoading) return null;

  // 2) If there is NO user (i.e. on landing/login/register), 
  //    just render the child route and don’t try to read user.role
  if (!user) {
    return <Outlet />;
  }

  // 3) From here on, user is guaranteed non-null,
  //    so it’s safe to read user.role and user.memberships:
  const isOrg = Array.isArray(user.memberships)
    ? user.memberships.some(m => m?.role && ORG_ROLES.includes(m.role as any))
    : false;

  const nav = isOrg
    ? ORGANIZATION_NAV
    : user.role === 'OWNER'
    ? OWNER_NAV
    : user.role === 'PHARMACIST'
    ? PHARMACIST_NAV
    : user.role === 'OTHER_STAFF'
    ? OTHERSTAFF_NAV
    : EXPLORER_NAV;

  return (
    <ReactRouterAppProvider navigation={nav} branding={{ title: 'ChemistTasker' }}>
      <Outlet />
    </ReactRouterAppProvider>
  );
}
