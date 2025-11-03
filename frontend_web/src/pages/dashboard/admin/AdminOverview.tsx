import { Card, CardContent, Stack, Typography, Button, Grid, Box } from "@mui/material";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import StoreIcon from "@mui/icons-material/Store";
import ChatIcon from "@mui/icons-material/Chat";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useAdminScope } from "../../../contexts/AdminScopeContext";

type QuickAction = {
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
};

export default function AdminOverview() {
  const { assignment, pharmacyId } = useAdminScope();
  const navigate = useNavigate();

  const quickActions: QuickAction[] = [
    {
      label: "Manage Pharmacies",
      description: "Edit pharmacy profile, admins, and staff",
      icon: <ManageAccountsIcon />,
      path: "manage-pharmacies",
    },
    {
      label: "Internal Roster",
      description: "Review assignments and cover requests",
      icon: <CalendarMonthIcon />,
      path: "manage-pharmacies/roster",
    },
    {
      label: "Post Shift",
      description: "Create a new shift for this pharmacy",
      icon: <StoreIcon />,
      path: "post-shift",
    },
    {
      label: "Chat",
      description: "Talk with staff, locums, and admins",
      icon: <ChatIcon />,
      path: "chat",
    },
  ];

  return (
    <Stack spacing={4}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={700}>
            {assignment.pharmacy_name || `Pharmacy #${pharmacyId}`}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={2}>
            <InfoBadge title="Role" value={formatAdminLevel(assignment.admin_level)} />
            <InfoBadge title="Job Title" value={assignment.job_title || "-"} />
            <InfoBadge title="Staff Role" value={assignment.staff_role || "-"} />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {quickActions.map((action) => (
          <Grid item xs={12} sm={6} md={3} key={action.label}>
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              onClick={() => navigate(action.path)}
              sx={{
                height: "100%",
                justifyContent: "flex-start",
                textTransform: "none",
                borderRadius: 2,
                p: 2,
                alignItems: "flex-start",
              }}
              startIcon={
                <Box
                  sx={{
                    display: "inline-flex",
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: (theme) => theme.palette.action.hover,
                  }}
                >
                  {action.icon}
                </Box>
              }
            >
              <Stack alignItems="flex-start">
                <Typography fontWeight={600}>{action.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {action.description}
                </Typography>
              </Stack>
            </Button>
          </Grid>
        ))}
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={() => navigate("logout")}
          sx={{ alignSelf: "flex-start" }}
        >
          Logout of Admin View
        </Button>
      </Stack>
    </Stack>
  );
}

function InfoBadge({ title, value }: { title: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}

function formatAdminLevel(level: string) {
  switch (level) {
    case "OWNER":
      return "Owner";
    case "MANAGER":
      return "Manager";
    case "ROSTER_MANAGER":
      return "Roster Manager";
    case "COMMUNICATION_MANAGER":
      return "Communications Manager";
    default:
      return level;
  }
}
