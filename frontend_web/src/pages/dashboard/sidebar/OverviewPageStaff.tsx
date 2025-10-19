import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";
import apiClient from "../../../utils/apiClient";
import { API_ENDPOINTS } from "../../../constants/api";
import { useAuth } from "../../../contexts/AuthContext";

type User = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
};

type ShiftSummary = {
  id: number;
  pharmacy_name: string;
  date: string;
};

type DashboardData = {
  user?: User;
  message?: string;
  upcoming_shifts_count?: number;
  confirmed_shifts_count?: number;
  community_shifts_count?: number;
  shifts?: ShiftSummary[];
  bills_summary?: Record<string, string>;
};

export default function OverviewPageStaff() {
  const theme = useTheme();
  const { user } = useAuth() as { user: User };

  const role = (user?.role || "").toLowerCase();
  const isPharmacist = role === "pharmacist";
  const isOtherStaff = role === "otherstaff";
  const isExplorer = role === "explorer";
  const roleSegment = isExplorer ? "explorer" : isPharmacist ? "pharmacist" : "otherstaff";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    const endpoint = isPharmacist
      ? API_ENDPOINTS.pharmacistDashboard
      : isOtherStaff
      ? API_ENDPOINTS.otherStaffDashboard
      : isExplorer
      ? API_ENDPOINTS.explorerDashboard
      : API_ENDPOINTS.otherStaffDashboard;

    apiClient
      .get(endpoint)
      .then((response) => {
        setData(response.data);
        setError(null);
      })
      .catch((err) => {
        if (!isExplorer && err?.response?.status === 403) {
          return apiClient.get(API_ENDPOINTS.explorerDashboard).then((fallbackResponse) => {
            setData(fallbackResponse.data);
            setError(null);
          });
        }
        setError("Error loading dashboard.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [isPharmacist, isOtherStaff, isExplorer]);

  const shifts = useMemo(() => data?.shifts ?? [], [data?.shifts]);

  if (loading) {
    return (
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 4 },
          py: { xs: 2, md: 4 },
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, md: 3 },
        }}
      >
        <Skeleton variant="rounded" height={220} />
        <Grid container spacing={2}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <Grid size={{ xs: 12, sm: 4 }} key={idx}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={280} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 900, mx: "auto", px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 } }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const displayName =
    data?.user?.first_name ||
    data?.user?.username ||
    user?.first_name ||
    user?.username ||
    (isExplorer ? "Explorer" : "there");

  const subtitle = isExplorer
    ? data?.message || "Discover open roles and finish onboarding to unlock personalised matches."
    : "Review your upcoming shifts, update availability, and keep an eye on community opportunities.";

  const statCards = [
    { label: "Upcoming Shifts", value: data?.upcoming_shifts_count ?? 0 },
    { label: "Confirmed Shifts", value: data?.confirmed_shifts_count ?? 0 },
    { label: "Community Shifts", value: data?.community_shifts_count ?? 0 },
  ];

  const heroChips = isExplorer
    ? [
        `Community shifts: ${data?.community_shifts_count ?? 0}`,
        "Complete profile to unlock invites",
      ]
    : [
        `Points: ${data?.bills_summary?.points ?? "--"}`,
        `Total billed: ${data?.bills_summary?.total_billed ?? "--"}`,
      ];

  const primaryCta = isExplorer
    ? {
        label: "Browse community shifts",
        to: `/dashboard/${roleSegment}/shifts/community`,
        variant: "contained" as const,
      }
    : {
        label: "View active shifts",
        to: `/dashboard/${roleSegment}/shifts/active`,
        variant: "contained" as const,
      };

  const secondaryCta = isExplorer
    ? {
        label: "Complete profile",
        to: `/dashboard/${roleSegment}/onboarding-v2`,
        variant: "outlined" as const,
      }
    : {
        label: "Update availability",
        to: `/dashboard/${roleSegment}/availability`,
        variant: "outlined" as const,
      };

  const heroGradient = `linear-gradient(135deg, ${alpha(
    theme.palette.primary.main,
    0.92,
  )}, ${alpha(theme.palette.secondary.main, 0.65)})`;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2.5, md: 3 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: { xs: 3, md: 4 },
          backgroundImage: heroGradient,
          color: "#fff",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 3, md: 4 }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Welcome back, {displayName}!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 540, mb: 3 }}>
              {subtitle}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant={primaryCta.variant}
                color="inherit"
                component={RouterLink}
                to={primaryCta.to}
                sx={primaryCta.variant === "contained" ? { color: theme.palette.primary.main } : undefined}
              >
                {primaryCta.label}
              </Button>
              <Button
                variant={secondaryCta.variant}
                color="inherit"
                component={RouterLink}
                to={secondaryCta.to}
                sx={{ borderColor: alpha("#ffffff", 0.45), color: "#fff" }}
              >
                {secondaryCta.label}
              </Button>
            </Stack>
          </Box>

          <Stack direction="column" spacing={1} alignItems={{ xs: "flex-start", md: "flex-end" }}>
            <Typography
              variant="body2"
              sx={{ letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.7 }}
            >
              Quick stats
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {heroChips.map((chip) => (
                <Chip
                  key={chip}
                  label={chip}
                  sx={{ bgcolor: alpha("#ffffff", 0.2), color: "#fff" }}
                />
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {statCards.map((card) => (
          <Grid size={{ xs: 12, sm: 4 }} key={card.label}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                height: "100%",
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                {card.label}
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                {card.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
        >
          <Box flex={1}>
            <Typography variant="h6" fontWeight={700}>
              Upcoming shifts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Confirm details early and stay ready for handover.
            </Typography>
          </Box>
          {!isExplorer && (
            <Button
              component={RouterLink}
              to={`/dashboard/${roleSegment}/shifts/confirmed`}
              endIcon={<ArrowForwardIcon />}
            >
              View confirmed shifts
            </Button>
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1.5}>
          {shifts.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No shifts scheduled yet. Check community opportunities to get started.
            </Typography>
          )}

          {shifts.map((shift) => (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              key={shift.id}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{
                p: 1.5,
                borderRadius: 2,
                transition: "all 0.2s",
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) },
              }}
            >
              <Box flex={1}>
                <Typography fontWeight={600}>{shift.pharmacy_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {shift.date ? new Date(shift.date).toLocaleString() : "No date provided"}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                component={RouterLink}
                to={`/dashboard/${roleSegment}/shifts/${shift.id}`}
                endIcon={<ArrowForwardIcon fontSize="small" />}
              >
                View shift
              </Button>
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
