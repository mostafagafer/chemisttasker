import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, Button, Surface, Chip, Divider, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../utils/apiClient';

interface Pharmacy {
    id: number;
    name: string;
    email?: string;
    street_address: string;
    suburb: string;
    state: string;
    postcode: string;
    abn?: string;
    verified?: boolean;
}

export default function PharmacyDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPharmacy();
    }, [id]);

    const fetchPharmacy = async () => {
        try {
            setError('');
            const response = await apiClient.get(`/client-profile/pharmacies/${id}/`);
            setPharmacy(response.data);
        } catch (err: any) {
            console.error('Error fetching pharmacy:', err);
            setError('Failed to load pharmacy details');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Pharmacy',
            'Are you sure you want to delete this pharmacy?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/client-profile/pharmacies/${id}/`);
                            router.back();
                        } catch (err: any) {
                            Alert.alert('Error', 'Failed to delete pharmacy');
                        }
                    },
                },
            ]
        );
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

    if (error || !pharmacy) {
        return (
            <SafeAreaView style={styles.container}>
                <Surface style={styles.errorContainer} elevation={1}>
                    <Text style={styles.errorText}>{error || 'Pharmacy not found'}</Text>
                    <Button onPress={() => router.back()}>Go Back</Button>
                </Surface>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.header} elevation={1}>
                    <View style={styles.headerTop}>
                        <Text variant="headlineMedium" style={styles.title}>
                            {pharmacy.name}
                        </Text>
                        {pharmacy.verified && (
                            <Chip icon="check-circle" style={styles.verifiedChip} textStyle={styles.chipText}>
                                Verified
                            </Chip>
                        )}
                    </View>
                </Surface>

                {/* Details */}
                <Surface style={styles.section} elevation={1}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Details</Text>

                    <List.Section>
                        {pharmacy.email && (
                            <>
                                <List.Item
                                    title="Email"
                                    description={pharmacy.email}
                                    left={props => <List.Icon {...props} icon="email" />}
                                />
                                <Divider />
                            </>
                        )}

                        <List.Item
                            title="Address"
                            description={`${pharmacy.street_address}\n${pharmacy.suburb}, ${pharmacy.state} ${pharmacy.postcode}`}
                            left={props => <List.Icon {...props} icon="map-marker" />}
                            descriptionNumberOfLines={3}
                        />

                        {pharmacy.abn && (
                            <>
                                <Divider />
                                <List.Item
                                    title="ABN"
                                    description={pharmacy.abn}
                                    left={props => <List.Icon {...props} icon="file-document" />}
                                />
                            </>
                        )}
                    </List.Section>
                </Surface>

                {/* Actions */}
                <Surface style={styles.section} elevation={1}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>

                    <View style={styles.actionsContainer}>
                        <Button
                            mode="contained"
                            icon="calendar-plus"
                            onPress={() => router.push(`/owner/shifts/create?pharmacy_id=${id}`)}
                            style={styles.actionButton}
                        >
                            Post Shift
                        </Button>

                        <Button
                            mode="outlined"
                            icon="clock-outline"
                            onPress={() => router.push(`/owner/shifts?pharmacy_id=${id}`)}
                            style={styles.actionButton}
                        >
                            View Shifts
                        </Button>
                    </View>
                </Surface>

                {/* Edit/Delete */}
                <View style={styles.buttonContainer}>
                    <Button
                        mode="outlined"
                        icon="pencil"
                        onPress={() => router.push(`/owner/pharmacies/${id}/edit`)}
                        style={styles.button}
                    >
                        Edit Details
                    </Button>

                    <Button
                        mode="text"
                        icon="delete"
                        textColor="#d32f2f"
                        onPress={handleDelete}
                        style={styles.button}
                    >
                        Delete
                    </Button>
                </View>
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
    },
    title: {
        fontWeight: 'bold',
        flex: 1,
    },
    verifiedChip: {
        backgroundColor: '#e8f5e9',
    },
    chipText: {
        color: '#2e7d32',
        fontSize: 11,
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
    actionsContainer: {
        gap: 12,
    },
    actionButton: {
        borderRadius: 8,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
    },
});
