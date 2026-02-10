// Pharmacy Form - Create/Edit Pharmacy
// Full Parity with Web Dashboard
import React, { useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    TouchableOpacity,
    Alert,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    RadioButton,
    Surface,
    Text,
    TextInput,
    Switch,
    Chip,
    Checkbox,
    Divider,
    HelperText,
    Menu,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
    createPharmacy,
    updatePharmacy,
    getPharmacyById,
    type PharmacyDTO,
} from '@chemisttasker/shared-core';
import { surfaceTokens } from './types';
import GooglePlacesInput from './GooglePlacesInput';

type Mode = 'create' | 'edit';

type Props = {
    mode: Mode;
    pharmacyId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
};

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const EMPLOYMENT_TYPES = ["PART_TIME", "FULL_TIME", "LOCUMS"];
const ROLE_OPTIONS = ["PHARMACIST", "INTERN", "ASSISTANT", "TECHNICIAN", "STUDENT", "ADMIN", "DRIVER"];
const RATE_TYPES = [
    { value: 'FIXED', label: 'Fixed (Hourly)' },
    { value: 'FLEXIBLE', label: 'Flexible' },
    { value: 'PHARMACIST_PROVIDED', label: 'Pharmacist Provided' },
];

const TABS = [
    { label: 'Basic', icon: 'domain' },
    { label: 'Regulatory', icon: 'check-decagram' },
    { label: 'Docs', icon: 'file-document' },
    { label: 'Employment', icon: 'account-group' },
    { label: 'Hours', icon: 'clock-outline' },
    { label: 'Rate', icon: 'cash' },
    { label: 'About', icon: 'message' },
];

