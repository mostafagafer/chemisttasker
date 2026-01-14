// src/pages/dashboard/sidebar/SetAvailabilityPage.tsx

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  IconButton,
  Typography,
  Container,
  Paper,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  UserAvailability,
  UserAvailabilityPayload,
  fetchUserAvailabilityService,
  createUserAvailabilityService,
  deleteUserAvailabilityService,
} from '@chemisttasker/shared-core';

const createEmptyEntry = (): Omit<UserAvailability, 'id'> => ({
  date: '',
  startTime: '09:00',
  endTime: '17:00',
  isAllDay: false,
  isRecurring: false,
  recurringDays: [],
  recurringEndDate: '',
  notes: '',
});

export default function SetAvailabilityPage() {
  const [availabilityEntries, setAvailabilityEntries] = useState<UserAvailability[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Omit<UserAvailability, 'id'>>(createEmptyEntry());
  const [loading, setLoading] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  // Load existing slots
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const entries = await fetchUserAvailabilityService();
        setAvailabilityEntries(entries);
      } catch {
        showSnackbar('Failed to load availability', 'error');
      }
    };

    fetchAvailability();
  }, []);

  const showSnackbar = (msg: string, severity: 'success' | 'error') => {
    setSnackbarMsg(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  const handleCloseSnackbar = () => setSnackbarOpen(false);

  const validateTimeRange = (start: string, end: string) =>
    new Date(`2025-01-01T${end}`) > new Date(`2025-01-01T${start}`);

  const handleAddEntry = async () => {
    if (!currentEntry.date) return showSnackbar('Please select a date', 'error');
    if (!currentEntry.startTime || !currentEntry.endTime)
      return showSnackbar('Please set start and end times', 'error');
    if (!validateTimeRange(currentEntry.startTime, currentEntry.endTime))
      return showSnackbar('End must be after start', 'error');
    if (currentEntry.isRecurring) {
      if (!currentEntry.recurringDays.length)
        return showSnackbar('Select days for repeat', 'error');
      if (!currentEntry.recurringEndDate)
        return showSnackbar('Set an end date for repeat', 'error');
      if (new Date(currentEntry.recurringEndDate) < new Date(currentEntry.date))
        return showSnackbar('Repeat end must be after date', 'error');
    }

    setLoading(true);
    try {
      const payload: UserAvailabilityPayload = {
        date: currentEntry.date,
        start_time: currentEntry.startTime,
        end_time: currentEntry.endTime,
        is_all_day: currentEntry.isAllDay,
        is_recurring: currentEntry.isRecurring,
        recurring_days: currentEntry.isRecurring ? currentEntry.recurringDays : [],
        recurring_end_date: currentEntry.isRecurring ? currentEntry.recurringEndDate || null : null,
        notes: currentEntry.notes,
      };
      const createdEntry = await createUserAvailabilityService(payload);
      setAvailabilityEntries(prev => [...prev, createdEntry]);
      setCurrentEntry(createEmptyEntry());
      showSnackbar('Time slot added', 'success');
    } catch {
      showSnackbar('Failed to save slot', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    try {
      await deleteUserAvailabilityService(id);
      setAvailabilityEntries(prev => prev.filter(e => e.id !== id));
      showSnackbar('Slot deleted', 'success');
    } catch {
      showSnackbar('Failed to delete slot', 'error');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Set Your Availability
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          New Time Slot
        </Typography>
        <Box component="form" noValidate autoComplete="off" sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            value={currentEntry.date}
            onChange={e => setCurrentEntry({ ...currentEntry, date: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={currentEntry.isAllDay}
                onChange={e =>
                  setCurrentEntry({
                    ...currentEntry,
                    isAllDay: e.target.checked,
                    startTime: e.target.checked ? '00:00' : '09:00',
                    endTime: e.target.checked ? '23:59' : '17:00',
                  })
                }
              />
            }
            label="All Day"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Time"
              type="time"
              disabled={currentEntry.isAllDay}
              value={currentEntry.startTime}
              onChange={e => setCurrentEntry({ ...currentEntry, startTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="End Time"
              type="time"
              disabled={currentEntry.isAllDay}
              value={currentEntry.endTime}
              onChange={e => setCurrentEntry({ ...currentEntry, endTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={currentEntry.isRecurring}
                onChange={e =>
                  setCurrentEntry({
                    ...currentEntry,
                    isRecurring: e.target.checked,
                    recurringDays: [],
                    recurringEndDate: '',
                  })
                }
              />
            }
            label="Repeat Weekly"
          />
          {currentEntry.isRecurring && (
            <>
              <TextField
                label="Repeat Until"
                type="date"
                value={currentEntry.recurringEndDate}
                onChange={e => setCurrentEntry({ ...currentEntry, recurringEndDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <ToggleButtonGroup
                value={currentEntry.recurringDays}
                onChange={(_, days) =>
                  setCurrentEntry({ ...currentEntry, recurringDays: days as number[] })
                }
                aria-label="weekday selection"
              >
                {weekDays.map(d => (
                  <ToggleButton key={d.value} value={d.value} aria-label={d.label}>
                    {d.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </>
          )}
          <TextField
            label="Notes"
            multiline
            rows={3}
            value={currentEntry.notes ?? ''}
            onChange={e => setCurrentEntry({ ...currentEntry, notes: e.target.value })}
          />
          <Button
            variant="contained"
            onClick={handleAddEntry}
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Time Slot'}
          </Button>
        </Box>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Your Time Slots
      </Typography>
      {availabilityEntries.length === 0 ? (
        <Typography>No time slots added yet.</Typography>
      ) : (
        availabilityEntries.map(e => (
          <Paper
            key={e.id}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              mb: 2,
            }}
          >
            <Box>
              <Typography>
                {e.date} - {e.isAllDay ? 'All Day' : `${e.startTime}-${e.endTime}`}
              </Typography>
              {e.isRecurring && (
                <Typography variant="caption">
                  Repeats on {e.recurringDays.map(d => weekDays[d].label).join(', ')} until{' '}
                  {e.recurringEndDate}
                </Typography>
              )}
              {e.notes && <Typography variant="body2">{e.notes}</Typography>}
            </Box>
            <Button
              color="error"
              onClick={() => handleDeleteEntry(e.id)}
            >
              Delete
            </Button>
          </Paper>
        ))
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
          action={
            <IconButton size="small" color="inherit" onClick={handleCloseSnackbar}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Container>
);
}  
