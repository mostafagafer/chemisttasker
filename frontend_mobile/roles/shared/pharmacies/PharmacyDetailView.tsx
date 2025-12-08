// Pharmacy Detail View - Mobile
// Integrates Staff Manager, Locum Manager, and Pharmacy Admins

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type MembershipDTO, type PharmacyAdminDTO, type PharmacyDTO } from '@chemisttasker/shared-core';
import StaffManager from './StaffManager';
import LocumManager from './LocumManager';
import PharmacyAdmins from './PharmacyAdmins';
import { surfaceTokens } from './types';

type Tab = 'staff' | 'locums' | 'admins';

interface PharmacyDetailViewProps {
    pharmacy: PharmacyDTO;
    memberships: MembershipDTO[];
    adminAssignments: PharmacyAdminDTO[];
    onMembershipsChanged: () => void;
    onAdminsChanged: () => void;
    loading?: boolean;
}

export default function PharmacyDetailView({
    pharmacy,
    memberships,
    adminAssignments,
    onMembershipsChanged,
    onAdminsChanged,
    loading = false,
}: PharmacyDetailViewProps) {
    const [activeTab, setActiveTab] = useState<Tab>('staff');

    // Filter memberships by type
    // Any employment type that is NOT strictly a locum/casual type is considered general staff
    // This handles FULL_TIME, PART_TIME, CASUAL, STUDENT, and any new types safely
    const locumTypes = ['LOCUM', 'SHIFT_HERO'];

    const staffMemberships = memberships.filter((m) =>
        !locumTypes.includes(m.employment_type || '')
    );

    const locumMemberships = memberships.filter((m) =>
        locumTypes.includes(m.employment_type || '')
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Quick Actions */}
            <View style={styles.quickActions}>
                <Card style={styles.actionCard}>
                    <Card.Content>
                        <Text style={styles.actionTitle}>Quick Actions</Text>
                        <View style={styles.actionButtons}>
                            <Button mode="outlined" onPress={() => setActiveTab('staff')} compact>
                                Manage Staff
                            </Button>
                            <Button mode="outlined" onPress={() => setActiveTab('locums')} compact>
                                Manage Locums
                            </Button>
                            <Button mode="outlined" onPress={() => setActiveTab('admins')} compact>
                                Manage Admins
                            </Button>
                        </View>
                    </Card.Content>
                </Card>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <SegmentedButtons
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as Tab)}
                    buttons={[
                        {
                            value: 'staff',
                            label: `Staff (${staffMemberships.length})`,
                        },
                        {
                            value: 'locums',
                            label: `Locums (${locumMemberships.length})`,
                        },
                        {
                            value: 'admins',
                            label: `Admins (${adminAssignments.length})`,
                        },
                    ]}
                    style={styles.segmentedButton}
                />
            </View>

            {/* Content */}
            <ScrollView style={styles.content}>
                {activeTab === 'staff' && (
                    <StaffManager
                        pharmacyId={pharmacy.id}
                        memberships={staffMemberships}
                        onMembershipsChanged={onMembershipsChanged}
                        loading={loading}
                        pharmacyName={pharmacy.name}
                    />
                )}

                {activeTab === 'locums' && (
                    <LocumManager
                        pharmacyId={pharmacy.id}
                        memberships={locumMemberships}
                        onMembershipsChanged={onMembershipsChanged}
                        loading={loading}
                        pharmacyName={pharmacy.name}
                    />
                )}

                {activeTab === 'admins' && (
                    <PharmacyAdmins
                        pharmacyId={pharmacy.id}
                        admins={adminAssignments}
                        onAdminsChanged={onAdminsChanged}
                        loading={loading}
                        pharmacyName={pharmacy.name}
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: surfaceTokens.bgDark,
    },
    quickActions: {
        padding: 16,
    },
    actionCard: {
        backgroundColor: surfaceTokens.bg,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    tabContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    segmentedButton: {
        backgroundColor: surfaceTokens.bg,
    },
    content: {
        flex: 1,
    },
});
