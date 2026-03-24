import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Paper } from "@mui/material";
import { Navigate } from "react-router-dom";
import PharmacyPage from "../dashboard/sidebar/PharmacyPage";
import { getOwnerSetupStatus, ownerSetupPaths } from "../../utils/ownerSetup";

export default function OwnerSetupPharmaciesPage() {
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetPharmacyCount, setTargetPharmacyCount] = useState(1);

  useEffect(() => {
    let active = true;
    void getOwnerSetupStatus()
      .then((status) => {
        if (!active) return;
        setTargetPharmacyCount(status.numberOfPharmacies);
        if (!status.onboardingComplete) {
          setRedirectPath(ownerSetupPaths.onboarding);
          return;
        }
        if (status.pharmaciesCount > 0) {
          setRedirectPath("/dashboard/owner/overview");
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || "Unable to load pharmacy setup.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 760, mx: "auto", p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ bgcolor: "transparent", py: 2 }}>
      <PharmacyPage
        standalone
        onNeedsOnboardingPath={ownerSetupPaths.onboarding}
        onCompletePath="/dashboard/owner/overview"
        targetPharmacyCount={targetPharmacyCount}
      />
    </Paper>
  );
}
