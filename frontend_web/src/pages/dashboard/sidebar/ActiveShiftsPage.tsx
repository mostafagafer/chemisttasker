// src/pages/dashboard/owner/shifts/ActiveShiftsPage.tsx

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Snackbar,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
}

interface Shift {
  id: number;
  single_user_only: boolean;
  visibility: string;
  pharmacy_detail: { name: string };
  role_needed: string;
  slots: Slot[];
}

interface Interest {
  id: number;
  user_id: number;
  slot_id: number | null;
  slot_time: string;
  revealed: boolean;
}

interface RatePreference {
  weekday: string;
  saturday: string;
  sunday: string;
  public_holiday: string;
  early_morning: string;
  late_night: string;
}

interface UserDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  short_bio?: string;
  resume?: string;
  rate_preference?: RatePreference | null; // <-- ADD THIS LINE

}

export default function ActiveShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expandedShift, setExpandedShift] = useState<number | false>(false);
  const [interestsMap, setInterestsMap] = useState<Record<number, Interest[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<UserDetail | null>(null);
  const [currentInterest, setCurrentInterest] = useState<Interest | null>(null);
  const [currentShiftId, setCurrentShiftId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: ''
  });

  // 1) load active shifts
  useEffect(() => {
    apiClient.get<Shift[]>(API_ENDPOINTS.getActiveShifts)
      .then(res => setShifts(res.data))
      .catch(() => setSnackbar({ open: true, message: 'Failed to load active shifts' }));
  }, []);

  // 2) load interests for one shift
  const loadInterests = (shiftId: number) => {
    setLoadingMap(m => ({ ...m, [shiftId]: true }));
    apiClient.get(API_ENDPOINTS.getShiftInterests, { params: { shift: shiftId } })
      .then(res => {
        const data: Interest[] = Array.isArray(res.data.results)
          ? res.data.results
          : Array.isArray(res.data)
            ? res.data
            : [];
        setInterestsMap(m => ({ ...m, [shiftId]: data }));
      })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load interests' }))
      .finally(() => setLoadingMap(m => ({ ...m, [shiftId]: false })));
  };

  // 3) expand / collapse
  const handleAccordionChange = (shiftId: number) => (_: any, expanded: boolean) => {
    setExpandedShift(expanded ? shiftId : false);
    if (expanded && !interestsMap[shiftId]) loadInterests(shiftId);
  };

  // 4) reveal / review
  const openReview = (shiftId: number, interest: Interest) => {
    apiClient.post(
      `${API_ENDPOINTS.getActiveShifts}${shiftId}/reveal_profile/`,
      { slot_id: interest.slot_id, user_id: interest.user_id }
    )
    .then(res => {
      setDialogData(res.data);
      setCurrentInterest(interest);
      setCurrentShiftId(shiftId);
      // persist revealed locally
      setInterestsMap(m => ({
        ...m,
        [shiftId]: m[shiftId].map(i =>
          i.id === interest.id ? { ...i, revealed: true } : i
        )
      }));
      setDialogOpen(true);
    })
    .catch(() => setSnackbar({ open: true, message: 'Failed to fetch candidate details' }));
  };

  // 5) accept
  const handleAccept = () => {
    if (currentShiftId == null || !currentInterest) return;
    apiClient.post(
      `${API_ENDPOINTS.getActiveShifts}${currentShiftId}/accept_user/`,
      { slot_id: currentInterest.slot_id, user_id: currentInterest.user_id }
    )
    .then(() => {
      setSnackbar({ open: true, message: 'User assigned' });
      // remove confirmed slot or whole shift
      setShifts(old =>
        old.flatMap(shift => {
          if (shift.id !== currentShiftId) return [shift];
          if (shift.single_user_only || shift.slots.length === 1) {
            // drop entire shift
            return [];
          }
          // drop only that slot
          return [{
            ...shift,
            slots: shift.slots.filter(s => s.id !== currentInterest.slot_id)
          }];
        })
      );
      // cleanup interestsMap
      setInterestsMap(m => {
        const next = { ...m };
        const arr = next[currentShiftId] || [];
        // if shift-level or single-slot, remove entirely
        if (arr.some(i => i.slot_id == null) || (shifts.find(s => s.id === currentShiftId)?.slots.length === 1)) {
          delete next[currentShiftId];
        } else {
          next[currentShiftId] = arr.filter(i => i.slot_id !== currentInterest.slot_id);
        }
        return next;
      });
    })
    .catch(() => setSnackbar({ open: true, message: 'Accept failed' }))
    .finally(() => setDialogOpen(false));
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Active Shifts</Typography>

      {shifts.map(shift => {
  const interests = interestsMap[shift.id] || [];
  const loading   = loadingMap[shift.id] || false;

  // split out shift‐level vs per‐slot interests
  const shiftLevel = interests.filter(i => i.slot_id == null);
  const perSlot    = interests.filter(i => i.slot_id != null);

  return (
    <Accordion
      key={shift.id}
      expanded={expandedShift === shift.id}
      onChange={handleAccordionChange(shift.id)}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ width: '100%' }}>
          <Typography variant="h6">{shift.pharmacy_detail.name}</Typography>
          <Typography variant="body2">Role: {shift.role_needed}</Typography>
          <Typography variant="body2">Visibility: {shift.visibility}</Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        {loading ? (
          <CircularProgress size={24} />
        ) : interests.length === 0 ? (
          // 0) no interests at all
          <Typography>No one has shown interest yet.</Typography>

        ) : shift.single_user_only ? (
          // 1) SINGLE-USER-ONLY MODE
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Time Slots:</Typography>
              {shift.slots.map(slot => (
                <Typography key={slot.id} variant="body2">
                  {slot.date} {slot.start_time}–{slot.end_time}
                </Typography>
              ))}
            </Box>

            {shiftLevel.length === 0 ? (
              <Typography>No one has shown interest in your shift yet.</Typography>
            ) : (
              <List dense>
                {shiftLevel.map(i => (
                  <ListItem key={i.id}>
                    <ListItemText primary="Someone shows interest in your shift" />
                    <Button
                      onClick={() => openReview(shift.id, i)}
                      variant="outlined"
                    >
                      {i.revealed ? 'Review Candidate' : 'Reveal Candidate'}
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </>

        ) : shift.slots.length === 1 ? (
          // 2) SINGLE-SLOT (multi-user) MODE
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Time Slot:</Typography>
              <Typography variant="body2">
                {shift.slots[0].date} {shift.slots[0].start_time}–{shift.slots[0].end_time}
              </Typography>
            </Box>

            {perSlot.length === 0 ? (
              <Typography>No one has shown interest in this slot yet.</Typography>
            ) : (
              <List dense>
                {perSlot.map(i => (
                  <ListItem key={i.id}>
                    <ListItemText primary="Someone shows interest" />
                    <Button
                      onClick={() => openReview(shift.id, i)}
                      variant="outlined"
                    >
                      {i.revealed ? 'Review Candidate' : 'Reveal Candidate'}
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </>

        ) : (
          // 3) MULTI-SLOT MODE
          <>
            {shift.slots.map(slot => {
              const slotInt = interests.filter(i => i.slot_id === slot.id);
              return (
                <Box key={slot.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    Slot: {slot.date} {slot.start_time}–{slot.end_time}
                  </Typography>
                  {slotInt.length === 0 ? (
                    <Typography>No one has shown interest in this slot.</Typography>
                  ) : (
                    <List dense>
                      {slotInt.map(i => (
                        <ListItem key={i.id}>
                          <ListItemText primary="Someone shows interest" />
                          <Button
                            onClick={() => openReview(shift.id, i)}
                            variant="outlined"
                          >
                            {i.revealed ? 'Review Candidate' : 'Reveal Candidate'}
                          </Button>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              );
            })}

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Interest in all slots:</Typography>
              {shiftLevel.length === 0 ? (
                <Typography>No one has shown interest in all slots yet.</Typography>
              ) : (
                <List dense>
                  {shiftLevel.map(i => (
                    <ListItem key={i.id}>
                      <ListItemText primary="Someone shows interest in all slots" />
                      <Button
                        onClick={() => openReview(shift.id, i)}
                        variant="outlined"
                      >
                        {i.revealed ? 'Review Candidate' : 'Reveal Candidate'}
                      </Button>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
})}


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
              {dialogData.rate_preference && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Rate Preference</strong>
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Weekday" secondary={dialogData.rate_preference.weekday || "N/A"} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Saturday" secondary={dialogData.rate_preference.saturday || "N/A"} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Sunday" secondary={dialogData.rate_preference.sunday || "N/A"} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Public Holiday" secondary={dialogData.rate_preference.public_holiday || "N/A"} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Early Morning" secondary={dialogData.rate_preference.early_morning || "N/A"} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Late Night" secondary={dialogData.rate_preference.late_night || "N/A"} />
                  </ListItem>
                </List>
              </Box>
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
        open={snackbar.open}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        message={snackbar.message}
        autoHideDuration={4000}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbar(s => ({ ...s, open: false }))}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
}
