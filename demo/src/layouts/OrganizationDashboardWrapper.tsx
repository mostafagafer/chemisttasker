import { useMemo } from "react";
import { Outlet } from "react-router-dom";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { PageContainer } from "@toolpad/core/PageContainer";
import TopBarActions from "./TopBarActions";
import { ColorModeProvider } from "../theme/sleekTheme";
import DashboardShell from "./DashboardShell";
import DashboardSidebarFooter from "./DashboardSidebarFooter";
import CustomAppTitle from "./CustomAppTitle";
import { useAuth } from "../contexts/AuthContext";

export default function OrganizationDashboardWrapper() {
  const { user } = useAuth();

  const organizationName = useMemo(() => {
    const memberships = Array.isArray(user?.memberships) ? user!.memberships : [];
    for (const record of memberships) {
      if (!record || typeof record !== "object") {
        continue;
      }
      const role = String((record as any).role ?? "").toUpperCase();
      if (!["ORG_ADMIN", "ORG_OWNER", "ORG_STAFF", "CHIEF_ADMIN", "REGION_ADMIN"].includes(role)) {
        continue;
      }
      const name = (record as any).organization_name;
      if (typeof name === "string" && name.trim().length > 0) {
        return name.trim();
      }
    }
    if (typeof (user as any)?.organization_name === "string") {
      const name = (user as any).organization_name.trim();
      if (name) {
        return name;
      }
    }
    return null;
  }, [user]);

  const titleOverride = organizationName ?? "Organization Dashboard";

  return (
    <ColorModeProvider>
      <DashboardShell>
        <DashboardLayout
          sidebarExpandedWidth={288}
          slots={{
            appTitle: () => (
              <CustomAppTitle
                userRole={user?.role ?? "ORG_ADMIN"}
                titleOverride={titleOverride}
                showVerificationChip={false}
              />
            ),
            toolbarActions: TopBarActions,
            sidebarFooter: DashboardSidebarFooter,
          }}
        >
          <PageContainer
            maxWidth={false}
            disableGutters
            slots={{ header: () => null }}
            sx={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              px: { xs: 1.5, md: 3 },
              py: { xs: 2, md: 3 },
              gap: { xs: 2, md: 3 },
            }}
          >
            <Outlet />
          </PageContainer>
        </DashboardLayout>
      </DashboardShell>
    </ColorModeProvider>
  );
}
