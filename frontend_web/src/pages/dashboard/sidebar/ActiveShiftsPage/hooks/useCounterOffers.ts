import { useState, useCallback } from 'react';
import {
    fetchShiftCounterOffersService,
    acceptShiftCounterOfferService,
    rejectShiftCounterOfferService,
} from '@chemisttasker/shared-core';

export function useCounterOffers() {
    const [counterOffersByShift, setCounterOffersByShift] = useState<Record<number, any[]>>({});
    const [counterOffersLoadingByShift, setCounterOffersLoadingByShift] = useState<Record<number, boolean>>({});
    const [counterActionLoading, setCounterActionLoading] = useState<number | null>(null);

    const loadCounterOffers = useCallback(async (shiftId: number) => {
        setCounterOffersLoadingByShift(prev => ({ ...prev, [shiftId]: true }));
        try {
            const offers = await fetchShiftCounterOffersService(shiftId);
            setCounterOffersByShift(prev => ({ ...prev, [shiftId]: offers }));
        } catch (error) {
            console.error('Failed to load counter offers', error);
            setCounterOffersByShift(prev => ({ ...prev, [shiftId]: [] }));
        } finally {
            setCounterOffersLoadingByShift(prev => ({ ...prev, [shiftId]: false }));
        }
    }, []);

    const acceptOffer = useCallback(
        async (payload: { offer: any; shiftId: number; slotId: number | null }, onSuccess?: () => void) => {
            setCounterActionLoading(payload.offer.id);
            try {
                await acceptShiftCounterOfferService({
                    shiftId: payload.shiftId,
                    offerId: payload.offer.id,
                    slotId: payload.slotId ?? undefined,
                });
                if (onSuccess) onSuccess();
            } catch (error) {
                console.error('Failed to accept counter offer', error);
            } finally {
                setCounterActionLoading(null);
            }
        },
        []
    );

    const rejectOffer = useCallback(
        async (payload: { offer: any; shiftId: number }, onSuccess?: () => void) => {
            setCounterActionLoading(payload.offer.id);
            try {
                await rejectShiftCounterOfferService({
                    shiftId: payload.shiftId,
                    offerId: payload.offer.id,
                });
                if (onSuccess) onSuccess();
            } catch (error) {
                console.error('Failed to reject counter offer', error);
            } finally {
                setCounterActionLoading(null);
            }
        },
        []
    );

    const updateOfferCache = useCallback((shiftId: number, offerId: number, userDetail: any) => {
        setCounterOffersByShift(prev => {
            const existing = prev[shiftId] || [];
            const updated = existing.map((o: any) =>
                o.id === offerId ? { ...o, userDetail: userDetail, user_detail: userDetail } : o
            );
            return { ...prev, [shiftId]: updated };
        });
    }, []);

    return {
        counterOffersByShift,
        counterOffersLoadingByShift,
        loadCounterOffers,
        acceptOffer,
        rejectOffer,
        counterActionLoading,
        updateOfferCache,
    };
}
