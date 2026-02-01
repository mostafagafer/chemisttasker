import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Chip, Drawer, IconButton, Paper, Stack, Pagination, Typography } from "@mui/material";
import {
  Add as AddIcon,
  Tune as TuneIcon,
} from "@mui/icons-material";
import { useTalentFeed } from "./hooks/useTalentFeed";
import { useTalentFilters } from "./hooks/useTalentFilters";
import PitchDialog, { PitchFormState, PitchAttachment } from "./components/PitchDialog";
import AvailabilitySidebar from "./components/AvailabilitySidebar";
import TalentCardV2 from "./components/TalentCardV2";
import FiltersSidebar, { TalentFilterState } from "./components/FiltersSidebar";
import { Candidate } from "./types";
import { ENGAGEMENT_LABELS } from "./constants";
import { useAuth } from "../../../../contexts/AuthContext";
import {
  createExplorerPost,
  createExplorerPostAttachment,
  deleteExplorerPost,
  getOnboarding,
  getRatingsSummary,
  getOrCreateDmByUser,
  likeExplorerPost,
  unlikeExplorerPost,
  updateExplorerPost,
} from "@chemisttasker/shared-core";
import { API_BASE_URL } from "../../../../constants/api";

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (t) => t.toUpperCase());

const formatRoleLabel = (role?: string | null) => {
  if (!role) return "Explorer";
  return titleCase(role);
};

