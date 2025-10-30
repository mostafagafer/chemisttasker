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
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

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
  pharmacy?: {
    id: number;
    name: string;
    address?: string;
    state?: string;
  };
  pharmacy_detail?: {
    id: number;
    name: string;
    address?: string;
    state?: string;
  };
  slots: Slot[];
  employment_type: 'LOCUM' | 'FULL_TIME' | 'PART_TIME';
  workload_tags: string[];
  owner_adjusted_rate?: string | null;
  must_have: string[];
  nice_to_have: string[];
  created_at: string;
  rate_type: 'FIXED' | 'FLEXIBLE' | 'PHARMACIST_PROVIDED' | null;
  fixed_rate: string | null;
  single_user_only: boolean;
  slot_assignments: { slot_id: number; user_id: number }[];
  description?: string;
}

interface Interest {
  id: number;
  shift: number;
  slot: number | null;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const gradientButtonSx = {
  borderRadius: 2,
  background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
  '&:hover': { background: 'linear-gradient(90deg, #A78BFA 0%, #8B5CF6 100%)' },
};

const curvedCardSx = {
  borderRadius: 3,
  boxShadow: '0 20px 45px rgba(109, 40, 217, 0.08)',
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
  const getPharmacyData = (shift: Shift) =>
    shift.pharmacy ?? shift.pharmacy_detail;

  // load shifts + my interests
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [shiftsRes, interestsRes] = await Promise.all([
          apiClient.get(API_ENDPOINTS.getCommunityShifts),
          apiClient.get(API_ENDPOINTS.getShiftInterests + '?user=' + user.id),
        ]);

        const rawShifts: any[] = Array.isArray(shiftsRes.data.results)
          ? shiftsRes.data.results
          : Array.isArray(shiftsRes.data)
          ? shiftsRes.data
          : [];

        const available = rawShifts.filter(s => {
          const assignedSlotCount = s.slot_assignments?.length ?? 0;
          return assignedSlotCount < s.slots.length;
        });

        setShifts(
          available.map(s => ({
            ...s,
            workload_tags: s.workload_tags ?? [],
            must_have: s.must_have ?? [],
            nice_to_have: s.nice_to_have ?? [],
            created_at: s.created_at,
            rate_type: s.rate_type,
            fixed_rate: s.fixed_rate,
            owner_adjusted_rate: s.owner_adjusted_rate ?? null,
          }))
        );

        const rawInt: Interest[] = Array.isArray(interestsRes.data.results)
          ? interestsRes.data.results
          : Array.isArray(interestsRes.data)
          ? interestsRes.data
          : [];

        // 1) all the per-slot interests
        const slotIds = rawInt
          .map(i => i.slot)
          .filter((id): id is number => id != null);
        setDisabledSlots(slotIds);

        // 2) all the shift-level interests (slot === null)
        const shiftIds = rawInt
          .filter(i => i.slot === null)
          .map(i => i.shift);
        setDisabledShifts(shiftIds);
        // Get user's rejections for this user
        try {
          const rejectionsRes = await apiClient.get(
            API_ENDPOINTS.getShiftRejections + '?user=' + user.id
          );

          const rawRej: any[] = Array.isArray(rejectionsRes.data.results)
            ? rejectionsRes.data.results
            : Array.isArray(rejectionsRes.data)
            ? rejectionsRes.data
            : [];

          // Per-slot rejections
          const rejSlotIds = rawRej
            .map(r => r.slot) // Changed from r.slot_id to r.slot based on ShiftRejection model
            .filter((id): id is number => id != null);
          setRejectedSlots(rejSlotIds);

          // Shift-level (entire shift) rejections
          const rejShiftIds = rawRej
            .filter(r => r.slot == null) // Changed from r.slot_id to r.slot
            .map(r => r.shift);
          setRejectedShifts(rejShiftIds);
        } catch (error) {
          console.error("Failed to load rejections:", error);
        }

      } catch (error) {
        setError('Failed to load community shifts or interests');
        console.error("Overall load error:", error);
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

    if (slotId === null) {
      // "Express Interest in All Slots" or "Entire Shift"
      setDisabledShifts(ds => [...ds, shiftId]); // Disable the shift visually immediately
      if (!shift.single_user_only) {
        // Multi-slot shift: also disable all individual slots
        setDisabledSlots(ds => [
          ...ds,
          ...shift.slots.map(s => s.id)
        ]);
        // Also remove any individual slot rejections for this shift
        setRejectedSlots(rs => rs.filter(id => !shift.slots.map(s => s.id).includes(id)));
      }
      // Remove any entire shift rejections
      setRejectedShifts(rs => rs.filter(id => id !== shiftId));


      try {
        if (shift.single_user_only) {
          // For single-user-only shifts, express interest in the entire shift (slot=None)
          await apiClient.post(
            `${API_ENDPOINTS.getCommunityShifts}${shiftId}/express_interest/`,
            { slot_id: null } // Send null for whole shift interest
          );
          showSnackbar('Expressed interest in entire shift.');
        } else {
          // Multi-slot shift: express interest for each individual slot
          await Promise.all(
            shift.slots.map(slot =>
              apiClient.post(
                `${API_ENDPOINTS.getCommunityShifts}${shiftId}/express_interest/`,
                { slot_id: slot.id } // Send specific slot ID for each slot
              )
            )
          );
          showSnackbar('Expressed interest in all slots.');
        }
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to express interest.');
        setDisabledShifts(ds => ds.filter(id => id !== shiftId)); // Re-enable if error
        if (!shift.single_user_only) {
          setDisabledSlots(ds => ds.filter(id => !shift.slots.map(s => s.id).includes(id)));
        }
      }
    } else {
      // per-slot interest
      setDisabledSlots(ds => [...ds, slotId]);
      // Remove this specific slot from rejections if it was rejected
      setRejectedSlots(rs => rs.filter(id => id !== slotId));
      try {
        await apiClient.post(
          `${API_ENDPOINTS.getCommunityShifts}${shiftId}/express_interest/`,
          { slot_id: slotId }
        );
        showSnackbar('Expressed interest in slot.');
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to express interest in slot.');
        setDisabledSlots(ds => ds.filter(id => id !== slotId)); // Re-enable if error
      }
    }
  };

