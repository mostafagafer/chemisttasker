// src/pages/dashboard/owner/shifts/HistoryShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  IconButton,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

interface Slot {
  id: number;                     // you’ll need the id to match slot_assignments
  date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  recurring_days: number[];
  recurring_end_date: string | null;
}

interface Shift {
  id: number;
  role_needed: string;
  pharmacy_detail: {
    id: number;
    name: string;
    address?: string;
  };
  single_user_only: boolean;
  slot_assignments: {             // from your serializer
    slot_id: number;
    user_id: number;
  }[];
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

export default function HistoryShiftsPage() {
  // State
  const [shifts, setShifts]           = useState<Shift[]>([]);
  const [loading, setLoading]         = useState(true);
  const [snackbar, setSnackbar]       = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);

  // Pagination
  const itemsPerPage = 5;
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(shifts.length / itemsPerPage);
  const displayedShifts = shifts.slice((page-1)*itemsPerPage, page*itemsPerPage);
  const handlePageChange = (_: React.ChangeEvent<unknown>, v: number) => {
    setPage(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load history shifts
  useEffect(() => {
    apiClient.get(API_ENDPOINTS.getHistoryShifts)
      .then(res => {
        const data = Array.isArray(res.data.results)
          ? res.data.results
          : Array.isArray(res.data)
            ? res.data
            : [];
        setShifts(data);
      })
      .catch(() => setSnackbar({ open: true, msg: 'Failed to load history shifts' }))
      .finally(() => setLoading(false));
  }, []);

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));
  const closeDialog   = () => setDialogOpen(false);

  // Reuse the same reveal_profile logic
  const openProfile = (shiftId: number, slotId: number|null, userId: number) => {
    const url = `${API_ENDPOINTS.getHistoryShifts}${shiftId}/reveal_profile/`;
    const payload = slotId == null
      ? { user_id: userId }
      : { slot_id: slotId, user_id: userId };
    apiClient.post(url, payload)
      .then(res => {
        setProfile(res.data);
        setDialogOpen(true);
      })
      .catch(() => setSnackbar({ open: true, msg: 'Failed to load profile' }));
  };

  if (loading) {
    return (
      <Container sx={{ textAlign:'center', py:4 }}>
        <CircularProgress />
      </Container>
    );
  }
  if (!shifts.length) {
    return (
      <Container sx={{ py:4 }}>
        <Typography>No past shifts found.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Shift History</Typography>

      {displayedShifts.map(shift => (
        <Paper key={shift.id} sx={{ p:2, mb:2 }}>
          <Typography variant="h6">{shift.pharmacy_detail.name}</Typography>
          <Typography>Role: {shift.role_needed}</Typography>
          <Box sx={{ mt:2, display:'flex', flexDirection:'column', gap:1 }}>
            {/* Per-slot details */}
            {shift.slots.map(slot => {
              // find who was assigned
              const assign = shift.slot_assignments.find(a => a.slot_id === slot.id);
              return (
                <Box
                  key={slot.id}
                  sx={{
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between'
                  }}
                >
                  <Box>
                    <Typography variant="body2">
                      {slot.date} {slot.start_time}–{slot.end_time}
                    </Typography>
                    {/* Rating placeholder */}
                    <Rating
                      size="small"
                      value={0}
                      onChange={() => {}}
                    />
                  </Box>

                  {assign && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openProfile(shift.id, slot.id, assign.user_id)}
                    >
                      View Assigned
                    </Button>
                  )}
                </Box>
              );
            })}
          </Box>
        </Paper>
      ))}

      {/* Pagination */}
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

      {/* Snackbar */}
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

      {/* Profile Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Assigned Profile</DialogTitle>
        <DialogContent>
          {profile && (
            <>
              <Typography>
                <strong>Name:</strong> {profile.first_name} {profile.last_name}
              </Typography>
              <Typography><strong>Email:</strong> {profile.email}</Typography>
              <Typography><strong>Phone:</strong> {profile.phone_number}</Typography>
              <Typography><strong>Bio:</strong> {profile.short_bio}</Typography>
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
