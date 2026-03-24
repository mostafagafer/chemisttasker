import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Paper } from "@mui/material";
import { Navigate } from "react-router-dom";
import OwnerOnboarding from "../onboarding/OwnerOnboarding";
import { getOwnerSetupStatus, ownerSetupPaths } from "../../utils/ownerSetup";

export default function OwnerSetupOnboardingPage() {
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getOwnerSetupStatus()
      .then((status) => {
        if (!active) return;
        if (status.nextPath && status.nextPath !== ownerSetupPaths.onboarding) {
          setNextPath(status.nextPath);
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || "Unable to load owner setup.");
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

  if (nextPath) {
    return <Navigate to={nextPath} replace />;
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
      <OwnerOnboarding standalone onSuccessPath={ownerSetupPaths.pharmacies} />
    </Paper>
  );
}
