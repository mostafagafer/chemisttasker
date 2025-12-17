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
import { useAuth } from '../../../contexts/AuthContext';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from 'dayjs';
import { ORG_ROLES } from '../../../constants/roles';
import {
  PharmacySummary,
  Shift,
  EscalationLevelKey,
  fetchPharmaciesService,
  fetchActiveShiftDetailService,
  createOwnerShiftService,
  updateOwnerShiftService,
} from '@chemisttasker/shared-core';
import apiClient from '../../../utils/apiClient';

// --- Interface Definitions ---
type PharmacyOption = PharmacySummary & { hasChain?: boolean; claimed?: boolean };
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

const toIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = dayjs(trimmed);
  if (parsed.isValid()) {
    return parsed.startOf('day').toDate();
  }

  const datePortion = trimmed.split('T')[0];
  if (datePortion) {
    const [year, month, day] = datePortion.split('-').map((part) => Number.parseInt(part, 10));
    if ([year, month, day].every((part) => Number.isFinite(part))) {
      return new Date(year, month - 1, day);
    }
  }

  return null;
};

const isValidDate = (date: Date | null | undefined): date is Date => {
  return Boolean(date && !Number.isNaN(date.getTime()));
};

const applyTimeToDate = (date: Date, time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(date.getTime());
  next.setHours(hour, minute, 0, 0);
  return next;
};

const formatSlotDate = (value: string) => (value ? dayjs(value).format('ddd, MMM D YYYY') : '');
const formatSlotTime = (value: string) => dayjs(`1970-01-01T${value}`).format('h:mm A');
const toInputDateTimeLocal = (value?: string | null) =>
  value ? dayjs(value).local().format('YYYY-MM-DDTHH:mm') : '';

const describeRecurringDays = (days: number[]) => {
  if (!days?.length) return '';
  const ordered = [...days].sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b)));
  return ordered.map((day) => DAY_LABELS_SHORT[day]).join(' / ');
};

const ORG_ROLE_VALUES = ORG_ROLES as readonly string[];

