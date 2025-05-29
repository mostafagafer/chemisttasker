import { useEffect, useState, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { useAuth } from "./contexts/AuthContext";
import { useWorkspace } from "./contexts/WorkspaceContext";
import {
  ORGANIZATION_NAV,
  getOwnerNav,
  getPharmacistNavDynamic,
  getOtherStaffNavDynamic,
  getExplorerNav,
} from "./navigation";
import apiClient from "./utils/apiClient";

// ✨ Update: use the full user object, not just role
function useOnboardingProgress(user: any) {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!user) return; // No user, don't fetch
    let isMounted = true;
    const validRoles = ["owner", "pharmacist", "other_staff", "explorer"];
    const role = user.role;
    if (role && validRoles.includes(role.toLowerCase())) {
      let key =
        role.toLowerCase() === "other_staff"
          ? "otherstaff"
          : role.toLowerCase();

      apiClient
        .get(`/client-profile/${key}/onboarding/me/`)
        .then((res) => {
          if (isMounted) setProgress(res.data.progress_percent ?? 0);
        })
        .catch(() => {
          if (isMounted) setProgress(0);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user]); // Listen for user changes, not just role

  return progress;
}

export default function App() {
  const { user, isLoading } = useAuth();
  const { workspace } = useWorkspace();

  // No change here: pass the user object instead of just role
  const progress = useOnboardingProgress(user);

  const nav = useMemo(() => {
    if (!user) return [];
    if (
      Array.isArray(user.memberships) &&
      user.memberships.some(
        (m) =>
          m?.role &&
          ["ORG_ADMIN", "ORG_OWNER", "ORG_STAFF"].includes(m.role)
      )
    ) {
      return ORGANIZATION_NAV;
    }
    if (user.role === "OWNER") return getOwnerNav(progress);
    if (user.role === "PHARMACIST") return getPharmacistNavDynamic(progress, workspace);
    if (user.role === "OTHER_STAFF") return getOtherStaffNavDynamic(progress, workspace);
    if (user.role === "EXPLORER") return getExplorerNav(progress);
    return [];
  }, [user, progress, workspace]);

  if (isLoading) return null;
  if (!user) return <Outlet />;

  return (
    <ReactRouterAppProvider
      navigation={nav}
      branding={{ title: "ChemistTasker" }}
    >
      <Outlet />
    </ReactRouterAppProvider>
  );
}
