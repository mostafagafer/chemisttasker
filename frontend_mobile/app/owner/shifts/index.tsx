import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, Searchbar, Surface, IconButton, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../utils/apiClient';

interface Shift {
    id: number;
    pharmacy_name: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    role: string;
    hourly_rate: number;
    assigned_user?: {
        name: string;
        initials: string;
    };
    status: string;
}

export default function ShiftsListScreen() {
    const router = useRouter();
    const { pharmacy_id } = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchShifts();
    }, [activeTab, pharmacy_id]);

    const fetchShifts = async () => {
        try {
            const params: any = {};
            if (pharmacy_id) params.pharmacy_id = pharmacy_id;

            const response = await apiClient.get('/client-profile/shifts/owner/', { params });
            setShifts(response.data);
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchShifts();
        setRefreshing(false);
    };

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case 'CONFIRMED': return '#10B981';
            case 'PENDING': return '#F59E0B';
            case 'CANCELLED': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status.toUpperCase()) {
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
        const [startHour] = start.split(':').map(Number);
        const [endHour] = end.split(':').map(Number);
        return endHour - startHour;
    };

    const filteredShifts = shifts.filter(shift =>
        shift.pharmacy_name.toLowerCase().includes(searchQuery.toLowerCase())
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
                                        {shift.pharmacy_name}
                                    </Text>
                                </View>
                                <Chip
                                    style={[styles.statusChip, { backgroundColor: getStatusBg(shift.status) }]}
                                    textStyle={[styles.statusText, { color: getStatusColor(shift.status) }]}
                                    compact
                                >
                                    {shift.status}
                                </Chip>
                            </View>

                            {/* Date & Time */}
                            <View style={styles.infoRow}>
                                <IconButton icon="calendar" size={16} iconColor="#6B7280" style={styles.infoIcon} />
                                <Text variant="bodyMedium" style={styles.infoText}>
                                    {formatDate(shift.shift_date)}
                                </Text>
                            </View>

                            <View style={styles.infoRow}>
                                <IconButton icon="clock-outline" size={16} iconColor="#6B7280" style={styles.infoIcon} />
                                <Text variant="bodyMedium" style={styles.infoText}>
                                    {shift.start_time} - {shift.end_time}
                                </Text>
                                <Chip style={styles.durationChip} textStyle={styles.durationText} compact>
                                    {calculateDuration(shift.start_time, shift.end_time)}h
                                </Chip>
                            </View>

                            {/* Role & Rate */}
                            <View style={styles.bottomRow}>
                                <Chip style={styles.roleChip} textStyle={styles.roleText} compact>
                                    {shift.role}
                                </Chip>
                                <Text variant="titleMedium" style={styles.rate}>
                                    £{shift.hourly_rate}/hr
                                </Text>
                                {shift.assigned_user && (
                                    <View style={styles.assignedUser}>
                                        <Avatar.Text
                                            size={32}
                                            label={shift.assigned_user.initials}
                                            style={styles.avatar}
                                            labelStyle={styles.avatarLabel}
                                        />
                                        <Text variant="bodySmall" style={styles.assignedName}>
                                            {shift.assigned_user.name}
                                        </Text>
                                    </View>
                                )}
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
