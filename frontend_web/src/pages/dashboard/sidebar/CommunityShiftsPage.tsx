// src/pages/dashboard/sidebar/CommunityShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  // CircularProgress,
  Chip,
  Box,
  Divider,
  Pagination,
  Snackbar,
  IconButton,
  Skeleton, // Added Skeleton import
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  Shift,
  expressInterestInCommunityShiftService,
  fetchCommunityShifts,
  fetchShiftInterests,
  fetchShiftRejections,
  rejectCommunityShiftService,
} from '@chemisttasker/shared-core';

const formatClockTime = (value?: string | null) => {
  if (!value) return '';
  const [hourPart = '0', minutePart = '00'] = value.split(':');
  let hour = Number(hourPart);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const minutes = minutePart.padStart(2, '0');
  return `${hour}:${minutes} ${suffix}`;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type ShiftSlot = NonNullable<Shift['slots']>[number];

const gradientButtonSx = {
  borderRadius: 2,
  background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
  '&:hover': { background: 'linear-gradient(90deg, #A78BFA 0%, #8B5CF6 100%)' },
};

const curvedCardSx = {
  borderRadius: 3,
  boxShadow: '0 20px 45px rgba(109, 40, 217, 0.08)',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export default function CommunityShiftsPage() {
  const auth = useAuth();
  if (!auth?.user) return null;
  const user = auth.user;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true); // Set to true initially for skeleton loading
  const [disabledSlots, setDisabledSlots] = useState<number[]>([]);
  const [disabledShifts, setDisabledShifts] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rejectedSlots, setRejectedSlots] = useState<number[]>([]);
  const [rejectedShifts, setRejectedShifts] = useState<number[]>([]);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  // pagination
  const itemsPerPage = 10;
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(shifts.length / itemsPerPage);
  const displayedShifts = shifts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // helper to pick whichever field exists
  const getPharmacyData = (shift: Shift) => {
    const pharm = shift.pharmacy ?? shift.pharmacyDetail;
    return typeof pharm === 'number' ? null : pharm;
  };

  const getPharmacyHeading = (shift: Shift) => {
    const pharm = getPharmacyData(shift);
    if (shift.postAnonymously) {
      const suburb = pharm?.suburb?.trim();
      return suburb && suburb.length > 0 ? `Shift in ${suburb}` : 'Anonymous Shift';
    }
    return pharm?.name ?? 'Unknown Pharmacy';
  };

  const getPharmacySubheading = (shift: Shift) => {
    if (shift.postAnonymously) {
      return null;
    }
    const pharm = getPharmacyData(shift);
    if (!pharm) return null;
    if (pharm.streetAddress) {
      return pharm.state ? `${pharm.state} | ${pharm.streetAddress}` : pharm.streetAddress;
    }
    return null;
  };

  // load shifts + my interests
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [community, interests, rejections] = await Promise.all([
          fetchCommunityShifts({}),
          fetchShiftInterests({ userId: user.id }),
          fetchShiftRejections({ userId: user.id }),
        ]);

        const available = community.filter((shift: Shift) => {
          const assignedSlotCount = shift.slotAssignments?.length ?? 0;
          const slots = shift.slots ?? [];
          return assignedSlotCount < slots.length;
        });

        setShifts(available);

        const slotInterestIds = interests
          .map((i: any) => i.slotId)
          .filter((id: unknown): id is number => typeof id === 'number');
        setDisabledSlots(slotInterestIds);

        const shiftInterestIds = interests
          .filter((i: any) => i.slotId == null)
          .map((i: any) => i.shift);
        setDisabledShifts(shiftInterestIds);

        const slotRejections = rejections
          .map((r: any) => r.slotId)
          .filter((id: unknown): id is number => typeof id === 'number');
        setRejectedSlots(slotRejections);

        const shiftRejections = rejections
          .filter((r: any) => r.slotId == null)
          .map((r: any) => r.shift);
        setRejectedShifts(shiftRejections);
      } catch (error) {
        setError('Failed to load community shifts or interests');
        console.error('Failed to load community shifts:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  const handleExpressInterest = async (shiftId: number, slotId: number | null) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) {
      showSnackbar('Shift not found.');
      return;
    }

    const slots = shift.slots ?? [];
    const slotIdsForShift = slots.map(s => s.id);

    if (slotId === null) {
      setDisabledShifts(ds => [...ds, shiftId]);
      if (!shift.singleUserOnly) {
        setDisabledSlots(ds => [...ds, ...slotIdsForShift]);
        setRejectedSlots(rs => rs.filter(id => !slotIdsForShift.includes(id)));
      }
      setRejectedShifts(rs => rs.filter(id => id !== shiftId));

      try {
        if (shift.singleUserOnly) {
          await expressInterestInCommunityShiftService({ shiftId, slotId: null });
          showSnackbar('Expressed interest in entire shift.');
        } else {
          await Promise.all(
            slots.map(slot =>
              expressInterestInCommunityShiftService({ shiftId, slotId: slot.id })
            )
          );
          showSnackbar('Expressed interest in all slots.');
        }
      } catch (error) {
        showSnackbar(getErrorMessage(error, 'Failed to express interest.'));
        setDisabledShifts(ds => ds.filter(id => id !== shiftId));
        if (!shift.singleUserOnly) {
          setDisabledSlots(ds => ds.filter(id => !slotIdsForShift.includes(id)));
        }
      }
    } else {
      setDisabledSlots(ds => [...ds, slotId]);
      setRejectedSlots(rs => rs.filter(id => id !== slotId));
      try {
        await expressInterestInCommunityShiftService({ shiftId, slotId });
        showSnackbar('Expressed interest in slot.');
      } catch (error) {
        showSnackbar(getErrorMessage(error, 'Failed to express interest in slot.'));
        setDisabledSlots(ds => ds.filter(id => id !== slotId));
      }
    }
  };

  const handleReject = async (shiftId: number, slotId: number | null) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) {
      showSnackbar('Shift not found.');
      return;
    }
    const slots = shift.slots ?? [];

    if (slotId === null) {
      // Reject Entire Shift
      setRejectedShifts(rs => [...rs, shiftId]);
      if (!shift.singleUserOnly) {
        // Multi-slot shift: also reject all individual slots
        setRejectedSlots(rs => [
          ...rs,
          ...slots.map(s => s.id)
        ]);
        // Also remove any individual slot interests for this shift
        setDisabledSlots(ds => ds.filter(id => !slots.map(s => s.id).includes(id)));
      }
      // Remove any entire shift interests
      setDisabledShifts(ds => ds.filter(id => id !== shiftId));

      try {
        if (shift.singleUserOnly) {
          await rejectCommunityShiftService({ shiftId, slotId: null });
          showSnackbar('Rejected entire shift.');
        } else {
          await Promise.all(
            slots.map(slot =>
              rejectCommunityShiftService({ shiftId, slotId: slot.id })
            )
          );
          showSnackbar('Rejected all slots in shift.');
        }
      } catch (error) {
        showSnackbar(getErrorMessage(error, 'Failed to reject shift.'));
        setRejectedShifts(rs => rs.filter(id => id !== shiftId)); // Re-enable if error
        if (!shift.singleUserOnly) {
          setRejectedSlots(rs => rs.filter(id => !slots.map(s => s.id).includes(id)));
        }
      }
      } else {
      // Per-slot rejection
      setRejectedSlots(rs => [...rs, slotId]);
      // Remove this specific slot from interests if it was interested
      setDisabledSlots(ds => ds.filter(id => id !== slotId));
      try {
        await rejectCommunityShiftService({ shiftId, slotId });
        showSnackbar('Rejected slot.');
      } catch (error) {
        showSnackbar(getErrorMessage(error, 'Failed to reject slot.'));
        setRejectedSlots(rs => rs.filter(id => id !== slotId)); // Re-enable if error
      }
    }
  };

  const getSlotStatus = (shift: Shift, slot: ShiftSlot) => {
    const assignments = shift.slotAssignments ?? [];
    const isAssigned = assignments.some(a => a.slotId === slot.id);
    if (isAssigned) return 'Assigned';

    // Check if individual slot is rejected or requested
      const slotRejected = rejectedSlots.includes(slot.id);
      const slotRequested = disabledSlots.includes(slot.id);

    if (slotRejected) return 'Rejected';
    if (slotRequested) return 'Requested';

    // Check if entire shift is rejected or requested (for multi-slot shifts)
    const shiftRejected = rejectedShifts.includes(shift.id);
    const shiftRequested = disabledShifts.includes(shift.id);

    if (shiftRejected) return 'Rejected';
    if (shiftRequested) return 'Requested';

    return 'None'; // Neither requested nor rejected
  };

  const getShiftStatus = (shift: Shift) => {
    const slotAssignments = shift.slotAssignments ?? [];
    const anySlotAssigned = slotAssignments.length > 0;
    if (anySlotAssigned && !shift.singleUserOnly) {
      // If it's a multi-user shift, and any slot is assigned, the "entire shift" buttons don't make sense to be 'requested' or 'rejected'
      // This scenario might need more nuanced handling depending on what "fully assigned" means for the whole shift.
      // For simplicity, if any slot is assigned, we consider the whole shift not fully available for a single interest/reject.
      return 'Partially Assigned';
    }


    const shiftRejected = rejectedShifts.includes(shift.id);
    const shiftRequested = disabledShifts.includes(shift.id);

    if (shiftRejected) return 'Rejected';
    if (shiftRequested) return 'Requested';

    // If it's a multi-slot shift and not singleUserOnly, check individual slots.
    // If *all* slots are either requested or rejected individually, then the whole shift might be considered as such.
    const slots = shift.slots ?? [];
    if (!shift.singleUserOnly && slots.length > 0) {
      const allSlotsHandled = slots.every(slot => {
        const status = getSlotStatus(shift, slot);
        return status === 'Requested' || status === 'Rejected' || status === 'Assigned';
      });

      if (allSlotsHandled) {
        const allSlotsRejected = slots.every(slot => rejectedSlots.includes(slot.id));
        const allSlotsRequested = slots.every(slot => disabledSlots.includes(slot.id));

        if (allSlotsRejected) return 'Rejected';
        if (allSlotsRequested) return 'Requested';
        // If some are rejected and some are requested, or some assigned, it's mixed.
        return 'Mixed Status';
      }
    }


    return 'None';
  };


  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatSlot = (slot: ShiftSlot) => {
    const dateStr = dayjs(slot.date).format('MMM D, YYYY');
    const start = formatClockTime(slot.startTime);
    const end = formatClockTime(slot.endTime);
    let base = `${dateStr} ${start} – ${end}`;
    if (slot.isRecurring && slot.recurringDays && slot.recurringDays.length && slot.recurringEndDate) {
      const days = slot.recurringDays.map((d: number) => WEEKDAY_LABELS[d]).join(', ');
      base += ` (Repeats ${days} until ${dayjs(slot.recurringEndDate).format('MMM D, YYYY')})`;
    }
    return base;
  };
  const showSnackbar = (msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  };

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        {[...Array(3)].map((_, index) => ( // Render 3 skeleton cards
          <Card key={index} sx={{ mb: 3, ...curvedCardSx }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={30} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={120} />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="rectangular" width={100} height={36} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Community Shifts
      </Typography>

      {error && (
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
      )}

      {displayedShifts.length === 0 ? (
        <Typography>No community shifts available.</Typography>
      ) : (
        displayedShifts.map(shift => {
          const heading = getPharmacyHeading(shift);
          const subheading = getPharmacySubheading(shift);
          const slots = shift.slots ?? [];
          let rateLabel = 'N/A';
          if (shift.rateType === 'FIXED') {
            rateLabel = `Fixed – ${shift.fixedRate} AUD/hr`;
          } else if (shift.rateType === 'FLEXIBLE') {
            rateLabel = 'Flexible';
          } else if (shift.rateType === 'PHARMACIST_PROVIDED') {
            rateLabel = 'Pharmacist Provided';
          }
          const shiftStatus = getShiftStatus(shift);
          const workloadTags = shift.workloadTags ?? [];
          const mustHave = shift.mustHave ?? [];
          const niceToHave = shift.niceToHave ?? [];

          return (
            <Card key={shift.id} sx={{ mb: 3, ...curvedCardSx }}>
              <CardContent>
                {/* Pharmacy name & address */}
                <Typography variant="h6">
                  {heading}
                </Typography>
                <Divider sx={{ my: 1 }} />
                {subheading && (
                  <Typography variant="body2" color="textSecondary">
                    {subheading}
                  </Typography>
                )}

                {/* Shift description*/}
                {shift.description && (
                  <Typography variant="body1" color="text.primary" sx={{ mt: 3, whiteSpace: 'pre-wrap' }}>
                    {shift.description}
                  </Typography>
                )}

                <Divider sx={{ my: 1 }} />

                {/* Rate */}
                <Box sx={{ mt: 4 }}>
                  {/* Pharmacist Rate Info */}
                  {shift.rateType && (
                    <Typography variant="body1">
                      <strong>Rate:</strong> {rateLabel}
                    </Typography>
                  )}

                  {/* Owner Bonus for Other Staff */}
                  {shift.ownerAdjustedRate && (
                    <Typography
                      variant="body1"
                      sx={{ color: 'green', fontWeight: 'bold', mt: shift.rateType ? 1 : 0 }}
                    >
                      💰 Bonus: +{shift.ownerAdjustedRate} AUD/hr on top of Award Rate
                    </Typography>
                  )}
                </Box>


                {/* Employment Type */}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body1">
                    <strong>Emp. Type:</strong> {(shift.employmentType || 'UNKNOWN').replace('_', ' ')}
                  </Typography>
                </Box>


                {/* Time Slots */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Time Slots</Typography>

                  {/* 1) Always list each slot */}
                  {slots.map(slot => {
                    const slotStatus = getSlotStatus(shift, slot);
                    const isAssigned = (shift.slotAssignments ?? []).some(a => a.slotId === slot.id);

                    return (
                      <Box
                        key={slot.id}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mt: 1 }}
                      >
                        <Typography variant="body1">
                          {formatSlot(slot)}
                        </Typography>
                        {!shift.singleUserOnly && (
                          <Box>
                            {slotStatus === 'None' && !isAssigned ? (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleExpressInterest(shift.id, slot.id)}
                                  sx={[gradientButtonSx, { mr: 1 }]}
                                >
                                  Express Interest
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleReject(shift.id, slot.id)}
                                >
                                  Reject Slot
                                </Button>
                              </>
                            ) : (
                              <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                                {slotStatus === 'Assigned' ? 'Assigned' : slotStatus}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}


                  {/* 2) “Express Interest in All Slots” only if more than one slot */}
                  {!shift.singleUserOnly && slots.length > 1 && (
                    <Box display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
                      {shiftStatus === 'None' || shiftStatus === 'Mixed Status' || shiftStatus === 'Partially Assigned' ? (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={shiftStatus === 'Partially Assigned'}
                            onClick={() => handleExpressInterest(shift.id, null)}
                            sx={{ mr: 1 }}
                          >
                            Express Interest in All Slots
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={shiftStatus === 'Partially Assigned'}
                            onClick={() => handleReject(shift.id, null)}
                          >
                            Reject Entire Shift
                          </Button>
                        </>
                      ) : (
                        <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                          {shiftStatus}
                        </Typography>
                      )}
                    </Box>
                  )}


                  {/* 3) Single-user-only mode button */}
                  {shift.singleUserOnly && (
                    <Box display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
                      {shiftStatus === 'None' ? (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleExpressInterest(shift.id, null)}
                            sx={[gradientButtonSx, { mr: 1 }]}
                          >
                            Express Interest
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleReject(shift.id, null)}
                          >
                            Reject Shift
                          </Button>
                        </>
                      ) : (
                        <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                          {shiftStatus}
                        </Typography>
                      )}
                    </Box>
                  )}

                </Box>

                {/* Workload Tags */}
                {workloadTags.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Workload Tags</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {workloadTags.map(tag => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Must-Have */}
                {mustHave.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Must-Have</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {mustHave.map(skill => (
                        <Chip
                          key={skill}
                          label={skill}
                          color="primary"
                          size="small"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Nice-to-Have */}
                {niceToHave.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Nice-to-Have</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {niceToHave.map(skill => (
                        <Chip key={skill} label={skill} color="default" size="small" />
                      ))}
                    </Box>
                    <Box sx={{ mt: 1, textAlign: 'left' }}>
                      <Typography variant="caption" color="textSecondary">
                        Posted {formatDistanceToNow(dayjs.utc(shift.createdAt).toDate(), { addSuffix: true })}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {shifts.length > itemsPerPage && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMsg}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbarOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
}
dayjs.extend(utc);
