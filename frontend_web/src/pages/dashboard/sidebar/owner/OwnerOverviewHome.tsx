import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  Button,
  IconButton,
  Chip,
  useTheme,
  CircularProgress,
} from "@mui/material";
import StoreIcon from "@mui/icons-material/Store";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ListAltIcon from "@mui/icons-material/ListAlt";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import AppsIcon from "@mui/icons-material/Apps";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { alpha } from "@mui/material/styles";
import apiClient from "../../../../utils/apiClient";

type QuickAction = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type StatItem = {
  label: string;
  value: string | number;
};

export default function OwnerOverviewHome({
  totalPharmacies,
  onOpenManage,
  onOpenRoster,
  onOpenShifts,
  onPostShift,
  onOpenProfile,
  onOpenInterests,
  onOpenSettings,
  onOpenPills,
}: {
  totalPharmacies: number;
  onOpenManage: () => void;
  onOpenRoster: () => void;
  onOpenShifts: () => void;
  onPostShift: () => void;
  onOpenProfile: () => void;
  onOpenInterests: () => void;
  onOpenSettings: () => void;
  onOpenPills: () => void;
}) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const [pillBalance, setPillBalance] = useState<number | null>(null);
  const [shiftPostCost, setShiftPostCost] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get("/client-profile/pill-rewards/balance/")
      .then(({ data }) => {
        if (!mounted) return;
        setPillBalance(Number(data?.balance ?? 0));
        setShiftPostCost(Number(data?.shift_post_cost ?? 0));
      })
      .catch(() => {
        if (!mounted) return;
        setPillBalance(0);
        setShiftPostCost(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const quickActions: QuickAction[] = [
    {
      title: "Manage Pharmacies",
      description: "Create, edit and configure stores",
      icon: <StoreIcon />,
      onClick: onOpenManage,
    },
    {
      title: "Internal Roster",
      description: "Map out internal coverage",
      icon: <CalendarMonthIcon />,
      onClick: onOpenRoster,
    },
    {
      title: "Post Shift",
      description: "Publish an open shift in seconds",
      icon: <ListAltIcon />,
      onClick: onPostShift,
    },
    {
      title: "Shift Centre",
      description: "Upcoming & confirmed shifts",
      icon: <WorkOutlineIcon />,
      onClick: onOpenShifts,
    },
    {
      title: "Explore Interests",
      description: "Training & recommended topics",
      icon: <AppsIcon />,
      onClick: onOpenInterests,
    },
    {
      title: "Profile & Verification",
      description: "Manage your organisation profile",
      icon: <PeopleIcon />,
      onClick: onOpenProfile,
    },
    {
      title: "Settings",
      description: "Hours, rates and configurations",
      icon: <SettingsIcon />,
      onClick: onOpenSettings,
    },
  ];

  const stats: StatItem[] = [
    { label: "Total Pharmacies", value: totalPharmacies },
    { label: "Roster Templates", value: "--" },
    { label: "Open Shifts", value: "--" },
    { label: "Favourite Locums", value: "--" },
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
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          backgroundImage: `linear-gradient(135deg, ${alpha(primary, 0.95)}, ${alpha(primary, 0.65)})`,
          color: "#fff",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(circle at top right, ${alpha("#ffffff", 0.25)} 0%, transparent 50%)`,
            pointerEvents: "none",
          }}
        />
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 3, md: 5 }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 520 }}>
              Your pharmacies at a glance. Review staffing, shifts and operations in moments, then dive deeper with the quick links below.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
              <Button variant="contained" color="inherit" onClick={onPostShift} sx={{ color: primary }}>
                Post a shift
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={onOpenManage}
                sx={{ borderColor: alpha("#ffffff", 0.4), color: "#fff" }}
              >
                Manage pharmacies
              </Button>
            </Stack>
          </Box>
          <Stack
            role="button"
            onClick={onOpenPills}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              position: "relative",
              zIndex: 1,
              minWidth: { xs: "100%", md: 300 },
              p: 2,
              borderRadius: 3,
              cursor: "pointer",
              bgcolor: alpha("#ffffff", 0.16),
              border: `1px solid ${alpha("#ffffff", 0.24)}`,
              boxShadow: `inset 0 1px 0 ${alpha("#ffffff", 0.18)}`,
              transition: "transform 0.18s ease, background-color 0.18s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                bgcolor: alpha("#ffffff", 0.22),
              },
            }}
          >
            <Box
              component="img"
              src="/images/drugs.png"
              alt=""
              sx={{
                width: 98,
                height: 98,
                objectFit: "contain",
                flexShrink: 0,
                filter: `contrast(1.08) saturate(1.08) drop-shadow(0 14px 22px ${alpha("#111827", 0.26)})`,
              }}
            />
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.72 }}>
                Pill balance
              </Typography>
              <Stack direction="row" spacing={1} alignItems="baseline">
                {pillBalance == null ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  <Typography variant="h4" fontWeight={900} lineHeight={1}>
                    {pillBalance}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ opacity: 0.86 }}>
                  pills
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={shiftPostCost != null ? `${shiftPostCost} pills per shift post` : "Custom rates"}
                  sx={{ bgcolor: alpha("#ffffff", 0.18), color: "#fff" }}
                />
                <Chip size="small" label="View activity" sx={{ bgcolor: alpha("#ffffff", 0.18), color: "#fff" }} />
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {quickActions.map((action) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={action.title}>
            <Paper
              role="button"
              onClick={action.onClick}
              sx={{
                height: "100%",
                borderRadius: 3,
                transition: "all 0.2s ease",
                cursor: "pointer",
                p: 2.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
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
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: "auto", color: primary, fontWeight: 600 }}>
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
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
