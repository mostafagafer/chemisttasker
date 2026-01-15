import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { deleteAccount } from "@chemisttasker/shared-core";
import { useAuth } from "../contexts/AuthContext";

const CONFIRM_TEXT = "DELETE";

export default function AccountDeletionSection() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const canConfirm = confirmValue.trim().toUpperCase() === CONFIRM_TEXT;

  const handleCloseDialog = () => {
    if (isDeleting) return;
    setDialogOpen(false);
    setConfirmValue("");
    setError("");
  };

  const handleDelete = async () => {
    if (!canConfirm || isDeleting) return;
    setIsDeleting(true);
    setError("");

    try {
      await deleteAccount();
      logout();
      setSnackbarOpen(true);
      setDialogOpen(false);
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        mt: 4,
        border: "1px solid",
        borderColor: "error.main",
        borderRadius: 2,
        p: { xs: 2, md: 3 },
        bgcolor: alpha(theme.palette.error.main, 0.08),
      })}
    >
      <Typography variant="h6" color="error" fontWeight={700} gutterBottom>
        Danger Zone
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Deleting your account is permanent. Your account will be deactivated immediately, and
        verification documents are removed within 7 days.
      </Typography>
      <Button
        variant="contained"
        color="error"
        onClick={() => setDialogOpen(true)}
      >
        Delete My Account
      </Button>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This action cannot be undone. Type DELETE to confirm.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Type DELETE to confirm"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            disabled={isDeleting}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={!canConfirm || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert severity="success" sx={{ width: "100%" }}>
          Account deletion requested/completed.
        </Alert>
      </Snackbar>
    </Box>
  );
}
