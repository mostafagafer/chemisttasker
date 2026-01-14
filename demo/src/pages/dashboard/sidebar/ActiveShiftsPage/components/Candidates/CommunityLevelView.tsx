import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
    CheckCircle as Check,
    PersonAdd as UserCheck,
    PersonRemove as UserX,
    HourglassEmpty as Clock,
} from '@mui/icons-material';
import { Shift, ShiftMemberStatus } from '@chemisttasker/shared-core';
import { StatusCard } from './StatusCard';
import { SlotSelector } from './SlotSelector';
import { dedupeMembers, findOfferForMemberInShift } from '../../utils/candidateHelpers';

interface CommunityLevelViewProps {
    shift: Shift;
    members: ShiftMemberStatus[];
    selectedSlotId: number | null;
    offers: any[];
    onSelectSlot: (slotId: number) => void;
    onReviewCandidate: (member: ShiftMemberStatus, shiftId: number, offer: any | null, slotId: number | null) => void;
    reviewLoadingId?: number | null;
}

export const CommunityLevelView: React.FC<CommunityLevelViewProps> = ({
    shift,
    members,
    selectedSlotId,
    offers,
    onSelectSlot,
    onReviewCandidate,
    reviewLoadingId,
}) => {
    const slots = (shift as any).slots || [];
    const multiSlots = !(shift as any).singleUserOnly && slots.length > 0;

    // Filter members by slot if multi-slot; include shift-level members with no slotId
    const slotMembersRaw = multiSlots
        ? members.filter((m) => (m as any).slotId === selectedSlotId || (m as any).slotId == null)
        : members;
    const slotMembers = dedupeMembers(slotMembersRaw);

    // Categorize members by status
    const interested = slotMembers.filter((m) => m.status === 'interested');
    const assigned = slotMembers.filter((m) => m.status === 'accepted');
    const rejected = slotMembers.filter((m) => m.status === 'rejected');
    const noResponse = slotMembers.filter((m) => m.status === 'no_response');

    const hasMembers = slotMembers.length > 0;

    const getOfferForMember = (member: ShiftMemberStatus) => {
        const offer = findOfferForMemberInShift(offers, member, selectedSlotId);
        // If multi-slot, lock to the selected slot; otherwise use null
        return { offer, slotId: multiSlots ? selectedSlotId : null };
    };

    return (
        <Stack spacing={4}>
            {/* Slot Selector for multi-slot shifts */}
            {multiSlots && (
                <SlotSelector
                    slots={slots}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={onSelectSlot}
                />
            )}

            {/* Member Status Boxes Grid */}
            {hasMembers ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
                    {interested.length > 0 && (
                        <StatusCard
                            title="Interested"
                            members={interested}
                            icon={<UserCheck />}
                            color="success"
                            shiftId={shift.id}
                            onReviewCandidate={onReviewCandidate}
                            getOfferForMember={getOfferForMember}
                            reviewLoadingId={reviewLoadingId}
                        />
                    )}
                    {assigned.length > 0 && (
                        <StatusCard
                            title="Assigned"
                            members={assigned}
                            icon={<Check />}
                            color="info"
                            shiftId={shift.id}
                            onReviewCandidate={onReviewCandidate}
                            getOfferForMember={getOfferForMember}
                            reviewLoadingId={reviewLoadingId}
                        />
                    )}
                    {rejected.length > 0 && (
                        <StatusCard
                            title="Rejected"
                            members={rejected}
                            icon={<UserX />}
                            color="error"
                            shiftId={shift.id}
                            onReviewCandidate={onReviewCandidate}
                            getOfferForMember={getOfferForMember}
                            reviewLoadingId={reviewLoadingId}
                        />
                    )}
                    {noResponse.length > 0 && (
                        <StatusCard
                            title="No Response"
                            members={noResponse}
                            icon={<Clock />}
                            color="warning"
                            shiftId={shift.id}
                            onReviewCandidate={onReviewCandidate}
                            getOfferForMember={getOfferForMember}
                            reviewLoadingId={reviewLoadingId}
                        />
                    )}
                </Box>
            ) : (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center', fontStyle: 'italic' }}>
                    No candidates found for this level.
                </Typography>
            )}
        </Stack>
    );
};
