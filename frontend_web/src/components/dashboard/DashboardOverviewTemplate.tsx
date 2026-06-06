import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import StoreIcon from "@mui/icons-material/Store";
import { alpha } from "@mui/material/styles";

const DNA = {
  ink: "#06123A",
  muted: "#5E6B8D",
  line: "#E5ECF7",
  blue: "#063BDA",
  violet: "#6D28D9",
  magenta: "#EA0A8E",
};

export type DashboardTone = "blue" | "purple" | "pink" | "cyan";

export type DashboardAction = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: DashboardTone;
  wide?: boolean;
};

export type DashboardMetric = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  tone: DashboardTone;
};

export type DashboardActivity = {
  title: string;
  description: string;
  time: string;
  icon?: React.ReactNode;
  color?: string;
  kind?: "shift" | "confirmed" | "pharmacy" | "invoice" | string;
};

type PillSummary = {
  balance: number;
  shiftPostCost?: number | null;
  loading?: boolean;
};

type UpcomingStat = {
  today: number;
  week: number;
  month: number;
};

const toneStyles: Record<DashboardTone, { bg: string; color: string; link: string }> = {
  blue: { bg: "#E7F0FF", color: "#063BDA", link: "#063BDA" },
  purple: { bg: "#EFE7FF", color: "#6D28D9", link: "#4C0DDE" },
  pink: { bg: "#FDE7F5", color: "#EA0A8E", link: "#EA0A8E" },
  cyan: { bg: "#DDFBFF", color: "#008EA6", link: "#063BDA" },
};

export function defaultDashboardActivity(scopeName: string, selected: boolean): DashboardActivity[] {
  return [
    { title: "New shift posted", description: scopeName, time: "2m ago", icon: <CalendarMonthIcon />, color: "#5B18E8" },
    { title: "Shift confirmed", description: selected ? `${scopeName} accepted a shift` : "Alice J. accepted a shift", time: "15m ago", icon: <ShieldOutlinedIcon />, color: "#00C853" },
    { title: selected ? "Pharmacy selected" : "New pharmacy added", description: scopeName, time: "1h ago", icon: <StoreIcon />, color: "#5B18E8" },
    { title: "Invoice paid", description: "INV-2024-1256", time: "2h ago", icon: <CreditCardIcon />, color: "#FF5A00" },
  ];
}

function activityIcon(event: DashboardActivity) {
  if (event.icon) return event.icon;
  if (event.kind === "confirmed") return <ShieldOutlinedIcon />;
  if (event.kind === "pharmacy") return <StoreIcon />;
  if (event.kind === "invoice") return <CreditCardIcon />;
  return <CalendarMonthIcon />;
}

function activityColor(event: DashboardActivity) {
  if (event.color) return event.color;
  if (event.kind === "confirmed") return "#00C853";
  if (event.kind === "pharmacy") return "#5B18E8";
  if (event.kind === "invoice") return "#FF5A00";
  return "#5B18E8";
}

