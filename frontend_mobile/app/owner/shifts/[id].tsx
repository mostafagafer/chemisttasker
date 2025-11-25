import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text, Button, Surface, Chip, Divider, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveShiftDetail, updateShift } from '@chemisttasker/shared-core';

interface Shift {
    id: number;
    pharmacy_name: string;
    pharmacy_address?: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    role: string;
    hourly_rate: number;
    description?: string;
    applications_count?: number;
    status: string;
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
            const response = await getActiveShiftDetail(id as string);
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

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const calculateDuration = (start: string, end: string) => {
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
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

    const durationHours = calculateDuration(shift.start_time, shift.end_time);
    const totalPay = durationHours * shift.hourly_rate;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.header} elevation={1}>
                    <View style={styles.headerTop}>
                        <Text variant="headlineMedium" style={styles.title}>
                            {shift.role}
                        </Text>
                        <Chip
                            style={[styles.statusChip, { backgroundColor: `${getStatusColor(shift.status)}20` }]}
                            textStyle={[styles.statusText, { color: getStatusColor(shift.status) }]}
                        >
                            {shift.status}
                        </Chip>
                    </View>
                    <Text variant="bodyLarge" style={styles.pharmacyName}>
                        {shift.pharmacy_name}
                    </Text>
                </Surface>

                {/* Key Details */}
                <Surface style={styles.section} elevation={1}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Shift Details</Text>

                    <List.Section>
                        <List.Item
                            title="Date"
                            description={formatDate(shift.shift_date)}
                            left={props => <List.Icon {...props} icon="calendar" />}
                        />

                        <Divider />

                        <List.Item
                            title="Time"
                            description={`${shift.start_time} - ${shift.end_time} (${durationHours.toFixed(1)} hours)`}
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
                            description={`$${shift.hourly_rate.toFixed(2)}/hour`}
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
