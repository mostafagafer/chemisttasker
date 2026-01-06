import { useState, useEffect, useCallback } from 'react';
import { Shift, fetchActiveShifts } from '@chemisttasker/shared-core';

interface UseShiftsDataParams {
    selectedPharmacyId: number | null;
}

export function useShiftsData({ selectedPharmacyId: _selectedPharmacyId }: UseShiftsDataParams) {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);

    const loadShifts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchActiveShifts();
            setShifts(data || []);
        } catch (error) {
            console.error('Failed to load active shifts', error);
            setShifts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadShifts();
    }, [loadShifts]);

    return {
        shifts,
        setShifts,
        loading,
        loadShifts,
    };
}