export default function DashboardOverviewTemplate({
  title,
  badge,
  subtitle,
  heroTitle,
  heroSubtitle,
  primaryAction,
  secondaryAction,
  pillSummary,
  actions,
  upcoming,
  upcomingTitle = "Upcoming Shifts",
  activity = [],
  metrics,
  onOpenShifts,
  onOpenActivity,
}: {
  title: string;
  badge: string;
  subtitle: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryAction: { label: string; icon?: React.ReactNode; onClick: () => void };
  secondaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void };
  pillSummary?: PillSummary;
  actions: DashboardAction[];
  upcoming: UpcomingStat;
  upcomingTitle?: string;
  activity?: DashboardActivity[];
  metrics: DashboardMetric[];
  onOpenShifts: () => void;
  onOpenActivity?: () => void;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        mx: "auto",
        maxWidth: 1660,
        color: DNA.ink,
        fontFamily: '"DM Sans Variable", "DM Sans", "Barlow", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2.5, md: 3.5 },
      }}
    >
      <Box>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Typography sx={{ fontSize: { xs: 28, md: 34 }, lineHeight: 1, fontWeight: 950, color: DNA.ink }}>
            {title}
          </Typography>
          <Chip
            label={badge}
            size="small"
            sx={{
              bgcolor: "#EAF2FF",
              color: DNA.blue,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          />
        </Stack>
        <Typography sx={{ mt: 1.5, color: DNA.muted, fontSize: 17, fontWeight: 700 }}>
          {subtitle}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 388px" },
          gap: { xs: 2.5, md: 3 },
          alignItems: "start",
        }}
      >
        <Stack spacing={{ xs: 2.5, md: 3 }}>
          <Paper
            sx={{
              p: { xs: 3, md: 4 },
              minHeight: { xs: "auto", md: 290 },
              borderRadius: { xs: "24px", md: "22px" },
              backgroundImage: "linear-gradient(135deg, #143EEA 0%, #2429B8 45%, #8B1CF6 72%, #D20DAE 100%)",
              color: "#fff",
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 22px 54px rgba(6, 26, 61, 0.12)",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                backgroundImage: [
                  `radial-gradient(circle at 64% 98%, ${alpha("#8FE8FF", 0.14)} 0 110px, transparent 111px)`,
                  `radial-gradient(circle at 72% 96%, ${alpha("#6FE7DD", 0.16)} 0 190px, transparent 191px)`,
                  `radial-gradient(circle at 66% 96%, ${alpha("#ffffff", 0.12)} 0 275px, transparent 276px)`,
                  `linear-gradient(100deg, transparent 0 78%, ${alpha("#D20DAE", 0.75)} 78% 100%)`,
                ].join(", "),
                pointerEvents: "none",
              }}
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 3, md: 5 }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h4" fontWeight={950} gutterBottom sx={{ fontSize: { xs: 34, sm: 44, md: 50 }, lineHeight: 1.04, overflowWrap: "anywhere" }}>
                  {heroTitle}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.96, maxWidth: 620, fontWeight: 800, fontSize: { xs: 16, md: 18 } }}>
                  {heroSubtitle}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3, "& > *": { width: { xs: "100%", sm: "auto" } } }}>
                  <Button variant="contained" color="inherit" startIcon={primaryAction.icon} onClick={primaryAction.onClick} sx={{ color: DNA.blue, borderRadius: "12px", fontWeight: 950, minHeight: 56, px: 3 }}>
                    {primaryAction.label}
                  </Button>
                  {secondaryAction && (
                    <Button variant="outlined" color="inherit" startIcon={secondaryAction.icon} onClick={secondaryAction.onClick} sx={{ borderColor: alpha("#ffffff", 0.34), color: "#fff", borderRadius: "12px", fontWeight: 950, minHeight: 56, px: 3, bgcolor: alpha("#ffffff", 0.08) }}>
                      {secondaryAction.label}
                    </Button>
                  )}
                </Stack>
              </Box>
              {pillSummary && (
                <Stack role="button" direction="row" spacing={2} alignItems="center" sx={{ width: { xs: "100%", md: "auto" }, minWidth: { xs: 0, md: 320 }, p: { xs: 2, md: 2.5 }, borderRadius: { xs: "20px", md: "24px" }, bgcolor: alpha("#ffffff", 0.13), border: `1px solid ${alpha("#ffffff", 0.26)}`, boxShadow: `inset 0 1px 0 ${alpha("#ffffff", 0.18)}` }}>
                  <Box component="img" src="/images/drugs.png" alt="" sx={{ width: { xs: 72, sm: 88, md: 98 }, height: { xs: 72, sm: 88, md: 98 }, objectFit: "contain", flexShrink: 0, filter: `contrast(1.08) saturate(1.08) drop-shadow(0 14px 22px ${alpha("#111827", 0.26)})` }} />
                  <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.72 }}>Pill balance</Typography>
                    <Stack direction="row" spacing={1} alignItems="baseline">
                      {pillSummary.loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : <Typography sx={{ fontSize: { xs: 44, md: 58 }, fontWeight: 950, lineHeight: 1 }}>{pillSummary.balance}</Typography>}
                      <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 900, fontSize: 18 }}>pills</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={pillSummary.shiftPostCost != null ? `${pillSummary.shiftPostCost} pills per shift post` : "Custom rates"} sx={{ bgcolor: alpha("#ffffff", 0.18), color: "#fff", fontWeight: 800 }} />
                      <Chip size="small" label="View activity" sx={{ bgcolor: alpha("#ffffff", 0.18), color: "#fff", fontWeight: 800 }} />
                    </Stack>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Paper>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.75, md: 2.5 } }}>
            {actions.map((action) => {
              const tone = toneStyles[action.tone];
              return (
                <Paper key={action.title} role="button" onClick={action.onClick} sx={{ minHeight: 196, gridColumn: { lg: action.wide ? "span 2" : "span 1" }, borderRadius: "20px", bgcolor: "#FFFFFF", border: `1px solid ${DNA.line}`, boxShadow: "0 8px 24px rgba(6, 18, 58, 0.06)", transition: "all 0.2s ease", cursor: "pointer", p: { xs: 2.5, md: 3 }, display: "flex", flexDirection: "column", gap: 2, "&:hover": { transform: { xs: "none", md: "translateY(-4px)" }, boxShadow: "0 18px 42px rgba(6, 18, 58, 0.12)" } }}>
                  <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 64, height: 64, borderRadius: "18px", bgcolor: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, "& svg": { fontSize: 34 } }}>
                      {action.icon}
                    </Box>
                    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                      <Typography fontWeight={950} color={DNA.ink} sx={{ fontSize: 18, lineHeight: 1.2 }}>{action.title}</Typography>
                      <Typography variant="body2" sx={{ color: DNA.muted, fontWeight: 700, lineHeight: 1.55, maxWidth: 180 }}>{action.description}</Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: "auto", color: tone.link, fontWeight: 950 }}>
                    <Typography variant="body2" sx={{ fontWeight: 950, fontSize: 16 }}>Open</Typography>
                    <ArrowForwardIcon fontSize="small" />
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Stack>

        <Stack spacing={{ xs: 2.5, md: 3 }}>
          <Paper sx={{ borderRadius: "22px", border: `1px solid ${DNA.line}`, bgcolor: "#fff", p: { xs: 2.5, md: 3.5 }, boxShadow: "0 8px 24px rgba(6, 18, 58, 0.06)" }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <CalendarMonthIcon sx={{ color: DNA.violet, fontSize: 30 }} />
              <Typography sx={{ fontSize: 24, fontWeight: 950, color: DNA.ink }}>{upcomingTitle}</Typography>
            </Stack>
            <Stack divider={<Box sx={{ height: "1px", bgcolor: DNA.line }} />}>
              {[["Today", upcoming.today], ["This Week", upcoming.week], ["This Month", upcoming.month]].map(([label, value]) => (
                <Stack key={label} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.8 }}>
                  <Typography sx={{ color: DNA.muted, fontWeight: 800, fontSize: 16 }}>{label}</Typography>
                  <Typography sx={{ color: "#5B18E8", fontWeight: 950, fontSize: 30, lineHeight: 1 }}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button onClick={onOpenShifts} endIcon={<ArrowForwardIcon />} sx={{ mt: 2, px: 0, color: "#4C0DDE", fontWeight: 950 }}>
              View all shifts
            </Button>
          </Paper>

          <Paper sx={{ borderRadius: "22px", border: `1px solid ${DNA.line}`, bgcolor: "#fff", p: { xs: 2.5, md: 3.5 }, boxShadow: "0 8px 24px rgba(6, 18, 58, 0.06)" }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
              <FavoriteBorderIcon sx={{ color: "#5B18E8", fontSize: 30 }} />
              <Typography sx={{ fontSize: 24, fontWeight: 950, color: DNA.ink }}>Recent Activity</Typography>
            </Stack>
            <Stack divider={<Box sx={{ height: "1px", bgcolor: DNA.line }} />}>
              {activity.length === 0 ? (
                <Typography variant="body2" sx={{ color: DNA.muted, fontWeight: 700 }}>
                  No recent activity yet.
                </Typography>
              ) : activity.map((event) => (
                <Stack key={`${event.title}-${event.time}`} direction="row" spacing={2} alignItems="flex-start" sx={{ py: 1.8 }}>
                  <Box sx={{ color: activityColor(event), width: 24, pt: 0.25, "& svg": { fontSize: 24 } }}>{activityIcon(event)}</Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: DNA.ink, fontWeight: 950, fontSize: 14 }}>{event.title}</Typography>
                    <Typography noWrap sx={{ color: DNA.muted, fontWeight: 700, fontSize: 13 }}>{event.description}</Typography>
                  </Box>
                  <Typography sx={{ color: "#7A86A3", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" }}>{event.time}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button onClick={onOpenActivity ?? onOpenShifts} endIcon={<ArrowForwardIcon />} sx={{ mt: 2, px: 0, color: "#4C0DDE", fontWeight: 950 }}>
              View all activity
            </Button>
          </Paper>
        </Stack>
      </Box>

      <Paper sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, overflow: "hidden", borderRadius: "20px", bgcolor: "#FFFFFF", border: `1px solid ${DNA.line}`, boxShadow: "0 8px 24px rgba(6, 18, 58, 0.06)" }}>
        {metrics.map((item, index) => {
          const tone = toneStyles[item.tone];
          return (
            <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 2.25, minHeight: 132, px: { xs: 2.5, md: 4 }, py: 2.5, borderLeft: { xl: index === 0 ? "none" : `1px solid ${DNA.line}` }, borderTop: { xs: index === 0 ? "none" : `1px solid ${DNA.line}`, sm: index < 2 ? "none" : `1px solid ${DNA.line}`, xl: "none" } }}>
              <Box sx={{ width: 66, height: 66, borderRadius: "18px", bgcolor: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, "& svg": { fontSize: 36 } }}>{item.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: DNA.muted, fontWeight: 800, fontSize: 14 }}>{item.label}</Typography>
                <Typography sx={{ color: DNA.ink, fontWeight: 950, fontSize: { xs: 22, md: 24 }, lineHeight: 1.18 }}>{item.value}</Typography>
                <Typography sx={{ color: DNA.muted, fontWeight: 700, fontSize: 13, mt: 0.5 }}>{item.helper}</Typography>
              </Box>
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
}
