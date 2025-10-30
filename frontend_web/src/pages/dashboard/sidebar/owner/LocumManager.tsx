import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Skeleton,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTheme } from "@mui/material/styles";
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";
import {
  MembershipDTO,
  Role,
  WorkType,
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
import MembershipApplicationsPanel from "./MembershipApplicationsPanel";

const LOCUM_WORK_TYPES = ["LOCUM", "SHIFT_HERO"] as const;

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
  employment_type: (typeof LOCUM_WORK_TYPES)[number];
  existingUserRole?: UserPortalRole | null;
  checking?: boolean;
  error?: string | null;
};

const createInviteRow = (): InviteRowState => ({
  email: "",
  invited_name: "",
  role: "PHARMACIST",
  employment_type: "LOCUM",
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

type Locum = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  workType: WorkType;
};

type LocumManagerProps = {
  pharmacyId: string;
  memberships: MembershipDTO[];
  onMembershipsChanged: () => void;
  loading?: boolean;
};

export default function LocumManager({ pharmacyId, memberships, onMembershipsChanged, loading = false }: LocumManagerProps) {
  const theme = useTheme();
  const tokens = surface(theme);

  const derivedLocums: Locum[] = useMemo(() => {
    return (memberships || []).map((m) => {
      const fullName =
        m.invited_name ||
        m.name ||
        [m.user_details?.first_name, m.user_details?.last_name].filter(Boolean).join(" ") ||
        "Favourite";
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

  const [items, setItems] = useState<Locum[]>(derivedLocums);
  useEffect(() => setItems(derivedLocums), [derivedLocums]);

  const [sortBy, setSortBy] = useState<"name" | "workType">("name");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [filterWork, setFilterWork] = useState<WorkType | "ALL">("ALL");

  const filteredLocums = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1));
    return sorted.filter(
      (locum) =>
        (filterRole === "ALL" || locum.role === filterRole) &&
        (filterWork === "ALL" || locum.workType === filterWork)
    );
  }, [items, sortBy, filterRole, filterWork]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | number | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const handleApplicationsNotification = useCallback(
    (message: string, severity: "success" | "error") => {
      setToast({ message, severity });
    },
    []
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState("14");
  const [linkValue, setLinkValue] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Locum | null>(null);
  const showSkeleton = loading && memberships.length === 0;

  const [inviteRows, setInviteRows] = useState<InviteRowState[]>([createInviteRow()]);

  const resetInviteRows = () => setInviteRows([createInviteRow()]);

  const handleInviteFieldChange = (
    idx: number,
    field: "email" | "invited_name" | "role" | "employment_type",
    value: string
  ) => {
    setInviteRows((prev) => {
      const next = [...prev];
      const row = next[idx];
      if (!row) {
        return prev;
      }
      const updated: InviteRowState = { ...row, [field]: value } as InviteRowState;
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
      const row = inviteRows[idx];
      if (!row) {
        return;
      }
      const email = normalizeEmail(row.email);
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
        const current = next[idx];
        if (!current) {
          return prev;
        }
        next[idx] = { ...current, checking: true, error: null };
        return next;
      });

      try {
        const fetchedRole = await fetchUserRoleByEmail(email);
        setInviteRows((prev) => {
          const next = [...prev];
          const current = next[idx];
          if (!current || normalizeEmail(current.email) !== email) {
            return prev;
          }
          next[idx] = {
            ...current,
            checking: false,
            existingUserRole: fetchedRole,
            error: describeRoleMismatch(current.role, fetchedRole),
          };
          return next;
        });
      } catch {
        setInviteRows((prev) => {
          const next = [...prev];
          const current = next[idx];
          if (!current || normalizeEmail(current.email) !== email) {
            return prev;
          }
          next[idx] = {
            ...current,
            checking: false,
            error: "We couldn't verify this email. Please try again.",
          };
          return next;
        });
      }
    },
    [inviteRows]
  );

  const addInviteRow = () => setInviteRows((prev) => [...prev, createInviteRow()]);

  const removeInviteRow = (idx: number) =>
    setInviteRows((prev) => {
      const next = prev.filter((_, rowIdx) => rowIdx !== idx);
      return next.length ? next : [createInviteRow()];
    });

  const openInviteDialog = () => {
    resetInviteRows();
    setInviteOpen(true);
  };

  const handleSendInvites = async () => {
    let rows = inviteRows.map((row) => ({
      ...row,
      email: row.email.trim(),
    }));
    const rowsWithEmail = rows.filter((row) => row.email);
    if (!rowsWithEmail.length) {
      setToast({ message: "Please add at least one invite.", severity: "error" });
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
          (typeof first === "string" ? first : "Failed to send invites.");
        setToast({ message, severity: "error" });
        return;
      }
      setToast({ message: "Invites sent!", severity: "success" });
      setInviteOpen(false);
      resetInviteRows();
      onMembershipsChanged();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.errors?.[0]?.error ||
        error?.message;
      setToast({ message: detail || "Failed to send invites.", severity: "error" });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRemoveMembership = async (id: string | number) => {
    if (!id) return;
    setDeleteLoadingId(id);
    try {
      await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.membershipDelete(String(id))}`);
      setToast({ message: "Favourite removed", severity: "success" });
      onMembershipsChanged();
    } catch (error: any) {
      setToast({ message: error?.response?.data?.detail || "Failed to remove favourite.", severity: "error" });
    } finally {
      setDeleteLoadingId(null);
      setConfirmRemove(null);
    }
  };

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
        category: "LOCUM_CASUAL",
        expires_in_days: expires,
      });
      const token = res.data?.token;
      const url = `${window.location.origin}/membership/apply/${token}`;
      setLinkValue(url);
      setToast({ message: "Favourite link generated", severity: "success" });
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
      setLinkOpen(false);
    } catch {
      setToast({ message: "Unable to copy link.", severity: "error" });
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setSortBy("name")}>
          Sort: Name
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
            onChange={(e) => setFilterRole(e.target.value as Role | "ALL")}
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
          <InputLabel id="work-type-filter">Filter work type</InputLabel>
          <Select
            labelId="work-type-filter"
            label="Filter work type"
            value={filterWork}
            onChange={(e) => setFilterWork(e.target.value as WorkType | "ALL")}
          >
            <MenuItem value="ALL">All types</MenuItem>
            {LOCUM_WORK_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type.replace("_", " ")}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openInviteDialog}>
          Invite Favourite
        </Button>
        <Button variant="outlined" startIcon={<LinkIcon />} onClick={openLinkDialog}>
          Generate Link
        </Button>
      </Stack>

      {showSkeleton ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={`locum-skeleton-${index}`}
              variant="outlined"
              sx={{ flex: "1 1 420px", maxWidth: 560, borderColor: tokens.border, backgroundColor: tokens.bg }}
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
      ) : filteredLocums.length === 0 ? (
        <Alert severity="info">No favourite locums yet. Use "Invite Favourite" to add people.</Alert>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {filteredLocums.map((locum) => (
            <Card
              key={locum.id}
              variant="outlined"
              sx={{ flex: "1 1 420px", maxWidth: 560, borderColor: tokens.border, backgroundColor: tokens.bg }}
            >
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Stack direction="row" spacing={1}>
                  <Chip label={locum.role.replace("_", " ")} color={getRoleChipColor(locum.role)} />
                  <Chip label={locum.workType.replace("_", " ")} variant="outlined" />
                </Stack>
                <Box sx={{ ml: 1 }}>
                  <Typography fontWeight={600}>{locum.name}</Typography>
                  {locum.email && (
                    <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                      {locum.email}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ ml: "auto" }}>
                  <Tooltip title="Remove favourite">
                    <span>
                      <IconButton
                        color="error"
                        onClick={() => setConfirmRemove(locum)}
                        disabled={deleteLoadingId === locum.id}
                      >
                        {deleteLoadingId === locum.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
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
        <DialogTitle>Remove Favourite</DialogTitle>
        <DialogContent>
          <Typography>
            {confirmRemove
              ? `Remove ${confirmRemove.name} from your favourites? This action can't be undone.`
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
        <DialogTitle>Invite Favourite Locums</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
          {inviteRows.map((row, idx) => (
            <Box
              key={idx}
              sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" } }}
            >
              <TextField
                label="Full name"
                value={row.invited_name}
                onChange={(e) => handleInviteFieldChange(idx, "invited_name", e.target.value)}
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={row.email}
                onChange={(e) => handleInviteFieldChange(idx, "email", e.target.value)}
                onBlur={() => void refreshInviteRowUserRole(idx)}
                fullWidth
                required
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
                <InputLabel id={`work-${idx}`}>Work type</InputLabel>
                <Select
                  labelId={`work-${idx}`}
                  label="Work type"
                  value={row.employment_type}
                  onChange={(e) => handleInviteFieldChange(idx, "employment_type", e.target.value)}
                >
                  {LOCUM_WORK_TYPES.map((type) => (
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
              <Box sx={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 1 }}>
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
          <Button variant="contained" onClick={handleSendInvites} disabled={inviteSubmitting}>
            {inviteSubmitting ? "Sending..." : "Send Invites"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generate Favourite Link</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2, overflow: "visible" }}>
          <TextField
            label="Expiry (days)"
            type="number"
            value={linkExpiry}
            onChange={(e) => setLinkExpiry(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: 1, max: 90 }}
          />
          {linkValue && (
            <TextField label="Shareable link" value={linkValue} fullWidth InputProps={{ readOnly: true }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Close</Button>
          <Button onClick={handleGenerateLink} startIcon={<LinkIcon />} disabled={linkSubmitting}>
            {linkSubmitting ? "Generating..." : linkValue ? "Regenerate" : "Generate"}
          </Button>
          <Button onClick={handleCopyLink} startIcon={<ContentCopyIcon />} disabled={!linkValue}>
            Copy & Close
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
        category="LOCUM_CASUAL"
        title="Pending Favourite Applications"
        allowedEmploymentTypes={Array.from(LOCUM_WORK_TYPES)}
        defaultEmploymentType="LOCUM"
        onApproved={onMembershipsChanged}
        onNotification={handleApplicationsNotification}
      />
    </Box>
  );
}
