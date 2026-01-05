// src/pages/dashboard/owner/shifts/ConfirmedShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  IconButton,
  Pagination,
  Skeleton,
  CircularProgress, // Import CircularProgress for dialog loading
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Shift,
  ShiftUser,
  fetchConfirmedShifts,
  viewAssignedShiftProfileService,
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

export default function ConfirmedShiftsPage() {
  const { activePersona, activeAdminPharmacyId } = useAuth();
  const scopedPharmacyId =
    activePersona === "admin" && typeof activeAdminPharmacyId === "number"
      ? activeAdminPharmacyId
      : null;
  // 1) State
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true); // Renamed for clarity
  const [profile, setProfile] = useState<ShiftUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false); // New state for profile loading
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: ''
  });

  // 2) Pagination setup
  const itemsPerPage = 10;
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(shifts.length / itemsPerPage);
  const displayedShifts = shifts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 3) Load confirmed shifts
  useEffect(() => {
    setLoadingShifts(true);
    fetchConfirmedShifts()
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
      .catch(() => setSnackbar({ open: true, msg: 'Failed to load confirmed shifts' }))
      .finally(() => setLoadingShifts(false));
  }, [scopedPharmacyId]);

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));
  const closeDialog = () => {
    setDialogOpen(false);
    setProfile(null); // Clear profile data when dialog closes
  };

  // 4) View profile logic - MODIFIED for loading state and clearing
  const openProfile = (
    shiftId: number,
    slotId: number | null,
    userId: number
  ) => {
    setProfile(null); // Clear previous profile data immediately
    setLoadingProfile(true); // Start loading profile data
    setDialogOpen(true); // Open the dialog immediately with a loading state

    viewAssignedShiftProfileService({
      type: 'confirmed',
      shiftId,
      slotId: slotId ?? undefined,
      userId,
    })
      .then(result => {
        setProfile(result);
      })
      .catch((err: any) => {
        console.error("Failed to load assigned profile:", err);
        setSnackbar({ open: true, msg: err?.response?.data?.detail || 'Failed to load assigned profile' });
        setDialogOpen(false); // Close dialog if fetch fails
      })
      .finally(() => {
        setLoadingProfile(false); // End loading profile data
      });
  };

  // 5) Conditional rendering logic for skeleton vs. actual content for main page
  const renderMainContent = () => {
    if (loadingShifts && shifts.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          {[...Array(3)].map((_, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2, ...curvedPaperSx }}>
              <Skeleton variant="text" width="70%" height={30} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="50%" height={20} sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...Array(2)].map((__, slotIndex) => (
                  <Box key={slotIndex} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="rectangular" width={100} height={36} />
                  </Box>
                ))}
              </Box>
            </Paper>
          ))}
        </Box>
      );
    }

    if (!loadingShifts && shifts.length === 0) {
      return <Typography>No confirmed shifts available.</Typography>;
    }

    return (
      <>
        {displayedShifts.map(shift => {
          // Support both camelCase and snake_case from the API
          const assignments = shift.slotAssignments ?? (shift as any).slot_assignments ?? [];
          return (
            <Paper key={shift.id} sx={{ p: 2, mb: 2, ...curvedPaperSx }}>
              <Typography variant="h6">{shift.pharmacyDetail?.name ?? 'Unknown Pharmacy'}</Typography>
              <Typography>Role: {shift.roleNeeded}</Typography>

              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {shift.singleUserOnly ? (
                  <>
                    {(shift.slots ?? []).map(slot => (
                      <Typography key={slot.id} variant="body2">
                        {slot.date} {slot.startTime}{slot.endTime}
                      </Typography>
                    ))}
                    {assignments.length > 0 && assignments[0].userId != null && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="contained"
                          sx={gradientButtonSx}
                          onClick={() =>
                            openProfile(shift.id, null, assignments[0].userId)
                          }
                        >
                          View Assigned
                        </Button>
                      </Box>
                    )}
                  </>
                ) : (
                  (shift.slots ?? []).map(slot => {
                    const assign = assignments.find(entry => entry.slotId === slot.id);
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
                          {slot.date} {slot.startTime}{slot.endTime}
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          sx={gradientButtonSx}
                          onClick={() =>
                            openProfile(shift.id, slot.id, assign.userId)
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
          );
        })}

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
      </>
    );
  };

  // 6) Main render function
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Confirmed Shifts
      </Typography>

      {renderMainContent()}

      {/* 7) Snackbar & Dialog */}
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
          {loadingProfile ? ( // Show CircularProgress/Skeleton while loading profile
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress />
            </Box>
          ) : profile ? (
            <>
              <Typography>
                <strong>Name:</strong> {profile.firstName}{' '}
                {profile.lastName}
              </Typography>
              <Typography>
                <strong>Email:</strong> {profile.email}
              </Typography>
              {profile.phoneNumber && (
                <Typography>
                  <strong>Phone:</strong> {profile.phoneNumber}
                </Typography>
              )}
              {profile.shortBio && (
                <Typography>
                  <strong>Bio:</strong> {profile.shortBio}
                </Typography>
              )}
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
          ) : (
            <Typography>No profile data available.</Typography> // Fallback if profile is null after loading
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}




