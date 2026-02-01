// src/pages/dashboard/sidebar/SetAvailabilityPage.tsx

import { useState, useEffect, useMemo, useRef } from 'react';
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  UserAvailability,
  UserAvailabilityPayload,
  fetchUserAvailabilityService,
  createUserAvailabilityService,
  deleteUserAvailabilityService,
  getOnboarding,
} from '@chemisttasker/shared-core';
import { useAuth } from '../../../contexts/AuthContext';
import { API_BASE_URL } from '../../../constants/api';
import { GoogleMap, Marker, Circle, Autocomplete, useJsApiLoader } from '@react-google-maps/api';

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
  const { user, token } = useAuth();
  const [availabilityEntries, setAvailabilityEntries] = useState<UserAvailability[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Omit<UserAvailability, 'id'>>(createEmptyEntry());
  const [loading, setLoading] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({
    streetAddress: '',
    suburb: '',
    state: '',
    postcode: '',
    openToTravel: false,
    latitude: null as number | null,
    longitude: null as number | null,
    googlePlaceId: '',
    coverageRadiusKm: 30,
  });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

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
  const radiusOptions = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 500, 1000];
  const mapCenter = useMemo(() => {
    if (locationForm.latitude != null && locationForm.longitude != null) {
      return { lat: locationForm.latitude, lng: locationForm.longitude };
    }
    return { lat: -37.8136, lng: 144.9631 }; // Melbourne fallback
  }, [locationForm.latitude, locationForm.longitude]);

  const { isLoaded: isMapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_Maps_API_KEY || '',
    libraries: ['places'],
  });

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

  const onboardingRole = useMemo(() => {
    if (!user?.role) return null;
    if (user.role === 'PHARMACIST') return 'pharmacist';
    if (user.role === 'OTHER_STAFF') return 'other_staff';
    if (user.role === 'EXPLORER') return 'explorer';
    return null;
  }, [user?.role]);

  useEffect(() => {
    const fetchLocation = async () => {
      if (!onboardingRole) return;
      try {
        const onboarding: any = await getOnboarding(onboardingRole);
        setLocationForm({
          streetAddress: onboarding?.street_address || '',
          suburb: onboarding?.suburb || '',
          state: onboarding?.state || '',
          postcode: onboarding?.postcode || '',
          openToTravel: Boolean(onboarding?.open_to_travel),
          latitude: onboarding?.latitude ? Number(onboarding.latitude) : null,
          longitude: onboarding?.longitude ? Number(onboarding.longitude) : null,
          googlePlaceId: onboarding?.google_place_id || '',
          coverageRadiusKm: onboarding?.coverage_radius_km || 30,
        });
      } catch {
        showSnackbar('Failed to load location from onboarding', 'error');
      }
    };
    fetchLocation();
  }, [onboardingRole]);

  const showSnackbar = (msg: string, severity: 'success' | 'error') => {
    setSnackbarMsg(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  const handleCloseSnackbar = () => setSnackbarOpen(false);

  const handlePlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const components = place.address_components || [];

    const getComponent = (types: string[]) =>
      components.find((c) => types.every((t) => c.types.includes(t)))?.long_name || '';

    setLocationForm((prev) => ({
      ...prev,
      streetAddress: place.formatted_address || prev.streetAddress,
      suburb: getComponent(['locality']) || getComponent(['sublocality', 'sublocality_level_1']) || prev.suburb,
      state: getComponent(['administrative_area_level_1']) || prev.state,
      postcode: getComponent(['postal_code']) || prev.postcode,
      latitude: lat,
      longitude: lng,
      googlePlaceId: place.place_id || prev.googlePlaceId,
    }));
  };

  const handleSaveLocation = async () => {
    if (!onboardingRole) return;
    setSavingLocation(true);
    try {
      const safeRole = onboardingRole === 'other_staff' ? 'otherstaff' : onboardingRole;
      const form = new FormData();
      form.append('street_address', locationForm.streetAddress || '');
      form.append('suburb', locationForm.suburb || '');
      form.append('state', locationForm.state || '');
      form.append('postcode', locationForm.postcode || '');
      form.append('open_to_travel', locationForm.openToTravel ? 'true' : 'false');
      if (locationForm.latitude != null) form.append('latitude', String(locationForm.latitude));
      if (locationForm.longitude != null) form.append('longitude', String(locationForm.longitude));
      if (locationForm.googlePlaceId) form.append('google_place_id', locationForm.googlePlaceId);
      if (locationForm.coverageRadiusKm != null) {
        form.append('coverage_radius_km', String(locationForm.coverageRadiusKm));
      }

      const response = await fetch(`${API_BASE_URL}/client-profile/${safeRole}/onboarding/me/`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Failed to update location' }));
        throw new Error(err.detail || 'Failed to update location');
      }
      showSnackbar('Location updated', 'success');
    } catch {
      showSnackbar('Failed to update location', 'error');
    } finally {
      setSavingLocation(false);
    }
  };

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
          Location & Travel
        </Typography>
        <Box sx={{ display: 'grid', gap: 2 }}>
          {isMapsLoaded ? (
            <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={handlePlaceChanged}>
              <TextField
                label="Address"
                value={locationForm.streetAddress}
                onChange={(e) => setLocationForm({ ...locationForm, streetAddress: e.target.value })}
              />
            </Autocomplete>
          ) : (
            <TextField
              label="Address"
              value={locationForm.streetAddress}
              onChange={(e) => setLocationForm({ ...locationForm, streetAddress: e.target.value })}
            />
          )}
          <Box sx={{ height: 240, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'grey.200' }}>
            {isMapsLoaded && (
              <GoogleMap
                center={mapCenter}
                zoom={locationForm.coverageRadiusKm >= 75 ? 9 : locationForm.coverageRadiusKm >= 40 ? 10 : 11}
                mapContainerStyle={{ width: '100%', height: '100%' }}
                options={{ disableDefaultUI: true, zoomControl: true }}
              >
                {locationForm.latitude != null && locationForm.longitude != null && (
                  <>
                    <Marker position={mapCenter} />
                    <Circle
                      center={mapCenter}
                      radius={locationForm.coverageRadiusKm * 1000}
                      options={{
                        fillColor: '#4caf50',
                        fillOpacity: 0.2,
                        strokeColor: '#4caf50',
                        strokeOpacity: 0.6,
                        strokeWeight: 2,
                      }}
                    />
                  </>
                )}
              </GoogleMap>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Suburb"
              value={locationForm.suburb}
              onChange={(e) => setLocationForm({ ...locationForm, suburb: e.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              label="State"
              value={locationForm.state}
              onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Postcode"
              value={locationForm.postcode}
              onChange={(e) => setLocationForm({ ...locationForm, postcode: e.target.value })}
              sx={{ flex: 1 }}
            />
          </Box>
          <FormControl fullWidth>
            <InputLabel>Work Travel Radius</InputLabel>
            <Select
              label="Work Travel Radius"
              value={locationForm.coverageRadiusKm}
              onChange={(e) => setLocationForm({ ...locationForm, coverageRadiusKm: Number(e.target.value) })}
            >
              {radiusOptions.map((km) => (
                <MenuItem key={km} value={km}>{km} km</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={locationForm.openToTravel}
                onChange={(e) => setLocationForm({ ...locationForm, openToTravel: e.target.checked })}
              />
            }
            label="Willing to travel/Regional"
          />
          <Button variant="contained" onClick={handleSaveLocation} disabled={savingLocation || !onboardingRole}>
            {savingLocation ? 'Saving...' : 'Save Location'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Add dates
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
