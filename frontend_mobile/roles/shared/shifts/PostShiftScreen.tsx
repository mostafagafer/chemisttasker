import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
    Text,
    TextInput,
    Button,
    HelperText,
    Surface,
    IconButton,
    Chip,
    Menu,
    Snackbar,
    Checkbox,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
    fetchPharmaciesService,
    fetchActiveShiftDetailService,
    createOwnerShiftService,
    updateOwnerShiftService,
    calculateShiftRates,
} from '@chemisttasker/shared-core';

const ROLE_OPTIONS = ['PHARMACIST', 'TECHNICIAN', 'ASSISTANT', 'INTERN', 'STUDENT'];
const EMPLOYMENT_TYPES = ['LOCUM', 'CASUAL', 'PART_TIME', 'FULL_TIME'];
const SKILL_OPTIONS = ['Vaccination', 'Methadone', 'CPR', 'First Aid', 'Anaphylaxis', 'Credentialed Badge', 'PDL Insurance'];
const WORKLOAD_TAGS = ['Sole Pharmacist', 'High Script Load', 'Webster Packs'];
const PRIMARY = '#7c3aed';
const PRIMARY_LIGHT = '#F3E8FF';
const PRIMARY_TEXT = '#2D1B69';

const BASE_STEP_ORDER = ['details', 'skills', 'visibility'] as const;
type StepKey = 'details' | 'skills' | 'visibility' | 'timetable' | 'payrate';
type RateType = 'FLEXIBLE' | 'FIXED' | 'PHARMACIST_PROVIDED';
type VisibilityTier = 'FULL_PART_TIME' | 'LOCUM_CASUAL' | 'OWNER_CHAIN' | 'ORG_CHAIN' | 'PLATFORM';
type VisibilityDates = { locum_casual?: string; owner_chain?: string; org_chain?: string; platform?: string };

type SlotEntry = {
    date: string;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
    recurringDays: number[];
    recurringEndDate: string;
};

type PharmacyOption = {
    id: number;
    name?: string;
    has_chain?: boolean;
    hasChain?: boolean;
    claimed?: boolean;
    organization_id?: number;
    organizationId?: number;
    allowed_escalation_levels?: VisibilityTier[];
    allowedEscalationLevels?: VisibilityTier[];
};

