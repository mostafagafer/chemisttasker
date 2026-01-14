import { useState, useCallback } from 'react';
import {
    fetchShiftCounterOffersService,
    rejectShiftCounterOfferService,
} from '@chemisttasker/shared-core';
import {
    getAccessToken,
    getRefreshToken,
    setTokens,
    clearTokens,
} from '../../../../../utils/tokenService';

export function useCounterOffers() {
    const [counterOffersByShift, setCounterOffersByShift] = useState<Record<number, any[]>>({});
    const [counterOffersLoadingByShift, setCounterOffersLoadingByShift] = useState<Record<number, boolean>>({});
    const [counterActionLoading, setCounterActionLoading] = useState<number | null>(null);

    const resolveOfferSlotId = useCallback((offer: any): number | null => {
        const offerSlots = offer?.slots || offer?.offer_slots || [];
        const slotIdFromSlots =
            offerSlots
                .map((s: any) => s.slot_id ?? s.slotId ?? s.slot?.id ?? null)
                .find((id: any) => id != null) ?? null;
        const fallback = offer?.slot_id ?? offer?.slotId ?? null;
        const resolved = slotIdFromSlots ?? fallback;
        return resolved != null ? Number(resolved) : null;
    }, []);

    const getAccessWithRefresh = useCallback(async () => {
        const baseURL = import.meta.env.VITE_API_URL as string;
        const existing = getAccessToken();
        if (existing) return existing;

        const refresh = getRefreshToken();
        if (!refresh) return null;

        try {
            const response = await fetch(`${baseURL}/users/token/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh }),
            });
            if (!response.ok) {
                throw new Error(`Refresh failed with status ${response.status}`);
            }
            const data = await response.json().catch(() => ({}));
            const nextAccess = data.access;
            const nextRefresh = data.refresh ?? refresh;
            if (nextAccess) {
                setTokens(nextAccess, nextRefresh);
                return nextAccess;
            }
        } catch (error) {
            console.error('Failed to refresh token for counter offer accept', error);
            clearTokens();
        }

        return null;
    }, []);

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
                const resolvedSlotId = payload.slotId ?? resolveOfferSlotId(payload.offer);
                const baseURL = import.meta.env.VITE_API_URL as string;
                const token = await getAccessWithRefresh();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }
                console.log('[ActiveShifts] acceptShiftCounterOfferService', {
                    shiftId: payload.shiftId,
                    offerId: payload.offer.id,
                    slotId: payload.slotId,
                    resolvedSlotId,
                });
                const query = resolvedSlotId != null ? `?slot_id=${encodeURIComponent(resolvedSlotId)}` : '';
                const response = await fetch(
                    `${baseURL}/client-profile/shifts/${payload.shiftId}/counter-offers/${payload.offer.id}/accept/${query}`,
                    {
                        method: 'POST',
                        headers,
                        body: resolvedSlotId != null ? JSON.stringify({ slot_id: resolvedSlotId }) : undefined,
                    }
                );
                if (!response.ok) {
                    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                    throw new Error(error.detail || `HTTP ${response.status}`);
                }
                if (onSuccess) onSuccess();
            } catch (error) {
                console.error('Failed to accept counter offer', error);
            } finally {
                setCounterActionLoading(null);
            }
        },
        [resolveOfferSlotId, getAccessWithRefresh]
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
