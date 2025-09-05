// src/pages/dashboard/sidebar/owner/OwnerOverviewHome.tsx
import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import StoreIcon from "@mui/icons-material/Store";
import DomainIcon from "@mui/icons-material/Domain";
import SecurityIcon from "@mui/icons-material/Security";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ListAltIcon from "@mui/icons-material/ListAlt";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import AppsIcon from "@mui/icons-material/Apps";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import { useTheme } from "@mui/material/styles";
import { surface } from "./types";

function IconCard({
  title,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const t = useTheme();
  const s = surface(t);
  return (
    <Card
      onClick={onClick}
      variant="outlined"
      sx={{
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        backgroundColor: s.bg,
        borderColor: s.border,
        transition: "all .15s",
        ":hover": { boxShadow: onClick ? 6 : undefined, backgroundColor: s.subtle },
      }}
    >
      <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: s.hover }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={600}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.5, color: s.textMuted }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme(); const s = surface(t);
  return (
    <Card variant="outlined" sx={{ backgroundColor: s.bg, borderColor: s.border }}>
      <CardContent>
        <Typography variant="h4" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: s.textMuted }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function OwnerOverviewHome({
  totalPharmacies,
  onOpenPharmacies,
}: {
  totalPharmacies: number;
  onOpenPharmacies: () => void;
}) {
  const t = useTheme();
  const s = surface(t);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Welcome back
          </Typography>
          <Typography sx={{ color: s.textMuted }}>
            Quick access to everything from the cards below.
          </Typography>
        </Box>
        <Card variant="outlined" sx={{ minWidth: 260, background: s.bg, borderColor: s.border }}>
          <CardContent>
            <Typography fontWeight={600}>💊 Bills / Gamification</Typography>
            <Typography>Total billed: —</Typography>
            <Typography>Points: —</Typography>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <IconCard title="Manage Pharmacies" subtitle="Create, edit and configure stores" icon={<StoreIcon />} onClick={onOpenPharmacies} />
        <IconCard title="My Pharmacies" subtitle="View and open a pharmacy" icon={<DomainIcon />} onClick={onOpenPharmacies} />
        <IconCard title="Assign Admins" subtitle="Manage pharmacy admins" icon={<SecurityIcon />} onClick={onOpenPharmacies} />
        <IconCard title="Internal Roster" subtitle="Plan team coverage" icon={<CalendarMonthIcon />} />
        <IconCard title="Post Shift" subtitle="Publish an open shift" icon={<ListAltIcon />} />
        <IconCard title="Shifts" subtitle="Upcoming & confirmed" icon={<WorkOutlineIcon />} />
        <IconCard title="Explore Interests" subtitle="Recommendations" icon={<AppsIcon />} />
        <IconCard title="Profile" subtitle="Account & verification" icon={<PeopleIcon />} />
        <IconCard title="Settings" subtitle="Platform preferences" icon={<SettingsIcon />} />
      </Box>

      <Box
        sx={{
          mt: 3,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <Stat label="Upcoming Shifts" value={"0"} />
        <Stat label="Confirmed Shifts" value={"2"} />
        <Stat label="Total Pharmacies" value={String(totalPharmacies)} />
        <Stat label="Favourites" value={"5"} />
      </Box>
    </Box>
  );
}
