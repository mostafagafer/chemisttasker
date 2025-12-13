import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Searchbar, Card, Chip, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getMemberships, deleteMembership, startDm } from '@chemisttasker/shared-core';

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

export default function ManageStaffScreen() {
    const router = useRouter();
    const [memberships, setMemberships] = useState<Membership[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    useEffect(() => {
        void fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            setError(null);
            const data = await getMemberships({});
            const list: Membership[] = Array.isArray((data as any)?.results)
                ? (data as any).results
                : Array.isArray(data)
                    ? (data as any)
                    : [];
            const filtered = list.filter((m) => isStaff(m.employment_type));
            setMemberships(filtered);
        } catch (err: any) {
            console.error('Failed to load staff', err);
            setError('Failed to load staff');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStaff();
        setRefreshing(false);
    };

    const filtered = useMemo(
        () =>
            memberships.filter((m) => {
                const name = m.user_details?.full_name || m.invited_name || m.user_details?.email || '';
                return name.toLowerCase().includes(search.toLowerCase());
            }),
        [memberships, search]
    );

    const handleRemove = (membershipId: number) => {
        Alert.alert('Remove member', 'Are you sure you want to remove this member?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    setBusyId(membershipId);
                    try {
                        await deleteMembership(membershipId);
                        setMemberships((prev) => prev.filter((m) => m.id !== membershipId));
                    } catch (err) {
                        console.error('Failed to remove member', err);
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
                <Text variant="headlineSmall" style={styles.title}>Manage Staff</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>Rostered employees and admins</Text>
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
                    <Button onPress={fetchStaff}>Retry</Button>
                </Surface>
            )}

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filtered.length === 0 ? (
                    <Surface style={styles.empty} elevation={0}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>No staff found</Text>
                        <Text style={styles.muted}>Add staff from web or invite via email</Text>
                    </Surface>
                ) : (
                    filtered.map((member) => {
                        const name = member.user_details?.full_name || member.invited_name || 'Member';
                        const email = member.user_details?.email;
                        const role = member.role ? member.role : 'Member';
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
                                    <View style={styles.actions}>
                                        <Button
                                            mode="text"
                                            onPress={() => handleMessage(member)}
                                            loading={busyId === member.id && busyId !== null}
                                        >
                                            Message
                                        </Button>
                                        <Button
                                            mode="text"
                                            textColor="#DC2626"
                                            onPress={() => handleRemove(member.id)}
                                            loading={busyId === member.id && busyId !== null}
                                        >
                                            Remove
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
    errorText: {
        color: '#B91C1C',
        marginBottom: 4,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 60, gap: 10 },
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
    chip: {
        backgroundColor: '#F3F4F6',
    },
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
