// src/pages/dashboard/sidebar/owner/OwnerOverviewContainer.tsx
import { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import TopBar from "./TopBar";
import OwnerOverviewHome from "./OwnerOverviewHome";
import OwnerPharmaciesPage from "./OwnerPharmaciesPage";
import OwnerPharmacyDetailPage from "./OwnerPharmacyDetailPage";
import { MembershipDTO, PharmacyDTO } from "./types";

// Your existing utils
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";

type View = "overview" | "pharmacies" | "pharmacy";

export default function OwnerOverviewContainer() {
  const [view, setView] = useState<View>("overview");
  const [pharmacies, setPharmacies] = useState<PharmacyDTO[]>([]);
  const [membershipsByPharmacy, setMembershipsByPharmacy] = useState<Record<string, MembershipDTO[]>>({});
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(null);

  // Fetch pharmacies + memberships (like your Pharmacy page)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.get<PharmacyDTO[]>(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`);
        if (!mounted) return;
        setPharmacies(res.data || []);

        // Load memberships for each pharmacy
        const map: Record<string, MembershipDTO[]> = {};
        await Promise.all(
          (res.data || []).map(async (p) => {
            const m = await apiClient.get<MembershipDTO[]>(
              `${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${p.id}`
            );
            map[p.id] = m.data || [];
          })
        );
        if (!mounted) return;
        setMembershipsByPharmacy(map);
      } catch (e) {
        // Handle silently; you can show a toast if you want
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
  const openPharmacy = (id: string) => {
    setActivePharmacyId(id);
    setView("pharmacy");
  };
  const openAdmins = (id: string) => {
    setActivePharmacyId(id);
    setView("pharmacy"); // Admins panel is inside the detail page in this split
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {view === "overview" && (
        <>
          <TopBar breadcrumb={["Overview"]} />
          <OwnerOverviewHome totalPharmacies={pharmacies.length} onOpenPharmacies={openPharmacies} />
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
            memberships={membershipsByPharmacy[activePharmacy.id] || []}
            onOpenStaff={() => {}}
            onOpenAdmins={() => {}}
            onOpenLocums={() => {}}
          />
        </>
      )}
    </Box>
  );
}
