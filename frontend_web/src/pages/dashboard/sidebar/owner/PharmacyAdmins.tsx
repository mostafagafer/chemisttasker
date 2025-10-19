import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
  CircularProgress,
} from "@mui/material";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SecurityIcon from "@mui/icons-material/Security";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTheme } from "@mui/material/styles";
import { MembershipDTO, surface } from "./types";
import apiClient from "../../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../../constants/api";

interface PharmacyAdminsProps {
  pharmacyId: string;
  admins: MembershipDTO[];
  onMembershipsChanged: () => void;
}

export default function PharmacyAdmins({ pharmacyId, admins, onMembershipsChanged }: PharmacyAdminsProps) {
  const theme = useTheme();
  const tokens = surface(theme);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ invited_name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | number | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const handleInvite = async () => {
    if (!form.email) {
      setToast({ message: "Please provide an email", severity: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`${API_BASE_URL}${API_ENDPOINTS.membershipBulkInvite}`, {
        invitations: [
          {
            pharmacy: pharmacyId,
            role: "PHARMACY_ADMIN",
            employment_type: "FULL_TIME",
            invited_name: form.invited_name,
            email: form.email,
          },
        ],
      });
      setToast({ message: "Admin invitation sent", severity: "success" });
      setInviteOpen(false);
      setForm({ invited_name: "", email: "" });
      onMembershipsChanged();
    } catch (error: any) {
      setToast({ message: error?.response?.data?.detail || "Failed to send invite", severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string | number) => {
    setLoadingId(id);
    try {
      await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.membershipDelete(String(id))}`);
      setToast({ message: "Admin removed", severity: "success" });
      onMembershipsChanged();
    } catch (error: any) {
      setToast({ message: error?.response?.data?.detail || "Failed to remove", severity: "error" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card variant="outlined" sx={{ background: tokens.bg, borderColor: tokens.border }}>
      <CardHeader
        title="Admins"
        action={
          <Button variant="contained" startIcon={<ManageAccountsIcon />} onClick={() => setInviteOpen(true)}>
            Invite Admin
          </Button>
        }
      />
      <CardContent>
        {admins.length === 0 ? (
          <Alert severity="info">No admins yet. Use "Invite Admin" to add one.</Alert>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {admins.map((admin) => {
              const name =
                admin.invited_name ||
                admin.name ||
                [admin.user_details?.first_name, admin.user_details?.last_name].filter(Boolean).join(" ") ||
                "Admin";
              const email = admin.user_details?.email || admin.email;
              return (
                <Card
                  key={admin.id}
                  variant="outlined"
                  sx={{ flex: "1 1 420px", maxWidth: 560, background: tokens.bg, borderColor: tokens.border }}
                >
                  <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                    <Chip label="PHARMACY ADMIN" color="secondary" />
                    <Box sx={{ ml: 1 }}>
                      <Typography fontWeight={600}>{name}</Typography>
                      {email && (
                        <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                          {email}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                      <Tooltip title="Permissions">
                        <IconButton>
                          <SecurityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <span>
                          <IconButton
                            color="error"
                            onClick={() => handleRemove(admin.id)}
                            disabled={loadingId === admin.id}
                          >
                            {loadingId === admin.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invite Admin</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
          <TextField
            label="Full Name"
            value={form.invited_name}
            onChange={(e) => setForm((prev) => ({ ...prev, invited_name: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            fullWidth
          />
          <Typography variant="caption" sx={{ color: tokens.textMuted }}>
            Admins can manage this pharmacy's details and staff.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} variant="contained" disabled={submitting}>
            {submitting ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast?.message}
      />
    </Card>
  );
}
