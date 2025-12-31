import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, Snackbar, Alert } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Shift,
  expressInterestInShiftService,
  submitShiftCounterOfferService,
  fetchShiftInterests,
  fetchShiftRejections,
  fetchWorkerShiftDetailService,
  rejectShiftService,
} from '@chemisttasker/shared-core';
import ShiftsBoard from '../../../components/shifts/ShiftsBoard';

const getErrorMessage = (error: unknown, fallback: string) => {
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const WorkerShiftDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appliedShiftIds, setAppliedShiftIds] = useState<number[]>([]);
  const [appliedSlotIds, setAppliedSlotIds] = useState<number[]>([]);
  const [rejectedShiftIds, setRejectedShiftIds] = useState<number[]>([]);
  const [rejectedSlotIds, setRejectedSlotIds] = useState<number[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string | null; severity?: 'success' | 'error' }>({
    open: false,
    message: null,
    severity: 'success',
  });

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }
    const shiftId = Number(id);
    if (!Number.isFinite(shiftId)) {
      setError('Invalid shift identifier.');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [detail, interests, rejections] = await Promise.all([
          fetchWorkerShiftDetailService(shiftId),
          fetchShiftInterests({ userId: user.id }),
          fetchShiftRejections({ userId: user.id }),
        ]);

        setShift(detail);
        setAppliedSlotIds(
          interests.map((i: any) => i.slotId).filter((slotId: unknown): slotId is number => typeof slotId === 'number')
        );
        setAppliedShiftIds(
          interests.filter((i: any) => i.slotId == null).map((i: any) => i.shift)
        );
        setRejectedSlotIds(
          rejections.map((r: any) => r.slotId).filter((slotId: unknown): slotId is number => typeof slotId === 'number')
        );
        setRejectedShiftIds(
          rejections.filter((r: any) => r.slotId == null).map((r: any) => r.shift)
        );
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load shift details. It may not exist or is no longer available.'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, user]);

  const handleApplyAll = async (targetShift: Shift) => {
    try {
      const shiftSlots = targetShift.slots ?? [];
      if (targetShift.singleUserOnly || shiftSlots.length === 0) {
        await expressInterestInShiftService({ shiftId: targetShift.id, slotId: null });
        setAppliedShiftIds((prev) => Array.from(new Set([...prev, targetShift.id])));
        return;
      }
      await Promise.all(
        shiftSlots.map((slot) => expressInterestInShiftService({ shiftId: targetShift.id, slotId: slot.id }))
      );
      setAppliedSlotIds((prev) => Array.from(new Set([...prev, ...shiftSlots.map((s) => s.id)])));
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to express interest.'), severity: 'error' });
      throw err;
    }
  };

  const handleApplySlot = async (targetShift: Shift, slotId: number) => {
    try {
      await expressInterestInShiftService({ shiftId: targetShift.id, slotId });
      setAppliedSlotIds((prev) => Array.from(new Set([...prev, slotId])));
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to express interest.'), severity: 'error' });
      throw err;
    }
  };

  const handleRejectShift = async (targetShift: Shift) => {
    try {
      await rejectShiftService({ shiftId: targetShift.id, slotId: null });
      setRejectedShiftIds((prev) => Array.from(new Set([...prev, targetShift.id])));
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to reject shift.'), severity: 'error' });
      throw err;
    }
  };

  const handleRejectSlot = async (targetShift: Shift, slotId: number) => {
    try {
      await rejectShiftService({ shiftId: targetShift.id, slotId });
      setRejectedSlotIds((prev) => Array.from(new Set([...prev, slotId])));
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to reject slot.'), severity: 'error' });
      throw err;
    }
  };

  const handleSubmitCounterOffer = async (payload: any) => {
    try {
      await submitShiftCounterOfferService(payload);
    } catch (err) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to submit counter offer.'), severity: 'error' });
      throw err;
    }
  };

  if (error) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="error">{error}</Typography>
        <Typography variant="body2" sx={{ mt: 2, cursor: 'pointer' }} onClick={() => navigate(-1)}>
          Go Back
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 3 }}>
      <ShiftsBoard
        title="Shift Details"
        shifts={shift ? [shift] : []}
        loading={loading}
        onApplyAll={handleApplyAll}
        onApplySlot={handleApplySlot}
        onSubmitCounterOffer={handleSubmitCounterOffer}
        onRejectShift={handleRejectShift}
        onRejectSlot={handleRejectSlot}
        initialAppliedShiftIds={appliedShiftIds}
        initialAppliedSlotIds={appliedSlotIds}
        initialRejectedShiftIds={rejectedShiftIds}
        initialRejectedSlotIds={rejectedSlotIds}
        enableSaved={false}
        hideSaveToggle
        hideFiltersAndSort
        hideTabs
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity ?? 'success'} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default WorkerShiftDetailPage;
