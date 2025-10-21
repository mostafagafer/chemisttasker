// src/pages/dashboard/owner/shifts/HistoryShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Snackbar,
  IconButton,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  Skeleton,
  TextField, // <— ADD

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
  role_needed: string;
  pharmacy_detail: {
    id: number;
    name: string;
    address?: string;
  };
  single_user_only: boolean;
  slot_assignments: {
    slot_id: number;
    user_id: number;
  }[];
  slots: Slot[];
}
interface RatePreference {
  weekday: string;
  saturday: string;
  sunday: string;
  public_holiday: string;
  early_morning: string;
  late_night: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  short_bio?: string;
  resume?: string;
  rate_preference?: RatePreference | null;

}

const curvedPaperSx = {
  borderRadius: 3,
  boxShadow: '0 20px 45px rgba(109, 40, 217, 0.08)',
};

const gradientButtonSx = {
  borderRadius: 2,
  background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
  color: '#fff',
  '&:hover': { background: 'linear-gradient(90deg, #A78BFA 0%, #8B5CF6 100%)' },
};

export default function HistoryShiftsPage() {
  // State
  const [shifts, setShifts]           = useState<Shift[]>([]);
  const [loading, setLoading]         = useState(true); // Set to true initially for skeleton loading
  const [snackbar, setSnackbar]       = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);


  // Rating modal state (Owner → Worker)
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [currentStars, setCurrentStars] = useState<number>(0);
  const [currentComment, setCurrentComment] = useState<string>('');
  const [loadingExistingWorkerRating, setLoadingExistingWorkerRating] = useState(false);
  const [savingWorkerRating, setSavingWorkerRating] = useState(false);

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
    setLoading(true); // Ensure loading is true when fetching starts
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
      .finally(() => setLoading(false)); // Ensure loading is set to false
  }, []);

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));
  const closeDialog   = () => setDialogOpen(false);

  // Reuse the same reveal_profile logic
// View already-assigned profile (no reveal quota consumed)
const openProfile = (shiftId: number, slotId: number|null, userId: number) => {
  const url = API_ENDPOINTS.viewAssignedShiftProfile('history', shiftId)
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


// Open "Rate Worker" modal (pre-fills existing rating if any)
const openRateWorker = async (workerUserId: number) => {
  setSelectedWorkerId(workerUserId);
  setRateModalOpen(true);
  setLoadingExistingWorkerRating(true);
  try {
    const res = await apiClient.get(
      `${API_ENDPOINTS.ratingsMine}?target_type=worker&target_id=${workerUserId}`
    );
    if (res.data && res.data.id) {
      setCurrentStars(res.data.stars || 0);
      setCurrentComment(res.data.comment || '');
    } else {
      setCurrentStars(0);
      setCurrentComment('');
    }
  } catch {
    setSnackbar({ open: true, msg: 'Failed to load existing rating' });
    setCurrentStars(0);
    setCurrentComment('');
  } finally {
    setLoadingExistingWorkerRating(false);
  }
};

  if (loading) {
    return (
      <Container sx={{ textAlign:'center', py:4 }}>
        {[...Array(3)].map((_, index) => ( // Render 3 skeleton papers
        <Paper key={index} sx={{ p: 2, mb: 2, ...curvedPaperSx }}>
            <Skeleton variant="text" width="70%" height={30} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="50%" height={20} sx={{ mb: 2 }} />
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Skeleton variant="rectangular" width={150} height={36} />
            </Box>
          </Paper>
        ))}
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
      <Paper key={shift.id} sx={{ p:2, mb:2, ...curvedPaperSx }}>
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
                    {/* <Rating
                      size="small"
                      value={0}
                      onChange={() => {}}
                    /> */}
                  </Box>

                {assign && (
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openProfile(shift.id, slot.id, assign.user_id)}
                    >
                      View Assigned
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      onClick={() => openRateWorker(assign.user_id)}
                      sx={gradientButtonSx}
                    >
                      Rate Chemist
                    </Button>
                  </Box>
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

            {/* Rate Worker Modal */}
      <Dialog open={rateModalOpen} onClose={() => setRateModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Rate Assigned Worker</DialogTitle>
        <DialogContent>
          {loadingExistingWorkerRating ? (
            <Box display="flex" justifyContent="center" py={3}>
              <Skeleton variant="rectangular" width="100%" height={100} />
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Typography>Select a star rating:</Typography>
              <Rating
                name="worker-rating"
                value={currentStars}
                size="large"
                onChange={(_, value) => setCurrentStars(value || 0)}
              />
              <TextField
                label="Comment (optional)"
                multiline
                minRows={3}
                value={currentComment}
                onChange={(e) => setCurrentComment(e.target.value)}
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateModalOpen(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!selectedWorkerId) return;
              setSavingWorkerRating(true);
              try {
                // Upsert rating: OWNER_TO_WORKER
                await apiClient.post(API_ENDPOINTS.ratings, {
                  direction: 'OWNER_TO_WORKER',
                  ratee_user: selectedWorkerId,
                  stars: currentStars,
                  comment: currentComment,
                });
                setSnackbar({ open: true, msg: 'Worker rating saved successfully!' });
                setRateModalOpen(false);
              } catch {
                setSnackbar({ open: true, msg: 'Failed to save worker rating' });
              } finally {
                setSavingWorkerRating(false);
              }
            }}
            variant="contained"
            color="primary"
            disabled={savingWorkerRating || currentStars === 0}
            sx={gradientButtonSx}
          >
            {savingWorkerRating ? 'Saving...' : 'Save Rating'}
          </Button>
        </DialogActions>
      </Dialog>


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

              {profile.rate_preference && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Rate Preference</strong>
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li>Weekday: {profile.rate_preference.weekday || "N/A"}</li>
                    <li>Saturday: {profile.rate_preference.saturday || "N/A"}</li>
                    <li>Sunday: {profile.rate_preference.sunday || "N/A"}</li>
                    <li>Public Holiday: {profile.rate_preference.public_holiday || "N/A"}</li>
                    <li>Early Morning: {profile.rate_preference.early_morning || "N/A"}</li>
                    <li>Late Night: {profile.rate_preference.late_night || "N/A"}</li>
                  </ul>
                </Box>
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