const formatWorkType = (workType?: string | null) => {
  if (!workType) return "";
  return titleCase(workType);
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const allWorkTypes = Object.values(ENGAGEMENT_LABELS);

const formatAvailabilityDays = (days?: Array<string | number> | null) => {
  if (!Array.isArray(days) || days.length === 0) return "";
  const labels = days
    .map((day) => {
      if (typeof day === "number" && day >= 0 && day <= 6) {
        return dayNames[day];
      }
      if (typeof day === "string") {
        const normalized = day.trim();
        if (isIsoDate(normalized)) return normalized;
        const upper = normalized.toUpperCase();
        const idx = dayNames.findIndex((name) => name.toUpperCase() === upper.slice(0, 3));
        if (idx >= 0) return dayNames[idx];
        return titleCase(normalized);
      }
      return null;
    })
    .filter(Boolean) as string[];
  return labels.join(", ");
};


type TalentBoardProps = {
  publicMode?: boolean;
  externalPosts?: Record<string, any>[];
  externalLoading?: boolean;
  externalError?: string | null;
  onRequireLogin?: () => void;
};

const TalentBoard: React.FC<TalentBoardProps> = ({
  publicMode = false,
  externalPosts,
  externalLoading,
  externalError,
  onRequireLogin,
}) => {
  const feed = useTalentFeed({ enabled: !publicMode });
  const posts = externalPosts ?? feed.posts;
  const loading = externalLoading ?? feed.loading;
  const error = externalError ?? feed.error;
  const reload = feed.reload;
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<TalentFilterState>({
    search: "",
    roles: [] as string[],
    workTypes: [] as string[],
    states: [] as string[],
    skills: [] as string[],
    willingToTravel: false,
    placementSeeker: false,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCalendarCandidate, setSelectedCalendarCandidate] = useState<Candidate | null>(null);
  const [expandedRoleSkills, setExpandedRoleSkills] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [ratingSummary, setRatingSummary] = useState<Record<number, { average: number; count: number }>>({});
  const ratingFetchRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!token) return;
    const ids = new Set<number>();
    posts.forEach((post) => {
      if (typeof post.authorUserId === "number") ids.add(post.authorUserId);
    });

    ids.forEach((id) => {
      if (ratingFetchRef.current.has(id)) return;
      ratingFetchRef.current.add(id);
      getRatingsSummary({ target_type: "worker", target_id: id })
        .then((res: any) => {
          const averageRaw = Number(res?.average ?? 0);
          const countRaw = Number(res?.count ?? 0);
          const average = Number.isFinite(averageRaw) ? averageRaw : 0;
          const count = Number.isFinite(countRaw) ? countRaw : 0;
          setRatingSummary((prev) => ({ ...prev, [id]: { average, count } }));
        })
        .catch(() => {
          setRatingSummary((prev) => ({ ...prev, [id]: { average: 0, count: 0 } }));
        });
    });
  }, [posts, token]);

  const candidates = useMemo<Candidate[]>(() => {
    return posts.map((post) => {
      const roleLabel = formatRoleLabel(post.roleTitle || post.explorerRoleType || post.roleCategory);
      const workTypes =
        Array.isArray((post as any).workTypes) && (post as any).workTypes.length
          ? (post as any).workTypes.map((w: string) => formatWorkType(w))
          : [];
      const workTypeLabel = workTypes[0] || "";
      const city = post.locationSuburb || post.locationState || "";
      const state = post.locationState || "";
      const coverageRadius = post.coverageRadiusKm ? `+${post.coverageRadiusKm}km` : "Local";
      const willingToTravel = Boolean(post.openToTravel);
      const pitchText = post.body || (post as any).shortBio || "";
      const availabilityMode = post.availabilityMode || null;
      const availabilityDaysText = formatAvailabilityDays(post.availabilityDays as Array<string | number> | null);
      const availabilityText =
        post.availabilitySummary ||
        post.availabilityNotice ||
        availabilityDaysText ||
        (workTypeLabel === "Full Time" ? "Available Now" : "Flexible");

      const availableDates = Array.isArray(post.availabilityDays)
        ? (post.availabilityDays.filter((item: unknown) => typeof item === "string" && isIsoDate(item)) as string[])
        : [];

      const showCalendar = availabilityMode === "CASUAL_CALENDAR" && availableDates.length > 0;

      const skills = Array.from(new Set([...(post.software ?? []), ...(post.skills ?? [])])).filter(Boolean) as string[];
      const attachments = Array.isArray(post.attachments)
        ? post.attachments.map((att: any) => ({
            id: att.id,
            kind: att.kind,
            file: att.file,
            caption: att.caption,
          }))
        : [];

      const rating = post.authorUserId != null ? ratingSummary[post.authorUserId] : undefined;
      const ratingAverage = rating?.average ?? 0;
      const ratingCount = rating?.count ?? 0;

      return {
        id: post.id,
        refId: post.referenceCode
          ? post.referenceCode.startsWith("REF-")
            ? post.referenceCode
            : `REF-${post.referenceCode}`
          : "REF-0000",
        role: roleLabel,
        headline: post.headline || "",
        body: post.body || "",
        city,
        state,
        coverageRadius,
        workTypes,
        willingToTravel,
        pitch: pitchText,
        skills,
        software: post.software ?? [],
        experience: null,
        availabilityText: availabilityText || "Flexible",
        availabilityMode,
        showCalendar,
        availableDates,
        isInternshipSeeker:
          roleLabel.includes("Student") ||
          roleLabel.includes("Intern") ||
          workTypes.some((type: string) => ["Placement", "Volunteering"].includes(type)),
        ratingAverage,
        ratingCount,
        likeCount: typeof post.like_count === "number" ? post.like_count : 0,
        isLikedByMe: Boolean(post.is_liked_by_me),
        attachments,
        authorUserId: post.authorUserId ?? null,
        explorerUserId: post.explorerUserId ?? null,
      };
    });
  }, [posts, ratingSummary]);

  const {
    filtered: processedCandidates,
    roleOptions,
    stateOptions,
    roleSkillOptions,
    softwareOptions,
  } = useTalentFilters(candidates, filters);






  const pageCount = Math.max(1, Math.ceil(processedCandidates.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.roles,
    filters.workTypes,
    filters.states,
    filters.skills,
    filters.willingToTravel,
    filters.placementSeeker,
  ]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pagedCandidates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedCandidates.slice(start, start + pageSize);
  }, [processedCandidates, page]);

  const activeFilterCount =
    filters.roles.length +
    filters.workTypes.length +
    filters.states.length +
    filters.skills.length +
    (filters.search ? 1 : 0) +
    (filters.willingToTravel ? 1 : 0) +
    (filters.placementSeeker ? 1 : 0);

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters((prev) => {
      const current = prev[category] as string[];
      if (current.includes(value)) {
        return { ...prev, [category]: current.filter((item) => item !== value) } as typeof prev;
      }
      return { ...prev, [category]: [...current, value] } as typeof prev;
    });
  };

  const toggleBooleanFilter = (key: "willingToTravel" | "placementSeeker") => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRoleSkillExpand = (role: string) => {
    setExpandedRoleSkills((prev) => ({ ...prev, [role]: !prev[role] }));
  };

  const chatRoute = useMemo(() => {
    const roleKey = (user?.role || "OWNER").toUpperCase();
    const routes: Record<string, string> = {
      OWNER: "/dashboard/owner/chat",
      PHARMACY_ADMIN: "/dashboard/owner/chat",
      ORG_ADMIN: "/dashboard/organization/chat",
      ORG_OWNER: "/dashboard/organization/chat",
      ORG_STAFF: "/dashboard/organization/chat",
      ORGANIZATION: "/dashboard/organization/chat",
      PHARMACIST: "/dashboard/pharmacist/chat",
      OTHER_STAFF: "/dashboard/otherstaff/chat",
      EXPLORER: "/dashboard/explorer/chat",
    };
    return routes[roleKey] ?? "/dashboard/owner/chat";
  }, [user?.role]);

  const handleContact = useCallback(
    async (candidate: Candidate) => {
      if (publicMode) {
        onRequireLogin?.();
        return;
      }
      const partnerUserId = candidate.authorUserId ?? candidate.explorerUserId ?? null;
      if (!partnerUserId) return;
      try {
        const res: any = await getOrCreateDmByUser({ partner_user_id: partnerUserId });
        const conversationId = res?.id ?? res?.conversation_id ?? res?.conversationId;
        if (conversationId) {
          navigate(`${chatRoute}?conversationId=${conversationId}`);
        } else {
          navigate(chatRoute);
        }
      } catch {
        // ignore for now
      }
    },
    [publicMode, onRequireLogin, chatRoute, navigate]
  );

  const handleViewCalendar = useCallback(
    (candidate: Candidate) => {
      if (publicMode) {
        onRequireLogin?.();
        return;
      }
      setSelectedCalendarCandidate(candidate);
    },
    [publicMode, onRequireLogin]
  );

  const handleToggleLike = useCallback(
    async (candidate: Candidate) => {
      if (publicMode) {
        onRequireLogin?.();
        return;
      }
      try {
        if (candidate.isLikedByMe) {
          await unlikeExplorerPost(candidate.id);
        } else {
          await likeExplorerPost(candidate.id);
        }
        await reload();
      } catch {
        // keep UI stable on failure
      }
    },
    [reload, publicMode, onRequireLogin]
  );

  const clearAllFilters = () => {
    setFilters({
      search: "",
      roles: [],
      workTypes: [],
      states: [],
      skills: [],
      willingToTravel: false,
      placementSeeker: false,
    });
  };

  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitchSaving, setPitchSaving] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [existingPostId, setExistingPostId] = useState<number | null>(null);
  const [roleTitle, setRoleTitle] = useState<string>("Explorer");
  const [explorerProfileId, setExplorerProfileId] = useState<number | null>(null);
  const [pitchForm, setPitchForm] = useState<PitchFormState>({
    headline: "",
    body: "",
    workTypes: [] as string[],
    streetAddress: "",
    suburb: "",
    state: "",
    postcode: "",
    openToTravel: false,
    coverageRadiusKm: 30,
    latitude: null as number | null,
    longitude: null as number | null,
    googlePlaceId: "",
    files: [] as File[],
  });


  const [existingAttachments, setExistingAttachments] = useState<PitchAttachment[]>([]);
  const [pitchSkills, setPitchSkills] = useState<string[]>([]);


  const isExplorer = user?.role === "EXPLORER";
  const isPharmacist = user?.role === "PHARMACIST";
  const isOtherStaff = user?.role === "OTHER_STAFF";

  const resetPitchForm = useCallback(() => {
    setPitchForm({
      headline: "",
      body: "",
      workTypes: [] as string[],
      streetAddress: "",
      suburb: "",
      state: "",
      postcode: "",
      openToTravel: false,
      coverageRadiusKm: 30,
      latitude: null,
      longitude: null,
      googlePlaceId: "",
      files: [],
    });
    setExplorerProfileId(null);
    setExistingPostId(null);
    setRoleTitle("Explorer");
    setPitchSkills([]);
    setExistingAttachments([]);
  }, []);

  const loadPitchDefaults = useCallback(async () => {
    if (!user) return;
    setPitchError(null);
    resetPitchForm();
    try {
      if (isExplorer) {
        const onboarding: any = await getOnboarding("explorer");
        setRoleTitle(
          (onboarding?.role_type || "Explorer")
            .replace("_", " ")
            .toLowerCase()
            .replace(/(^|\s)\S/g, (t: string) => t.toUpperCase())
        );
        setExplorerProfileId(onboarding?.id ?? null);
        setPitchForm((prev) => ({
          ...prev,
          body: onboarding?.short_bio || "",
          streetAddress: onboarding?.street_address || "",
          suburb: onboarding?.suburb || "",
          state: onboarding?.state || "",
          postcode: onboarding?.postcode || "",
          openToTravel: Boolean(onboarding?.open_to_travel),
          coverageRadiusKm: onboarding?.coverage_radius_km || 30,
          latitude: onboarding?.latitude ? Number(onboarding.latitude) : null,
          longitude: onboarding?.longitude ? Number(onboarding.longitude) : null,
          googlePlaceId: onboarding?.google_place_id || "",
        }));
        setPitchSkills(Array.isArray(onboarding?.interests) ? onboarding.interests : []);
      } else if (isPharmacist) {
        const onboarding: any = await getOnboarding("pharmacist");
        setRoleTitle("Pharmacist");
        setPitchForm((prev) => ({
          ...prev,
          body: onboarding?.short_bio || "",
          streetAddress: onboarding?.street_address || "",
          suburb: onboarding?.suburb || "",
          state: onboarding?.state || "",
          postcode: onboarding?.postcode || "",
          openToTravel: Boolean(onboarding?.open_to_travel),
          coverageRadiusKm: onboarding?.coverage_radius_km || 30,
          latitude: onboarding?.latitude ? Number(onboarding.latitude) : null,
          longitude: onboarding?.longitude ? Number(onboarding.longitude) : null,
          googlePlaceId: onboarding?.google_place_id || "",
        }));
      } else if (isOtherStaff) {
        const onboarding: any = await getOnboarding("other_staff");
        const title = (onboarding?.role_type || "Other Staff")
          .replace("_", " ")
          .toLowerCase()
          .replace(/(^|\s)\S/g, (t: string) => t.toUpperCase());
        setRoleTitle(title);
        setPitchForm((prev) => ({
          ...prev,
          body: onboarding?.short_bio || "",
          streetAddress: onboarding?.street_address || "",
          suburb: onboarding?.suburb || "",
          state: onboarding?.state || "",
          postcode: onboarding?.postcode || "",
          openToTravel: Boolean(onboarding?.open_to_travel),
          coverageRadiusKm: onboarding?.coverage_radius_km || 30,
          latitude: onboarding?.latitude ? Number(onboarding.latitude) : null,
          longitude: onboarding?.longitude ? Number(onboarding.longitude) : null,
          googlePlaceId: onboarding?.google_place_id || "",
        }));
      }
      const mine = posts.find((post) => post.authorUserId === user?.id);
      if (mine) {
        setExistingPostId(mine.id);
        setPitchForm((prev) => ({
          ...prev,
          headline: mine.headline || prev.headline,
          body: mine.body || prev.body,
          workTypes: mine.workTypes && mine.workTypes.length ? mine.workTypes : prev.workTypes,
          streetAddress: prev.streetAddress,
          suburb: mine.locationSuburb || prev.suburb,
          state: mine.locationState || prev.state,
          postcode: mine.locationPostcode || prev.postcode,
          openToTravel: mine.openToTravel != null ? Boolean(mine.openToTravel) : prev.openToTravel,
          coverageRadiusKm:
            mine.coverageRadiusKm != null ? Number(mine.coverageRadiusKm) : prev.coverageRadiusKm,
        }));
        if (Array.isArray(mine.attachments)) {
          setExistingAttachments(mine.attachments);
        }
      }
        if (mine && Array.isArray(mine.skills)) {
          setPitchSkills(mine.skills);
        }
    } catch (err: any) {
      setPitchError(err?.message || "Failed to load your profile.");
    }
  }, [user, isExplorer, isPharmacist, isOtherStaff, posts, resetPitchForm]);

  useEffect(() => {
    if (pitchOpen) {
      loadPitchDefaults();
    }
  }, [pitchOpen, loadPitchDefaults]);

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    setPitchForm((prev) => ({ ...prev, files: [...prev.files, ...picked] }));
  };

  const handleFileRemove = (index: number) => {
    setPitchForm((prev) => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const handleExistingAttachmentRemove = async (attachmentId: number) => {
    if (!existingPostId || !token) return;
    try {
      await fetch(
        `${API_BASE_URL}/client-profile/explorer-posts/${existingPostId}/attachments/${attachmentId}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setExistingAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
      await reload();
    } catch {
      // ignore for now
    }
  };

  const handlePitchSave = async () => {
    setPitchSaving(true);
    setPitchError(null);
    try {
      if (isExplorer) {
        if (!pitchForm.headline.trim() && !pitchForm.body.trim()) {
          setPitchError("Please add a headline or some text.");
          setPitchSaving(false);
          return;
        }
        const payload: Record<string, any> = {
          headline: pitchForm.headline.trim(),
          body: pitchForm.body.trim(),
          role_category: "EXPLORER",
          work_types: pitchForm.workTypes.length > 0 ? pitchForm.workTypes : undefined,
          skills: pitchSkills.length > 0 ? pitchSkills : undefined,
          location_suburb: pitchForm.suburb || undefined,
          location_state: pitchForm.state || undefined,
          location_postcode: pitchForm.postcode || undefined,
          open_to_travel: pitchForm.openToTravel,
          coverage_radius_km: pitchForm.coverageRadiusKm,
        };
        if (explorerProfileId) payload.explorer_profile = explorerProfileId;
        const created: any = existingPostId
          ? await updateExplorerPost(existingPostId, payload)
          : await createExplorerPost(payload);
        const postId = existingPostId || created?.id;
        if (postId && pitchForm.files.length > 0) {
          const form = new FormData();
          pitchForm.files.forEach((file) => form.append("file", file));
          await createExplorerPostAttachment(postId, form);
        }
      } else {
        const payload: Record<string, any> = {
          headline: pitchForm.headline || "",
          body: pitchForm.body || "",
          role_category: isPharmacist ? "PHARMACIST" : "OTHER_STAFF",
          role_title: roleTitle || "",
          work_types: pitchForm.workTypes.length > 0 ? pitchForm.workTypes : undefined,
          skills: pitchSkills.length > 0 ? pitchSkills : undefined,
          location_suburb: pitchForm.suburb || undefined,
          location_state: pitchForm.state || undefined,
          location_postcode: pitchForm.postcode || undefined,
          open_to_travel: pitchForm.openToTravel,
          coverage_radius_km: pitchForm.coverageRadiusKm,
          is_anonymous: true,
        };
        const created: any = existingPostId
          ? await updateExplorerPost(existingPostId, payload)
          : await createExplorerPost(payload);
        const postId = existingPostId || created?.id;
        if (postId && pitchForm.files.length > 0) {
          const upload = new FormData();
          pitchForm.files.forEach((file) => upload.append("file", file));
          await createExplorerPostAttachment(postId, upload);
        }
      }
      await reload();
      setPitchOpen(false);
    } catch (err: any) {
      setPitchError(err?.message || "Failed to save pitch.");
    } finally {
      setPitchSaving(false);
    }
  };

  const showPitchButton =
    !publicMode &&
    user?.role &&
    ["EXPLORER", "PHARMACIST", "OTHER_STAFF"].includes(user.role);


  return (
    <Box sx={{ width: "100%", bgcolor: "#f7f8fa", color: "text.primary" }}>
      {selectedCalendarCandidate && (
        <AvailabilitySidebar
          candidate={selectedCalendarCandidate}
          onClose={() => setSelectedCalendarCandidate(null)}
        />
      )}

      <Box sx={{ px: { xs: 0, lg: 2 }, py: 2, width: "100%" }}>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{ mb: 3 }}
          spacing={2}
        >
          <Box>
            <Typography variant="h5" fontWeight={700} color="#0b1736">
              Find Talent
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {loading ? "Loading..." : `Showing ${processedCandidates.length} active candidates matching your criteria`}
            </Typography>
          </Box>
          <IconButton
            sx={{ display: { lg: "none" } }}
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open filters"
          >
            <TuneIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start" sx={{ width: "100%" }}>
          <Drawer
            anchor="left"
            open={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            sx={{ display: { lg: "none" } }}
          >
            <Box sx={{ width: 320 }}>
              <FiltersSidebar
                filters={filters}
                onChange={setFilters}
                roleOptions={roleOptions}
                stateOptions={stateOptions}
                workTypeOptions={allWorkTypes}
                roleSkillOptions={roleSkillOptions}
                softwareOptions={softwareOptions}
                expandedRoleSkills={expandedRoleSkills}
                onToggleRoleSkillExpand={toggleRoleSkillExpand}
              />
            </Box>
          </Drawer>

          <Paper
            variant="outlined"
            sx={{
              width: 320,
              display: { xs: "none", lg: "block" },
              position: "sticky",
              top: 96,
              borderRadius: 3,
            }}
          >
            <FiltersSidebar
              filters={filters}
              onChange={setFilters}
              roleOptions={roleOptions}
              stateOptions={stateOptions}
              workTypeOptions={allWorkTypes}
              roleSkillOptions={roleSkillOptions}
              softwareOptions={softwareOptions}
              expandedRoleSkills={expandedRoleSkills}
              onToggleRoleSkillExpand={toggleRoleSkillExpand}
            />
          </Paper>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {activeFilterCount > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                {filters.willingToTravel && (
                  <Chip label="Open to Travel" onDelete={() => toggleBooleanFilter("willingToTravel")} />
                )}
                {filters.placementSeeker && (
                  <Chip label="Interns/Students" onDelete={() => toggleBooleanFilter("placementSeeker")} />
                )}
                {filters.roles.map((r: string) => (
                  <Chip key={r} label={r} onDelete={() => toggleFilter("roles", r)} />
                ))}
                {filters.skills.map((s: string) => (
                  <Chip key={s} label={s} onDelete={() => toggleFilter("skills", s)} />
                ))}
                <Chip
                  label="Clear All"
                  color="error"
                  variant="outlined"
                  onClick={clearAllFilters}
                  sx={{ ml: "auto" }}
                />
              </Stack>
            )}

            <Stack spacing={2} sx={{ pb: 3 }}>
              {pagedCandidates.length > 0 ? (
                pagedCandidates.map((candidate) => (
                  <TalentCardV2
                    key={candidate.id}
                    candidate={candidate}
                    onContact={handleContact}
                    onViewCalendar={handleViewCalendar}
                    onToggleLike={handleToggleLike}
                  />
                ))
              ) : (
                !loading && (
                  <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                      No candidates found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      We couldn't find any staff profiles matching your specific criteria.
                    </Typography>
                    <Button variant="outlined" onClick={clearAllFilters}>
                      Reset Filters
                    </Button>
                  </Paper>
                )
              )}
            </Stack>

            <Stack alignItems="center" sx={{ mt: 2 }}>
              <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} />
            </Stack>
          </Box>
        </Stack>
      </Box>

      {!publicMode && showPitchButton && (
        <Box sx={{ position: "fixed", right: 24, bottom: 24 }}>
          <IconButton
            color="primary"
            sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "white", boxShadow: 3 }}
            onClick={() => setPitchOpen(true)}
          >
            <AddIcon />
          </IconButton>
        </Box>
      )}

      {!publicMode && (
        <PitchDialog
          open={pitchOpen}
          onClose={() => setPitchOpen(false)}
          onSave={handlePitchSave}
          onDelete={async () => {
            if (!existingPostId) return;
            await deleteExplorerPost(existingPostId);
            await reload();
            setPitchOpen(false);
          }}
          isExplorer={isExplorer}
          existingPostId={existingPostId}
          pitchForm={pitchForm}
          setPitchForm={setPitchForm}
          pitchError={pitchError}
          pitchSaving={pitchSaving}
          existingAttachments={existingAttachments}
          onExistingAttachmentRemove={handleExistingAttachmentRemove}
          onFilePick={handleFilePick}
          onFileRemove={handleFileRemove}
        />
      )}
    </Box>
  );

};

export default TalentBoard;







