import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Card, FAB, Button, Searchbar, Chip, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPharmacies } from '@chemisttasker/shared-core';

interface Pharmacy {
    id: number;
    name: string;
    street_address: string;
    suburb: string;
    state: string;
    postcode: string;
    verified?: boolean;
}

export default function PharmaciesListScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPharmacies();
    }, []);

    const fetchPharmacies = async () => {
        try {
            setError('');
            const data = await getPharmacies();
            // Handle both array and paginated response
            const pharmacyList = Array.isArray(data) ? data : (data as any).results || [];
            setPharmacies(pharmacyList);
        } catch (err: any) {
            console.error('Error fetching pharmacies:', err);
            setError('Failed to load pharmacies');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPharmacies();
        setRefreshing(false);
    };

    const filteredPharmacies = pharmacies.filter(pharmacy =>
        pharmacy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pharmacy.suburb.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1976d2" />
                    <Text style={styles.loadingText}>Loading pharmacies...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>My Pharmacies</Text>
                <Searchbar
                    placeholder="Search pharmacies..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />
            </View>

            {error ? (
                <Surface style={styles.errorContainer} elevation={1}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button onPress={fetchPharmacies}>Retry</Button>
                </Surface>
            ) : null}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredPharmacies.length === 0 ? (
                    <Surface style={styles.emptyContainer} elevation={0}>
                        <Text variant="titleMedium" style={styles.emptyTitle}>
                            {searchQuery ? 'No pharmacies found' : 'No Pharmacies Yet'}
                        </Text>
                        <Text variant="bodyMedium" style={styles.emptyText}>
                            {searchQuery ? 'Try a different search term' : 'Add your first pharmacy to start posting shifts'}
                        </Text>
                        {!searchQuery && (
                            <Button
                                mode="contained"
                                icon="store-plus"
                                onPress={() => router.push('/owner/pharmacies/add')}
                                style={styles.emptyButton}
                            >
                                Add Pharmacy
                            </Button>
                        )}
                    </Surface>
                ) : (
                    filteredPharmacies.map((pharmacy) => (
                        <Card
                            key={pharmacy.id}
                            style={styles.card}
                            onPress={() => router.push(`/owner/pharmacies/${pharmacy.id}`)}
                        >
                            <Card.Content>
                                <View style={styles.cardHeader}>
                                    <Text variant="titleLarge" style={styles.pharmacyName}>
                                        {pharmacy.name}
                                    </Text>
                                    {pharmacy.verified && (
                                        <Chip icon="check-circle" style={styles.verifiedChip} textStyle={styles.chipText}>
                                            Verified
                                        </Chip>
                                    )}
                                </View>

                                <View style={styles.addressContainer}>
                                    <Text variant="bodyMedium" style={styles.address}>
                                        📍 {pharmacy.street_address}
                                    </Text>
                                    <Text variant="bodyMedium" style={styles.address}>
                                        {pharmacy.suburb}, {pharmacy.state} {pharmacy.postcode}
                                    </Text>
                                </View>
                            </Card.Content>

                            <Card.Actions>
                                <Button onPress={() => router.push(`/owner/pharmacies/${pharmacy.id}/edit`)}>
                                    Edit
                                </Button>
                                <Button onPress={() => router.push(`/owner/pharmacies/${pharmacy.id}`)}>
                                    View Details
                                </Button>
                            </Card.Actions>
                        </Card>
                    ))
                )}
            </ScrollView>

            <FAB
                icon="plus"
                style={styles.fab}
                onPress={() => router.push('/owner/pharmacies/add')}
                label="Add Pharmacy"
            />
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
        gap: 16,
    },
    loadingText: {
        color: '#666',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    searchBar: {
        elevation: 0,
        backgroundColor: '#f5f5f5',
    },
    errorContainer: {
        margin: 16,
        padding: 16,
        backgroundColor: '#ffebee',
        borderRadius: 8,
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        color: '#c62828',
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 80,
    },
    card: {
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    pharmacyName: {
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
    addressContainer: {
        gap: 4,
    },
    address: {
        color: '#666',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
        marginTop: 40,
    },
    emptyTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyButton: {
        paddingHorizontal: 16,
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
    },
});
