import { ReactNode, useEffect, useMemo } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { CircularProgress, Stack, Typography } from "@mui/material";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { PageContainer } from "@toolpad/core/PageContainer";
import CustomAppTitle from "./CustomAppTitle";
import { useAuth } from "../contexts/AuthContext";
import TopBarActions from "./TopBarActions";
import { ColorModeProvider } from "../theme/sleekTheme";
import DashboardShell from "./DashboardShell";
import DashboardSidebarFooter from "./DashboardSidebarFooter";
import { AdminScopeProvider } from "../contexts/AdminScopeContext";

export default function AdminDashboardWrapper() {
  const { pharmacyId: pharmacyIdParam } = useParams<{ pharmacyId: string }>();
  const {
    adminAssignments,
    selectAdminPersona,
    activeAdminAssignment,
    activePersona,
  } = useAuth();
  const navigate = useNavigate();

  const assignment = useMemo(() => {
    const targetId = pharmacyIdParam ? Number(pharmacyIdParam) : NaN;
    if (!Number.isFinite(targetId)) {
      return adminAssignments[0] ?? null;
    }
    return (
      adminAssignments.find((item) => item.pharmacy_id === targetId) ??
      adminAssignments[0] ??
      null
    );
  }, [adminAssignments, pharmacyIdParam]);

  useEffect(() => {
    if (assignment) {
      return;
    }
    const first = adminAssignments[0];
    if (first?.pharmacy_id != null) {
      navigate(`/dashboard/admin/${first.pharmacy_id}/overview`, { replace: true });
    }
  }, [assignment, adminAssignments, navigate]);

  useEffect(() => {
    if (!assignment) {
      return;
    }
    if (activePersona !== "admin") {
      return;
    }
    if (assignment.id != null && activeAdminAssignment?.id !== assignment.id) {
      selectAdminPersona(assignment.id);
    }
    if (
      assignment.pharmacy_id != null &&
      (!pharmacyIdParam || Number(pharmacyIdParam) !== assignment.pharmacy_id)
    ) {
      navigate(`/dashboard/admin/${assignment.pharmacy_id}/overview`, { replace: true });
    }
  }, [
    assignment,
    activePersona,
    activeAdminAssignment?.id,
    selectAdminPersona,
    navigate,
    pharmacyIdParam,
  ]);

  if (!assignment) {
    return null;
  }

  let layoutContent: ReactNode;
  let wrapWithScope = false;

  if (activePersona !== "admin") {
    layoutContent = (
      <Stack spacing={2} sx={{ py: 6 }}>
        <Typography variant="h6" fontWeight={600}>
          Switch to the Admin persona to access this pharmacy workspace.
        </Typography>
        <Typography color="text.secondary">
          Use the persona selector in the top bar to choose an admin assignment.
        </Typography>
      </Stack>
    );
  } else if (activeAdminAssignment?.pharmacy_id !== assignment.pharmacy_id) {
    layoutContent = (
      <Stack
        spacing={2}
        alignItems="center"
        justifyContent="center"
        sx={{ py: 6 }}
      >
        <CircularProgress />
        <Typography color="text.secondary">Preparing admin context...</Typography>
      </Stack>
    );
  } else {
    layoutContent = <Outlet />;
    wrapWithScope = true;
  }

  const layout = (
    <DashboardLayout
      sidebarExpandedWidth={288}
      slots={{
        appTitle: () => <CustomAppTitle userRole="ADMIN" />,
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
        {layoutContent}
      </PageContainer>
    </DashboardLayout>
  );

  return (
    <ColorModeProvider>
      <DashboardShell>
        {wrapWithScope ? (
          <AdminScopeProvider assignment={assignment}>{layout}</AdminScopeProvider>
        ) : (
          layout
        )}
      </DashboardShell>
    </ColorModeProvider>
  );
}
