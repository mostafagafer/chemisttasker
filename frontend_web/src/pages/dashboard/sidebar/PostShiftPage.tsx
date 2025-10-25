import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Snackbar,
  IconButton,
  Typography,
  Stack,
  Alert,
  Tooltip,
  createTheme,
  ThemeProvider,
  useMediaQuery,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { StepIconProps } from '@mui/material/StepIcon';
import {
  InfoOutlined as InfoIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Work as WorkIcon,
  Visibility as VisibilityIcon,
  VerifiedUser as SkillsIcon,
  AttachMoney as RateIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import Grid from '@mui/material/Grid';
import { stepConnectorClasses } from '@mui/material/StepConnector';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from 'dayjs';

// --- Interface Definitions ---
interface Pharmacy { id: number; name: string; has_chain: boolean; claimed: boolean; }
interface SlotEntry {
  date: string; startTime: string; endTime: string; isRecurring: boolean;
  recurringDays: number[]; recurringEndDate: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    slotIndex: number;
    occurrenceIndex: number;
  };
}

type CalendarViewOption = 'month' | 'week' | 'day';
const CALENDAR_VIEWS: CalendarViewOption[] = ['month', 'week', 'day'];

interface CalendarSlotSelection {
  start: Date;
  end: Date;
  slots: Date[];
  action?: 'select' | 'click' | 'doubleClick';
  bounds?: DOMRect | ClientRect;
  box?: DOMRect | ClientRect;
}

const localizer = momentLocalizer(moment);

const WEEK_DAYS = [
  { v: 1, l: 'M', full: 'Monday' },
  { v: 2, l: 'T', full: 'Tuesday' },
  { v: 3, l: 'W', full: 'Wednesday' },
  { v: 4, l: 'T', full: 'Thursday' },
  { v: 5, l: 'F', full: 'Friday' },
  { v: 6, l: 'S', full: 'Saturday' },
  { v: 0, l: 'S', full: 'Sunday' },
];

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const applyTimeToDate = (date: Date, time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(date.getTime());
  next.setHours(hour, minute, 0, 0);
  return next;
};

const formatSlotDate = (value: string) => (value ? dayjs(value).format('ddd, MMM D YYYY') : '');
const formatSlotTime = (value: string) => dayjs(`1970-01-01T${value}`).format('h:mm A');

const describeRecurringDays = (days: number[]) => {
  if (!days?.length) return '';
  const ordered = [...days].sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b)));
  return ordered.map((day) => DAY_LABELS_SHORT[day]).join(' • ');
};

const PostShiftPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null; // FIX: Added null check for user

  const params = new URLSearchParams(location.search);
  const editingShiftId = params.get('edit');

  // --- Form State ---
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState<number | ''>('');
  const [employmentType, setEmploymentType] = useState<string>('LOCUM');
  const [roleNeeded, setRoleNeeded] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [workloadTags, setWorkloadTags] = useState<string[]>([]);
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [niceToHave, setNiceToHave] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string>('');
  const [escalationDates, setEscalationDates] = useState<Record<string, string>>({});
  const [rateType, setRateType] = useState<string>('');
  const [fixedRate, setFixedRate] = useState<string>('');
  const [ownerAdjustedRate, setOwnerAdjustedRate] = useState('');
  const [singleUserOnly, setSingleUserOnly] = useState(false);

  // --- Timetable State ---
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotStartTime, setSlotStartTime] = useState<string>('09:00');
  const [slotEndTime, setSlotEndTime] = useState<string>('17:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calendarView, setCalendarView] = useState<CalendarViewOption>('month');

  // --- UI State ---
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);

  // --- Calendar Control State ---
  const todayStart = useMemo(() => dayjs().startOf('day'), []);
  const [calendarDate, setCalendarDate] = useState(todayStart.toDate());
  const minCalendarDate = useMemo(() => todayStart.toDate(), [todayStart]);
  const maxCalendarDate = useMemo(() => todayStart.add(4, 'month').endOf('month').toDate(), [todayStart]);
  const minDateInputValue = useMemo(() => todayStart.format('YYYY-MM-DD'), [todayStart]);

  // --- Data Loading ---
  useEffect(() => {
    apiClient.get(API_ENDPOINTS.pharmacies)
      .then(res => setPharmacies(res.data.results || res.data))
      .catch(() => showSnackbar('Failed to load pharmacies', 'error'));

    if (editingShiftId) {
      apiClient.get(`${API_ENDPOINTS.getActiveShifts}${editingShiftId}/`)
        .then(res => {
          const data = res.data;
          setPharmacyId(data.pharmacy);
          setEmploymentType(data.employment_type);
          setRoleNeeded(data.role_needed);
          setDescription(data.description || '');
          setWorkloadTags(data.workload_tags || []);
          setMustHave(data.must_have || []);
          setNiceToHave(data.nice_to_have || []);
          setVisibility(data.visibility);
          setRateType(data.rate_type || '');
          setFixedRate(data.fixed_rate || '');
          setOwnerAdjustedRate(data.owner_adjusted_rate || '');
          setSingleUserOnly(data.single_user_only || false);
          setSlots((data.slots || []).map((s: any) => ({
              date: s.date, startTime: s.start_time, endTime: s.end_time, isRecurring: s.is_recurring,
              recurringDays: s.recurring_days || [], recurringEndDate: s.recurring_end_date || '',
          })));
        })
        .catch(() => showSnackbar('Failed to load shift for editing', 'error'));
    }
  }, [editingShiftId]);

  const allowedVis = useMemo(() => {
    const p = pharmacies.find(x => x.id === pharmacyId);
    if (!p) return [];

    // All users start with the basic tiers
    const tiers = ['FULL_PART_TIME', 'LOCUM_CASUAL'];

    // Add chain tier if the pharmacy has a chain
    if (p.has_chain) {
      tiers.push('OWNER_CHAIN');
    }
    // Add organization tier if the owner is claimed by an org
    if (p.claimed) {
      tiers.push('ORG_CHAIN');
    }
    // Platform is always the final tier
    tiers.push('PLATFORM');

    // ORG_ADMINs can see all tiers regardless of pharmacy status
    if (user?.role?.startsWith('ORG_')) {
      return ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'];
    }

    return tiers;
  }, [pharmacyId, pharmacies, user]);

  useEffect(() => {
    if (allowedVis.length > 0 && !allowedVis.includes(visibility)) {
      setVisibility(allowedVis[0]);
    }
  }, [allowedVis, visibility]);

  const showSnackbar = (msg: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message: msg, severity });

  const steps = [
    { label: 'Shift Details', icon: WorkIcon },
    { label: 'Skills', icon: SkillsIcon },
    { label: 'Visibility', icon: VisibilityIcon },
    { label: 'Pay Rate', icon: RateIcon },
    { label: 'Timetable', icon: ScheduleIcon },
  ];

  const StepConnectorStyled = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
      top: 24,
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1,
    },
    [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main,
    },
    [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main,
    },
  }));

  const StepIconRoot = styled('div')<{ ownerState: { active?: boolean; completed?: boolean } }>(
    ({ theme, ownerState }) => ({
      zIndex: 1,
      width: 44,
      height: 44,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
        duration: theme.transitions.duration.shorter,
      }),
      color: ownerState.active || ownerState.completed
        ? theme.palette.common.white
        : theme.palette.text.secondary,
      background: ownerState.completed || ownerState.active
        ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
        : theme.palette.grey[200],
      boxShadow: ownerState.active
        ? '0 12px 24px rgba(109, 40, 217, 0.25)'
        : '0 0 0 rgba(0,0,0,0)',
      transform: ownerState.active ? 'scale(1.05)' : 'scale(1)',
    })
  );

  const StepIconComponent = (props: StepIconProps) => {
    const { active, completed, icon } = props;
    const stepIndex = Number(icon) - 1;
    const Icon = steps[stepIndex]?.icon ?? WorkIcon;
    return (
      <StepIconRoot ownerState={{ active, completed }}>
        <Icon fontSize="small" />
      </StepIconRoot>
    );
  };

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];

    slots.forEach((slot, slotIndex) => {
      const addOccurrence = (date: Date, occurrenceIndex: number) => {
        const start = applyTimeToDate(date, slot.startTime);
        const end = applyTimeToDate(date, slot.endTime);
        events.push({
          id: `${slotIndex}-${occurrenceIndex}-${start.toISOString()}`,
          title: `${formatSlotTime(slot.startTime)} – ${formatSlotTime(slot.endTime)}`,
          start,
          end,
          resource: { slotIndex, occurrenceIndex },
        });
      };

      if (slot.isRecurring && slot.recurringEndDate && slot.recurringDays.length) {
        let cursor = toIsoDate(slot.date);
        const endBoundary = toIsoDate(slot.recurringEndDate);
        let occurrenceIndex = 0;
        while (cursor <= endBoundary) {
          if (slot.recurringDays.includes(cursor.getDay())) {
            addOccurrence(cursor, occurrenceIndex);
            occurrenceIndex += 1;
          }
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
      } else {
        addOccurrence(toIsoDate(slot.date), 0);
      }
    });

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [slots]);

  useEffect(() => {
    if (calendarEvents.length > 0 && slots.length > 0) {
      setCalendarDate(calendarEvents[0].start);
    }
  }, [calendarEvents, slots.length]);

