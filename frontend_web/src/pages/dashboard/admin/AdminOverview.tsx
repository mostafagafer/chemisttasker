import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import StoreIcon from "@mui/icons-material/Store";
import ChatIcon from "@mui/icons-material/Chat";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAdminScope } from "../../../contexts/AdminScopeContext";
import apiClient from "../../../utils/apiClient";

type QuickAction = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export default function AdminOverview() {
  const { assignment, pharmacyId } = useAdminScope();
  const navigate = useNavigate();
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const adminBasePath = `/dashboard/admin/${pharmacyId}`;
  const [pillSummary, setPillSummary] = useState<{ balance: number; shift_post_cost: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get("/client-profile/pill-rewards/balance/")
      .then(({ data }) => {
        if (!mounted) return;
        setPillSummary({
          balance: Number(data?.balance ?? 0),
          shift_post_cost: Number(data?.shift_post_cost ?? 0),
        });
      })
      .catch(() => {
        if (mounted) setPillSummary({ balance: 0, shift_post_cost: 0 });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const quickActions: QuickAction[] = [
    {
      title: "Manage Pharmacies",
      description: "Edit pharmacy profile, admins, and staff",
      icon: <ManageAccountsIcon />,
      onClick: () => navigate(`${adminBasePath}/manage-pharmacies`),
    },
    {
      title: "Internal Roster",
      description: "Review assignments and cover requests",
      icon: <CalendarMonthIcon />,
      onClick: () => navigate(`${adminBasePath}/manage-pharmacies/roster`),
    },
    {
      title: "Post Shift",
      description: "Create a new shift for this pharmacy",
      icon: <StoreIcon />,
      onClick: () => navigate(`${adminBasePath}/post-shift`),
    },
    {
      title: "Shift Centre",
      description: "Active, confirmed, and historical shifts",
      icon: <AccessTimeIcon />,
      onClick: () => navigate(`${adminBasePath}/shift-center`),
    },
    {
      title: "Chat",
      description: "Talk with staff, locums, and admins",
      icon: <ChatIcon />,
      onClick: () => navigate(`${adminBasePath}/chat`),
    },
  ];

  return (
    <Stack
      spacing={{ xs: 3, md: 4 }}
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 },
      }}
    >
      <Paper
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          color: "#fff",
          backgroundImage: `linear-gradient(135deg, ${alpha(primary, 0.95)}, ${alpha(
            primary,
            0.6
          )})`,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.45,
            backgroundImage: `radial-gradient(circle at top right, ${alpha(
              "#ffffff",
              0.4
            )} 0%, transparent 55%)`,
            pointerEvents: "none",
          }}
        />
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 560 }}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: ".08em", opacity: 0.7, textTransform: "uppercase" }}
            >
              Admin workspace
            </Typography>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              {assignment.pharmacy_name || `Pharmacy #${pharmacyId}`}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 520 }}>
              Jump into staffing, rosters, and communications for this pharmacy. Use the quick links
              below to move between your most common tasks.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
              <Chip
                size="small"
                label={`${assignment.capabilities?.length ?? 0} capabilities`}
                sx={{ bgcolor: alpha("#ffffff", 0.15), color: "#fff" }}
              />
              <Chip
                size="small"
                label="Admin persona active"
                sx={{ bgcolor: alpha("#ffffff", 0.15), color: "#fff" }}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => navigate(`${adminBasePath}/post-shift`)}
              >
                Post a shift
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => navigate(`${adminBasePath}/manage-pharmacies`)}
                sx={{ borderColor: alpha("#ffffff", 0.45), color: "#fff" }}
              >
                Manage pharmacies
              </Button>
            </Stack>
          </Box>
          <Stack spacing={2} sx={{ position: "relative", zIndex: 1, minWidth: { xs: "100%", md: 320 } }}>
            <Stack
              role="button"
              onClick={() => navigate(`${adminBasePath}/pills`)}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{
                p: 2,
                borderRadius: 3,
                cursor: "pointer",
                bgcolor: alpha("#ffffff", 0.16),
                border: `1px solid ${alpha("#ffffff", 0.24)}`,
                transition: "transform 0.18s ease, background-color 0.18s ease",
                "&:hover": { transform: "translateY(-2px)", bgcolor: alpha("#ffffff", 0.22) },
              }}
            >
              <Box
                component="img"
                src="/images/drugs.png"
                alt=""
                sx={{
                  width: 92,
                  height: 92,
                  objectFit: "contain",
                  flexShrink: 0,
                  filter: `contrast(1.08) saturate(1.08) drop-shadow(0 14px 22px ${alpha("#111827", 0.26)})`,
                }}
              />
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.72 }}>
                  Pharmacy admin pills
                </Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  {pillSummary == null ? (
                    <CircularProgress size={22} sx={{ color: "#fff" }} />
                  ) : (
                    <Typography variant="h4" fontWeight={900} lineHeight={1}>
                      {pillSummary.balance}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ opacity: 0.86 }}>
                    pills
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={pillSummary ? `${pillSummary.shift_post_cost} pills per shift post` : "Custom rates"}
                    sx={{ bgcolor: alpha("#ffffff", 0.18), color: "#fff" }}
                  />
                  <Chip size="small" label={`Pharmacy #${pharmacyId}`} sx={{ bgcolor: alpha("#ffffff", 0.18), color: "#fff" }} />
                </Stack>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <InfoBadge title="Role" value={formatAdminLevel(assignment.admin_level)} tone="light" />
              <InfoBadge title="Job Title" value={assignment.job_title || "-"} tone="light" />
              <InfoBadge title="Staff Role" value={assignment.staff_role || "-"} tone="light" />
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {quickActions.map((action) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.title}>
            <Paper
              role="button"
              onClick={action.onClick}
              sx={{
                height: "100%",
                borderRadius: 3,
                p: 2.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: `1px solid ${alpha(primary, 0.08)}`,
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: theme.shadows[6],
                },
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <IconButton
                  size="small"
                  disableRipple
                  sx={{
                    bgcolor: alpha(primary, 0.12),
                    color: primary,
                  }}
                >
                  {action.icon}
                </IconButton>
                <Stack spacing={0.5}>
                  <Typography fontWeight={700}>{action.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </Stack>
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ mt: "auto", fontWeight: 600, color: primary }}
              >
                <Typography variant="body2">Open</Typography>
                <ArrowForwardIcon fontSize="small" />
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper
        sx={{
          borderRadius: 3,
          p: { xs: 2.5, md: 3 },
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >

        <Button
          variant="text"
          color="primary"
          startIcon={<LogoutIcon />}
          onClick={() => navigate(`${adminBasePath}/logout`)}
          sx={{ alignSelf: "flex-start" }}
        >
          Logout of Admin View
        </Button>
      </Paper>
    </Stack>
  );
}

function InfoBadge({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: string;
  tone?: "default" | "light";
}) {
  const titleColor = tone === "light" ? "rgba(255,255,255,0.7)" : "text.secondary";
  const valueColor = tone === "light" ? "#ffffff" : "text.primary";

  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" sx={{ color: titleColor }}>
        {title}
      </Typography>
      <Typography variant="body1" fontWeight={700} sx={{ color: valueColor }}>
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
