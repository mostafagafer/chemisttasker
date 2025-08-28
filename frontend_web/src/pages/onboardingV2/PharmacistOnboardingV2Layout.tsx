// src/pages/onboardingV2/PharmacistOnboardingV2Layout.tsx
import * as React from "react";
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import apiClient from "../../utils/apiClient";
import { API_ENDPOINTS } from "../../constants/api";

// your tab pages
import BasicInfoV2 from "./BasicInfoV2";
import SkillsV2 from "./SkillsV2";
import PaymentV2 from "./PaymentV2";
import RefereesV2 from "./RefereesV2";
import ProfileV2 from "./ProfileV2";

type StepKey = "basic" | "skills" | "payment" |"rate"| "referees" | "profile";
const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "basic",    label: "Basic Info" },
  { key: "skills",   label: "Skills" },
  { key: "payment",  label: "Payment" },
  { key: "referees", label: "Referees" },
  { key: "rate", label: "Rate" },
  { key: "profile",  label: "Profile" },
];

export default function PharmacistOnboardingV2Layout() {
  const [step, setStep] = React.useState<StepKey>("basic");
  const [progress, setProgress] = React.useState<number>(0);

  // Load real progress from backend on mount
  React.useEffect(() => {
    const url = API_ENDPOINTS.onboardingV2Detail("pharmacist");
    apiClient
      .get(url)
      .then((res) => {
        const p = res.data?.progress_percent ?? 0;
        setProgress(Number.isFinite(p) ? p : 0);
      })
      .catch(() => {
        setProgress(0);
      });
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header + ONLY progress bar here */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Pharmacist Onboarding (V2)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress: {progress}%
            </Typography>
          </Box>
          <LinearProgress
            color="primary"
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 999 }}
          />
        </Box>

        {/* Two-column layout */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr" },
            gap: 2.5,
          }}
        >
          {/* Left: step buttons — light blue border, subtle fade when active */}
          <Box>
            <Stack spacing={1.2}>
              {STEPS.map((s) => {
                const active = s.key === step;
                return (
                  <Button
                    key={s.key}
                    onClick={() => setStep(s.key)}
                    fullWidth
                    size="large"
                    variant="outlined"
                    color="primary"
                    sx={(theme) => ({
                      justifyContent: "flex-start",
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: 2,
                      borderWidth: active ? 2 : 1,
                      borderColor: active
                        ? theme.palette.primary.main
                        : theme.palette.divider,
                      backgroundColor: active
                        ? alpha(theme.palette.primary.main, 0.06)
                        : "transparent",
                      "&:hover": {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      },
                    })}
                  >
                    {s.label}
                  </Button>
                );
              })}
            </Stack>
          </Box>

          {/* Right: page content */}
            <Box sx={{ minHeight: 320 }}>
            {step === "basic" && <BasicInfoV2 /> }
            {step === "skills" && <SkillsV2 /> }
            {step === "payment" && <PaymentV2 /> }
            {step === "referees" && <RefereesV2 /> }
            {step === "rate" && <ProfileV2 /> }
            {step === "profile" && <ProfileV2 /> }
            </Box>

        </Box>
      </Paper>
    </Container>
  );
}
