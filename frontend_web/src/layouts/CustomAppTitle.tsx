import * as React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CloudCircleIcon from "@mui/icons-material/CloudCircle";
import Box from "@mui/material/Box";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import apiClient from "../utils/apiClient"; // Adjust path if needed

export default function CustomAppTitle({ userRole }: { userRole: string }) {
  const [verified, setVerified] = React.useState<boolean>(false);
  const { workspace, setWorkspace } = useWorkspace();

  React.useEffect(() => {
    async function fetchOnboarding() {
      try {
        let roleKey =
          userRole.toLowerCase() === "other_staff"
            ? "otherstaff"
            : userRole.toLowerCase();
        const res = await apiClient.get(`/client-profile/${roleKey}/onboarding/me/`);
        setVerified(res.data.verified ?? false);
      } catch {
        setVerified(false);
      }
    }
    if (userRole) fetchOnboarding();
  }, [userRole]);

  return (
    <Box sx={{ width: "100%", px: 2, pt: 2 }}>
<Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between">
  <Stack direction="row" alignItems="center" spacing={1}>
    <CloudCircleIcon fontSize="large" color="primary" />
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      ChemistTasker
    </Typography>
    <Tooltip title={verified ? "Admin verified" : "Pending admin approval"}>
      {verified ? (
        <CheckCircleIcon color="success" fontSize="small" />
      ) : (
        <HourglassEmptyIcon color="disabled" fontSize="small" />
      )}
    </Tooltip>
  </Stack>
  {/* Only show for pharmacist/other staff */}
  {["PHARMACIST", "OTHER_STAFF"].includes(userRole?.toUpperCase?.()) && (
    <WorkspaceSwitcher workspace={workspace} setWorkspace={setWorkspace} />
  )}
</Stack>

    </Box>
  );
}
