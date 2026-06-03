// PublicLevelView Component
// Displays public shift candidates with counter offers and interests

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Surface, Text, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { Shift, ShiftInterest } from '@chemisttasker/shared-core';
import { customTheme } from '../../theme';
import CounterOfferList from './CounterOfferList';
import SlotSelector from './SlotSelector';
import { getInterestDisplayName } from '../../utils/candidateHelpers';

interface PublicLevelViewProps {
    shift: Shift;
    slotId: number | null;
    slotHasUpdates?: Record<number, boolean>;
    interestsAll: any[];
    counterOffers: any[];
    counterOffersLoaded: boolean;
    onReveal: (shift: Shift, interest: ShiftInterest) => void;
    onReviewOffer: (shift: Shift, offer: any, slotId: number | null) => void;
    onSelectSlot?: (slotId: number) => void;
    revealingInterestId: number | null;
}

export default function PublicLevelView({
    shift,
    slotId,
    slotHasUpdates,
    interestsAll,
    counterOffers,
    counterOffersLoaded,
    onReveal,
    onReviewOffer,
    onSelectSlot,
    revealingInterestId,
}: PublicLevelViewProps) {
    const slots = (shift as any).slots || [];
    const multiSlots = !(shift as any).singleUserOnly && slots.length > 0;
    const offersList = counterOffersLoaded ? counterOffers : [];

    const getOfferSlotId = (offer: any): number | null => {
        const offerSlots = offer?.slots || offer?.offer_slots || [];
        const slotIdFromSlots =
            offerSlots
                .map((s: any) => s.slot_id ?? s.slotId ?? s.slot?.id ?? null)
                .find((id: any) => id != null) ?? null;
        const fallback = offer?.slotId ?? offer?.slot_id ?? null;
        return slotIdFromSlots ?? fallback ?? null;
    };

    const findInterestForOffer = (offer: any, offerSlotId: number | null) => {
        const offerUserId = typeof offer.user === 'object' ? offer.user?.id : offer.user;
        if (offerUserId == null) return null;
        return interestsAll.find((i: any) => {
            const iUserId = i.userId ?? i.user?.id ?? null;
            if (iUserId !== offerUserId) return false;
            if (offerSlotId == null) {
                return i.slotId == null;
            }
            return i.slotId === offerSlotId;
        }) || null;
    };

    // Filter interests based on slot
    const slotInterests = slotId
        ? interestsAll.filter(i => i.slotId === slotId || i.slotId == null)
        : interestsAll;

    // Filter counter offers based on slot
    const slotOffers = slotId
        ? counterOffers.filter(o => {
            const offerSlots = o.slots || o.offer_slots || [];
            return offerSlots.some((s: any) => (s.slot_id ?? s.slotId ?? s.slot?.id) === slotId);
        })
        : offersList;

    const offerUserIds = new Set(
        slotOffers
            .map(o => (typeof o.user === 'object' ? o.user?.id : o.user))
            .filter((id: any) => id != null)
    );

    const slotInterestsFiltered = slotInterests.filter(interest => {
        const iUserId = interest.userId ?? interest.user?.id ?? null;
        if (iUserId == null) return true;
        return !offerUserIds.has(iUserId);
    });

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Slot Selector for multi-slot shifts */}
            {multiSlots && onSelectSlot && (
                <SlotSelector
                    slots={slots}
                    selectedSlotId={slotId}
                    onSelectSlot={onSelectSlot}
                    slotHasUpdates={slotHasUpdates}
                />
            )}

            {/* Counter Offers Section */}
            <Surface style={styles.section} elevation={1}>
                <Text style={styles.sectionTitle}>
                    Counter Offers ({slotOffers.length})
                </Text>
                <Divider style={styles.divider} />
                {slotOffers.length > 0 ? (
                    <CounterOfferList
                        offers={slotOffers}
                        slotId={slotId}
                        onOpenOffer={(offer) => {
                            const offerSlotId = slotId ?? getOfferSlotId(offer);
                            onReviewOffer(shift, offer, offerSlotId);
                        }}
                        labelResolver={(offer: any) => {
                            const offerSlotId = slotId ?? getOfferSlotId(offer);
                            const interest = findInterestForOffer(offer, offerSlotId);
                            return interest && !interest.revealed ? 'Reveal offer' : 'Review offer';
                        }}
                        titleResolver={(offer: any) => {
                            const offerSlotId = slotId ?? getOfferSlotId(offer);
                            const interest = findInterestForOffer(offer, offerSlotId);

                            if (interest && interest.revealed) {
                                // Try to get name from interest.user object
                                if (interest.user) {
                                    const userObj = typeof interest.user === 'object' ? interest.user : null;
                                    if (userObj) {
                                        const name =
                                            (userObj.firstName && userObj.lastName)
                                                ? `${userObj.firstName} ${userObj.lastName}`
                                                : (userObj.first_name && userObj.last_name)
                                                    ? `${userObj.first_name} ${userObj.last_name}`
                                                    : userObj.name || userObj.displayName || userObj.display_name;
                                        if (name) return name;
                                    }
                                    // If it's a string, use it directly
                                    if (typeof userObj === 'string') return userObj;
                                }
                                // Fallback to displayName from interest itself
                                const displayName = (interest as any).displayName || interest.userName;
                                if (displayName) return displayName;
                            }
                            return 'Someone sent a counter offer';
                        }}
                    />
                ) : (
                    <Text style={styles.emptyText}>No counter offers yet.</Text>
                )}
            </Surface>

            {/* Simple Interests Section */}
            <Surface style={styles.section} elevation={1}>
                <Text style={styles.sectionTitle}>
                    Interests ({slotInterestsFiltered.length})
                </Text>
                <Divider style={styles.divider} />
                {slotInterestsFiltered.length > 0 ? (
                    <View style={styles.interestsList}>
                        {slotInterestsFiltered.map(interest => {
                            const isRevealing = revealingInterestId === interest.id;
                            return (
                                <Surface key={interest.id} style={styles.interestCard} elevation={1}>
                                    <View style={styles.interestRow}>
                                        <Text style={styles.interestName}>
                                            {interest.revealed
                                                ? getInterestDisplayName(interest, interest.user)
                                                : 'Anonymous Interest User'}
                                        </Text>
                                        <Button
                                            mode={interest.revealed ? 'outlined' : 'contained'}
                                            compact
                                            onPress={() => onReveal(shift, interest)}
                                            disabled={isRevealing}
                                            loading={isRevealing}
                                            style={styles.interestButton}
                                        >
                                            {interest.revealed ? 'Review' : 'Reveal'}
                                        </Button>
                                    </View>
                                </Surface>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={styles.emptyText}>No interests yet.</Text>
                )}
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: customTheme.spacing.md,
        gap: customTheme.spacing.md,
    },
    section: {
        padding: customTheme.spacing.md,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: customTheme.colors.text,
        marginBottom: customTheme.spacing.xs,
    },
    divider: {
        marginBottom: customTheme.spacing.sm,
    },
    emptyText: {
        textAlign: 'center',
        color: customTheme.colors.textMuted,
        paddingVertical: customTheme.spacing.md,
        fontSize: 13,
    },
    interestsList: {
        gap: customTheme.spacing.sm,
    },
    interestCard: {
        padding: customTheme.spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: customTheme.colors.border,
        backgroundColor: '#fff',
    },
    interestRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: customTheme.spacing.sm,
    },
    interestName: {
        fontSize: 14,
        color: customTheme.colors.text,
        flex: 1,
        flexShrink: 1,
    },
    interestButton: {
        alignSelf: 'flex-start',
    },
});
