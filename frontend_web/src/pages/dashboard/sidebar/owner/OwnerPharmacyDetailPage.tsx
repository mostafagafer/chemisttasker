// src/pages/dashboard/sidebar/owner/OwnerPharmacyDetailPage.tsx
import React from "react";
import { Box, Button, Typography } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import { MembershipDTO, PharmacyDTO, surface } from "./types";
import { useTheme } from "@mui/material/styles";
import InviteStaffModal from "./InviteStaffModal";
import StaffManager from "./StaffManager";
import PharmacyAdmins from "./PharmacyAdmins";

function IconButtonCard({
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
  const t = useTheme(); const s = surface(t);
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${s.border}`,
        background: s.bg,
        cursor: onClick ? "pointer" : "default",
        ":hover": { background: s.subtle, boxShadow: onClick ? 3 : undefined },
      }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: s.hover }}>{icon}</Box>
        <Box>
          <Typography fontWeight={600}>{title}</Typography>
          {subtitle && <Typography variant="body2" sx={{ mt: 0.5, color: s.textMuted }}>{subtitle}</Typography>}
        </Box>
      </Box>
    </Box>
  );
}

export default function OwnerPharmacyDetailPage({
  pharmacy,
  memberships,
  onOpenStaff,
  onOpenAdmins,
  onOpenLocums,
}: {
  pharmacy: PharmacyDTO;
  memberships: MembershipDTO[];
  onOpenStaff: () => void;
  onOpenAdmins: () => void;
  onOpenLocums: () => void;
}) {
  const t = useTheme(); const s = surface(t);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { md: "flex-end" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {pharmacy.name}
          </Typography>
          <Typography sx={{ color: s.textMuted }}>
            {[pharmacy.street_address, pharmacy.suburb, pharmacy.state, pharmacy.postcode].filter(Boolean).join(", ")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined">Edit</Button>
          <InviteStaffModal pharmacyId={pharmacy.id} />
        </Box>
      </Box>

      <Box
        sx={{
          mt: 2,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <IconButtonCard title="Manage Staff" subtitle="Add/remove team" icon={<PeopleIcon />} onClick={onOpenStaff} />
        <IconButtonCard title="Check Shifts" subtitle="Roster & history" icon={<CalendarMonthIcon />} />
        <IconButtonCard title="Favourite Locums" subtitle="Quick-pick shortlist" icon={<StarOutlineIcon />} onClick={onOpenLocums} />
        <IconButtonCard title="Admins" subtitle="Assign scoped admins" icon={<ManageAccountsIcon />} onClick={onOpenAdmins} />
        <IconButtonCard title="Post Shift" subtitle="Publish an open shift" icon={<ListAltIcon />} />
        <IconButtonCard title="Configurations" subtitle="Hours, details, rates" icon={<SettingsIcon />} />
      </Box>

      {/* Staff manager uses memberships */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Staff
        </Typography>
        <StaffManager memberships={memberships} />
      </Box>

      {/* Admins local section */}
      <Box sx={{ mt: 3 }}>
        <PharmacyAdmins pharmacy={{ id: pharmacy.id, name: pharmacy.name }} />
      </Box>
    </Box>
  );
}
