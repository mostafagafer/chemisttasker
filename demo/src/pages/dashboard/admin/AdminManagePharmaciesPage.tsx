import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import OwnerPharmacyDetailPage from "../sidebar/owner/OwnerPharmacyDetailPage";
import type {
  MembershipDTO,
  PharmacyAdminDTO,
  PharmacyDTO,
} from "../sidebar/owner/types";
import { useAdminScope } from "../../../contexts/AdminScopeContext";
import {
  fetchMembershipsByPharmacy,
  fetchPharmacyAdminsService,
  getPharmacyById,
  type MembershipSummary,
} from "@chemisttasker/shared-core";

type PharmacyResponse = {
  id: number | string;
  name: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
};

function toPharmacyDto(payload: PharmacyResponse): PharmacyDTO {
  return {
    id: String(payload.id),
    name: payload.name ?? "",
    street_address: payload.street_address ?? "",
    suburb: payload.suburb ?? "",
    state: payload.state ?? "",
    postcode: payload.postcode ?? "",
  };
}

function partitionMemberships(items: MembershipDTO[]) {
  const staff: MembershipDTO[] = [];
  const locums: MembershipDTO[] = [];
  items.forEach((member) => {
    const role = (member.role || "").toUpperCase();
    const employment = (member.employment_type || "").toUpperCase();
    const isAdmin = role.includes("ADMIN");
    const isLocum = employment.includes("LOCUM") || employment.includes("SHIFT");
    if (!isAdmin && isLocum) {
      locums.push(member);
    } else if (!isAdmin) {
      staff.push(member);
    }
  });
  return { staff, locums };
}

export default function AdminManagePharmaciesPage() {
  const { pharmacyId } = useAdminScope();
  const [pharmacy, setPharmacy] = useState<PharmacyDTO | null>(null);
  const [memberships, setMemberships] = useState<MembershipDTO[]>([]);
  const [admins, setAdmins] = useState<PharmacyAdminDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    if (!pharmacyId) return;
    setMembershipsLoading(true);
    try {
      const [memberSummaries, adminPayload] = await Promise.all([
        fetchMembershipsByPharmacy(Number(pharmacyId)),
        fetchPharmacyAdminsService({ pharmacy: pharmacyId }),
      ]);
      const mappedMembers: MembershipDTO[] = (memberSummaries as MembershipSummary[]).map((m) => ({
        id: m.id,
        pharmacy_id: m.pharmacyId ?? undefined,
        pharmacy_name: m.pharmacyName ?? undefined,
        role: m.role ?? undefined,
        employment_type: m.employmentType ?? undefined,
        invited_name: m.invitedName ?? undefined,
        user_details: m.userDetails
          ? {
              email: (m.userDetails as any).email ?? undefined,
              first_name:
                (m.userDetails as any).first_name ?? (m.userDetails as any).firstName ?? undefined,
              last_name:
                (m.userDetails as any).last_name ?? (m.userDetails as any).lastName ?? undefined,
            }
          : undefined,
        is_pharmacy_owner: m.isPharmacyOwner ?? false,
      }));
      setMemberships(mappedMembers);
      setAdmins(Array.isArray(adminPayload) ? adminPayload : []);
    } catch (err) {
      console.error("Failed to load admin memberships", err);
    } finally {
      setMembershipsLoading(false);
    }
  }, [pharmacyId]);

  const refreshAll = useCallback(async () => {
    if (!pharmacyId) return;
    setLoading(true);
    setError(null);
    try {
      const pharmacyRes = await getPharmacyById(pharmacyId);
      setPharmacy(toPharmacyDto(pharmacyRes as any));
      await loadMemberships();
    } catch (err) {
      console.error("Failed to load admin pharmacy page", err);
      setError("Unable to load pharmacy details for this admin assignment.");
    } finally {
      setLoading(false);
    }
  }, [loadMemberships, pharmacyId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const { staff, locums } = useMemo(
    () => partitionMemberships(memberships),
    [memberships],
  );

  if (!pharmacyId) {
    return (
      <Alert severity="warning">
        No admin pharmacy assignment is currently selected.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Stack
        spacing={2}
        sx={{ py: 6, alignItems: "center", justifyContent: "center" }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading admin pharmacy workspace...
        </Typography>
      </Stack>
    );
  }

  if (error || !pharmacy) {
    return (
      <Alert severity="error">
        {error ?? "Pharmacy data is not available for this admin assignment."}
      </Alert>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      <OwnerPharmacyDetailPage
        pharmacy={pharmacy}
        staffMemberships={staff}
        locumMemberships={locums}
        adminAssignments={admins}
        onMembershipsChanged={loadMemberships}
        membershipsLoading={membershipsLoading}
      />
    </Box>
  );
}
