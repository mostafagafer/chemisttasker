import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Text,
    Button,
    Card,
    Chip,
    Searchbar,
    Surface,
    ActivityIndicator,
    Portal,
    Modal,
    TextInput,
    IconButton,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    getMemberships,
    getMembershipApplications,
    deleteMembership,
    startDm,
    bulkInviteMembers,
    createMembershipInviteLink,
    refreshToken as refreshTokenApi,
} from '@chemisttasker/shared-core';
import * as sharedCore from '@chemisttasker/shared-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../../context/AuthContext';
import * as Clipboard from 'expo-clipboard';

type Membership = {
    id: number;
    role?: string;
    employment_type?: string;
    pharmacy?: number;
    pharmacy_name?: string;
    user_details?: { full_name?: string; email?: string };
    invited_name?: string;
};

type MembershipApplication = {
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    employment_type?: string;
    category?: string;
    pharmacy?: number;
    pharmacy_name?: string;
};

type InviteRow = {
    email: string;
    invited_name: string;
    role: string;
    employment_type: string;
    job_title: string;
};

const STAFF_ROLES = ['PHARMACIST', 'INTERN', 'TECHNICIAN', 'ASSISTANT', 'STUDENT', 'CONTACT'];
const STAFF_WORK_TYPES = ['FULL_TIME', 'PART_TIME', 'CASUAL'];
const NON_LOCUM_KEYS = ['LOCUM', 'SHIFT', 'HERO'];

const isStaff = (employmentType?: string) => {
    if (!employmentType) return true;
    const upper = employmentType.toUpperCase();
    return !NON_LOCUM_KEYS.some((key) => upper.includes(key));
};

const labelEmployment = (value?: string) => {
    if (!value) return 'Unspecified';
    return value
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
        .join(' ');
};

const labelRole = (value?: string) => {
    if (!value) return 'Role';
    return value.charAt(0) + value.slice(1).toLowerCase();
};