const eventStyleGetter = useCallback((_event: CalendarEvent, _start: Date, _end: Date, _isSelected: boolean) => {
    const backgroundColor = '#8B5CF6'; // A slightly lighter purple
    const style = {
        backgroundColor,
        borderRadius: '6px',
        color: 'white',
        border: '1px solid #6D28D9',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        padding: '2px 5px',
    };
    return { style };
}, []);

const handleAddSlot = () => {
  if (!slotStartTime || !slotEndTime) return showSnackbar('Please select a start and end time.', 'error');
  if (new Date(`1970-01-01T${slotEndTime}`) <= new Date(`1970-01-01T${slotStartTime}`)) return showSnackbar('End time must be after start time.', 'error');

  const baseDates = selectedDates.length ? selectedDates : slotDate ? [slotDate] : [];
  if (!baseDates.length) return showSnackbar('Select at least one date from the calendar.', 'error');

  if (isRecurring && (!recurringEndDate || recurringDays.length === 0)) {
    return showSnackbar('Please complete the recurrence details.', 'error');
  }

  if (isRecurring && baseDates.length > 1) {
    return showSnackbar('Recurring schedules can only start from a single date selection.', 'error');
  }

  const validDates = baseDates.filter((date) => !dayjs(date).isBefore(todayStart, 'day'));
  if (!validDates.length) {
    showSnackbar('Cannot schedule entries in the past.', 'error');
    return;
  }
  if (validDates.length < baseDates.length) {
    showSnackbar('Past dates were ignored.', 'error');
  }

  const newEntries = validDates.map((date) => ({
    date,
    startTime: slotStartTime,
    endTime: slotEndTime,
    isRecurring: isRecurring && validDates.length === 1,
    recurringDays: isRecurring ? recurringDays : [],
    recurringEndDate: isRecurring ? recurringEndDate : '',
  }));

  const existingKeys = new Set(slots.map((s) => `${s.date}-${s.startTime}-${s.endTime}-${s.isRecurring}-${s.recurringDays.join(',')}`));
  const filtered = newEntries.filter(
    (entry) => !existingKeys.has(`${entry.date}-${entry.startTime}-${entry.endTime}-${entry.isRecurring}-${entry.recurringDays.join(',')}`)
  );

  if (!filtered.length) {
    showSnackbar('Those timetable entries already exist.', 'error');
    return;
  }

  setSlots((prev) => [...prev, ...filtered]);
  showSnackbar(`${filtered.length} timetable entr${filtered.length > 1 ? 'ies' : 'y'} added.`);

  setSelectedDates([]);
  setIsRecurring(false);
  setRecurringDays([]);
  setRecurringEndDate('');
};

  const handleSubmit = async () => {
    if (!pharmacyId || !roleNeeded || !employmentType) return showSnackbar('Please fill all required fields in Step 1.', 'error');
    if (slots.length === 0) return showSnackbar('Please add at least one schedule entry.', 'error');
    
    setSubmitting(true);
    const payload = {
      pharmacy: pharmacyId, role_needed: roleNeeded, description, employment_type: employmentType,
      workload_tags: workloadTags, must_have: mustHave, nice_to_have: niceToHave, visibility,
      escalate_to_locum_casual: escalationDates['LOCUM_CASUAL'] || null,
      escalate_to_owner_chain: escalationDates['OWNER_CHAIN'] || null,
      escalate_to_org_chain: escalationDates['ORG_CHAIN'] || null,
      escalate_to_platform: escalationDates['PLATFORM'] || null,
      rate_type: roleNeeded === 'PHARMACIST' ? rateType : null,
      fixed_rate: (roleNeeded === 'PHARMACIST' && rateType === 'FIXED' && fixedRate) ? fixedRate : null,
      owner_adjusted_rate: (roleNeeded !== 'PHARMACIST' && ownerAdjustedRate) ? Number(ownerAdjustedRate) : null,
      single_user_only: singleUserOnly,
      slots: slots.map(s => ({
        date: s.date, start_time: s.startTime, end_time: s.endTime,
        is_recurring: s.isRecurring, recurring_days: s.recurringDays,
        recurring_end_date: s.recurringEndDate || null,
      })),
    };

    try {
      if (editingShiftId) {
        await apiClient.patch(`${API_ENDPOINTS.getActiveShifts}${editingShiftId}/`, payload);
        showSnackbar('Shift updated successfully!');
      } else {
        await apiClient.post(API_ENDPOINTS.getActiveShifts, payload);
        showSnackbar('Shift posted successfully!');
      }
      setTimeout(() => navigate('/dashboard/owner/shifts/active'), 1500);
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'An error occurred.', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  const renderStepContent = (step: number) => {
    const workloadOptions = ['Sole Pharmacist', 'High Script Load', 'Webster Packs'];
    const skillOptions = ['Vaccination', 'Methadone', 'CPR', 'First Aid', 'Anaphylaxis', 'Credentialed Badge', 'PDL Insurance'];
    const ESCALATION_LABELS: Record<string, string> = { FULL_PART_TIME: 'Pharmacy Members', LOCUM_CASUAL: 'Favourite Staff', OWNER_CHAIN: 'Owner Chain', ORG_CHAIN: 'Organization', PLATFORM: 'Platform (Public)' };
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

    switch (step) {
      case 0: return (
        <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
            <Grid size={12}>
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Pharmacy *</InputLabel>
                <Select
                  value={pharmacyId}
                  label="Pharmacy *"
                  onChange={e => setPharmacyId(Number(e.target.value))}
                >
                  {pharmacies.map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Employment Type *</InputLabel>
                <Select
                  value={employmentType}
                  label="Employment Type *"
                  onChange={e => setEmploymentType(e.target.value)}
                >
                  <MenuItem value="LOCUM">Locum</MenuItem>
                  <MenuItem value="FULL_TIME">Full-Time</MenuItem>
                  <MenuItem value="PART_TIME">Part-Time</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Role Needed *</InputLabel>
                <Select
                  value={roleNeeded}
                  label="Role Needed *"
                  onChange={e => setRoleNeeded(e.target.value)}
                >
                  <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
                  <MenuItem value="TECHNICIAN">Dispensary Technician</MenuItem>
                  <MenuItem value="ASSISTANT">Assistant</MenuItem>
                  <MenuItem value="INTERN">Intern Pharmacist</MenuItem>
                  <MenuItem value="STUDENT">Pharmacy Student</MenuItem>
                  <MenuItem value="EXPLORER">Explorer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Shift Description"
                multiline
                minRows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                fullWidth
                placeholder="Provide key responsibilities or context..."
                size="small"
                sx={fieldSx}
              />
            </Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Workload Tags
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1.5}>
                {workloadOptions.map(tag => {
                  const selected = workloadTags.includes(tag);
                  return (
                    <Chip
                      key={tag}
                      label={tag}
                      onClick={() =>
                        setWorkloadTags(current =>
                          selected ? current.filter(x => x !== tag) : [...current, tag]
                        )
                      }
                      variant={selected ? 'filled' : 'outlined'}
                      color={selected ? 'primary' : 'default'}
                      clickable
                      sx={{
                        borderRadius: '999px',
                        fontWeight: 600,
                        px: 1.5,
                        py: 0.5,
                      }}
                    />
                  );
                })}
              </Stack>
            </Grid>
        </Grid>
      );
      case 1: return (
        <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
            <Grid size={12}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Must-Have Skills
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 1.5,
                }}
              >
                {skillOptions.map(s => (
                  <FormControlLabel
                    key={`must-${s}`}
                    control={
                      <Checkbox
                        checked={mustHave.includes(s)}
                        onChange={() =>
                          setMustHave(current =>
                            current.includes(s)
                              ? current.filter(x => x !== s)
                              : [...current, s]
                          )
                        }
                      />
                    }
                    label={s}
                  />
                ))}
              </Box>
            </Grid>
            <Grid size={12}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Nice-to-Have Skills
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 1.5,
                }}
              >
                {skillOptions.map(s => (
                  <FormControlLabel
                    key={`nice-${s}`}
                    control={
                      <Checkbox
                        checked={niceToHave.includes(s)}
                        onChange={() =>
                          setNiceToHave(current =>
                            current.includes(s)
                              ? current.filter(x => x !== s)
                              : [...current, s]
                          )
                        }
                      />
                    }
                    label={s}
                  />
                ))}
              </Box>
            </Grid>
        </Grid>
      );
      case 2:
        const startIdx = allowedVis.indexOf(visibility);
        return (
            <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Define who sees this shift and when it escalates to wider groups.
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel>Initial Audience</InputLabel>
                    <Select
                      value={visibility}
                      label="Initial Audience"
                      onChange={e => setVisibility(e.target.value)}
                    >
                      {allowedVis.map(opt => (
                        <MenuItem key={opt} value={opt}>
                          {ESCALATION_LABELS[opt]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {startIdx > -1 && allowedVis.slice(startIdx + 1).map(tier => (
                    <Grid key={tier} size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label={`Escalate to ${ESCALATION_LABELS[tier]}`}
                        type="datetime-local"
                        value={escalationDates[tier] || ''}
                        onChange={e => setEscalationDates(d => ({ ...d, [tier]: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        size="small"
                        sx={fieldSx}
                      />
                    </Grid>
                ))}
            </Grid>
        );
      case 3: return (
        <>
            {roleNeeded === 'PHARMACIST' ? (
                <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth size="small" sx={fieldSx}>
                        <InputLabel>Rate Type</InputLabel>
                        <Select
                          value={rateType}
                          label="Rate Type"
                          onChange={e => setRateType(e.target.value)}
                        >
                          <MenuItem value="FIXED">Fixed Rate</MenuItem>
                          <MenuItem value="FLEXIBLE">Flexible Rate</MenuItem>
                          <MenuItem value="PHARMACIST_PROVIDED">Worker Specifies Rate</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    {rateType === 'FIXED' && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Fixed Rate ($/hr)"
                          type="number"
                          value={fixedRate}
                          onChange={e => setFixedRate(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                    )}
                </Grid>
            ) : (
                <Stack spacing={3}>
                    <Typography
                      variant="body1"
                      align="center"
                      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}
                    >
                      Rate is set by government award
                      <Tooltip title="View pay guide">
                        <IconButton size="small" href="#" target="_blank">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    <TextField
                      label="Owner Bonus ($/hr, optional)"
                      type="number"
                      value={ownerAdjustedRate}
                      onChange={e => setOwnerAdjustedRate(e.target.value)}
                      fullWidth
                      helperText="This bonus is added to the award rate."
                      size="small"
                      sx={fieldSx}
                    />
                </Stack>
            )}
        </>
      );
      case 4: {
        return (
          <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
            <Grid size={{ xs: 12, lg: 5 }} sx={{ order: { xs: 1, lg: 0 } }}>
              <Stack spacing={2.5}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: 'grey.200' }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Add schedule entry
                    </Typography>
                    <Grid container rowSpacing={2} columnSpacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          label="Date"
                          type="date"
                          value={slotDate}
                          onChange={e => setSlotDate(e.target.value)}
                          inputProps={{ min: minDateInputValue }}
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Start"
                          type="time"
                          value={slotStartTime}
                          onChange={e => setSlotStartTime(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="End"
                          type="time"
                          value={slotEndTime}
                          onChange={e => setSlotEndTime(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={12}>
                        <Button
                          variant="contained"
                          onClick={handleAddSlot}
                          startIcon={<AddIcon />}
                          fullWidth
                          sx={{ height: 44, borderRadius: 2 }}
                        >
                          Add slot
                        </Button>
                      </Grid>
                    </Grid>
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={isRecurring}
                          onChange={e => {
                            const checked = e.target.checked;
                            setIsRecurring(checked);
                            if (!checked) {
                              setRecurringDays([]);
                              setRecurringEndDate('');
                            }
                          }}
                        />
                      )}
                      label="This is a recurring weekly schedule"
                    />
                    {isRecurring && (
                      <Stack spacing={2}>
                        <TextField
                          label="Repeat until"
                          type="date"
                          value={recurringEndDate}
                          onChange={e => setRecurringEndDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                        <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1}>
                          {WEEK_DAYS.map((d) => (
                            <Button
                              key={d.v}
                              variant={recurringDays.includes(d.v) ? 'contained' : 'outlined'}
                              onClick={() =>
                                setRecurringDays(days => {
                                  if (days.includes(d.v)) {
                                    return days.filter(x => x !== d.v);
                                  }
                                  const next = [...days, d.v];
                                  return next.sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b)));
                                })
                              }
                              sx={{ minWidth: 44, borderRadius: '10px' }}
                              aria-label={d.full}
                            >
                              {d.l}
                            </Button>
                          ))}
                        </Stack>
                      </Stack>
                    )}
                  </Stack>
                </Paper>

                {selectedDates.length > 0 && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 3, borderColor: 'grey.200' }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight={600}>
                          Selected calendar days
                        </Typography>
                        <Button size="small" onClick={() => setSelectedDates([])}>
                          Clear
                        </Button>
                      </Stack>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedDates.map((date) => (
                          <Chip
                            key={date}
                            label={formatSlotDate(date)}
                            onDelete={() => setSelectedDates((prev) => prev.filter((d) => d !== date))}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Adjust start and end times above, then press “Add slot” to add entries for every selected day.
                      </Typography>
                    </Stack>
                  </Paper>
                )}

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: 'grey.200' }}>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={<Checkbox checked={singleUserOnly} onChange={e => setSingleUserOnly(e.target.checked)} />}
                      label="A single person must work all timetable entries"
                    />
                    {slots.length === 0 ? (
                      <Alert severity="info">No schedule entries added yet.</Alert>
                    ) : (
                      <Stack spacing={1.5}>
                        {slots.map((slot, index) => {
                          const recurringLabel = describeRecurringDays(slot.recurringDays);
                          return (
                            <Box
                              key={`${slot.date}-${slot.startTime}-${index}`}
                              sx={{
                                border: '1px solid',
                                borderColor: 'grey.200',
                                borderRadius: 2,
                                px: 2,
                                py: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                              }}
                            >
                              <Box>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {formatSlotDate(slot.date)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {`${formatSlotTime(slot.startTime)} – ${formatSlotTime(slot.endTime)}`}
                                </Typography>
                                {slot.isRecurring && (
                                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                                    <Chip size="small" color="primary" label="Recurring" />
                                    {recurringLabel && (
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={recurringLabel}
                                      />
                                    )}
                                    {slot.recurringEndDate && (
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`Ends ${formatSlotDate(slot.recurringEndDate)}`}
                                      />
                                    )}
                                  </Stack>
                                )}
                              </Box>
                              <IconButton edge="end" onClick={() => setSlots(sc => sc.filter((_, idx) => idx !== index))} color="error">
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, lg: 7 }} sx={{ order: { xs: 0, lg: 1 } }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  borderColor: 'grey.200',
                  height: { xs: 420, md: 520 },
                  display: 'flex',
                  flexDirection: 'column',
                  '& .rbc-calendar': {
                    fontFamily: "'Inter', sans-serif",
                  },
                  '& .rbc-toolbar-label': {
                    fontWeight: 600,
                  },
                  '& .rbc-event': {
                    fontSize: '0.75rem',
                  },
                }}
              >
                <Stack spacing={1.5} sx={{ height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Timetable preview
                  </Typography>
                  <Calendar
                    selectable
                    longPressThrottle={50}
                    localizer={localizer}
                    events={calendarEvents}
                    date={calendarDate}
                    view={calendarView}
                    views={CALENDAR_VIEWS}
                    step={calendarView === 'week' || calendarView === 'day' ? 15 : 30}
                    timeslots={calendarView === 'week' || calendarView === 'day' ? 4 : 2}
                    style={{ flex: 1 }}
                    eventPropGetter={eventStyleGetter}
                    startAccessor="start"
                    endAccessor="end"
                    popup
                    onNavigate={(newDate: Date) => {
                      const next = dayjs(newDate);
                      if (next.isBefore(todayStart, 'day')) {
                        setCalendarDate(minCalendarDate);
                      } else if (next.isAfter(dayjs(maxCalendarDate), 'day')) {
                        setCalendarDate(maxCalendarDate);
                      } else {
                        setCalendarDate(next.toDate());
                      }
                    }}
                    onView={(newView: string) => {
                      const nextView = CALENDAR_VIEWS.includes(newView as CalendarViewOption)
                        ? (newView as CalendarViewOption)
                        : 'month';
                      setCalendarView(nextView);
                    }}
                    min={dayjs(calendarDate).startOf('day').subtract(2, 'hour').toDate()}
                    max={dayjs(calendarDate).startOf('day').add(1, 'day').add(2, 'hour').toDate()}
                    onSelectSlot={({ start, end, slots }: CalendarSlotSelection) => {
                      const startMoment = dayjs(start as Date);
                      const endMoment = dayjs(end as Date);

                      if (startMoment.isBefore(todayStart, 'minute')) {
                        showSnackbar('Cannot select time in the past.', 'error');
                        return;
                      }

                      if (calendarView === 'week' || calendarView === 'day') {
                        setSelectedDates([startMoment.format('YYYY-MM-DD')]);
                        setSlotDate(startMoment.format('YYYY-MM-DD'));
                        setSlotStartTime(startMoment.format('HH:mm'));
                        let endCandidate = endMoment;
                        if (!endMoment.isAfter(startMoment)) {
                          endCandidate = startMoment.add(1, 'hour');
                        }
                        setSlotEndTime(endCandidate.format('HH:mm'));
                        setIsRecurring(false);
                        setRecurringDays([]);
                        setRecurringEndDate('');
                        return;
                      }

                      const slotValues: Array<Date | string> = slots && slots.length ? (slots as Array<Date | string>) : [start as Date];
                      const slotDates = slotValues.map((slotValue) =>
                        dayjs(slotValue).format('YYYY-MM-DD')
                      );
                      const uniqueDates = Array.from(new Set<string>(slotDates)).filter(
                        (date) => !dayjs(date).isBefore(todayStart, 'day')
                      );

                      if (!uniqueDates.length) {
                        showSnackbar('Cannot select past dates.', 'error');
                        return;
                      }

                      const sortedDates = [...uniqueDates].sort();
                      setSelectedDates(sortedDates);
                      if (sortedDates.length) {
                        setSlotDate(sortedDates[0]);
                      }
                      setIsRecurring(false);
                      setRecurringDays([]);
                      setRecurringEndDate('');
                    }}
                    onSelectEvent={(event: CalendarEvent) => {
                      const resource = event.resource;
                      if (resource?.slotIndex !== undefined) {
                        const slot = slots[resource.slotIndex];
                        if (slot) {
                          setSlotDate(slot.date);
                          setSlotStartTime(slot.startTime);
                          setSlotEndTime(slot.endTime);
                          setIsRecurring(slot.isRecurring);
                          setRecurringDays(slot.recurringDays || []);
                          setRecurringEndDate(slot.recurringEndDate || '');
                          setSelectedDates([slot.date]);
                        }
                      }
                    }}
                    messages={{ next: 'Next', previous: 'Back', today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
                  />
                  {calendarEvents.length === 0 && (
                    <Typography variant="body2" color="text.secondary" align="center">
                      Tap a date to set the timetable above. You can add multiple entries and combine recurring schedules.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        );
      }
      default: return null;
    }
  };

  const theme = createTheme({
    palette: {
      primary: { main: '#6D28D9', light: '#8B5CF6', dark: '#5B21B6' },
      secondary: { main: '#10B981', light: '#6EE7B7', dark: '#047857' },
      background: { default: '#F9FAFB', paper: '#FFFFFF' },
    },
    typography: {
      fontFamily: "'Inter', sans-serif",
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.07)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
    },
  });
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <ThemeProvider theme={theme}>
    <Container maxWidth="md" sx={{ py: 4, bgcolor: '#F9FAFB', minHeight: '100vh' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.1)' }}>
        <Typography variant="h4" gutterBottom align="center" fontWeight={600}>{editingShiftId ? 'Edit Shift' : 'Create a New Shift'}</Typography>
        <Typography variant="body1" color="text.secondary" align="center" mb={4}>Follow the steps to post a new shift opportunity.</Typography>

        <Stepper
          activeStep={activeStep}
          alternativeLabel={!isMobile}
          orientation={isMobile ? 'vertical' : 'horizontal'}
          connector={<StepConnectorStyled />}
          sx={{ mb: 5, px: { xs: 1, sm: 4 } }}
        >
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel StepIconComponent={StepIconComponent}>
                <Typography
                  variant="body2"
                  fontWeight={activeStep === index ? 700 : 500}
                  color={activeStep === index ? 'text.primary' : 'text.secondary'}
                >
                  {step.label}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 350, px: { xs: 0, md: 3 } }}>
          <Typography variant="h5" fontWeight={500} gutterBottom>{steps[activeStep].label}</Typography>
          {renderStepContent(activeStep)}
        </Box>

        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ mt: 5, pt: 3, borderTop: '1px solid #eee' }}
        >
          <Button
            onClick={() => setActiveStep(p => p - 1)}
            disabled={activeStep === 0}
            variant="text"
            sx={{ minWidth: 120 }}
          >
            Back
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button
              onClick={() => setActiveStep(p => p + 1)}
              variant="contained"
              fullWidth={isMobile}
              sx={{ minWidth: isMobile ? '100%' : 140, borderRadius: 2 }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit}
              disabled={submitting}
              fullWidth={isMobile}
              sx={{ minWidth: isMobile ? '100%' : 160, borderRadius: 2 }}
            >
              {submitting ? 'Submitting...' : (editingShiftId ? 'Update Shift' : 'Post Shift')}
            </Button>
          )}
        </Stack>
      </Paper>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
    </ThemeProvider>
  );
};

export default PostShiftPage;
