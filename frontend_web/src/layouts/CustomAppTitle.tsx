import * as React from "react";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import Box from "@mui/material/Box";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import apiClient from "../utils/apiClient";

// Import your logo banner
import logoBanner from '../assets/logo-banner.jpg';

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

  const isSwitcherVisible = ["PHARMACIST", "OTHER_STAFF"].includes(userRole?.toUpperCase?.());

  return (
    // The change is here: reduced top padding from `pt: 2` to `pt: 1` to move everything higher.
    <Box sx={{ width: "100%", px: 2, pt: 1 }}> 
      <Stack 
        direction="row" 
        alignItems="center" 
        spacing={2} 
        justifyContent={isSwitcherVisible ? "space-between" : "center"}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box 
            component="img"
            src={logoBanner}
            alt="ChemistTasker Logo"
            sx={{ height: '32px', width: 'auto' }}
          />
          <Tooltip title={verified ? "Admin verified" : "Pending admin approval"}>
            {verified ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <HourglassEmptyIcon color="disabled" fontSize="small" />
            )}
          </Tooltip>
        </Stack>
        
        {isSwitcherVisible && (
          <WorkspaceSwitcher workspace={workspace} setWorkspace={setWorkspace} />
        )}
      </Stack>
    </Box>
  );
}