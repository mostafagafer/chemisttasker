// src/pages/dashboard/organization/OrganizationOverviewPage.tsx

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import HubIcon from "@mui/icons-material/Hub";
import PostAddIcon from "@mui/icons-material/PostAdd";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import StoreIcon from "@mui/icons-material/Store";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import type { OrgMembership } from "../../../contexts/AuthContext";
import { ORG_ROLES } from "../../../constants/roles";
import { getOrganizationDashboard } from "@chemisttasker/shared-core";

type QuickAction = {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
};

type StatItem = {
  label: string;
  value: string | number;
  helper?: string;
};

export default function OrganizationOverviewPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const primary = theme.palette.primary.main;

  const isOrgMembership = (membership: unknown): membership is OrgMembership => {
    if (!membership || typeof membership !== "object") return false;
    const candidate = membership as OrgMembership & { role?: string };
    return (
      typeof candidate.organization_id === "number" &&
      typeof candidate.role === "string" &&
      ORG_ROLES.includes(candidate.role as any)
    );
  };

  const orgMembership = Array.isArray(user?.memberships)
    ? user.memberships.find(isOrgMembership)
    : undefined;
  const orgId = orgMembership?.organization_id ?? null;

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      return;
    }
    let isActive = true;

    setError(null);

    getOrganizationDashboard(orgId)
      .then((res) => {
        if (!isActive) {
          return;
        }
        setData(res as any);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        if (!isActive) {
          return;
        }
        setError("Failed to load organization dashboard.");
      });

    return () => {
      isActive = false;
    };
  }, [orgId]);

  const claims = useMemo(
    () => (Array.isArray(data?.pharmacy_claims) ? data.pharmacy_claims : []),
    [data]
  );

  const pendingClaims = claims.filter((c: any) => c.status === "PENDING").length;
  const acceptedClaims = claims.filter((c: any) => c.status === "ACCEPTED").length;
  const totalPharmacies =
    typeof data?.organization?.pharmacy_count === "number"
      ? data.organization.pharmacy_count
      : Array.isArray(data?.pharmacies)
      ? data.pharmacies.length
      : "--";
  const activeShifts =
    typeof data?.active_shifts === "number"
      ? data.active_shifts
      : Array.isArray(data?.shifts)
      ? data.shifts.length
      : "--";

  const orgName = data?.organization?.name ?? orgMembership?.organization_name ?? "Organization";
  const orgRegion = data?.organization?.region ?? orgMembership?.region ?? null;

  const highlightChips = [
    orgRegion && `Region: ${orgRegion}`,
    orgMembership?.role && `Role: ${orgMembership.role.replace(/_/g, " ")}`,
  ].filter(Boolean) as string[];

  const quickActions: QuickAction[] = [
    {
      title: "Invite Staff",
      description: "Add organization members and admins",
      icon: <PersonAddIcon />,
      onClick: () => navigate("/dashboard/organization/invite"),
    },
    {
      title: "Claim Pharmacies",
      description: "Submit new ownership claims",
      icon: <HowToRegIcon />,
      onClick: () => navigate("/dashboard/organization/manage-pharmacies?claim=open"),
    },
    {
      title: "Manage Pharmacies",
      description: "Configure stores and contact info",
      icon: <StoreIcon />,
      onClick: () => navigate("/dashboard/organization/manage-pharmacies"),
    },
    {
      title: "Post Shift",
      description: "Publish an opportunity to the network",
      icon: <PostAddIcon />,
      onClick: () => navigate("/dashboard/organization/post-shift"),
    },
    {
      title: "Shifts Centre",
      description: "Active, confirmed and historical shifts",
      icon: <AccessTimeIcon />,
      onClick: () => navigate("/dashboard/organization/shift-center"),
    },
    {
      title: "Chat",
      description: "Coordinate with staff and admins",
      icon: <ChatOutlinedIcon />,
      onClick: () => navigate("/dashboard/organization/chat"),
    },
    {
      title: "Pharmacy Hub",
      description: "Community groups, org announcements, and home feeds",
      icon: <HubIcon />,
      onClick: () => navigate("/dashboard/organization/pharmacy-hub"),
    },
  ];

  const stats: StatItem[] = [
    { label: "Pending Claims", value: pendingClaims, helper: "Awaiting approval" },
    { label: "Approved Claims", value: acceptedClaims },
    { label: "Active Shifts", value: activeShifts },
    { label: "Total Pharmacies", value: totalPharmacies },
  ];

  return (
    <Box
      sx={{
        width: "100%",
        mx: "auto",
        maxWidth: 1200,
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 3, md: 4 },
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
            0.62
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
              Organization workspace
            </Typography>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              {orgName}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 520 }}>
              Centralize staffing, pharmacy claims, and communications for your organization. Use
              the quick actions below to jump straight into your top tasks.
            </Typography>
            {highlightChips.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                {highlightChips.map((chip) => (
                  <Chip
                    key={chip}
                    size="small"
                    label={chip}
                    sx={{ bgcolor: alpha("#ffffff", 0.15), color: "#fff" }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Stack spacing={1.5} sx={{ position: "relative", zIndex: 1, minWidth: 220 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                size="small"
                disableRipple
                sx={{
                  bgcolor: alpha("#ffffff", 0.18),
                  color: "#fff",
                }}
              >
                <GroupsIcon />
              </IconButton>
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Current role
                </Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {orgMembership?.role?.replace(/_/g, " ") ?? "Organization Admin"}
                </Typography>
              </Stack>
            </Stack>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => navigate("/dashboard/organization/manage-pharmacies?claim=open")}
              sx={{ borderColor: alpha("#ffffff", 0.45), color: "#fff" }}
            >
              Review claim requests
            </Button>
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

      <Grid container spacing={2.5}>
        {stats.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.label}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                {item.value}
              </Typography>
              {item.helper && (
                <Typography variant="caption" color="text.secondary">
                  {item.helper}
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {error && (
        <Paper
          sx={{
            borderRadius: 3,
            p: 2.5,
            border: `1px solid ${theme.palette.error.light}`,
            bgcolor: alpha(theme.palette.error.light, 0.08),
          }}
        >
          <Typography color="error">{error}</Typography>
        </Paper>
      )}
    </Box>
  );
}
