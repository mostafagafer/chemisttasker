// src/layouts/CustomAppTitle.tsx

import * as React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import apiClient from "../utils/apiClient";
import { useAuth } from "../contexts/AuthContext";

// 👉 Use your PNG logo file here
import logoPng from "../assets/20250711_1205_Chemisttasker Badge Design_remix_01jzwbh9q5ez49phsbaz65h9cd.png";

type Props = { userRole: string };

export default function CustomAppTitle({ userRole }: Props) {
  const { isAdminUser, activePersona } = useAuth();
  const [verified, setVerified] = React.useState<boolean>(false);
  const { workspace, setWorkspace } = useWorkspace();

  const isAdminPersona = activePersona === "admin" && isAdminUser;

  // Normalize role once
  const rawRole = (userRole || "").trim().toLowerCase().replace(/\s/g, "_");
  // Canonical key for API path (keeps your old "otherstaff" special case)
  const roleKey = rawRole === "other_staff" ? "otherstaff" : rawRole;
  // Visibility: ONLY Pharmacist and Other Staff get the switcher
  const isSwitcherVisible =
    activePersona === "staff" && (rawRole === "pharmacist" || rawRole === "other_staff");

  // Title that reflects role; treat Pharmacy Admin like Owner
  const roleTitle =
    rawRole === "owner" || isAdminPersona
      ? "Admin Dashboard"
      : rawRole === "otherstaff" || rawRole === "other_staff"
      ? "Staff Dashboard"
      : rawRole === "explorer"
      ? "Explorer"
      : "Pharmacist Dashboard";

// inside CustomAppTitle.tsx

  const onboardingKey = React.useMemo(() => {
    if (rawRole === "owner") {
      return "owner";
    }
    if (isAdminPersona) {
      return null;
    }
    return roleKey;
  }, [rawRole, roleKey, isAdminPersona]);

  React.useEffect(() => {
    let active = true;

    if (!onboardingKey) {
      setVerified(true);
      return () => {
        active = false;
      };
    }

    const endpoints = [
      `/client-profile/${onboardingKey}/onboarding-v2/me/`,
      `/client-profile/${onboardingKey}/onboarding/me/`,
    ];

    const refetch = async () => {
      for (const ep of endpoints) {
        try {
          const res = await apiClient.get(ep);
          if (!active) {
            return;
          }
          const v = !!(res?.data?.verified ?? res?.data?.is_verified ?? false);
          setVerified(v);
          return; // success (v2 or v1)
        } catch (err: any) {
          const status = err?.response?.status;
          // Only fall back on "endpoint missing / method not allowed"
          if (status === 404 || status === 405) {
            continue;
          }
          break;
        }
      }
      if (active) {
        setVerified(false);
      }
    };

    void refetch();

    const handler = () => {
      void refetch();
    };
    window.addEventListener("onboarding-updated", handler);

    return () => {
      active = false;
      window.removeEventListener("onboarding-updated", handler);
    };
  }, [onboardingKey]);

  return (
    <Box
      sx={{
        px: 1,
        py: 0.5,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        width: "100%",
        minWidth: 0,
      }}
    >
      {/* Left: Brand block */}
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        {/* Logo wrapper to preserve aspect ratio & avoid cropping */}
        <Box
          sx={{
            width: 42,
            height: 42,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          <Box
            component="img"
            src={logoPng}
            alt="ChemistTasker"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "left center",
              borderRadius: 0,
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))",
            }}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1 }}
          >
            ChemistTasker
          </Typography>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            noWrap
            title={roleTitle}
            sx={{ maxWidth: 280 }}
          >
            {roleTitle}
          </Typography>
        </Box>
      </Stack>

      {/* Right: Status + workspace */}
      <Stack direction="row" spacing={1.25} sx={{ ml: "auto" }} alignItems="center">
        {verified ? (
          <Chip size="small" variant="outlined" color="success" label="Verified" />
        ) : (
          <Chip size="small" variant="outlined" label="Pending" />
        )}
        {isSwitcherVisible && (
          <WorkspaceSwitcher workspace={workspace} setWorkspace={setWorkspace} />
        )}
      </Stack>
    </Box>
  );
}

