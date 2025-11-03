/// <reference types="@types/google.maps" />

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  GlobalStyles,
  InputAdornment,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/AddCircleOutline";
import { AxiosError, AxiosResponse } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { useAuth } from "../../../contexts/AuthContext";
import type { OrgMembership } from "../../../contexts/AuthContext";
import apiClient from "../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../constants/api";
import OwnerPharmaciesPage from "./owner/OwnerPharmaciesPage";
import OwnerPharmacyDetailPage from "./owner/OwnerPharmacyDetailPage";
import TopBar from "./owner/TopBar";
import type { MembershipDTO, PharmacyAdminDTO, PharmacyDTO as OwnerPharmacyDTO } from "./owner/types";

const GOOGLE_LIBRARIES = ["places"] as Array<"places">;

type PharmacyApi = {
  id: string | number;
  owner: number;
  name: string;
  email: string | null;
  street_address: string;
  suburb: string;
  postcode: string;
  google_place_id: string;
  latitude: number | null;
  longitude: number | null;
  state: string;
  chain: number | null;
  abn: string;
  methadone_s8_protocols?: string;
  qld_sump_docs?: string;
  sops?: string;
  induction_guides?: string;
  employment_types?: string[];
  roles_needed?: string[];
  weekdays_start: string | null;
  weekdays_end: string | null;
  saturdays_start: string | null;
  saturdays_end: string | null;
  sundays_start: string | null;
  sundays_end: string | null;
  public_holidays_start: string | null;
  public_holidays_end: string | null;
  default_rate_type: "FIXED" | "FLEXIBLE" | "PHARMACIST_PROVIDED" | null;
  default_fixed_rate: string | null;
  about: string;
  auto_publish_worker_requests?: boolean;
};

type Pharmacy = Omit<PharmacyApi, "id"> & { id: string };

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const normalizePharmacy = (raw: PharmacyApi): Pharmacy => ({
  ...raw,
  id: String(raw.id),
});

const toOwnerPharmacyDTO = (pharmacy: Pharmacy): OwnerPharmacyDTO => ({
  id: pharmacy.id,
  name: pharmacy.name,
  street_address: pharmacy.street_address,
  suburb: pharmacy.suburb,
  state: pharmacy.state,
  postcode: pharmacy.postcode,
});

const tabLabels = ["Basic", "Regulatory", "Docs", "Employment", "Hours", "Rate", "About"];
const EMPLOYMENT_TYPE_OPTIONS = ["PART_TIME", "FULL_TIME", "LOCUMS"];
const ROLE_OPTIONS = ["PHARMACIST", "INTERN", "ASSISTANT", "TECHNICIAN", "STUDENT", "ADMIN", "DRIVER"];
const RATE_TYPES = [
  { value: "FIXED", label: "Fixed" },
  { value: "FLEXIBLE", label: "Flexible" },
  { value: "PHARMACIST_PROVIDED", label: "Pharmacist Provided" },
] as const;
const PHARMACY_CACHE_KEY = "pharmacyPage.cache.v1";

