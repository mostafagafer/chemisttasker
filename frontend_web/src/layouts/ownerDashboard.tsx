import { Outlet } from 'react-router-dom';
import { DashboardLayout, SidebarFooterProps } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import Typography from '@mui/material/Typography';

function SidebarFooter({ mini }: SidebarFooterProps) {
  return (
    <Typography variant="caption" sx={{ m:1, whiteSpace:'nowrap', overflow:'hidden' }}>
      {mini ? '© CT' : `© ${new Date().getFullYear()} ChemistTasker`}
    </Typography>
  );
}

export default function OwnerDashboardWrapper() {
  return (
    <DashboardLayout slots={{ sidebarFooter: SidebarFooter }}>
      <PageContainer>
        <Outlet />
      </PageContainer>
    </DashboardLayout>
  );
}
