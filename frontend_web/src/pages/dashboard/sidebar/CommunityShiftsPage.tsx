import { useCallback, useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import ShiftsBoard from '../../../components/shifts/ShiftsBoard';
import {
  Shift,
  ShiftCounterOfferPayload,
  ShiftInterest,
  PaginatedResponse,
  deleteSavedShift,
  expressInterestInCommunityShiftService,
  fetchCommunityShifts,
  fetchSavedShifts,
  fetchShiftInterests,
  fetchShiftRejections,
  rejectCommunityShiftService,
  saveShift,
  submitShiftCounterOfferService,
} from '@chemisttasker/shared-core';

type FilterConfig = {
  city: string[];
  roles: string[];
  employmentTypes: string[];
  minRate: number;
  search: string;
  timeOfDay: Array<'morning' | 'afternoon' | 'evening'>;
  dateRange: { start: string; end: string };
  onlyUrgent: boolean;
  negotiableOnly: boolean;
  flexibleOnly: boolean;
  travelProvided: boolean;
  accommodationProvided: boolean;
  bulkShiftsOnly: boolean;
};

const DEFAULT_FILTERS: FilterConfig = {
  city: [],
  roles: [],
  employmentTypes: [],
  minRate: 0,
  search: '',
  timeOfDay: [],
  dateRange: { start: '', end: '' },
  onlyUrgent: false,
  negotiableOnly: false,
  flexibleOnly: false,
  travelProvided: false,
  accommodationProvided: false,
  bulkShiftsOnly: false,
};

export default function CommunityShiftsPage() {
  const auth = useAuth();
  const user = auth?.user;
  if (!user) return null;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedShiftIds, setAppliedShiftIds] = useState<number[]>([]);
  const [appliedSlotIds, setAppliedSlotIds] = useState<number[]>([]);
  const [rejectedShiftIds, setRejectedShiftIds] = useState<number[]>([]);
  const [rejectedSlotIds, setRejectedSlotIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [savedShiftIds, setSavedShiftIds] = useState<Set<number>>(new Set());
  const [savedMap, setSavedMap] = useState<Map<number, number>>(new Map()); // shiftId -> savedId

  const loadSaved = useCallback(async () => {
    try {
      const saved = await fetchSavedShifts();
      const ids = new Set<number>();
      const map = new Map<number, number>();
      saved.forEach((entry: any) => {
        if (typeof entry.shift === 'number') {
          ids.add(entry.shift);
          if (entry.id) map.set(entry.shift, entry.id);
        }
      });
      setSavedShiftIds(ids);
      setSavedMap(map);
    } catch (err) {
      console.error('Failed to load saved shifts', err);
    }
  }, []);

  const loadShifts = useCallback(
    async (activeFilters: FilterConfig, activePage: number) => {
      setLoading(true);
      setError(null);
      try {
        const apiFilters = {
          search: activeFilters.search,
          roles: activeFilters.roles,
          employmentTypes: activeFilters.employmentTypes,
          city: activeFilters.city,
          state: [],
          minRate: activeFilters.minRate || undefined,
          onlyUrgent: activeFilters.onlyUrgent || undefined,
          negotiableOnly: activeFilters.negotiableOnly || undefined,
          flexibleOnly: activeFilters.flexibleOnly || undefined,
          travelProvided: activeFilters.travelProvided || undefined,
          accommodationProvided: activeFilters.accommodationProvided || undefined,
          bulkShiftsOnly: activeFilters.bulkShiftsOnly || undefined,
          timeOfDay: activeFilters.timeOfDay,
          startDate: activeFilters.dateRange.start || undefined,
          endDate: activeFilters.dateRange.end || undefined,
          page: activePage,
          pageSize,
        };

        const [communityShifts, interests, rejections] = await Promise.all([
          fetchCommunityShifts(apiFilters) as Promise<PaginatedResponse<Shift>>,
          fetchShiftInterests({ userId: user.id }),
          fetchShiftRejections({ userId: user.id }),
        ]);

        const available = (communityShifts.results ?? []).filter((shift: Shift) => {
          const slots = shift.slots ?? [];
          if (slots.length === 0) return true;
          const assignedSlotCount = shift.slotAssignments?.length ?? 0;
          return assignedSlotCount < slots.length;
        });

        setShifts(available);
        setTotalCount(communityShifts.count);

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
    },
    [user.id]
  );

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    loadShifts(filters, page);
  }, [filters, page, loadShifts]);

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

  const handleToggleSave = async (shiftId: number) => {
    const savedId = savedMap.get(shiftId);
    if (savedId) {
      try {
        await deleteSavedShift(savedId);
        const next = new Set(savedShiftIds);
        next.delete(shiftId);
        setSavedShiftIds(next);
        const nextMap = new Map(savedMap);
        nextMap.delete(shiftId);
        setSavedMap(nextMap);
      } catch (err) {
        console.error('Failed to unsave shift', err);
        setError('Failed to unsave this shift.');
      }
      return;
    }
    try {
      const created = await saveShift(shiftId);
      const next = new Set(savedShiftIds);
      next.add(shiftId);
      setSavedShiftIds(next);
      const nextMap = new Map(savedMap);
      if (created?.id) nextMap.set(shiftId, created.id);
      setSavedMap(nextMap);
    } catch (err) {
      console.error('Failed to save shift', err);
      setError('Failed to save this shift.');
    }
  };

  const handleFiltersChange = (nextFilters: FilterConfig) => {
    setFilters(nextFilters);
    setPage(1);
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
        useServerFiltering
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        savedShiftIds={Array.from(savedShiftIds)}
        onToggleSave={handleToggleSave}
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
