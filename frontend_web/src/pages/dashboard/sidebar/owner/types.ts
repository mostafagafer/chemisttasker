// src/pages/dashboard/sidebar/owner/types.ts
import { alpha, Theme } from "@mui/material/styles";
import type { AdminCapability } from "../../../../constants/adminCapabilities";

export type Role =
  | "PHARMACIST"
  | "TECHNICIAN"
  | "ASSISTANT"
  | "INTERN"
  | "STUDENT"
  | "CONTACT";
export type WorkType = "FULL_TIME" | "PART_TIME" | "CASUAL" | "LOCUM" | "SHIFT_HERO" | "CONTACT";
export type UserPortalRole = "OWNER" | "PHARMACIST" | "OTHER_STAFF" | "EXPLORER";

export type PharmacyDTO = {
  id: string;
  name: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
};

export type MembershipDTO = {
  id: string | number;
  user?: number;
  role?: string;
  employment_type?: string;
  invited_name?: string;
  name?: string;
  email?: string;
  user_details?: { email?: string; first_name?: string; last_name?: string };
  is_pharmacy_owner?: boolean;
};

export type AdminLevel = "OWNER" | "MANAGER" | "ROSTER_MANAGER" | "COMMUNICATION_MANAGER";

export type AdminStaffRole =
  | "PHARMACIST"
  | "INTERN"
  | "TECHNICIAN"
  | "ASSISTANT"
  | "STUDENT";

export type PharmacyAdminDTO = {
  id: string | number;
  pharmacy?: number;
  pharmacy_name?: string | null;
  user?: number | null;
  invited_name?: string | null;
  email?: string | null;
  admin_level: AdminLevel;
  staff_role?: AdminStaffRole | null;
  job_title?: string | null;
  user_details?: { email?: string; first_name?: string; last_name?: string };
  capabilities?: AdminCapability[];
  can_remove?: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  PHARMACIST: "Pharmacist",
  TECHNICIAN: "Dispensary Technician",
  ASSISTANT: "Pharmacy Assistant",
  INTERN: "Intern Pharmacist",
  STUDENT: "Pharmacy Student",
  CONTACT: "Contact",
};

export const USER_ROLE_LABELS: Record<UserPortalRole, string> = {
  OWNER: "Pharmacy Owner",
  PHARMACIST: "Pharmacist",
  OTHER_STAFF: "Other Staff",
  EXPLORER: "Explorer",
};

const ROLE_REQUIRED_USER_ROLE: Partial<Record<Role, UserPortalRole>> = {
  PHARMACIST: "PHARMACIST",
  INTERN: "OTHER_STAFF",
  STUDENT: "OTHER_STAFF",
  TECHNICIAN: "OTHER_STAFF",
  ASSISTANT: "OTHER_STAFF",
};

export const requiredUserRoleForMembership = (role: Role): UserPortalRole | null =>
  ROLE_REQUIRED_USER_ROLE[role] ?? null;

export const formatMembershipRole = (role: Role): string => ROLE_LABELS[role] ?? role;
export const formatUserPortalRole = (role: UserPortalRole): string => USER_ROLE_LABELS[role] ?? role;

export function coerceRole(raw?: string): Role {
  const r = (raw || "").toUpperCase();
  if (r.includes("INTERN")) return "INTERN";
  if (r.includes("STUDENT")) return "STUDENT";
  if (r.includes("CONTACT")) return "CONTACT";
  if (r.includes("PHARM")) return "PHARMACIST";
  if (r.includes("TECH")) return "TECHNICIAN";
  if (r.includes("ASSIST")) return "ASSISTANT";
  return "ASSISTANT";
}

export function coerceWorkType(raw?: string): WorkType {
  const r = (raw || "").toUpperCase().replace("-", "_");
  if (r.includes("FULL")) return "FULL_TIME";
  if (r.includes("PART")) return "PART_TIME";
  if (r.includes("LOCUM")) return "LOCUM";
  if (r.includes("SHIFT")) return "SHIFT_HERO";
  if (r.includes("CONTACT")) return "CONTACT";
  return "CASUAL";
}

export const STAFF_ROLE_LABELS: Record<AdminStaffRole, string> = {
  PHARMACIST: "Pharmacist",
  INTERN: "Intern Pharmacist",
  TECHNICIAN: "Dispensary Technician",
  ASSISTANT: "Pharmacy Assistant",
  STUDENT: "Pharmacy Student",
};

export const STAFF_ROLE_OPTIONS = Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => ({
  value: value as AdminStaffRole,
  label,
}));

export const ADMIN_LEVEL_LABELS: Record<AdminLevel, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  ROSTER_MANAGER: "Roster Manager",
  COMMUNICATION_MANAGER: "Communication Manager",
};

export const ADMIN_LEVEL_HELPERS: Record<AdminLevel, string> = {
  OWNER: "Full control. Cannot be removed.",
  MANAGER: "Full control except removing the owner.",
  ROSTER_MANAGER: "Manage roster/shifts and broadcast communications.",
  COMMUNICATION_MANAGER: "Communications only. Cannot manage staff or admins.",
};

export const ADMIN_LEVEL_OPTIONS = Object.entries(ADMIN_LEVEL_LABELS).map(([value, label]) => ({
  value: value as AdminLevel,
  label,
}));

// Dark-mode safe surface tokens for consistent contrast
export const surface = (t: Theme) => ({
  bg: t.palette.background.paper,
  subtle: alpha(t.palette.text.primary, 0.04),
  hover: alpha(t.palette.primary.main, 0.08),
  border: t.palette.divider,
  textMuted: alpha(t.palette.text.primary, 0.7),
});
