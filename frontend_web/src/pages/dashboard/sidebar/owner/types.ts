// src/pages/dashboard/sidebar/owner/types.ts
import { alpha, Theme } from "@mui/material/styles";

export type Role =
  | "PHARMACIST"
  | "TECHNICIAN"
  | "ASSISTANT"
  | "INTERN"
  | "STUDENT"
  | "CONTACT"
  | "PHARMACY_ADMIN";
export type WorkType = "FULL_TIME" | "PART_TIME" | "CASUAL" | "LOCUM" | "SHIFT_HERO" | "CONTACT";

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

export function coerceRole(raw?: string): Role {
  const r = (raw || "").toUpperCase();
  if (r.includes("ADMIN")) return "PHARMACY_ADMIN";
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

// Dark-mode safe surface tokens for consistent contrast
export const surface = (t: Theme) => ({
  bg: t.palette.background.paper,
  subtle: alpha(t.palette.text.primary, 0.04),
  hover: alpha(t.palette.primary.main, 0.08),
  border: t.palette.divider,
  textMuted: alpha(t.palette.text.primary, 0.7),
});
