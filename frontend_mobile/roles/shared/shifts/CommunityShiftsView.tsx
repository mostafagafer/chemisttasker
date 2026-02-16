// CommunityShiftsView - Mobile implementation using ShiftsBoard
// Mirrors web logic for filters, pagination, and rejections

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Snackbar, SegmentedButtons, Text, Button } from 'react-native-paper';
import {
    Shift,
    ShiftCounterOfferPayload,
    ShiftInterest,
    ShiftOffer,
    PaginatedResponse,
    deleteSavedShift,
    fetchShiftOffersService,
    expressInterestInCommunityShiftService,
    fetchCommunityShifts,
    fetchSavedShifts,
    fetchShiftInterests,
    fetchShiftRejections,
    acceptShiftOfferService,
    declineShiftOfferService,
    rejectCommunityShiftService,
    saveShift,
    submitShiftCounterOfferService,
} from '@chemisttasker/shared-core';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import ShiftsBoard from './ShiftsBoard';
import type { FilterConfig } from './ShiftsBoard/types';

type CommunityShiftsViewProps = {
    activeTabOverride?: 'browse' | 'saved' | 'interested' | 'rejected' | 'accepted';
    onActiveTabChange?: (tab: 'browse' | 'saved' | 'interested' | 'rejected' | 'accepted') => void;
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
    const [boardTab, setBoardTab] = useState<'browse' | 'saved' | 'interested' | 'rejected' | 'accepted'>(
        activeTabOverride ?? 'browse'
    );
    const [offers, setOffers] = useState<ShiftOffer[]>([]);
    const [offersLoading, setOffersLoading] = useState(false);

    const showError = (message: string) => {
        const msg = message && message.trim().length > 0 ? message : 'Something went wrong. Please try again.';
        setError(msg);
    };

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

    const handleBoardTabChange = (tab: 'browse' | 'saved' | 'interested' | 'rejected' | 'accepted') => {
        setBoardTab(tab);
        onActiveTabChange?.(tab);
    };

    const loadOffers = useCallback(async () => {
        setOffersLoading(true);
        try {
            const data = await fetchShiftOffersService({ status: 'PENDING' });
            setOffers(data as ShiftOffer[]);
        } catch (err) {
            console.error('Failed to load offers', err);
            showError('Failed to load offers.');
        } finally {
            setOffersLoading(false);
        }
    }, []);

    useEffect(() => {
        if (boardTab === 'accepted') {
            loadOffers();
        }
    }, [boardTab, loadOffers]);

    const offersByShift = useMemo(() => {
        const map = new Map<number, ShiftOffer[]>();
        offers.forEach((offer) => {
            const shift = offer.shiftDetail;
            if (!shift) return;
            const list = map.get(shift.id) ?? [];
            list.push(offer);
            map.set(shift.id, list);
        });
        return map;
    }, [offers]);

    const offerShifts = useMemo(
        () =>
            Array.from(offersByShift.entries())
                .map(([, shiftOffers]) => {
                    const shift = shiftOffers[0]?.shiftDetail as Shift | undefined;
                    if (!shift) return null;

                    const offerSlotIds = new Set<number>(
                        shiftOffers
                            .map((offer) => {
                                const raw = offer.slot ?? (offer as any).slotId ?? offer.slotDetail?.id ?? null;
                                const n = Number(raw);
                                return Number.isFinite(n) ? n : null;
                            })
                            .filter((id): id is number => id != null)
                    );

                    if (offerSlotIds.size === 0) {
                        return shift;
                    }

                    const slots = (shift.slots ?? []).filter((slot: any) => {
                        const n = Number(slot?.id);
                        return Number.isFinite(n) && offerSlotIds.has(n);
                    });
                    return slots.length > 0 ? ({ ...shift, slots } as Shift) : shift;
                })
                .filter(Boolean) as Shift[],
        [offersByShift]
    );

    const handleConfirmOfferShift = async (targetShift: Shift) => {
        const list = offersByShift.get(targetShift.id) ?? [];
        if (list.length == 0) return;
        await Promise.all(list.map((offer) => acceptShiftOfferService(offer.id)));
        await loadOffers();
    };

    const handleDeclineOfferShift = async (targetShift: Shift) => {
        const list = offersByShift.get(targetShift.id) ?? [];
        if (list.length == 0) return;
        await Promise.all(list.map((offer) => declineShiftOfferService(offer.id)));
        await loadOffers();
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
                            { value: 'accepted', label: 'Offers' },
                        ]}
                        theme={{ colors: { secondaryContainer: '#EEF2FF', onSecondaryContainer: '#6366F1' } }}
                    />
                </View>
            )}
            {boardTab === 'accepted' ? (
                <View style={styles.placeholderCard}>
                    {offersLoading ? (
                        <ActivityIndicator style={styles.placeholderLoader} />
                    ) : offerShifts.length === 0 ? (
                        <>
                            <Text variant="titleMedium" style={styles.placeholderTitle}>
                                Offers
                            </Text>
                            <Text variant="bodyMedium" style={styles.placeholderText}>
                                No pending offers yet.
                            </Text>
                        </>
                    ) : (
                        <ShiftsBoard
                            title="Offers"
                            shifts={offerShifts}
                            loading={offersLoading}
                            onApplyAll={handleConfirmOfferShift}
                            onApplySlot={handleConfirmOfferShift}
                            onSubmitCounterOffer={handleSubmitCounterOffer}
                            onRejectShift={handleDeclineOfferShift}
                            onRejectSlot={undefined}
                            enableSaved={false}
                            hideSaveToggle
                            hideFiltersAndSort
                            hideTabs
                            disableLocalPersistence
                            applyLabel="Confirm"
                            disableSlotActions
                            onRefresh={loadOffers}
                            onScroll={onScroll}
                            fallbackToAllShiftsWhenEmpty
                            showAllSlots
                        />
                    )}
                </View>
            ) : (
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
            )}
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
    placeholderCard: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    placeholderTitle: {
        fontWeight: '700',
        marginBottom: 6,
        textAlign: 'center',
    },
    placeholderText: {
        color: '#6B7280',
        textAlign: 'center',
    },
    placeholderLoader: {
        marginTop: 8,
    },
    offerList: {
        width: '100%',
        marginTop: 12,
        gap: 12,
    },
    offerCard: {
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    offerTitle: {
        fontWeight: '700',
        marginBottom: 4,
    },
    offerMeta: {
        color: '#6B7280',
        marginBottom: 4,
    },
    offerActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
});
