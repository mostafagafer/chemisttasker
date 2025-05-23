// src/pages/dashboard/owner/shifts/ConfirmedShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  IconButton,
  Pagination,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  recurring_days: number[];
  recurring_end_date: string | null;
}

interface Shift {
  id: number;
  pharmacy_detail: { name: string };
  role_needed: string;
  single_user_only: boolean;
  slot_assignments: { slot_id: number; user_id: number }[];
  slots: Slot[];
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  short_bio?: string;
  resume?: string;
}

export default function ConfirmedShiftsPage() {
  // 1) State
  const [shifts, setShifts]       = useState<Shift[]>([]);
  const [loading, setLoading]     = useState(true);
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar]   = useState<{ open: boolean; msg: string }>({
    open: false, msg: ''
  });

  // 2) Pagination setup
  const itemsPerPage = 10;  // adjust as desired
  const [page, setPage]   = useState(1);
  const pageCount        = Math.ceil(shifts.length / itemsPerPage);
  const displayedShifts  = shifts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 3) Load confirmed shifts
  useEffect(() => {
    apiClient
      .get(API_ENDPOINTS.getConfirmedShifts)
      .then(res => {
        const data = Array.isArray(res.data.results)
          ? res.data.results
          : Array.isArray(res.data)
            ? res.data
            : [];
        setShifts(data);
      })
      .catch(() =>
        setSnackbar({ open: true, msg: 'Failed to load confirmed shifts' })
      )
      .finally(() => setLoading(false));
  }, []);

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));
  const closeDialog   = () => setDialogOpen(false);

  // 4) Reveal profile pop-over
  const openProfile = (
    shiftId: number,
    slotId: number | null,
    userId: number
  ) => {
    const url     = `${API_ENDPOINTS.getConfirmedShifts}${shiftId}/reveal_profile/`;
    const payload = slotId == null
      ? { user_id: userId }
      : { slot_id: slotId, user_id: userId };

    apiClient
      .post(url, payload)
      .then(res => {
        setProfile(res.data);
        setDialogOpen(true);
      })
      .catch(() =>
        setSnackbar({ open: true, msg: 'Failed to load profile' })
      );
  };

  // 5) Loading / empty states
  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }
  if (!shifts.length) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>No confirmed shifts available.</Typography>
      </Container>
    );
  }

  // 6) Render paginated list
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Confirmed Shifts
      </Typography>

      {displayedShifts.map(shift => (
        <Paper key={shift.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">{shift.pharmacy_detail.name}</Typography>
          <Typography>Role: {shift.role_needed}</Typography>

          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {shift.single_user_only ? (
              <>
                {shift.slots.map(s => (
                  <Typography key={s.id} variant="body2">
                    {s.date} {s.start_time}–{s.end_time}
                  </Typography>
                ))}
                {/* ✅ NEW LOGIC FOR SINGLE-USER SHIFT */}
                {shift.slot_assignments.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        openProfile(shift.id, null, shift.slot_assignments[0].user_id)
                      }
                    >
                      View Assigned
                    </Button>
                  </Box>
                )}

              </>
            ) : (
              shift.slots.map(slot => {
                const assign = shift.slot_assignments.find(
                  a => a.slot_id === slot.id
                );
                return assign ? (
                  <Box
                    key={slot.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography variant="body2">
                      {slot.date} {slot.start_time}–{slot.end_time}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        openProfile(shift.id, slot.id, assign.user_id)
                      }
                    >
                      View Assigned
                    </Button>
                  </Box>
                ) : null;
              })
            )}
          </Box>
        </Paper>
      ))}

      {/* 7) Pagination Controls */}
      {pageCount > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      {/* 8) Snackbar & Dialog */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        message={snackbar.msg}
        action={
          <IconButton size="small" onClick={closeSnackbar} color="inherit">
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Assigned Profile</DialogTitle>
        <DialogContent>
          {profile && (
            <>
              <Typography>
                <strong>Name:</strong> {profile.first_name}{' '}
                {profile.last_name}
              </Typography>
              <Typography>
                <strong>Email:</strong> {profile.email}
              </Typography>
              <Typography>
                <strong>Phone:</strong> {profile.phone_number}
              </Typography>
              <Typography>
                <strong>Bio:</strong> {profile.short_bio}
              </Typography>
              {profile.resume && (
                <Button href={profile.resume} target="_blank">
                  Download CV
                </Button>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
