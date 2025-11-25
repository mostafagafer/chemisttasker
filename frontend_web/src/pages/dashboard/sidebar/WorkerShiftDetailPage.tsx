// src/pages/dashboard/worker/WorkerShiftDetailPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Box,
  Divider,
  Snackbar,
  IconButton,
  Skeleton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { green } from '@mui/material/colors';
import {
  Shift,
  expressInterestInShiftService,
  fetchShiftInterests,
  fetchShiftRejections,
  fetchWorkerShiftDetailService,
  rejectShiftService,
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

const curvedCardSx = {
  borderRadius: 3,
  boxShadow: '0 20px 45px rgba(109, 40, 217, 0.08)',
};

const gradientButtonSx = {
  borderRadius: 2,
  background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
  color: '#fff',
  '&:hover': { background: 'linear-gradient(90deg, #A78BFA 0%, #8B5CF6 100%)' },
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

const WorkerShiftDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State to track user's interactions
  const [interestedSlots, setInterestedSlots] = useState<number[]>([]);
  const [interestedShifts, setInterestedShifts] = useState<number[]>([]);
  const [rejectedSlots, setRejectedSlots] = useState<number[]>([]);
  const [rejectedShifts, setRejectedShifts] = useState<number[]>([]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const slots = shift?.slots ?? [];

  const showSnackbar = (message: string) => {
    setSnackbar({ open: true, message });
  };

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }
    const shiftId = Number(id);
    if (!Number.isFinite(shiftId)) {
      setError('Invalid shift identifier.');
      setLoading(false);
      return;
    }

    const loadShiftData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [detail, interests, rejections] = await Promise.all([
          fetchWorkerShiftDetailService(shiftId),
          fetchShiftInterests({ userId: user.id }),
          fetchShiftRejections({ userId: user.id }),
        ]);

        setShift(detail);

        setInterestedSlots(
          interests.map((i: any) => i.slotId).filter((slotId: unknown): slotId is number => typeof slotId === 'number')
        );
        setInterestedShifts(
          interests.filter((i: any) => i.slotId == null).map((i: any) => i.shift)
        );

        setRejectedSlots(
          rejections.map((r: any) => r.slotId).filter((slotId: unknown): slotId is number => typeof slotId === 'number')
        );
        setRejectedShifts(
          rejections.filter((r: any) => r.slotId == null).map((r: any) => r.shift)
        );
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load shift details. It may not exist or is no longer available.'));
        console.error('Failed to load shift:', err);
      } finally {
        setLoading(false);
      }
    };

    loadShiftData();
  }, [id, user]);

  const handleExpressInterest = async (shiftId: number, slotId: number | null) => {
    if (!shift) return;

    if (slotId === null) {
      setInterestedShifts(prev => [...prev, shiftId]);
      setRejectedShifts(prev => prev.filter(sid => sid !== shiftId));
      if (!shift.singleUserOnly) {
        const slotIds = slots.map(s => s.id);
        setInterestedSlots(prev => [...prev, ...slotIds]);
        setRejectedSlots(prev => prev.filter(sid => !slotIds.includes(sid)));
      }
    } else {
      setInterestedSlots(prev => [...prev, slotId]);
      setRejectedSlots(prev => prev.filter(sid => sid !== slotId));
    }

    try {
      await expressInterestInShiftService({ shiftId, slotId });
      showSnackbar('Interest expressed successfully!');
    } catch (err) {
      showSnackbar(getErrorMessage(err, 'Failed to express interest.'));
      if (slotId === null) {
        setInterestedShifts(prev => prev.filter(sid => sid !== shiftId));
        if (!shift.singleUserOnly) {
          const slotIds = slots.map(s => s.id);
          setInterestedSlots(prev => prev.filter(sid => !slotIds.includes(sid)));
        }
      } else {
        setInterestedSlots(prev => prev.filter(sid => sid !== slotId));
      }
    }
  };

  const handleReject = async (shiftId: number, slotId: number | null) => {
    if (!shift) return;

     // Immediately update UI
     if (slotId === null) {
        setRejectedShifts(prev => [...prev, shiftId]);
        setInterestedShifts(prev => prev.filter(sid => sid !== shiftId));
        if (!shift.singleUserOnly) {
            const slotIds = slots.map(s => s.id);
            setRejectedSlots(prev => [...prev, ...slotIds]);
            setInterestedSlots(prev => prev.filter(sid => !slotIds.includes(sid)));
        }
    } else {
        setRejectedSlots(prev => [...prev, slotId]);
        setInterestedSlots(prev => prev.filter(sid => sid !== slotId));
    }

    try {
        await rejectShiftService({ shiftId, slotId });
        showSnackbar("Shift has been rejected.");
    } catch (err) {
        showSnackbar(getErrorMessage(err, "An error occurred while rejecting."));
        if (slotId === null) {
            setRejectedShifts(prev => prev.filter(sid => sid !== shiftId));
            if (!shift.singleUserOnly) {
              const slotIds = slots.map(s => s.id);
              setRejectedSlots(prev => prev.filter(sid => !slotIds.includes(sid)));
            }
        } else {
            setRejectedSlots(prev => prev.filter(sid => sid !== slotId));
        }
    }
  };

  const getSlotStatus = useCallback(
    (slotId: number) => {
      if (!shift) return 'None';
      const assignments = shift.slotAssignments ?? [];
      if (assignments.some(a => a.slotId === slotId)) return 'Assigned';
      if (rejectedSlots.includes(slotId) || rejectedShifts.includes(shift.id)) return 'Rejected';
      if (interestedSlots.includes(slotId) || interestedShifts.includes(shift.id)) return 'Requested';
      return 'None';
    },
    [shift, interestedSlots, interestedShifts, rejectedSlots, rejectedShifts]
  );

  const getShiftStatus = useCallback(() => {
    if (!shift) return 'None';
    if (rejectedShifts.includes(shift.id)) return 'Rejected';
    if (interestedShifts.includes(shift.id)) return 'Requested';
    if (slots.length > 0 && slots.every(s => getSlotStatus(s.id) !== 'None')) {
      return 'Completed';
    }
    return 'None';
  }, [shift, interestedShifts, rejectedShifts, getSlotStatus, slots]);


  const formatSlotDate = (slot: NonNullable<Shift['slots']>[number]) => {
        const dateStr = dayjs(slot.date).format('dddd, MMMM D, YYYY');
        const start = formatClockTime(slot.startTime);
        const end = formatClockTime(slot.endTime);
        let base = `${dateStr} from ${start} to ${end}`;
        const recurringDays = slot.recurringDays ?? [];
        if (slot.isRecurring && recurringDays.length && slot.recurringEndDate) {
            const days = recurringDays.map(d => WEEKDAY_LABELS[d]).join(', ');
            base += ` (Repeats on ${days} until ${dayjs(slot.recurringEndDate).format('MMM D, YYYY')})`;
        }
        return base;
      }

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Skeleton variant="text" width="40%" height={40} />
        <Card sx={{ mt: 2, ...curvedCardSx }}>
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
      </Container>
    );
  }

  if (error || !shift) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="error">{error || 'Shift not found.'}</Typography>
        <Button variant="contained" sx={[gradientButtonSx, { mt: 2 }]} onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
    );
  }

  const pharm = shift.pharmacyDetail ?? null;
  const pharmacyHeading = shift.postAnonymously
    ? (pharm?.suburb ? `Shift in ${pharm.suburb}` : 'Anonymous Shift')
    : pharm?.name ?? 'Shift';
  const pharmacyLocation = shift.postAnonymously
    ? pharm?.suburb ?? null
    : [pharm?.streetAddress, pharm?.suburb, pharm?.state, pharm?.postcode]
        .filter(Boolean)
        .join(', ');
  const shiftStatus = getShiftStatus();
  const workloadTags = shift.workloadTags ?? [];
  const mustHave = shift.mustHave ?? [];
  const niceToHave = shift.niceToHave ?? [];

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shift Details
      </Typography>

      <Card sx={curvedCardSx}>
        <CardContent>
          {/* Flexbox Header - Replaces Grid */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5">{pharmacyHeading}</Typography>
                {pharmacyLocation && (
                  <Typography variant="body1" color="text.secondary">
                    {pharmacyLocation}
                  </Typography>
                )}
            </Box>
            <Box>
                <Chip label={shift.roleNeeded} color="primary" />
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>Shift Information</Typography>
          <Box sx={{ mb: 2 }}>
            
            {/* Shift description*/}
            {shift.description && (
            <Typography variant="body1" color="text.primary" sx={{ mt: 3,  whiteSpace: 'pre-wrap' }}>
              {shift.description}
            </Typography>
          )}

            <Divider sx={{ my: 1 }} />

            <Typography><strong>Employment Type:</strong> {(shift.employmentType ?? '').replace('_', ' ')}</Typography>
            {shift.rateType === 'FIXED' && (
                <Typography><strong>Rate:</strong> ${shift.fixedRate}/hr</Typography>
            )}
            {shift.rateType === 'FLEXIBLE' && (
                <Typography><strong>Rate:</strong> Flexible</Typography>
            )}
             {shift.ownerAdjustedRate && (
                <Typography sx={{ color: green[600], fontWeight: 'bold' }}>
                    💰 Bonus: +${shift.ownerAdjustedRate}/hr on top of Award Rate
                </Typography>
            )}
          </Box>


          <Typography variant="h6" gutterBottom>Time Slot(s)</Typography>
            {slots.map(slot => {
                const slotStatus = getSlotStatus(slot.id);
                return (
                    <Box key={slot.id} display="flex" alignItems="center" justifyContent="space-between" p={1} my={0.5} sx={{ border: '1px solid #eee', borderRadius: 1, flexWrap: 'wrap', gap: 1}}>
                        <Typography>{formatSlotDate(slot)}</Typography>
                        {!shift.singleUserOnly && (
                            <Box>
                                {slotStatus === 'None' ? (
                                    <>
                                        <Button size="small" variant="contained" sx={gradientButtonSx} onClick={() => handleExpressInterest(shift.id, slot.id)}>Accept</Button>
                                        <Button size="small" variant="outlined" color="error" sx={{ml: 1}} onClick={() => handleReject(shift.id, slot.id)}>Decline</Button>
                                    </>
                                ) : <Chip label={slotStatus} color={slotStatus === 'Requested' ? 'success' : slotStatus === 'Rejected' ? 'error' : 'default'} size="small"/>}
                            </Box>
                        )}
                    </Box>
                )
            })}

            {shift.singleUserOnly && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                    {shiftStatus === 'None' ? (
                        <>
                            <Button variant="contained" sx={gradientButtonSx} onClick={() => handleExpressInterest(shift.id, null)}>Express Interest in Shift</Button>
                            <Button variant="outlined" color="error" sx={{ml: 1}} onClick={() => handleReject(shift.id, null)}>Reject Shift</Button>
                        </>
                    ) : <Chip label={shiftStatus} color={shiftStatus === 'Requested' ? 'success' : 'error'} />}
                </Box>
            )}
             {!shift.singleUserOnly && slots.length > 1 && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                     {shiftStatus === 'None' ? (
                        <>
                          <Button
                            variant="outlined"
                            onClick={() => handleExpressInterest(shift.id, null)}
                            sx={{ mr: 1 }}
                          >
                            Express Interest in All Slots
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => handleReject(shift.id, null)}
                          >
                            Reject Entire Shift
                          </Button>
                        </>
                      ) : (
                        <Chip label={shiftStatus} />
                      )}
                </Box>
            )}


          {workloadTags.length > 0 && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Workload Tags</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {workloadTags.map(tag => <Chip key={tag} label={tag} />)}
              </Box>
            </Box>
          )}

          {mustHave.length > 0 && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Must-Have Skills</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {mustHave.map(skill => <Chip key={skill} label={skill} color="primary" variant="filled" />)}
              </Box>
            </Box>
          )}

          {niceToHave.length > 0 && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Nice-to-Have Skills</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {niceToHave.map(skill => <Chip key={skill} label={skill} />)}
              </Box>
            </Box>
          )}

            <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Typography variant="caption" color="textSecondary">
                Posted {formatDistanceToNow(dayjs.utc(shift.createdAt).toDate(), { addSuffix: true })}
                </Typography>
            </Box>

        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbar({ ...snackbar, open: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
};

export default WorkerShiftDetailPage;
dayjs.extend(utc);
