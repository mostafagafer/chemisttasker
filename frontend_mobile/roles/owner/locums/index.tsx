import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Text,
    Searchbar,
    Card,
    Chip,
    Button,
    Surface,
    ActivityIndicator,
} from 'react-native-paper';
import {
    getMemberships,
    getMembershipApplications,
    startDm,
} from '@chemisttasker/shared-core';
import * as sharedCore from '@chemisttasker/shared-core';
import { useRouter } from 'expo-router';

type Membership = {
    id: number;
    role?: string;
    employment_type?: string;
    pharmacy?: number;
    pharmacy_name?: string;
    user_details?: {
        full_name?: string;
        email?: string;
    };
    invited_name?: string;
};

type MembershipApplication = {
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    pharmacy?: number;
    pharmacy_name?: string;
    employment_type?: string;
    category?: string;
};

const LOCUM_KEYS = ['LOCUM', 'SHIFT', 'HERO'];
const isLocum = (employment?: string) => {
    if (!employment) return false;
    const upper = employment.toUpperCase();
    return LOCUM_KEYS.some((key) => upper.includes(key));
};
const labelEmployment = (value?: string) => {
    if (!value) return 'Unspecified';
    return value
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
        .join(' ');
};

export default function ManageLocumsScreen() {
    const router = useRouter();
    const [locums, setLocums] = useState<Membership[]>([]);
    const [applications, setApplications] = useState<MembershipApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            setError(null);
            const [membershipRes, applicationRes] = await Promise.all([
                getMemberships({}),
                getMembershipApplications({ status: 'PENDING' } as any),
            ]);

            const membershipList: Membership[] = Array.isArray((membershipRes as any)?.results)
                ? (membershipRes as any).results
                : Array.isArray(membershipRes)
                    ? (membershipRes as any)
                    : [];
            const locumMembers = membershipList.filter((m) => isLocum(m.employment_type));
            setLocums(locumMembers);

            const appList: MembershipApplication[] = Array.isArray((applicationRes as any)?.results)
                ? (applicationRes as any).results
                : Array.isArray(applicationRes)
                    ? (applicationRes as any)
                    : [];
            const filteredApps = appList.filter((app) => isLocum(app.employment_type || app.category));
            setApplications(filteredApps);
        } catch (err) {
            console.error('Failed to load locums', err);
            setError('Failed to load locums');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
    };

    const filteredLocums = useMemo(
        () =>
            locums.filter((m) => {
                const name = m.user_details?.full_name || m.invited_name || m.user_details?.email || '';
                return name.toLowerCase().includes(search.toLowerCase());
            }),
        [locums, search]
    );

    const handleMessage = async (membership: Membership) => {
        if (!membership.id) return;
        setBusyId(membership.id);
        try {
            const room = (await startDm({
                participant_membership_id: membership.id,
                pharmacy_id: membership.pharmacy,
            } as any)) as any;
            const name = membership.user_details?.full_name || membership.invited_name || 'Chat';
            router.push({
                pathname: '/owner/chat',
                params: { id: room.id, name },
            });
        } catch (err) {
            console.error('Failed to start chat', err);
            Alert.alert('Error', 'Failed to start chat');
        } finally {
            setBusyId(null);
        }
    };

    const handleApprove = async (app: MembershipApplication) => {
        setBusyId(app.id);
        try {
            // Older shared-core build: lift from namespace to avoid typing errors
            const approveFn = (sharedCore as any).approveMembershipApplication;
            await approveFn(app.id, { employment_type: app.employment_type });
            setApplications((prev) => prev.filter((a) => a.id !== app.id));
            await fetchAll();
        } catch (err) {
            console.error('Failed to approve application', err);
            Alert.alert('Error', 'Failed to approve application');
        } finally {
            setBusyId(null);
        }
    };

    const handleReject = async (app: MembershipApplication) => {
        setBusyId(app.id);
        try {
            const rejectFn = (sharedCore as any).rejectMembershipApplication;
            await rejectFn(app.id);
            setApplications((prev) => prev.filter((a) => a.id !== app.id));
        } catch (err) {
            console.error('Failed to reject application', err);
            Alert.alert('Error', 'Failed to reject application');
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.muted}>Loading locums...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>Manage Locums</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>Locums, favourites, and applicants</Text>
            </View>

            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search locums..."
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
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <Text variant="titleMedium" style={styles.sectionTitle}>Active Locums</Text>
                {filteredLocums.length === 0 ? (
                    <Surface style={styles.empty} elevation={0}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>No locums yet</Text>
                        <Text style={styles.muted}>Approved locums will show here</Text>
                    </Surface>
                ) : (
                    filteredLocums.map((member) => {
                        const name = member.user_details?.full_name || member.invited_name || 'Locum';
                        const email = member.user_details?.email;
                        const role = member.role || 'Locum';
                        return (
                            <Card key={member.id} style={styles.card}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <Text variant="titleMedium" style={styles.name}>{name}</Text>
                                        {email && <Text style={styles.muted}>{email}</Text>}
                                        <View style={styles.row}>
                                            <Chip compact style={styles.chip}>{role}</Chip>
                                            <Chip compact style={styles.chip}>
                                                {labelEmployment(member.employment_type)}
                                            </Chip>
                                            {member.pharmacy_name && (
                                                <Chip compact style={styles.chip}>{member.pharmacy_name}</Chip>
                                            )}
                                        </View>
                                    </View>
                                    <Button
                                        mode="text"
                                        onPress={() => handleMessage(member)}
                                        loading={busyId === member.id}
                                    >
                                        Message
                                    </Button>
                                </Card.Content>
                            </Card>
                        );
                    })
                )}

                <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 16 }]}>
                    Pending Applications
                </Text>
                {applications.length === 0 ? (
                    <Surface style={styles.empty} elevation={0}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>No pending applications</Text>
                        <Text style={styles.muted}>New locum requests will appear here</Text>
                    </Surface>
                ) : (
                    applications.map((app) => {
                        const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Applicant';
                        return (
                            <Card key={app.id} style={styles.card}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <Text variant="titleMedium" style={styles.name}>{name}</Text>
                                        {app.email && <Text style={styles.muted}>{app.email}</Text>}
                                        <View style={styles.row}>
                                            <Chip compact style={styles.chip}>
                                                {labelEmployment(app.employment_type || app.category)}
                                            </Chip>
                                            {app.pharmacy_name && (
                                                <Chip compact style={styles.chip}>{app.pharmacy_name}</Chip>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.actions}>
                                        <Button
                                            mode="text"
                                            onPress={() => handleApprove(app)}
                                            loading={busyId === app.id}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            mode="text"
                                            textColor="#DC2626"
                                            onPress={() => handleReject(app)}
                                            loading={busyId === app.id}
                                        >
                                            Reject
                                        </Button>
                                    </View>
                                </Card.Content>
                            </Card>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    title: {
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        color: '#6B7280',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        elevation: 0,
    },
    errorBox: {
        margin: 16,
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 10,
    },
    errorText: { color: '#B91C1C', marginBottom: 4 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 60, gap: 10 },
    sectionTitle: {
        marginBottom: 8,
        color: '#111827',
        fontWeight: '600',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    name: { fontWeight: '600', color: '#111827' },
    muted: { color: '#6B7280' },
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    chip: { backgroundColor: '#F3F4F6' },
    actions: {
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        gap: 4,
    },
    empty: {
        alignItems: 'center',
        padding: 32,
        gap: 8,
    },
    emptyTitle: {
        fontWeight: '600',
        color: '#111827',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
});
