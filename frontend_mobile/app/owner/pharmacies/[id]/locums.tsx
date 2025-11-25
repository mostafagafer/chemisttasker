import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    getMemberships,
    getMembershipApplications,
    startDm,
} from '@chemisttasker/shared-core';
import * as sharedCore from '@chemisttasker/shared-core';

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

export default function PharmacyLocumsScreen() {
    const { id } = useLocalSearchParams();
    const pharmacyId = Array.isArray(id) ? id[0] : id;
    const pharmacyIdNumber = pharmacyId ? Number(pharmacyId) : undefined;
    const router = useRouter();

    const [locums, setLocums] = useState<Membership[]>([]);
    const [applications, setApplications] = useState<MembershipApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<number | null>(null);

    const fetchAll = useCallback(async () => {
        if (!pharmacyId) return;
        try {
            const [membersRes, appsRes] = await Promise.all([
                getMemberships({ pharmacy: pharmacyId } as any),
                getMembershipApplications({ status: 'PENDING', pharmacy: pharmacyId } as any),
            ]);
            const membershipList: Membership[] = Array.isArray((membersRes as any)?.results)
                ? (membersRes as any).results
                : Array.isArray(membersRes)
                    ? (membersRes as any)
                    : [];
            const locumMembers = membershipList
                .filter((m) => isLocum(m.employment_type))
                .filter((m) => (pharmacyIdNumber ? m.pharmacy === pharmacyIdNumber : true));
            setLocums(locumMembers);

            const appsList: MembershipApplication[] = Array.isArray((appsRes as any)?.results)
                ? (appsRes as any).results
                : Array.isArray(appsRes)
                    ? (appsRes as any)
                    : [];
            const locumApps = appsList
                .filter((a) => isLocum(a.employment_type || a.category))
                .filter((a) => (pharmacyIdNumber ? a.pharmacy === pharmacyIdNumber : true));
            setApplications(locumApps);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [pharmacyId, pharmacyIdNumber]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

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
                pharmacy_id: pharmacyId,
            } as any)) as any;
            const name = membership.user_details?.full_name || membership.invited_name || 'Chat';
            router.push({ pathname: '/owner/messages/[id]', params: { id: room?.id, name } });
        } catch {
            Alert.alert('Error', 'Failed to start chat');
        } finally {
            setBusyId(null);
        }
    };

    const handleApprove = async (app: MembershipApplication) => {
        setBusyId(app.id);
        try {
            const approveFn = (sharedCore as any).approveMembershipApplication;
            await approveFn(app.id, { employment_type: app.employment_type });
            await fetchAll();
        } catch {
            Alert.alert('Error', 'Failed to approve');
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
                    <Text style={styles.muted}>Loading locums...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>Locums</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>Locums and favourites for this pharmacy</Text>
            </View>

            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search locums..."
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchBar}
                />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Text variant="titleMedium" style={styles.sectionTitle}>Active Locums</Text>
                {filteredLocums.length === 0 ? (
                    <Surface style={styles.empty} elevation={0}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>No locums yet</Text>
                        <Text style={styles.muted}>Approved locums for this pharmacy will appear here</Text>
                    </Surface>
                ) : (
                    filteredLocums.map((member) => {
                        const name = member.user_details?.full_name || member.invited_name || 'Locum';
                        const email = member.user_details?.email;
                        return (
                            <Card key={member.id} style={styles.card}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <Chip compact style={styles.chip}>{labelEmployment(member.employment_type)}</Chip>
                                        <Text variant="titleMedium" style={styles.name}>{name}</Text>
                                        {email && <Text style={styles.muted}>{email}</Text>}
                                    </View>
                                    <Button mode="text" onPress={() => handleMessage(member)} loading={busyId === member.id}>Message</Button>
                                </Card.Content>
                            </Card>
                        );
                    })
                )}

                <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 12 }]}>Pending Applications</Text>
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
                                        <Button mode="text" onPress={() => handleApprove(app)} loading={busyId === app.id}>Approve</Button>
                                        <Button mode="text" textColor="#DC2626" onPress={() => handleReject(app)} loading={busyId === app.id}>Reject</Button>
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
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontWeight: 'bold', color: '#111827' },
    subtitle: { color: '#6B7280' },
    searchContainer: { paddingHorizontal: 16, paddingVertical: 8 },
    searchBar: { backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 0 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 80, gap: 10 },
    sectionTitle: { fontWeight: '600', color: '#111827', marginBottom: 6 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12 },
    cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    chip: { backgroundColor: '#F3F4F6' },
    name: { fontWeight: '600', color: '#111827' },
    muted: { color: '#6B7280' },
    empty: { alignItems: 'center', padding: 32, gap: 8 },
    emptyTitle: { fontWeight: '600', color: '#111827' },
    infoBox: { padding: 12, borderRadius: 10, backgroundColor: '#E0F2FE' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    actions: { justifyContent: 'flex-end', alignItems: 'flex-end', gap: 4 },
});
