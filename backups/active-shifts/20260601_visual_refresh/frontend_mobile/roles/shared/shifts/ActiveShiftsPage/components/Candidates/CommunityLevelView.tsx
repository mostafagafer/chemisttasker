// CommunityLevelView Component
// Displays community shift members grouped by status

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Divider, Chip, Text } from 'react-native-paper';
import { Shift, ShiftMemberStatus } from '@chemisttasker/shared-core';
import { customTheme } from '../../theme';
import StatusCard from './StatusCard';
import SlotSelector from './SlotSelector';
import { dedupeMembers, findOfferForMemberInShift } from '../../utils/candidateHelpers';

interface CommunityLevelViewProps {
    shift: Shift;
    members: ShiftMemberStatus[];
    selectedSlotId: number | null;
    slotHasUpdates?: Record<number, boolean>;
    offers: any[];
    onSelectSlot: (slotId: number) => void;
    onReviewCandidate: (member: ShiftMemberStatus, shiftId: number, offer: any | null, slotId: number | null) => void;
    reviewLoadingId?: number | null;
}

export default function CommunityLevelView({
    shift,
    members,
    selectedSlotId,
    slotHasUpdates,
    offers,
    onSelectSlot,
    onReviewCandidate,
    reviewLoadingId,
}: CommunityLevelViewProps) {
    const slots = (shift as any).slots || [];
    const multiSlots = !(shift as any).singleUserOnly && slots.length > 0;

    // Filter members by slot if multi-slot; include shift-level members with no slotId
    const slotMembersRaw = multiSlots
        ? members.filter((m) => (m as any).slotId === selectedSlotId || (m as any).slotId == null)
        : members;
    const slotMembers = dedupeMembers(slotMembersRaw);

    // Categorize members by status
    const interested = slotMembers.filter((m) => m.status === 'interested');
    const assigned = slotMembers.filter((m) => m.status === 'accepted');
    const rejected = slotMembers.filter((m) => m.status === 'rejected');
    const noResponse = slotMembers.filter((m) => m.status === 'no_response');

    const hasMembers = slotMembers.length > 0;

    const getOfferForMember = (member: ShiftMemberStatus) => {
        const offer = findOfferForMemberInShift(offers, member, selectedSlotId);
        // If multi-slot, lock to the selected slot; otherwise use null
        return { offer, slotId: multiSlots ? selectedSlotId : null };
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Slot Selector for multi-slot shifts */}
            {multiSlots && (
                <SlotSelector
                    slots={slots}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={onSelectSlot}
                    slotHasUpdates={slotHasUpdates}
                />
            )}

            <View style={styles.dividerContainer}>
                <Divider style={styles.divider} />
                <Chip mode="outlined" style={styles.dividerChip}>Candidates</Chip>
                <Divider style={styles.divider} />
            </View>

            {/* Member Status Boxes Grid */}
            {hasMembers ? (
                <View style={styles.grid}>
                    <StatusCard
                        title="Interested"
                        members={interested}
                        icon="account-check"
                        color="success"
                        shiftId={shift.id}
                        onReviewCandidate={onReviewCandidate}
                        getOfferForMember={getOfferForMember}
                        reviewLoadingId={reviewLoadingId}
                    />
                    <StatusCard
                        title="Assigned"
                        members={assigned}
                        icon="check-circle"
                        color="info"
                        shiftId={shift.id}
                        onReviewCandidate={onReviewCandidate}
                        getOfferForMember={getOfferForMember}
                        reviewLoadingId={reviewLoadingId}
                    />
                    <StatusCard
                        title="Rejected"
                        members={rejected}
                        icon="account-remove"
                        color="error"
                        shiftId={shift.id}
                        onReviewCandidate={onReviewCandidate}
                        getOfferForMember={getOfferForMember}
                        reviewLoadingId={reviewLoadingId}
                    />
                    <StatusCard
                        title="No Response"
                        members={noResponse}
                        icon="clock-outline"
                        color="warning"
                        shiftId={shift.id}
                        onReviewCandidate={onReviewCandidate}
                        getOfferForMember={getOfferForMember}
                        reviewLoadingId={reviewLoadingId}
                    />
                </View>
            ) : (
                <Text style={styles.emptyText}>
                    No candidates found for this level.
                </Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: customTheme.spacing.md,
        gap: customTheme.spacing.md,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: customTheme.spacing.sm,
        marginVertical: customTheme.spacing.sm,
    },
    divider: {
        flex: 1,
    },
    dividerChip: {
        backgroundColor: customTheme.colors.greyLight,
    },
    grid: {
        gap: customTheme.spacing.md,
    },
    emptyText: {
        textAlign: 'center',
        color: customTheme.colors.textMuted,
        paddingVertical: customTheme.spacing.xl,
        fontSize: 14,
    },
});
