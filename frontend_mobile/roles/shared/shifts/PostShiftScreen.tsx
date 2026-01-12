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
const PRIMARY = '#7C3AED';
const PRIMARY_LIGHT = '#F3E8FF';
const PRIMARY_TEXT = '#2D1B69';

const STEP_ORDER = ['details', 'skills', 'visibility', 'payrate', 'timetable', 'review'] as const;
type StepKey = typeof STEP_ORDER[number];
type RateMode = 'FLEXIBLE' | 'FIXED';
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

export default function PostShiftScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ edit?: string }>();
    const editingId = params?.edit ? Number(params.edit) : null;
    const loadedVisibilityRef = React.useRef<string | null>(null);

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
    const [rateMode, setRateMode] = useState<RateMode>('FLEXIBLE');
    const [fixedRate, setFixedRate] = useState('');
    const [ownerBonus, setOwnerBonus] = useState('');
    const [slots, setSlots] = useState<SlotEntry[]>([]);
    const [slotDate, setSlotDate] = useState<string>(new Date().toISOString().split('T')[0]);
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

    // Rate calculation
    const [calculatedRates, setCalculatedRates] = useState<Array<{ rate: number; error?: string }>>([]);
    const [ratesLoading, setRatesLoading] = useState(false);

    // Notification preferences
    const [notifyPharmacyStaff, setNotifyPharmacyStaff] = useState(false);
    const [notifyFavoriteStaff, setNotifyFavoriteStaff] = useState(false);
    const [notifyChainMembers, setNotifyChainMembers] = useState(false);

    // Payment & super
    const [paymentPreference, setPaymentPreference] = useState<'ABN' | 'NON_ABN'>('ABN');
    const [locumSuperIncluded, setLocumSuperIncluded] = useState(true);

    // FT/PT specific
    const [ftptPayMode, setFtptPayMode] = useState<'HOURLY' | 'ANNUAL'>('HOURLY');
    const [minHourly, setMinHourly] = useState('');
    const [maxHourly, setMaxHourly] = useState('');
    const [minAnnual, setMinAnnual] = useState('');
    const [maxAnnual, setMaxAnnual] = useState('');

    // Other
    const [applyRatesToPharmacy, setApplyRatesToPharmacy] = useState(false);

    const canSubmit = useMemo(() => Boolean(pharmacyId && slots.length > 0), [pharmacyId, slots.length]);

    const resetForm = useCallback(() => {
        const todayIso = new Date().toISOString().split('T')[0];
        setPharmacyId('');
        setRoleNeeded('PHARMACIST');
        setEmploymentType('LOCUM');
        setWorkloadTags([]);
        setMustHave([]);
        setNiceToHave([]);
        setHideName(false);
        setSingleUserOnly(false);
        setInitialAudience('');
        setRateMode('FLEXIBLE');
        setFixedRate('');
        setOwnerBonus('');
        setDescription('');
        setSlots([]);
        setSlotDate(todayIso);
        setSlotStart('09:00');
        setSlotEnd('17:00');
        setSlotRecurring(false);
        setSlotRecurringDays([]);
        setSlotRecurringEnd(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
        setEscalationDates({});
        setToast('');
        setError('');
        // Reset new fields
        setCalculatedRates([]);
        setNotifyPharmacyStaff(false);
        setNotifyFavoriteStaff(false);
        setNotifyChainMembers(false);
        setPaymentPreference('ABN');
        setLocumSuperIncluded(true);
        setFtptPayMode('HOURLY');
        setMinHourly('');
        setMaxHourly('');
        setMinAnnual('');
        setMaxAnnual('');
        setApplyRatesToPharmacy(false);
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

    // Ensure initial audience stays within allowed tiers
    useEffect(() => {
        if (allowedVis.length && !allowedVis.includes(initialAudience as VisibilityTier)) {
            setInitialAudience(allowedVis[0]);
        }
    }, [allowedVis, initialAudience]);

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
            setRateMode(rateTypeValue === 'FIXED' || fixed ? 'FIXED' : 'FLEXIBLE');
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
            await loadPharmacies(); // This will set pharmaciesLoaded to true
            if (editingId) {
                // We need to wait for pharmacies to be loaded before loading the shift
                // to ensure all dependencies like `allowedVis` are ready.
                // The `pharmaciesLoaded` state change will trigger the next effect.
            } else {
                resetForm();
            }
        };
        void initialize();
    }, [editingId, loadPharmacies, resetForm]);

    useEffect(() => { if (editingId && pharmaciesLoaded) { void loadShift(); } }, [editingId, pharmaciesLoaded, loadShift]);

    // Automatic rate calculation for PHARMACIST with FLEXIBLE rate type
    useEffect(() => {
        if (!pharmacyId || !slots.length || roleNeeded !== 'PHARMACIST' || rateMode !== 'FLEXIBLE') {
            setCalculatedRates([]);
            return;
        }

        const fetchRates = async () => {
            setRatesLoading(true);
            try {
                const ratesData = await calculateShiftRates({
                    pharmacyId: pharmacyId as number,
                    role: roleNeeded,
                    employmentType,
                    slots: slots.map(s => ({
                        date: s.date,
                        startTime: s.startTime,
                        endTime: s.endTime,
                    })),
                });
                setCalculatedRates(ratesData);
            } catch (error) {
                console.error('Rate calculation failed:', error);
                setCalculatedRates([]);
            } finally {
                setRatesLoading(false);
            }
        };

        void fetchRates();
    }, [pharmacyId, roleNeeded, employmentType, slots, rateMode]);

    const addSlot = () => {
        if (!slotDate || !slotStart || !slotEnd) return;
        setSlots((prev) => [
            ...prev,
            {
                date: slotDate,
                startTime: slotStart,
                endTime: slotEnd,
                isRecurring: slotRecurring,
                recurringDays: slotRecurring ? slotRecurringDays : [],
                recurringEndDate: slotRecurring ? slotRecurringEnd : '',
            },
        ]);
    };

    const removeSlot = (index: number) => setSlots((prev) => prev.filter((_, i) => i !== index));
    const toggleRecurringDay = (day: number) => setSlotRecurringDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    const setEscalation = (key: keyof VisibilityDates, value: string) => setEscalationDates((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        setError('');
        if (!canSubmit) {
            setError('Please select a pharmacy and add at least one slot.');
            return;
        }
        setLoading(true);
        try {
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
                visibility: initialAudience,
                escalate_to_locum_casual: escalationDates.locum_casual,
                escalate_to_owner_chain: escalationDates.owner_chain,
                escalate_to_org_chain: escalationDates.org_chain,
                escalate_to_platform: escalationDates.platform,
                slots: slots.map((s) => ({
                    date: s.date,
                    start_time: s.startTime,
                    end_time: s.endTime,
                    is_recurring: s.isRecurring,
                    recurring_days: s.isRecurring ? s.recurringDays : [],
                    recurring_end_date: s.isRecurring && s.recurringEndDate ? s.recurringEndDate : undefined,
                })),
                // New fields
                notify_pharmacy_staff: notifyPharmacyStaff,
                notify_favorite_staff: notifyFavoriteStaff,
                notify_chain_members: notifyChainMembers,
                payment_preference: paymentPreference,
                super_percent: locumSuperIncluded ? 11.5 : 0,
                apply_rates_to_pharmacy: applyRatesToPharmacy,
            };

            if (roleNeeded === 'PHARMACIST') {
                if (rateMode === 'FIXED' && fixedRate) {
                    payload.hourly_rate = Number(fixedRate);
                }
            } else {
                if (ownerBonus) {
                    payload.owner_bonus = Number(ownerBonus);
                }
            }

            // Add FT/PT specific fields
            if (employmentType === 'FULL_TIME' || employmentType === 'PART_TIME') {
                if (ftptPayMode === 'HOURLY') {
                    if (minHourly) payload.min_hourly_rate = Number(minHourly);
                    if (maxHourly) payload.max_hourly_rate = Number(maxHourly);
                } else {
                    if (minAnnual) payload.min_annual_salary = Number(minAnnual);
                    if (maxAnnual) payload.max_annual_salary = Number(maxAnnual);
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
            <Text style={styles.helper}>Define who sees this shift and when it escalates.</Text>
            <View style={styles.row}>
                <Checkbox status={hideName ? 'checked' : 'unchecked'} onPress={() => setHideName((v) => !v)} />
                <Text style={styles.rowText}>Hide pharmacy name from applicants</Text>
            </View>
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
        </Surface>
    );

    const renderPayRate = () => (
        <Surface style={styles.card} elevation={1}>
            <Text style={styles.label}>Pay Rate</Text>
            {roleNeeded === 'PHARMACIST' ? (
                <>
                    <View style={styles.pills}>
                        {['FLEXIBLE', 'FIXED'].map((mode) => {
                            const selected = rateMode === mode;
                            return (
                                <Chip
                                    key={mode}
                                    selected={selected}
                                    onPress={() => setRateMode(mode as RateMode)}
                                    style={chipStyle(selected)}
                                    textStyle={chipTextStyle(selected)}
                                >
                                    {mode === 'FLEXIBLE' ? 'Flexible / Pharmacist Provided' : 'Fixed Rate'}
                                </Chip>
                            );
                        })}
                    </View>
                    {rateMode === 'FIXED' ? (
                        <TextInput
                            mode="outlined"
                            label="Fixed rate ($/hr)"
                            value={fixedRate}
                            onChangeText={setFixedRate}
                            keyboardType="numeric"
                            style={styles.input}
                        />
                    ) : null}
                </>
            ) : (
                <>
                    <Text style={styles.helper}>Rate is set by award. Add optional owner bonus.</Text>
                    <TextInput
                        mode="outlined"
                        label="Owner Bonus ($/hr, optional)"
                        value={ownerBonus}
                        onChangeText={setOwnerBonus}
                        keyboardType="numeric"
                        style={styles.input}
                    />
                </>
            )}

            {/* Calculated Rates Display (Pharmacist + Flexible only) */}
            {roleNeeded === 'PHARMACIST' && rateMode === 'FLEXIBLE' && calculatedRates.length > 0 && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8 }}>
                    <Text style={[styles.label, { marginBottom: 8 }]}>Calculated Rates (Preview)</Text>
                    {ratesLoading ? (
                        <Text style={styles.helper}>Calculating...</Text>
                    ) : (
                        calculatedRates.map((rateData, idx) => (
                            <Text key={idx} style={styles.helper}>
                                Slot {idx + 1}: {rateData.error || `$${rateData.rate.toFixed(2)}/hr`}
                            </Text>
                        ))
                    )}
                </View>
            )}

            {/* Payment Preference */}
            <Text style={[styles.label, { marginTop: 16 }]}>Payment Preference</Text>
            <View style={styles.pills}>
                {['ABN', 'NON_ABN'].map((pref) => {
                    const selected = paymentPreference === pref;
                    return (
                        <Chip
                            key={pref}
                            selected={selected}
                            onPress={() => setPaymentPreference(pref as 'ABN' | 'NON_ABN')}
                            style={chipStyle(selected)}
                            textStyle={chipTextStyle(selected)}
                        >
                            {pref === 'ABN' ? 'ABN' : 'Non-ABN'}
                        </Chip>
                    );
                })}
            </View>

            {/* Super Toggle (LOCUM/CASUAL only) */}
            {(employmentType === 'LOCUM' || employmentType === 'CASUAL') && (
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setLocumSuperIncluded(v => !v)}
                >
                    <Checkbox status={locumSuperIncluded ? 'checked' : 'unchecked'} />
                    <Text style={styles.rowText}>Superannuation included in rate (11.5%)</Text>
                </TouchableOpacity>
            )}

            {/* Apply Rates to Pharmacy */}
            {roleNeeded === 'PHARMACIST' && rateMode === 'FIXED' && (
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setApplyRatesToPharmacy(v => !v)}
                >
                    <Checkbox status={applyRatesToPharmacy ? 'checked' : 'unchecked'} />
                    <Text style={styles.rowText}>Save as default pharmacy rates</Text>
                </TouchableOpacity>
            )}

            {/* FT/PT Specific Fields */}
            {(employmentType === 'FULL_TIME' || employmentType === 'PART_TIME') && (
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
                                    {mode === 'HOURLY' ? 'Hourly' : 'Annual Salary'}
                                </Chip>
                            );
                        })}
                    </View>

                    {ftptPayMode === 'HOURLY' ? (
                        <>
                            <TextInput
                                mode="outlined"
                                label="Min Hourly Rate ($/hr)"
                                value={minHourly}
                                onChangeText={setMinHourly}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                            <TextInput
                                mode="outlined"
                                label="Max Hourly Rate ($/hr)"
                                value={maxHourly}
                                onChangeText={setMaxHourly}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                        </>
                    ) : (
                        <>
                            <TextInput
                                mode="outlined"
                                label="Min Annual Salary ($)"
                                value={minAnnual}
                                onChangeText={setMinAnnual}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                            <TextInput
                                mode="outlined"
                                label="Max Annual Salary ($)"
                                value={maxAnnual}
                                onChangeText={setMaxAnnual}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                        </>
                    )}
                </>
            )}
        </Surface>
    );

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
                    value={slotDate}
                    style={styles.slotInput}
                    placeholder="YYYY-MM-DD"
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

    const renderReview = () => (
        <Surface style={styles.card} elevation={1}>
            <Text style={styles.label}>Review</Text>
            <Text>Pharmacy: {pharmacies.find((p) => p.id === pharmacyId)?.name || '-'}</Text>
            <Text>Role: {roleNeeded}</Text>
            <Text>Employment: {employmentType.replace('_', ' ')}</Text>
            <Text>Workload: {workloadTags.join(', ') || '-'}</Text>
            <Text>
                Pay: {roleNeeded === 'PHARMACIST'
                    ? rateMode === 'FIXED'
                        ? `Fixed $${fixedRate || '0'}/hr`
                        : 'Flexible / pharmacist provided'
                    : ownerBonus
                        ? `Award + $${ownerBonus}/hr bonus`
                        : 'Award rate'}
            </Text>
            <Text>Must have: {mustHave.join(', ') || '-'}</Text>
            <Text>Nice to have: {niceToHave.join(', ') || '-'}</Text>
            <Text>Hide name: {hideName ? 'Yes' : 'No'}</Text>
            <Text>Single user only: {singleUserOnly ? 'Yes' : 'No'}</Text>
            <Text>Escalation dates: {Object.entries(escalationDates).map(([k, v]) => `${k}: ${v}`).join(' | ') || '-'}</Text>
            <Text>Slots: {slots.length}</Text>
        </Surface>
    );

    const renderStep = (step: StepKey) => {
        switch (step) {
            case 'details': return renderDetails();
            case 'skills': return renderSkills();
            case 'visibility': return renderVisibility();
            case 'payrate': return renderPayRate();
            case 'timetable': return renderTimetable();
            case 'review': return renderReview();
            default: return null;
        }
    };

    const stepIndex = STEP_ORDER.indexOf(activeStep);
    const goNext = () => {
        if (stepIndex < STEP_ORDER.length - 1) setActiveStep(STEP_ORDER[stepIndex + 1]);
    };
    const goBack = () => {
        if (stepIndex > 0) setActiveStep(STEP_ORDER[stepIndex - 1]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
                <Text variant="headlineMedium" style={styles.title}>
                    {editingId ? 'Edit Shift' : 'Create a New Shift'}
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    Follow the steps to post a new shift opportunity.
                </Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stepper}
                >
                    {STEP_ORDER.map((step) => (
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
                    {stepIndex < STEP_ORDER.length - 1 ? (
                        <Button mode="contained" onPress={goNext} style={styles.primaryBtn} labelStyle={styles.primaryBtnText}>Next</Button>
                    ) : (
                        <Button mode="contained" onPress={handleSubmit} disabled={!canSubmit || loading} loading={loading} style={styles.primaryBtn} labelStyle={styles.primaryBtnText}>
                            {editingId ? 'Update Shift' : 'Post Shift'}
                        </Button>
                    )}
                </View>
            </ScrollView>

            <Snackbar visible={!!toast} onDismiss={() => setToast('')} duration={2500}>
                {toast}
            </Snackbar>

            <DatePickerModal
                mode="single"
                locale="en"
                visible={slotDatePickerOpen}
                onDismiss={() => setSlotDatePickerOpen(false)}
                date={new Date(slotDate)}
                onConfirm={({ date }) => {
                    if (date) setSlotDate(date.toISOString().split('T')[0]);
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
