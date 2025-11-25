import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, Searchbar, Surface, IconButton, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOwnerOpenShifts } from '@chemisttasker/shared-core';

interface ShiftSlot {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
}

interface Shift {
    id: number;
    pharmacyName: string;
    roleNeeded: string;
    description?: string;
    slots: ShiftSlot[];
    pharmacy?: number;
    status?: string;
    hourlyRate?: number;
}

// Helper functions to get display values from first slot
const getShiftDate = (shift: Shift): string => shift.slots[0]?.date || '';
const getStartTime = (shift: Shift): string => shift.slots[0]?.startTime || '';
const getEndTime = (shift: Shift): string => shift.slots[0]?.endTime || '';
const getHourlyRate = (shift: Shift): number => shift.hourlyRate ?? 0;

export default function ShiftsListScreen() {
    const router = useRouter();
    const { pharmacy_id } = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);

    const fetchShifts = useCallback(async () => {
        try {
            const response = await getOwnerOpenShifts();
            const rawList = Array.isArray((response as any)?.results)
                ? (response as any).results
                : Array.isArray(response)
                    ? (response as any)
                    : [];
            const list: Shift[] = rawList.map((raw: any) => {
                const slots: ShiftSlot[] = Array.isArray(raw.slots)
                    ? raw.slots.map((slot: any) => ({
                        id: slot.id ?? Math.random(),
                        date: slot.date ?? slot.shift_date ?? raw.shift_date ?? '',
                        startTime: slot.start_time ?? slot.startTime ?? raw.start_time ?? '',
                        endTime: slot.end_time ?? slot.endTime ?? raw.end_time ?? '',
                        isRecurring: slot.is_recurring ?? slot.isRecurring ?? false,
                    }))
                    : [{
                        id: raw.id ?? Math.random(),
                        date: raw.shift_date ?? '',
                        startTime: raw.start_time ?? '',
                        endTime: raw.end_time ?? '',
                        isRecurring: false,
                    }];

                return {
                    id: raw.id,
                    pharmacyName: raw.pharmacy_name || raw.pharmacyName || 'Pharmacy',
                    roleNeeded: raw.role || raw.roleNeeded || 'Role',
                    description: raw.description,
                    slots,
                    pharmacy: raw.pharmacy ?? raw.pharmacy_id,
                    status: raw.status,
                    hourlyRate: raw.hourly_rate ?? raw.hourlyRate,
                };
            });
            const filtered = pharmacy_id
                ? list.filter((s) => String(s.pharmacy ?? s.pharmacy) === String(pharmacy_id))
                : list;
            setShifts(filtered as Shift[]);
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
        }
    }, [pharmacy_id]);

    useEffect(() => {
        void fetchShifts();
    }, [fetchShifts, activeTab]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchShifts();
        setRefreshing(false);
    };

    const getStatusColor = (status?: string) => {
        const normalized = (status || '').toUpperCase();
        switch (normalized) {
            case 'CONFIRMED': return '#10B981';
            case 'PENDING': return '#F59E0B';
            case 'CANCELLED': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getStatusBg = (status?: string) => {
        const normalized = (status || '').toUpperCase();
        switch (normalized) {
            case 'CONFIRMED': return '#D1FAE5';
            case 'PENDING': return '#FEF3C7';
            case 'CANCELLED': return '#FEE2E2';
            default: return '#F3F4F6';
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const calculateDuration = (start: string, end: string) => {
        const [startHour] = (start || '').split(':').map(Number);
        const [endHour] = (end || '').split(':').map(Number);
        if (Number.isFinite(startHour) && Number.isFinite(endHour)) {
            return endHour - startHour;
        }
        return 0;
    };

    const filteredShifts = shifts.filter(shift =>
        (shift.pharmacyName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text variant="headlineSmall" style={styles.title}>Shifts</Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Manage your shift schedule
                    </Text>
                </View>
                <IconButton icon="filter-variant" size={24} onPress={() => { }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search shifts or pharmacies..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    iconColor="#6B7280"
                />
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <Surface
                    style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
                    onTouchEnd={() => setActiveTab('upcoming')}
                >
                    <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
                        Upcoming
                    </Text>
                </Surface>
                <Surface
                    style={[styles.tab, activeTab === 'past' && styles.activeTab]}
                    onTouchEnd={() => setActiveTab('past')}
                >
                    <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
                        Past Shifts
                    </Text>
                </Surface>
            </View>

            {/* Shifts List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {filteredShifts.map((shift) => (
                    <Card
                        key={shift.id}
                        style={styles.shiftCard}
                        onPress={() => router.push(`/owner/shifts/${shift.id}`)}
                    >
                        <Card.Content style={styles.cardContent}>
                            {/* Header */}
                            <View style={styles.cardHeader}>
                                <View style={styles.pharmacyInfo}>
                                    <IconButton icon="store" size={20} iconColor="#6366F1" style={styles.pharmacyIcon} />
                                    <Text variant="titleMedium" style={styles.pharmacyName}>
                                        {shift.pharmacyName}
                                    </Text>
                                </View>
                                <Chip
                                    style={[styles.statusChip, { backgroundColor: getStatusBg(shift.status) }]}
                                    textStyle={[styles.statusText, { color: getStatusColor(shift.status) }]}
                                    compact
                                >
                                    {shift.status || 'Status'}
                                </Chip>
                            </View>

                            {/* Date & Time */}
                            <View style={styles.infoRow}>
                                <IconButton icon="calendar" size={16} iconColor="#6B7280" style={styles.infoIcon} />
                                <Text variant="bodyMedium" style={styles.infoText}>
                                    {formatDate(getShiftDate(shift))}
                                </Text>
                            </View>

                            <View style={styles.infoRow}>
                                <IconButton icon="clock-outline" size={16} iconColor="#6B7280" style={styles.infoIcon} />
                                <Text variant="bodyMedium" style={styles.infoText}>
                                    {getStartTime(shift)} - {getEndTime(shift)}
                                </Text>
                                <Chip style={styles.durationChip} textStyle={styles.durationText} compact>
                                    {calculateDuration(getStartTime(shift), getEndTime(shift))}h
                                </Chip>
                            </View>

                            {/* Role & Rate */}
                            <View style={styles.bottomRow}>
                                <Chip style={styles.roleChip} textStyle={styles.roleText} compact>
                                    {shift.roleNeeded}
                                </Chip>
                                {getHourlyRate(shift) ? (
                                    <Text variant="titleMedium" style={styles.rate}>
                                        �`�{getHourlyRate(shift)}/hr
                                    </Text>
                                ) : null}
                            </View>
                        </Card.Content>
                    </Card>
                ))}

                {filteredShifts.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>
                            No {activeTab} shifts
                        </Text>
                        <Text variant="bodyMedium" style={styles.emptyText}>
                            {activeTab === 'upcoming'
                                ? 'Post a new shift to get started'
                                : 'Your completed shifts will appear here'}
                        </Text>
                    </View>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
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
        paddingVertical: 12,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        elevation: 0,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: 'transparent',
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 3,
        borderBottomColor: '#6366F1',
    },
    tabText: {
        color: '#6B7280',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#6366F1',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    shiftCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#6366F1',
    },
    cardContent: {
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    pharmacyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    pharmacyIcon: {
        margin: 0,
    },
    pharmacyName: {
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    statusChip: {
        height: 24,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoIcon: {
        margin: 0,
        marginRight: 4,
    },
    infoText: {
        color: '#6B7280',
        flex: 1,
    },
    durationChip: {
        backgroundColor: '#E0E7FF',
        height: 20,
    },
    durationText: {
        color: '#6366F1',
        fontSize: 10,
        fontWeight: '600',
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    roleChip: {
        backgroundColor: '#F3F4F6',
    },
    roleText: {
        color: '#111827',
        fontSize: 12,
    },
    rate: {
        color: '#10B981',
        fontWeight: 'bold',
    },
    assignedUser: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 'auto',
    },
    avatar: {
        backgroundColor: '#6366F1',
    },
    avatarLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    assignedName: {
        color: '#6B7280',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontWeight: '600',
        marginBottom: 8,
        color: '#111827',
    },
    emptyText: {
        color: '#6B7280',
        textAlign: 'center',
    },
});
