import * as React from "react";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useNavigate } from "react-router-dom";
import { useColorMode } from "../theme/sleekTheme";
import { useAuth } from "../contexts/AuthContext";

type SearchOption = {
  label: string;
  path: string;
  keywords?: string[];
  description?: string;
};

const ownerOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/owner/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Manage Pharmacies",
      path: "/dashboard/owner/manage-pharmacies",
      keywords: ["pharmacies", "stores", "management"],
      description: "Browse and edit your pharmacy locations",
    },
    {
      label: "My Pharmacies",
      path: "/dashboard/owner/manage-pharmacies/my-pharmacies",
      keywords: ["locations", "branches", "pharmacy list"],
    },
    {
      label: "My Chain",
      path: "/dashboard/owner/manage-pharmacies/my-chain",
      keywords: ["chain", "group", "network"],
    },
    {
      label: "Internal Roster",
      path: "/dashboard/owner/manage-pharmacies/roster",
      keywords: ["schedule", "roster", "staffing"],
    },
    {
      label: "Post a Shift",
      path: "/dashboard/owner/post-shift",
      keywords: ["create shift", "new shift", "shift posting"],
    },
    {
      label: "Public Shifts",
      path: "/dashboard/owner/shifts/public",
      keywords: ["public shifts", "available shifts"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/owner/shifts/community",
      keywords: ["community", "shared shifts"],
    },
    {
      label: "Active Shifts",
      path: "/dashboard/owner/shifts/active",
      keywords: ["active shifts", "current shifts"],
    },
    {
      label: "Confirmed Shifts",
      path: "/dashboard/owner/shifts/confirmed",
      keywords: ["confirmed", "booked shifts"],
    },
    {
      label: "Shift History",
      path: "/dashboard/owner/shifts/history",
      keywords: ["past shifts", "history"],
    },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/owner/onboarding",
      keywords: ["profile", "onboarding", "setup"],
    },
    {
      label: "Chat",
      path: "/dashboard/owner/chat",
      keywords: ["messages", "inbox", "communication"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/owner/interests",
      keywords: ["interests", "explore", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/owner/learning",
      keywords: ["learning", "training", "education"],
    },
    {
      label: "Logout",
      path: "/dashboard/owner/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const organizationOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/organization/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Invite Staff",
      path: "/dashboard/organization/invite",
      keywords: ["invite", "staff", "team"],
    },
    {
      label: "Claim Pharmacies",
      path: "/dashboard/organization/claim",
      keywords: ["claim", "pharmacies", "organization"],
    },
    {
      label: "Manage Pharmacies",
      path: "/dashboard/organization/manage-pharmacies",
      keywords: ["manage", "pharmacies", "stores"],
    },
    {
      label: "My Pharmacies",
      path: "/dashboard/organization/manage-pharmacies/my-pharmacies",
      keywords: ["locations", "branches", "pharmacy list"],
    },
    {
      label: "My Chain",
      path: "/dashboard/organization/manage-pharmacies/my-chain",
      keywords: ["chain", "group", "network"],
    },
    {
      label: "Internal Roster",
      path: "/dashboard/organization/manage-pharmacies/roster",
      keywords: ["roster", "schedule", "staffing"],
    },
    {
      label: "Post a Shift",
      path: "/dashboard/organization/post-shift",
      keywords: ["create shift", "new shift"],
    },
    {
      label: "Public Shifts",
      path: "/dashboard/organization/shifts/public",
      keywords: ["public shifts", "availability"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/organization/shifts/community",
      keywords: ["community", "shared"],
    },
    {
      label: "Active Shifts",
      path: "/dashboard/organization/shifts/active",
      keywords: ["active shifts", "current"],
    },
    {
      label: "Confirmed Shifts",
      path: "/dashboard/organization/shifts/confirmed",
      keywords: ["confirmed", "booked"],
    },
    {
      label: "Shift History",
      path: "/dashboard/organization/shifts/history",
      keywords: ["history", "past shifts"],
    },
    {
      label: "Chat",
      path: "/dashboard/organization/chat",
      keywords: ["messages", "inbox"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/organization/interests",
      keywords: ["interests", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/organization/learning",
      keywords: ["learning", "training"],
    },
    {
      label: "Logout",
      path: "/dashboard/organization/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const pharmacistOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/pharmacist/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Public Shifts",
      path: "/dashboard/pharmacist/shifts/public",
      keywords: ["public shifts", "available shifts"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/pharmacist/shifts/community",
      keywords: ["community", "platform shifts"],
    },
    {
      label: "My Confirmed Shifts",
      path: "/dashboard/pharmacist/shifts/confirmed",
      keywords: ["confirmed", "booked shifts"],
    },
    {
      label: "My Shift History",
      path: "/dashboard/pharmacist/shifts/history",
      keywords: ["past shifts", "history"],
    },
    {
      label: "My Roster",
      path: "/dashboard/pharmacist/shifts/roster",
      keywords: ["roster", "schedule", "internal"],
    },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/pharmacist/onboarding-v2",
      keywords: ["profile", "onboarding", "setup"],
    },
    {
      label: "Set Availability",
      path: "/dashboard/pharmacist/availability",
      keywords: ["availability", "calendar", "schedule"],
    },
    {
      label: "Invoices",
      path: "/dashboard/pharmacist/invoice",
      keywords: ["invoice", "billing", "payments"],
    },
    {
      label: "Create Invoice",
      path: "/dashboard/pharmacist/invoice/new",
      keywords: ["invoice", "new invoice", "billing"],
    },
    {
      label: "Chat",
      path: "/dashboard/pharmacist/chat",
      keywords: ["messages", "inbox", "communication"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/pharmacist/interests",
      keywords: ["interests", "explore", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/pharmacist/learning",
      keywords: ["learning", "training", "education"],
    },
    {
      label: "Logout",
      path: "/dashboard/pharmacist/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const otherStaffOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/otherstaff/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Public Shifts",
      path: "/dashboard/otherstaff/shifts/public",
      keywords: ["public shifts", "available"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/otherstaff/shifts/community",
      keywords: ["community", "platform shifts"],
    },
    {
      label: "My Confirmed Shifts",
      path: "/dashboard/otherstaff/shifts/confirmed",
      keywords: ["confirmed", "booked shifts"],
    },
    {
      label: "My Shift History",
      path: "/dashboard/otherstaff/shifts/history",
      keywords: ["past shifts", "history"],
    },
    {
      label: "My Roster",
      path: "/dashboard/otherstaff/shifts/roster",
      keywords: ["roster", "schedule"],
    },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/otherstaff/onboarding-v2",
      keywords: ["profile", "onboarding"],
    },
    {
      label: "Set Availability",
      path: "/dashboard/otherstaff/availability",
      keywords: ["availability", "calendar"],
    },
    {
      label: "Invoices",
      path: "/dashboard/otherstaff/invoice",
      keywords: ["invoice", "billing"],
    },
    {
      label: "Chat",
      path: "/dashboard/otherstaff/chat",
      keywords: ["messages", "inbox"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/otherstaff/interests",
      keywords: ["interests", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/otherstaff/learning",
      keywords: ["learning", "training"],
    },
    {
      label: "Logout",
      path: "/dashboard/otherstaff/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const explorerOptions: SearchOption[] = [
    { label: "Overview", path: "/dashboard/explorer/overview", keywords: ["home", "dashboard", "summary"] },
    {
      label: "Profile & Onboarding",
      path: "/dashboard/explorer/onboarding-v2",
      keywords: ["profile", "onboarding"],
    },
    {
      label: "Public Shifts",
      path: "/dashboard/explorer/shifts/public",
      keywords: ["public shifts", "browse"],
    },
    {
      label: "Community Shifts",
      path: "/dashboard/explorer/shifts/community",
      keywords: ["community", "platform shifts"],
    },
    {
      label: "Chat",
      path: "/dashboard/explorer/chat",
      keywords: ["messages", "inbox"],
    },
    {
      label: "Explore Interests",
      path: "/dashboard/explorer/interests",
      keywords: ["interests", "resources"],
    },
    {
      label: "Learning Materials",
      path: "/dashboard/explorer/learning",
      keywords: ["learning", "training"],
    },
    {
      label: "Logout",
      path: "/dashboard/explorer/logout",
      keywords: ["sign out", "log out"],
    },
  ];

const defaultOptions: SearchOption[] = Array.from(
  new Map(
    [...ownerOptions, ...organizationOptions, ...pharmacistOptions, ...otherStaffOptions, ...explorerOptions].map((option) => [
      option.path,
      option,
    ])
  ).values()
);

const ROLE_SEARCH_OPTIONS: Record<string, SearchOption[]> = {
  OWNER: ownerOptions,
  PHARMACY_ADMIN: ownerOptions,
  ORG_ADMIN: organizationOptions,
  ORG_OWNER: organizationOptions,
  ORG_STAFF: organizationOptions,
  ORGANIZATION: organizationOptions,
  PHARMACIST: pharmacistOptions,
  OTHER_STAFF: otherStaffOptions,
  EXPLORER: explorerOptions,
  DEFAULT: defaultOptions,
};

export default function TopBarActions() {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const { user } = useAuth();
  const navigate = useNavigate();
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));
  const [query, setQuery] = React.useState("");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const filterOptions = React.useMemo(
    () =>
      createFilterOptions<SearchOption>({
        ignoreAccents: true,
        matchFrom: "any",
        stringify: (option) =>
          [option.label, option.description, ...(option.keywords || [])].filter(Boolean).join(" "),
      }),
    []
  );

  const options = React.useMemo(() => {
    const roleKey = (user?.role || "DEFAULT").toUpperCase();
    return ROLE_SEARCH_OPTIONS[roleKey] ?? ROLE_SEARCH_OPTIONS.DEFAULT;
  }, [user?.role]);

  const searchFieldSx = React.useMemo(
    () => ({
      width: { xs: "100%", sm: 280 },
      "& .MuiOutlinedInput-root": {
        borderRadius: theme.shape.borderRadius,
        backgroundColor: alpha(theme.palette.common.white, 0.04),
        transition: theme.transitions.create(["background-color", "box-shadow", "border-color"]),
        "&:hover": {
          backgroundColor: alpha(theme.palette.common.white, 0.08),
        },
        "&.Mui-focused": {
          backgroundColor: alpha(theme.palette.common.white, 0.1),
          boxShadow: theme.shadows[2],
        },
        "& fieldset": {
          borderColor: alpha(theme.palette.divider, 0.6),
        },
        "&:hover fieldset": {
          borderColor: alpha(theme.palette.primary.main, 0.4),
        },
        "&.Mui-focused fieldset": {
          borderColor: theme.palette.primary.main,
        },
      },
    }),
    [theme]
  );

  const closeMobile = React.useCallback(() => {
    setMobileOpen(false);
    setQuery("");
  }, []);

  const handleNavigate = React.useCallback(
    (option: SearchOption | null) => {
      if (!option) return;
      navigate(option.path);
      setQuery("");
      if (downSm) {
        closeMobile();
      }
    },
    [navigate, downSm, closeMobile]
  );

  const handleEnterSubmit = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" || !query.trim()) return;
      const matches = filterOptions(options, { inputValue: query });
      const firstMatch = matches[0];
      if (firstMatch) {
        event.preventDefault();
        handleNavigate(firstMatch);
      }
    },
    [filterOptions, options, query, handleNavigate]
  );

  const renderSearchField = React.useCallback(
    (autoFocus = false) => (
      <Autocomplete
        sx={searchFieldSx}
        options={options}
        filterOptions={filterOptions}
        autoComplete
        autoHighlight
        includeInputInList
        clearOnBlur={false}
        openOnFocus
        value={null}
        onChange={(_, value) => handleNavigate(value)}
        inputValue={query}
        onInputChange={(_, value) => setQuery(value)}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.path === value.path}
        noOptionsText={query ? "No matches found" : "Start typing to search pages"}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Typography variant="body2" fontWeight={600}>
              {option.label}
            </Typography>
            {option.description && (
              <Typography variant="caption" color="text.secondary">
                {option.description}
              </Typography>
            )}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus={autoFocus}
            placeholder="Search pages..."
            size="small"
            onKeyDown={handleEnterSubmit}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start" sx={{ color: "text.secondary" }}>
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
    ),
    [filterOptions, handleEnterSubmit, handleNavigate, options, query, searchFieldSx]
  );

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pr: { xs: 0.5, md: 1.5 } }}>
      {downSm ? (
        <>
          <Tooltip title="Search">
            <IconButton color="inherit" size="small" aria-label="open search" onClick={() => setMobileOpen(true)}>
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Dialog open={mobileOpen} onClose={closeMobile} fullWidth maxWidth="sm">
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pr: 1,
              }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                Search pages
              </Typography>
              <IconButton size="small" onClick={closeMobile} aria-label="close search dialog">
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0, pb: 2 }}>{renderSearchField(true)}</DialogContent>
          </Dialog>
        </>
      ) : (
        renderSearchField()
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
