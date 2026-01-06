import { useState, useCallback, useEffect } from 'react';
import {
    Shift,
    ShiftMemberStatus,
    EscalationLevelKey,
    fetchShiftInterests,
    fetchShiftMemberStatus,
} from '@chemisttasker/shared-core';
import { TabDataState } from '../types';

const PUBLIC_LEVEL_KEY = 'public';
const COMMUNITY_LEVEL_KEY = 'community';

export function useTabData(
    shifts: Shift[],
    selectedLevelByShift: Record<number, EscalationLevelKey>,
    getTabKey: (shiftId: number, levelKey: EscalationLevelKey) => string
) {
    const [tabData, setTabData] = useState<Record<string, TabDataState>>({});

    const loadTabDataForShift = useCallback(
        async (shift: Shift, levelKey: EscalationLevelKey) => {
            const key = getTabKey(shift.id, levelKey);
            setTabData(prev => ({ ...prev, [key]: { loading: true } }));

            try {
                if (levelKey === PUBLIC_LEVEL_KEY) {
                    const interests = await fetchShiftInterests(shift.id);
                    const interestsBySlot: Record<number, any[]> = {};
                    (shift.slots || []).forEach(slot => {
                        interestsBySlot[slot.id] = interests.filter((i: any) => i.slotId === slot.id || i.slotId == null);
                    });

                    setTabData(prev => ({
                        ...prev,
                        [key]: {
                            loading: false,
                            interestsAll: interests,
                            interestsBySlot,
                        },
                    }));
                } else if (levelKey === COMMUNITY_LEVEL_KEY) {
                    const members = await fetchShiftMemberStatus(shift.id, {});
                    const membersBySlot: Record<number, ShiftMemberStatus[]> = {};
                    (shift.slots || []).forEach(slot => {
                        membersBySlot[slot.id] = members.filter((m: any) => m.slotId === slot.id || m.slotId == null);
                    });

                    setTabData(prev => ({
                        ...prev,
                        [key]: {
                            loading: false,
                            members,
                            membersBySlot,
                        },
                    }));
                }
            } catch (error) {
                console.error('Failed to load tab data', error);
                setTabData(prev => ({ ...prev, [key]: { loading: false } }));
            }
        },
        [getTabKey]
    );

    useEffect(() => {
        shifts.forEach(shift => {
            const levelKey = selectedLevelByShift[shift.id] || PUBLIC_LEVEL_KEY;
            loadTabDataForShift(shift, levelKey);
        });
    }, [shifts, selectedLevelByShift, loadTabDataForShift]);

    return { tabData, setTabData, loadTabDataForShift };
}
