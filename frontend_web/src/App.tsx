import { useEffect, useState, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import { useAuth } from "./contexts/AuthContext";
import { useWorkspace } from "./contexts/WorkspaceContext";
import {
  getOrganizationNav,
  getOwnerNav,
  getPharmacistNavDynamic,
  getOtherStaffNavDynamic,
  getExplorerNav,
} from "./navigation";
import apiClient from "./utils/apiClient";

// ✨ HOOK 1: Your existing hook for onboarding progress
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
        .get(`/client-profile/${key}/onboarding-v2/me/`)
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
  // FIX: Get user, isLoading, AND the new unreadCount directly from the AuthContext
  const { user, isLoading, unreadCount } = useAuth();
  const { workspace } = useWorkspace();
  
  // Call your existing progress hook
  const progress = useOnboardingProgress(user);
  
  const nav = useMemo(() => {
    if (!user) return [];
    
    // FIX: Use the unreadCount from the context to determine if there are new messages
    const hasUnreadMessages = unreadCount > 0;

    // The rest of your navigation logic correctly uses the hasUnreadMessages flag
    if (
      Array.isArray(user.memberships) &&
      user.memberships.some(
        (m) => m?.role && ["ORG_ADMIN", "ORG_OWNER", "ORG_STAFF"].includes(m.role)
      )
    ) {
      return getOrganizationNav(hasUnreadMessages);
    }

    if (
      Array.isArray(user.memberships) &&
      user.memberships.some((m) => m?.role === "PHARMACY_ADMIN")
    ) {
      return getOwnerNav(progress, hasUnreadMessages);
    }

    if (user.role === "OWNER") return getOwnerNav(progress, hasUnreadMessages);
    if (user.role === "PHARMACIST") return getPharmacistNavDynamic(progress, workspace, hasUnreadMessages);
    if (user.role === "OTHER_STAFF") return getOtherStaffNavDynamic(progress, workspace, hasUnreadMessages);
    if (user.role === "EXPLORER") return getExplorerNav(progress, hasUnreadMessages);
    return [];
  }, [user, progress, workspace, unreadCount]); // Add unreadCount to dependency array

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