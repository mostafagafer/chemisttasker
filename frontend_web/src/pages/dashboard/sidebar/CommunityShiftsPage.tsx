import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import ShiftsBoard from '../../../components/shifts/ShiftsBoard';
import {
  Shift,
  ShiftCounterOfferPayload,
  ShiftInterest,
  expressInterestInCommunityShiftService,
  fetchCommunityShifts,
  fetchShiftInterests,
  fetchShiftRejections,
  rejectCommunityShiftService,
  submitShiftCounterOfferService,
} from '@chemisttasker/shared-core';

export default function CommunityShiftsPage() {
  const auth = useAuth();
  if (!auth?.user) return null;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedShiftIds, setAppliedShiftIds] = useState<number[]>([]);
  const [appliedSlotIds, setAppliedSlotIds] = useState<number[]>([]);
  const [rejectedShiftIds, setRejectedShiftIds] = useState<number[]>([]);
  const [rejectedSlotIds, setRejectedSlotIds] = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [communityShifts, interests, rejections] = await Promise.all([
          fetchCommunityShifts({}),
          fetchShiftInterests({ userId: auth.user.id }),
          fetchShiftRejections({ userId: auth.user.id }),
        ]);

        const available = communityShifts.filter((shift: Shift) => {
          const slots = shift.slots ?? [];
          if (slots.length === 0) return true;
          const assignedSlotCount = shift.slotAssignments?.length ?? 0;
          return assignedSlotCount < slots.length;
        });

        setShifts(available);

        const nextShiftIds = new Set<number>();
        const nextSlotIds = new Set<number>();
        interests.forEach((interest: ShiftInterest) => {
          if (interest.slotId != null) {
            nextSlotIds.add(interest.slotId);
          } else if (typeof interest.shift === 'number') {
            nextShiftIds.add(interest.shift);
          }
        });
        setAppliedShiftIds(Array.from(nextShiftIds));
        setAppliedSlotIds(Array.from(nextSlotIds));

        const nextRejectedShiftIds = new Set<number>();
        const nextRejectedSlotIds = new Set<number>();
        (rejections || []).forEach((rejection: any) => {
          if (rejection.slotId != null) {
            nextRejectedSlotIds.add(rejection.slotId);
          } else if (typeof rejection.shift === 'number') {
            nextRejectedShiftIds.add(rejection.shift);
          }
        });
        setRejectedShiftIds(Array.from(nextRejectedShiftIds));
        setRejectedSlotIds(Array.from(nextRejectedSlotIds));
      } catch (err) {
        console.error('Failed to load community shifts', err);
        setError('Failed to load community shifts.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.user.id]);

  const handleApplyAll = async (shift: Shift) => {
    try {
      if (shift.singleUserOnly) {
        await expressInterestInCommunityShiftService({ shiftId: shift.id, slotId: null });
        setAppliedShiftIds((prev) => Array.from(new Set([...prev, shift.id])));
        return;
      }

      const slots = shift.slots ?? [];
      await Promise.all(
        slots.map((slot) => expressInterestInCommunityShiftService({ shiftId: shift.id, slotId: slot.id }))
      );
      setAppliedSlotIds((prev) => Array.from(new Set([...prev, ...slots.map((slot) => slot.id)])));
    } catch (err) {
      console.error('Failed to express interest', err);
      setError('Failed to express interest in this shift.');
      throw err;
    }
  };

  const handleApplySlot = async (shift: Shift, slotId: number) => {
    try {
      await expressInterestInCommunityShiftService({ shiftId: shift.id, slotId });
      setAppliedSlotIds((prev) => Array.from(new Set([...prev, slotId])));
    } catch (err) {
      console.error('Failed to express interest in slot', err);
      setError('Failed to express interest in this slot.');
      throw err;
    }
  };

  const handleRejectShift = async (shift: Shift) => {
    try {
      if (shift.singleUserOnly) {
        await rejectCommunityShiftService({ shiftId: shift.id, slotId: null });
      } else {
        const slots = shift.slots ?? [];
        await Promise.all(
          slots.map((slot) => rejectCommunityShiftService({ shiftId: shift.id, slotId: slot.id }))
        );
      }
    } catch (err) {
      console.error('Failed to reject shift', err);
      setError('Failed to reject this shift.');
      throw err;
    }
  };

  const handleRejectSlot = async (shift: Shift, slotId: number) => {
    try {
      await rejectCommunityShiftService({ shiftId: shift.id, slotId });
    } catch (err) {
      console.error('Failed to reject slot', err);
      setError('Failed to reject this slot.');
      throw err;
    }
  };

  const handleSubmitCounterOffer = async (payload: ShiftCounterOfferPayload) => {
    try {
      await submitShiftCounterOfferService(payload);
    } catch (err) {
      console.error('Failed to submit counter offer', err);
      setError('Failed to submit counter offer.');
      throw err;
    }
  };

  return (
    <>
      {error && (
        <Typography color="error" sx={{ px: { xs: 2, lg: 3 }, py: 1 }}>
          {error}
        </Typography>
      )}
      <ShiftsBoard
        title="Community Shifts"
        shifts={shifts}
        loading={loading}
        onApplyAll={handleApplyAll}
        onApplySlot={handleApplySlot}
        onSubmitCounterOffer={handleSubmitCounterOffer}
        initialAppliedShiftIds={appliedShiftIds}
        initialAppliedSlotIds={appliedSlotIds}
        onRejectShift={handleRejectShift}
        onRejectSlot={handleRejectSlot}
        initialRejectedShiftIds={rejectedShiftIds}
        initialRejectedSlotIds={rejectedSlotIds}
      />
    </>
  );
}
