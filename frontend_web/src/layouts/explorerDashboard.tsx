import { Outlet } from 'react-router-dom';
import { DashboardLayout, SidebarFooterProps } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import Typography from '@mui/material/Typography';
import CustomAppTitle from "./CustomAppTitle";
import { useAuth } from "../contexts/AuthContext";

function SidebarFooter({ mini }: SidebarFooterProps) {
  return (
    <Typography variant="caption" sx={{ m:1, whiteSpace:'nowrap', overflow:'hidden' }}>
      {mini ? '© CT' : `© ${new Date().getFullYear()} ChemistTasker`}
    </Typography>
  );
}

export default function ExplorerDashboardWrapper() {
  const { user } = useAuth();

  return (
    <DashboardLayout
      slots={{
        appTitle: () => <CustomAppTitle userRole={user?.role || "EXPLORER"} />,
        sidebarFooter: SidebarFooter,
      }}
    >
      <PageContainer slots={{ header: () => null }}>
        <Outlet />
      </PageContainer>
    </DashboardLayout>
  );
}