const PostShiftPage: React.FC = () => {
  const { user, activePersona, activeAdminPharmacyId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null; // FIX: Added null check for user

  const scopedPharmacyId =
    activePersona === "admin" && typeof activeAdminPharmacyId === "number"
      ? activeAdminPharmacyId
      : null;

  const params = new URLSearchParams(location.search);
  const adminRedirectBase = scopedPharmacyId != null ? `/dashboard/admin/${scopedPharmacyId}` : null;
  const editingShiftId = params.get('edit');

  const orgMembership = useMemo(() => {
    const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
    return memberships.find((membership: any) => {
      if (!membership || typeof membership !== 'object') return false;
      const role = membership.role;
      return typeof role === 'string' && ORG_ROLE_VALUES.includes(role);
    });
  }, [user?.memberships]);
  const isOrganizationUser = Boolean(orgMembership);

  // --- Form State ---
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [pharmacyId, setPharmacyId] = useState<number | ''>(() =>
    scopedPharmacyId ?? ''
  );
  const [employmentType, setEmploymentType] = useState<string>('LOCUM');
  const [roleNeeded, setRoleNeeded] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [workloadTags, setWorkloadTags] = useState<string[]>([]);
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [niceToHave, setNiceToHave] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string>('');
  const [escalationDates, setEscalationDates] = useState<Record<string, string>>({});
  const [rateType, setRateType] = useState<string>('FLEXIBLE');
  const [paymentPreference, setPaymentPreference] = useState<string>('ABN');
  const [rateWeekday, setRateWeekday] = useState<string>('');
  const [rateSaturday, setRateSaturday] = useState<string>('');
  const [rateSunday, setRateSunday] = useState<string>('');
  const [ratePublicHoliday, setRatePublicHoliday] = useState<string>('');
  const [rateEarlyMorning, setRateEarlyMorning] = useState<string>('');
  const [rateLateNight, setRateLateNight] = useState<string>('');
  const [applyRatesToPharmacy, setApplyRatesToPharmacy] = useState(false);
  const [slotRateRows, setSlotRateRows] = useState<Array<{ rate: string; status: 'idle' | 'loading' | 'success' | 'error'; error?: string; dirty?: boolean }>>([]);
  const [ownerBonus, setOwnerBonus] = useState<string>('');
  const [ftptPayMode, setFtptPayMode] = useState<'HOURLY' | 'ANNUAL'>('HOURLY');
  const [minHourly, setMinHourly] = useState<string>('');
  const [maxHourly, setMaxHourly] = useState<string>('');
  const [minAnnual, setMinAnnual] = useState<string>('');
  const [maxAnnual, setMaxAnnual] = useState<string>('');
  const [superPercent, setSuperPercent] = useState<string>('');
  const [singleUserOnly, setSingleUserOnly] = useState(false);
  const [flexibleTiming, setFlexibleTiming] = useState(false);
  const [postAnonymously, setPostAnonymously] = useState(false);

  // --- Timetable State ---
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotStartTime, setSlotStartTime] = useState<string>('09:00');
  const [slotEndTime, setSlotEndTime] = useState<string>('17:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedDateTimes, setSelectedDateTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
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
  const safeCalendarDate = useMemo(
    () => (isValidDate(calendarDate) ? calendarDate : todayStart.toDate()),
    [calendarDate, todayStart]
  );

  const calendarTimeBounds = useMemo(() => {
    const base = dayjs(safeCalendarDate);
    if (!base.isValid()) {
      const fallback = todayStart;
      return {
        min: fallback.startOf('day').toDate(),
        max: fallback.endOf('day').toDate(),
      };
    }

    let minBound = base.startOf('day');
    let maxBound = base.endOf('day');

    return {
      min: minBound.toDate(),
      max: maxBound.toDate(),
    };
  }, [safeCalendarDate, todayStart]);

  // --- Data Loading ---
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const list = await fetchPharmaciesService({});
        const filtered =
          scopedPharmacyId != null
            ? list.filter((item: PharmacyOption) => Number(item.id) === scopedPharmacyId)
            : list;
        if (!cancelled) {
          setPharmacies(filtered as PharmacyOption[]);
        }
      } catch {
        if (!cancelled) {
          showSnackbar('Failed to load pharmacies', 'error');
        }
      }

      if (editingShiftId) {
        try {
          const detail = await fetchActiveShiftDetailService(Number(editingShiftId));
          const detailPharmacyId =
            detail.pharmacy ?? detail.pharmacyId ?? detail.pharmacyDetail?.id ?? null;
          if (scopedPharmacyId != null && detailPharmacyId !== scopedPharmacyId) {
            showSnackbar('You do not have access to this shift.', 'error');
            navigate(-1);
            return;
          }
          if (cancelled) {
            return;
          }
          setPharmacyId(scopedPharmacyId ?? detailPharmacyId ?? '');
          setEmploymentType(detail.employmentType ?? '');
          setRoleNeeded(detail.roleNeeded ?? '');
          setDescription(detail.description ?? '');
          setWorkloadTags(detail.workloadTags ?? []);
          setMustHave(detail.mustHave ?? []);
          setNiceToHave(detail.niceToHave ?? []);
          setVisibility(detail.visibility ?? 'FULL_PART_TIME');
          const incomingRateType = detail.rateType ?? '';
          setRateType(incomingRateType === 'FIXED' ? 'FLEXIBLE' : (incomingRateType || 'FLEXIBLE'));
          setPaymentPreference(detail.paymentPreference ?? (detail as any).payment_preference ?? '');
          setFlexibleTiming(Boolean((detail as any).flexibleTiming ?? (detail as any).flexible_timing));
          setSingleUserOnly(Boolean(detail.singleUserOnly));
          setPostAnonymously(Boolean(detail.postAnonymously));
          setEscalationDates({
            LOCUM_CASUAL: toInputDateTimeLocal(detail.escalateToLocumCasual),
            OWNER_CHAIN: toInputDateTimeLocal(detail.escalateToOwnerChain),
            ORG_CHAIN: toInputDateTimeLocal(detail.escalateToOrgChain),
            PLATFORM: toInputDateTimeLocal(detail.escalateToPlatform),
          });
          setSlots((detail.slots ?? []).map((slot: NonNullable<Shift['slots']>[number]) => ({
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isRecurring: Boolean(slot.isRecurring),
            recurringDays: slot.recurringDays ?? [],
            recurringEndDate: slot.recurringEndDate ?? '',
          })));
        } catch {
          if (!cancelled) {
            showSnackbar('Failed to load shift for editing', 'error');
          }
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [editingShiftId, scopedPharmacyId, navigate]);


  useEffect(() => {
    if (scopedPharmacyId != null) {
      setPharmacyId(scopedPharmacyId);
    }
  }, [scopedPharmacyId]);
  const selectedPharmacy = useMemo(
    () => pharmacies.find((x) => x.id === pharmacyId),
    [pharmacyId, pharmacies]
  );
  const allowedVis = useMemo<EscalationLevelKey[]>(() => {
    const p = pharmacies.find(x => x.id === pharmacyId);
    if (!p) return [];

    const tiers: EscalationLevelKey[] = ['FULL_PART_TIME', 'LOCUM_CASUAL'];
    if (p.hasChain) {
      tiers.push('OWNER_CHAIN');
    }
    if (p.claimed) {
      tiers.push('ORG_CHAIN');
    }
    tiers.push('PLATFORM');
    return tiers;
  }, [pharmacyId, pharmacies]);

  useEffect(() => {
    if (allowedVis.length > 0 && !allowedVis.includes(visibility)) {
      setVisibility(allowedVis[0]);
    }
  }, [allowedVis, visibility]);

  useEffect(() => {
    if (!selectedPharmacy) return;
    const normalize = (val: any) =>
      val === undefined || val === null || val === '' ? '' : String(val);

    const defaultRateType = (selectedPharmacy as any).default_rate_type || (selectedPharmacy as any).defaultRateType || 'FLEXIBLE';
    setRateType((prev) => {
      const next = prev || defaultRateType;
      return next === 'FIXED' ? 'FLEXIBLE' : next;
    });
    setRateWeekday((prev) => prev || normalize((selectedPharmacy as any).rate_weekday ?? (selectedPharmacy as any).rateWeekday));
    setRateSaturday((prev) => prev || normalize((selectedPharmacy as any).rate_saturday ?? (selectedPharmacy as any).rateSaturday));
    setRateSunday((prev) => prev || normalize((selectedPharmacy as any).rate_sunday ?? (selectedPharmacy as any).rateSunday));
    setRatePublicHoliday((prev) => prev || normalize((selectedPharmacy as any).rate_public_holiday ?? (selectedPharmacy as any).ratePublicHoliday));
    setRateEarlyMorning((prev) => prev || normalize((selectedPharmacy as any).rate_early_morning ?? (selectedPharmacy as any).rateEarlyMorning));
    setRateLateNight((prev) => prev || normalize((selectedPharmacy as any).rate_late_night ?? (selectedPharmacy as any).rateLateNight));
  }, [selectedPharmacy]);

  const showSnackbar = (msg: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message: msg, severity });
  const formatErrorMessage = (err: any): string => {
    const fallback = err?.message || 'An error occurred.';
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.join('; ');
    if (typeof data === 'object') {
      const parts: string[] = [];
      Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          parts.push(`${key}: ${value.join(', ')}`);
        } else if (typeof value === 'string') {
          parts.push(`${key}: ${value}`);
        }
      });
      return parts.length ? parts.join('; ') : fallback;
    }
    return fallback;
  };
  const isLocumLike = useMemo(
    () => employmentType === 'LOCUM' || employmentType === 'CASUAL',
    [employmentType]
  );

  const steps = useMemo(() => {
    const base = [
      { key: 'details', label: 'Shift Details', icon: WorkIcon },
      { key: 'skills', label: 'Skills', icon: SkillsIcon },
      { key: 'visibility', label: 'Visibility', icon: VisibilityIcon },
    ];
    const tail = [
      ...(isLocumLike ? [{ key: 'timetable', label: 'Timetable', icon: ScheduleIcon }] : []),
      { key: 'pay', label: 'Pay Rate', icon: RateIcon },
    ];
    return [...base, ...tail];
  }, [isLocumLike]);

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
        if (!isValidDate(date)) {
          console.warn('Skipping slot with invalid date', slot, date);
          return;
        }
        const start = applyTimeToDate(date, slot.startTime);
        const end = applyTimeToDate(date, slot.endTime);
        if (!isValidDate(start) || !isValidDate(end)) {
          console.warn('Skipping slot with invalid start/end time', slot, { start, end });
          return;
        }
        events.push({
          id: `${slotIndex}-${occurrenceIndex}-${start.toISOString()}`,
          title: `${formatSlotTime(slot.startTime)} — ${formatSlotTime(slot.endTime)}`,
          start,
          end,
          resource: { slotIndex, occurrenceIndex },
        });
      };

      const baseDate = toIsoDate(slot.date);
      if (!isValidDate(baseDate)) {
        console.warn('Ignoring slot with unparsable date value', slot.date);
        return;
      }

      if (slot.isRecurring && slot.recurringEndDate && slot.recurringDays.length) {
        const endBoundary = toIsoDate(slot.recurringEndDate);
        if (!isValidDate(endBoundary)) {
          console.warn('Recurring slot has invalid end date. Falling back to single occurrence.', slot);
          addOccurrence(baseDate, 0);
          return;
        }
        let cursor: Date = baseDate;
        let occurrenceIndex = 0;
        while (cursor <= endBoundary) {
          if (slot.recurringDays.includes(cursor.getDay())) {
            addOccurrence(cursor, occurrenceIndex);
            occurrenceIndex += 1;
          }
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
      } else {
        addOccurrence(baseDate, 0);
      }
    });

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [slots]);

  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const expandedSlots = useMemo(() => {
    const occurrences: Array<{ date: string; startTime: string; endTime: string }> = [];

    slots.forEach((slot) => {
      const addOccurrence = (date: Date) => {
        if (!isValidDate(date)) return;
        occurrences.push({
          date: dayjs(date).format('YYYY-MM-DD'),
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      };

      const baseDate = toIsoDate(slot.date);
      if (!isValidDate(baseDate)) {
        return;
      }

      if (slot.isRecurring && slot.recurringEndDate && slot.recurringDays.length) {
        const endBoundary = toIsoDate(slot.recurringEndDate);
        if (!isValidDate(endBoundary)) {
          addOccurrence(baseDate);
          return;
        }
        let cursor: Date = baseDate;
        while (cursor <= endBoundary) {
          if (slot.recurringDays.includes(cursor.getDay())) {
            addOccurrence(cursor);
          }
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
      } else {
        addOccurrence(baseDate);
      }
    });

    return occurrences.sort(
      (a, b) => dayjs(`${a.date}T${a.startTime}`).valueOf() - dayjs(`${b.date}T${b.startTime}`).valueOf()
    );
  }, [slots]);

  useEffect(() => {
    if (slots.length === 0) return;
    const firstValidEvent = calendarEvents.find((event) => !Number.isNaN(event.start.getTime()));
    if (firstValidEvent && isValidDate(firstValidEvent.start)) {
      setCalendarDate(firstValidEvent.start);
    }
  }, [calendarEvents, slots.length]);

  useEffect(() => {
    setSlotRateRows((prev) =>
      expandedSlots.map((_, idx) => prev[idx] ?? { rate: '', status: 'idle' as const })
    );
  }, [expandedSlots]);

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

  const dayPropGetter = useCallback(
    (date: Date) => {
      const iso = dayjs(date).format('YYYY-MM-DD');
      if (selectedDateSet.has(iso)) {
        return {
          style: {
            backgroundColor: 'rgba(109, 40, 217, 0.12)',
            boxShadow: 'inset 0 0 0 2px rgba(109, 40, 217, 0.35)',
          },
        };
      }
      return {};
    },
    [selectedDateSet]
  );

  useEffect(() => {
    const pharmacistProvided = roleNeeded === 'PHARMACIST' && rateType === 'PHARMACIST_PROVIDED';
    const shouldCalculate = isLocumLike && pharmacyId && roleNeeded && expandedSlots.length > 0 && !pharmacistProvided;

    if (!shouldCalculate) {
      setSlotRateRows((prev) =>
        expandedSlots.map((_, idx) => prev[idx] ?? { rate: '', status: 'idle' as const })
      );
      return;
    }

    let cancelled = false;
    setSlotRateRows((prev) =>
      expandedSlots.map((_, idx) => ({
        rate: prev[idx]?.rate ?? '',
        status: 'loading' as const,
        dirty: prev[idx]?.dirty,
      }))
    );

    const payload: any = {
      pharmacyId: Number(pharmacyId),
      role: roleNeeded,
      employmentType,
      slots: expandedSlots.map((slot) => ({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    };

    if (roleNeeded === 'PHARMACIST') {
      payload.rateType = rateType || 'FLEXIBLE';
      payload.rateWeekday = rateWeekday || undefined;
      payload.rateSaturday = rateSaturday || undefined;
      payload.rateSunday = rateSunday || undefined;
      payload.ratePublicHoliday = ratePublicHoliday || undefined;
      payload.rateEarlyMorning = rateEarlyMorning || undefined;
      payload.rateLateNight = rateLateNight || undefined;
    }

    apiClient
      .post('/client-profile/shifts/calculate-rates/', payload)
      .then((resp) => {
        if (cancelled) return;
        const list: any[] = Array.isArray(resp.data) ? resp.data : [];
        setSlotRateRows((prev) =>
          expandedSlots.map((_slot, idx) => {
            const entry: any = list[idx] ?? {};
            const prior = prev[idx] ?? {};
            if (entry.error) return { ...prior, status: 'error' as const, error: String(entry.error) };
            const rateVal = entry.rate ?? entry.rate_per_hour ?? entry.value;
            const nextRate =
              prior.dirty && prior.rate !== undefined && prior.rate !== null && prior.rate !== ''
                ? prior.rate
                : rateVal != null
                  ? String(rateVal)
                  : '';
            return { ...prior, rate: nextRate, status: 'success' as const, error: undefined };
          })
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setSlotRateRows((prev) =>
          expandedSlots.map((_slot, idx) => ({
            ...(prev[idx] ?? { rate: '' }),
            status: 'error' as const,
            error: 'Unable to calculate rates',
          }))
        );
        showSnackbar(formatErrorMessage(err), 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [
    employmentType,
    expandedSlots,
    pharmacyId,
    rateEarlyMorning,
    rateLateNight,
    ratePublicHoliday,
    rateSaturday,
    rateSunday,
    rateType,
    rateWeekday,
    roleNeeded,
  ]);

  const handleSlotRateChange = (index: number, value: string) => {
    setSlotRateRows((rows) =>
      rows.map((row, idx) =>
        idx === index ? { ...row, rate: value, status: 'success', error: undefined, dirty: true } : row
      )
    );
  };

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

    const newEntries = validDates.map((date) => {
      const custom = selectedDateTimes[date];
      const startTime = custom?.startTime || slotStartTime;
      const endTime = custom?.endTime || slotEndTime;
      return {
        date,
        startTime,
        endTime,
        isRecurring: isRecurring && validDates.length === 1,
        recurringDays: isRecurring ? recurringDays : [],
        recurringEndDate: isRecurring ? recurringEndDate : '',
      };
    });

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
    setSelectedDateTimes({});
    setIsRecurring(false);
    setRecurringDays([]);
    setRecurringEndDate('');
  };

  const handleSubmit = async () => {
    if (!pharmacyId || !roleNeeded || !employmentType) return showSnackbar('Please fill all required fields in Step 1.', 'error');
    if (isLocumLike && slots.length === 0) return showSnackbar('Please add at least one schedule entry.', 'error');
    if (!isLocumLike) {
      if (ftptPayMode === 'HOURLY') {
        if (!minHourly || !maxHourly) return showSnackbar('Enter min and max hourly rates.', 'error');
      } else {
        if (!minAnnual || !maxAnnual || !superPercent) return showSnackbar('Enter min/max annual and super %.', 'error');
      }
    }

    setSubmitting(true);
    const payload: any = {
      pharmacy: pharmacyId, role_needed: roleNeeded, description, employment_type: employmentType,
      workload_tags: workloadTags, must_have: mustHave, nice_to_have: niceToHave, visibility,
      escalate_to_locum_casual: escalationDates['LOCUM_CASUAL'] || null,
      escalate_to_owner_chain: escalationDates['OWNER_CHAIN'] || null,
      escalate_to_org_chain: escalationDates['ORG_CHAIN'] || null,
      escalate_to_platform: escalationDates['PLATFORM'] || null,
      flexible_timing: flexibleTiming,
      rate_type: roleNeeded === 'PHARMACIST' ? rateType : null,
      owner_adjusted_rate: (roleNeeded !== 'PHARMACIST' && ownerBonus) ? Number(ownerBonus) : null,
      payment_preference: (employmentType === 'LOCUM' || employmentType === 'CASUAL') ? (paymentPreference || null) : null,
      single_user_only: singleUserOnly,
      post_anonymously: postAnonymously,
      slots: slots.map(s => ({
        date: s.date, start_time: s.startTime, end_time: s.endTime,
        is_recurring: s.isRecurring, recurring_days: s.recurringDays,
        recurring_end_date: s.recurringEndDate || null,
      })),
    };

    if (!isLocumLike) {
      if (ftptPayMode === 'HOURLY') {
        payload.min_hourly_rate = minHourly || null;
        payload.max_hourly_rate = maxHourly || null;
        payload.min_annual_salary = null;
        payload.max_annual_salary = null;
        payload.super_percent = null;
      } else {
        payload.min_hourly_rate = null;
        payload.max_hourly_rate = null;
        payload.min_annual_salary = minAnnual || null;
        payload.max_annual_salary = maxAnnual || null;
        payload.super_percent = superPercent || null;
      }
    }

    try {
      if (editingShiftId) {
        await updateOwnerShiftService(Number(editingShiftId), payload);
        showSnackbar('Shift updated successfully!');
      } else {
        await createOwnerShiftService(payload);
        showSnackbar('Shift posted successfully!');
      }

      const targetPath = adminRedirectBase
        ? `${adminRedirectBase}/shift-center`
        : isOrganizationUser
          ? '/dashboard/organization/shift-center/active'
          : '/dashboard/owner/shift-center';

      setTimeout(() => navigate(targetPath), 1500);
    } catch (err: any) {
      console.error('Post shift failed', err);
      showSnackbar(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };
  useEffect(() => {
    if (activeStep > steps.length - 1) {
      setActiveStep(steps.length - 1);
    }
  }, [steps.length, activeStep]);

  const renderStepContent = (step: number) => {
    const stepKey = steps[step]?.key;
    const workloadOptions = ['Sole Pharmacist', 'High Script Load', 'Webster Packs'];
    const skillOptions = ['Vaccination', 'Methadone', 'CPR', 'First Aid', 'Anaphylaxis', 'Credentialed Badge', 'PDL Insurance'];
    const ESCALATION_LABELS: Record<string, string> = { FULL_PART_TIME: 'Pharmacy Members', LOCUM_CASUAL: 'Favourite Staff', OWNER_CHAIN: 'Owner Chain', ORG_CHAIN: 'Organization', PLATFORM: 'Platform (Public)' };
    const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

    switch (stepKey) {
      case 'details': return (
        <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
          <Grid size={12}>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel>Pharmacy *</InputLabel>
              <Select
                value={pharmacyId}
                label="Pharmacy *"
                onChange={e => setPharmacyId(Number(e.target.value))}
                disabled={scopedPharmacyId != null}
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
      case 'skills': return (
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
      case 'visibility':
        const startIdx = allowedVis.indexOf(visibility);
        return (
          <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Define who sees this shift and when it escalates to wider groups.
              </Typography>
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={postAnonymously}
                    onChange={(_, checked) => setPostAnonymously(checked)}
                  />
                }
                label={
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{ display: 'block', fontWeight: 500 }}
                    >
                      Hide pharmacy name from applicants
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      When enabled, eligible workers only see the suburb while applying.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start' }}
              />
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
      case 'timetable': {
        return (
          <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 0 }}>
            <Grid size={{ xs: 12 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 3,
                  borderColor: 'grey.200',
                  bgcolor: 'grey.50',
                  mx: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  alignItems: 'flex-start',
                  width: '100%',
                }}
              >
                <FormControlLabel
                  control={<Checkbox size="small" checked={flexibleTiming} onChange={e => setFlexibleTiming(e.target.checked)} />}
                  label="Flexible timing (start/end may adjust)"
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={singleUserOnly} onChange={e => setSingleUserOnly(e.target.checked)} />}
                  label="A single person must work all timetable entries"
                />
              </Paper>
            </Grid>

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
                        <Button size="small" onClick={() => { setSelectedDates([]); setSelectedDateTimes({}); }}>
                          Clear
                        </Button>
                      </Stack>
                      <Stack spacing={1}>
                        {selectedDates.map((date) => {
                          const times = selectedDateTimes[date] || { startTime: slotStartTime, endTime: slotEndTime };
                          return (
                            <Box
                              key={date}
                              sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1,
                                alignItems: 'center',
                                border: '1px solid',
                                borderColor: 'grey.200',
                                borderRadius: 1,
                                p: 1,
                              }}
                            >
                              <Chip
                                label={formatSlotDate(date)}
                                onDelete={() => {
                                  setSelectedDates((prev) => prev.filter((d) => d !== date));
                                  setSelectedDateTimes((prev) => {
                                    const next = { ...prev };
                                    delete next[date];
                                    return next;
                                  });
                                }}
                              />
                              <TextField
                                label="Start"
                                type="time"
                                value={times.startTime}
                                onChange={(e) =>
                                  setSelectedDateTimes((prev) => ({
                                    ...prev,
                                    [date]: { startTime: e.target.value, endTime: times.endTime },
                                  }))
                                }
                                size="small"
                                sx={{ width: 140 }}
                                InputLabelProps={{ shrink: true }}
                              />
                              <TextField
                                label="End"
                                type="time"
                                value={times.endTime}
                                onChange={(e) =>
                                  setSelectedDateTimes((prev) => ({
                                    ...prev,
                                    [date]: { startTime: times.startTime, endTime: e.target.value },
                                  }))
                                }
                                size="small"
                                sx={{ width: 140 }}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Adjust times per day, then press “Add slot” to add entries for every selected day.
                      </Typography>
                    </Stack>
                  </Paper>
                )}

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: 'grey.200' }}>
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
                  height: { xs: 420, sm: 460, md: 540 },
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
                    dayPropGetter={dayPropGetter}
                    date={safeCalendarDate}
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
                      if (!isValidDate(newDate)) {
                        console.warn('Ignoring calendar navigation to invalid date', newDate);
                        return;
                      }
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
                    min={calendarTimeBounds.min}
                    max={calendarTimeBounds.max}
                    onSelectSlot={({ start, end, slots }: CalendarSlotSelection) => {
                      const startMoment = dayjs(start as Date);
                      const endMoment = dayjs(end as Date);

                      if (startMoment.isBefore(todayStart, 'minute')) {
                        showSnackbar('Cannot select time in the past.', 'error');
                        return;
                      }

                      if (calendarView === 'week' || calendarView === 'day') {
                        const dateStr = startMoment.format('YYYY-MM-DD');
                        setSelectedDates([dateStr]);
                        setSlotDate(dateStr);
                        setSlotStartTime(startMoment.format('HH:mm'));
                        let endCandidate = endMoment;
                        if (!endMoment.isAfter(startMoment)) {
                          endCandidate = startMoment.add(1, 'hour');
                        }
                        const endVal = endCandidate.format('HH:mm');
                        setSlotEndTime(endVal);
                        setSelectedDateTimes({ [dateStr]: { startTime: startMoment.format('HH:mm'), endTime: endVal } });
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
                      setSelectedDateTimes(
                        Object.fromEntries(
                          sortedDates.map((d) => [d, { startTime: slotStartTime, endTime: slotEndTime }])
                        )
                      );
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
                          setSelectedDateTimes({ [slot.date]: { startTime: slot.startTime, endTime: slot.endTime } });
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
      case 'pay': {
        const showSlotPreview = isLocumLike && !(roleNeeded === 'PHARMACIST' && rateType === 'PHARMACIST_PROVIDED');
        const paymentField = isLocumLike ? (
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <InputLabel>Payment Type</InputLabel>
              <Select
                value={paymentPreference}
                label="Payment Type"
                onChange={e => setPaymentPreference(e.target.value)}
              >
                <MenuItem value="ABN">ABN</MenuItem>
                <MenuItem value="TFN">TFN</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        ) : null;

        if (!isLocumLike) {
          return (
            <Stack spacing={3}>
              <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel>Pay Basis</InputLabel>
                    <Select
                      value={ftptPayMode}
                      label="Pay Basis"
                      onChange={e => setFtptPayMode(e.target.value as 'HOURLY' | 'ANNUAL')}
                    >
                      <MenuItem value="HOURLY">Hourly</MenuItem>
                      <MenuItem value="ANNUAL">Annual Package</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {ftptPayMode === 'HOURLY' ? (
                <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Min Hourly Rate ($/hr)"
                      type="number"
                      value={minHourly}
                      onChange={e => setMinHourly(e.target.value)}
                      fullWidth
                      size="small"
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Max Hourly Rate ($/hr)"
                      type="number"
                      value={maxHourly}
                      onChange={e => setMaxHourly(e.target.value)}
                      fullWidth
                      size="small"
                      sx={fieldSx}
                    />
                  </Grid>
                </Grid>
              ) : (
                <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Min Annual Package ($)"
                      type="number"
                      value={minAnnual}
                      onChange={e => setMinAnnual(e.target.value)}
                      fullWidth
                      size="small"
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Max Annual Package ($)"
                      type="number"
                      value={maxAnnual}
                      onChange={e => setMaxAnnual(e.target.value)}
                      fullWidth
                      size="small"
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Super (%)"
                      type="number"
                      value={superPercent}
                      onChange={e => setSuperPercent(e.target.value)}
                      fullWidth
                      size="small"
                      sx={fieldSx}
                    />
                  </Grid>
                </Grid>
              )}
            </Stack>
          );
        }

        const renderSlotPreviewList = () => {
          if (!showSlotPreview || expandedSlots.length === 0) return null;
          return (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: 'grey.200' }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Slot rate preview
                </Typography>
                <Stack spacing={1}>
                  {expandedSlots.map((slot, idx) => {
                    const row = slotRateRows[idx] ?? { rate: '', status: 'idle' as const };
                    const baseNum = Number(row.rate);
                    const rateValid = Number.isFinite(baseNum);
                    const bonusNum = Number(ownerBonus);
                    const bonusValid = Number.isFinite(bonusNum);
                    const finalNum = roleNeeded === 'PHARMACIST'
                      ? (rateValid ? baseNum : null)
                      : (rateValid ? baseNum : 0) + (bonusValid ? bonusNum : 0);
                    const finalLabel =
                      finalNum != null && Number.isFinite(finalNum)
                        ? `$${finalNum.toFixed(2)}/hr`
                        : '$0.00/hr';
                    return (
                      <Stack
                        key={`${slot.date}-${slot.startTime}-${idx}`}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                      >
                        <Typography variant="body2" sx={{ minWidth: 180 }}>
                          {`${slot.date} · ${slot.startTime}—${slot.endTime}`}
                        </Typography>
                        <TextField
                          label="Rate ($/hr)"
                          type="number"
                          value={row.rate}
                          onChange={(e) => handleSlotRateChange(idx, e.target.value)}
                          size="small"
                          sx={{ width: 140 }}
                          error={row.status === 'error'}
                          helperText={row.status === 'error' ? (row.error || 'Error') : ''}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {row.status === 'loading' ? 'Calculating...' : `Final: ${finalLabel}`}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Stack>
            </Paper>
          );
        };

        if (roleNeeded === 'PHARMACIST') {
          return (
            <Stack spacing={3}>
              <Grid container rowSpacing={3} columnSpacing={{ xs: 0, md: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel>Rate Type</InputLabel>
                    <Select
                      value={rateType}
                      label="Rate Type"
                      onChange={e => setRateType(e.target.value)}
                    >
                      <MenuItem value="FLEXIBLE">Flexible Rate</MenuItem>
                      <MenuItem value="FIXED">Fixed Rate</MenuItem>
                      <MenuItem value="PHARMACIST_PROVIDED">Pharmacist Provided</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {paymentField}
              </Grid>

              {rateType !== 'PHARMACIST_PROVIDED' && (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: 'grey.200' }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Base rates ($/hr)
                    </Typography>
                    <Grid container rowSpacing={2} columnSpacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Weekday"
                          type="number"
                          value={rateWeekday}
                          onChange={e => setRateWeekday(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Saturday"
                          type="number"
                          value={rateSaturday}
                          onChange={e => setRateSaturday(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Sunday"
                          type="number"
                          value={rateSunday}
                          onChange={e => setRateSunday(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Public Holiday"
                          type="number"
                          value={ratePublicHoliday}
                          onChange={e => setRatePublicHoliday(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Early Morning"
                          type="number"
                          value={rateEarlyMorning}
                          onChange={e => setRateEarlyMorning(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Late Night"
                          type="number"
                          value={rateLateNight}
                          onChange={e => setRateLateNight(e.target.value)}
                          fullWidth
                          size="small"
                          sx={fieldSx}
                        />
                      </Grid>
                    </Grid>
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={applyRatesToPharmacy}
                          onChange={(_, checked) => setApplyRatesToPharmacy(checked)}
                        />
                      )}
                      label="Apply these rates to Pharmacy defaults"
                    />
                  </Stack>
                </Paper>
              )}

              {renderSlotPreviewList()}
            </Stack>
          );
        }

        return (
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
            {paymentField}
            <TextField
              label="Owner Bonus ($/hr, optional)"
              type="number"
              value={ownerBonus}
              onChange={e => setOwnerBonus(e.target.value)}
              fullWidth
              helperText="This bonus is added to the award rate."
              size="small"
              sx={fieldSx}
            />
            {renderSlotPreviewList()}
          </Stack>
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
      <Container
        maxWidth={false}
        sx={{
          px: { xs: 1.5, sm: 2.5, md: 4 },
          py: 4,
          bgcolor: '#F9FAFB',
          minHeight: '100vh',
          maxWidth: { xs: '100%', lg: 1200, xl: 1400 },
        }}
      >
        <Paper
          sx={{
            p: { xs: 2, md: 4 },
            borderRadius: 4,
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.1)',
            width: '100%',
          }}
        >
          <Typography variant="h4" gutterBottom align="center" fontWeight={600}>{editingShiftId ? 'Edit Shift' : 'Create a New Shift'}</Typography>
          <Typography variant="body1" color="text.secondary" align="center" mb={4}>Follow the steps to post a new shift opportunity.</Typography>

          <Stepper
            activeStep={activeStep}
            alternativeLabel={!isMobile}
            orientation={isMobile ? 'vertical' : 'horizontal'}
            connector={<StepConnectorStyled />}
            sx={{ mb: 3, px: { xs: 1, sm: 4 } }}
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

          <Box sx={{ minHeight: 350, px: { xs: 0, md: 2.5 }, pt: 0.5 }}>
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
