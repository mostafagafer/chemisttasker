import { SyntheticEvent, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  Tabs,
  Tab,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import ActiveShiftsPage from "../sidebar/ActiveShiftsPage";
import ConfirmedShiftsPage from "../sidebar/ConfirmedShiftsPage";
import HistoryShiftsPage from "../sidebar/HistoryShiftsPage";
import AdminActiveShiftsPage from "../admin/AdminActiveShiftsPage";
import AdminConfirmedShiftsPage from "../admin/AdminConfirmedShiftsPage";
import AdminHistoryShiftsPage from "../admin/AdminHistoryShiftsPage";

type Section = "active" | "confirmed" | "history";
const ALL_SECTIONS: Section[] = ["active", "confirmed", "history"];

type Scope = "owner" | "organization" | "admin";

type BaseProps = {
  scope: Scope;
  basePath: string;
  title: string;
  subtitle: string;
};

function ShiftCenterLayout({ scope, basePath, title, subtitle }: BaseProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();

  const currentSection: Section = useMemo(() => {
    if (params.section && ALL_SECTIONS.includes(params.section as Section)) {
      return params.section as Section;
    }
    return "active";
  }, [params.section]);

  useEffect(() => {
    if (!params.section || !ALL_SECTIONS.includes(params.section as Section)) {
      navigate(`${basePath}/active`, { replace: true });
    }
  }, [params.section, basePath, navigate]);

  const handleTabChange = (_: SyntheticEvent, value: Section) => {
    if (value === currentSection) {
      return;
    }
    navigate(`${basePath}/${value}`);
  };

  const heroGradient = useMemo(
    () =>
      `linear-gradient(135deg, ${alpha(
        theme.palette.primary.main,
        0.94
      )}, ${alpha(theme.palette.primary.dark, 0.74)})`,
    [theme.palette.primary.dark, theme.palette.primary.main]
  );

  const SectionComponent = useMemo(() => {
    if (scope === "admin") {
      switch (currentSection) {
        case "confirmed":
          return AdminConfirmedShiftsPage;
        case "history":
          return AdminHistoryShiftsPage;
        case "active":
        default:
          return AdminActiveShiftsPage;
      }
    }
    switch (currentSection) {
      case "confirmed":
        return ConfirmedShiftsPage;
      case "history":
        return HistoryShiftsPage;
      case "active":
      default:
        return ActiveShiftsPage;
    }
  }, [scope, currentSection]);

  const tabItems = useMemo(() => [
    {
      value: "active" as Section,
      label: "Active Shifts",
      icon: <PlayArrowIcon fontSize="small" />,
    },
    {
      value: "confirmed" as Section,
      label: "Confirmed Shifts",
      icon: <CheckCircleIcon fontSize="small" />,
    },
    {
      value: "history" as Section,
      label: "Shifts History",
      icon: <HistoryIcon fontSize="small" />,
    },
  ], []);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1440,
        mx: "auto",
        px: { xs: 1.5, md: 3.5 },
        py: { xs: 2, md: 4 },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2.5, md: 3 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: { xs: 3, md: 4 },
          backgroundImage: heroGradient,
          color: "#fff",
          overflow: "hidden",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 2, md: 3 }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.72, letterSpacing: ".1em" }}>
              Shift Centre
            </Typography>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              {title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 560 }}>
              {subtitle}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        }}
      >
        <Tabs
          value={currentSection}
          onChange={handleTabChange}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            px: { xs: 1.5, md: 2.5 },
            pt: { xs: 1.5, md: 2 },
            "& .MuiTabs-flexContainer": {
              gap: { xs: 1, sm: 1.5 },
              justifyContent: { xs: "flex-start", md: "center" },
            },
            "& .MuiTabs-indicator": {
              display: "none",
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 700,
              fontSize: { xs: 14, sm: 16 },
              minHeight: 52,
              minWidth: 0,
              borderRadius: 999,
              px: { xs: 2.5, sm: 3.5 },
              py: { xs: 1, sm: 1.3 },
              color: alpha(theme.palette.text.primary, 0.72),
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              transition: theme.transitions.create(["color", "background-color", "border-color", "box-shadow"]),
              "&.Mui-selected": {
                color: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                borderColor: alpha(theme.palette.primary.main, 0.45),
                boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.18)}`,
              },
              "&:not(.Mui-selected):hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                borderColor: alpha(theme.palette.primary.main, 0.25),
              },
              "& .MuiTab-iconWrapper": {
                marginRight: theme.spacing(1),
              },
            },
          }}
        >
          {tabItems.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              disableRipple
            />
          ))}
        </Tabs>
        <Box
          sx={{
            px: { xs: 1.5, md: 2.5 },
            pb: { xs: 2, md: 3 },
            pt: { xs: 2, md: 3 },
          }}
        >
          <SectionComponent />
        </Box>
      </Paper>
    </Box>
  );
}

export function OwnerShiftCenterPage() {
  return (
    <ShiftCenterLayout
      scope="owner"
      basePath="/dashboard/owner/shift-center"
      title="Manage your pharmacy shifts"
      subtitle="Review upcoming, confirmed, and past shifts across your pharmacies."
    />
  );
}

export function OrganizationShiftCenterPage() {
  return (
    <ShiftCenterLayout
      scope="organization"
      basePath="/dashboard/organization/shift-center"
      title="Organization shift operations"
      subtitle="Track staffing progress and coverage across your claimed pharmacies."
    />
  );
}

export function AdminShiftCenterPage() {
  const params = useParams<{ pharmacyId: string; section?: string }>();
  const pharmacyId = params.pharmacyId;

  if (!pharmacyId) {
    return null;
  }

  const basePath = `/dashboard/admin/${pharmacyId}/shift-center`;

  return (
    <ShiftCenterLayout
      scope="admin"
      basePath={basePath}
      title="Admin pharmacy shifts"
      subtitle="Monitor shift activity and confirmations for your selected pharmacy."
    />
  );
}

