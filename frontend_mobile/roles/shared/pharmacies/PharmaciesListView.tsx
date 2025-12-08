// Pharmacy List View - Mobile
// Displays grid of pharmacy cards with Open, Edit, Delete actions

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Surface, IconButton, ActivityIndicator } from 'react-native-paper';
import { PharmacyDTO, surfaceTokens } from './types';

interface PharmaciesListViewProps {
    pharmacies: PharmacyDTO[];
    staffCounts: Record<string, number>;
    loading?: boolean;
    onOpenPharmacy: (pharmacyId: string) => void;
    onEditPharmacy?: (pharmacy: PharmacyDTO) => void;
    onDeletePharmacy?: (pharmacyId: string) => void;
    onAddPharmacy?: () => void;
}

export default function PharmaciesListView({
    pharmacies,
    staffCounts,
    loading = false,
    onOpenPharmacy,
    onEditPharmacy,
    onDeletePharmacy,
    onAddPharmacy,
}: PharmaciesListViewProps) {
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={surfaceTokens.primary} />
                <Text style={styles.loadingText}>Loading pharmacies...</Text>
            </View>
        );
    }

    if (pharmacies.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <IconButton icon="domain" size={64} iconColor={surfaceTokens.border} />
                <Text style={styles.emptyTitle}>No pharmacies yet</Text>
                <Text style={styles.emptyText}>Add your first pharmacy to get started</Text>
                {onAddPharmacy && (
                    <Button mode="contained" onPress={onAddPharmacy} style={styles.addButton}>
                        Add Pharmacy
                    </Button>
                )}
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {pharmacies.map((pharmacy) => {
                const address = [pharmacy.street_address, pharmacy.suburb]
                    .filter(Boolean)
                    .join(', ');
                const staffCount = staffCounts[pharmacy.id] || 0;

                return (
                    <Card key={pharmacy.id} style={styles.card} mode="outlined">
                        <Card.Content style={styles.cardContent}>
                            {/* Icon */}
                            <Surface style={styles.iconContainer} elevation={0}>
                                <IconButton
                                    icon="domain"
                                    size={24}
                                    iconColor={surfaceTokens.primary}
                                />
                            </Surface>

                            {/* Info */}
                            <View style={styles.infoContainer}>
                                <Text style={styles.pharmacyName}>{pharmacy.name}</Text>
                                <Text style={styles.address}>
                                    {address}, {pharmacy.state} {pharmacy.postcode}
                                </Text>
                                {staffCount > 0 && (
                                    <Text style={styles.staffCount}>Staff: {staffCount}</Text>
                                )}
                            </View>

                            {/* Actions */}
                            <View style={styles.actionsContainer}>
                                <Button
                                    mode="outlined"
                                    compact
                                    onPress={() => onOpenPharmacy(pharmacy.id)}
                                    style={styles.actionButton}
                                >
                                    Open
                                </Button>
                                {onEditPharmacy && (
                                    <Button
                                        mode="outlined"
                                        compact
                                        onPress={() => onEditPharmacy(pharmacy)}
                                        style={styles.actionButton}
                                    >
                                        Edit
                                    </Button>
                                )}
                                {onDeletePharmacy && (
                                    <Button
                                        mode="text"
                                        compact
                                        textColor={surfaceTokens.error}
                                        onPress={() => onDeletePharmacy(pharmacy.id)}
                                        style={styles.actionButton}
                                    >
                                        Delete
                                    </Button>
                                )}
                            </View>
                        </Card.Content>
                    </Card>
                );
            })}

            {onAddPharmacy && (
                <Button
                    mode="contained"
                    onPress={onAddPharmacy}
                    style={styles.fabButton}
                    icon="plus"
                >
                    Add Pharmacy
                </Button>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: surfaceTokens.bgDark,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: surfaceTokens.bgDark,
        gap: 12,
    },
    loadingText: {
        color: surfaceTokens.textMuted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: surfaceTokens.bgDark,
        padding: 32,
        gap: 12,
    },
    emptyTitle: {
        fontWeight: '600',
        color: '#111827',
        fontSize: 18,
    },
    emptyText: {
        color: surfaceTokens.textMuted,
        textAlign: 'center',
        fontSize: 14,
    },
    addButton: {
        marginTop: 16,
    },
    card: {
        marginBottom: 12,
        backgroundColor: surfaceTokens.bg,
        borderColor: surfaceTokens.border,
        borderRadius: 12,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
    },
    iconContainer: {
        backgroundColor: surfaceTokens.hover,
        borderRadius: 8,
        padding: 4,
    },
    infoContainer: {
        flex: 1,
        gap: 4,
    },
    pharmacyName: {
        fontWeight: '600',
        color: '#111827',
        fontSize: 16,
    },
    address: {
        color: surfaceTokens.textMuted,
        fontSize: 13,
    },
    staffCount: {
        color: surfaceTokens.textMuted,
        fontSize: 12,
    },
    actionsContainer: {
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
    },
    actionButton: {
        minWidth: 70,
    },
    fabButton: {
        marginTop: 16,
    },
});