const toIsoDate = (value: string): Date | null => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};
const toLocalIsoDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function PostShiftScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ edit?: string; dates?: string; date?: string; role?: string; dedicated_user?: string; embedded?: string }>();
    const editingId = params?.edit ? Number(params.edit) : null;
    const loadedVisibilityRef = React.useRef<string | null>(null);
    const isEmbedded = params?.embedded === '1';

    const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
    const [pharmacyId, setPharmacyId] = useState<number | ''>('');
    const [pharmaciesLoaded, setPharmaciesLoaded] = useState(false);
    const [roleNeeded, setRoleNeeded] = useState<string>('PHARMACIST');
    const [employmentType, setEmploymentType] = useState<string>('LOCUM');
    const [workloadTags, setWorkloadTags] = useState<string[]>([]);
    const [mustHave, setMustHave] = useState<string[]>([]);
    const [niceToHave, setNiceToHave] = useState<string[]>([]);
    const [singleUserOnly, setSingleUserOnly] = useState(false);
    const [hideName, setHideName] = useState(false);
    const [initialAudience, setInitialAudience] = useState<string>('');
    const [rateType, setRateType] = useState<RateType>('FLEXIBLE');
    const [fixedRate, setFixedRate] = useState('');
    const [ownerBonus, setOwnerBonus] = useState('');
    const [slots, setSlots] = useState<SlotEntry[]>([]);
    const [slotDate, setSlotDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [slotStart, setSlotStart] = useState('09:00');
    const [slotEnd, setSlotEnd] = useState('17:00');
    const [slotRecurring, setSlotRecurring] = useState(false);
    const [slotRecurringDays, setSlotRecurringDays] = useState<number[]>([]);
    const [slotRecurringEnd, setSlotRecurringEnd] = useState<string>(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    const [slotDatePickerOpen, setSlotDatePickerOpen] = useState(false);
    const [recurringEndPickerOpen, setRecurringEndPickerOpen] = useState(false);
    const [escalationPicker, setEscalationPicker] = useState<{ key: keyof VisibilityDates | null; open: boolean }>({ key: null, open: false });
    const [escalationDates, setEscalationDates] = useState<VisibilityDates>({});
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [pharmacyMenuVisible, setPharmacyMenuVisible] = useState(false);
    const [audienceMenuVisible, setAudienceMenuVisible] = useState(false);
    const [activeStep, setActiveStep] = useState<StepKey>('details');
    const [calendarMonthAnchor, setCalendarMonthAnchor] = useState<Date>(new Date());

    // Rate calculation
    const [slotRateRows, setSlotRateRows] = useState<Array<{ rate: string; status: 'idle' | 'loading' | 'success' | 'error'; error?: string; dirty?: boolean }>>([]);

    // Notification preferences
    const [notifyPharmacyStaff, setNotifyPharmacyStaff] = useState(false);
    const [notifyFavoriteStaff, setNotifyFavoriteStaff] = useState(false);
    const [notifyChainMembers, setNotifyChainMembers] = useState(false);

    // Payment & super
    const [paymentPreference, setPaymentPreference] = useState<'ABN' | 'TFN'>('ABN');
    const [locumSuperIncluded, setLocumSuperIncluded] = useState(true);
    const [superPercent, setSuperPercent] = useState('');
    const [rateWeekday, setRateWeekday] = useState('');
    const [rateSaturday, setRateSaturday] = useState('');
    const [rateSunday, setRateSunday] = useState('');
    const [ratePublicHoliday, setRatePublicHoliday] = useState('');
    const [rateEarlyMorning, setRateEarlyMorning] = useState('');
    const [rateLateNight, setRateLateNight] = useState('');

    // FT/PT specific
    const [ftptPayMode, setFtptPayMode] = useState<'HOURLY' | 'ANNUAL'>('HOURLY');
    const [minHourly, setMinHourly] = useState('');
    const [maxHourly, setMaxHourly] = useState('');
    const [minAnnual, setMinAnnual] = useState('');
    const [maxAnnual, setMaxAnnual] = useState('');

    // Other
    const [applyRatesToPharmacy, setApplyRatesToPharmacy] = useState(false);
    const [dedicatedUserId, setDedicatedUserId] = useState<number | null>(null);

    const isLocumLike = useMemo(
        () => employmentType === 'LOCUM' || employmentType === 'CASUAL',
        [employmentType]
    );
    const stepOrder = useMemo<StepKey[]>(
        () => [...BASE_STEP_ORDER, ...(isLocumLike ? (['timetable'] as StepKey[]) : []), 'payrate'],
        [isLocumLike]
    );
    const canSubmit = useMemo(() => Boolean(pharmacyId && (!isLocumLike || slots.length > 0)), [pharmacyId, isLocumLike, slots.length]);

    const resetForm = useCallback(() => {
        const todayIso = new Date().toISOString().split('T')[0];
        setCalendarMonthAnchor(new Date(`${todayIso}T00:00:00`));
        setPharmacyId('');
        setRoleNeeded('PHARMACIST');
        setEmploymentType('LOCUM');
        setWorkloadTags([]);
        setMustHave([]);
        setNiceToHave([]);
        setHideName(false);
        setSingleUserOnly(false);
        setInitialAudience('');
        setRateType('FLEXIBLE');
        setFixedRate('');
        setOwnerBonus('');
        setDescription('');
        setSlots([]);
        setSlotDate(todayIso);
        setSelectedDates([]);
        setSlotStart('09:00');
        setSlotEnd('17:00');
        setSlotRecurring(false);
        setSlotRecurringDays([]);
        setSlotRecurringEnd(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
        setEscalationDates({});
        setToast('');
        setError('');
        // Reset new fields
        setSlotRateRows([]);
        setNotifyPharmacyStaff(false);
        setNotifyFavoriteStaff(false);
        setNotifyChainMembers(false);
        setPaymentPreference('ABN');
        setLocumSuperIncluded(true);
        setSuperPercent('');
        setRateWeekday('');
        setRateSaturday('');
        setRateSunday('');
        setRatePublicHoliday('');
        setRateEarlyMorning('');
        setRateLateNight('');
        setFtptPayMode('HOURLY');
        setMinHourly('');
        setMaxHourly('');
        setMinAnnual('');
        setMaxAnnual('');
        setApplyRatesToPharmacy(false);
        setDedicatedUserId(null);
    }, []);

    // Reset escalation dates when the initial audience changes, mirroring web behaviour
    const hasInitialAudienceRun = React.useRef(false);
    useEffect(() => {
        // Skip the first run so preloaded escalation dates are kept when editing
        if (!hasInitialAudienceRun.current) {
            hasInitialAudienceRun.current = true;
            return;
        }
        setEscalationDates({});
    }, [initialAudience]);

    // Allowed visibility tiers per selected pharmacy (mirrors web logic)
    const allowedVis = useMemo<VisibilityTier[]>(() => {
        const p = pharmacies.find((x) => x.id === pharmacyId);
        if (!p) return [];

        // Prefer backend-provided tiers if present (matches web)
        const fromApi = (p.allowed_escalation_levels || p.allowedEscalationLevels) as VisibilityTier[] | undefined;
        if (fromApi && fromApi.length) {
            return fromApi as VisibilityTier[];
        }

        // Fallback heuristic (chain/org flags)
        const tiers: VisibilityTier[] = ['FULL_PART_TIME', 'LOCUM_CASUAL'];
        const hasChain = Boolean(p.has_chain ?? p.hasChain);
        const claimed = Boolean(p.claimed || p.organization_id || p.organizationId);
        if (hasChain) tiers.push('OWNER_CHAIN');
        if (claimed) tiers.push('ORG_CHAIN');
        tiers.push('PLATFORM');
        return tiers;
    }, [pharmacyId, pharmacies]);
    const selectedPharmacy = useMemo(
        () => pharmacies.find((x) => x.id === pharmacyId),
        [pharmacyId, pharmacies]
    );

    useEffect(() => {
        if (!selectedPharmacy) return;
        const normalize = (val: any) => (val === undefined || val === null || val === '' ? '' : String(val));
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

    // Ensure initial audience stays within allowed tiers
    useEffect(() => {
        if (allowedVis.length && !allowedVis.includes(initialAudience as VisibilityTier)) {
            setInitialAudience(allowedVis[0]);
        }
    }, [allowedVis, initialAudience]);

    useEffect(() => {
        if (!allowedVis.length || !isEmbedded) return;
        if (allowedVis.includes('LOCUM_CASUAL')) {
            setInitialAudience('LOCUM_CASUAL');
        }
    }, [allowedVis, isEmbedded]);

    // When pharmacy changes, align initial audience to first allowed tier
    useEffect(() => {
        if (allowedVis.length) {
            setInitialAudience((prev) => {
                if (editingId && loadedVisibilityRef.current && allowedVis.includes(loadedVisibilityRef.current as VisibilityTier)) {
                    return loadedVisibilityRef.current;
                }
                return prev && allowedVis.includes(prev as VisibilityTier) ? prev : allowedVis[0];
            });
        }
    }, [allowedVis, pharmacyId, editingId]);

    const loadPharmacies = useCallback(async () => {
        try {
            const data = await fetchPharmaciesService({});
            const list = Array.isArray((data as any)?.results)
                ? (data as any).results
                : Array.isArray(data)
                    ? data
                    : [];
            // Keep full objects so allowed_escalation_levels/chain/org flags flow through
            setPharmacies(list as PharmacyOption[]);
            setPharmaciesLoaded(true);
        } catch {
            setError('Unable to load pharmacies');
        }
    }, []);

    const loadShift = useCallback(async () => {
        if (!editingId) return;
        try {
            const data: any = await fetchActiveShiftDetailService(editingId);
            setPharmacyId(
                data.pharmacy_detail?.id ??
                data.pharmacyDetail?.id ??
                data.pharmacy ??
                data.pharmacy_id ??
                ''
            );
            // Ensure the pharmacy from the shift exists in the options list (matches web behavior of showing current pharmacy)
            if (data.pharmacy_detail || data.pharmacyDetail) {
                const detail = data.pharmacy_detail ?? data.pharmacyDetail;
                setPharmacies((prev) => {
                    const exists = prev.some((p) => p.id === detail.id);
                    return exists ? prev : [...prev, detail];
                });
            }
            setRoleNeeded(data.role_needed ?? data.roleNeeded ?? data.role ?? 'PHARMACIST');
            setEmploymentType(data.employment_type ?? data.employmentType ?? 'LOCUM');
            const vis = data.visibility ?? '';
            setInitialAudience(vis);
            loadedVisibilityRef.current = vis;
            setWorkloadTags(Array.isArray(data.workload_tags ?? data.workloadTags) ? (data.workload_tags ?? data.workloadTags) : []);
            setDescription(data.description ?? '');
            setHideName(Boolean(data.post_anonymously ?? data.postAnonymously));
            setSingleUserOnly(Boolean(data.single_user_only ?? data.singleUserOnly));
            setMustHave(Array.isArray(data.must_have ?? data.mustHave) ? (data.must_have ?? data.mustHave) : []);
            setNiceToHave(Array.isArray(data.nice_to_have ?? data.niceToHave) ? (data.nice_to_have ?? data.niceToHave) : []);
            const escalations =
                typeof (data.escalation_dates ?? data.escalationDates) === 'object' && (data.escalation_dates ?? data.escalationDates)
                    ? (data.escalation_dates ?? data.escalationDates)
                    : {
                        locum_casual: data.escalate_to_locum_casual ?? data.escalateToLocumCasual,
                        owner_chain: data.escalate_to_owner_chain ?? data.escalateToOwnerChain,
                        org_chain: data.escalate_to_org_chain ?? data.escalateToOrgChain,
                        platform: data.escalate_to_platform ?? data.escalateToPlatform,
                    };
            setEscalationDates(escalations);
            setOwnerBonus(
                data.owner_bonus != null
                    ? String(data.owner_bonus)
                    : data.ownerBonus != null
                        ? String(data.ownerBonus)
                        : ''
            );
            const fixed = data.fixed_rate ?? data.fixedRate;
            setFixedRate(fixed ? String(fixed) : '');
            const rateTypeValue = data.rate_type ?? data.rateType;
            if (rateTypeValue === 'PHARMACIST_PROVIDED') {
                setRateType('PHARMACIST_PROVIDED');
            } else if (rateTypeValue === 'FIXED' || fixed) {
                setRateType('FIXED');
            } else {
                setRateType('FLEXIBLE');
            }
            setRateWeekday(String(data.rate_weekday ?? data.rateWeekday ?? ''));
            setRateSaturday(String(data.rate_saturday ?? data.rateSaturday ?? ''));
            setRateSunday(String(data.rate_sunday ?? data.rateSunday ?? ''));
            setRatePublicHoliday(String(data.rate_public_holiday ?? data.ratePublicHoliday ?? ''));
            setRateEarlyMorning(String(data.rate_early_morning ?? data.rateEarlyMorning ?? ''));
            setRateLateNight(String(data.rate_late_night ?? data.rateLateNight ?? ''));
            setPaymentPreference((data.payment_preference ?? data.paymentPreference ?? 'ABN') === 'TFN' ? 'TFN' : 'ABN');
            const detailSuper = data.super_percent ?? data.superPercent;
            if (detailSuper === null || detailSuper === undefined || detailSuper === '') {
                setLocumSuperIncluded(true);
                setSuperPercent('');
            } else {
                const superNumber = Number(detailSuper);
                setLocumSuperIncluded(superNumber > 0);
                setSuperPercent(String(detailSuper));
            }
            const parsedSlots = Array.isArray(data.slots)
                ? data.slots.map((s: any) => ({
                    date: s.date ?? s.slot_date ?? s.shift_date ?? '',
                    startTime: s.startTime ?? s.start_time ?? '',
                    endTime: s.endTime ?? s.end_time ?? '',
                    isRecurring: Boolean(s.is_recurring ?? s.isRecurring),
                    recurringDays: Array.isArray(s.recurring_days ?? s.recurringDays) ? s.recurring_days ?? s.recurringDays : [],
                    recurringEndDate: s.recurringEndDate ?? s.recurring_end_date ?? '',
                }))
                : [];
            setSlots(parsedSlots);
        } catch {
            setError('Unable to load shift details');
        }
    }, [editingId]);

    useEffect(() => {
        const initialize = async () => {
            if (!editingId) {
                resetForm();
            }
            await loadPharmacies(); // This will set pharmaciesLoaded to true
            if (editingId) {
                // We need to wait for pharmacies to be loaded before loading the shift
                // to ensure all dependencies like `allowedVis` are ready.
                // The `pharmaciesLoaded` state change will trigger the next effect.
            }
        };
        void initialize();
    }, [editingId, loadPharmacies, resetForm]);

    useEffect(() => { if (editingId && pharmaciesLoaded) { void loadShift(); } }, [editingId, pharmaciesLoaded, loadShift]);

    const applyBookingPrefillFromParams = useCallback(() => {
        if (editingId) return;

        const datesParam = params?.dates as unknown;
        const singleDate = params?.date;
        let parsedDates: string[] = [];
        if (typeof datesParam === 'string') {
            parsedDates = datesParam.split(',').map((d: string) => d.trim()).filter(Boolean);
        } else if (Array.isArray(datesParam)) {
            parsedDates = (datesParam as Array<string | number>)
                .reduce<string[]>((acc, value) => [...acc, ...String(value).split(',')], [])
                .map((d: string) => d.trim())
                .filter(Boolean);
        }
        const uniqueDates = Array.from(new Set(parsedDates.length ? parsedDates : (singleDate ? [singleDate] : []))).sort();

        if (uniqueDates.length > 0) {
            setSlotDate(uniqueDates[0]);
            setCalendarMonthAnchor(new Date(`${uniqueDates[0]}T00:00:00`));
            setSelectedDates(uniqueDates);
            setSlots(
                uniqueDates.map((date) => ({
                    date,
                    startTime: slotStart,
                    endTime: slotEnd,
                    isRecurring: false,
                    recurringDays: [],
                    recurringEndDate: '',
                }))
            );
            setActiveStep('details');
        }

        const roleParam = params?.role;
        if (roleParam && typeof roleParam === 'string') {
            setRoleNeeded(roleParam.toUpperCase());
        }
        const dedicated = params?.dedicated_user;
        if (dedicated && typeof dedicated === 'string') {
            const parsed = Number(dedicated);
            if (!Number.isNaN(parsed)) {
                setDedicatedUserId(parsed);
            }
        }
    }, [editingId, params?.date, params?.dates, params?.dedicated_user, params?.role, slotEnd, slotStart]);

    useEffect(() => {
        applyBookingPrefillFromParams();
    }, [applyBookingPrefillFromParams]);

    useFocusEffect(
        useCallback(() => {
            applyBookingPrefillFromParams();
        }, [applyBookingPrefillFromParams])
    );

    const mergeSelectedDates = useCallback((incomingDates: string[]) => {
        const todayIso = new Date().toISOString().split('T')[0];
        const valid = incomingDates.filter((d) => d && d >= todayIso);
        if (!valid.length) return;
        setSelectedDates((prev) => Array.from(new Set([...prev, ...valid])).sort());
        setSlotDate(valid[valid.length - 1]);
    }, []);

    const selectedDateObjects = useMemo(
        () => selectedDates.map((d) => new Date(`${d}T00:00:00`)),
        [selectedDates]
    );
    const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);
    const slotDateSet = useMemo(() => new Set(slots.map((s) => s.date)), [slots]);
    const monthCalendarCells = useMemo(() => {
        const year = calendarMonthAnchor.getFullYear();
        const month = calendarMonthAnchor.getMonth();
        const first = new Date(year, month, 1);
        const leading = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
        for (let i = 0; i < leading; i += 1) {
            cells.push({ iso: `pad-prev-${i}`, day: 0, inMonth: false });
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            const iso = toLocalIsoDate(new Date(year, month, day));
            cells.push({ iso, day, inMonth: true });
        }
        while (cells.length % 7 !== 0) {
            cells.push({ iso: `pad-next-${cells.length}`, day: 0, inMonth: false });
        }
        return cells;
    }, [calendarMonthAnchor]);
    const monthLabel = useMemo(
        () => calendarMonthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        [calendarMonthAnchor]
    );

    const expandedSlots = useMemo(() => {
        const occurrences: Array<{ date: string; startTime: string; endTime: string }> = [];
        slots.forEach((slot) => {
            const addOccurrence = (date: Date) => {
                occurrences.push({
                    date: date.toISOString().split('T')[0],
                    startTime: (slot.startTime || '').slice(0, 5),
                    endTime: (slot.endTime || '').slice(0, 5),
                });
            };

            const baseDate = toIsoDate(slot.date);
            if (!baseDate) return;

            if (slot.isRecurring && slot.recurringEndDate && slot.recurringDays.length) {
                const endBoundary = toIsoDate(slot.recurringEndDate);
                if (!endBoundary) {
                    addOccurrence(baseDate);
                    return;
                }
                let cursor = new Date(baseDate);
                while (cursor <= endBoundary) {
                    if (slot.recurringDays.includes(cursor.getDay())) {
                        addOccurrence(cursor);
                    }
                    cursor.setDate(cursor.getDate() + 1);
                }
            } else {
                addOccurrence(baseDate);
            }
        });

        return occurrences.sort((a, b) => {
            const left = new Date(`${a.date}T${a.startTime}:00`).getTime();
            const right = new Date(`${b.date}T${b.startTime}:00`).getTime();
            return left - right;
        });
    }, [slots]);

    useEffect(() => {
        setSlotRateRows((prev) =>
            expandedSlots.map((_, idx) => prev[idx] ?? { rate: '', status: 'idle' as const })
        );
    }, [expandedSlots]);

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
                startTime: (slot.startTime || '').slice(0, 5),
                endTime: (slot.endTime || '').slice(0, 5),
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

        calculateShiftRates(payload)
            .then((resp) => {
                if (cancelled) return;
                const list: any[] = Array.isArray(resp) ? resp : [];
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
            .catch(() => {
                if (cancelled) return;
                setSlotRateRows((prev) =>
                    expandedSlots.map((_slot, idx) => ({
                        ...(prev[idx] ?? { rate: '' }),
                        status: 'error' as const,
                        error: 'Unable to calculate rates',
                    }))
                );
            });

        return () => {
            cancelled = true;
        };
    }, [
        employmentType,
        expandedSlots,
        isLocumLike,
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

    const addSlot = () => {
        if (!slotStart || !slotEnd) return;
        const baseDates = selectedDates.length ? selectedDates : slotDate ? [slotDate] : [];
        if (!baseDates.length) return;
        setSlots((prev) => {
            const existingKeys = new Set(prev.map((s) => `${s.date}-${s.startTime}-${s.endTime}-${s.isRecurring}`));
            const next = [...prev];
            baseDates.forEach((date) => {
                const key = `${date}-${slotStart}-${slotEnd}-${slotRecurring}`;
                if (!existingKeys.has(key)) {
                    next.push({
                        date,
                        startTime: slotStart,
                        endTime: slotEnd,
                        isRecurring: slotRecurring,
                        recurringDays: slotRecurring ? slotRecurringDays : [],
                        recurringEndDate: slotRecurring ? slotRecurringEnd : '',
                    });
                }
            });
            return next;
        });
    };

    const removeSlot = (index: number) => setSlots((prev) => prev.filter((_, i) => i !== index));
    const toggleRecurringDay = (day: number) => setSlotRecurringDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    const setEscalation = (key: keyof VisibilityDates, value: string) => setEscalationDates((prev) => ({ ...prev, [key]: value }));
    const handleSlotRateChange = (index: number, value: string) => {
        setSlotRateRows((rows) =>
            rows.map((row, idx) =>
                idx === index ? { ...row, rate: value, status: 'success', error: undefined, dirty: true } : row
            )
        );
    };

    const handleSubmit = async () => {
        setError('');
        if (!pharmacyId || !roleNeeded || !employmentType) {
            setError('Please fill all required fields in Shift Details.');
            return;
        }
        if (isLocumLike && slots.length === 0) {
            setError('Please add at least one timetable entry.');
            return;
        }
        if (!isLocumLike && ftptPayMode === 'HOURLY' && (!minHourly || !maxHourly)) {
            setError('Please enter min and max hourly rates.');
            return;
        }
        if (!isLocumLike && ftptPayMode === 'ANNUAL' && (!minAnnual || !maxAnnual || !superPercent)) {
            setError('Please enter min/max annual and super %.');
            return;
        }
        setLoading(true);
        try {
            const slotRateForEntry = (entry: SlotEntry) => {
                const idx = expandedSlots.findIndex(
                    (slot) => slot.date === entry.date && slot.startTime === entry.startTime && slot.endTime === entry.endTime
                );
                if (idx < 0) return null;
                const raw = slotRateRows[idx]?.rate;
                if (raw === undefined || raw === null || raw === '') return null;
                const num = Number(raw);
                return Number.isFinite(num) ? num : null;
            };
            const payload: any = {
                pharmacy: pharmacyId,
                role_needed: roleNeeded,
                employment_type: employmentType,
                workload_tags: workloadTags,
                description,
                must_have: mustHave,
                nice_to_have: niceToHave,
                post_anonymously: hideName,
                single_user_only: singleUserOnly,
                visibility: isEmbedded ? 'LOCUM_CASUAL' : initialAudience,
                escalate_to_locum_casual: isEmbedded ? null : escalationDates.locum_casual,
                escalate_to_owner_chain: isEmbedded ? null : escalationDates.owner_chain,
                escalate_to_org_chain: isEmbedded ? null : escalationDates.org_chain,
                escalate_to_platform: isEmbedded ? null : escalationDates.platform,
                slots: slots.map((s) => ({
                    date: s.date,
                    start_time: s.startTime,
                    end_time: s.endTime,
                    is_recurring: s.isRecurring,
                    recurring_days: s.isRecurring ? s.recurringDays : [],
                    recurring_end_date: s.isRecurring && s.recurringEndDate ? s.recurringEndDate : undefined,
                    rate: slotRateForEntry(s),
                })),
                // New fields
                notify_pharmacy_staff: isEmbedded ? false : notifyPharmacyStaff,
                notify_favorite_staff: isEmbedded ? false : notifyFavoriteStaff,
                notify_chain_members: isEmbedded ? false : notifyChainMembers,
                payment_preference: isLocumLike ? paymentPreference : null,
                super_percent: isLocumLike ? (locumSuperIncluded ? 11.5 : 0) : null,
                apply_rates_to_pharmacy: applyRatesToPharmacy,
            };
            if (dedicatedUserId) {
                payload.dedicated_user = dedicatedUserId;
            }

            if (roleNeeded === 'PHARMACIST') {
                payload.rate_type = rateType;
                payload.rate_weekday = rateWeekday || null;
                payload.rate_saturday = rateSaturday || null;
                payload.rate_sunday = rateSunday || null;
                payload.rate_public_holiday = ratePublicHoliday || null;
                payload.rate_early_morning = rateEarlyMorning || null;
                payload.rate_late_night = rateLateNight || null;
                if (rateType === 'FIXED' && fixedRate) {
                    payload.hourly_rate = Number(fixedRate);
                }
            } else {
                if (ownerBonus) {
                    payload.owner_adjusted_rate = Number(ownerBonus);
                }
            }

            // Add FT/PT specific fields
            if (!isLocumLike) {
                if (ftptPayMode === 'HOURLY') {
                    if (minHourly) payload.min_hourly_rate = Number(minHourly);
                    if (maxHourly) payload.max_hourly_rate = Number(maxHourly);
                    payload.min_annual_salary = null;
                    payload.max_annual_salary = null;
                    payload.super_percent = null;
                } else {
                    if (minAnnual) payload.min_annual_salary = Number(minAnnual);
                    if (maxAnnual) payload.max_annual_salary = Number(maxAnnual);
                    payload.min_hourly_rate = null;
                    payload.max_hourly_rate = null;
                    payload.super_percent = Number(superPercent);
                }
            }

            if (editingId) {
                await updateOwnerShiftService(editingId, payload);
                setToast('Shift updated');
            } else {
                await createOwnerShiftService(payload);
                setToast('Shift posted');
                resetForm();
            }
            // Go back to the owner shift center (active tab is managed in-screen)
            router.back();
        } catch (e: any) {
            const msg = e?.response?.data?.detail || 'Unable to save shift';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const chipStyle = (selected: boolean) => [styles.chip, selected ? styles.chipSelected : styles.chipUnselected];
    const chipTextStyle = (selected: boolean) => (selected ? styles.chipTextSelected : styles.chipText);

    const renderDetails = () => (
        <Surface style={styles.card} elevation={1}>
            <Text style={styles.label}>Pharmacy</Text>
            <Menu
                visible={pharmacyMenuVisible}
                onDismiss={() => setPharmacyMenuVisible(false)}
                anchor={
                    <TouchableOpacity style={styles.selector} onPress={() => setPharmacyMenuVisible(true)}>
                        <Text style={styles.selectorText}>
                            {pharmacies.find((p) => p.id === pharmacyId)?.name || 'Select pharmacy'}
                        </Text>
                        <IconButton icon="chevron-down" size={18} />
                    </TouchableOpacity>
                }
            >
                {pharmacies.map((p) => (
                    <Menu.Item
                        key={p.id}
                        onPress={() => {
                            setPharmacyId(p.id);
                            setPharmacyMenuVisible(false);
                        }}
                        title={p.name || `Pharmacy ${p.id}`}
                    />
                ))}
            </Menu>

            <Text style={styles.label}>Employment Type</Text>
            <View style={styles.pills}>
                {EMPLOYMENT_TYPES.map((emp) => {
                    const selected = employmentType === emp;
                    return (
                        <Chip
                            key={emp}
                            selected={selected}
                            onPress={() => setEmploymentType(emp)}
                            style={chipStyle(selected)}
                            textStyle={chipTextStyle(selected)}
                        >
                            {emp.replace('_', ' ')}
                        </Chip>
                    );
                })}
            </View>

            <Text style={styles.label}>Role Needed</Text>
            <View style={styles.pills}>
                {ROLE_OPTIONS.map((role) => {
                    const selected = roleNeeded === role;
                    return (
                        <Chip
                            key={role}
                            selected={selected}
                            onPress={() => setRoleNeeded(role)}
                            style={chipStyle(selected)}
                            textStyle={chipTextStyle(selected)}
                        >
                            {role}
                        </Chip>
                    );
                })}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
                mode="outlined"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={styles.input}
                placeholder="Duties, expectations, notes"
            />

            <Text style={styles.label}>Workload Tags</Text>
            <View style={styles.pills}>
                {WORKLOAD_TAGS.map((tag) => {
                    const selected = workloadTags.includes(tag);
                    return (
                        <Chip
                            key={tag}
                            selected={selected}
                            onPress={() =>
                                setWorkloadTags((current: string[]) =>
                                    current.includes(tag) ? current.filter((x: string) => x !== tag) : [...current, tag]
                                )
                            }
                            style={chipStyle(selected)}
                            textStyle={chipTextStyle(selected)}
                        >
                            {tag}
                        </Chip>
                    );
                })}
            </View>
        </Surface>
    );

    const renderSkills = () => (
        <Surface style={styles.card} elevation={1}>
            <Text style={styles.label}>Skills</Text>
            <Text style={styles.subHeader}>Must-Have Skills</Text>
            <View style={styles.checkGrid}>
                {SKILL_OPTIONS.map((skill) => {
                    const checked = mustHave.includes(skill);
                    return (
                        <TouchableOpacity
                            key={`must-${skill}`}
                            style={[styles.checkboxRow, checked && styles.checkboxRowActive]}
                            onPress={() =>
                                setMustHave((current: string[]) =>
                                    current.includes(skill) ? current.filter((x: string) => x !== skill) : [...current, skill]
                                )
                            }
                        >
                            <Checkbox status={checked ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>{skill}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.subHeader}>Nice-to-Have Skills</Text>
            <View style={styles.checkGrid}>
                {SKILL_OPTIONS.map((skill) => {
                    const checked = niceToHave.includes(skill);
                    return (
                        <TouchableOpacity
                            key={`nice-${skill}`}
                            style={[styles.checkboxRow, checked && styles.checkboxRowActive]}
                            onPress={() =>
                                setNiceToHave((current: string[]) =>
                                    current.includes(skill) ? current.filter((x: string) => x !== skill) : [...current, skill]
                                )
                            }
                        >
                            <Checkbox status={checked ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>{skill}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </Surface>
    );

    const renderVisibility = () => (
        <Surface style={styles.card} elevation={1}>
            <Text style={styles.label}>Visibility</Text>
            <Text style={styles.helper}>
                {isEmbedded ? 'This booking is private and only visible to the selected worker.' : 'Define who sees this shift and when it escalates.'}
            </Text>
            <View style={styles.row}>
                <Checkbox status={hideName ? 'checked' : 'unchecked'} onPress={() => setHideName((v) => !v)} />
                <Text style={styles.rowText}>Hide pharmacy name from applicants</Text>
            </View>
            {!isEmbedded && (
                <>
                    <Text style={styles.label}>Initial Audience</Text>
                    <Menu
                        visible={audienceMenuVisible}
                        onDismiss={() => setAudienceMenuVisible(false)}
                        anchor={
                            <TouchableOpacity style={styles.selector} onPress={() => setAudienceMenuVisible(true)}>
                                <Text style={styles.selectorText}>
                                    {{
                                        FULL_PART_TIME: 'Pharmacy Members (FT/PT)',
                                        LOCUM_CASUAL: 'Favourite Staff',
                                        OWNER_CHAIN: 'Owner Chain',
                                        ORG_CHAIN: 'Organization',
                                        PLATFORM: 'Platform (Public)',
                                    }[initialAudience as VisibilityTier] || 'Select audience'}
                                </Text>
                                <IconButton icon="chevron-down" size={18} />
                            </TouchableOpacity>
                        }
                    >
                        {allowedVis.map((value) => (
                            <Menu.Item
                                key={value}
                                onPress={() => {
                                    setInitialAudience(value);
                                    setAudienceMenuVisible(false);
                                }}
                                title={{
                                    FULL_PART_TIME: 'Pharmacy Members (FT/PT)',
                                    LOCUM_CASUAL: 'Favourite Staff',
                                    OWNER_CHAIN: 'Owner Chain',
                                    ORG_CHAIN: 'Organization',
                                    PLATFORM: 'Platform (Public)',
                                }[value]}
                            />
                        ))}
                    </Menu>

                    {(() => {
                        const startIdx = allowedVis.indexOf(initialAudience as VisibilityTier);
                        const items =
                            startIdx > -1 ? allowedVis.slice(startIdx + 1) : allowedVis;
                        if (!items.length) return null;
                        const labelMap: Record<VisibilityTier, string> = {
                            FULL_PART_TIME: 'Full / Part Time',
                            LOCUM_CASUAL: 'Favourite Staff',
                            OWNER_CHAIN: 'Owner Chain',
                            ORG_CHAIN: 'Organization',
                            PLATFORM: 'Platform (Public)',
                        };
                        return items.map((tier) => (
                            <View key={tier}>
                                <Text style={styles.label}>Escalate to {labelMap[tier]}</Text>
                                <TextInput
                                    mode="outlined"
                                    value={escalationDates[
                                        tier === 'ORG_CHAIN' ? 'org_chain' :
                                            tier === 'OWNER_CHAIN' ? 'owner_chain' :
                                                tier === 'LOCUM_CASUAL' ? 'locum_casual' : 'platform'
                                    ] || ''}
                                    placeholder="YYYY-MM-DD"
                                    style={styles.input}
                                    right={<TextInput.Icon icon="calendar" onPress={() => setEscalationPicker({
                                        key:
                                            tier === 'ORG_CHAIN' ? 'org_chain' :
                                                tier === 'OWNER_CHAIN' ? 'owner_chain' :
                                                    tier === 'LOCUM_CASUAL' ? 'locum_casual' : 'platform',
                                        open: true
                                    })} />}
                                    editable={false}
                                />
                            </View>
                        ));
                    })()}

                    {/* Notification Preferences */}
                    <Text style={styles.label}>Notifications</Text>
                    {initialAudience !== 'FULL_PART_TIME' && (
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setNotifyPharmacyStaff(v => !v)}
                        >
                            <Checkbox status={notifyPharmacyStaff ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>Notify pharmacy staff</Text>
                        </TouchableOpacity>
                    )}
                    {['LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'].includes(initialAudience) && (
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setNotifyFavoriteStaff(v => !v)}
                        >
                            <Checkbox status={notifyFavoriteStaff ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>Notify favorite staff</Text>
                        </TouchableOpacity>
                    )}
                    {['OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'].includes(initialAudience) && (
                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setNotifyChainMembers(v => !v)}
                        >
                            <Checkbox status={notifyChainMembers ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>Notify chain members</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </Surface>
    );

    const renderPayRate = () => {
        const showSlotPreview = isLocumLike && !(roleNeeded === 'PHARMACIST' && rateType === 'PHARMACIST_PROVIDED');
        const renderSlotPreviewList = () => {
            if (!showSlotPreview || expandedSlots.length === 0) return null;
            return (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8, gap: 8 }}>
                    <Text style={styles.label}>Slot rate preview</Text>
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
                            <View key={`${slot.date}-${slot.startTime}-${idx}`} style={{ gap: 6 }}>
                                <Text style={styles.helper}>{`${slot.date} ${slot.startTime}-${slot.endTime}`}</Text>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    <TextInput
                                        mode="outlined"
                                        label="Rate ($/hr)"
                                        value={row.rate}
                                        onChangeText={(value) => handleSlotRateChange(idx, value)}
                                        keyboardType="numeric"
                                        style={[styles.input, { flex: 1 }]}
                                    />
                                    <Text style={styles.helper}>
                                        {row.status === 'loading' ? 'Calculating...' : `Final: ${finalLabel}`}
                                    </Text>
                                </View>
                                {row.status === 'error' && row.error ? (
                                    <Text style={{ color: '#B91C1C', fontSize: 12 }}>{row.error}</Text>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            );
        };

        return (
            <Surface style={styles.card} elevation={1}>
                <Text style={styles.label}>Pay Rate</Text>
                {!isLocumLike ? (
                    <>
                        <Text style={[styles.label, { marginTop: 16 }]}>Salary Range</Text>
                        <View style={styles.pills}>
                            {['HOURLY', 'ANNUAL'].map((mode) => {
                                const selected = ftptPayMode === mode;
                                return (
                                    <Chip
                                        key={mode}
                                        selected={selected}
                                        onPress={() => setFtptPayMode(mode as 'HOURLY' | 'ANNUAL')}
                                        style={chipStyle(selected)}
                                        textStyle={chipTextStyle(selected)}
                                    >
                                        {mode === 'HOURLY' ? 'Hourly' : 'Annual Package'}
                                    </Chip>
                                );
                            })}
                        </View>
                        {ftptPayMode === 'HOURLY' ? (
                            <>
                                <TextInput mode="outlined" label="Min Hourly Rate ($/hr)" value={minHourly} onChangeText={setMinHourly} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Max Hourly Rate ($/hr)" value={maxHourly} onChangeText={setMaxHourly} keyboardType="numeric" style={styles.input} />
                            </>
                        ) : (
                            <>
                                <TextInput mode="outlined" label="Min Annual Package ($)" value={minAnnual} onChangeText={setMinAnnual} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Max Annual Package ($)" value={maxAnnual} onChangeText={setMaxAnnual} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Super (%)" value={superPercent} onChangeText={setSuperPercent} keyboardType="numeric" style={styles.input} />
                            </>
                        )}
                    </>
                ) : roleNeeded === 'PHARMACIST' ? (
                    <>
                        <View style={styles.pills}>
                            {(['FLEXIBLE', 'FIXED', 'PHARMACIST_PROVIDED'] as RateType[]).map((mode) => {
                                const selected = rateType === mode;
                                return (
                                    <Chip key={mode} selected={selected} onPress={() => setRateType(mode)} style={chipStyle(selected)} textStyle={chipTextStyle(selected)}>
                                        {mode === 'FLEXIBLE' ? 'Flexible Rate' : mode === 'FIXED' ? 'Fixed Rate' : 'Pharmacist Provided'}
                                    </Chip>
                                );
                            })}
                        </View>
                        <Text style={[styles.label, { marginTop: 16 }]}>Payment Type</Text>
                        <View style={styles.pills}>
                            {(['ABN', 'TFN'] as const).map((pref) => {
                                const selected = paymentPreference === pref;
                                return (
                                    <Chip
                                        key={pref}
                                        selected={selected}
                                        onPress={() => setPaymentPreference(pref)}
                                        style={chipStyle(selected)}
                                        textStyle={chipTextStyle(selected)}
                                    >
                                        {pref}
                                    </Chip>
                                );
                            })}
                        </View>
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setLocumSuperIncluded((v) => !v)}>
                            <Checkbox status={locumSuperIncluded ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>Include superannuation (+super)</Text>
                        </TouchableOpacity>

                        {rateType === 'FIXED' ? (
                            <TextInput mode="outlined" label="Fixed rate ($/hr)" value={fixedRate} onChangeText={setFixedRate} keyboardType="numeric" style={styles.input} />
                        ) : null}

                        {rateType !== 'PHARMACIST_PROVIDED' ? (
                            <>
                                <Text style={[styles.label, { marginTop: 16 }]}>Base rates ($/hr)</Text>
                                <TextInput mode="outlined" label="Weekday" value={rateWeekday} onChangeText={setRateWeekday} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Saturday" value={rateSaturday} onChangeText={setRateSaturday} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Sunday" value={rateSunday} onChangeText={setRateSunday} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Public Holiday" value={ratePublicHoliday} onChangeText={setRatePublicHoliday} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Early Morning" value={rateEarlyMorning} onChangeText={setRateEarlyMorning} keyboardType="numeric" style={styles.input} />
                                <TextInput mode="outlined" label="Late Night" value={rateLateNight} onChangeText={setRateLateNight} keyboardType="numeric" style={styles.input} />
                                <TouchableOpacity style={styles.checkboxRow} onPress={() => setApplyRatesToPharmacy((v) => !v)}>
                                    <Checkbox status={applyRatesToPharmacy ? 'checked' : 'unchecked'} />
                                    <Text style={styles.rowText}>Apply these rates to pharmacy defaults</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                        {renderSlotPreviewList()}
                    </>
                ) : (
                    <>
                        <Text style={styles.helper}>Rate is set by government award</Text>
                        <Text style={[styles.label, { marginTop: 16 }]}>Payment Type</Text>
                        <View style={styles.pills}>
                            {(['ABN', 'TFN'] as const).map((pref) => {
                                const selected = paymentPreference === pref;
                                return (
                                    <Chip key={pref} selected={selected} onPress={() => setPaymentPreference(pref)} style={chipStyle(selected)} textStyle={chipTextStyle(selected)}>
                                        {pref}
                                    </Chip>
                                );
                            })}
                        </View>
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setLocumSuperIncluded((v) => !v)}>
                            <Checkbox status={locumSuperIncluded ? 'checked' : 'unchecked'} />
                            <Text style={styles.rowText}>Include superannuation (+super)</Text>
                        </TouchableOpacity>
                        <TextInput mode="outlined" label="Owner Bonus ($/hr, optional)" value={ownerBonus} onChangeText={setOwnerBonus} keyboardType="numeric" style={styles.input} />
                        {renderSlotPreviewList()}
                    </>
                )}
            </Surface>
        );
    };

    const renderTimetable = () => (
        <Surface style={styles.card} elevation={1}>
            <View style={styles.slotHeader}>
                <Text style={styles.label}>Timetable</Text>
                <Button mode="contained" onPress={addSlot} icon="plus" style={styles.primaryBtn} labelStyle={styles.primaryBtnText}>
                    Add slot
                </Button>
            </View>

            <View style={styles.slotRow}>
                <TextInput
                    mode="outlined"
                    label="Date"
                    value={selectedDates.length > 0 ? `${selectedDates.length} dates selected` : slotDate}
                    style={styles.slotInput}
                    placeholder="Select date(s)"
                    right={<TextInput.Icon icon="calendar" onPress={() => setSlotDatePickerOpen(true)} />}
                    editable={false}
                />
                <TextInput
                    mode="outlined"
                    label="Start"
                    value={slotStart}
                    onChangeText={setSlotStart}
                    style={styles.slotInput}
                    placeholder="09:00"
                />
                <TextInput
                    mode="outlined"
                    label="End"
                    value={slotEnd}
                    onChangeText={setSlotEnd}
                    style={styles.slotInput}
                    placeholder="17:00"
                />
            </View>

            <Surface style={styles.calendarPanel} elevation={0}>
                <View style={styles.calendarHeader}>
                    <IconButton
                        icon="chevron-left"
                        size={18}
                        onPress={() => setCalendarMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    />
                    <Text style={styles.calendarTitle}>{monthLabel}</Text>
                    <IconButton
                        icon="chevron-right"
                        size={18}
                        onPress={() => setCalendarMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    />
                </View>
                <View style={styles.calendarWeekHead}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                        <Text key={`${d}-${idx}`} style={styles.calendarWeekText}>{d}</Text>
                    ))}
                </View>
                <View style={styles.calendarGrid}>
                    {monthCalendarCells.map((cell, idx) => {
                        if (!cell.inMonth) {
                            return <View key={`${cell.iso}-${idx}`} style={[styles.calendarCell, styles.calendarCellPad]} />;
                        }
                        const isSelected = selectedDateSet.has(cell.iso);
                        const hasSlot = slotDateSet.has(cell.iso);
                        return (
                            <TouchableOpacity
                                key={`${cell.iso}-${idx}`}
                                style={[
                                    styles.calendarCell,
                                    isSelected && styles.calendarCellSelected,
                                    hasSlot && styles.calendarCellWithSlot,
                                ]}
                                onPress={() => {
                                    setSlotDate(cell.iso);
                                    setSelectedDates((prev) =>
                                        prev.includes(cell.iso)
                                            ? prev.filter((d) => d !== cell.iso)
                                            : [...prev, cell.iso].sort()
                                    );
                                }}
                            >
                                <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>
                                    {cell.day}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.hint}>Blue: selected dates, purple border: dates already added to timetable.</Text>
            </Surface>

            <View style={styles.row}>
                <Checkbox status={slotRecurring ? 'checked' : 'unchecked'} onPress={() => setSlotRecurring((v) => !v)} />
                <Text style={styles.rowText}>Recurring</Text>
            </View>

            {slotRecurring ? (
                <>
                    <View style={styles.recurringRow}>
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                            <Chip
                                key={day}
                                selected={slotRecurringDays.includes(day)}
                                onPress={() => toggleRecurringDay(day)}
                                style={chipStyle(slotRecurringDays.includes(day))}
                                textStyle={chipTextStyle(slotRecurringDays.includes(day))}
                            >
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'][day]}
                            </Chip>
                        ))}
                    </View>
                    <TextInput
                        mode="outlined"
                        label="Recurring end date"
                        value={slotRecurringEnd}
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        right={<TextInput.Icon icon="calendar" onPress={() => setRecurringEndPickerOpen(true)} />}
                        editable={false}
                    />
                </>
            ) : null}

            <View style={styles.row}>
                <Checkbox status={singleUserOnly ? 'checked' : 'unchecked'} onPress={() => setSingleUserOnly((v) => !v)} />
                <Text style={styles.rowText}>Single user only</Text>
            </View>

            {selectedDates.length > 0 ? (
                <View style={styles.pills}>
                    {selectedDates.map((date) => (
                        <Chip
                            key={date}
                            onClose={() => setSelectedDates((prev) => prev.filter((d) => d !== date))}
                            style={styles.chipUnselected}
                            textStyle={styles.chipText}
                        >
                            {date}
                        </Chip>
                    ))}
                </View>
            ) : null}

            <View style={{ gap: 8, marginTop: 8 }}>
                {slots.map((slot, idx) => (
                    <Surface key={`${slot.date}-${idx}`} style={styles.slotItem} elevation={0}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.slotText}>
                                {slot.date} — {slot.startTime} to {slot.endTime}
                            </Text>
                            {slot.isRecurring ? (
                                <Text style={styles.slotRecurringText}>
                                    Recurring: {slot.recurringDays.join(', ')} until {slot.recurringEndDate || 'N/A'}
                                </Text>
                            ) : null}
                        </View>
                        <IconButton icon="delete" size={18} onPress={() => removeSlot(idx)} />
                    </Surface>
                ))}
                {slots.length === 0 && <Text style={styles.hint}>Add at least one slot (date + start/end time).</Text>}
            </View>
        </Surface>
    );

    const renderStep = (step: StepKey) => {
        switch (step) {
            case 'details': return renderDetails();
            case 'skills': return renderSkills();
            case 'visibility': return renderVisibility();
            case 'timetable': return renderTimetable();
            case 'payrate': return renderPayRate();
            default: return null;
        }
    };

    useEffect(() => {
        if (!stepOrder.includes(activeStep)) {
            setActiveStep(stepOrder[stepOrder.length - 1]);
        }
    }, [activeStep, stepOrder]);

    const stepIndex = stepOrder.indexOf(activeStep);
    const goNext = () => {
        if (stepIndex < stepOrder.length - 1) setActiveStep(stepOrder[stepIndex + 1]);
    };
    const goBack = () => {
        if (stepIndex > 0) setActiveStep(stepOrder[stepIndex - 1]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
                <Text variant="headlineMedium" style={styles.title}>
                    {editingId ? 'Edit Shift' : (isEmbedded ? 'Request a Booking' : 'Create a New Shift')}
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    {isEmbedded ? 'Review the details and submit a direct booking request for this worker.' : 'Follow the steps to post a new shift opportunity.'}
                </Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stepper}
                >
                    {stepOrder.map((step) => (
                        <TouchableOpacity
                            key={step}
                            style={[styles.stepPill, activeStep === step && styles.stepPillActive]}
                            onPress={() => setActiveStep(step)}
                        >
                            <Text style={[styles.stepPillText, activeStep === step && styles.stepPillTextActive]}>
                                {step.replace('-', ' ')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {error ? <HelperText type="error">{error}</HelperText> : null}

                {renderStep(activeStep)}

                <View style={styles.navRow}>
                    <Button mode="outlined" onPress={goBack} disabled={stepIndex === 0}>Back</Button>
                    {stepIndex < stepOrder.length - 1 ? (
                        <Button
                            mode="contained"
                            onPress={() => {
                                if (activeStep === 'timetable' && slots.length === 0) {
                                    setError('Please add at least one timetable entry.');
                                    return;
                                }
                                goNext();
                            }}
                            style={styles.primaryBtn}
                            labelStyle={styles.primaryBtnText}
                        >
                            Next
                        </Button>
                    ) : (
                        <Button mode="contained" onPress={handleSubmit} disabled={!canSubmit || loading} loading={loading} style={styles.primaryBtn} labelStyle={styles.primaryBtnText}>
                            {editingId ? 'Update Shift' : (isEmbedded ? 'Send Booking Request' : 'Post Shift')}
                        </Button>
                    )}
                </View>
            </ScrollView>

            <Snackbar visible={!!toast} onDismiss={() => setToast('')} duration={2500}>
                {toast}
            </Snackbar>

            <DatePickerModal
                mode="multiple"
                locale="en"
                visible={slotDatePickerOpen}
                onDismiss={() => setSlotDatePickerOpen(false)}
                dates={selectedDateObjects}
                onConfirm={(params: any) => {
                    const pickedDates: Date[] = Array.isArray(params?.dates)
                        ? params.dates
                        : params?.date
                            ? [params.date]
                            : [];
                    mergeSelectedDates(
                        pickedDates
                            .filter(Boolean)
                            .map((d) => d.toISOString().split('T')[0])
                    );
                    setSlotDatePickerOpen(false);
                }}
            />
            <DatePickerModal
                mode="single"
                locale="en"
                visible={recurringEndPickerOpen}
                onDismiss={() => setRecurringEndPickerOpen(false)}
                date={new Date(slotRecurringEnd)}
                onConfirm={({ date }) => {
                    if (date) setSlotRecurringEnd(date.toISOString().split('T')[0]);
                    setRecurringEndPickerOpen(false);
                }}
            />
            <DatePickerModal
                mode="single"
                locale="en"
                visible={escalationPicker.open}
                onDismiss={() => setEscalationPicker({ key: null, open: false })}
                date={escalationPicker.key && escalationDates[escalationPicker.key] ? new Date(escalationDates[escalationPicker.key] as string) : new Date()}
                onConfirm={({ date }) => {
                    if (date && escalationPicker.key) {
                        setEscalation(escalationPicker.key, date.toISOString().split('T')[0]);
                    }
                    setEscalationPicker({ key: null, open: false });
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 32, gap: 16 },
    title: { fontWeight: '700', color: '#111827' },
    subtitle: { color: '#6B7280', marginTop: 4 },
    stepper: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 8,
        justifyContent: 'center',
        flexWrap: 'nowrap',
    },
    stepPill: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: '#EEF2FF',
    },
    stepPillActive: {
        backgroundColor: PRIMARY,
    },
    stepPillText: {
        color: PRIMARY_TEXT,
        fontWeight: '600',
        fontSize: 12,
    },
    stepPillTextActive: {
        color: '#FFFFFF',
    },
    label: { fontWeight: '600', color: '#111827', marginTop: 12, marginBottom: 6 },
    subHeader: { fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 6 },
    input: { backgroundColor: '#FFFFFF' },
    helper: { color: '#6B7280', marginBottom: 8 },
    card: { padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF', gap: 6 },
    selector: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectorText: { color: '#111827', fontWeight: '600', flex: 1 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderColor: PRIMARY, borderWidth: 1 },
    chipSelected: { backgroundColor: PRIMARY },
    chipUnselected: { backgroundColor: PRIMARY_LIGHT },
    chipText: { color: PRIMARY_TEXT, fontWeight: '600' },
    chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },
    slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    slotRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    slotInput: { flex: 1, backgroundColor: '#FFFFFF' },
    calendarPanel: {
        marginTop: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        padding: 10,
        gap: 6,
    },
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    calendarTitle: { color: '#111827', fontWeight: '700' },
    calendarWeekHead: { flexDirection: 'row' },
    calendarWeekText: {
        width: '14.2857%',
        textAlign: 'center',
        color: '#6B7280',
        fontWeight: '700',
        fontSize: 12,
    },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: {
        width: '14.2857%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        marginBottom: 4,
    },
    calendarCellPad: {
        borderColor: 'transparent',
        backgroundColor: 'transparent',
    },
    calendarCellSelected: {
        backgroundColor: '#DBEAFE',
        borderColor: '#2563EB',
    },
    calendarCellWithSlot: {
        borderColor: '#7C3AED',
        borderWidth: 2,
    },
    calendarCellText: {
        color: '#111827',
        fontWeight: '600',
    },
    calendarCellTextSelected: {
        color: '#1D4ED8',
        fontWeight: '700',
    },
    slotItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#F9FAFB',
    },
    slotText: { color: '#111827' },
    slotRecurringText: { color: '#6B7280', fontSize: 12 },
    hint: { color: '#6B7280' },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    rowText: { color: '#111827' },
    recurringRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
    },
    checkboxRowActive: {
        backgroundColor: PRIMARY_LIGHT,
        borderColor: PRIMARY,
        borderWidth: 1,
    },
    primaryBtn: { backgroundColor: PRIMARY },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
