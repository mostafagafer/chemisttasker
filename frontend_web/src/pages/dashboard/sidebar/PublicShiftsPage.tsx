// src/pages/dashboard/sidebar/PublicShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Box,
  Divider,
  Pagination,
  Snackbar,
  IconButton,
  Skeleton,
  Rating,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  Shift,
  expressInterestInPublicShiftService,
  fetchPublicShifts,
  fetchShiftInterests,
  fetchRatingsSummaryService,
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

const gradientButtonSx = {
  borderRadius: 2,
  background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
  color: '#fff',
  '&:hover': { background: 'linear-gradient(90deg, #A78BFA 0%, #8B5CF6 100%)' },
};

export default function PublicShiftsPage() {
  const auth = useAuth();
  if (!auth?.user) return null;
  const user = auth.user;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true); // Set to true initially for skeleton loading
  const [pharmacySummaries, setPharmacySummaries] = useState<Record<number, { average: number; count: number }>>({});
  const [disabledSlots, setDisabledSlots] = useState<number[]>([]);
  const [disabledShifts, setDisabledShifts] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const getPharmacyLocationLine = (shift: Shift) => {
    const pharm = getPharmacyData(shift);
    if (!pharm) return null;
    if (shift.postAnonymously) {
      return pharm.suburb ?? null;
    }
    const parts = [pharm.streetAddress, pharm.suburb, pharm.state, pharm.postcode]
      .filter((part): part is string => Boolean(part && part.toString().trim().length));
    if (parts.length === 0) return null;
    return parts.join(', ');
  };

  // load shifts + my interests
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [publicShifts, interests] = await Promise.all([
          fetchPublicShifts({}),
          fetchShiftInterests({ userId: user.id }),
        ]);

        const available = publicShifts.filter((shift: Shift) => {
          const assignedSlotCount = shift.slotAssignments?.length ?? 0;
          const slots = shift.slots ?? [];
          return assignedSlotCount < slots.length;
        });

        setShifts(available);

        const uniquePharmacyIds: number[] = Array.from(
          new Set(
            available
              .map((s: Shift) => {
                const pharm = getPharmacyData(s);
                return pharm?.id;
              })
              .filter((id: unknown): id is number => typeof id === 'number')
          )
        );

        await Promise.all(
          uniquePharmacyIds.map(async (pharmacyId: number) => {
            try {
              const summary = await fetchRatingsSummaryService({
                targetType: 'pharmacy',
                targetId: pharmacyId,
              });
              setPharmacySummaries(prev => ({
                ...prev,
                [pharmacyId]: {
                  average: summary.average ?? 0,
                  count: summary.count ?? 0,
                },
              }));
            } catch (e) {
              console.error('Failed to load rating summary for pharmacy', pharmacyId, e);
            }
          })
        );

        const slotIds = interests
          .map((i: any) => i.slotId)
          .filter((id: unknown): id is number => typeof id === 'number');
        setDisabledSlots(slotIds);

        const shiftIds = interests
          .filter((i: any) => i.slotId == null)
          .map((i: any) => i.shift);
        setDisabledShifts(shiftIds);
      } catch {
        setError('Failed to load public shifts or interests');
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
      setDisabledShifts(ds => [...ds, shiftId]);
      try {
        if (shift.singleUserOnly) {
          await expressInterestInPublicShiftService({ shiftId, slotId: null });
        } else {
          const slots = shift.slots ?? [];
          await Promise.all(
            slots.map(slot =>
              expressInterestInPublicShiftService({ shiftId, slotId: slot.id })
            )
          );
          setDisabledSlots(ds => [...ds, ...slots.map(s => s.id)]);
        }
      } catch (error) {
        showSnackbar(getErrorMessage(error, 'Failed to express interest'));
        setDisabledShifts(ds => ds.filter(id => id !== shiftId));
      }
    } else {
      setDisabledSlots(ds => [...ds, slotId]);
      try {
        await expressInterestInPublicShiftService({ shiftId, slotId });
      } catch (error) {
        showSnackbar(getErrorMessage(error, 'Failed to express interest'));
        setDisabledSlots(ds => ds.filter(id => id !== slotId));
      }
    }
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
        Public Shifts
      </Typography>

      {error && (
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
      )}

      {displayedShifts.length === 0 ? (
        <Typography>No public shifts available.</Typography>
      ) : (
        displayedShifts.map(shift => {
          const pharm = getPharmacyData(shift);
          const heading = getPharmacyHeading(shift);
          const locationLine = getPharmacyLocationLine(shift);
          const slots = shift.slots ?? [];
          // determine rate display
          let rateLabel = 'N/A';
          if (shift.rateType === 'FIXED') {
            rateLabel = `Fixed - ${shift.fixedRate} AUD/hr`;
          } else if (shift.rateType === 'FLEXIBLE') {
            rateLabel = 'Flexible';
          } else if (shift.rateType === 'PHARMACIST_PROVIDED') {
            rateLabel = 'Pharmacist Provided';
          }
          const workloadTags = shift.workloadTags ?? [];
          const mustHave = shift.mustHave ?? [];
          const niceToHave = shift.niceToHave ?? [];
          return (
            <Card key={shift.id} sx={{ mb: 3, ...curvedCardSx }}>
              <CardContent>
                {/* Pharmacy name + rating summary */}
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">
                    {heading}
                  </Typography>

                  {pharm?.id != null && pharmacySummaries[pharm.id] && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Rating
                        value={pharmacySummaries[pharm.id].average}
                        precision={0.5}
                        readOnly
                        size="small"
                      />
                      <Typography variant="body2" color="textSecondary">
                        ({pharmacySummaries[pharm.id].count})
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Divider sx={{ my: 1 }} />
                
                {/* THIS IS THE UPDATED DISPLAY LOGIC */}
                {locationLine && (
                  <Typography variant="body2" color="textSecondary">
                    {locationLine}
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
                  {slots.map((slot: ShiftSlot) => {
                    const assignments = shift.slotAssignments ?? [];
                    const isAssigned = assignments.some(a => a.slotId === slot.id);

                    // disable if:
                    //  • user already requested this slot (disabledSlots)
                    //  • user already requested the whole shift (disabledShifts)
                    //  • slot is already assigned
                    const slotDisabled =
                      disabledSlots.includes(slot.id) ||
                      disabledShifts.includes(shift.id) ||
                      isAssigned;

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
                          <Button
                            size="small"
                            variant="contained"
                            disabled={slotDisabled}
                            onClick={() => handleExpressInterest(shift.id, slot.id)}
                            sx={gradientButtonSx}
                          >
                            {slotDisabled ? 'Requested' : 'Express Interest'}
                          </Button>
                        )}
                      </Box>
                    );
                  })}

                  {/* 2) “Express Interest in All Slots” only if more than one slot */}
                  {!shift.singleUserOnly && slots.length > 1 && (
                    <Box display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={disabledShifts.includes(shift.id)}
                        onClick={() => handleExpressInterest(shift.id, null)}
                        sx={gradientButtonSx}
                      >
                        {disabledShifts.includes(shift.id)
                          ? 'Requested All'
                          : 'Express Interest in All Slots'}
                      </Button>
                    </Box>
                  )}

                  {/* 3) Single-user-only mode button */}
                  {shift.singleUserOnly && (
                    <Box display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={disabledShifts.includes(shift.id)}
                        onClick={() => handleExpressInterest(shift.id, null)}
                        sx={gradientButtonSx}
                      >
                        {disabledShifts.includes(shift.id)
                          ? 'Requested'
                          : 'Express Interest'}
                      </Button>
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
