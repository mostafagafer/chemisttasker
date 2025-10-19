import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";

type MembershipApplication = {
  id: number;
  pharmacy: string | number;
  category: "FULL_PART_TIME" | "LOCUM_CASUAL";
  role: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  submitted_at?: string;
  pharmacist_award_level?: string | null;
  otherstaff_classification_level?: string | null;
  intern_half?: string | null;
  student_year?: string | null;
};

type PaginatedResponse<T> = {
  results?: T[];
};

type MembershipApplicationsPanelProps = {
  pharmacyId: string;
  category: "FULL_PART_TIME" | "LOCUM_CASUAL";
  title: string;
  allowedEmploymentTypes: string[];
  defaultEmploymentType: string;
  onApproved?: () => void;
  onNotification?: (message: string, severity: "success" | "error") => void;
};

const labelEmploymentType = (value?: string) =>
  (value || "")
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const labelCategory = (category: "FULL_PART_TIME" | "LOCUM_CASUAL") =>
  category === "FULL_PART_TIME" ? "Full/Part-time" : "Favourite (Locum/Shift Hero)";

const formatClassification = (app: MembershipApplication) => {
  const raw =
    app.pharmacist_award_level ||
    app.otherstaff_classification_level ||
    app.intern_half ||
    app.student_year ||
    "";

  return raw
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const buildDefaultMap = (apps: MembershipApplication[], fallback: string) => {
  const map: Record<number, string> = {};
  apps.forEach((app) => {
    map[app.id] = fallback;
  });
  return map;
};

export default function MembershipApplicationsPanel({
  pharmacyId,
  category,
  title,
  allowedEmploymentTypes,
  defaultEmploymentType,
  onApproved,
  onNotification,
}: MembershipApplicationsPanelProps) {
  const [applications, setApplications] = useState<MembershipApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [approveTypeById, setApproveTypeById] = useState<Record<number, string>>({});

  const notify = useCallback(
    (message: string, severity: "success" | "error") => {
      onNotification?.(message, severity);
    },
    [onNotification]
  );

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<MembershipApplication>>(
        `${API_BASE_URL}${API_ENDPOINTS.membershipApplications}?status=PENDING`
      );
      const results = res.data.results || [];
      const filtered = results.filter(
        (app) => String(app.pharmacy) === String(pharmacyId) && app.category === category
      );
      setApplications(filtered);
      setApproveTypeById((prev) => {
        const base = { ...prev };
        filtered.forEach((app) => {
          if (!base[app.id]) {
            base[app.id] = defaultEmploymentType;
          }
        });
        return base;
      });
    } catch (error) {
      notify("Failed to load membership applications.", "error");
    } finally {
      setLoading(false);
    }
  }, [category, defaultEmploymentType, notify, pharmacyId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const allowedTypes = useMemo(() => {
    if (!allowedEmploymentTypes?.length) {
      return [defaultEmploymentType];
    }
    return Array.from(new Set([...allowedEmploymentTypes, defaultEmploymentType]));
  }, [allowedEmploymentTypes, defaultEmploymentType]);

  const handleApprove = useCallback(
    async (app: MembershipApplication) => {
      const employmentType = approveTypeById[app.id] || defaultEmploymentType;
      try {
        await apiClient.post(
          `${API_BASE_URL}${API_ENDPOINTS.membershipApplications}${app.id}/approve/`,
          { employment_type: employmentType }
        );
        notify("Application approved.", "success");
        await fetchApplications();
        onApproved?.();
      } catch (error: any) {
        notify(error?.response?.data?.detail || "Failed to approve application.", "error");
      }
    },
    [approveTypeById, defaultEmploymentType, fetchApplications, notify, onApproved]
  );

  const handleReject = useCallback(
    async (app: MembershipApplication) => {
      try {
        await apiClient.post(`${API_BASE_URL}${API_ENDPOINTS.membershipApplications}${app.id}/reject/`, {});
        notify("Application rejected.", "success");
        await fetchApplications();
      } catch (error: any) {
        notify(error?.response?.data?.detail || "Failed to reject application.", "error");
      }
    },
    [fetchApplications, notify]
  );

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>

      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading applications...
          </Typography>
        </Stack>
      ) : applications.length === 0 ? (
        <Alert severity="info">No pending applications.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {applications.map((app) => {
            const applicantName = [app.first_name, app.last_name].filter(Boolean).join(" ") || "Applicant";
            const selectedType = approveTypeById[app.id] || defaultEmploymentType;
            const classification = formatClassification(app);

            return (
              <Card key={app.id} variant="outlined">
                <CardContent
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    gap: 2,
                    alignItems: { xs: "flex-start", md: "center" },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={600}>{applicantName}</Typography>
                    {app.email && (
                      <Typography variant="body2" color="text.secondary">
                        {app.email}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                      <Chip size="small" label={app.role} />
                      <Chip size="small" label={labelCategory(app.category)} color="primary" variant="outlined" />
                      {classification && (
                        <Chip size="small" label={classification} variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                      Submitted: {formatTimestamp(app.submitted_at)}
                    </Typography>
                  </Box>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel id={`employment-type-${app.id}`}>Approve as</InputLabel>
                      <Select
                        labelId={`employment-type-${app.id}`}
                        label="Approve as"
                        value={selectedType}
                        onChange={(event) =>
                          setApproveTypeById((prev) => ({
                            ...prev,
                            [app.id]: String(event.target.value),
                          }))
                        }
                      >
                        {allowedTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {labelEmploymentType(type)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Approve">
                        <span>
                          <IconButton color="success" onClick={() => handleApprove(app)}>
                            <DoneIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <span>
                          <IconButton color="error" onClick={() => handleReject(app)}>
                            <CloseIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
