import React from 'react';
import { Box, Typography, Button, Stack, Avatar } from '@mui/material';
import { RequestQuote } from '@mui/icons-material';

interface CounterOfferListProps {
    offers: any[];
    slotId: number | null;
    onOpenOffer?: (offer: any) => void;
    labelResolver?: (offer: any) => string;
    titleResolver?: (offer: any) => string;
}

export const CounterOfferList: React.FC<CounterOfferListProps> = ({
    offers,
    slotId,
    onOpenOffer,
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
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center', fontStyle: 'italic' }}>
                No counter offers yet.
            </Typography>
        );
    }

    return (
        <Stack spacing={0} sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {filteredOffers.map((offer, index) => {
                const label = labelResolver ? labelResolver(offer) : 'Review offer';
                const title = titleResolver ? titleResolver(offer) : 'Counter Offer';
                const isRevealLabel = label.toLowerCase().includes('reveal');

                return (
                    <Box
                        key={offer.id}
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 2,
                            bgcolor: 'background.paper',
                            borderBottom: index < filteredOffers.length - 1 ? '1px solid' : 'none',
                            borderColor: 'divider',
                            transition: 'background-color 0.2s',
                            '&:hover': { bgcolor: 'action.hover' }
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'info.soft', color: 'info.main' }}>
                                <RequestQuote fontSize="small" />
                            </Avatar>
                            <Box>
                                <Typography variant="body2" fontWeight={600}>{title}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Counter Offer
                                </Typography>
                            </Box>
                        </Stack>

                        <Button
                            size="small"
                            variant={isRevealLabel ? 'contained' : 'outlined'}
                            color={isRevealLabel ? 'primary' : 'info'}
                            onClick={() => onOpenOffer && onOpenOffer(offer)}
                            sx={{ borderRadius: 20 }}
                        >
                            {label}
                        </Button>
                    </Box>
                );
            })}
        </Stack>
    );
};
