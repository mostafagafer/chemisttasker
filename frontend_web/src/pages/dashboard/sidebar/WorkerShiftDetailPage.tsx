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
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { green } from '@mui/material/colors';

// --- Interface Definitions ---
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
  pharmacy_detail: {
    id: number;
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  slots: Slot[];
  role_needed: string;
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

interface Rejection {
    id: number;
    shift: number;
    slot: number | null;
}


const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const showSnackbar = (message: string) => {
    setSnackbar({ open: true, message });
  };

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }

    const loadShiftData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [shiftRes, interestsRes, rejectionsRes] = await Promise.all([
          apiClient.get(API_ENDPOINTS.getWorkerShiftDetail(id)),
          apiClient.get(`${API_ENDPOINTS.getShiftInterests}?user=${user.id}`),
          apiClient.get(`${API_ENDPOINTS.getShiftRejections}?user=${user.id}`),
        ]);

        setShift(shiftRes.data);

        const interests: Interest[] = interestsRes.data.results || interestsRes.data;
        setInterestedSlots(interests.map(i => i.slot).filter((sid): sid is number => sid !== null));
        setInterestedShifts(interests.filter(i => i.slot === null).map(i => i.shift));

        const rejections: Rejection[] = rejectionsRes.data.results || rejectionsRes.data;
        setRejectedSlots(rejections.map(r => r.slot).filter((sid): sid is number => sid !== null));
        setRejectedShifts(rejections.filter(r => r.slot === null).map(r => r.shift));

      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load shift details. It may not exist or is no longer available.");
        console.error("Failed to load shift:", err);
      } finally {
        setLoading(false);
      }
    };

    loadShiftData();
  }, [id, user]);

  const handleExpressInterest = async (shiftId: number, slotId: number | null) => {
    if (!shift) return;

    // Immediately update UI for responsiveness
    if (slotId === null) {
      setInterestedShifts(prev => [...prev, shiftId]);
      setRejectedShifts(prev => prev.filter(sid => sid !== shiftId));
      if (!shift.single_user_only) {
        const slotIds = shift.slots.map(s => s.id);
        setInterestedSlots(prev => [...prev, ...slotIds]);
        setRejectedSlots(prev => prev.filter(sid => !slotIds.includes(sid)));
      }
    } else {
      setInterestedSlots(prev => [...prev, slotId]);
      setRejectedSlots(prev => prev.filter(sid => sid !== slotId));
    }

    try {
      await apiClient.post(API_ENDPOINTS.expressInterestInShift(shiftId), { slot_id: slotId });
      showSnackbar("Interest expressed successfully!");
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || "An error occurred.");
      // Revert UI changes on error
      if (slotId === null) {
          setInterestedShifts(prev => prev.filter(sid => sid !== shiftId));
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
        if (!shift.single_user_only) {
            const slotIds = shift.slots.map(s => s.id);
            setRejectedSlots(prev => [...prev, ...slotIds]);
            setInterestedSlots(prev => prev.filter(sid => !slotIds.includes(sid)));
        }
    } else {
        setRejectedSlots(prev => [...prev, slotId]);
        setInterestedSlots(prev => prev.filter(sid => sid !== slotId));
    }

    try {
        await apiClient.post(`${API_ENDPOINTS.getWorkerShiftDetail(shiftId)}reject/`, { slot_id: slotId });
        showSnackbar("Shift has been rejected.");
    } catch (err: any) {
        showSnackbar(err.response?.data?.detail || "An error occurred while rejecting.");
        // Revert UI
        if (slotId === null) {
            setRejectedShifts(prev => prev.filter(sid => sid !== shiftId));
        } else {
            setRejectedSlots(prev => prev.filter(sid => sid !== slotId));
        }
    }
  };

  const getSlotStatus = useCallback((shiftId: number, slotId: number) => {
    if (shift?.slot_assignments.some(a => a.slot_id === slotId)) return 'Assigned';
    if (rejectedSlots.includes(slotId) || rejectedShifts.includes(shiftId)) return 'Rejected';
    if (interestedSlots.includes(slotId) || interestedShifts.includes(shiftId)) return 'Requested';
    return 'None';
  }, [interestedSlots, interestedShifts, rejectedSlots, rejectedShifts, shift?.slot_assignments]);

  const getShiftStatus = useCallback((shiftId: number) => {
    if (rejectedShifts.includes(shiftId)) return 'Rejected';
    if (interestedShifts.includes(shiftId)) return 'Requested';
    if (shift && shift.slots.length > 0 && shift.slots.every(s => getSlotStatus(shiftId, s.id) !== 'None')) {
        return 'Completed'; // All slots handled individually
    }
    return 'None';
  }, [interestedShifts, rejectedShifts, getSlotStatus, shift]);


  const formatSlotDate = (slot: Slot) => {
    const dateStr = new Date(slot.date).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
    const start = new Date(`1970-01-01T${slot.start_time}`).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const end = new Date(`1970-01-01T${slot.end_time}`).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    let base = `${dateStr} from ${start} to ${end}`;
    if (slot.is_recurring && slot.recurring_days.length && slot.recurring_end_date) {
        const days = slot.recurring_days.map(d => WEEKDAY_LABELS[d]).join(', ');
        base += ` (Repeats on ${days} until ${new Date(slot.recurring_end_date).toLocaleDateString()})`;
    }
    return base;
  }

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Skeleton variant="text" width="40%" height={40} />
        <Card sx={{ mt: 2 }}>
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
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
    );
  }

  const pharm = shift.pharmacy_detail;
  const shiftStatus = getShiftStatus(shift.id);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shift Details
      </Typography>

      <Card>
        <CardContent>
          {/* Flexbox Header - Replaces Grid */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5">{pharm.name}</Typography>
                <Typography variant="body1" color="text.secondary">
                    {[pharm.street_address, pharm.suburb, pharm.state, pharm.postcode]
                      .filter(Boolean)
                      .join(', ')}    
                </Typography>
            </Box>
            <Box>
                <Chip label={shift.role_needed} color="primary" />
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

            <Typography><strong>Employment Type:</strong> {shift.employment_type.replace('_', ' ')}</Typography>
            {shift.rate_type === 'FIXED' && (
                <Typography><strong>Rate:</strong> ${shift.fixed_rate}/hr</Typography>
            )}
            {shift.rate_type === 'FLEXIBLE' && (
                <Typography><strong>Rate:</strong> Flexible</Typography>
            )}
             {shift.owner_adjusted_rate && (
                <Typography sx={{ color: green[600], fontWeight: 'bold' }}>
                    💰 Bonus: +${shift.owner_adjusted_rate}/hr on top of Award Rate
                </Typography>
            )}
          </Box>


          <Typography variant="h6" gutterBottom>Time Slot(s)</Typography>
            {shift.slots.map(slot => {
                const slotStatus = getSlotStatus(shift.id, slot.id);
                return (
                    <Box key={slot.id} display="flex" alignItems="center" justifyContent="space-between" p={1} my={0.5} sx={{ border: '1px solid #eee', borderRadius: 1, flexWrap: 'wrap', gap: 1}}>
                        <Typography>{formatSlotDate(slot)}</Typography>
                        {!shift.single_user_only && (
                            <Box>
                                {slotStatus === 'None' ? (
                                    <>
                                        <Button size="small" variant="contained" onClick={() => handleExpressInterest(shift.id, slot.id)}>Accept</Button>
                                        <Button size="small" variant="outlined" color="error" sx={{ml: 1}} onClick={() => handleReject(shift.id, slot.id)}>Decline</Button>
                                    </>
                                ) : <Chip label={slotStatus} color={slotStatus === 'Requested' ? 'success' : slotStatus === 'Rejected' ? 'error' : 'default'} size="small"/>}
                            </Box>
                        )}
                    </Box>
                )
            })}

            {shift.single_user_only && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                    {shiftStatus === 'None' ? (
                        <>
                            <Button variant="contained" onClick={() => handleExpressInterest(shift.id, null)}>Express Interest in Shift</Button>
                            <Button variant="outlined" color="error" sx={{ml: 1}} onClick={() => handleReject(shift.id, null)}>Reject Shift</Button>
                        </>
                    ) : <Chip label={shiftStatus} color={shiftStatus === 'Requested' ? 'success' : 'error'} />}
                </Box>
            )}
             {!shift.single_user_only && shift.slots.length > 1 && (
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


          {shift.workload_tags.length > 0 && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Workload Tags</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {shift.workload_tags.map(tag => <Chip key={tag} label={tag} />)}
              </Box>
            </Box>
          )}

          {shift.must_have.length > 0 && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Must-Have Skills</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {shift.must_have.map(skill => <Chip key={skill} label={skill} color="primary" variant="filled" />)}
              </Box>
            </Box>
          )}

          {shift.nice_to_have.length > 0 && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Nice-to-Have Skills</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {shift.nice_to_have.map(skill => <Chip key={skill} label={skill} />)}
              </Box>
            </Box>
          )}

            <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Typography variant="caption" color="textSecondary">
                Posted {formatDistanceToNow(new Date(shift.created_at), { addSuffix: true })}
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