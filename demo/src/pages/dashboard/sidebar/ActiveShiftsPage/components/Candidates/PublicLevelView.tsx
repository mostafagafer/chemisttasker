import React from 'react';
import { Box, Typography, Button, CircularProgress, Stack, Avatar } from '@mui/material';
import { Person } from '@mui/icons-material';
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
        <Stack spacing={4}>
            {/* Slot Selector for multi-slot shifts */}
            {multiSlots && onSelectSlot && (
                <SlotSelector
                    slots={slots}
                    selectedSlotId={slotId}
                    onSelectSlot={onSelectSlot}
                />
            )}

            {/* Counter Offers Section */}
            <Box>
                <Typography variant="overline" color="text.secondary" fontWeight="bold" gutterBottom>
                    Counter Offers ({slotOffers.length})
                </Typography>

                <Box sx={{ mt: 1 }}>
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
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No counter offers yet.
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Simple Interests Section */}
            <Box>
                <Typography variant="overline" color="text.secondary" fontWeight="bold" gutterBottom>
                    Interests ({slotInterestsFiltered.length})
                </Typography>
                <Box sx={{ mt: 1 }}>
                    {slotInterestsFiltered.length > 0 ? (
                        <Stack spacing={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                            {slotInterestsFiltered.map((interest, index) => {
                                const name = interest.revealed ? getInterestDisplayName(interest, interest.user) : 'Anonymous User';
                                return (
                                    <Box
                                        key={interest.id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 2,
                                            bgcolor: 'background.paper',
                                            borderBottom: index < slotInterestsFiltered.length - 1 ? '1px solid' : 'none',
                                            borderColor: 'divider',
                                            transition: 'background-color 0.2s',
                                            '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                    >
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Avatar sx={{ width: 32, height: 32, bgcolor: interest.revealed ? 'primary.light' : 'grey.300', fontSize: '0.8rem' }}>
                                                {interest.revealed ? (name[0] || '?') : <Person fontSize="small" />}
                                            </Avatar>
                                            <Typography variant="body2" fontWeight={500}>
                                                {name}
                                            </Typography>
                                        </Stack>
                                        <Button
                                            size="small"
                                            variant={interest.revealed ? 'outlined' : 'contained'}
                                            color="primary"
                                            onClick={() => onReveal(shift, interest)}
                                            disabled={revealingInterestId === interest.id}
                                            startIcon={
                                                revealingInterestId === interest.id ? (
                                                    <CircularProgress size={16} color="inherit" />
                                                ) : undefined
                                            }
                                            sx={{ borderRadius: 20 }}
                                        >
                                            {interest.revealed ? 'Review' : 'Reveal'}
                                        </Button>
                                    </Box>
                                );
                            })}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No interests yet.
                        </Typography>
                    )}
                </Box>
            </Box>
        </Stack>
    );
};
