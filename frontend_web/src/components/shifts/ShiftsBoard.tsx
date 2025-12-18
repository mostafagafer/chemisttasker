import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  AccessTime as AccessTimeIcon,
  AttachMoney as AttachMoneyIcon,
  Bolt as BoltIcon,
  CalendarToday as CalendarTodayIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Close as CloseIcon,
  DateRange as DateRangeIcon,
  DarkMode as DarkModeIcon,
  ErrorOutline as ErrorOutlineIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Favorite as FavoriteIcon,
  FilterList as FilterListIcon,
  Flight as FlightIcon,
  Hotel as HotelIcon,
  Layers as LayersIcon,
  Paid as PaidIcon,
  Place as PlaceIcon,
  Search as SearchIcon,
  SwapVert as SwapVertIcon,
  Tune as TuneIcon,
  WbSunny as WbSunnyIcon,
  WbTwilight as WbTwilightIcon,
  WorkOutline as WorkOutlineIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {
  Shift,
  ShiftCounterOfferPayload,
  storageGetItem,
  storageRemoveItem,
  storageSetItem,
} from '@chemisttasker/shared-core';

const SAVED_STORAGE_KEY = 'saved_shift_ids';

type ShiftSlot = NonNullable<Shift['slots']>[number];

type CounterOfferFormSlot = {
  slotId: number;
  dateLabel: string;
  startTime: string;
  endTime: string;
  rate: string;
};

type ShiftsBoardProps = {
  title: string;
  shifts: Shift[];
  loading?: boolean;
  onApplyAll: (shift: Shift) => Promise<void> | void;
  onApplySlot: (shift: Shift, slotId: number) => Promise<void> | void;
  onSubmitCounterOffer?: (payload: ShiftCounterOfferPayload) => Promise<void> | void;
  onRejectShift?: (shift: Shift) => Promise<void> | void;
  onRejectSlot?: (shift: Shift, slotId: number) => Promise<void> | void;
  initialAppliedShiftIds?: number[];
  initialAppliedSlotIds?: number[];
  initialRejectedShiftIds?: number[];
  initialRejectedSlotIds?: number[];
};

type SortKey = 'date' | 'rate' | 'distance';

type FilterConfig = {
  city: string[];
  roles: string[];
  employmentTypes: string[];
  minRate: number;
  search: string;
  timeOfDay: Array<'morning' | 'afternoon' | 'evening'>;
  dateRange: { start: string; end: string };
  onlyUrgent: boolean;
  negotiableOnly: boolean;
  flexibleOnly: boolean;
  travelProvided: boolean;
  accommodationProvided: boolean;
  bulkShiftsOnly: boolean;
};

const formatDateShort = (value?: string | null) =>
  value ? dayjs(value).format('ddd, D MMM') : '';

const formatDateLong = (value?: string | null) =>
  value ? dayjs(value).format('dddd, D MMMM') : '';

const formatTime = (value?: string | null) =>
  value ? dayjs(`1970-01-01T${value}`).format('HH:mm') : '';

const getSlotRate = (slot: ShiftSlot, shift: Shift) => {
  if (slot?.rate != null && slot.rate !== '') return Number(slot.rate);
  if (shift.fixedRate != null) return Number(shift.fixedRate);
  return 0;
};

const getStartHour = (slot: ShiftSlot) => {
  if (slot.startHour != null) return Number(slot.startHour);
  if (!slot.startTime) return null;
  return Number(slot.startTime.split(':')[0]);
};

const getShiftRoleLabel = (shift: Shift) => shift.roleLabel ?? shift.roleNeeded ?? 'Role';
const getShiftAddress = (shift: Shift) => shift.uiAddressLine ?? '';
const getShiftCity = (shift: Shift) => shift.uiLocationCity ?? '';
const getShiftState = (shift: Shift) => shift.uiLocationState ?? '';
const getShiftNegotiable = (shift: Shift) => Boolean(shift.uiIsNegotiable ?? (shift.rateType === 'FLEXIBLE'));
const getShiftFlexibleTime = (shift: Shift) => Boolean(shift.uiIsFlexibleTime ?? shift.flexibleTiming);
const getShiftUrgent = (shift: Shift) => Boolean(shift.uiIsUrgent ?? shift.isUrgent);
const getShiftAllowPartial = (shift: Shift) => Boolean(shift.uiAllowPartial ?? !shift.singleUserOnly);
const getShiftDistance = (shift: Shift) => {
  const value = shift.uiDistanceKm;
  return typeof value === 'number' ? value : null;
};
const getShiftPharmacyName = (shift: Shift) => {
  const pharmacy = shift.pharmacyDetail;
  if (shift.postAnonymously) {
    const suburb = shift.uiLocationCity || pharmacy?.suburb;
    return suburb ? `Shift in ${suburb}` : 'Anonymous Pharmacy';
  }
  return pharmacy?.name ?? 'Pharmacy';
};
const getFirstSlot = (shift: Shift) => shift.slots?.[0];
const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return 'N/A';
  return value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const getRateSummary = (shift: Shift) => {
  const isFullOrPartTime = ['FULL_TIME', 'PART_TIME'].includes(shift.employmentType ?? '');
  const minAnnual = shift.minAnnualSalary != null ? Number(shift.minAnnualSalary) : null;
  const maxAnnual = shift.maxAnnualSalary != null ? Number(shift.maxAnnualSalary) : null;
  const minHourly = shift.minHourlyRate != null ? Number(shift.minHourlyRate) : null;
  const maxHourly = shift.maxHourlyRate != null ? Number(shift.maxHourlyRate) : null;

  if (isFullOrPartTime) {
    if (minAnnual || maxAnnual) {
      const display = minAnnual && maxAnnual
        ? `${formatCurrency(minAnnual)} - ${formatCurrency(maxAnnual)}`
        : `${formatCurrency(minAnnual ?? maxAnnual ?? 0)}`;
      return { display, unitLabel: 'Package' };
    }
    if (minHourly || maxHourly) {
      const display = minHourly && maxHourly
        ? `${formatCurrency(minHourly)} - ${formatCurrency(maxHourly)}`
        : `${formatCurrency(minHourly ?? maxHourly ?? 0)}`;
      return { display, unitLabel: '/hr' };
    }
  }

  if (shift.fixedRate != null) {
    return { display: formatCurrency(Number(shift.fixedRate)), unitLabel: '/hr' };
  }

  const rates = (shift.slots ?? [])
    .map((slot) => getSlotRate(slot, shift))
    .filter((rate) => Number.isFinite(rate) && rate > 0);
  if (rates.length === 0) return { display: 'N/A', unitLabel: '/hr' };
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const display = minRate === maxRate ? `${formatCurrency(minRate)}` : `${formatCurrency(minRate)} - ${formatCurrency(maxRate)}`;
  return { display, unitLabel: '/hr' };
};

