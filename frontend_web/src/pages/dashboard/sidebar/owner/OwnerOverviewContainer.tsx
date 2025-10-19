// src/pages/dashboard/sidebar/owner/OwnerOverviewContainer.tsx
import { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import TopBar from "./TopBar";
import OwnerOverviewHome from "./OwnerOverviewHome";
import OwnerPharmaciesPage from "./OwnerPharmaciesPage";
import OwnerPharmacyDetailPage from "./OwnerPharmacyDetailPage";
import { MembershipDTO, PharmacyDTO } from "./types";
import { useLocation, useNavigate } from "react-router-dom";

// Your existing utils
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";

type View = "overview" | "pharmacies" | "pharmacy";

export default function OwnerOverviewContainer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<View>("overview");
  const [pharmacies, setPharmacies] = useState<PharmacyDTO[]>([]);
  const [membershipsByPharmacy, setMembershipsByPharmacy] = useState<Record<string, MembershipDTO[]>>({});
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(null);

  const fetchMemberships = async (pharmacyId: string) => {
    const res = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${pharmacyId}`);
    return Array.isArray(res.data?.results) ? res.data.results : res.data || [];
  };

  const reloadPharmacyMemberships = async (pharmacyId: string) => {
    try {
      const data = await fetchMemberships(pharmacyId);
      setMembershipsByPharmacy(prev => ({ ...prev, [pharmacyId]: data }));
    } catch (error) {
      console.error("Failed to reload memberships", error);
    }
  };

  // Fetch pharmacies + memberships (like your Pharmacy page)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`);
        if (!mounted) return;
        
        // FIX: Extract the array from the 'results' property if it exists.
        const pharmacyData: PharmacyDTO[] = Array.isArray(res.data.results) ? res.data.results : res.data;
        setPharmacies(pharmacyData || []);

        // Load memberships for each pharmacy
        const map: Record<string, MembershipDTO[]> = {};
        await Promise.all(
          (pharmacyData || []).map(async (p) => {
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
  }, []);


  const activePharmacy = useMemo(
    () => pharmacies.find((p) => p.id === activePharmacyId) || null,
    [pharmacies, activePharmacyId]
  );
  const staffCounts = useMemo(
    () => Object.fromEntries(pharmacies.map((p) => [p.id, (membershipsByPharmacy[p.id] || []).length])),
    [pharmacies, membershipsByPharmacy]
  );

  const goHome = () => setView("overview");
  const openPharmacies = () => setView("pharmacies");
  const goToAdminsOverview = () => {
    setView("pharmacies");
  };
  const openPharmacy = (id: string) => {
    setActivePharmacyId(id);
    setView("pharmacy");
    reloadPharmacyMemberships(id);
  };
  const openAdmins = (id: string) => {
    setActivePharmacyId(id);
    setView("pharmacy"); // Admins panel is inside the detail page in this split
  };

  const goToRoster = () => navigate("/dashboard/owner/manage-pharmacies/roster");
  const goToShifts = () => navigate("/dashboard/owner/shifts/active");
  const goToPostShift = () => navigate("/dashboard/owner/post-shift");
  const goToProfile = () => navigate("/dashboard/owner/onboarding");
  const goToInterests = () => navigate("/dashboard/owner/interests");
  const goToSettings = () => navigate("/dashboard/owner/manage-pharmacies/my-pharmacies");

  useEffect(() => {
    const normalizedPath = location.pathname.replace(/\/+$/, "");
    if (normalizedPath === "/dashboard/owner" || normalizedPath === "/dashboard/owner/overview") {
      setView("overview");
      setActivePharmacyId(null);
    }
  }, [location.pathname, location.key]);

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
            onOpenAdmins={openAdmins}
          />
        </>
      )}

      {view === "pharmacy" && activePharmacy && (
        <>
          <TopBar onBack={openPharmacies} breadcrumb={["My Pharmacies", activePharmacy.name]} />
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
