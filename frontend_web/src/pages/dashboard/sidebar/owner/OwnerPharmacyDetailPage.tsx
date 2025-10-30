import React, { useRef } from "react";
import { Box, Button, Typography } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import { MembershipDTO, PharmacyDTO, surface } from "./types";
import { useTheme } from "@mui/material/styles";
import StaffManager from "./StaffManager";
import LocumManager from "./LocumManager";
import PharmacyAdmins from "./PharmacyAdmins";
import { useNavigate } from "react-router-dom";

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
  const theme = useTheme();
  const tokens = surface(theme);
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${tokens.border}`,
        background: tokens.bg,
        cursor: onClick ? "pointer" : "default",
        ":hover": { background: tokens.subtle, boxShadow: onClick ? 3 : undefined },
      }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: tokens.hover }}>{icon}</Box>
        <Box>
          <Typography fontWeight={600}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.5, color: tokens.textMuted }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function OwnerPharmacyDetailPage({
  pharmacy,
  staffMemberships,
  locumMemberships,
  adminMemberships,
  onMembershipsChanged,
  onEditPharmacy,
  membershipsLoading = false,
}: {
  pharmacy: PharmacyDTO;
  staffMemberships: MembershipDTO[];
  locumMemberships: MembershipDTO[];
  adminMemberships: MembershipDTO[];
  onMembershipsChanged: () => void;
  onEditPharmacy?: (pharmacy: PharmacyDTO) => void;
  membershipsLoading?: boolean;
}) {
  const theme = useTheme();
  const tokens = surface(theme);
  const navigate = useNavigate();
  const staffSectionRef = useRef<HTMLDivElement>(null);
  const locumSectionRef = useRef<HTMLDivElement>(null);
  const adminsSectionRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: { current: HTMLElement | null }) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleManageStaff = () => scrollTo(staffSectionRef);
  const handleManageLocums = () => scrollTo(locumSectionRef);
  const handleManageAdmins = () => scrollTo(adminsSectionRef);
  const handleCheckShifts = () => navigate("/dashboard/owner/shifts/active");
  const handlePostShift = () => navigate("/dashboard/owner/post-shift");
  const handleFavouriteLocums = () => handleManageLocums();
  const handleConfigurations = () => {
    if (onEditPharmacy) {
      onEditPharmacy(pharmacy);
      return;
    }
    navigate("/dashboard/owner/manage-pharmacies/my-pharmacies");
  };

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
          <Typography sx={{ color: tokens.textMuted }}>
            {[pharmacy.street_address, pharmacy.suburb, pharmacy.state, pharmacy.postcode].filter(Boolean).join(", ")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" onClick={() => (onEditPharmacy ? onEditPharmacy(pharmacy) : navigate("/dashboard/owner/manage-pharmacies/my-pharmacies"))}>Edit</Button>
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
        <IconButtonCard title="Manage Staff" subtitle="Add/remove team" icon={<PeopleIcon />} onClick={handleManageStaff} />
        <IconButtonCard title="Check Shifts" subtitle="Roster & history" icon={<CalendarMonthIcon />} onClick={handleCheckShifts} />
        <IconButtonCard title="Favourite Locums" subtitle="Quick-pick shortlist" icon={<StarOutlineIcon />} onClick={handleFavouriteLocums} />
        <IconButtonCard title="Admins" subtitle="Assign scoped admins" icon={<ManageAccountsIcon />} onClick={handleManageAdmins} />
        <IconButtonCard title="Post Shift" subtitle="Publish an open shift" icon={<ListAltIcon />} onClick={handlePostShift} />
        <IconButtonCard title="Configurations" subtitle="Hours, details, rates" icon={<SettingsIcon />} onClick={handleConfigurations} />
      </Box>

      <Box sx={{ mt: 3 }} ref={staffSectionRef}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Staff
        </Typography>
        <StaffManager
          pharmacyId={pharmacy.id}
          memberships={staffMemberships}
          onMembershipsChanged={onMembershipsChanged}
          pharmacyName={pharmacy.name}
          loading={membershipsLoading}
        />
      </Box>

      <Box sx={{ mt: 3 }} ref={locumSectionRef}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Favourite Locums
        </Typography>
        <LocumManager
          pharmacyId={pharmacy.id}
          memberships={locumMemberships}
          onMembershipsChanged={onMembershipsChanged}
          loading={membershipsLoading}
        />
      </Box>

      <Box sx={{ mt: 3 }} ref={adminsSectionRef}>
        <PharmacyAdmins
          pharmacyId={pharmacy.id}
          admins={adminMemberships}
          onMembershipsChanged={onMembershipsChanged}
          loading={membershipsLoading}
        />
      </Box>
    </Box>
  );
}
