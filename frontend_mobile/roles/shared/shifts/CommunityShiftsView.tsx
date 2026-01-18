// CommunityShiftsView - Mobile implementation using ShiftsBoard
// Mirrors web logic for filters, pagination, and rejections

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Snackbar, SegmentedButtons, Text } from 'react-native-paper';
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
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import ShiftsBoard from './ShiftsBoard';
import type { FilterConfig } from './ShiftsBoard/types';

type CommunityShiftsViewProps = {
    activeTabOverride?: 'browse' | 'saved' | 'interested' | 'rejected';
    onActiveTabChange?: (tab: 'browse' | 'saved' | 'interested' | 'rejected') => void;
    hideTabs?: boolean;
    hideHero?: boolean;
    onScroll?: (event: any) => void;
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

export default function CommunityShiftsView({
    activeTabOverride,
    onActiveTabChange,
    hideTabs,
    hideHero,
    onScroll,
}: CommunityShiftsViewProps = {}) {
    const scrollY = useRef(new Animated.Value(0)).current;
    const AnimatedText = useMemo(() => Animated.createAnimatedComponent(Text), []);
    const { user } = useAuth();
    const { workspace } = useWorkspace();
    const userId = user?.id;
    const isWorkspaceReady = workspace === 'internal';

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
    const [savedMap, setSavedMap] = useState<Map<number, number>>(new Map());
    const [boardTab, setBoardTab] = useState<'browse' | 'saved' | 'interested' | 'rejected'>(
        activeTabOverride ?? 'browse'
    );

    useEffect(() => {
        if (activeTabOverride) {
            setBoardTab(activeTabOverride);
        }
    }, [activeTabOverride]);

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
                    fetchShiftInterests({ userId }),
                    fetchShiftRejections({ userId }),
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
        [userId]
    );

    useEffect(() => {
        if (!userId || !isWorkspaceReady) return;
        loadSaved();
    }, [loadSaved, userId, isWorkspaceReady]);

    useEffect(() => {
        if (!userId || !isWorkspaceReady) return;
        loadShifts(filters, page);
    }, [filters, page, loadShifts, userId, isWorkspaceReady]);

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

    const handleSubmitCounterOffer = async (payload: ShiftCounterOfferPayload) => {
        try {
            await submitShiftCounterOfferService(payload);
        } catch (err) {
            console.error('Failed to submit counter offer', err);
            setError('Failed to submit counter offer.');
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
            const created: any = await saveShift(shiftId);
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

    const handleBoardTabChange = (tab: 'browse' | 'saved' | 'interested' | 'rejected') => {
        setBoardTab(tab);
        onActiveTabChange?.(tab);
    };

    const slotFilterMode =
        boardTab === 'interested' ? 'interested' : boardTab === 'rejected' ? 'rejected' : 'all';
    const boardTabForBoard = boardTab === 'saved' ? 'saved' : 'browse';
    const heroHeight = scrollY.interpolate({
        inputRange: [0, 140],
        outputRange: [140, 52],
        extrapolate: 'clamp',
    });
    const subtitleOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        {
            useNativeDriver: false,
            listener: onScroll,
        }
    );

    useEffect(() => {
        if (loading) {
            Animated.timing(scrollY, {
                toValue: 140,
                duration: 250,
                useNativeDriver: false,
            }).start();
        }
    }, [loading, scrollY]);

    if (!userId) return null;
    if (!isWorkspaceReady) {
        return (
            <View style={styles.container}>
                <ActivityIndicator style={{ marginTop: 24 }} />
                <Text style={{ textAlign: 'center', marginTop: 8 }}>Switching to Internal mode...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!hideHero && (
                <Animated.View style={[styles.heroWrapper, { height: heroHeight }]}>
                    <Card style={styles.heroCard} mode="elevated">
                        <Card.Content>
                            <Text variant="labelSmall" style={styles.heroLabel}>
                                SHIFT BOARD
                            </Text>
                            <Text variant="headlineMedium" style={styles.heroTitle}>
                                Discover shifts at a glance
                            </Text>
                            <AnimatedText variant="bodyMedium" style={[styles.heroSubtitle, { opacity: subtitleOpacity }]}>
                                Browse open shifts, review your saved list, and track interested or rejected opportunities.
                            </AnimatedText>
                        </Card.Content>
                    </Card>
                </Animated.View>
            )}

            {!hideTabs && (
                <View style={styles.tabsContainer}>
                    <SegmentedButtons
                        value={boardTab}
                        onValueChange={(value) => handleBoardTabChange(value as any)}
                        buttons={[
                            { value: 'browse', label: 'Browse' },
                            { value: 'saved', label: `Saved (${savedShiftIds.size})` },
                            { value: 'interested', label: 'Interested' },
                            { value: 'rejected', label: 'Rejected' },
                        ]}
                        theme={{ colors: { secondaryContainer: '#EEF2FF', onSecondaryContainer: '#6366F1' } }}
                    />
                </View>
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
                hideTabs
                activeTabOverride={boardTabForBoard}
                onActiveTabChange={(tab) => handleBoardTabChange(tab as any)}
                onRefresh={() => loadShifts(filters, page)}
                slotFilterMode={slotFilterMode}
                onScroll={handleScroll}
            />
            <Snackbar
                visible={!!error}
                onDismiss={() => setError(null)}
                duration={3000}
            >
                {error}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    heroCard: {
        flex: 1,
        backgroundColor: '#4F46E5',
        borderRadius: 16,
        overflow: 'hidden',
    },
    heroWrapper: {
        margin: 16,
        marginBottom: 8,
        overflow: 'hidden',
    },
    heroLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 1.6,
        marginBottom: 4,
        textAlign: 'left',
    },
    heroTitle: {
        color: '#FFFFFF',
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'left',
    },
    heroSubtitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'left',
    },
    tabsContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
});
