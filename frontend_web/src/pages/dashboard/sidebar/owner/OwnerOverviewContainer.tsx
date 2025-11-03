// src/pages/dashboard/sidebar/owner/OwnerOverviewContainer.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import TopBar from "./TopBar";
import { useAuth } from '../../../../contexts/AuthContext';
import OwnerOverviewHome from "./OwnerOverviewHome";
import OwnerPharmaciesPage from "./OwnerPharmaciesPage";
import OwnerPharmacyDetailPage from "./OwnerPharmacyDetailPage";
import { MembershipDTO, PharmacyAdminDTO, PharmacyDTO } from "./types";
import { useNavigate, useSearchParams } from "react-router-dom";

// Your existing utils
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";

type View = "overview" | "pharmacies" | "pharmacy";

export default function OwnerOverviewContainer() {
  const navigate = useNavigate();
  const [pharmacies, setPharmacies] = useState<PharmacyDTO[]>([]);
  const [membershipsByPharmacy, setMembershipsByPharmacy] = useState<Record<string, MembershipDTO[]>>({});
  const [adminAssignmentsByPharmacy, setAdminAssignmentsByPharmacy] = useState<Record<string, PharmacyAdminDTO[]>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const { activePersona, activeAdminPharmacyId } = useAuth();
  const scopedPharmacyId =
    activePersona === "admin" && typeof activeAdminPharmacyId === "number"
      ? activeAdminPharmacyId
      : null;
  const adminBasePath = scopedPharmacyId != null ? `/dashboard/admin/${scopedPharmacyId}` : null;

  const fetchMemberships = useCallback(async (pharmacyId: string) => {
    const res = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${pharmacyId}`);
    return Array.isArray(res.data?.results) ? res.data.results : res.data || [];
  }, []);

  const fetchAdmins = useCallback(async (pharmacyId: string) => {
    const res = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.pharmacyAdmins}?pharmacy=${pharmacyId}`);
    return Array.isArray(res.data?.results) ? res.data.results : res.data || [];
  }, []);

  const reloadPharmacyMemberships = useCallback(async (pharmacyId: string) => {
    try {
      const [memberships, admins] = await Promise.all([
        fetchMemberships(pharmacyId),
        fetchAdmins(pharmacyId),
      ]);
      setMembershipsByPharmacy((prev) => ({ ...prev, [pharmacyId]: memberships }));
      setAdminAssignmentsByPharmacy((prev) => ({ ...prev, [pharmacyId]: admins }));
    } catch (error) {
      console.error("Failed to reload memberships", error);
    }
  }, [fetchMemberships, fetchAdmins, scopedPharmacyId]);

  // Fetch pharmacies + memberships (like your Pharmacy page)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`);
        if (!mounted) return;

        // FIX: Extract the array from the 'results' property if it exists.
        const pharmacyData = Array.isArray(res.data?.results) ? res.data.results : res.data;
        const normalizedPharmacies: PharmacyDTO[] = (Array.isArray(pharmacyData) ? pharmacyData : []).map(
          (item: PharmacyDTO & { id: string | number }) => ({
            ...item,
            id: String(item.id),
          })
        );
        const scopedPharmacies =
          scopedPharmacyId != null
            ? normalizedPharmacies.filter((pharmacy) => Number(pharmacy.id) === scopedPharmacyId)
            : normalizedPharmacies;
        setPharmacies(scopedPharmacies);

        // Load memberships for each pharmacy
        const memberMap: Record<string, MembershipDTO[]> = {};
        const adminMap: Record<string, PharmacyAdminDTO[]> = {};
        await Promise.all(
          scopedPharmacies.map(async (p) => {
            const [memberships, admins] = await Promise.all([
              fetchMemberships(p.id),
              fetchAdmins(p.id),
            ]);
            memberMap[p.id] = memberships;
            adminMap[p.id] = admins;
          })
        );
        if (!mounted) return;
        setMembershipsByPharmacy(memberMap);
        setAdminAssignmentsByPharmacy(adminMap);
      } catch (e) {
        console.error("OwnerOverviewContainer fetch error:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchMemberships, fetchAdmins, scopedPharmacyId]);

  const setViewParam = useCallback(
    (nextView: View, options?: { pharmacyId?: string | null; replace?: boolean }) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextView === "overview") {
        nextParams.delete("view");
        nextParams.delete("pharmacyId");
      } else {
        nextParams.set("view", nextView);
        if (nextView === "pharmacy" && options?.pharmacyId) {
          nextParams.set("pharmacyId", options.pharmacyId);
        } else {
          nextParams.delete("pharmacyId");
        }
      }
      setSearchParams(nextParams, { replace: options?.replace ?? false });
    },
    [searchParams, setSearchParams]
  );

  const rawViewParam = searchParams.get("view");
  const rawPharmacyId = searchParams.get("pharmacyId");
  const view: View =
    rawViewParam === "pharmacy" && rawPharmacyId
      ? "pharmacy"
      : rawViewParam === "pharmacies"
      ? "pharmacies"
      : "overview";
  const activePharmacyId = view === "pharmacy" && rawPharmacyId ? rawPharmacyId : null;

  const activePharmacy = useMemo(
    () => pharmacies.find((p) => p.id === activePharmacyId) || null,
    [pharmacies, activePharmacyId]
  );
  const staffCounts = useMemo(
    () => Object.fromEntries(pharmacies.map((p) => [p.id, (membershipsByPharmacy[p.id] || []).length])),
    [pharmacies, membershipsByPharmacy]
  );

  const goHome = () => setViewParam("overview");
  const openPharmacies = (options?: { replace?: boolean }) => setViewParam("pharmacies", { replace: options?.replace });
  const goToAdminsOverview = () => {
    openPharmacies();
  };
  const openPharmacy = (id: string) => {
    setViewParam("pharmacy", { pharmacyId: id });
    void reloadPharmacyMemberships(id);
  };
  const openAdmins = (id: string) => {
    setViewParam("pharmacy", { pharmacyId: id }); // Admins panel is inside the detail page in this split
    void reloadPharmacyMemberships(id);
  };

  const buildOwnerPath = (suffix: string) =>
    `/dashboard/owner/${suffix}`;
  const resolvePath = (suffix: string) =>
    adminBasePath ? `${adminBasePath}/${suffix}` : buildOwnerPath(suffix);

  const goToRoster = () => navigate(resolvePath("manage-pharmacies/roster"));
  const goToShifts = () => navigate(resolvePath("shifts/active"));
  const goToPostShift = () => navigate(resolvePath("post-shift"));
  const goToProfile = () => navigate(resolvePath("onboarding"));
  const goToInterests = () => navigate(resolvePath("interests"));
  const goToSettings = () => navigate(resolvePath("manage-pharmacies/my-pharmacies"));
  const goToPharmacyManager = (query: string) =>
    navigate(`${resolvePath("manage-pharmacies/my-pharmacies")}${query}`);
  const handleEditPharmacy = (pharmacy: PharmacyDTO) => {
    goToPharmacyManager(`?view=detail&pharmacyId=${pharmacy.id}&action=edit`);
  };
  const handleDeletePharmacy = (pharmacyId: string) => {
    goToPharmacyManager(`?view=detail&pharmacyId=${pharmacyId}&action=delete`);
  };

  useEffect(() => {
    if (
      view === "pharmacy" &&
      activePharmacyId &&
      (!(activePharmacyId in membershipsByPharmacy) || !(activePharmacyId in adminAssignmentsByPharmacy))
    ) {
      void reloadPharmacyMemberships(activePharmacyId);
    }
  }, [view, activePharmacyId, membershipsByPharmacy, adminAssignmentsByPharmacy, reloadPharmacyMemberships]);

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {view === "overview" && (
        <>
          <TopBar breadcrumb={["Overview"]} />
          <OwnerOverviewHome
            totalPharmacies={pharmacies.length}
            onOpenPharmacies={openPharmacies}
            onOpenAdmins={goToAdminsOverview}
            onOpenRoster={goToRoster}
            onOpenShifts={goToShifts}
            onPostShift={goToPostShift}
            onOpenProfile={goToProfile}
            onOpenInterests={goToInterests}
            onOpenSettings={goToSettings}
          />
        </>
      )}

      {view === "pharmacies" && (
        <>
          <TopBar onBack={goHome} breadcrumb={["My Pharmacies"]} />
          <OwnerPharmaciesPage
            pharmacies={pharmacies}
            staffCounts={staffCounts}
            onOpenPharmacy={openPharmacy}
            onEditPharmacy={handleEditPharmacy}
            onDeletePharmacy={handleDeletePharmacy}
            onOpenAdmins={openAdmins}
          />
        </>
      )}

      {view === "pharmacy" && activePharmacy && (
        <>
          <TopBar onBack={() => openPharmacies({ replace: true })} breadcrumb={["My Pharmacies", activePharmacy.name]} />
          {(() => {
            const membershipList = membershipsByPharmacy[activePharmacy.id] || [];
            const adminList = adminAssignmentsByPharmacy[activePharmacy.id] || [];
            const nonOwnerMemberships = membershipList.filter((m) => !m.is_pharmacy_owner);
            const staffMemberships = nonOwnerMemberships.filter((m) => {
              const role = (m.role || "").toUpperCase();
              const work = (m.employment_type || "").toUpperCase();
              return !role.includes("ADMIN") && !work.includes("LOCUM") && !work.includes("SHIFT");
            });
            const locumMemberships = nonOwnerMemberships.filter((m) => {
              const role = (m.role || "").toUpperCase();
              const work = (m.employment_type || "").toUpperCase();
              return !role.includes("ADMIN") && (work.includes("LOCUM") || work.includes("SHIFT"));
            });
            const visibleAdminList = adminList.filter((admin) => admin.admin_level !== "OWNER");
            return (
              <OwnerPharmacyDetailPage
                pharmacy={activePharmacy}
                staffMemberships={staffMemberships}
                locumMemberships={locumMemberships}
                adminAssignments={visibleAdminList}
                onMembershipsChanged={() => reloadPharmacyMemberships(activePharmacy.id)}
              />
            );
          })()}
        </>
      )}
    </Box>
  );
}


