import * as React from "react";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import InputBase from "@mui/material/InputBase";
import { alpha, styled, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SearchIcon from "@mui/icons-material/Search";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useColorMode } from "../theme/sleekTheme";

const SearchRoot = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.04),
  border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
  transition: theme.transitions.create(["background-color", "box-shadow"]),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.white, 0.08),
    boxShadow: theme.shadows[2],
  },
  width: "100%",
  maxWidth: 260,
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 1.5),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.palette.text.secondary,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  width: "100%",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(3)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
  },
}));

export default function TopBarActions() {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pr: { xs: 0.5, md: 1.5 } }}>
      {downSm ? (
        <Tooltip title="Search">
          <IconButton color="inherit" size="small" aria-label="open search">
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <SearchRoot>
          <SearchIconWrapper>
            <SearchIcon fontSize="small" />
          </SearchIconWrapper>
          <StyledInputBase placeholder="Search..." inputProps={{ "aria-label": "search" }} />
        </SearchRoot>
      )}

      <Tooltip title="Notifications">
        <IconButton color="inherit" size="small" aria-label="notifications">
          <Badge color="error" variant="dot" overlap="circular">
            <NotificationsNoneOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
        <IconButton color="inherit" size="small" onClick={toggleColorMode} aria-label="toggle theme">
          {mode === "dark" ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
