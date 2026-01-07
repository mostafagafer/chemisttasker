import React from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Stack } from '@mui/material';
import { Shift, ShiftInterest } from '@chemisttasker/shared-core';
import { CounterOfferList } from './CounterOfferList';
import { SlotSelector } from './SlotSelector';
import { getInterestDisplayName } from '../../utils/candidateHelpers';

interface PublicLevelViewProps {
    shift: Shift;
    slotId: number | null;
    interestsAll: any[];
    counterOffers: any[];
    counterOffersLoaded: boolean;
    onReveal: (shift: Shift, interest: ShiftInterest) => void;
    onReviewOffer: (shift: Shift, offer: any, slotId: number | null) => void;
    onSelectSlot?: (slotId: number) => void;
    revealingInterestId: number | null;
}

export const PublicLevelView: React.FC<PublicLevelViewProps> = ({
    shift,
    slotId,
    interestsAll,
    counterOffers,
    counterOffersLoaded,
    onReveal,
    onReviewOffer,
    onSelectSlot,
    revealingInterestId,
}) => {
    const slots = (shift as any).slots || [];
    const multiSlots = !(shift as any).singleUserOnly && slots.length > 0;
    const offersList = counterOffersLoaded ? counterOffers : [];

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
        <Stack spacing={2}>
            {/* Slot Selector for multi-slot shifts */}
            {multiSlots && onSelectSlot && (
                <SlotSelector
                    slots={slots}
                    selectedSlotId={slotId}
                    onSelectSlot={onSelectSlot}
                />
            )}
            {/* Counter Offers Section */}
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Counter Offers ({slotOffers.length})
                </Typography>
                {slotOffers.length > 0 ? (
                    <CounterOfferList
                        offers={slotOffers}
                        slotId={slotId}
                        onOpenOffer={(offer) => onReviewOffer(shift, offer, slotId)}
                        labelResolver={(offer: any) => {
                            // Find interest for this offer to check reveal status
                            const interest = interestsAll.find((i: any) => {
                                const iUserId = i.userId ?? i.user?.id ?? null;
                                const offerUserId = typeof offer.user === 'object' ? offer.user?.id : offer.user;
                                return iUserId === offerUserId;
                            });
                            return interest && !interest.revealed ? 'Reveal offer' : 'Review offer';
                        }}
                        titleResolver={(offer: any) => {
                            // Find the interest that has user info
                            const interest = interestsAll.find((i: any) => {
                                const iUserId = i.userId ?? i.user?.id ?? null;
                                const offerUserId = typeof offer.user === 'object' ? offer.user?.id : offer.user;
                                return iUserId === offerUserId;
                            });

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
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        No counter offers yet.
                    </Typography>
                )}
            </Paper>

            {/* Simple Interests Section */}
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                    Interests ({slotInterestsFiltered.length})
                </Typography>
                {slotInterestsFiltered.length > 0 ? (
                    <Stack spacing={1}>
                        {slotInterestsFiltered.map(interest => {
                            return (
                                <Box
                                    key={interest.id}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        p: 1.5,
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <Typography variant="body2">
                                        {interest.revealed
                                            ? getInterestDisplayName(interest, interest.user)
                                            : 'Anonymous Interest User'}
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant={interest.revealed ? 'outlined' : 'contained'}
                                        onClick={() => onReveal(shift, interest)}
                                        disabled={revealingInterestId === interest.id}
                                        startIcon={
                                            revealingInterestId === interest.id ? (
                                                <CircularProgress size={16} color="inherit" />
                                            ) : undefined
                                        }
                                    >
                                        {interest.revealed ? 'Review' : 'Reveal'}
                                    </Button>
                                </Box>
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        No interests yet.
                    </Typography>
                )}
            </Paper>
        </Stack>
    );
};
