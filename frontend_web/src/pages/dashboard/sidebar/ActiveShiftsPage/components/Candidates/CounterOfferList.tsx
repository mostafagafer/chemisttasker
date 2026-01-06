import React from 'react';
import { Box, Typography, Button, Stack, Chip } from '@mui/material';

interface CounterOfferListProps {
    offers: any[];
    slotId: number | null;
    onOpenOffer?: (offer: any) => void;
    onRevealOffer?: (offer: any) => void;
    revealingOfferId?: number | null;
    labelResolver?: (offer: any) => string;
    titleResolver?: (offer: any) => string;
}

export const CounterOfferList: React.FC<CounterOfferListProps> = ({
    offers,
    slotId,
    onOpenOffer,
    onRevealOffer,
    revealingOfferId,
    labelResolver,
    titleResolver,
}) => {
    const filteredOffers = slotId
        ? offers.filter(o => {
            const offerSlots = o.slots || o.offer_slots || [];
            return offerSlots.some((s: any) => (s.slot_id ?? s.slotId ?? s.slot?.id) === slotId);
        })
        : offers;

    if (filteredOffers.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No counter offers yet.
            </Typography>
        );
    }

    return (
        <Stack spacing={1} sx={{ mt: 1 }}>
            {filteredOffers.map(offer => {
                const label = labelResolver ? labelResolver(offer) : 'Review offer';
                const title = titleResolver ? titleResolver(offer) : 'Counter Offer';
                const isRevealing = revealingOfferId === offer.id;

                return (
                    <Box
                        key={offer.id}
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
                        <Box>
                            <Typography variant="body2">{title}</Typography>
                            {offer.message && (
                                <Typography variant="caption" color="text.secondary">
                                    {offer.message.length > 50
                                        ? offer.message.slice(0, 50) + '...'
                                        : offer.message}
                                </Typography>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {offer.requestTravel && <Chip label="Travel" size="small" color="info" />}
                            {onRevealOffer && label.toLowerCase().includes('reveal') ? (
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => onRevealOffer(offer)}
                                    disabled={isRevealing}
                                >
                                    {isRevealing ? 'Revealing...' : label}
                                </Button>
                            ) : (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => onOpenOffer && onOpenOffer(offer)}
                                >
                                    {label}
                                </Button>
                            )}
                        </Box>
                    </Box>
                );
            })}
        </Stack>
    );
};
