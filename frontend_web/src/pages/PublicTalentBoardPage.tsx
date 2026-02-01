import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
} from "@mui/material";
import AuthLayout from "../layouts/AuthLayout";
import TalentBoard from "./dashboard/sidebar/TalentBoard";
import { API_BASE_URL } from "../constants/api";
import { setCanonical, setPageMeta, setSocialMeta } from "../utils/seo";

export default function PublicTalentBoardPage() {
  const [posts, setPosts] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  useEffect(() => {
    const title = "Find Talent | ChemistTasker";
    const description = "Browse pharmacist and pharmacy staff talent profiles on ChemistTasker.";
    const origin = window.location.origin;
    const canonicalUrl = `${origin}/talent/public-board`;
    const image = `${origin}/images/Chemisttasker.png`;

    setPageMeta(title, description);
    setCanonical(canonicalUrl);
    setSocialMeta({
      title,
      description,
      url: canonicalUrl,
      image,
      type: "website",
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/client-profile/explorer-posts/public-feed/?page=1&page_size=200`
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to load talent feed." }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }
      const res: any = await response.json();
      const list = Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
      const mapped = list.map((post: any) => ({
        ...post,
        authorUserId: post.author_user_id ?? post.authorUserId ?? null,
        roleTitle: post.role_title ?? post.roleTitle ?? null,
        roleCategory: post.role_category ?? post.roleCategory ?? null,
        workTypes: post.work_types ?? post.workTypes ?? null,
        coverageRadiusKm: post.coverage_radius_km ?? post.coverageRadiusKm ?? null,
        openToTravel: post.open_to_travel ?? post.openToTravel ?? null,
        availabilityMode: post.availability_mode ?? post.availabilityMode ?? null,
        availabilitySummary: post.availability_summary ?? post.availabilitySummary ?? null,
        availabilityDays: post.availability_days ?? post.availabilityDays ?? null,
        availabilityNotice: post.availability_notice ?? post.availabilityNotice ?? null,
        locationState: post.location_state ?? post.locationState ?? null,
        locationSuburb: post.location_suburb ?? post.locationSuburb ?? null,
        locationPostcode: post.location_postcode ?? post.locationPostcode ?? null,
        referenceCode: post.reference_code ?? post.referenceCode ?? null,
        explorerRoleType: post.explorer_role_type ?? post.explorerRoleType ?? null,
        explorerUserId: post.explorer_user_id ?? post.explorerUserId ?? null,
      }));
      setPosts(mapped);
    } catch (err: any) {
      setError(err?.message || "Failed to load talent feed.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AuthLayout title="Find Talent" maxWidth={false} noCard showTitle={false}>
      <TalentBoard
        publicMode
        externalPosts={posts}
        externalLoading={loading}
        externalError={error}
        onRequireLogin={() => setLoginDialogOpen(true)}
      />

      <Dialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)}>
        <DialogTitle>Log in to continue</DialogTitle>
        <DialogContent dividers>
          <p className="text-sm text-slate-600">
            You need an account to contact talent, view profiles, or save preferences.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginDialogOpen(false)}>Cancel</Button>
          <Button component={RouterLink} to="/register" variant="outlined">
            Create account
          </Button>
          <Button component={RouterLink} to="/login" variant="contained">
            Log in
          </Button>
        </DialogActions>
      </Dialog>
    </AuthLayout>
  );
}
