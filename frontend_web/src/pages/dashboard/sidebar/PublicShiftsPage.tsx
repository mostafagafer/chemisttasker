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
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

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
  pharmacy?: { // <-- UPDATE THIS
    id: number;
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  pharmacy_detail?: { // <-- AND UPDATE THIS
    id: number;
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
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
  const getPharmacyData = (shift: Shift) =>
    shift.pharmacy ?? shift.pharmacy_detail;

  // load shifts + my interests
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [shiftsRes, interestsRes] = await Promise.all([
          apiClient.get(API_ENDPOINTS.getPublicShifts),
          apiClient.get(`${API_ENDPOINTS.getShiftInterests}?user=${user.id}`),
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
            must_have:     s.must_have     ?? [],
            nice_to_have:  s.nice_to_have  ?? [],
            created_at:    s.created_at,
            rate_type:     s.rate_type,
            fixed_rate:    s.fixed_rate,
            owner_adjusted_rate: s.owner_adjusted_rate ?? null, // ✅ add this
          }))
        );

                // Fetch rating summaries (average + count) for each unique pharmacy
        const uniquePharmacyIds = Array.from(
          new Set(
            available
              .map(s => (s.pharmacy?.id ?? s.pharmacy_detail?.id))
              .filter((id): id is number => typeof id === 'number')
          )
        );

        await Promise.all(
          uniquePharmacyIds.map(async (pharmacyId) => {
            try {
              const res = await apiClient.get(
                `${API_ENDPOINTS.ratingsSummary}?target_type=pharmacy&target_id=${pharmacyId}`
              );
              setPharmacySummaries(prev => ({
                ...prev,
                [pharmacyId]: {
                  average: res.data?.average ?? 0,
                  count:   res.data?.count   ?? 0,
                },
              }));
            } catch (e) {
              // leave summary missing on error; keep UI resilient
            }
          })
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

      } catch {
        setError('Failed to load public shifts or interests');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  const handleExpressInterest = async (shiftId: number, slotId: number | null) => {
    if (slotId === null) {
      // shift‐level interest
      setDisabledShifts(ds => [...ds, shiftId]);
      try {
        await apiClient.post(
          `${API_ENDPOINTS.getPublicShifts}${shiftId}/express_interest/`,
          {}             // no slot_id
        );
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to express interest');
        setDisabledShifts(ds => ds.filter(id => id !== shiftId));
      }

    } else {
      // per‐slot interest (your existing logic)
      setDisabledSlots(ds => [...ds, slotId]);
      try {
        await apiClient.post(
          `${API_ENDPOINTS.getPublicShifts}${shiftId}/express_interest/`,
          { slot_id: slotId }
        );
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to express interest');
        setDisabledSlots(ds => ds.filter(id => id !== slotId));
      }

    }
  };


  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatSlot = (slot: Slot) => {
    const dateStr = new Date(slot.date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const start = new Date(`1970-01-01T${slot.start_time}`).toLocaleTimeString(
      undefined,
      { hour: '2-digit', minute: '2-digit' }
    );
    const end = new Date(`1970-01-01T${slot.end_time}`).toLocaleTimeString(
      undefined,
      { hour: '2-digit', minute: '2-digit' }
    );
    let base = `${dateStr} ${start} – ${end}`;
    if (slot.is_recurring && slot.recurring_days.length && slot.recurring_end_date) {
      const days = slot.recurring_days.map(d => WEEKDAY_LABELS[d]).join(', ');
      base += ` (Repeats ${days} until ${new Date(slot.recurring_end_date).toLocaleDateString()})`;
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
          // determine rate display
          let rateLabel = 'N/A';
          if (shift.rate_type === 'FIXED') {
            rateLabel = `Fixed – ${shift.fixed_rate} AUD/hr`;
          } else if (shift.rate_type === 'FLEXIBLE') {
            rateLabel = 'Flexible';
          } else if (shift.rate_type === 'PHARMACIST_PROVIDED') {
            rateLabel = 'Pharmacist Provided';
          }
          return (
            <Card key={shift.id} sx={{ mb: 3, ...curvedCardSx }}>
              <CardContent>
                {/* Pharmacy name + rating summary */}
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">
                    {pharm?.name ?? 'Unknown Pharmacy'}
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
                {pharm && (
                  <Typography variant="body2" color="textSecondary">
                    {[pharm.street_address, pharm.suburb, pharm.state, pharm.postcode]
                      .filter(Boolean)
                      .join(', ')}    
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
                    // has this slot already been assigned?
                    const isAssigned = shift.slot_assignments.some(a => a.slot_id === slot.id);

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

                        {!shift.single_user_only && (
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
                  {!shift.single_user_only && shift.slots.length > 1 && (
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
                  {shift.single_user_only && (
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
                        Posted {formatDistanceToNow(new Date(shift.created_at), { addSuffix: true })}
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
