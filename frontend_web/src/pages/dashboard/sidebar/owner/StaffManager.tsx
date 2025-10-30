import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import {
  Role,
  WorkType,
  MembershipDTO,
  coerceRole,
  coerceWorkType,
  surface,
  requiredUserRoleForMembership,
  UserPortalRole,
} from "./types";
import {
  describeRoleMismatch,
  fetchUserRoleByEmail,
  formatExistingUserRole,
  normalizeEmail,
} from "./inviteUtils";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";
import MembershipApplicationsPanel from "./MembershipApplicationsPanel";

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CASUAL"] as const;

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "INTERN", label: "Intern Pharmacist" },
  { value: "TECHNICIAN", label: "Dispensary Technician" },
  { value: "ASSISTANT", label: "Pharmacy Assistant" },
  { value: "STUDENT", label: "Pharmacy Student" },
];

type InviteRowState = {
  email: string;
  invited_name: string;
  role: Role;
  employment_type: (typeof EMPLOYMENT_TYPES)[number];
  existingUserRole?: UserPortalRole | null;
  checking?: boolean;
  error?: string | null;
};

const createInviteRow = (): InviteRowState => ({
  email: "",
  invited_name: "",
  role: "PHARMACIST",
  employment_type: "FULL_TIME",
  existingUserRole: undefined,
  checking: false,
  error: null,
});

const getRoleChipColor = (role: Role) => {
  switch (role) {
    case "PHARMACIST":
      return "success";
    case "TECHNICIAN":
      return "info";
    case "ASSISTANT":
      return "warning";
    case "INTERN":
      return "secondary";
    case "STUDENT":
      return "default";
    case "CONTACT":
      return "default";
    case "PHARMACY_ADMIN":
      return "primary";
    default:
      return "default";
  }
};

type Staff = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  workType: WorkType;
};

type StaffManagerProps = {
  pharmacyId: string;
  memberships: MembershipDTO[];
  onMembershipsChanged: () => void;
  loading?: boolean;
  pharmacyName?: string;
};

