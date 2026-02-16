import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Checkbox,
  Chip,
  HelperText,
  IconButton,
  Menu,
  Snackbar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import {
  UserAvailability,
  UserAvailabilityPayload,
  fetchUserAvailabilityService,
  createUserAvailabilityService,
  deleteUserAvailabilityService,
  getOnboarding,
} from '@chemisttasker/shared-core';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL } from '@/constants/api';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Autocomplete as WebAutocomplete, Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

type AvailabilityEntry = UserAvailability & { notifyNewShifts?: boolean };
type AvailabilityDraft = Omit<AvailabilityEntry, 'id'>;
type AvailabilityPayload = UserAvailabilityPayload & { notify_new_shifts?: boolean };

const createEmptyEntry = (): AvailabilityDraft => ({
  date: '',
  startTime: '09:00',
  endTime: '17:00',
  isAllDay: false,
  isRecurring: false,
  recurringDays: [],
  recurringEndDate: '',
  notifyNewShifts: false,
  notes: '',
});

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
const stateOptions = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function SetAvailabilityScreen() {
  const { user, token } = useAuth();
  const [availabilityEntries, setAvailabilityEntries] = useState<AvailabilityEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<AvailabilityDraft>(createEmptyEntry());
  const [notifyNewShifts, setNotifyNewShifts] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [calendarMonthAnchor, setCalendarMonthAnchor] = useState<Date>(new Date());
  const [locationForm, setLocationForm] = useState({
    streetAddress: '',
    suburb: '',
    state: '',
    postcode: '',
    openToTravel: false,
    travelStates: [] as string[],
    latitude: null as number | null,
    longitude: null as number | null,
    googlePlaceId: '',
    coverageRadiusKm: 30,
  });
  const placesRef = useRef<any>(null);

  const [radiusMenuVisible, setRadiusMenuVisible] = useState(false);
  const [travelMenuVisible, setTravelMenuVisible] = useState(false);
  const [webAddressInput, setWebAddressInput] = useState('');
  const webAutocompleteRef = useRef<any>(null);
  const placesApiKey = useMemo(
    () => {
      const byPlatform = Platform.select({
        web: process.env.EXPO_PUBLIC_WEB_PLACES,
        ios: process.env.EXPO_PUBLIC_IOS_PLACES,
        android: process.env.EXPO_PUBLIC_ANDROID_PLACES,
      });
      return (byPlatform ||
        process.env.EXPO_PUBLIC_PLACES_KEY ||
        process.env.EXPO_PUBLIC_MAPS_API_KEY ||
        '') as string;
    },
    []
  );
  const mapCenter = useMemo(() => {
    if (locationForm.latitude != null && locationForm.longitude != null) {
      return { lat: locationForm.latitude, lng: locationForm.longitude };
    }
    return { lat: -37.8136, lng: 144.9631 };
  }, [locationForm.latitude, locationForm.longitude]);
  const { isLoaded: isPlacesLoaded, loadError: placesLoadError } = useJsApiLoader({
    id: 'availability-places',
    googleMapsApiKey: placesApiKey || '',
    libraries: ['places'],
  });

  useEffect(() => {
    setWebAddressInput(locationForm.streetAddress || '');
  }, [locationForm.streetAddress]);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const showSnackbar = (msg: string, severity: 'success' | 'error') => {
    setSnackbarMsg(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const markedDates = useMemo(() => {
    const dates = new Set<string>();
    selectedDates.forEach((d) => dates.add(d));
    const maxOccurrences = 180;
    availabilityEntries.forEach((entry) => {
      if (!entry.date) return;
      dates.add(entry.date);
      if (!entry.isRecurring || !entry.recurringEndDate) return;
      const days = Array.isArray(entry.recurringDays) ? entry.recurringDays : [];
      if (!days.length) return;
      let cursor = new Date(`${entry.date}T00:00:00`);
      const end = new Date(`${entry.recurringEndDate}T00:00:00`);
      let count = 0;
      while (cursor <= end) {
        if (days.includes(cursor.getDay())) {
          dates.add(toLocalIsoDate(cursor));
          count += 1;
          if (count >= maxOccurrences) break;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return dates;
  }, [availabilityEntries, selectedDates]);

  const monthCalendarCells = useMemo(() => {
    const year = calendarMonthAnchor.getFullYear();
    const month = calendarMonthAnchor.getMonth();
    const first = new Date(year, month, 1);
    const leading = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < leading; i += 1) cells.push({ iso: `pad-prev-${i}`, day: 0, inMonth: false });
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ iso: toLocalIsoDate(new Date(year, month, day)), day, inMonth: true });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: `pad-next-${cells.length}`, day: 0, inMonth: false });
    return cells;
  }, [calendarMonthAnchor]);

  const monthLabel = useMemo(
    () => calendarMonthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [calendarMonthAnchor]
  );

  const onboardingRole = useMemo(() => {
    if (!user?.role) return null;
    if (user.role === 'PHARMACIST') return 'pharmacist';
    if (user.role === 'OTHER_STAFF') return 'other_staff';
    if (user.role === 'EXPLORER') return 'explorer';
    return null;
  }, [user?.role]);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const entries = await fetchUserAvailabilityService();
        setAvailabilityEntries(entries as AvailabilityEntry[]);
      } catch {
        showSnackbar('Failed to load availability', 'error');
      }
    };
    void fetchAvailability();
  }, []);

  useEffect(() => {
    const fetchLocation = async () => {
      if (!onboardingRole) return;
      try {
        const onboarding: any = await getOnboarding(onboardingRole as any);
        setLocationForm({
          streetAddress: onboarding?.street_address || '',
          suburb: onboarding?.suburb || '',
          state: onboarding?.state || '',
          postcode: onboarding?.postcode || '',
          openToTravel: Boolean(onboarding?.open_to_travel),
          travelStates: Array.isArray(onboarding?.travel_states) ? onboarding.travel_states : [],
          latitude: onboarding?.latitude ? Number(onboarding.latitude) : null,
          longitude: onboarding?.longitude ? Number(onboarding.longitude) : null,
          googlePlaceId: onboarding?.google_place_id || '',
          coverageRadiusKm: onboarding?.coverage_radius_km || 30,
        });
      } catch {
        showSnackbar('Failed to load location from onboarding', 'error');
      }
    };
    void fetchLocation();
  }, [onboardingRole]);

  const handlePlaceSelect = (data: any, details: any) => {
    if (!details) return;
    const components = details.address_components || [];
    const getComponent = (type: string) => components.find((c: any) => c.types?.includes(type))?.long_name || '';

    setLocationForm((prev) => ({
      ...prev,
      streetAddress: details.formatted_address || prev.streetAddress,
      suburb: getComponent('locality') || getComponent('sublocality') || prev.suburb,
      state: getComponent('administrative_area_level_1') || prev.state,
      postcode: getComponent('postal_code') || prev.postcode,
      latitude: details.geometry?.location?.lat ?? prev.latitude,
      longitude: details.geometry?.location?.lng ?? prev.longitude,
      googlePlaceId: details.place_id || prev.googlePlaceId,
    }));
  };

  const handleWebPlaceChanged = () => {
    const place = webAutocompleteRef.current?.getPlace?.();
    if (!place) return;
    const components = place.address_components || [];
    const getLong = (type: string) => components.find((c: any) => c.types?.includes(type))?.long_name || '';
    const getShort = (type: string) => components.find((c: any) => c.types?.includes(type))?.short_name || '';
    const streetNumber = getLong('street_number');
    const route = getLong('route');
    const streetAddress = [streetNumber, route].filter(Boolean).join(' ').trim();
    setLocationForm((prev) => ({
      ...prev,
      streetAddress: streetAddress || place.formatted_address || prev.streetAddress,
      suburb: getLong('locality') || getLong('sublocality') || prev.suburb,
      state: getShort('administrative_area_level_1') || prev.state,
      postcode: getLong('postal_code') || prev.postcode,
      latitude: place.geometry?.location?.lat?.() ?? prev.latitude,
      longitude: place.geometry?.location?.lng?.() ?? prev.longitude,
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
      form.append('travel_states', JSON.stringify(locationForm.travelStates || []));
      if (locationForm.latitude != null) form.append('latitude', String(locationForm.latitude));
      if (locationForm.longitude != null) form.append('longitude', String(locationForm.longitude));
      if (locationForm.googlePlaceId) form.append('google_place_id', locationForm.googlePlaceId);
      form.append('coverage_radius_km', String(locationForm.coverageRadiusKm));

      const response = await fetch(`${API_BASE_URL}/client-profile/${safeRole}/onboarding/me/`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!response.ok) throw new Error('Failed to update location');
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
    const datesToAdd = currentEntry.isRecurring
      ? [currentEntry.date].filter(Boolean)
      : (selectedDates.length > 0 ? selectedDates : [currentEntry.date].filter(Boolean));

    if (!datesToAdd.length) return showSnackbar('Please select a date', 'error');
    if (!currentEntry.startTime || !currentEntry.endTime) return showSnackbar('Please set start and end times', 'error');
    if (!validateTimeRange(currentEntry.startTime, currentEntry.endTime)) return showSnackbar('End must be after start', 'error');
    if (currentEntry.isRecurring) {
      if (!currentEntry.recurringDays.length) return showSnackbar('Select days for repeat', 'error');
      if (!currentEntry.recurringEndDate) return showSnackbar('Set an end date for repeat', 'error');
      if (new Date(currentEntry.recurringEndDate) < new Date(currentEntry.date)) return showSnackbar('Repeat end must be after date', 'error');
    }

    setLoading(true);
    try {
      const payloads: AvailabilityPayload[] = datesToAdd.map((date) => ({
        date,
        start_time: currentEntry.startTime,
        end_time: currentEntry.endTime,
        is_all_day: currentEntry.isAllDay,
        is_recurring: currentEntry.isRecurring,
        recurring_days: currentEntry.isRecurring ? currentEntry.recurringDays : [],
        recurring_end_date: currentEntry.isRecurring ? currentEntry.recurringEndDate || null : null,
        notify_new_shifts: notifyNewShifts,
        notes: currentEntry.notes,
      }));

      const createdEntries = await Promise.all(payloads.map(createUserAvailabilityService));
      setAvailabilityEntries((prev) => [...prev, ...(createdEntries as AvailabilityEntry[])]);
      setCurrentEntry(createEmptyEntry());
      setSelectedDates([]);
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
      setAvailabilityEntries((prev) => prev.filter((e) => e.id !== id));
      showSnackbar('Slot deleted', 'success');
    } catch {
      showSnackbar('Failed to delete slot', 'error');
    }
  };

  const toggleRecurringDay = (day: number) => {
    setCurrentEntry((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day].sort(),
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>Set Your Availability</Text>

        <Surface style={styles.card} elevation={1}>
          <Text style={styles.sectionTitle}>Location & Travel</Text>

          <View style={{ minHeight: 56 }}>
            {Platform.OS !== 'web' && placesApiKey ? (
              <GooglePlacesAutocomplete
                ref={placesRef}
                fetchDetails
                placeholder="Address"
                query={{ key: placesApiKey, language: 'en', components: 'country:au' }}
                onPress={handlePlaceSelect}
                textInputProps={{
                  value: locationForm.streetAddress,
                  onChangeText: (text: string) => setLocationForm((p) => ({ ...p, streetAddress: text })),
                  placeholderTextColor: '#9CA3AF',
                }}
                styles={{
                  textInput: styles.placesInput,
                  listView: { zIndex: 2000 },
                }}
              />
            ) : Platform.OS === 'web' ? (
              !placesApiKey ? (
                <>
                  <TextInput
                    mode="outlined"
                    label="Address"
                    value={locationForm.streetAddress}
                    onChangeText={(v) => setLocationForm((p) => ({ ...p, streetAddress: v }))}
                  />
                  <HelperText type="info">Google Places key is missing for web.</HelperText>
                </>
              ) : !isPlacesLoaded ? (
                <TextInput mode="outlined" label="Address" value={webAddressInput} editable={false} />
              ) : placesLoadError ? (
                <>
                  <TextInput
                    mode="outlined"
                    label="Address"
                    value={locationForm.streetAddress}
                    onChangeText={(v) => setLocationForm((p) => ({ ...p, streetAddress: v }))}
                  />
                  <HelperText type="error">
                    Google Places failed to load. Check EXPO_PUBLIC_WEB_PLACES key and referrer restrictions.
                  </HelperText>
                </>
              ) : (
                <WebAutocomplete
                  onLoad={(ref) => {
                    webAutocompleteRef.current = ref;
                  }}
                  onPlaceChanged={handleWebPlaceChanged}
                  options={{
                    componentRestrictions: { country: 'au' },
                    fields: ['address_components', 'geometry', 'place_id', 'formatted_address', 'name'],
                  }}
                >
                  <input
                    value={webAddressInput}
                    onChange={(e) => {
                      const next = e.target.value;
                      setWebAddressInput(next);
                      setLocationForm((p) => ({ ...p, streetAddress: next }));
                    }}
                    placeholder="Address"
                    style={{
                      width: '100%',
                      height: 46,
                      border: '1px solid #D1D5DB',
                      borderRadius: 10,
                      padding: '0 12px',
                      fontSize: 16,
                      color: '#111827',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </WebAutocomplete>
              )
            ) : (
              <TextInput
                mode="outlined"
                label="Address"
                value={locationForm.streetAddress}
                onChangeText={(v) => setLocationForm((p) => ({ ...p, streetAddress: v }))}
              />
            )}
          </View>
          {Platform.OS === 'web' ? (
            <View style={styles.mapWrap}>
              {placesLoadError ? (
                <View style={styles.mapFallback}>
                  <Text style={styles.hint}>
                    Map failed to load. Check EXPO_PUBLIC_WEB_PLACES key and referrer restrictions.
                  </Text>
                </View>
              ) : isPlacesLoaded ? (
                <GoogleMap
                  center={mapCenter}
                  zoom={locationForm.coverageRadiusKm >= 75 ? 9 : locationForm.coverageRadiusKm >= 40 ? 10 : 11}
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  {locationForm.latitude != null && locationForm.longitude != null ? (
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
                  ) : null}
                </GoogleMap>
              ) : (
                <View style={styles.mapFallback}>
                  <Text style={styles.hint}>Loading map...</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.row2}>
            <TextInput mode="outlined" label="Suburb" value={locationForm.suburb} onChangeText={(v) => setLocationForm((p) => ({ ...p, suburb: v }))} style={styles.flex} />
            <TextInput mode="outlined" label="State" value={locationForm.state} onChangeText={(v) => setLocationForm((p) => ({ ...p, state: v }))} style={styles.flex} />
            <TextInput mode="outlined" label="Postcode" value={locationForm.postcode} onChangeText={(v) => setLocationForm((p) => ({ ...p, postcode: v }))} style={styles.flex} />
          </View>

          <Menu
            visible={radiusMenuVisible}
            onDismiss={() => setRadiusMenuVisible(false)}
            anchor={<Button mode="outlined" onPress={() => setRadiusMenuVisible(true)} disabled={locationForm.openToTravel}>{`Work Travel Radius: ${locationForm.coverageRadiusKm} km`}</Button>}
          >
            {radiusOptions.map((km) => (
              <Menu.Item
                key={km}
                title={`${km} km`}
                onPress={() => {
                  setLocationForm((p) => ({ ...p, coverageRadiusKm: km }));
                  setRadiusMenuVisible(false);
                }}
              />
            ))}
          </Menu>

          <View style={styles.checkboxRow}>
            <Checkbox
              status={locationForm.openToTravel ? 'checked' : 'unchecked'}
              onPress={() => setLocationForm((p) => ({ ...p, openToTravel: !p.openToTravel, travelStates: !p.openToTravel ? p.travelStates : [] }))}
            />
            <Text style={styles.rowText}>Willing to travel/Regional</Text>
          </View>

          {locationForm.openToTravel ? (
            <Menu
              visible={travelMenuVisible}
              onDismiss={() => setTravelMenuVisible(false)}
              anchor={<Button mode="outlined" onPress={() => setTravelMenuVisible(true)}>{`Travel States: ${locationForm.travelStates.join(', ') || 'Select'}`}</Button>}
            >
              {stateOptions.map((st) => {
                const selected = locationForm.travelStates.includes(st);
                return (
                  <Menu.Item
                    key={st}
                    title={`${selected ? '[x] ' : ''}${st}`}
                    onPress={() =>
                      setLocationForm((p) => ({
                        ...p,
                        travelStates: selected ? p.travelStates.filter((s) => s !== st) : [...p.travelStates, st],
                      }))
                    }
                  />
                );
              })}
            </Menu>
          ) : null}

          <Button mode="contained" onPress={handleSaveLocation} disabled={savingLocation || !onboardingRole} loading={savingLocation}>
            Save Location
          </Button>
        </Surface>

        <Surface style={styles.card} elevation={1}>
          <Text style={styles.sectionTitle}>Add dates</Text>
          <View style={styles.checkboxRow}>
            <Checkbox status={notifyNewShifts ? 'checked' : 'unchecked'} onPress={() => setNotifyNewShifts((v) => !v)} />
            <Text style={styles.rowText}>Notify me when new public shifts match my availability</Text>
          </View>

          <Surface style={styles.calendarPanel} elevation={0}>
            <View style={styles.calendarHeader}>
              <IconButton icon="chevron-left" size={18} onPress={() => setCalendarMonthAnchor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))} />
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <IconButton icon="chevron-right" size={18} onPress={() => setCalendarMonthAnchor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))} />
            </View>
            <View style={styles.calendarWeekHead}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <Text key={`${d}-${idx}`} style={styles.calendarWeekText}>{d}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {monthCalendarCells.map((cell, idx) => {
                if (!cell.inMonth) return <View key={`${cell.iso}-${idx}`} style={[styles.calendarCell, styles.calendarCellPad]} />;
                const isSelected = markedDates.has(cell.iso);
                return (
                  <TouchableOpacity
                    key={`${cell.iso}-${idx}`}
                    style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                    onPress={() => {
                      if (currentEntry.isRecurring) {
                        setCurrentEntry((prev) => ({ ...prev, date: cell.iso }));
                      } else {
                        setSelectedDates((prev) => (prev.includes(cell.iso) ? prev.filter((d) => d !== cell.iso) : [...prev, cell.iso].sort()));
                      }
                    }}
                  >
                    <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>{cell.day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Surface>

          {!currentEntry.isRecurring && selectedDates.length > 0 ? (
            <Text style={styles.hint}>Selected: {selectedDates.join(', ')}</Text>
          ) : null}
          {currentEntry.isRecurring && currentEntry.date ? <Text style={styles.hint}>{`Recurring start: ${currentEntry.date}`}</Text> : null}

          <View style={styles.checkboxRow}>
            <Checkbox
              status={currentEntry.isAllDay ? 'checked' : 'unchecked'}
              onPress={() =>
                setCurrentEntry((prev) => ({
                  ...prev,
                  isAllDay: !prev.isAllDay,
                  startTime: !prev.isAllDay ? '00:00' : '09:00',
                  endTime: !prev.isAllDay ? '23:59' : '17:00',
                }))
              }
            />
            <Text style={styles.rowText}>All Day</Text>
          </View>

          <View style={styles.row2}>
            <TextInput mode="outlined" label="Start Time" value={currentEntry.startTime} disabled={currentEntry.isAllDay} onChangeText={(v) => setCurrentEntry((p) => ({ ...p, startTime: v }))} style={styles.flex} />
            <TextInput mode="outlined" label="End Time" value={currentEntry.endTime} disabled={currentEntry.isAllDay} onChangeText={(v) => setCurrentEntry((p) => ({ ...p, endTime: v }))} style={styles.flex} />
          </View>
          <HelperText type="info">Use HH:MM format, e.g. 09:00</HelperText>

          <View style={styles.checkboxRow}>
            <Checkbox
              status={currentEntry.isRecurring ? 'checked' : 'unchecked'}
              onPress={() => setCurrentEntry((p) => ({ ...p, isRecurring: !p.isRecurring, recurringDays: [], recurringEndDate: '' }))}
            />
            <Text style={styles.rowText}>Repeat Weekly</Text>
          </View>

          {currentEntry.isRecurring ? (
            <>
              <TextInput mode="outlined" label="Repeat Until" value={currentEntry.recurringEndDate || ''} onChangeText={(v) => setCurrentEntry((p) => ({ ...p, recurringEndDate: v }))} placeholder="YYYY-MM-DD" />
              <View style={styles.chipWrap}>
                {weekDays.map((d) => {
                  const selected = currentEntry.recurringDays.includes(d.value);
                  return (
                    <Chip key={d.value} selected={selected} onPress={() => toggleRecurringDay(d.value)} style={selected ? styles.chipSelected : styles.chip}>
                      {d.label}
                    </Chip>
                  );
                })}
              </View>
            </>
          ) : null}

          <TextInput mode="outlined" label="Notes" multiline numberOfLines={3} value={currentEntry.notes || ''} onChangeText={(v) => setCurrentEntry((p) => ({ ...p, notes: v }))} />

          <Button mode="contained" onPress={handleAddEntry} disabled={loading} loading={loading}>
            Add Time Slot
          </Button>
        </Surface>

        <Text style={styles.sectionTitle}>Your Time Slots</Text>
        {availabilityEntries.length === 0 ? (
          <Text style={styles.empty}>No time slots added yet.</Text>
        ) : (
          availabilityEntries.map((e) => (
            <Surface key={e.id} style={styles.slotItem} elevation={0}>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotTitle}>{`${e.date} - ${e.isAllDay ? 'All Day' : `${e.startTime}-${e.endTime}`}`}</Text>
                {e.isRecurring ? (
                  <Text style={styles.slotMeta}>{`Repeats on ${(e.recurringDays || []).map((d) => weekDays[d]?.label || '').filter(Boolean).join(', ')} until ${e.recurringEndDate}`}</Text>
                ) : null}
                {e.notifyNewShifts ? <Text style={styles.slotMeta}>Notifications on for matching public shifts</Text> : null}
                {e.notes ? <Text style={styles.slotMeta}>{e.notes}</Text> : null}
              </View>
              <Button textColor="#DC2626" onPress={() => handleDeleteEntry(e.id)}>Delete</Button>
            </Surface>
          ))
        )}
      </ScrollView>

      <Snackbar visible={snackbarOpen} onDismiss={() => setSnackbarOpen(false)} duration={4000}>
        <Text style={{ color: snackbarSeverity === 'error' ? '#FCA5A5' : '#86EFAC' }}>{snackbarMsg}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  title: { fontWeight: '700', color: '#111827' },
  card: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  sectionTitle: { fontWeight: '700', color: '#111827' },
  row2: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  rowText: { color: '#374151', flexShrink: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F3F4F6' },
  chipSelected: { backgroundColor: '#EDE9FE' },
  empty: { color: '#6B7280' },
  slotItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotTitle: { color: '#111827', fontWeight: '600' },
  slotMeta: { color: '#6B7280', marginTop: 2 },
  placesInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    color: '#111827',
  },
  mapWrap: {
    height: 220,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  calendarPanel: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 8, backgroundColor: '#FFFFFF' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { fontWeight: '600', color: '#111827' },
  calendarWeekHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 4 },
  calendarWeekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#6B7280', fontSize: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calendarCellPad: { opacity: 0 },
  calendarCellSelected: { backgroundColor: '#4F46E5' },
  calendarCellText: { color: '#111827' },
  calendarCellTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  hint: { color: '#6B7280', fontSize: 12 },
});