export default function PharmacyStaffScreen() {
    const { id } = useLocalSearchParams();
    const pharmacyId = Array.isArray(id) ? id[0] : id;
    const pharmacyIdNumber = pharmacyId ? Number(pharmacyId) : undefined;
    const router = useRouter();
    const { logout } = useAuth();

    const [memberships, setMemberships] = useState<Membership[]>([]);
    const [applications, setApplications] = useState<MembershipApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'role' | 'work'>('role');
    const [filterRole, setFilterRole] = useState<string>('ALL');
    const [filterWork, setFilterWork] = useState<string>('ALL');
    const [error, setError] = useState<string | null>(null);

    const [inviteVisible, setInviteVisible] = useState(false);
    const [inviteRows, setInviteRows] = useState<InviteRow[]>([{
        email: '',
        invited_name: '',
        role: 'PHARMACIST',
        employment_type: 'FULL_TIME',
        job_title: '',
    }]);
    const [inviteSubmitting, setInviteSubmitting] = useState(false);

    const [linkVisible, setLinkVisible] = useState(false);
    const [linkSubmitting, setLinkSubmitting] = useState(false);
    const [linkValue, setLinkValue] = useState('');
    const [linkError, setLinkError] = useState<string | null>(null);
    const [linkExpiryDate, setLinkExpiryDate] = useState<Date | null>(null);

    const refreshAccessToken = useCallback(async () => {
        const refreshToken = await AsyncStorage.getItem('REFRESH_KEY');
        if (!refreshToken) return null;
        try {
            const response = await refreshTokenApi(refreshToken);
            const nextAccess = (response as any)?.access;
            if (nextAccess) {
                await AsyncStorage.setItem('ACCESS_KEY', nextAccess);
                return nextAccess;
            }
        } catch (err) {
            console.error('Failed to refresh token', err);
        }
        return null;
    }, []);

    const handleSessionExpired = useCallback(async () => {
        setError('Session expired. Please log in again.');
        await logout();
        router.replace('/login');
    }, [logout, router]);

    const runWithAuthRetry = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
        try {
            return await operation();
        } catch (err: any) {
            const message = err?.message?.toLowerCase?.() || '';
            const status = err?.status || err?.response?.status;
            const authError =
                status === 401 ||
                message.includes('token') ||
                message.includes('401') ||
                message.includes('auth') ||
                message.includes('credential');

            if (authError) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    try {
                        return await operation();
                    } catch (retryErr) {
                        console.error('Retry after refresh failed', retryErr);
                    }
                }
                await handleSessionExpired();
            }
            throw err;
        }
    }, [handleSessionExpired, refreshAccessToken]);

    const fetchAll = useCallback(async () => {
        if (!pharmacyId) return;
        try {
            setError(null);
            const [membershipRes, appRes] = await runWithAuthRetry(() =>
                Promise.all([
                    getMemberships({ pharmacy: pharmacyId } as any),
                    getMembershipApplications({ status: 'PENDING', pharmacy: pharmacyId } as any),
                ])
            );
            const list: Membership[] = Array.isArray((membershipRes as any)?.results)
                ? (membershipRes as any).results
                : Array.isArray(membershipRes)
                    ? (membershipRes as any)
                    : [];
            const filtered = list
                .filter((m) => isStaff(m.employment_type))
                .filter((m) => (pharmacyIdNumber ? m.pharmacy === pharmacyIdNumber : true));
            setMemberships(filtered);

            const appList: MembershipApplication[] = Array.isArray((appRes as any)?.results)
                ? (appRes as any).results
                : Array.isArray(appRes)
                    ? (appRes as any)
                    : [];
            const staffApps = appList
                .filter((app) => isStaff(app.employment_type || app.category))
                .filter((app) => (pharmacyIdNumber ? app.pharmacy === pharmacyIdNumber : true));
            setApplications(staffApps);
        } catch (err: any) {
            console.error('Failed to load staff', err);
            const msg = err?.message?.toLowerCase?.() || '';
            if (!msg.includes('token')) {
                setError('Failed to load staff');
            }
        } finally {
            setLoading(false);
        }
    }, [pharmacyId, pharmacyIdNumber, runWithAuthRetry]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
    };

    const filtered = useMemo(() => {
        const sorted = [...memberships].sort((a, b) => {
            if (sortBy === 'role') return (a.role || '').localeCompare(b.role || '');
            return (a.employment_type || '').localeCompare(b.employment_type || '');
        });
        return sorted.filter((m) => {
            const name = m.user_details?.full_name || m.invited_name || m.user_details?.email || '';
            const roleOk = filterRole === 'ALL' || (m.role || '').toUpperCase() === filterRole;
            const workOk = filterWork === 'ALL' || (m.employment_type || '').toUpperCase() === filterWork;
            return name.toLowerCase().includes(search.toLowerCase()) && roleOk && workOk;
        });
    }, [memberships, search, sortBy, filterRole, filterWork]);

    const handleRemove = (membershipId: number) => {
        Alert.alert('Remove member', 'Are you sure you want to remove this member?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    setBusyId(membershipId);
                    try {
                        await runWithAuthRetry(() => deleteMembership(membershipId));
                        setMemberships((prev) => prev.filter((m) => m.id !== membershipId));
                    } catch {
                        Alert.alert('Error', 'Failed to remove member');
                    } finally {
                        setBusyId(null);
                    }
                },
            },
        ]);
    };

    const handleMessage = async (membership: Membership) => {
        if (!membership.id) return;
        setBusyId(membership.id);
        try {
            const room = (await runWithAuthRetry(() =>
                startDm({
                    participant_membership_id: membership.id,
                    pharmacy_id: pharmacyId,
                } as any)
            )) as any;
            const name = membership.user_details?.full_name || membership.invited_name || 'Chat';
            router.push({ pathname: '/owner/messages/[id]', params: { id: room?.id, name } });
        } catch {
            Alert.alert('Error', 'Failed to start chat');
        } finally {
            setBusyId(null);
        }
    };

    const addInviteRow = () => {
        setInviteRows((prev) => [...prev, {
            email: '',
            invited_name: '',
            role: 'PHARMACIST',
            employment_type: 'FULL_TIME',
            job_title: '',
        }]);
    };

    const updateInviteRow = (idx: number, field: keyof InviteRow, value: string) => {
        setInviteRows((prev) => {
            const next = [...prev];
            if (!next[idx]) return prev;
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const removeInviteRow = (idx: number) => {
        setInviteRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
    };

    const sendInvites = async () => {
        setInviteSubmitting(true);
        try {
            const payload = inviteRows
                .filter((row) => row.email)
                .map((row) => ({
                    email: row.email,
                    invited_name: row.invited_name || undefined,
                    role: row.role,
                    employment_type: row.employment_type,
                    job_title: row.job_title || undefined,
                    pharmacy: pharmacyId,
                }));
            if (!payload.length) {
                Alert.alert('Enter at least one email');
                return;
            }
            await runWithAuthRetry(() => bulkInviteMembers(payload as any));
            setInviteVisible(false);
            setInviteRows([{
                email: '',
                invited_name: '',
                role: 'PHARMACIST',
                employment_type: 'FULL_TIME',
                job_title: '',
            }]);
            await fetchAll();
            Alert.alert('Invitations sent');
        } catch {
            Alert.alert('Error', 'Failed to send invites');
        } finally {
            setInviteSubmitting(false);
        }
    };

    const generateLink = async () => {
        if (!pharmacyIdNumber) {
            Alert.alert('Missing pharmacy', 'Pharmacy id is required to create an invite link.');
            return;
        }
        setLinkSubmitting(true);
        try {
            setLinkError(null);
            const expiryDays = 14;
            const payload = {
                pharmacy: pharmacyIdNumber,
                category: 'STAFF',
                employment_type: 'FULL_TIME',
                expires_in_days: expiryDays,
            };
            const link = await runWithAuthRetry(() => createMembershipInviteLink(payload as any));
            const value = (link as any)?.url || (link as any)?.link || '';
            setLinkValue(value);

            // Calculate expiry date
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + expiryDays);
            setLinkExpiryDate(expiryDate);

            if (!value) {
                setLinkError('No link returned from server');
            } else {
                // Auto-copy to clipboard
                await Clipboard.setStringAsync(value);
                Alert.alert('Success', 'Link generated and copied to clipboard!', [
                    { text: 'OK', style: 'default' },
                ]);
            }
        } catch (err: any) {
            const detail = err?.response?.data?.detail || err?.response?.data || err?.message || 'Failed to generate link';
            const message = typeof detail === 'string' ? detail : 'Failed to generate link';
            setLinkError(message);
            Alert.alert('Error', message);
        } finally {
            setLinkSubmitting(false);
        }
    };

    const copyToClipboard = async () => {
        if (!linkValue) return;
        try {
            await Clipboard.setStringAsync(linkValue);
            Alert.alert('Copied!', 'Link copied to clipboard');
        } catch (err) {
            Alert.alert('Error', 'Failed to copy link');
        }
    };

    const shareLink = async () => {
        if (!linkValue) return;
        try {
            await Share.share({
                message: `Join our pharmacy staff team! Use this invitation link to apply: ${linkValue}`,
                title: 'Staff Invitation Link',
            });
        } catch (err) {
            console.error('Failed to share link', err);
        }
    };

    const handleApproveApp = async (app: MembershipApplication) => {
        setBusyId(app.id);
        try {
            const approveFn = (sharedCore as any).approveMembershipApplication;
            await runWithAuthRetry(() => approveFn(app.id, { employment_type: app.employment_type }));
            await fetchAll();
        } catch {
            Alert.alert('Error', 'Failed to approve');
        } finally {
            setBusyId(null);
        }
    };

    const handleRejectApp = async (app: MembershipApplication) => {
        setBusyId(app.id);
        try {
            const rejectFn = (sharedCore as any).rejectMembershipApplication;
            await runWithAuthRetry(() => rejectFn(app.id));
            setApplications((prev) => prev.filter((a) => a.id !== app.id));
        } catch {
            Alert.alert('Error', 'Failed to reject');
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.muted}>Loading staff...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>Staff</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>Manage staff for this pharmacy</Text>
            </View>

            <View style={styles.filterRow}>
                <Button mode={sortBy === 'role' ? 'contained' : 'outlined'} onPress={() => setSortBy('role')}>Sort: Role</Button>
                <Button mode={sortBy === 'work' ? 'contained' : 'outlined'} onPress={() => setSortBy('work')}>Sort: Work Type</Button>
            </View>
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <Chip selected={filterRole === 'ALL'} onPress={() => setFilterRole('ALL')}>All roles</Chip>
                    {STAFF_ROLES.map((role) => (
                        <Chip key={role} selected={filterRole === role} onPress={() => setFilterRole(role)}>
                            {labelRole(role)}
                        </Chip>
                    ))}
                </ScrollView>
            </View>
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <Chip selected={filterWork === 'ALL'} onPress={() => setFilterWork('ALL')}>All work types</Chip>
                    {STAFF_WORK_TYPES.map((work) => (
                        <Chip key={work} selected={filterWork === work} onPress={() => setFilterWork(work)}>
                            {labelEmployment(work)}
                        </Chip>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.actionsRow}>
                <Button mode="contained" icon="account-plus" onPress={() => setInviteVisible(true)}>Invite Staff</Button>
                <Button mode="outlined" icon="link" onPress={() => { setLinkVisible(true); void generateLink(); }}>
                    Generate Link
                </Button>
            </View>

            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search staff..."
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchBar}
                />
            </View>

            {error && (
                <Surface style={styles.errorBox} elevation={1}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button onPress={fetchAll}>Retry</Button>
                </Surface>
            )}

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {filtered.length === 0 ? (
                    <Surface style={styles.empty} elevation={0}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>No staff yet</Text>
                        <Text style={styles.muted}>Invite team members to this pharmacy</Text>
                    </Surface>
                ) : (
                    filtered.map((member) => {
                        const name = member.user_details?.full_name || member.invited_name || 'Member';
                        const email = member.user_details?.email;
                        const role = member.role || 'Member';
                        return (
                            <Card key={member.id} style={styles.card}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <View style={styles.tagRow}>
                                            <Chip compact style={styles.chip}>{role}</Chip>
                                            <Chip compact style={styles.chip}>{labelEmployment(member.employment_type)}</Chip>
                                        </View>
                                        <Text variant="titleMedium" style={styles.name}>{name}</Text>
                                        {email && <Text style={styles.muted}>{email}</Text>}
                                    </View>
                                    <View style={styles.actions}>
                                        <Button mode="text" onPress={() => handleMessage(member)} loading={busyId === member.id}>Message</Button>
                                        <Button mode="text" textColor="#DC2626" onPress={() => handleRemove(member.id)} loading={busyId === member.id}>Remove</Button>
                                    </View>
                                </Card.Content>
                            </Card>
                        );
                    })
                )}

                <Text variant="titleMedium" style={styles.sectionTitle}>Pending Staff Applications</Text>
                {applications.length === 0 ? (
                    <Surface style={styles.infoBox} elevation={0}>
                        <Text style={styles.muted}>No pending applications.</Text>
                    </Surface>
                ) : (
                    applications.map((app) => {
                        const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Applicant';
                        return (
                            <Card key={app.id} style={styles.card}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <Chip compact style={styles.chip}>{labelEmployment(app.employment_type || app.category)}</Chip>
                                        <Text variant="titleMedium" style={styles.name}>{name}</Text>
                                        {app.email && <Text style={styles.muted}>{app.email}</Text>}
                                    </View>
                                    <View style={styles.actions}>
                                        <Button mode="text" onPress={() => handleApproveApp(app)} loading={busyId === app.id}>Approve</Button>
                                        <Button mode="text" textColor="#DC2626" onPress={() => handleRejectApp(app)} loading={busyId === app.id}>Reject</Button>
                                    </View>
                                </Card.Content>
                            </Card>
                        );
                    })
                )}
            </ScrollView>

            <Portal>
                <Modal visible={inviteVisible} onDismiss={() => setInviteVisible(false)} contentContainerStyle={styles.modal}>
                    <Text variant="titleMedium" style={styles.modalTitle}>Invite Staff</Text>
                    <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
                        {inviteRows.map((row, idx) => (
                            <Surface key={idx} style={styles.inviteRow} elevation={1}>
                                <TextInput
                                    label="Email"
                                    value={row.email}
                                    onChangeText={(v) => updateInviteRow(idx, 'email', v)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    style={styles.input}
                                />
                                <TextInput
                                    label="Name"
                                    value={row.invited_name}
                                    onChangeText={(v) => updateInviteRow(idx, 'invited_name', v)}
                                    style={styles.input}
                                />
                                <TextInput
                                    label="Role"
                                    value={row.role}
                                    onChangeText={(v) => updateInviteRow(idx, 'role', v.toUpperCase())}
                                    style={styles.input}
                                />
                                <TextInput
                                    label="Employment Type"
                                    value={row.employment_type}
                                    onChangeText={(v) => updateInviteRow(idx, 'employment_type', v.toUpperCase())}
                                    style={styles.input}
                                />
                                {(row.employment_type === 'FULL_TIME' || row.employment_type === 'PART_TIME') && (
                                    <TextInput
                                        label="Job Title"
                                        value={row.job_title}
                                        onChangeText={(v) => updateInviteRow(idx, 'job_title', v)}
                                        style={styles.input}
                                    />
                                )}
                                {inviteRows.length > 1 && (
                                    <Button onPress={() => removeInviteRow(idx)} textColor="#DC2626">Remove</Button>
                                )}
                            </Surface>
                        ))}
                        <Button onPress={addInviteRow}>Add another</Button>
                    </ScrollView>
                    <View style={styles.modalActions}>
                        <Button onPress={() => setInviteVisible(false)}>Cancel</Button>
                        <Button mode="contained" onPress={sendInvites} loading={inviteSubmitting}>Send Invitations</Button>
                    </View>
                </Modal>

                <Modal visible={linkVisible} onDismiss={() => setLinkVisible(false)} contentContainerStyle={styles.modal}>
                    <Text variant="titleMedium" style={styles.modalTitle}>Staff Invitation Link</Text>
                    <Text variant="bodySmall" style={styles.muted}>Generate a unique invitation link valid for 14 days</Text>

                    <Button
                        mode="contained"
                        icon="link-variant"
                        onPress={generateLink}
                        loading={linkSubmitting}
                        style={{ marginTop: 16 }}
                    >
                        Generate New Link (14d)
                    </Button>

                    {linkValue ? (
                        <Surface style={styles.linkBox} elevation={2}>
                            <View style={styles.linkHeader}>
                                <IconButton icon="check-circle" iconColor="#10B981" size={24} />
                                <View style={{ flex: 1 }}>
                                    <Text variant="labelMedium" style={styles.linkSuccessTitle}>Link Generated!</Text>
                                    {linkExpiryDate && (
                                        <Text variant="bodySmall" style={styles.linkValidity}>
                                            Valid until: {linkExpiryDate.toLocaleDateString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <Surface style={styles.linkTextBox} elevation={0}>
                                <Text selectable style={styles.linkText}>{linkValue}</Text>
                            </Surface>

                            <View style={styles.linkActions}>
                                <Button
                                    mode="contained"
                                    icon="content-copy"
                                    onPress={copyToClipboard}
                                    style={{ flex: 1 }}
                                >
                                    Copy Link
                                </Button>
                                <Button
                                    mode="outlined"
                                    icon="share-variant"
                                    onPress={shareLink}
                                    style={{ flex: 1 }}
                                >
                                    Share
                                </Button>
                            </View>
                        </Surface>
                    ) : linkError ? (
                        <Surface style={styles.errorBox} elevation={0}>
                            <Text style={styles.errorText}>{linkError}</Text>
                        </Surface>
                    ) : (
                        <Surface style={styles.infoBox} elevation={0}>
                            <Text style={styles.muted}>Click the button above to generate an invitation link</Text>
                        </Surface>
                    )}

                    <View style={styles.modalActions}>
                        <Button onPress={() => { setLinkVisible(false); setLinkValue(''); setLinkError(null); }}>Close</Button>
                    </View>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontWeight: 'bold', color: '#111827' },
    subtitle: { color: '#6B7280' },
    filterRow: { paddingHorizontal: 16, paddingVertical: 8 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    searchContainer: { paddingHorizontal: 16, paddingVertical: 8 },
    searchBar: { backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 0 },
    errorBox: { margin: 16, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 10 },
    errorText: { color: '#B91C1C', marginBottom: 4 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 80, gap: 10 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12 },
    cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { fontWeight: '600', color: '#111827' },
    muted: { color: '#6B7280' },
    chip: { backgroundColor: '#F3F4F6' },
    tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    actions: { justifyContent: 'flex-end', alignItems: 'flex-end', gap: 4 },
    empty: { alignItems: 'center', padding: 32, gap: 8 },
    emptyTitle: { fontWeight: '600', color: '#111827' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    sectionTitle: { fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 4 },
    infoBox: { padding: 12, borderRadius: 10, backgroundColor: '#E0F2FE', marginTop: 12 },
    modal: { margin: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12 },
    modalTitle: { marginBottom: 12, fontWeight: '600' },
    inviteRow: { padding: 12, borderRadius: 10, backgroundColor: '#F9FAFB', gap: 8 },
    input: { backgroundColor: '#FFFFFF' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
    linkBox: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' },
    linkHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    linkSuccessTitle: { fontWeight: '600', color: '#059669', fontSize: 16 },
    linkValidity: { color: '#047857', marginTop: 4 },
    linkTextBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, marginBottom: 12 },
    linkText: { color: '#111827', fontSize: 12 },
    linkActions: { flexDirection: 'row', gap: 8 },
});