const getEmploymentLabel = (shift: Shift) => {
  if (shift.employmentType === 'FULL_TIME') return 'Full-time role';
  if (shift.employmentType === 'PART_TIME') return 'Part-time role';
  if (shift.employmentType === 'LOCUM') return 'Locum role';
  return 'Shift';
};

const filterSections = {
  roles: 'Job Role',
  dateRange: 'Date Range',
  perks: 'Perks & Benefits',
  locations: 'Locations',
  timeOfDay: 'Time of Day',
  minRate: 'Min Rate',
  employment: 'Employment Type',
};

const ShiftsBoard: React.FC<ShiftsBoardProps> = ({
  title,
  shifts,
  loading,
  onApplyAll,
  onApplySlot,
  onSubmitCounterOffer,
  onRejectShift,
  onRejectSlot,
  initialAppliedShiftIds,
  initialAppliedSlotIds,
  initialRejectedShiftIds,
  initialRejectedSlotIds,
}) => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [activeTab, setActiveTab] = useState<'browse' | 'saved'>('browse');
  const [savedShiftIds, setSavedShiftIds] = useState<Set<number>>(new Set());
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    city: [],
    roles: [],
    employmentTypes: [],
    minRate: 0,
    search: '',
    timeOfDay: [],
    dateRange: { start: '', end: '' },
    onlyUrgent: false,
    negotiableOnly: false,
    flexibleOnly: false,
    travelProvided: false,
    accommodationProvided: false,
    bulkShiftsOnly: false,
  });
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({
    key: 'date',
    direction: 'ascending',
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [selectedSlotIds, setSelectedSlotIds] = useState<Record<number, Set<number>>>({});
  const [appliedShiftIds, setAppliedShiftIds] = useState<Set<number>>(new Set(initialAppliedShiftIds ?? []));
  const [appliedSlotIds, setAppliedSlotIds] = useState<Set<number>>(new Set(initialAppliedSlotIds ?? []));
  const [rejectedShiftIds, setRejectedShiftIds] = useState<Set<number>>(new Set(initialRejectedShiftIds ?? []));
  const [rejectedSlotIds, setRejectedSlotIds] = useState<Set<number>>(new Set(initialRejectedSlotIds ?? []));

  const [counterOfferOpen, setCounterOfferOpen] = useState(false);
  const [counterOfferShift, setCounterOfferShift] = useState<Shift | null>(null);
  const [counterOfferSlots, setCounterOfferSlots] = useState<CounterOfferFormSlot[]>([]);
  const [counterOfferMessage, setCounterOfferMessage] = useState('');
  const [counterOfferTravel, setCounterOfferTravel] = useState(false);

  const savedLoadRef = useRef(false);

  useEffect(() => {
    if (savedLoadRef.current) return;
    savedLoadRef.current = true;
    storageGetItem(SAVED_STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setSavedShiftIds(new Set(parsed.filter((id) => Number.isFinite(id))));
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const list = Array.from(savedShiftIds);
    if (list.length === 0) {
      storageRemoveItem(SAVED_STORAGE_KEY).catch(() => null);
      return;
    }
    storageSetItem(SAVED_STORAGE_KEY, JSON.stringify(list)).catch(() => null);
  }, [savedShiftIds]);

  useEffect(() => {
    setAppliedShiftIds(new Set(initialAppliedShiftIds ?? []));
  }, [initialAppliedShiftIds]);

  useEffect(() => {
    setAppliedSlotIds(new Set(initialAppliedSlotIds ?? []));
  }, [initialAppliedSlotIds]);

  useEffect(() => {
    setRejectedShiftIds(new Set(initialRejectedShiftIds ?? []));
  }, [initialRejectedShiftIds]);

  useEffect(() => {
    setRejectedSlotIds(new Set(initialRejectedSlotIds ?? []));
  }, [initialRejectedSlotIds]);

  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((shift) => {
      const label = getShiftRoleLabel(shift);
      if (label) set.add(label);
    });
    return Array.from(set).sort();
  }, [shifts]);

  const locationGroups = useMemo(() => {
    const groups: Record<string, Set<string>> = {};
    shifts.forEach((shift) => {
      const state = getShiftState(shift);
      const city = getShiftCity(shift);
      if (!state || !city) return;
      if (!groups[state]) groups[state] = new Set();
      groups[state].add(city);
    });
    return groups;
  }, [shifts]);

  const toggleSaveShift = (shiftId: number) => {
    setSavedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.add(shiftId);
      }
      return next;
    });
  };

  const toggleSlotSelection = (shiftId: number, slotId: number) => {
    setSelectedSlotIds((prev) => {
      const next = { ...prev };
      const current = new Set(next[shiftId] ?? []);
      if (current.has(slotId)) {
        current.delete(slotId);
      } else {
        current.add(slotId);
      }
      next[shiftId] = current;
      return next;
    });
  };

  const clearSelection = (shiftId: number) => {
    setSelectedSlotIds((prev) => {
      const next = { ...prev };
      delete next[shiftId];
      return next;
    });
  };

  const toggleFilter = (key: keyof FilterConfig, value: string) => {
    setFilterConfig((prev) => {
      const current = prev[key] as string[];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter((item) => item !== value) };
      }
      return { ...prev, [key]: [...current, value] };
    });
  };

  const toggleBooleanFilter = (key: keyof FilterConfig) => {
    setFilterConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStateExpand = (state: string) => {
    setExpandedStates((prev) => ({ ...prev, [state]: !prev[state] }));
  };

  const toggleStateSelection = (cities: string[]) => {
    setFilterConfig((prev) => {
      const current = prev.city;
      const allSelected = cities.every((city) => current.includes(city));
      const nextCities = allSelected
        ? current.filter((city) => !cities.includes(city))
        : [...current, ...cities.filter((city) => !current.includes(city))];
      return { ...prev, city: nextCities };
    });
  };

  const handleSortChange = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  };

  const clearAllFilters = () => {
    setFilterConfig({
      city: [],
      roles: [],
      employmentTypes: [],
      minRate: 0,
      search: '',
      timeOfDay: [],
      dateRange: { start: '', end: '' },
      onlyUrgent: false,
      negotiableOnly: false,
      flexibleOnly: false,
      travelProvided: false,
      accommodationProvided: false,
      bulkShiftsOnly: false,
    });
  };

  const activeFilterCount =
    filterConfig.city.length +
    filterConfig.roles.length +
    filterConfig.employmentTypes.length +
    filterConfig.timeOfDay.length +
    (filterConfig.minRate > 0 ? 1 : 0) +
    (filterConfig.search ? 1 : 0) +
    (filterConfig.onlyUrgent ? 1 : 0) +
    (filterConfig.negotiableOnly ? 1 : 0) +
    (filterConfig.flexibleOnly ? 1 : 0) +
    (filterConfig.travelProvided ? 1 : 0) +
    (filterConfig.accommodationProvided ? 1 : 0) +
    (filterConfig.bulkShiftsOnly ? 1 : 0) +
    (filterConfig.dateRange.start || filterConfig.dateRange.end ? 1 : 0);

  const processedShifts = useMemo(() => {
    let result = [...shifts];
    if (activeTab === 'saved') {
      result = result.filter((shift) => savedShiftIds.has(shift.id));
    }

    result = result.filter((shift) => {
      const slots = shift.slots ?? [];
      const hasOverlap = (predicate: (slot: ShiftSlot) => boolean) => slots.some(predicate);

      if (filterConfig.onlyUrgent && !getShiftUrgent(shift)) return false;
      if (filterConfig.negotiableOnly && !getShiftNegotiable(shift)) return false;
      if (filterConfig.flexibleOnly && !getShiftFlexibleTime(shift)) return false;
      if (filterConfig.travelProvided && !shift.hasTravel) return false;
      if (filterConfig.accommodationProvided && !shift.hasAccommodation) return false;
      if (filterConfig.bulkShiftsOnly && slots.length < 5) return false;
      if (filterConfig.city.length > 0 && !filterConfig.city.includes(getShiftCity(shift))) return false;
      if (filterConfig.roles.length > 0 && !filterConfig.roles.includes(getShiftRoleLabel(shift))) return false;
      if (filterConfig.employmentTypes.length > 0) {
        const employmentType = (shift.employmentType ?? '').toString();
        if (!filterConfig.employmentTypes.includes(employmentType)) return false;
      }

      if (filterConfig.timeOfDay.length > 0) {
        const matchesTime = hasOverlap((slot) => {
          const hour = getStartHour(slot);
          if (hour == null) return false;
          const matchesMorning = filterConfig.timeOfDay.includes('morning') && hour < 12;
          const matchesAfternoon = filterConfig.timeOfDay.includes('afternoon') && hour >= 12 && hour < 17;
          const matchesEvening = filterConfig.timeOfDay.includes('evening') && hour >= 17;
          return matchesMorning || matchesAfternoon || matchesEvening;
        });
        if (!matchesTime) return false;
      }

      if (filterConfig.dateRange.start || filterConfig.dateRange.end) {
        const startFilter = filterConfig.dateRange.start
          ? dayjs(filterConfig.dateRange.start).startOf('day')
          : dayjs('1970-01-01');
        const endFilter = filterConfig.dateRange.end
          ? dayjs(filterConfig.dateRange.end).endOf('day')
          : dayjs('2100-01-01');
        const matchesDate = hasOverlap((slot) => {
          const slotDate = dayjs(slot.date);
          return (
            slotDate.isSame(startFilter) ||
            slotDate.isSame(endFilter) ||
            (slotDate.isAfter(startFilter) && slotDate.isBefore(endFilter))
          );
        });
        if (!matchesDate) return false;
      }

      if (filterConfig.minRate > 0) {
        const maxRate = Math.max(
          ...(slots || []).map((slot) => getSlotRate(slot, shift)).filter((rate) => Number.isFinite(rate))
        );
        if (!Number.isFinite(maxRate) || maxRate < filterConfig.minRate) return false;
      }

      if (filterConfig.search) {
        const search = filterConfig.search.toLowerCase();
        const matches =
          getShiftPharmacyName(shift).toLowerCase().includes(search) ||
          getShiftAddress(shift).toLowerCase().includes(search) ||
          getShiftRoleLabel(shift).toLowerCase().includes(search);
        if (!matches) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      if (sortConfig.key === 'date') {
        aVal = getFirstSlot(a)?.date ?? '';
        bVal = getFirstSlot(b)?.date ?? '';
      } else if (sortConfig.key === 'rate') {
        aVal = Math.max(
          ...(a.slots ?? []).map((slot) => getSlotRate(slot, a)).filter((rate) => Number.isFinite(rate))
        );
        bVal = Math.max(
          ...(b.slots ?? []).map((slot) => getSlotRate(slot, b)).filter((rate) => Number.isFinite(rate))
        );
      } else if (sortConfig.key === 'distance') {
        aVal = getShiftDistance(a) ?? Number.POSITIVE_INFINITY;
        bVal = getShiftDistance(b) ?? Number.POSITIVE_INFINITY;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });

    return result;
  }, [shifts, activeTab, savedShiftIds, filterConfig, sortConfig]);

  const openCounterOffer = (shift: Shift, selectedSlots?: Set<number>) => {
    if (!onSubmitCounterOffer) return;
    const slots = shift.slots ?? [];
    const slotIds = selectedSlots && selectedSlots.size > 0 ? selectedSlots : null;
    const slotsToUse = slotIds ? slots.filter((slot) => slotIds.has(slot.id)) : slots;

    setCounterOfferShift(shift);
    setCounterOfferMessage('');
    setCounterOfferTravel(false);
    setCounterOfferSlots(
      slotsToUse.map((slot) => ({
        slotId: slot.id,
        dateLabel: formatDateShort(slot.date),
        startTime: slot.startTime,
        endTime: slot.endTime,
        rate: getSlotRate(slot, shift).toString(),
      }))
    );
    setCounterOfferOpen(true);
  };

  const closeCounterOffer = () => {
    setCounterOfferOpen(false);
    setCounterOfferShift(null);
    setCounterOfferSlots([]);
  };

  const handleCounterSlotChange = (slotId: number, key: keyof CounterOfferFormSlot, value: string) => {
    setCounterOfferSlots((prev) =>
      prev.map((slot) => (slot.slotId === slotId ? { ...slot, [key]: value } : slot))
    );
  };

  const handleSubmitCounterOffer = async () => {
    if (!counterOfferShift || !onSubmitCounterOffer) return;
    const payload: ShiftCounterOfferPayload = {
      shiftId: counterOfferShift.id,
      message: counterOfferMessage,
      requestTravel: counterOfferTravel,
      slots: counterOfferSlots.map((slot) => ({
        slotId: slot.slotId,
        proposedStartTime: slot.startTime,
        proposedEndTime: slot.endTime,
        proposedRate: slot.rate ? Number(slot.rate) : null,
      })),
    };

    await onSubmitCounterOffer(payload);
    closeCounterOffer();
  };

  const handleApplyAll = async (shift: Shift) => {
    await onApplyAll(shift);
    setAppliedShiftIds((prev) => new Set([...Array.from(prev), shift.id]));
    const slots = shift.slots ?? [];
    if (slots.length > 0) {
      setAppliedSlotIds((prev) => new Set([...Array.from(prev), ...slots.map((slot) => slot.id)]));
    }
  };

  const handleApplySlot = async (shift: Shift, slotId: number) => {
    await onApplySlot(shift, slotId);
    setAppliedSlotIds((prev) => new Set([...Array.from(prev), slotId]));
  };

  const handleRejectShift = async (shift: Shift) => {
    if (!onRejectShift) return;
    await onRejectShift(shift);
    setRejectedShiftIds((prev) => new Set([...Array.from(prev), shift.id]));
    setAppliedShiftIds((prev) => {
      const next = new Set(prev);
      next.delete(shift.id);
      return next;
    });
    const slots = shift.slots ?? [];
    if (slots.length > 0) {
      setAppliedSlotIds((prev) => {
        const next = new Set(prev);
        slots.forEach((slot) => next.delete(slot.id));
        return next;
      });
      setRejectedSlotIds((prev) => new Set([...Array.from(prev), ...slots.map((slot) => slot.id)]));
    }
    clearSelection(shift.id);
  };

  const handleRejectSlot = async (shift: Shift, slotId: number) => {
    if (!onRejectSlot) return;
    await onRejectSlot(shift, slotId);
    setRejectedSlotIds((prev) => new Set([...Array.from(prev), slotId]));
    setAppliedSlotIds((prev) => {
      const next = new Set(prev);
      next.delete(slotId);
      return next;
    });
    setSelectedSlotIds((prev) => {
      const next = { ...prev };
      const current = new Set(next[shift.id] ?? []);
      current.delete(slotId);
      next[shift.id] = current;
      return next;
    });
  };

  const toggleExpandedCard = (shiftId: number) => {
    setExpandedCards((prev) => ({ ...prev, [shiftId]: !prev[shiftId] }));
  };

  const renderFilterSection = (title: string, content: React.ReactNode, isOpen = true, onToggle?: () => void) => (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'grey.100', pb: 2.5, mb: 2.5 }}>
      <Button
        onClick={onToggle}
        fullWidth
        sx={{
          justifyContent: 'space-between',
          textTransform: 'none',
          color: 'text.secondary',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: 1,
        }}
      >
        {title}
        {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Button>
      {isOpen && <Box>{content}</Box>}
    </Box>
  );

  const sidebarContent = (
    <Box sx={{ px: 2.5, py: 2 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search pharmacy, role..."
        value={filterConfig.search}
        onChange={(event) => setFilterConfig((prev) => ({ ...prev, search: event.target.value }))}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={filterConfig.onlyUrgent}
              onChange={() => toggleBooleanFilter('onlyUrgent')}
              icon={<BoltIcon fontSize="small" />}
              checkedIcon={<BoltIcon fontSize="small" />}
            />
          }
          label="Urgent only"
        />
      </Box>

      {renderFilterSection(
        filterSections.roles,
        <Stack spacing={1}>
          {uniqueRoles.map((role) => (
            <FormControlLabel
              key={role}
              control={
                <Checkbox
                  checked={filterConfig.roles.includes(role)}
                  onChange={() => toggleFilter('roles', role)}
                />
              }
              label={role}
            />
          ))}
        </Stack>
      )}

      {renderFilterSection(
        filterSections.dateRange,
        <Stack spacing={1.5}>
          <TextField
            type="date"
            label="From"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filterConfig.dateRange.start}
            onChange={(event) =>
              setFilterConfig((prev) => ({
                ...prev,
                dateRange: { ...prev.dateRange, start: event.target.value },
              }))
            }
          />
          <TextField
            type="date"
            label="To"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={filterConfig.dateRange.end}
            onChange={(event) =>
              setFilterConfig((prev) => ({
                ...prev,
                dateRange: { ...prev.dateRange, end: event.target.value },
              }))
            }
          />
        </Stack>
      )}

      {renderFilterSection(
        filterSections.perks,
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={filterConfig.bulkShiftsOnly}
                onChange={() => toggleBooleanFilter('bulkShiftsOnly')}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <DateRangeIcon fontSize="small" />
                <span>Bulk shifts (1 week+)</span>
              </Stack>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filterConfig.negotiableOnly}
                onChange={() => toggleBooleanFilter('negotiableOnly')}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <PaidIcon fontSize="small" />
                <span>Negotiable rate</span>
              </Stack>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filterConfig.flexibleOnly}
                onChange={() => toggleBooleanFilter('flexibleOnly')}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <SwapVertIcon fontSize="small" />
                <span>Flexible hours</span>
              </Stack>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filterConfig.travelProvided}
                onChange={() => toggleBooleanFilter('travelProvided')}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <FlightIcon fontSize="small" />
                <span>Travel paid</span>
              </Stack>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filterConfig.accommodationProvided}
                onChange={() => toggleBooleanFilter('accommodationProvided')}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <HotelIcon fontSize="small" />
                <span>Accommodation</span>
              </Stack>
            }
          />
        </Stack>
      )}

      {renderFilterSection(
        filterSections.employment,
        <Stack spacing={1}>
          {[
            { id: 'FULL_TIME', label: 'Full-time' },
            { id: 'PART_TIME', label: 'Part-time' },
            { id: 'LOCUM', label: 'Locum' },
          ].map((item) => (
            <FormControlLabel
              key={item.id}
              control={
                <Checkbox
                  checked={filterConfig.employmentTypes.includes(item.id)}
                  onChange={() => toggleFilter('employmentTypes', item.id)}
                />
              }
              label={item.label}
            />
          ))}
        </Stack>
      )}

      {renderFilterSection(
        filterSections.locations,
        <Stack spacing={1}>
          {Object.entries(locationGroups).map(([state, citiesSet]) => {
            const cities = Array.from(citiesSet).sort();
            const isExpanded = !!expandedStates[state];
            const allSelected = cities.every((city) => filterConfig.city.includes(city));
            const someSelected = cities.some((city) => filterConfig.city.includes(city));

            return (
              <Box key={state} sx={{ borderBottom: '1px solid', borderColor: 'grey.100', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                onChange={() => toggleStateSelection(cities)}
                      />
                    }
                    label={<Typography fontWeight={700}>{state}</Typography>}
                  />
                  <IconButton size="small" onClick={() => toggleStateExpand(state)}>
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </Box>
                {isExpanded && (
                  <Stack spacing={0.5} sx={{ pl: 3 }}>
                    {cities.map((city) => (
                      <FormControlLabel
                        key={city}
                        control={
                          <Checkbox
                            checked={filterConfig.city.includes(city)}
                            onChange={() => toggleFilter('city', city)}
                          />
                        }
                        label={city}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      {renderFilterSection(
        filterSections.timeOfDay,
        <Grid container spacing={1}>
          {[
            { id: 'morning', label: 'Morning', icon: <WbSunnyIcon fontSize="small" /> },
            { id: 'afternoon', label: 'Afternoon', icon: <WbTwilightIcon fontSize="small" /> },
            { id: 'evening', label: 'Evening', icon: <DarkModeIcon fontSize="small" /> },
          ].map((entry) => {
            const active = filterConfig.timeOfDay.includes(entry.id as 'morning' | 'afternoon' | 'evening');
            return (
              <Grid key={entry.id} size={{ xs: 4 }}>
                <Button
                  variant={active ? 'contained' : 'outlined'}
                  onClick={() => toggleFilter('timeOfDay', entry.id)}
                  fullWidth
                  sx={{ textTransform: 'none', gap: 1 }}
                >
                  {entry.icon}
                  {entry.label}
                </Button>
              </Grid>
            );
          })}
        </Grid>
      )}

      {renderFilterSection(
        `${filterSections.minRate}: $${filterConfig.minRate}/hr`,
        <Stack spacing={1}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filterConfig.minRate}
            onChange={(event) => setFilterConfig((prev) => ({ ...prev, minRate: Number(event.target.value) }))}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 12, color: 'text.secondary' }}>
            <span>Any</span>
            <span>$100+</span>
          </Stack>
        </Stack>
      )}
    </Box>
  );

  return (
    <Box sx={{ px: { xs: 0, lg: 2 }, py: 2 }}>
      <Dialog open={counterOfferOpen} onClose={closeCounterOffer} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">Submit Counter Offer</Typography>
              <Typography variant="body2" color="text.secondary">
                {counterOfferShift ? getShiftPharmacyName(counterOfferShift) : ''}
              </Typography>
            </Box>
            <IconButton onClick={closeCounterOffer}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {counterOfferShift && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, borderColor: 'grey.200' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ErrorOutlineIcon fontSize="small" />
                  <Typography variant="body2">
                    Negotiation options:{' '}
                    {getShiftNegotiable(counterOfferShift) ? 'Rate negotiable.' : 'Rate fixed.'}{' '}
                    {getShiftFlexibleTime(counterOfferShift) ? 'Time flexible.' : 'Time fixed.'}
                  </Typography>
                </Stack>
              </Paper>
              <Stack spacing={2}>
                {counterOfferSlots.map((slot) => (
                  <Paper key={slot.slotId} variant="outlined" sx={{ p: 2, borderColor: 'grey.200' }}>
                    <Stack spacing={2}>
                      <Typography variant="subtitle2">
                        {slot.dateLabel}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Start time"
                            type="time"
                            size="small"
                            fullWidth
                            value={slot.startTime}
                            onChange={(event) => handleCounterSlotChange(slot.slotId, 'startTime', event.target.value)}
                            disabled={!getShiftFlexibleTime(counterOfferShift)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="End time"
                            type="time"
                            size="small"
                            fullWidth
                            value={slot.endTime}
                            onChange={(event) => handleCounterSlotChange(slot.slotId, 'endTime', event.target.value)}
                            disabled={!getShiftFlexibleTime(counterOfferShift)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Hourly rate"
                            type="number"
                            size="small"
                            fullWidth
                            value={slot.rate}
                            onChange={(event) => handleCounterSlotChange(slot.slotId, 'rate', event.target.value)}
                            disabled={!getShiftNegotiable(counterOfferShift)}
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              {getShiftNegotiable(counterOfferShift) && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={counterOfferTravel}
                      onChange={(event) => setCounterOfferTravel(event.target.checked)}
                    />
                  }
                  label="Request travel allowance"
                />
              )}
              <TextField
                label="Message"
                value={counterOfferMessage}
                onChange={(event) => setCounterOfferMessage(event.target.value)}
                multiline
                minRows={3}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCounterOffer}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitCounterOffer} disabled={!counterOfferShift}>
            <ChatBubbleOutlineIcon fontSize="small" sx={{ mr: 1 }} />
            Send Offer
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {activeTab === 'saved'
              ? `${processedShifts.length} saved items`
              : `Showing ${processedShifts.length} opportunities`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant={activeTab === 'browse' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('browse')}
          >
            Browse
          </Button>
          <Button
            variant={activeTab === 'saved' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('saved')}
            startIcon={<FavoriteIcon />}
          >
            Saved ({savedShiftIds.size})
          </Button>
          {isMobile && (
            <IconButton onClick={() => setIsSidebarOpen(true)}>
              <TuneIcon />
            </IconButton>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {!isMobile && (
          <Paper variant="outlined" sx={{ width: 320, flexShrink: 0, borderRadius: 3, borderColor: 'grey.200' }}>
            {sidebarContent}
          </Paper>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {activeFilterCount > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
              {filterConfig.onlyUrgent && (
                <Chip label="Urgent" onDelete={() => toggleBooleanFilter('onlyUrgent')} color="warning" size="small" />
              )}
              {filterConfig.bulkShiftsOnly && (
                <Chip label="Bulk shifts" onDelete={() => toggleBooleanFilter('bulkShiftsOnly')} size="small" />
              )}
              {filterConfig.negotiableOnly && (
                <Chip label="Negotiable" onDelete={() => toggleBooleanFilter('negotiableOnly')} size="small" />
              )}
              {filterConfig.travelProvided && (
                <Chip label="Travel" onDelete={() => toggleBooleanFilter('travelProvided')} size="small" />
              )}
              {filterConfig.accommodationProvided && (
                <Chip label="Accommodation" onDelete={() => toggleBooleanFilter('accommodationProvided')} size="small" />
              )}
              {filterConfig.roles.map((role) => (
                <Chip key={role} label={role} onDelete={() => toggleFilter('roles', role)} size="small" />
              ))}
              {filterConfig.employmentTypes.map((type) => (
                <Chip key={type} label={type} onDelete={() => toggleFilter('employmentTypes', type)} size="small" />
              ))}
              {filterConfig.timeOfDay.map((time) => (
                <Chip key={time} label={time} onDelete={() => toggleFilter('timeOfDay', time)} size="small" />
              ))}
              <Button size="small" onClick={clearAllFilters} startIcon={<CloseIcon fontSize="small" />}>
                Clear all
              </Button>
            </Stack>
          )}

          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <SwapVertIcon fontSize="small" color="action" />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Sort</InputLabel>
              <Select
                label="Sort"
                value={sortConfig.key}
                onChange={(event) => handleSortChange(event.target.value as SortKey)}
              >
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="rate">Rate</MenuItem>
                <MenuItem value="distance">Distance</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack spacing={2}>
            {loading && (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, borderColor: 'grey.200' }}>
                <Typography>Loading shifts...</Typography>
              </Paper>
            )}
            {!loading && processedShifts.length === 0 && (
              <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', borderColor: 'grey.200' }}>
                <FilterListIcon sx={{ fontSize: 48, color: 'grey.300' }} />
                <Typography variant="h6" sx={{ mt: 1 }}>No jobs found</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  We couldn't find any positions matching your criteria.
                </Typography>
                <Button variant="contained" sx={{ mt: 2 }} onClick={clearAllFilters}>
                  Reset filters
                </Button>
              </Paper>
            )}

            {processedShifts.map((shift) => {
              const slots = shift.slots ?? [];
              const firstSlot = slots[0];
              const isMulti = slots.length > 1;
              const isExpanded = Boolean(expandedCards[shift.id]);
              const selection = selectedSlotIds[shift.id] ?? new Set<number>();
              const isRejectedShift = rejectedShiftIds.has(shift.id);
              const showCounter = (getShiftFlexibleTime(shift) || getShiftNegotiable(shift)) && !isRejectedShift;
              const showNegotiable = getShiftNegotiable(shift);
              const isSaved = savedShiftIds.has(shift.id);
              const isApplied = appliedShiftIds.has(shift.id);
              const hasRejectedSlots = slots.some((slot) => rejectedSlotIds.has(slot.id));
              const slotApplied = (slotId: number) => appliedSlotIds.has(slotId);
              const slotRejected = (slotId: number) => rejectedSlotIds.has(slotId) || isRejectedShift;
              const allowPartial = getShiftAllowPartial(shift);
              const urgent = getShiftUrgent(shift);
              const isFullOrPartTime = ['FULL_TIME', 'PART_TIME'].includes(shift.employmentType ?? '');
              const rateSummary = getRateSummary(shift);

              return (
                <Paper
                  key={shift.id}
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    borderColor: urgent ? 'warning.main' : 'grey.200',
                    borderLeftWidth: urgent ? 4 : 1,
                    position: 'relative',
                  }}
                >
                  {urgent && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        px: 1.5,
                        py: 0.5,
                        bgcolor: 'warning.main',
                        color: 'common.white',
                        borderBottomRightRadius: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <BoltIcon sx={{ fontSize: 12 }} />
                      Urgent
                    </Box>
                  )}
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="h6" sx={{ cursor: 'pointer' }} onClick={() => toggleExpandedCard(shift.id)}>
                              {getShiftPharmacyName(shift)}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                              <Chip icon={<WorkOutlineIcon />} label={getShiftRoleLabel(shift)} size="small" />
                              {(shift.hasTravel || shift.hasAccommodation) && (
                                <Stack direction="row" spacing={0.5}>
                                  {shift.hasTravel && <Chip icon={<FlightIcon />} label="Travel" size="small" />}
                                  {shift.hasAccommodation && <Chip icon={<HotelIcon />} label="Accomm." size="small" />}
                                </Stack>
                              )}
                              {isRejectedShift && <Chip label="Rejected" size="small" color="error" />}
                            </Stack>
                          </Box>
                          <IconButton onClick={() => toggleSaveShift(shift.id)}>
                            <FavoriteIcon color={isSaved ? 'error' : 'disabled'} />
                          </IconButton>
                        </Stack>

                        <Stack spacing={1} sx={{ mt: 2 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CalendarTodayIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {firstSlot
                                ? formatDateShort(firstSlot?.date)
                                : isFullOrPartTime
                                  ? getEmploymentLabel(shift)
                                  : 'No dates provided'}
                              {isMulti && <span style={{ color: '#94A3B8', marginLeft: 6 }}>+ {slots.length - 1} more</span>}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AccessTimeIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {firstSlot
                                ? `${formatTime(firstSlot?.startTime)} - ${formatTime(firstSlot?.endTime)}`
                                : isFullOrPartTime
                                  ? getEmploymentLabel(shift)
                                  : 'Time not set'}
                            </Typography>
                            {getShiftFlexibleTime(shift) && (
                              <Chip label="Flex" size="small" color="success" />
                            )}
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PlaceIcon fontSize="small" color="action" />
                            <Typography variant="body2">{getShiftCity(shift)} ({getShiftState(shift)})</Typography>
                          </Stack>
                        </Stack>
                      </Box>

                      <Box sx={{ minWidth: 180, textAlign: { xs: 'left', md: 'right' } }}>
                        <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AttachMoneyIcon fontSize="small" color="success" />
                            <Typography variant="h6">
                              {rateSummary.display}
                              <Typography component="span" variant="caption" color="text.secondary">
                                {rateSummary.unitLabel}
                              </Typography>
                            </Typography>
                          </Stack>
                          <Chip label="+ Superannuation" size="small" />
                          {showNegotiable && (
                            <Chip icon={<PaidIcon />} label="Negotiable" size="small" color="info" />
                          )}
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            <Button
                              variant="contained"
                              disabled={isApplied || isRejectedShift || (!shift.singleUserOnly && hasRejectedSlots)}
                              onClick={() => handleApplyAll(shift)}
                            >
                              {isApplied ? 'Applied' : 'Apply Now'}
                            </Button>
                            {showCounter && onSubmitCounterOffer && (
                              <Button
                                variant="outlined"
                                onClick={() => openCounterOffer(shift)}
                                startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
                              >
                                Counter Offer
                              </Button>
                            )}
                            {onRejectShift && shift.singleUserOnly && (
                              <Button
                                variant="outlined"
                                color="error"
                                onClick={() => handleRejectShift(shift)}
                                disabled={isRejectedShift}
                              >
                                {isRejectedShift ? 'Rejected' : 'Reject Shift'}
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>

                    {isExpanded && (
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: 'grey.100' }}>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Stack spacing={1.5}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <CalendarTodayIcon fontSize="small" />
                                <Typography variant="subtitle2">Shift Breakdown</Typography>
                                {isMulti && !allowPartial && (
                                  <Chip icon={<LayersIcon />} label="Bundle only" size="small" color="error" />
                                )}
                                {isMulti && allowPartial && (
                                  <Chip icon={<CheckCircleOutlineIcon />} label="Select shifts" size="small" color="success" />
                                )}
                              </Stack>

                              <Stack spacing={1}>
                                {slots.length === 0 ? (
                                  <Paper variant="outlined" sx={{ p: 2, borderColor: 'grey.200' }}>
                                    <Stack spacing={1}>
                                      <Typography variant="body2" fontWeight={600}>
                                        {isFullOrPartTime ? getEmploymentLabel(shift) : 'No time slots'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {isFullOrPartTime ? 'This is a non-slot based role.' : 'Slots will be announced.'}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">
                                        Rate: {rateSummary.display} {rateSummary.unitLabel === '/hr' ? '/hr' : rateSummary.unitLabel}
                                      </Typography>
                                    </Stack>
                                  </Paper>
                                ) : (
                                  slots.map((slot) => {
                                    const isSelected = selection.has(slot.id);
                                    const isSlotApplied = slotApplied(slot.id);
                                    const isSlotRejected = slotRejected(slot.id);
                                    return (
                                      <Paper
                                        key={slot.id}
                                        variant="outlined"
                                        sx={{
                                          p: 1.5,
                                          borderColor: isSelected ? 'primary.main' : 'grey.200',
                                          bgcolor: isSelected ? 'primary.50' : 'transparent',
                                        }}
                                      >
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            {isMulti && allowPartial && (
                                              <Checkbox
                                                checked={isSelected}
                                                onChange={() => toggleSlotSelection(shift.id, slot.id)}
                                                disabled={isSlotApplied || isSlotRejected}
                                              />
                                            )}
                                            <Box>
                                              <Typography variant="body2" fontWeight={600}>
                                                {formatDateLong(slot.date)}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary">
                                                {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                              </Typography>
                                            </Box>
                                          </Stack>
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            {isSlotRejected ? (
                                              <Chip label="Rejected" color="error" size="small" />
                                            ) : (
                                              <Chip
                                                label={`$${getSlotRate(slot, shift)}/hr`}
                                                color="success"
                                                size="small"
                                              />
                                            )}
                                            {!shift.singleUserOnly && onRejectSlot && !isSlotRejected && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                onClick={() => handleRejectSlot(shift, slot.id)}
                                              >
                                                Reject
                                              </Button>
                                            )}
                                          </Stack>
                                        </Stack>
                                      </Paper>
                                    );
                                  })
                                )}
                              </Stack>

                              {isMulti && allowPartial && selection.size > 0 && (
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  {showCounter && onSubmitCounterOffer && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
                                      onClick={() => openCounterOffer(shift, selection)}
                                    >
                                      Counter Selected
                                    </Button>
                                  )}
                                  <Button
                                    variant="contained"
                                    size="small"
                                    disabled={isRejectedShift}
                                    onClick={() => {
                                      selection.forEach((slotId) => handleApplySlot(shift, slotId));
                                      clearSelection(shift.id);
                                    }}
                                  >
                                    Apply to {selection.size} Selected
                                  </Button>
                                  {onRejectShift && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      disabled={isRejectedShift}
                                      onClick={() => handleRejectShift(shift)}
                                    >
                                      {isRejectedShift ? 'Rejected' : 'Reject Entire Shift'}
                                    </Button>
                                  )}
                                </Stack>
                              )}
                              {isMulti && allowPartial && selection.size === 0 && onRejectShift && (
                                <Stack direction="row" justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    disabled={isRejectedShift}
                                    onClick={() => handleRejectShift(shift)}
                                  >
                                    {isRejectedShift ? 'Rejected' : 'Reject Entire Shift'}
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <Stack spacing={1.5}>
                              <Typography variant="subtitle2">About the Role</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {shift.description || 'No description provided.'}
                              </Typography>
                              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: 'grey.200' }}>
                                <Typography variant="caption" color="text.secondary">Full Address</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <PlaceIcon fontSize="small" color="action" />
                                  <Typography variant="body2">{getShiftAddress(shift) || 'N/A'}</Typography>
                                </Stack>
                              </Paper>
                            </Stack>
                          </Grid>
                        </Grid>
                      </Paper>
                    )}

                    <Button
                      onClick={() => toggleExpandedCard(shift.id)}
                      endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      {isExpanded ? 'Hide Details' : 'Read More & Shift Breakdown'}
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      </Box>

      <Drawer
        anchor="left"
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      >
        <Box sx={{ width: 320 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={() => setIsSidebarOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          {sidebarContent}
        </Box>
      </Drawer>
    </Box>
  );
};

export default ShiftsBoard;