export default function PharmacyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdminUser, activePersona, activeAdminPharmacyId } = useAuth();
  const scopedPharmacyId =
    activePersona === "admin" && typeof activeAdminPharmacyId === "number"
      ? activeAdminPharmacyId
      : null;

  const scopePharmacies = useCallback(
    (input: Pharmacy[]): Pharmacy[] => {
      if (scopedPharmacyId == null) {
        return input;
      }
      return input.filter((pharmacy) => Number(pharmacy.id) === scopedPharmacyId);
    },
    [scopedPharmacyId]
  );

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_Maps_API_KEY || "",
    libraries: GOOGLE_LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [membershipsByPharmacy, setMembershipsByPharmacy] = useState<Record<string, MembershipDTO[]>>({});
  const [adminAssignmentsByPharmacy, setAdminAssignmentsByPharmacy] = useState<Record<string, PharmacyAdminDTO[]>>({});
  const [membershipsLoading, setMembershipsLoading] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"list" | "detail">("list");
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(null);
  const [pendingDeletePharmacy, setPendingDeletePharmacy] = useState<Pharmacy | null>(null);
  const [isDeletingPharmacy, setIsDeletingPharmacy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [state, setState] = useState("");
  const [abn, setAbn] = useState("");

  const [approvalCertFile, setApprovalCertFile] = useState<File | null>(null);
  const [existingApprovalCert, setExistingApprovalCert] = useState<string | null>(null);
  const [sopsFile, setSopsFile] = useState<File | null>(null);
  const [existingSops, setExistingSops] = useState<string | null>(null);
  const [inductionGuidesFile, setInductionGuidesFile] = useState<File | null>(null);
  const [existingInductionGuides, setExistingInductionGuides] = useState<string | null>(null);
  const [sumpDocsFile, setSumpDocsFile] = useState<File | null>(null);
  const [existingSumpDocs, setExistingSumpDocs] = useState<string | null>(null);

  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);

  const [weekdaysStart, setWeekdaysStart] = useState("");
  const [weekdaysEnd, setWeekdaysEnd] = useState("");
  const [saturdaysStart, setSaturdaysStart] = useState("");
  const [saturdaysEnd, setSaturdaysEnd] = useState("");
  const [sundaysStart, setSundaysStart] = useState("");
  const [sundaysEnd, setSundaysEnd] = useState("");
  const [publicHolidaysStart, setPublicHolidaysStart] = useState("");
  const [publicHolidaysEnd, setPublicHolidaysEnd] = useState("");

  const [defaultRateType, setDefaultRateType] = useState<string>("");
  const [defaultFixedRate, setDefaultFixedRate] = useState<string>("");
  const [about, setAbout] = useState("");
  const [autoPublishWorkerRequests, setAutoPublishWorkerRequests] = useState(false);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarState, setSnackbarState] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);

  const abnDigits = abn.replace(/\D/g, "");
  const abnInvalid = abnDigits.length > 0 && abnDigits.length !== 11;

  const ownerPharmacies = useMemo(() => pharmacies.map(toOwnerPharmacyDTO), [pharmacies]);
  const activePharmacy = useMemo(
    () => pharmacies.find((p) => p.id === activePharmacyId) || null,
    [pharmacies, activePharmacyId]
  );

  const staffCounts = useMemo(
    () => Object.fromEntries(pharmacies.map((p) => [p.id, (membershipsByPharmacy[p.id] || []).length])),
    [pharmacies, membershipsByPharmacy]
  );

  const activeMemberships = activePharmacyId ? membershipsByPharmacy[activePharmacyId] || [] : [];
  const staffMemberships = useMemo(
    () =>
      activeMemberships.filter((m) => {
        const role = (m.role || "").toUpperCase();
        const work = (m.employment_type || "").toUpperCase();
        return !role.includes("ADMIN") && !work.includes("LOCUM") && !work.includes("SHIFT");
      }),
    [activeMemberships]
  );
  const locumMemberships = useMemo(
    () =>
      activeMemberships.filter((m) => {
        const role = (m.role || "").toUpperCase();
        const work = (m.employment_type || "").toUpperCase();
        return !role.includes("ADMIN") && (work.includes("LOCUM") || work.includes("SHIFT"));
      }),
    [activeMemberships]
  );
  const activeAdminAssignments = useMemo(
    () => (activePharmacyId ? adminAssignmentsByPharmacy[activePharmacyId] || [] : []),
    [activePharmacyId, adminAssignmentsByPharmacy]
  );

  useEffect(() => {
    const viewParam = searchParams.get("view");
    const idParam = searchParams.get("pharmacyId");
    if (viewParam === "detail" && idParam) {
      setView((prev) => (prev === "detail" ? prev : "detail"));
      setActivePharmacyId((prev) => (prev === idParam ? prev : idParam));
    } else {
      setView((prev) => (prev === "list" ? prev : "list"));
      setActivePharmacyId((prev) => (prev === null ? prev : null));
    }
  }, [searchParams]);

  const setViewWithHistory = useCallback(
    (nextView: "list" | "detail", options?: { pharmacyId?: string | null; replace?: boolean }) => {
      const params = new URLSearchParams(searchParams);
      params.delete("action");
      if (nextView === "detail" && options?.pharmacyId) {
        params.set("view", "detail");
        params.set("pharmacyId", options.pharmacyId);
        setSearchParams(params, { replace: options?.replace });
        setView("detail");
        setActivePharmacyId(options.pharmacyId);
      } else {
        params.delete("view");
        params.delete("pharmacyId");
        setSearchParams(params, { replace: options?.replace });
        setView("list");
        setActivePharmacyId(null);
      }
    },
    [searchParams, setSearchParams]
  );

  const clearActionParam = useCallback(() => {
    if (!searchParams.get("action")) return;
    const params = new URLSearchParams(searchParams);
    params.delete("action");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const hoursFields = [
    { label: "Weekdays", start: weekdaysStart, setStart: setWeekdaysStart, end: weekdaysEnd, setEnd: setWeekdaysEnd },
    { label: "Saturdays", start: saturdaysStart, setStart: setSaturdaysStart, end: saturdaysEnd, setEnd: setSaturdaysEnd },
    { label: "Sundays", start: sundaysStart, setStart: setSundaysStart, end: sundaysEnd, setEnd: setSundaysEnd },
    { label: "Public Holidays", start: publicHolidaysStart, setStart: setPublicHolidaysStart, end: publicHolidaysEnd, setEnd: setPublicHolidaysEnd },
  ];

  const showSnackbar = (message: string, severity: "success" | "error" | "info" = "info") => {
    setSnackbarState({ message, severity });
    setSnackbarOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cachedRaw = sessionStorage.getItem(PHARMACY_CACHE_KEY);
      if (!cachedRaw) return;
      const cached = JSON.parse(cachedRaw) as {
        pharmacies?: Pharmacy[];
        memberships?: Record<string, MembershipDTO[]>;
        admin_assignments?: Record<string, PharmacyAdminDTO[]>;
      };
      if (Array.isArray(cached.pharmacies)) {
        setPharmacies(scopePharmacies(cached.pharmacies.map((ph) => ({ ...ph, id: String(ph.id) }))));
        if (cached.pharmacies.length > 0) {
          setInitialLoadComplete(true);
        }
      }
      if (cached.memberships) {
        setMembershipsByPharmacy(cached.memberships);
      }
      if (cached.admin_assignments) {
        setAdminAssignmentsByPharmacy(cached.admin_assignments);
      }
    } catch (error) {
      console.error("Failed to hydrate pharmacy cache", error);
    }
  }, []);

  const loadMembers = useCallback(
    async (pharmacyId: string) => {
      setMembershipsLoading((prev) => ({ ...prev, [pharmacyId]: true }));
      try {
        const [membershipRes, adminRes]: [
          AxiosResponse<PaginatedResponse<MembershipDTO>>,
          AxiosResponse<PaginatedResponse<PharmacyAdminDTO>>
        ] = await Promise.all([
          apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${pharmacyId}`),
          apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.pharmacyAdmins}?pharmacy=${pharmacyId}`),
        ]);
        const memberData = Array.isArray(membershipRes.data?.results)
          ? membershipRes.data.results
          : ((membershipRes.data as unknown) as MembershipDTO[]);
        const adminData = Array.isArray(adminRes.data?.results)
          ? adminRes.data.results
          : ((adminRes.data as unknown) as PharmacyAdminDTO[]);
        setMembershipsByPharmacy((prev) => ({
          ...prev,
          [pharmacyId]: Array.isArray(memberData) ? memberData : [],
        }));
        setAdminAssignmentsByPharmacy((prev) => ({
          ...prev,
          [pharmacyId]: Array.isArray(adminData) ? adminData : [],
        }));
      } catch (err) {
        console.error("Failed to load memberships", err);
      } finally {
        setMembershipsLoading((prev) => ({ ...prev, [pharmacyId]: false }));
      }
    },
    []
  );

  useEffect(() => {
    if (view === "detail" && activePharmacyId) {
      void loadMembers(activePharmacyId);
    }
  }, [view, activePharmacyId, loadMembers]);

  const loadPharmacies = useCallback(async () => {
    setIsFetching(true);
    try {
      const res: AxiosResponse<PaginatedResponse<PharmacyApi>> = await apiClient.get(
        `${API_BASE_URL}${API_ENDPOINTS.pharmacies}`
      );
      const data = Array.isArray(res.data?.results) ? res.data.results : [];
      const normalized = data.map(normalizePharmacy);
      setPharmacies(scopePharmacies(normalized));
      await Promise.all(normalized.map((p) => loadMembers(p.id)));
      setInitialLoadComplete(true);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setNeedsOnboarding(true);
        setInitialLoadComplete(true);
      } else {
        console.error(err);
      }
    } finally {
      setIsFetching(false);
    }
  }, [loadMembers]);

  useEffect(() => {
    if (!user) return;

    const isOrgAdmin =
      Array.isArray(user?.memberships) && user.memberships.some((m: any) => m?.role === "ORG_ADMIN");
    if (isOrgAdmin || isAdminUser) {
      void loadPharmacies();
      return;
    }

    setIsFetching(true);
    apiClient
      .get(`${API_BASE_URL}${API_ENDPOINTS.onboardingDetail("owner")}`)
      .then(() => loadPharmacies())
      .catch((err: unknown) => {
        if (err instanceof AxiosError && err.response?.status === 404) {
          setNeedsOnboarding(true);
          setInitialLoadComplete(true);
        } else {
          console.error(err);
        }
        setIsFetching(false);
      });
  }, [user, loadPharmacies]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialLoadComplete) return;
    try {
      const payload = JSON.stringify({
        pharmacies,
        memberships: membershipsByPharmacy,
        admin_assignments: adminAssignmentsByPharmacy,
      });
      sessionStorage.setItem(PHARMACY_CACHE_KEY, payload);
    } catch (error) {
      console.error("Failed to persist pharmacy cache", error);
    }
  }, [pharmacies, membershipsByPharmacy, adminAssignmentsByPharmacy, initialLoadComplete]);

  const openPharmacy = useCallback(
    (pharmacyId: string, options?: { replace?: boolean }) => {
      setViewWithHistory("detail", { pharmacyId, replace: options?.replace });
      void loadMembers(pharmacyId);
    },
    [loadMembers, setViewWithHistory]
  );

  const openAdmins = useCallback(
    (pharmacyId: string) => {
      openPharmacy(pharmacyId);
    },
    [openPharmacy]
  );

  const goBackToList = useCallback(() => {
    setViewWithHistory("list", { replace: true });
  }, [setViewWithHistory]);

  const resetDialogState = () => {
    setApprovalCertFile(null);
    setSopsFile(null);
    setInductionGuidesFile(null);
    setSumpDocsFile(null);
    setTabIndex(0);
    setError("");
  };

  const openDialog = (pharmacy?: Pharmacy) => {
    resetDialogState();
    if (pharmacy) {
      setEditing(pharmacy);
      setName(pharmacy.name || "");
      setEmail(pharmacy.email ?? "");
      setStreetAddress(pharmacy.street_address || "");
      setSuburb(pharmacy.suburb || "");
      setPostcode(pharmacy.postcode || "");
      setGooglePlaceId(pharmacy.google_place_id || "");
      setLatitude(pharmacy.latitude !== null && pharmacy.latitude !== undefined ? Number(pharmacy.latitude) : null);
      setLongitude(pharmacy.longitude !== null && pharmacy.longitude !== undefined ? Number(pharmacy.longitude) : null);
      setState(pharmacy.state || "");
      setAbn(pharmacy.abn || "");
      setExistingApprovalCert(pharmacy.methadone_s8_protocols || null);
      setExistingSops(pharmacy.sops || null);
      setExistingInductionGuides(pharmacy.induction_guides || null);
      setExistingSumpDocs(pharmacy.qld_sump_docs || null);
      setEmploymentTypes(pharmacy.employment_types || []);
      setRolesNeeded(pharmacy.roles_needed || []);
      setWeekdaysStart(pharmacy.weekdays_start || "");
      setWeekdaysEnd(pharmacy.weekdays_end || "");
      setSaturdaysStart(pharmacy.saturdays_start || "");
      setSaturdaysEnd(pharmacy.saturdays_end || "");
      setSundaysStart(pharmacy.sundays_start || "");
      setSundaysEnd(pharmacy.sundays_end || "");
      setPublicHolidaysStart(pharmacy.public_holidays_start || "");
      setPublicHolidaysEnd(pharmacy.public_holidays_end || "");
      setDefaultRateType(pharmacy.default_rate_type || "");
      setDefaultFixedRate(pharmacy.default_fixed_rate || "");
      setAbout(pharmacy.about || "");
      setAutoPublishWorkerRequests(Boolean(pharmacy.auto_publish_worker_requests));
    } else {
      setEditing(null);
      setName("");
      setEmail("");
      setStreetAddress("");
      setSuburb("");
      setPostcode("");
      setGooglePlaceId("");
      setLatitude(null);
      setLongitude(null);
      setState("");
      setAbn("");
      setExistingApprovalCert(null);
      setExistingSops(null);
      setExistingInductionGuides(null);
      setExistingSumpDocs(null);
      setEmploymentTypes([]);
      setRolesNeeded([]);
      setWeekdaysStart("");
      setWeekdaysEnd("");
      setSaturdaysStart("");
      setSaturdaysEnd("");
      setSundaysStart("");
      setSundaysEnd("");
      setPublicHolidaysStart("");
      setPublicHolidaysEnd("");
      setDefaultRateType("");
      setDefaultFixedRate("");
      setAbout("");
    setAutoPublishWorkerRequests(false);
  }
  setDialogOpen(true);
};

  useEffect(() => {
    const action = searchParams.get("action");
    const idParam = searchParams.get("pharmacyId");
    if (!action || !idParam) return;

    const target = pharmacies.find((p) => p.id === idParam);
    if (!target) return;

    if (action === "edit") {
      openDialog(target);
      clearActionParam();
    } else if (action === "delete") {
      setPendingDeletePharmacy((current) => (current?.id === target.id ? current : target));
    }
  }, [searchParams, pharmacies, openDialog, clearActionParam]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setError("");
    clearActionParam();
  };

  const clearAddress = () => {
    setStreetAddress("");
    setSuburb("");
    setPostcode("");
    setGooglePlaceId("");
    setLatitude(null);
    setLongitude(null);
    const input = document.getElementById("autocomplete-textfield") as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const handlePlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place || !place.address_components) return;

    let streetNumber = "";
    let route = "";
    let locality = "";
    let postalCode = "";
    let stateShort = "";

    place.address_components.forEach((component) => {
      const types = component.types;
      if (types.includes("street_number")) streetNumber = component.long_name;
      if (types.includes("route")) route = component.short_name;
      if (types.includes("locality")) locality = component.long_name;
      if (types.includes("postal_code")) postalCode = component.long_name;
      if (types.includes("administrative_area_level_1")) stateShort = component.short_name;
    });

    setStreetAddress(`${streetNumber} ${route}`.trim());
    setSuburb(locality);
    setPostcode(postalCode);
    setState(stateShort);
    setGooglePlaceId(place.place_id || "");
    if (place.geometry?.location) {
      setLatitude(place.geometry.location.lat());
      setLongitude(place.geometry.location.lng());
    }
    if (place.name) setName(place.name);
  };

  const getFileUrl = (path: string | null) => {
    if (!path) return "";
    return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  };

  const handleSave = async () => {
    if (abnDigits.length !== 11) {
      setError("ABN must be 11 digits.");
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("email", email.trim());
    fd.append("street_address", streetAddress);
    fd.append("suburb", suburb);
    fd.append("postcode", postcode);
    fd.append("google_place_id", googlePlaceId);
    if (latitude !== null && !Number.isNaN(Number(latitude))) {
      fd.append("latitude", Number(latitude).toFixed(6));
    }
    if (longitude !== null && !Number.isNaN(Number(longitude))) {
      fd.append("longitude", Number(longitude).toFixed(6));
    }
    fd.append("state", state);
    fd.append("abn", abnDigits);
    if (approvalCertFile) fd.append("methadone_s8_protocols", approvalCertFile);
    if (sopsFile) fd.append("sops", sopsFile);
    if (inductionGuidesFile) fd.append("induction_guides", inductionGuidesFile);
    if (sumpDocsFile) fd.append("qld_sump_docs", sumpDocsFile);
    fd.append("employment_types", JSON.stringify(employmentTypes));
    fd.append("roles_needed", JSON.stringify(rolesNeeded));
    fd.append("weekdays_start", weekdaysStart);
    fd.append("weekdays_end", weekdaysEnd);
    fd.append("saturdays_start", saturdaysStart);
    fd.append("saturdays_end", saturdaysEnd);
    fd.append("sundays_start", sundaysStart);
    fd.append("sundays_end", sundaysEnd);
    fd.append("public_holidays_start", publicHolidaysStart);
    fd.append("public_holidays_end", publicHolidaysEnd);
    fd.append("default_rate_type", defaultRateType);
    if (defaultRateType === "FIXED") {
      fd.append("default_fixed_rate", defaultFixedRate);
    }
    fd.append("about", about);
    fd.append("auto_publish_worker_requests", String(autoPublishWorkerRequests));

    const orgMem = Array.isArray(user?.memberships)
      ? user.memberships.find(
          (m): m is OrgMembership =>
            (m as any)?.role === "ORG_ADMIN" && "organization_id" in (m as any)
        )
      : undefined;
    if (orgMem?.organization_id) {
      fd.append("organization", String(orgMem.organization_id));
    }

    const urlBase = `${API_BASE_URL}${API_ENDPOINTS.pharmacies}`;
    try {
      setIsSaving(true);
      if (editing) {
        const res = await apiClient.patch<PharmacyApi>(`${urlBase}${editing.id}/`, fd);
        const saved = normalizePharmacy(res.data);
        setPharmacies((prev) =>
          scopePharmacies(prev.map((p) => (p.id === saved.id ? saved : p)))
        );
        await loadMembers(saved.id);
        showSnackbar("Pharmacy updated!", "success");
        if (activePharmacyId === editing.id) {
          setActivePharmacyId(saved.id);
        }
      } else {
        const res = await apiClient.post<PharmacyApi>(urlBase, fd);
        const saved = normalizePharmacy(res.data);
        setPharmacies((prev) => {
          if (scopedPharmacyId != null && Number(saved.id) !== scopedPharmacyId) {
            return prev;
          }
          return scopePharmacies([...prev, saved]);
        });
        await loadMembers(saved.id);
        setViewWithHistory("detail", { pharmacyId: saved.id });
        showSnackbar("Pharmacy added!", "success");
      }
      closeDialog();
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail || err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPharmacyDto = (dto: OwnerPharmacyDTO) => {
    const target = pharmacies.find((p) => p.id === dto.id);
    if (target) {
      openDialog(target);
    }
  };

  const handleRequestDeletePharmacy = (id: string) => {
    const target = pharmacies.find((p) => p.id === id);
    if (target) {
      setPendingDeletePharmacy(target);
    }
  };

  const handleCancelDeletePharmacy = () => {
    if (isDeletingPharmacy) return;
    setPendingDeletePharmacy(null);
    clearActionParam();
  };

  const confirmDeletePharmacy = async () => {
    if (!pendingDeletePharmacy) return;
    const id = pendingDeletePharmacy.id;
    setIsDeletingPharmacy(true);
    try {
      await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}${id}/`);
      setPharmacies((prev) => prev.filter((p) => p.id !== id));
      setMembershipsByPharmacy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activePharmacyId === id) {
        goBackToList();
      }
      showSnackbar("Deleted successfully!", "success");
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to delete pharmacy.", "error");
    } finally {
      setIsDeletingPharmacy(false);
      setPendingDeletePharmacy(null);
      clearActionParam();
    }
  };

  const showSkeleton = !initialLoadComplete && isFetching;
  const activeMembershipsLoading = activePharmacy ? membershipsLoading[activePharmacy.id] ?? false : false;

  if (needsOnboarding) {
    return (
      <Box p={4} textAlign="center">
        <Alert severity="warning">
          Please complete <strong>Owner Onboarding</strong> first.
        </Alert>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate("/onboarding/owner")}>
          Go to Onboarding
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <GlobalStyles styles={{ ".pac-container": { zIndex: 1400 } }} />
      <TopBar
        breadcrumb={
          view === "detail" && activePharmacy
            ? ["My Pharmacies", activePharmacy.name]
            : ["My Pharmacies"]
        }
        onBack={view === "detail" ? goBackToList : undefined}
      />

      {view === "list" && (
        <Box
          sx={{
            maxWidth: 1200,
            mx: "auto",
            px: 3,
            pt: 3,
            pb: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              My Pharmacies
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your locations, staff and admins
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>
            Add Pharmacy
          </Button>
        </Box>
      )}

      {view === "list" && showSkeleton ? (
        <Box sx={{ maxWidth: 1200, mx: "auto", px: 3, pb: 4 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Box
                key={index}
                sx={{
                  flex: "1 1 420px",
                  maxWidth: 560,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  p: 2,
                }}
              >
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="75%" />
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ) : view === "list" ? (
        <OwnerPharmaciesPage
          pharmacies={ownerPharmacies}
          staffCounts={staffCounts}
          onOpenPharmacy={openPharmacy}
          onOpenAdmins={openAdmins}
          onEditPharmacy={handleEditPharmacyDto}
          onDeletePharmacy={handleRequestDeletePharmacy}
        />
      ) : activePharmacy ? (
        <OwnerPharmacyDetailPage
          pharmacy={toOwnerPharmacyDTO(activePharmacy)}
          staffMemberships={staffMemberships}
          locumMemberships={locumMemberships}
          adminAssignments={activeAdminAssignments}
          onMembershipsChanged={() => loadMembers(activePharmacy.id)}
          onEditPharmacy={handleEditPharmacyDto}
          membershipsLoading={activeMembershipsLoading}
        />
      ) : (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
          <Alert severity="info">Select a pharmacy to view its details.</Alert>
        </Box>
      )}

      {snackbarState && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => {
            setSnackbarOpen(false);
            setSnackbarState(null);
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={snackbarState.severity}
            onClose={() => {
              setSnackbarOpen(false);
              setSnackbarState(null);
            }}
            sx={{ width: "100%" }}
          >
            {snackbarState.message}
          </Alert>
        </Snackbar>
      )}

      <Dialog
        open={Boolean(pendingDeletePharmacy)}
        onClose={handleCancelDeletePharmacy}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Pharmacy</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingDeletePharmacy
              ? `You are about to delete "${pendingDeletePharmacy.name}". This action can't be undone.`
              : "This action can't be undone."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDeletePharmacy} disabled={isDeletingPharmacy}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDeletePharmacy}
            disabled={isDeletingPharmacy}
          >
            {isDeletingPharmacy ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md" disableEnforceFocus>
        <DialogTitle>{editing ? "Edit Pharmacy" : "Add Pharmacy"}</DialogTitle>
        <DialogContent sx={{ minHeight: 450 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Tabs
            value={tabIndex}
            onChange={(_, i) => setTabIndex(i)}
            centered
            sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
          >
            {tabLabels.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>

          {tabIndex === 0 && (
            <Box sx={{ p: 2 }}>
              {isLoaded && !googlePlaceId && (
                <Autocomplete
                  onLoad={(ref) => (autocompleteRef.current = ref)}
                  onPlaceChanged={handlePlaceChanged}
                  options={{
                    componentRestrictions: { country: "au" },
                    fields: ["address_components", "geometry", "place_id", "name"],
                  }}
                >
                  <TextField fullWidth margin="normal" label="Search Address" id="autocomplete-textfield" />
                </Autocomplete>
              )}
              {loadError && <Alert severity="error">Google Maps failed to load.</Alert>}

              {googlePlaceId && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "action.hover",
                  }}
                >
                  <TextField label="Street Address" fullWidth margin="normal" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />
                  <TextField label="Suburb" fullWidth margin="normal" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
                  <TextField label="State" fullWidth margin="normal" value={state} onChange={(e) => setState(e.target.value)} />
                  <TextField label="Postcode" fullWidth margin="normal" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                  <Button size="small" onClick={clearAddress} sx={{ mt: 1 }}>
                    Clear Address & Search Again
                  </Button>
                </Box>
              )}

              <TextField label="Pharmacy Name" fullWidth margin="normal" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Pharmacy Email" type="email" fullWidth margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoPublishWorkerRequests}
                    onChange={(e) => setAutoPublishWorkerRequests(e.target.checked)}
                  />
                }
                label="Automatically publish worker shift requests"
              />
            </Box>
          )}

          {tabIndex === 1 && (
            <Box sx={{ p: 2 }}>
              <Typography>Approval Certificate</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                <Button variant="outlined" component="label">
                  Upload Certificate
                  <input hidden type="file" onChange={(e) => setApprovalCertFile(e.target.files?.[0] || null)} />
                </Button>
                {approvalCertFile ? (
                  <Typography variant="body2">{approvalCertFile.name}</Typography>
                ) : existingApprovalCert ? (
                  <MuiLink href={getFileUrl(existingApprovalCert)} target="_blank" rel="noopener noreferrer">
                    View
                  </MuiLink>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No file uploaded
                  </Typography>
                )}
              </Box>
              <TextField
                label="ABN"
                required
                fullWidth
                margin="normal"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                error={abnInvalid}
                helperText={abnInvalid ? "ABN must be exactly 11 digits" : undefined}
              />
            </Box>
          )}

          {tabIndex === 2 && (
            <Box sx={{ p: 2 }}>
              <Typography>SOPs (optional)</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, mb: 2 }}>
                <Button variant="outlined" component="label">
                  Upload SOPs
                  <input hidden type="file" onChange={(e) => setSopsFile(e.target.files?.[0] || null)} />
                </Button>
                {sopsFile ? (
                  <Typography variant="body2">{sopsFile.name}</Typography>
                ) : existingSops ? (
                  <MuiLink href={getFileUrl(existingSops)} target="_blank" rel="noopener noreferrer">
                    View
                  </MuiLink>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No file uploaded
                  </Typography>
                )}
              </Box>

              <Typography>Induction Guides (optional)</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, mb: 2 }}>
                <Button variant="outlined" component="label">
                  Upload Induction Guides
                  <input hidden type="file" onChange={(e) => setInductionGuidesFile(e.target.files?.[0] || null)} />
                </Button>
                {inductionGuidesFile ? (
                  <Typography variant="body2">{inductionGuidesFile.name}</Typography>
                ) : existingInductionGuides ? (
                  <MuiLink href={getFileUrl(existingInductionGuides)} target="_blank" rel="noopener noreferrer">
                    View
                  </MuiLink>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No file uploaded
                  </Typography>
                )}
              </Box>

              <Typography>S8/SUMP Docs (optional)</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                <Button variant="outlined" component="label">
                  Upload S8/SUMP
                  <input hidden type="file" onChange={(e) => setSumpDocsFile(e.target.files?.[0] || null)} />
                </Button>
                {sumpDocsFile ? (
                  <Typography variant="body2">{sumpDocsFile.name}</Typography>
                ) : existingSumpDocs ? (
                  <MuiLink href={getFileUrl(existingSumpDocs)} target="_blank" rel="noopener noreferrer">
                    View
                  </MuiLink>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No file uploaded
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {tabIndex === 3 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="h6">Employment Types</Typography>
              <FormGroup sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 2 }}>
                {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option}
                    control={
                      <Checkbox
                        checked={employmentTypes.includes(option)}
                        onChange={() =>
                          setEmploymentTypes((prev) =>
                            prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option]
                          )
                        }
                      />
                    }
                    label={option.replace("_", " ")}
                  />
                ))}
              </FormGroup>

              <Typography variant="h6">Roles Needed</Typography>
              <FormGroup sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                {ROLE_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option}
                    control={
                      <Checkbox
                        checked={rolesNeeded.includes(option)}
                        onChange={() =>
                          setRolesNeeded((prev) =>
                            prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option]
                          )
                        }
                      />
                    }
                    label={option.charAt(0) + option.slice(1).toLowerCase()}
                  />
                ))}
              </FormGroup>
            </Box>
          )}

          {tabIndex === 4 && (
            <Box sx={{ p: 2 }}>
              {hoursFields.map(({ label, start, setStart, end, setEnd }) => (
                <Box
                  key={label}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "150px 1fr 1fr" },
                    gap: 2,
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography>{label}</Typography>
                  <TextField
                    label="Start"
                    type="time"
                    fullWidth
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End"
                    type="time"
                    fullWidth
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              ))}
            </Box>
          )}

          {tabIndex === 5 && (
            <Box sx={{ p: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="rate-type-label">Rate Type</InputLabel>
                <Select
                  labelId="rate-type-label"
                  value={defaultRateType}
                  label="Rate Type"
                  onChange={(e) => setDefaultRateType(e.target.value)}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {RATE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {defaultRateType === "FIXED" && (
                <TextField
                  label="Default Fixed Rate"
                  fullWidth
                  margin="normal"
                  value={defaultFixedRate}
                  onChange={(e) => setDefaultFixedRate(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              )}
            </Box>
          )}

          {tabIndex === 6 && (
            <Box sx={{ p: 2 }}>
              <TextField
                label="About"
                fullWidth
                multiline
                minRows={4}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Create Pharmacy"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

