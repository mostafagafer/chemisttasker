import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text, Button, Surface, Chip, Divider, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchActiveShiftDetailService, fetchWorkerShiftDetailService, updateShift } from '@chemisttasker/shared-core';

interface Shift {
    id: number;
    pharmacy_name?: string;
    pharmacyName?: string;
    pharmacyDetail?: { name?: string };
    pharmacy_address?: string;
    shift_date?: string;
    start_time?: string;
    end_time?: string;
    role?: string;
    role_needed?: string;
    roleNeeded?: string;
    hourly_rate?: number | null;
    description?: string;
    applications_count?: number;
    status?: string;
    slots?: Array<{
        id: number;
        date?: string;
        start_time?: string;
        end_time?: string;
        startTime?: string;
        endTime?: string;
        rate?: number | string | null;
    }>;
}

export default function ShiftDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [shift, setShift] = useState<Shift | null>(null);
    const [error, setError] = useState('');

    const fetchShift = useCallback(async () => {
        try {
            setError('');
            if (!id) {
                setError('Missing shift id');
                return;
            }
            const shiftId = Number(id);
            if (!Number.isFinite(shiftId)) {
                setError('Invalid shift id');
                return;
            }
            let response: any = null;
            try {
                response = await fetchActiveShiftDetailService(shiftId);
            } catch {
                response = await fetchWorkerShiftDetailService(shiftId);
            }
            setShift(response as Shift);
        } catch (err: any) {
            console.error('Error fetching shift:', err);
            setError('Failed to load shift details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void fetchShift();
    }, [fetchShift]);

    const handleCancelShift = () => {
        Alert.alert(
            'Cancel Shift',
            'Are you sure you want to cancel this shift?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!id) {
                                Alert.alert('Error', 'Missing shift id');
                                return;
                            }
                            await updateShift(id as string, { status: 'CANCELLED' });
                            fetchShift();
                        } catch (err: any) {
                            console.error('Failed to cancel shift', err);
                            Alert.alert('Error', 'Failed to cancel shift');
                        }
                    },
                },
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case 'OPEN': return '#4caf50';
            case 'FILLED': return '#2196f3';
            case 'CANCELLED': return '#f44336';
            default: return '#757575';
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Date not provided';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const calculateDuration = (start?: string, end?: string) => {
        if (!start || !end) return 0;
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
        if ([startHour, startMin, endHour, endMin].some((val) => Number.isNaN(val))) {
            return 0;
        }
        const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        return durationMinutes / 60;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1976d2" />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !shift) {
        return (
            <SafeAreaView style={styles.container}>
                <Surface style={styles.errorContainer} elevation={1}>
                    <Text style={styles.errorText}>{error || 'Shift not found'}</Text>
                    <Button onPress={() => router.back()}>Go Back</Button>
                </Surface>
            </SafeAreaView>
        );
    }

    const firstSlot = shift.slots?.[0];
    const shiftDate = shift.shift_date ?? firstSlot?.date;
    const startTime = shift.start_time ?? firstSlot?.start_time ?? firstSlot?.startTime;
    const endTime = shift.end_time ?? firstSlot?.end_time ?? firstSlot?.endTime;
    const hourlyRate =
        typeof shift.hourly_rate === 'number'
            ? shift.hourly_rate
            : typeof firstSlot?.rate === 'number'
                ? Number(firstSlot.rate)
                : typeof firstSlot?.rate === 'string'
                    ? Number(firstSlot.rate)
                    : 0;
    const durationHours = calculateDuration(startTime, endTime);
    const totalPay = durationHours * hourlyRate;
    const roleLabel = shift.role ?? shift.role_needed ?? shift.roleNeeded ?? 'Role';
    const statusLabel = shift.status ?? 'OPEN';
    const pharmacyLabel =
        shift.pharmacy_name ?? shift.pharmacyName ?? shift.pharmacyDetail?.name ?? 'Pharmacy';

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.header} elevation={1}>
                    <View style={styles.headerTop}>
                        <Text variant="headlineMedium" style={styles.title}>
                            {roleLabel}
                        </Text>
                        <Chip
                            style={[styles.statusChip, { backgroundColor: `${getStatusColor(statusLabel)}20` }]}
                            textStyle={[styles.statusText, { color: getStatusColor(statusLabel) }]}
                        >
                            {statusLabel}
                        </Chip>
                    </View>
                    <Text variant="bodyLarge" style={styles.pharmacyName}>
                        {pharmacyLabel}
                    </Text>
                </Surface>

                {/* Key Details */}
                <Surface style={styles.section} elevation={1}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Shift Details</Text>

                    <List.Section>
                        <List.Item
                            title="Date"
                            description={formatDate(shiftDate)}
                            left={props => <List.Icon {...props} icon="calendar" />}
                        />

                        <Divider />

                        <List.Item
                            title="Time"
                            description={
                                startTime && endTime
                                    ? `${startTime} - ${endTime} (${durationHours.toFixed(1)} hours)`
                                    : 'Time not provided'
                            }
                            left={props => <List.Icon {...props} icon="clock-outline" />}
                        />

                        {shift.pharmacy_address && (
                            <>
                                <Divider />
                                <List.Item
                                    title="Location"
                                    description={shift.pharmacy_address}
                                    left={props => <List.Icon {...props} icon="map-marker" />}
                                    descriptionNumberOfLines={2}
                                />
                            </>
                        )}

                        <Divider />

                        <List.Item
                            title="Hourly Rate"
                            description={`$${hourlyRate.toFixed(2)}/hour`}
                            left={props => <List.Icon {...props} icon="currency-usd" />}
                            right={() => (
                                <View style={styles.totalPayContainer}>
                                    <Text variant="bodySmall" style={styles.totalPayLabel}>Total</Text>
                                    <Text variant="titleMedium" style={styles.totalPay}>${totalPay.toFixed(2)}</Text>
                                </View>
                            )}
                        />
                    </List.Section>
                </Surface>

                {/* Description */}
                {shift.description && (
                    <Surface style={styles.section} elevation={1}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Description</Text>
                        <Text variant="bodyMedium" style={styles.description}>
                            {shift.description}
                        </Text>
                    </Surface>
                )}

                {/* Applications */}
                <Surface style={styles.section} elevation={1}>
                    <View style={styles.applicationHeader}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Applications</Text>
                        {shift.applications_count !== undefined && (
                            <Chip icon="account-multiple">
                                {shift.applications_count}
                            </Chip>
                        )}
                    </View>

                    {shift.applications_count && shift.applications_count > 0 ? (
                        <Button
                            mode="contained"
                            icon="eye"
                            onPress={() => router.push(`/owner/shifts/${id}/applications`)}
                            style={styles.viewApplicationsButton}
                        >
                            View All Applications
                        </Button>
                    ) : (
                        <Text variant="bodyMedium" style={styles.noApplications}>
                            No applications yet. Your shift is visible to all qualified pharmacists in your area.
                        </Text>
                    )}
                </Surface>

                {/* Actions */}
                {shift.status === 'OPEN' && (
                    <View style={styles.buttonContainer}>
                        <Button
                            mode="outlined"
                            icon="close"
                            textColor="#d32f2f"
                            onPress={handleCancelShift}
                            style={styles.button}
                        >
                            Cancel Shift
                        </Button>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    errorContainer: {
        margin: 16,
        padding: 20,
        backgroundColor: '#ffebee',
        borderRadius: 8,
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        color: '#c62828',
        textAlign: 'center',
    },
    header: {
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    title: {
        fontWeight: 'bold',
        flex: 1,
    },
    statusChip: {
        height: 28,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    pharmacyName: {
        color: '#666',
    },
    section: {
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    totalPayContainer: {
        alignItems: 'flex-end',
    },
    totalPayLabel: {
        color: '#666',
    },
    totalPay: {
        fontWeight: 'bold',
        color: '#1976d2',
    },
    description: {
        lineHeight: 22,
        color: '#666',
    },
    applicationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    viewApplicationsButton: {
        marginTop: 8,
    },
    noApplications: {
        color: '#999',
        fontStyle: 'italic',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
    },
});
