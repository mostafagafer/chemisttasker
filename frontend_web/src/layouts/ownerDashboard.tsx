import { Outlet } from 'react-router-dom';
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { PageContainer } from "@toolpad/core/PageContainer";
import CustomAppTitle from "./CustomAppTitle";
import { useAuth } from "../contexts/AuthContext";
import TopBarActions from "./TopBarActions";
import { ColorModeProvider } from "../theme/sleekTheme";
import DashboardShell from "./DashboardShell";
import DashboardSidebarFooter from "./DashboardSidebarFooter";

export default function OwnerDashboardWrapper() {
  const { user } = useAuth();

  return (
    <ColorModeProvider>
      <DashboardShell>
        <DashboardLayout
          sidebarExpandedWidth={288}
          slots={{
            appTitle: () => <CustomAppTitle userRole={user?.role || "OWNER"} />,
            toolbarActions: TopBarActions,
            sidebarFooter: DashboardSidebarFooter,
          }}
        >
          <PageContainer
            slots={{ header: () => null }}
            sx={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              px: { xs: 2, md: 4 },
              py: { xs: 2, md: 4 },
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
