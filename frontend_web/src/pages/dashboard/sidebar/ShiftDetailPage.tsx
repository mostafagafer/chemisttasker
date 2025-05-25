import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Chip,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ShiftDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const auth = useAuth();
  const user = auth?.user!;
//   const navigate = useNavigate();

  const [shift, setShift] = useState<any>(null);
  const [interests, setInterests] = useState<any[]>([]);
  const [userInterests, setUserInterests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<any>(null);
  const [currentInterest, setCurrentInterest] = useState<any>(null);

  // Helper: get endpoint by shift type
  const getEndpoint = () => {
    switch (type) {
      case 'community':
        return API_ENDPOINTS.getCommunityShiftDetail(id!);
      case 'public':
        return API_ENDPOINTS.getPublicShiftDetail(id!);
      case 'active':
        return API_ENDPOINTS.getActiveShiftDetail(id!);
      case 'confirmed':
        return API_ENDPOINTS.getConfirmedShiftDetail(id!);
      // Add more as needed...
      default:
        throw new Error('Unknown shift type');
    }
  };

  // Helper: is owner/org admin?
  const isOwner = (shiftObj: any) => {
    // Adjust this check as per your data structure and roles
    return (
      shiftObj?.pharmacy_detail?.owner_id === user?.id ||
      user?.role === 'ORG_ADMIN' ||
      user?.role === 'OWNER'
    );
  };

  // Format slot for display
  const formatSlot = (slot: any) => {
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
    if (slot.is_recurring && slot.recurring_days?.length && slot.recurring_end_date) {
      const days = slot.recurring_days.map((d: number) => WEEKDAY_LABELS[d]).join(', ');
      base += ` (Repeats ${days} until ${new Date(slot.recurring_end_date).toLocaleDateString()})`;
    }
    return base;
  };

  // Snack helper
  const showSnackbar = (msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  };

  // Load shift details and interests
  useEffect(() => {
    if (!id || !type || !user) return;
    setLoading(true);
    apiClient.get(getEndpoint())
      .then(res => {
        setShift(res.data);
        if (isOwner(res.data)) {
          apiClient.get(API_ENDPOINTS.getShiftInterests, { params: { shift: id } })
            .then(intRes => setInterests(Array.isArray(intRes.data.results) ? intRes.data.results : intRes.data));
        } else {
          apiClient.get(API_ENDPOINTS.getShiftInterests, { params: { shift: id, user: user.id } })
            .then(intRes => setUserInterests(Array.isArray(intRes.data.results) ? intRes.data.results : intRes.data));
        }
      })
      .catch(() => showSnackbar('Failed to load shift'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [id, type, user?.id]);

  // Owner: reveal
  const openReview = (interest: any) => {
    apiClient.post(
      `${getEndpoint()}/reveal_profile/`,
      { slot_id: interest.slot_id, user_id: interest.user_id }
    )
      .then(res => {
        setDialogData(res.data);
        setCurrentInterest(interest);
        setDialogOpen(true);
      })
      .catch(() => showSnackbar('Failed to fetch candidate details'));
  };

  // Owner: accept
  const handleAccept = () => {
    if (!currentInterest) return;
    apiClient.post(
      `${getEndpoint()}/accept_user/`,
      { slot_id: currentInterest.slot_id, user_id: currentInterest.user_id }
    )
      .then(() => {
        showSnackbar('User assigned');
        setDialogOpen(false);
        // Refresh owner interests
        apiClient.get(API_ENDPOINTS.getShiftInterests, { params: { shift: id } })
          .then(intRes => setInterests(Array.isArray(intRes.data.results) ? intRes.data.results : intRes.data));
      })
      .catch(() => showSnackbar('Accept failed'));
  };

  // Candidate: express interest
  const handleExpressInterest = (slotId: number | null) => {
    apiClient.post(
      `${getEndpoint()}/express_interest/`,
      slotId ? { slot_id: slotId } : {}
    )
      .then(() => {
        showSnackbar('Interest expressed!');
        apiClient.get(API_ENDPOINTS.getShiftInterests, { params: { shift: id, user: user.id } })
          .then(intRes => setUserInterests(Array.isArray(intRes.data.results) ? intRes.data.results : intRes.data));
      })
      .catch(() => showSnackbar('Failed to express interest'));
  };

  // Checks if user already interested
  const isUserInterestedInSlot = (slotId: number | null) => {
    if (!userInterests.length) return false;
    if (userInterests.some((i: any) => i.slot_id === null)) return true; // shift-level interest
    if (slotId && userInterests.some((i: any) => i.slot_id === slotId)) return true;
    return false;
  };

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!shift) return null;

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shift Detail
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6">{shift.pharmacy_detail?.name ?? 'Unknown Pharmacy'}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" color="textSecondary">
            {shift.pharmacy_detail?.state ? `${shift.pharmacy_detail.state} | ` : ''}
            {shift.pharmacy_detail?.address}
          </Typography>
          <Box sx={{ mt: 4 }}>
            <Typography variant="body1">
              <strong>Rate:</strong> {shift.rate_type === 'FIXED'
                ? `Fixed – ${shift.fixed_rate} AUD/hr`
                : shift.rate_type === 'FLEXIBLE'
                  ? 'Flexible'
                  : shift.rate_type === 'PHARMACIST_PROVIDED'
                    ? 'Pharmacist Provided'
                    : 'N/A'}
            </Typography>
            {shift.owner_adjusted_rate && (
              <Typography
                variant="body1"
                sx={{ color: 'green', fontWeight: 'bold', mt: shift.rate_type ? 1 : 0 }}
              >
                💰 Bonus: +{shift.owner_adjusted_rate} AUD/hr on top of Award Rate
              </Typography>
            )}
          </Box>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body1">
              <strong>Emp. Type:</strong> {shift.employment_type.replace('_', ' ')}
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Time Slots</Typography>
            {shift.slots.map((slot: any) => (
              <Box key={slot.id} display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="body1">{formatSlot(slot)}</Typography>
                {!isOwner(shift) && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={isUserInterestedInSlot(slot.id)}
                    onClick={() => handleExpressInterest(slot.id)}
                  >
                    {isUserInterestedInSlot(slot.id) ? 'Requested' : 'Express Interest'}
                  </Button>
                )}
              </Box>
            ))}
            {/* Multi-slot: allow shift-level interest */}
            {!isOwner(shift) && shift.slots.length > 1 && (
              <Box display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={isUserInterestedInSlot(null)}
                  onClick={() => handleExpressInterest(null)}
                >
                  {isUserInterestedInSlot(null) ? 'Requested All' : 'Express Interest in All Slots'}
                </Button>
              </Box>
            )}
          </Box>
          {shift.workload_tags?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Workload Tags</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {shift.workload_tags.map((tag: string) => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>
            </Box>
          )}
          {shift.must_have?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Must-Have</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {shift.must_have.map((skill: string) => (
                  <Chip key={skill} label={skill} color="primary" size="small" />
                ))}
              </Box>
            </Box>
          )}
          {shift.nice_to_have?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Nice-to-Have</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {shift.nice_to_have.map((skill: string) => (
                  <Chip key={skill} label={skill} color="default" size="small" />
                ))}
              </Box>
            </Box>
          )}
          {/* --- Owner-Only Section: List interests and reveal/accept buttons --- */}
          {isOwner(shift) && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2">Interested Candidates</Typography>
              {interests.length === 0 ? (
                <Typography>No one has shown interest yet.</Typography>
              ) : (
                <List dense>
                  {interests.map(interest => (
                    <ListItem key={interest.id}>
                      <ListItemText primary={`Candidate ID: ${interest.user_id} | Slot: ${interest.slot_id ?? 'All'}`} />
                      <Button
                        onClick={() => openReview(interest)}
                        variant="outlined"
                      >
                        Reveal Profile
                      </Button>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
      {/* Owner: Candidate dialog for reveal/accept */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Candidate Details</DialogTitle>
        <DialogContent>
          {dialogData && (
            <Box>
              <Typography>
                <strong>Name:</strong> {dialogData.first_name} {dialogData.last_name}
              </Typography>
              <Typography><strong>Email:</strong> {dialogData.email}</Typography>
              <Typography><strong>Phone:</strong> {dialogData.phone_number}</Typography>
              {dialogData.short_bio && <Typography><strong>Bio:</strong> {dialogData.short_bio}</Typography>}
              {dialogData.resume && (
                <Button href={dialogData.resume} target="_blank">Download CV</Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAccept}>Accept</Button>
        </DialogActions>
      </Dialog>
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
