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
  TextField, // <â€” ADD

} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Shift,
  ShiftUser,
  fetchHistoryShifts,
  viewAssignedShiftProfileService,
  fetchMyRatingForTargetService,
  createRatingService,
} from '@chemisttasker/shared-core';

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
  const { activePersona, activeAdminPharmacyId } = useAuth();
  const scopedPharmacyId =
    activePersona === "admin" && typeof activeAdminPharmacyId === "number"
      ? activeAdminPharmacyId
      : null;
// State
  // State
  // State
  const [shifts, setShifts]           = useState<Shift[]>([]);
  const [loading, setLoading]         = useState(true); // Set to true initially for skeleton loading
  const [snackbar, setSnackbar]       = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });
  const [profile, setProfile]         = useState<ShiftUser | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);


  // Rating modal state (Owner â†’ Worker)
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
    setLoading(true);
    fetchHistoryShifts()
      .then(data => {
        const filtered =
          scopedPharmacyId != null
            ? data.filter((shift: Shift) => {
                const targetId =
                  shift.pharmacyDetail?.id ?? (shift as any).pharmacyId ?? shift.pharmacy ?? null;
                return Number(targetId ?? NaN) === scopedPharmacyId;
              })
            : data;
        setShifts(filtered);
      })
      .catch(() => setSnackbar({ open: true, msg: 'Failed to load history shifts' }))
      .finally(() => setLoading(false));
  }, [scopedPharmacyId]);

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));
  const closeDialog   = () => setDialogOpen(false);

  // Reuse the same reveal_profile logic
// View already-assigned profile (no reveal quota consumed)
const openProfile = (shiftId: number, slotId: number|null, userId: number) => {
  viewAssignedShiftProfileService({
    type: 'history',
    shiftId,
    slotId: slotId ?? undefined,
    userId,
  })
    .then(result => {
      setProfile(result);
      setDialogOpen(true);
    })
    .catch(err => setSnackbar({ open: true, msg: err?.response?.data?.detail || 'Failed to load profile' }));
};


// Open "Rate Worker" modal (pre-fills existing rating if any)
const openRateWorker = async (workerUserId: number) => {
  setSelectedWorkerId(workerUserId);
  setRateModalOpen(true);
  setLoadingExistingWorkerRating(true);
  try {
    const existing = await fetchMyRatingForTargetService({
      targetType: 'worker',
      targetId: workerUserId,
    });
    if (existing) {
      setCurrentStars(existing.stars || 0);
      setCurrentComment(existing.comment || '');
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

      {displayedShifts.map((shift: Shift) => {
        const slots = shift.slots ?? [];
        const slotAssignments = shift.slotAssignments ?? [];
        return (
        <Paper key={shift.id} sx={{ p:2, mb:2, ...curvedPaperSx }}>
          <Typography variant="h6">{shift.pharmacyDetail?.name ?? 'Unknown Pharmacy'}</Typography>
          <Typography>Role: {shift.roleNeeded}</Typography>
          <Box sx={{ mt:2, display:'flex', flexDirection:'column', gap:1 }}>
            {/* Per-slot details */}
            {slots.map(slot => {
              // find who was assigned
              const assign = slotAssignments.find(a => a.slotId === slot.id);
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
                      {slot.date} {slot.startTime}-{slot.endTime}
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
                      onClick={() => openProfile(shift.id, slot.id, assign.userId)}
                    >
                      View Assigned
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      onClick={() => openRateWorker(assign.userId)}
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
        );
      })}

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
                await createRatingService({
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
                <strong>Name:</strong> {profile.firstName} {profile.lastName}
              </Typography>
              <Typography><strong>Email:</strong> {profile.email}</Typography>
              <Typography><strong>Phone:</strong> {profile.phoneNumber}</Typography>
              <Typography><strong>Bio:</strong> {profile.shortBio}</Typography>
              {profile.resume && (
                <Button href={profile.resume} target="_blank">
                  Download CV
                </Button>
              )}

              {profile.ratePreference && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Rate Preference</strong>
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li>Weekday: {profile.ratePreference.weekday || "N/A"}</li>
                    <li>Saturday: {profile.ratePreference.saturday || "N/A"}</li>
                    <li>Sunday: {profile.ratePreference.sunday || "N/A"}</li>
                    <li>Public Holiday: {profile.ratePreference.publicHoliday || "N/A"}</li>
                    <li>Early Morning: {profile.ratePreference.earlyMorning || "N/A"}</li>
                    <li>Late Night: {profile.ratePreference.lateNight || "N/A"}</li>
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