export default function PharmacyForm({ mode, pharmacyId, onSuccess, onCancel }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(mode === 'edit');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState(0); // 0 to 6

    // Form State
    const [form, setForm] = useState({
        name: '',
        email: '',
        street_address: '',
        suburb: '',
        state: 'NSW',
        postcode: '',
        abn: '',
        google_place_id: '',
        latitude: null as number | null,
        longitude: null as number | null,
        auto_publish_worker_requests: false,
        about: '',
        // Rate
        default_rate_type: '' as '' | 'FIXED' | 'FLEXIBLE' | 'PHARMACIST_PROVIDED',
        default_fixed_rate: '',
        rate_weekday: '',
        rate_saturday: '',
        rate_sunday: '',
        rate_public_holiday: '',
        rate_early_morning: '',
        rate_late_night: '',
        // Hours
        weekdays_start: '', weekdays_end: '',
        saturdays_start: '', saturdays_end: '',
        sundays_start: '', sundays_end: '',
        public_holidays_start: '', public_holidays_end: '',
    });

    // Lists logic
    const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
    const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);

    // Files
    const [files, setFiles] = useState<{
        approval: any;
        sops: any;
        induction: any;
        sump: any;
    }>({ approval: null, sops: null, induction: null, sump: null });

    // Existing files (URLs)
    const [existingFiles, setExistingFiles] = useState<{
        approval: string | null;
        sops: string | null;
        induction: string | null;
        sump: string | null;
    }>({ approval: null, sops: null, induction: null, sump: null });

    // UI Menus
    const [rateMenuVisible, setRateMenuVisible] = useState(false);
    const [stateMenuVisible, setStateMenuVisible] = useState(false);

    const normalizeCoord = (value: number | null) => {
        if (value === null || value === undefined) return value;
        const rounded = Number(value.toFixed(6));
        return Number.isFinite(rounded) ? rounded : value;
    };

    const formatApiError = (data: any) => {
        if (!data) return '';
        if (typeof data === 'string') return data;
        if (data.detail && typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data)) return data.join('\n');
        if (typeof data === 'object') {
            return Object.entries(data)
                .map(([key, value]) => {
                    if (Array.isArray(value)) return `${key}: ${value.join(' ')}`;
                    if (typeof value === 'string') return `${key}: ${value}`;
                    return `${key}: ${JSON.stringify(value)}`;
                })
                .join('\n');
        }
        return String(data);
    };

    // Initial Load
    useEffect(() => {
        if (mode !== 'edit' || !pharmacyId) return;
        let cancelled = false;
        (async () => {
            try {
                const data = (await getPharmacyById(pharmacyId)) as any;
                if (cancelled || !data) return;

                setForm({
                    name: data.name || '',
                    email: data.email || '',
                    street_address: data.street_address || '',
                    suburb: data.suburb || '',
                    state: data.state || 'NSW',
                    postcode: String(data.postcode || ''),
                    abn: data.abn || '',
                    google_place_id: data.google_place_id || '',
                    latitude: data.latitude || null,
                    longitude: data.longitude || null,
                    auto_publish_worker_requests: data.auto_publish_worker_requests || false,
                    about: data.about || '',
                    default_rate_type: data.default_rate_type || '',
                    default_fixed_rate: String(data.default_fixed_rate || ''),
                    rate_weekday: String(data.rate_weekday || ''),
                    rate_saturday: String(data.rate_saturday || ''),
                    rate_sunday: String(data.rate_sunday || ''),
                    rate_public_holiday: String(data.rate_public_holiday || ''),
                    rate_early_morning: String(data.rate_early_morning || ''),
                    rate_late_night: String(data.rate_late_night || ''),
                    weekdays_start: data.weekdays_start || '',
                    weekdays_end: data.weekdays_end || '',
                    saturdays_start: data.saturdays_start || '',
                    saturdays_end: data.saturdays_end || '',
                    sundays_start: data.sundays_start || '',
                    sundays_end: data.sundays_end || '',
                    public_holidays_start: data.public_holidays_start || '',
                    public_holidays_end: data.public_holidays_end || '',
                });

                setEmploymentTypes(data.employment_types || []);
                setRolesNeeded(data.roles_needed || []);
                setExistingFiles({
                    approval: data.approval_certificate || null,
                    sops: data.sops || null,
                    induction: data.induction_guides || null,
                    sump: data.qld_sump_docs || null,
                });

            } catch (err: any) {
                if (!cancelled) setError(err?.message || 'Failed to load pharmacy');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [mode, pharmacyId]);

    const handlePickFile = async (key: keyof typeof files) => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!res.canceled && res.assets && res.assets.length > 0) {
                const asset = res.assets[0];
                setFiles(prev => ({ ...prev, [key]: asset }));
            }
        } catch (e) {
            if (__DEV__) {
                console.log('File picker error', e);
            }
        }
    };

    const handlePlaceSelected = (place: {
        address: string;
        name?: string;
        place_id?: string;
        street_address: string;
        suburb: string;
        state: string;
        postcode: string;
        latitude?: number;
        longitude?: number;
    }) => {
        setForm(prev => ({
            ...prev,
            name: prev.name ? prev.name : (place.name || prev.name),
            google_place_id: place.place_id || prev.google_place_id,
            street_address: place.street_address || prev.street_address,
            suburb: place.suburb || prev.suburb,
            state: place.state || prev.state,
            postcode: place.postcode || prev.postcode,
            latitude: place.latitude ?? prev.latitude,
            longitude: place.longitude ?? prev.longitude,
        }));
    };

    const handleClearPlace = () => {
        setForm(prev => ({
            ...prev,
            google_place_id: '',
            street_address: '',
            suburb: '',
            state: 'NSW',
            postcode: '',
            latitude: null,
            longitude: null,
        }));
    };

    const toggleList = (list: string[], setList: (l: string[]) => void, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const validate = () => {
        if (!form.name || !form.street_address || !form.suburb || !form.state || !form.postcode) {
            setError('Please fill in all required fields (Name, Address, Suburb, State, Postcode).');
            setActiveTab(0); // Jump to General
            return false;
        }
        if (!form.abn) {
            setError('ABN is required.');
            setActiveTab(1); // Jump to Approval
            return false;
        }
        const abnDigits = form.abn.replace(/\D/g, '');
        if (abnDigits.length !== 11) {
            setError('ABN must be exactly 11 digits.');
            setActiveTab(1);
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        setError('');

        try {
            const payload: Record<string, any> = {};
            Object.entries(form).forEach(([k, v]) => {
                if (v === null || v === undefined) return;
                if (typeof v === 'string' && v.trim() === '') return;
                if (k === 'abn' && typeof v === 'string') {
                    payload[k] = v.replace(/\D/g, '');
                    return;
                }
                if (k === 'latitude' && typeof v === 'number') {
                    payload[k] = normalizeCoord(v);
                    return;
                }
                if (k === 'longitude' && typeof v === 'number') {
                    payload[k] = normalizeCoord(v);
                    return;
                }
                payload[k] = v;
            });
            payload.employment_types = employmentTypes;
            payload.roles_needed = rolesNeeded;

            const hasFiles = Boolean(files.approval || files.sops || files.induction || files.sump);

            

            if (hasFiles) {
                const formData = new FormData();
                // Text fields
                Object.entries(payload).forEach(([k, v]) => {
                    if (v === null || v === undefined) return;
                    if (Array.isArray(v)) {
                        v.forEach(item => formData.append(k, String(item)));
                        return;
                    }
                    formData.append(k, String(v));
                });

                // Files
                if (files.approval) formData.append('approval_certificate', { uri: files.approval.uri, name: files.approval.name, type: files.approval.mimeType ?? 'application/pdf' } as any);
                if (files.sops) formData.append('sops', { uri: files.sops.uri, name: files.sops.name, type: files.sops.mimeType ?? 'application/pdf' } as any);
                if (files.induction) formData.append('induction_guides', { uri: files.induction.uri, name: files.induction.name, type: files.induction.mimeType ?? 'application/pdf' } as any);
                if (files.sump) formData.append('qld_sump_docs', { uri: files.sump.uri, name: files.sump.name, type: files.sump.mimeType ?? 'application/pdf' } as any);

                if (mode === 'edit' && pharmacyId) {
                    await updatePharmacy(pharmacyId, formData as any);
                } else {
                    await createPharmacy(formData as any);
                }
            } else {
                if (mode === 'edit' && pharmacyId) {
                    await updatePharmacy(pharmacyId, payload as any);
                } else {
                    await createPharmacy(payload as any);
                }
            }

            if (onSuccess) onSuccess();
            else router.back();

        } catch (err: any) {
            const apiMessage = formatApiError(err?.response?.data);
            const detail = apiMessage || err?.message;
            setError(detail || 'Save failed');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const title = useMemo(() => (mode === 'edit' ? 'Edit Pharmacy' : 'Add Pharmacy'), [mode]);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                </View>

                {/* TABS */}
                <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
                        {TABS.map((tab, idx) => (
                            <Chip
                                key={tab.label}
                                icon={tab.icon}
                                selected={activeTab === idx}
                                onPress={() => setActiveTab(idx)}
                                style={[styles.tabChip, activeTab === idx && styles.activeTabChip]}
                                textStyle={activeTab === idx ? { color: '#fff' } : {}}
                                mode="flat"
                            >
                                {tab.label}
                            </Chip>
                        ))}
                    </ScrollView>
                </View>
                <Divider />

                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={surfaceTokens.primary} />
                        <Text>Loading...</Text>
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: 50 }]}
                        keyboardShouldPersistTaps="always"
                        nestedScrollEnabled={true}
                        keyboardDismissMode="none"
                    >
                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <Surface style={styles.card} elevation={1}>
                            {/* TAB 0: GENERAL */}
                            {activeTab === 0 && (
                                <>
                                    <TextInput
                                        label="Pharmacy Name *"
                                        value={form.name}
                                        onChangeText={(v) => setForm(p => ({ ...p, name: v }))}
                                        mode="outlined"
                                        style={styles.input}
                                    />
                                    <TextInput
                                        label="Email"
                                        value={form.email}
                                        onChangeText={(v) => setForm(p => ({ ...p, email: v }))}
                                        mode="outlined"
                                        style={styles.input}
                                        keyboardType="email-address"
                                    />

                                    {!form.google_place_id ? (
                                        <GooglePlacesInput
                                            label="Search Address *"
                                            value={form.street_address}
                                            onPlaceSelected={handlePlaceSelected}
                                            error={!form.street_address && error ? 'Required' : undefined}
                                        />
                                    ) : (
                                        <>
                                            <Button
                                                mode="outlined"
                                                icon="refresh"
                                                onPress={handleClearPlace}
                                                style={styles.mb}
                                                textColor={surfaceTokens.primary}
                                            >
                                                Clear & Search Again
                                            </Button>

                                            <TextInput
                                                label="Street Address *"
                                                value={form.street_address}
                                                onChangeText={(v) => setForm(p => ({ ...p, street_address: v }))}
                                                mode="outlined"
                                                style={styles.input}
                                            />

                                            <TextInput
                                                label="Suburb *"
                                                value={form.suburb}
                                                onChangeText={(v) => setForm(p => ({ ...p, suburb: v }))}
                                                mode="outlined"
                                                style={styles.input}
                                            />

                                            <Text style={styles.label}>State *</Text>
                                            <Menu
                                                visible={stateMenuVisible}
                                                onDismiss={() => setStateMenuVisible(false)}
                                                anchor={
                                                    <Button
                                                        mode="outlined"
                                                        onPress={() => setStateMenuVisible(true)}
                                                        style={[styles.input, { alignItems: 'flex-start' }]}
                                                        contentStyle={{ justifyContent: 'flex-start' }}
                                                    >
                                                        {form.state || 'Select State'}
                                                    </Button>
                                                }
                                            >
                                                {STATES.map(s => (
                                                    <Menu.Item
                                                        key={s}
                                                        onPress={() => { setForm(p => ({ ...p, state: s })); setStateMenuVisible(false); }}
                                                        title={s}
                                                    />
                                                ))}
                                            </Menu>

                                            <TextInput
                                                label="Postcode *"
                                                value={form.postcode}
                                                onChangeText={(v) => setForm(p => ({ ...p, postcode: v }))}
                                                mode="outlined"
                                                style={styles.input}
                                                keyboardType="numeric"
                                            />
                                        </>
                                    )}

                                    <View style={[styles.toggleRow, { marginTop: 16 }]}>
                                        <Text style={{ flex: 1 }}>Automatically publish worker requests</Text>
                                        <Checkbox status={form.auto_publish_worker_requests ? 'checked' : 'unchecked'} onPress={() => setForm(p => ({ ...p, auto_publish_worker_requests: !p.auto_publish_worker_requests }))} />
                                    </View>
                                </>
                            )}

                            {/* TAB 1: APPROVAL */}
                            {activeTab === 1 && (
                                <>
                                    <TextInput label="ABN *" value={form.abn} onChangeText={(v) => setForm(p => ({ ...p, abn: v }))} mode="outlined" style={styles.input} keyboardType="numeric" />
                                    <HelperText type="error" visible={Boolean(error) && !form.abn}>
                                        ABN is required and must be 11 digits.
                                    </HelperText>

                                    <Text style={styles.label}>Approval Certificate</Text>
                                    <Button mode="outlined" icon="upload" onPress={() => handlePickFile('approval')} style={{ marginBottom: 8 }}>
                                        {files.approval ? 'File Selected' : 'Upload Certificate'}
                                    </Button>
                                    {files.approval && <Text style={styles.fileText}>{files.approval.name}</Text>}
                                    {existingFiles.approval && !files.approval && (
                                        <Text style={styles.fileText}>Existing: Valid Certificate</Text>
                                    )}
                                </>
                            )}

                            {/* TAB 2: DOCUMENTS */}
                            {activeTab === 2 && (
                                <>
                                    <Text style={styles.label}>SOPs</Text>
                                    <Button mode="outlined" icon="upload" onPress={() => handlePickFile('sops')} style={styles.mb}>
                                        Upload SOPs
                                    </Button>
                                    {files.sops && <Text style={styles.fileText}>{files.sops.name}</Text>}

                                    <Text style={styles.label}>Induction Guides</Text>
                                    <Button mode="outlined" icon="upload" onPress={() => handlePickFile('induction')} style={styles.mb}>
                                        Upload Guides
                                    </Button>
                                    {files.induction && <Text style={styles.fileText}>{files.induction.name}</Text>}

                                    <Text style={styles.label}>S8 / SUMP Docs</Text>
                                    <Button mode="outlined" icon="upload" onPress={() => handlePickFile('sump')} style={styles.mb}>
                                        Upload S8/SUMP
                                    </Button>
                                    {files.sump && <Text style={styles.fileText}>{files.sump.name}</Text>}
                                </>
                            )}

                            {/* TAB 3: STAFFING */}
                            {activeTab === 3 && (
                                <>
                                    <Text style={styles.sectionHeader}>Employment Types</Text>
                                    {EMPLOYMENT_TYPES.map(type => (
                                        <View key={type} style={styles.checkRow}>
                                            <Checkbox status={employmentTypes.includes(type) ? 'checked' : 'unchecked'} onPress={() => toggleList(employmentTypes, setEmploymentTypes, type)} />
                                            <Text>{type.replace('_', ' ')}</Text>
                                        </View>
                                    ))}

                                    <Divider style={{ marginVertical: 16 }} />
                                    <Text style={styles.sectionHeader}>Roles Needed</Text>
                                    {ROLE_OPTIONS.map(role => (
                                        <View key={role} style={styles.checkRow}>
                                            <Checkbox status={rolesNeeded.includes(role) ? 'checked' : 'unchecked'} onPress={() => toggleList(rolesNeeded, setRolesNeeded, role)} />
                                            <Text>{role}</Text>
                                        </View>
                                    ))}
                                </>
                            )}

                            {/* TAB 4: HOURS */}
                            {activeTab === 4 && (
                                <>
                                    <Text style={styles.helperText}>Format: HH:MM (e.g. 09:00, 17:30)</Text>
                                    <HoursRow label="Weekdays" startKey="weekdays_start" endKey="weekdays_end" form={form} setForm={setForm} />
                                    <HoursRow label="Saturdays" startKey="saturdays_start" endKey="saturdays_end" form={form} setForm={setForm} />
                                    <HoursRow label="Sundays" startKey="sundays_start" endKey="sundays_end" form={form} setForm={setForm} />
                                    <HoursRow label="Public Holidays" startKey="public_holidays_start" endKey="public_holidays_end" form={form} setForm={setForm} />
                                </>
                            )}

                            {/* TAB 5: RATE */}
                            {activeTab === 5 && (
                                <>
                                    <Text style={styles.label}>Default Rate Type</Text>
                                    <Menu
                                        visible={rateMenuVisible}
                                        onDismiss={() => setRateMenuVisible(false)}
                                        anchor={
                                            <Button mode="outlined" onPress={() => setRateMenuVisible(true)} style={styles.mb}>
                                                {RATE_TYPES.find(r => r.value === form.default_rate_type)?.label || 'Select Rate Type'}
                                            </Button>
                                        }
                                    >
                                        {RATE_TYPES.map(type => (
                                            <Menu.Item
                                                key={type.value}
                                                onPress={() => {
                                                    setForm(p => ({ ...p, default_rate_type: type.value as any }));
                                                    setRateMenuVisible(false);
                                                }}
                                                title={type.label}
                                            />
                                        ))}
                                    </Menu>

                                    {form.default_rate_type === 'FIXED' && (
                                        <TextInput
                                            label="Default Fixed Rate ($)"
                                            value={form.default_fixed_rate}
                                            onChangeText={v => setForm(p => ({ ...p, default_fixed_rate: v }))}
                                            mode="outlined"
                                            keyboardType="numeric"
                                            style={styles.input}
                                        />
                                    )}
                                    {form.default_rate_type && form.default_rate_type !== 'PHARMACIST_PROVIDED' && (
                                        <>
                                            <Text style={styles.label}>Base Rates</Text>
                                            <TextInput
                                                label="Weekday Rate"
                                                value={form.rate_weekday}
                                                onChangeText={v => setForm(p => ({ ...p, rate_weekday: v }))}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                            />
                                            <TextInput
                                                label="Saturday Rate"
                                                value={form.rate_saturday}
                                                onChangeText={v => setForm(p => ({ ...p, rate_saturday: v }))}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                            />
                                            <TextInput
                                                label="Sunday Rate"
                                                value={form.rate_sunday}
                                                onChangeText={v => setForm(p => ({ ...p, rate_sunday: v }))}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                            />
                                            <TextInput
                                                label="Public Holiday Rate"
                                                value={form.rate_public_holiday}
                                                onChangeText={v => setForm(p => ({ ...p, rate_public_holiday: v }))}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                            />
                                            <TextInput
                                                label="Early Morning Rate"
                                                value={form.rate_early_morning}
                                                onChangeText={v => setForm(p => ({ ...p, rate_early_morning: v }))}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                            />
                                            <TextInput
                                                label="Late Night Rate"
                                                value={form.rate_late_night}
                                                onChangeText={v => setForm(p => ({ ...p, rate_late_night: v }))}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {/* TAB 6: ABOUT */}
                            {activeTab === 6 && (
                                <TextInput
                                    label="About Pharmacy"
                                    value={form.about}
                                    onChangeText={v => setForm(p => ({ ...p, about: v }))}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={6}
                                    style={styles.input}
                                />
                            )}

                        </Surface>

                        {/* ACTIONS */}
                        <View style={styles.actions}>
                            <Button mode="outlined" onPress={() => { if (onCancel) onCancel(); else router.back(); }} disabled={saving} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={{ flex: 1 }}>
                                {mode === 'edit' ? 'Save Changes' : 'Create Pharmacy'}
                            </Button>
                        </View>
                    </ScrollView>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView >
    );
}

const HoursRow = ({ label, startKey, endKey, form, setForm }: any) => (
    <View style={{ marginBottom: 16 }}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput
                label="Start"
                value={form[startKey]}
                onChangeText={v => setForm((p: any) => ({ ...p, [startKey]: v }))}
                mode="outlined"
                style={{ flex: 1, backgroundColor: surfaceTokens.bg }}
                placeholder="09:00"
            />
            <TextInput
                label="End"
                value={form[endKey]}
                onChangeText={v => setForm((p: any) => ({ ...p, [endKey]: v }))}
                mode="outlined"
                style={{ flex: 1, backgroundColor: surfaceTokens.bg }}
                placeholder="17:00"
            />
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: surfaceTokens.bgDark },
    header: { padding: 16, backgroundColor: surfaceTokens.bg },
    title: { fontWeight: '700', fontSize: 24 },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    tabsContainer: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, backgroundColor: surfaceTokens.bg },
    tabChip: { backgroundColor: surfaceTokens.bg },
    activeTabChip: { backgroundColor: surfaceTokens.primary },
    card: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: surfaceTokens.bg,
        gap: 12,
        zIndex: 2000, // Critical for dropdown to float over other elements
    },
    input: { backgroundColor: surfaceTokens.bg, marginBottom: 8 },
    label: { fontSize: 14, color: surfaceTokens.textMuted, marginBottom: 4, marginTop: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    radioItem: { flexDirection: 'row', alignItems: 'center' },
    checkRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    error: { color: surfaceTokens.error, marginBottom: 8 },
    mb: { marginBottom: 12 },
    fileText: { fontSize: 12, fontStyle: 'italic', marginBottom: 8, color: surfaceTokens.primary },
    sectionHeader: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
    helperText: { fontSize: 12, color: surfaceTokens.textMuted, marginBottom: 8 },
});