export default function StaffManager({
  pharmacyId,
  memberships,
  onMembershipsChanged,
  loading = false,
  pharmacyName,
}: StaffManagerProps) {
  const theme = useTheme();
  const tokens = surface(theme);

  const derivedStaff: Staff[] = useMemo(() => {
    return (memberships || []).map((m) => {
      const fullName =
        m.invited_name ||
        m.name ||
        [m.user_details?.first_name, m.user_details?.last_name].filter(Boolean).join(" ") ||
        "Team Member";
      const email = m.user_details?.email || m.email;
      return {
        id: m.id,
        name: fullName,
        email,
        role: coerceRole(m.role),
        workType: coerceWorkType(m.employment_type),
      };
    });
  }, [memberships]);

  const [list, setList] = useState<Staff[]>(derivedStaff);
  useEffect(() => setList(derivedStaff), [derivedStaff]);

  const [sortBy, setSortBy] = useState<"role" | "workType">("role");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [filterWork, setFilterWork] = useState<WorkType | "ALL">("ALL");
  const showSkeleton = loading && memberships.length === 0;

  const data = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1));
    return copy.filter(
      (s) =>
        (filterRole === "ALL" || s.role === filterRole) &&
        (filterWork === "ALL" || s.workType === filterWork)
    );
  }, [list, sortBy, filterRole, filterWork]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRows, setInviteRows] = useState<InviteRowState[]>([createInviteRow()]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const handleApplicationsNotification = useCallback(
    (message: string, severity: "success" | "error") => {
      setToast({ message, severity });
    },
    []
  );
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState("14");
  const [linkValue, setLinkValue] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Staff | null>(null);

  const resetInviteForm = () => {
    setInviteRows([createInviteRow()]);
  };

  const handleInviteFieldChange = (
    idx: number,
    field: "email" | "invited_name" | "role" | "employment_type",
    value: string
  ) => {
    setInviteRows((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) {
        return prev;
      }
      const updated: InviteRowState = { ...current, [field]: value } as InviteRowState;
      if (field === "email") {
        updated.existingUserRole = undefined;
        updated.error = null;
      }
      if (field === "role") {
        updated.error = describeRoleMismatch(value as Role, updated.existingUserRole);
      }
      next[idx] = updated;
      return next;
    });
  };

  const refreshInviteRowUserRole = useCallback(
    async (idx: number) => {
      const targetRow = inviteRows[idx];
      if (!targetRow) {
        return;
      }
      const email = normalizeEmail(targetRow.email);
      if (!email || !email.includes("@")) {
        setInviteRows((prev) => {
          const next = [...prev];
          if (!next[idx]) {
            return prev;
          }
          next[idx] = { ...next[idx], existingUserRole: null, checking: false, error: null };
          return next;
        });
        return;
      }

      setInviteRows((prev) => {
        const next = [...prev];
        const row = next[idx];
        if (!row) {
          return prev;
        }
        next[idx] = { ...row, checking: true, error: null };
        return next;
      });

      try {
        const fetchedRole = await fetchUserRoleByEmail(email);
        setInviteRows((prev) => {
          const next = [...prev];
          const row = next[idx];
          if (!row || normalizeEmail(row.email) !== email) {
            return prev;
          }
          next[idx] = {
            ...row,
            checking: false,
            existingUserRole: fetchedRole,
            error: describeRoleMismatch(row.role, fetchedRole),
          };
          return next;
        });
      } catch {
        setInviteRows((prev) => {
          const next = [...prev];
          const row = next[idx];
          if (!row || normalizeEmail(row.email) !== email) {
            return prev;
          }
          next[idx] = {
            ...row,
            checking: false,
            error: "We couldn't verify this email. Please try again.",
          };
          return next;
        });
      }
    },
    [inviteRows]
  );

  const addInviteRow = () => setInviteRows((rows) => [...rows, createInviteRow()]);
  const removeInviteRow = (idx: number) =>
    setInviteRows((rows) => {
      const next = rows.filter((_, i) => i !== idx);
      return next.length ? next : [createInviteRow()];
    });

  const openLinkDialog = () => {
    setLinkExpiry("14");
    setLinkValue("");
    setLinkOpen(true);
  };

  const handleGenerateLink = async () => {
    setLinkSubmitting(true);
    try {
      const expires = Number(linkExpiry) || 14;
      const res = await apiClient.post(`${API_BASE_URL}${API_ENDPOINTS.membershipInviteLinks}`, {
        pharmacy: pharmacyId,
        category: "FULL_PART_TIME",
        expires_in_days: expires,
      });
      const token = res.data?.token;
      const url = `${window.location.origin}/membership/apply/${token}`;
      setLinkValue(url);
      setToast({ message: "Invite link generated", severity: "success" });
    } catch (error: any) {
      setToast({ message: error?.response?.data?.detail || "Failed to generate link.", severity: "error" });
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!linkValue) return;
    try {
      await navigator.clipboard.writeText(linkValue);
      setToast({ message: "Link copied to clipboard", severity: "success" });
    } catch {
      setToast({ message: "Unable to copy link", severity: "error" });
    }
    setLinkOpen(false);
  };

  const handleSendInvites = async () => {
    let rows = inviteRows.map((row) => ({
      ...row,
      email: row.email.trim(),
    }));
    const rowsWithEmail = rows.filter((row) => row.email);
    if (!rowsWithEmail.length) {
      setToast({ message: "Please fill out at least one invite.", severity: "error" });
      return;
    }

    setInviteSubmitting(true);
    let hasErrors = false;
    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      if (!row.email) {
        continue;
      }

      const normalizedEmail = normalizeEmail(row.email);
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        rows[idx] = { ...row, error: "Please enter a valid email address.", checking: false };
        hasErrors = true;
        continue;
      }

      let userRole = row.existingUserRole;
      if (typeof userRole === "undefined") {
        try {
          userRole = await fetchUserRoleByEmail(normalizedEmail);
        } catch {
          rows[idx] = {
            ...row,
            checking: false,
            error: "We couldn't verify this email. Please try again.",
          };
          hasErrors = true;
          continue;
        }
      }

      const mismatch = describeRoleMismatch(row.role, userRole);
      if (mismatch) {
        hasErrors = true;
      }

      rows[idx] = {
        ...row,
        checking: false,
        existingUserRole: userRole ?? null,
        error: mismatch,
      };
    }

    setInviteRows(rows);
    if (hasErrors) {
      setToast({
        message: "One or more invitations need attention before sending.",
        severity: "error",
      });
      setInviteSubmitting(false);
      return;
    }

    const payload = rows
      .filter((row) => row.email)
      .map((row) => ({
        email: row.email,
        invited_name: row.invited_name,
        role: row.role,
        employment_type: row.employment_type,
        pharmacy: pharmacyId,
      }));

    try {
      const response = await apiClient.post(`${API_BASE_URL}${API_ENDPOINTS.membershipBulkInvite}`, {
        invitations: payload,
      });
      const errors = response?.data?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0];
        const message =
          first?.error ||
          first?.detail ||
          (typeof first === "string" ? first : "Failed to send invitations.");
        setToast({ message, severity: "error" });
      } else {
        setToast({ message: "Invitations sent!", severity: "success" });
        setInviteOpen(false);
        resetInviteForm();
        onMembershipsChanged();
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.errors?.[0]?.error ||
        error?.message;
      setToast({ message: detail || "Failed to send invitations.", severity: "error" });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRemoveMembership = async (id: string | number) => {
    if (!id) return;
    setDeleteLoadingId(id);
    try {
      await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.membershipDelete(String(id))}`);
      setToast({ message: "Staff removed", severity: "success" });
      onMembershipsChanged();
    } catch (error: any) {
      setToast({ message: error?.response?.data?.detail || "Failed to remove", severity: "error" });
    } finally {
      setDeleteLoadingId(null);
      setConfirmRemove(null);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setSortBy("role")}>
          Sort: Role
        </Button>
        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setSortBy("workType")}>
          Sort: Work Type
        </Button>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="role-filter">Filter role</InputLabel>
          <Select
            labelId="role-filter"
            label="Filter role"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
          >
            <MenuItem value="ALL">All roles</MenuItem>
            {ROLE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="work-filter">Filter work type</InputLabel>
          <Select
            labelId="work-filter"
            label="Filter work type"
            value={filterWork}
            onChange={(e) => setFilterWork(e.target.value as any)}
          >
            <MenuItem value="ALL">All work types</MenuItem>
            {EMPLOYMENT_TYPES.filter((type) => ["FULL_TIME", "PART_TIME", "CASUAL"].includes(type)).map((type) => (
              <MenuItem key={type} value={type}>
                {type.replace("_", " ")}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>
          Invite Staff
        </Button>
        <Button variant="outlined" startIcon={<LinkIcon />} onClick={openLinkDialog}>
          Generate Link
        </Button>
      </Stack>

      {showSkeleton ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={`staff-skeleton-${index}`}
              variant="outlined"
              sx={{ flex: "1 1 420px", maxWidth: 560, backgroundColor: tokens.bg, borderColor: tokens.border }}
            >
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : data.length === 0 ? (
        <Alert severity="info">No staff yet. Use "Invite Staff" to add members.</Alert>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {data.map((item) => (
            <Card
              key={item.id}
              variant="outlined"
              sx={{ flex: "1 1 420px", maxWidth: 560, backgroundColor: tokens.bg, borderColor: tokens.border }}
            >
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Chip label={item.role.replace("_", " ")} color={getRoleChipColor(item.role)} />
                <Chip label={item.workType.replace("_", " ")} variant="outlined" />
                <Box sx={{ ml: 1 }}>
                  <Typography fontWeight={600}>{item.name}</Typography>
                  {item.email && (
                    <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                      {item.email}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                  <Tooltip title="Remove">
                    <span>
                      <IconButton
                        color="error"
                        onClick={() => setConfirmRemove(item)}
                        disabled={deleteLoadingId === item.id}
                      >
                        {deleteLoadingId === item.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog
        open={Boolean(confirmRemove)}
        onClose={() => {
          if (!deleteLoadingId) setConfirmRemove(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <Typography>
            {confirmRemove
              ? `Remove ${confirmRemove.name} from this pharmacy? This action can't be undone.`
              : "This action can't be undone."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)} disabled={Boolean(deleteLoadingId)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmRemove && handleRemoveMembership(confirmRemove.id)}
            disabled={Boolean(deleteLoadingId)}
          >
            {deleteLoadingId === confirmRemove?.id ? "Removing..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invite Staff to {pharmacyName || pharmacyId}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
          {inviteRows.map((row, idx) => (
            <Box key={idx} sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" } }}>
              <TextField
                label="Full Name"
                value={row.invited_name}
                onChange={(e) => handleInviteFieldChange(idx, "invited_name", e.target.value)}
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                required
                value={row.email}
                onChange={(e) => handleInviteFieldChange(idx, "email", e.target.value)}
                onBlur={() => void refreshInviteRowUserRole(idx)}
                fullWidth
              />
              <FormControl fullWidth error={Boolean(row.error)}>
                <InputLabel id={`role-${idx}`}>Role</InputLabel>
                <Select
                  labelId={`role-${idx}`}
                  label="Role"
                  value={row.role}
                  onChange={(e) => handleInviteFieldChange(idx, "role", e.target.value as Role)}
                >
                  {ROLE_OPTIONS.map((opt) => {
                    const requiredRole = requiredUserRoleForMembership(opt.value);
                    const disableOption =
                      requiredRole !== null &&
                      row.existingUserRole !== undefined &&
                      row.existingUserRole !== null &&
                      row.existingUserRole !== requiredRole;
                    return (
                      <MenuItem key={opt.value} value={opt.value} disabled={disableOption}>
                        {opt.label}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id={`work-${idx}`}>Employment type</InputLabel>
                <Select
                  labelId={`work-${idx}`}
                  label="Employment type"
                  value={row.employment_type}
                  onChange={(e) => handleInviteFieldChange(idx, "employment_type", e.target.value)}
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace("_", " ")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ gridColumn: "span 2", minHeight: 20 }}>
                {row.checking ? (
                  <Typography variant="caption" color="text.secondary">
                    Checking existing account...
                  </Typography>
                ) : row.error ? (
                  <Typography variant="caption" color="error">
                    {row.error}
                  </Typography>
                ) : (
                  (() => {
                    const label = formatExistingUserRole(row.existingUserRole);
                    return label ? (
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                    ) : null;
                  })()
                )}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, gridColumn: "span 2" }}>
                {inviteRows.length > 1 && (
                  <Button color="error" onClick={() => removeInviteRow(idx)}>
                    Remove
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          <Button onClick={addInviteRow}>Add another</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button onClick={handleSendInvites} variant="contained" disabled={inviteSubmitting}>
            {inviteSubmitting ? "Sending..." : "Send Invitations"}
          </Button>
        </DialogActions>
      </Dialog>

      {toast && (
        <Snackbar
          open
          autoHideDuration={4000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ width: "100%" }}>
            {toast.message}
          </Alert>
        </Snackbar>
      )}

      <MembershipApplicationsPanel
        pharmacyId={pharmacyId}
        category="FULL_PART_TIME"
        title="Pending Staff Applications"
        allowedEmploymentTypes={Array.from(EMPLOYMENT_TYPES)}
        defaultEmploymentType="CASUAL"
        onApproved={onMembershipsChanged}
        onNotification={handleApplicationsNotification}
      />

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generate Invite Link</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2, overflow: "visible" }}>
          <TextField
            label="Expiry (days)"
            value={linkExpiry}
            onChange={(e) => setLinkExpiry(e.target.value)}
            type="number"
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: 1, max: 90 }}
          />
          {linkValue && (
            <TextField label="Invite link" value={linkValue} fullWidth InputProps={{ readOnly: true }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Close</Button>
          <Button onClick={handleGenerateLink} startIcon={<LinkIcon />} disabled={linkSubmitting}>
            {linkSubmitting ? "Generating..." : "Generate"}
          </Button>
          <Button onClick={handleCopyLink} startIcon={<ContentCopyIcon />} disabled={!linkValue}>
            Copy & Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
