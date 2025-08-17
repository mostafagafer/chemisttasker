// src/components/CustomAppTitle.tsx
import * as React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import apiClient from "../utils/apiClient";

// 👉 Use your PNG logo file here
//    (keep the path exactly as where you saved it)
import logoPng from "../assets/20250711_1205_Chemisttasker Badge Design_remix_01jzwbh9q5ez49phsbaz65h9cd.png";

type Props = { userRole: string };

export default function CustomAppTitle({ userRole }: Props) {
  const [verified, setVerified] = React.useState<boolean>(false);
  const { workspace, setWorkspace } = useWorkspace();

  // const rolePath = (userRole || "").toLowerCase();
  // const isSwitcherVisible =
  //   rolePath === "pharmacist" || rolePath === "otherstaff" || rolePath === "owner";
  // Normalize role once
  const rawRole = (userRole || "").trim().toLowerCase().replace(/\s/g, "_");
  // Canonical key for API path (keeps your old "otherstaff" special case)
  const roleKey = rawRole === "other_staff" ? "otherstaff" : rawRole;
  // Visibility: ONLY Pharmacist and Other Staff get the switcher
  const isSwitcherVisible = rawRole === "pharmacist" || rawRole === "other_staff";


  // Optional: make the title reflect the role
  const roleTitle =
    rawRole  === "owner"
      ? "Owner Dashboard"
      : rawRole  === "otherstaff" || rawRole  === "other_staff"
      ? "Staff Dashboard"
      : rawRole  === "explorer"
      ? "Explorer"
      : "Pharmacist Dashboard";

  React.useEffect(() => {
    let active = true;
    const endpoint = `/client-profile/${roleKey}/onboarding/me/`;
    apiClient
      .get(endpoint)
      .then((res) => {
        if (!active) return;
        const v = !!(res?.data?.verified ?? res?.data?.is_verified ?? false);
        setVerified(v);
      })
      .catch(() => {
        if (!active) return;
        setVerified(false);
      });
    return () => {
      active = false;
    };
  }, [roleKey, rawRole]);

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
            width: 42,            // ← tweak size here
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
              objectFit: "contain",  // ← shows full image without cropping
              objectPosition: "left center",
              borderRadius: 0,       // ← no rounding
              // Optional: subtle lift so it reads on dark headers
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

      {/* Right: Status + workspace (theme toggle is in toolbarActions, not here) */}
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
