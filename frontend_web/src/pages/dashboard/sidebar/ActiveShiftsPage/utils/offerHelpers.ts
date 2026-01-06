import { Shift } from '@chemisttasker/shared-core';

export function mapOfferSlotsWithShift(offer: any, shift: Shift, _filterSlotId: number | null) {
    const offerSlots = offer.slots || offer.offer_slots || [];
    const shiftSlots = shift.slots || [];

    if (!shift.singleUserOnly && shiftSlots.length > 0) {
        return offerSlots.map((os: any) => {
            const matchedSlot = shiftSlots.find((ss: any) => ss.id === (os.slot_id ?? os.slotId ?? os.slot?.id));
            const matchedSlotAny = matchedSlot as any;
            const shiftAny = shift as any;
            return {
                slotId: os.slot_id ?? os.slotId ?? os.slot?.id,
                date: matchedSlotAny?.date || os.slot?.date || shiftAny.date,
                proposedStart: os.proposed_start_time || os.proposedStartTime,
                proposedEnd: os.proposed_end_time || os.proposedEndTime,
                proposedRate: os.proposed_rate ?? os.proposedRate,
            };
        });
    }

    return [{
        slotId: null,
        date: (shift as any).date,
        proposedStart: offer.proposedStartTime ?? offer.proposed_start_time,
        proposedEnd: offer.proposedEndTime ?? offer.proposed_end_time,
        proposedRate: offer.proposedRate ?? offer.proposed_rate,
    }];
}

export function findOfferForMemberInShift(offers: any[], member: any, slotId: number | null): any | null {
    return offers.find(o => {
        const offerUserId = typeof o.user === 'object' ? o.user?.id : o.user;
        const memberUserId = member.userId ?? member.user?.id;
        if (offerUserId !== memberUserId) return false;
        if (slotId == null) return true;
        const offerSlots = o.slots || o.offer_slots || [];
        return offerSlots.some((s: any) => (s.slot_id ?? s.slotId ?? s.slot?.id) === slotId);
    });
}

export function filterOffersBySlot(offers: any[], slotId: number | null): any[] {
    if (slotId == null) return offers;
    return offers.filter(o => {
        const offerSlots = o.slots || o.offer_slots || [];
        return offerSlots.some((s: any) => (s.slot_id ?? s.slotId ?? s.slot?.id) === slotId);
    });
}
