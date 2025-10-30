// src/pages/dashboard/sidebar/owner/OwnerOverviewContainer.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import TopBar from "./TopBar";
import OwnerOverviewHome from "./OwnerOverviewHome";
import OwnerPharmaciesPage from "./OwnerPharmaciesPage";
import OwnerPharmacyDetailPage from "./OwnerPharmacyDetailPage";
import { MembershipDTO, PharmacyDTO } from "./types";
import { useNavigate, useSearchParams } from "react-router-dom";

// Your existing utils
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";

type View = "overview" | "pharmacies" | "pharmacy";

export default function OwnerOverviewContainer() {
  const navigate = useNavigate();
  const [pharmacies, setPharmacies] = useState<PharmacyDTO[]>([]);
  const [membershipsByPharmacy, setMembershipsByPharmacy] = useState<Record<string, MembershipDTO[]>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchMemberships = useCallback(async (pharmacyId: string) => {
    const res = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${pharmacyId}`);
    return Array.isArray(res.data?.results) ? res.data.results : res.data || [];
  }, []);

  const reloadPharmacyMemberships = useCallback(async (pharmacyId: string) => {
    try {
      const data = await fetchMemberships(pharmacyId);
      setMembershipsByPharmacy(prev => ({ ...prev, [pharmacyId]: data }));
    } catch (error) {
      console.error("Failed to reload memberships", error);
    }
  }, [fetchMemberships]);

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
        setPharmacies(normalizedPharmacies);

        // Load memberships for each pharmacy
        const map: Record<string, MembershipDTO[]> = {};
        await Promise.all(
          normalizedPharmacies.map(async (p) => {
            map[p.id] = await fetchMemberships(p.id);
          })
        );
        if (!mounted) return;
        setMembershipsByPharmacy(map);
      } catch (e) {
        console.error("OwnerOverviewContainer fetch error:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchMemberships]);

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

  const goToRoster = () => navigate("/dashboard/owner/manage-pharmacies/roster");
  const goToShifts = () => navigate("/dashboard/owner/shifts/active");
  const goToPostShift = () => navigate("/dashboard/owner/post-shift");
  const goToProfile = () => navigate("/dashboard/owner/onboarding");
  const goToInterests = () => navigate("/dashboard/owner/interests");
  const goToSettings = () => navigate("/dashboard/owner/manage-pharmacies/my-pharmacies");
  const goToPharmacyManager = (query: string) =>
    navigate(`/dashboard/owner/manage-pharmacies/my-pharmacies${query}`);
  const handleEditPharmacy = (pharmacy: PharmacyDTO) => {
    goToPharmacyManager(`?view=detail&pharmacyId=${pharmacy.id}&action=edit`);
  };
  const handleDeletePharmacy = (pharmacyId: string) => {
    goToPharmacyManager(`?view=detail&pharmacyId=${pharmacyId}&action=delete`);
  };

  useEffect(() => {
    if (view === "pharmacy" && activePharmacyId && !(activePharmacyId in membershipsByPharmacy)) {
      void reloadPharmacyMemberships(activePharmacyId);
    }
  }, [view, activePharmacyId, membershipsByPharmacy, reloadPharmacyMemberships]);

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
          <OwnerPharmacyDetailPage
            pharmacy={activePharmacy}
            staffMemberships={(membershipsByPharmacy[activePharmacy.id] || []).filter((m) => {
              const role = (m.role || "").toUpperCase();
              const work = (m.employment_type || "").toUpperCase();
              return !role.includes("ADMIN") && !work.includes("LOCUM") && !work.includes("SHIFT");
            })}
            locumMemberships={(membershipsByPharmacy[activePharmacy.id] || []).filter((m) => {
              const role = (m.role || "").toUpperCase();
              const work = (m.employment_type || "").toUpperCase();
              return !role.includes("ADMIN") && (work.includes("LOCUM") || work.includes("SHIFT"));
            })}
            adminMemberships={(membershipsByPharmacy[activePharmacy.id] || []).filter((m) =>
              (m.role || "").toUpperCase().includes("ADMIN")
            )}
            onMembershipsChanged={() => reloadPharmacyMemberships(activePharmacy.id)}
          />
        </>
      )}
    </Box>
  );
}