  const handleReject = async (shiftId: number, slotId: number | null) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) {
      showSnackbar('Shift not found.');
      return;
    }

    if (slotId === null) {
      // Reject Entire Shift
      setRejectedShifts(rs => [...rs, shiftId]);
      if (!shift.single_user_only) {
        // Multi-slot shift: also reject all individual slots
        setRejectedSlots(rs => [
          ...rs,
          ...shift.slots.map(s => s.id)
        ]);
        // Also remove any individual slot interests for this shift
        setDisabledSlots(ds => ds.filter(id => !shift.slots.map(s => s.id).includes(id)));
      }
      // Remove any entire shift interests
      setDisabledShifts(ds => ds.filter(id => id !== shiftId));

      try {
        if (shift.single_user_only) {
          await apiClient.post(
            API_ENDPOINTS.rejectCommunityShift(shiftId),
            {} // No slot_id for entire shift rejection
          );
          showSnackbar('Rejected entire shift.');
        } else {
          await Promise.all(
            shift.slots.map(slot =>
              apiClient.post(
                API_ENDPOINTS.rejectCommunityShift(shiftId),
                { slot_id: slot.id }
              )
            )
          );
          showSnackbar('Rejected all slots in shift.');
        }
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to reject shift.');
        setRejectedShifts(rs => rs.filter(id => id !== shiftId)); // Re-enable if error
        if (!shift.single_user_only) {
          setRejectedSlots(rs => rs.filter(id => !shift.slots.map(s => s.id).includes(id)));
        }
      }
    } else {
      // Per-slot rejection
      setRejectedSlots(rs => [...rs, slotId]);
      // Remove this specific slot from interests if it was interested
      setDisabledSlots(ds => ds.filter(id => id !== slotId));
      try {
        await apiClient.post(
          API_ENDPOINTS.rejectCommunityShift(shiftId),
          { slot_id: slotId }
        );
        showSnackbar('Rejected slot.');
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to reject slot.');
        setRejectedSlots(rs => rs.filter(id => id !== slotId)); // Re-enable if error
      }
    }
  };

  const getSlotStatus = (shift: Shift, slot: Slot) => {
    const isAssigned = shift.slot_assignments.some(a => a.slot_id === slot.id);
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
    // If any slot is assigned, the shift cannot be fully "requested" or "rejected" as a whole for new actions.
    const anySlotAssigned = shift.slot_assignments.length > 0;
    if (anySlotAssigned && !shift.single_user_only) {
        // If it's a multi-user shift, and any slot is assigned, the "entire shift" buttons don't make sense to be 'requested' or 'rejected'
        // This scenario might need more nuanced handling depending on what "fully assigned" means for the whole shift.
        // For simplicity, if any slot is assigned, we consider the whole shift not fully available for a single interest/reject.
        return 'Partially Assigned';
    }


    const shiftRejected = rejectedShifts.includes(shift.id);
    const shiftRequested = disabledShifts.includes(shift.id);

    if (shiftRejected) return 'Rejected';
    if (shiftRequested) return 'Requested';

    // If it's a multi-slot shift and not single_user_only, check individual slots.
    // If *all* slots are either requested or rejected individually, then the whole shift might be considered as such.
    if (!shift.single_user_only && shift.slots.length > 0) {
      const allSlotsHandled = shift.slots.every(slot => {
        const status = getSlotStatus(shift, slot);
        return status === 'Requested' || status === 'Rejected' || status === 'Assigned';
      });

      if (allSlotsHandled) {
        const allSlotsRejected = shift.slots.every(slot => rejectedSlots.includes(slot.id));
        const allSlotsRequested = shift.slots.every(slot => disabledSlots.includes(slot.id));

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

  const formatSlot = (slot: Slot) => {
    const dateStr = dayjs(slot.date).format('MMM D, YYYY');
    const start = formatClockTime(slot.start_time);
    const end = formatClockTime(slot.end_time);
    let base = `${dateStr} ${start} – ${end}`;
    if (slot.is_recurring && slot.recurring_days.length && slot.recurring_end_date) {
      const days = slot.recurring_days.map(d => WEEKDAY_LABELS[d]).join(', ');
      base += ` (Repeats ${days} until ${dayjs(slot.recurring_end_date).format('MMM D, YYYY')})`;
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
          const pharm = getPharmacyData(shift);
          let rateLabel = 'N/A';
          if (shift.rate_type === 'FIXED') {
            rateLabel = `Fixed – ${shift.fixed_rate} AUD/hr`;
          } else if (shift.rate_type === 'FLEXIBLE') {
            rateLabel = 'Flexible';
          } else if (shift.rate_type === 'PHARMACIST_PROVIDED') {
            rateLabel = 'Pharmacist Provided';
          }
          const shiftStatus = getShiftStatus(shift);

          return (
          <Card key={shift.id} sx={{ mb: 3, ...curvedCardSx }}>
              <CardContent>
                {/* Pharmacy name & address */}
                <Typography variant="h6">
                  {pharm?.name ?? 'Unknown Pharmacy'}
                </Typography>
                <Divider sx={{ my: 1 }} />
                {pharm?.address && (
                  <Typography variant="body2" color="textSecondary">
                    {pharm?.state ? `${pharm.state} | ` : ''}{pharm.address}
                  </Typography>
                )}

                {/* Shift description*/}
                {shift.description && (
                <Typography variant="body1" color="text.primary" sx={{ mt: 3,  whiteSpace: 'pre-wrap' }}>
                  {shift.description}
                </Typography>
              )}

                <Divider sx={{ my: 1 }} />

                {/* Rate */}
                <Box sx={{ mt: 4 }}>
                  {/* Pharmacist Rate Info */}
                  {shift.rate_type && (
                    <Typography variant="body1">
                      <strong>Rate:</strong> {rateLabel}
                    </Typography>
                  )}

                  {/* Owner Bonus for Other Staff */}
                  {shift.owner_adjusted_rate && (
                    <Typography
                      variant="body1"
                      sx={{ color: 'green', fontWeight: 'bold', mt: shift.rate_type ? 1 : 0 }}
                    >
                      💰 Bonus: +{shift.owner_adjusted_rate} AUD/hr on top of Award Rate
                    </Typography>
                  )}
                </Box>


                {/* Employment Type */}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body1">
                    <strong>Emp. Type:</strong> {shift.employment_type.replace('_', ' ')}
                  </Typography>
                </Box>


                {/* Time Slots */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Time Slots</Typography>

                  {/* 1) Always list each slot */}
                  {shift.slots.map(slot => {
                    const slotStatus = getSlotStatus(shift, slot);
                    const isAssigned = shift.slot_assignments.some(a => a.slot_id === slot.id);

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
                        {!shift.single_user_only && (
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
                  {!shift.single_user_only && shift.slots.length > 1 && (
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
                  {shift.single_user_only && (
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
                {shift.workload_tags.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Workload Tags</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {shift.workload_tags.map(tag => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Must-Have */}
                {shift.must_have.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Must-Have</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {shift.must_have.map(skill => (
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
                {shift.nice_to_have.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Nice-to-Have</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {shift.nice_to_have.map(skill => (
                        <Chip key={skill} label={skill} color="default" size="small" />
                      ))}
                    </Box>
                    <Box sx={{ mt: 1, textAlign: 'left' }}>
                      <Typography variant="caption" color="textSecondary">
                        Posted {formatDistanceToNow(dayjs.utc(shift.created_at).toDate(), { addSuffix: true })}
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
