// ActiveShiftsPage - Main Component
// Mobile implementation aligned with web logic and hooks

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, IconButton, Snackbar, ActivityIndicator, Card, Divider, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    Shift,
    ShiftInterest,
    ShiftMemberStatus,
    EscalationLevelKey,
} from '@chemisttasker/shared-core';
import { useAuth } from '@/context/AuthContext';

// Hooks
import { useShiftsData } from './hooks/useShiftsData';
import { useTabData } from './hooks/useTabData';
import { useCounterOffers } from './hooks/useCounterOffers';
import { useRevealInterest } from './hooks/useRevealInterest';
import { useWorkerRatings } from './hooks/useWorkerRatings';
import { useShiftActions } from './hooks/useShiftActions';
import { useShareShift } from './hooks/useShareShift';

// Components
import DeleteConfirmDialog from './components/Dialogs/DeleteConfirmDialog';
import CounterOfferDialog from './components/Dialogs/CounterOfferDialog';
import EscalationStepper from './components/Escalation/EscalationStepper';
import PublicLevelView from './components/Candidates/PublicLevelView';
import CommunityLevelView from './components/Candidates/CommunityLevelView';

// Utils
import {
    PUBLIC_LEVEL_KEY,
    getCurrentLevelKey,
    getShiftSummary,
    deriveLevelSequence,
    getLocationText,
} from './utils/shiftHelpers';
import { findInterestForOffer } from './utils/candidateHelpers';
import { mapOfferSlotsWithShift } from './utils/offerHelpers';
import { getCardBorderColor, getLevelLabel } from './utils/displayHelpers';

// Types
import { ReviewOfferDialogState, DeleteConfirmDialogState } from './types';

// Theme
import { customTheme } from './theme';

type ActiveShiftsPageProps = {
    shiftId?: number | null;
    title?: string;
};

const ActiveShiftsPage: React.FC<ActiveShiftsPageProps> = ({ shiftId = null, title = 'Active Shifts' }) => {
    const router = useRouter();
    const { user } = useAuth();
    const selectedPharmacyId = null;

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const showSnackbar = useCallback((msg: string) => {
        setSnackbarMessage(msg);
        setSnackbarOpen(true);
    }, []);

    const [selectedLevelByShift, setSelectedLevelByShift] = useState<Record<number, EscalationLevelKey>>({});
    const [selectedSlotByShift, setSelectedSlotByShift] = useState<Record<number, number>>({});
    const [expandedShifts, setExpandedShifts] = useState<Set<number>>(new Set());
    const reviewLoadingId: number | null = null;

    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<DeleteConfirmDialogState>({
        open: false,
        shiftId: null,
    });
    const [reviewOfferDialog, setReviewOfferDialog] = useState<ReviewOfferDialogState>({
        open: false,
        shiftId: null,
        offer: null,
        candidate: null,
        slotId: null,
    });

    const getTabKey = useCallback((shiftId: number, levelKey: EscalationLevelKey) => {
        return `${shiftId}_${levelKey}`;
    }, []);

    const { shifts, setShifts, loading: shiftsLoading, loadShifts } = useShiftsData({ selectedPharmacyId, shiftId });
    const { tabData, setTabData, loadTabDataForShift } = useTabData(shifts, selectedLevelByShift, getTabKey);
    const {
        counterOffersByShift,
        counterOffersLoadingByShift,
        loadCounterOffers,
        acceptOffer,
        rejectOffer,
        counterActionLoading,
        updateOfferCache,
    } = useCounterOffers();
    const { revealInterest, revealingInterestId } = useRevealInterest(getTabKey, setTabData, showSnackbar);
    const {
        summary: workerRatingSummary,
        comments: workerRatingComments,
        page: workerCommentsPage,
        pageCount: workerCommentsPageCount,
        loadRatings: loadWorkerRatings,
        reset: resetWorkerRatings,
    } = useWorkerRatings();
    const { actionLoading, handleEscalate, handleDelete, handleAccept } = useShiftActions(setShifts, showSnackbar);
    const { sharingShiftId, handleShare } = useShareShift(showSnackbar);

    const getOfferSlotIds = useCallback((offer: any): number[] => {
        const offerSlots = offer?.slots || offer?.offer_slots || [];
        return offerSlots
            .map((s: any) => s.slot_id ?? s.slotId ?? s.slot?.id ?? null)
            .filter((id: any) => id != null);
    }, []);

    const resolveSlotId = useCallback((slot: any): number | null => {
        return slot?.id ?? slot?.slotId ?? slot?.slot_id ?? null;
    }, []);

    const handleRevealInterest = useCallback(async (shift: Shift, interest: ShiftInterest) => {
        const levelKey = selectedLevelByShift[shift.id] ?? PUBLIC_LEVEL_KEY;

        resetWorkerRatings();
        let revealedUser: any = null;

        if (!interest.revealed) {
            try {
                revealedUser = await revealInterest(shift, interest, levelKey);

                const offers = counterOffersByShift[shift.id] || [];
                const matchingOffer = offers.find((o: any) => {
                    const offerUserId = typeof o.user === 'object' ? o.user?.id : o.user;
                    return offerUserId === interest.userId;
                });

                if (matchingOffer && revealedUser) {
                    updateOfferCache(shift.id, matchingOffer.id, revealedUser);
                    await loadCounterOffers(shift.id);
                }
            } catch (error) {
                console.error('Failed to reveal interest', error);
                showSnackbar('Failed to reveal candidate.');
                return;
            }
        } else {
            revealedUser = interest.user || (interest as any).user_detail;
        }

        const userObj = (typeof revealedUser === 'object' && revealedUser)
            ? revealedUser
            : (typeof interest.user === 'object' && interest.user)
                ? interest.user
                : (interest as any).user_detail;

        const interestAny = interest as any;
        const candidate = {
            userId: interest.userId ?? userObj?.id ?? null,
            name:
                (userObj?.firstName && userObj?.lastName)
                    ? `${userObj.firstName} ${userObj.lastName}`
                    : (userObj?.first_name && userObj?.last_name)
                        ? `${userObj.first_name} ${userObj.last_name}`
                        : userObj?.name || userObj?.displayName || userObj?.display_name
                        || interestAny?.displayName
                        || (typeof interest.user === 'string' ? interest.user : null)
                        || interest?.userName
                        || 'Candidate',
            email: userObj?.email || interestAny?.email || '',
            shortBio: userObj?.shortBio || userObj?.short_bio || interestAny?.shortBio || interestAny?.short_bio || '',
        };

        const interestUserId =
            typeof interest?.user === 'object' && interest?.user
                ? (interest.user as any).id
                : null;
        const ratingsUserId = (typeof userObj === 'object' && userObj?.id) ? userObj.id : (interest?.userId ?? interestUserId ?? null);
        if (ratingsUserId != null) {
            try {
                await loadWorkerRatings(ratingsUserId, 1);
            } catch (error) {
                console.error('Failed to load worker ratings', error);
            }
        }

        setReviewOfferDialog({
            open: true,
            shiftId: shift.id,
            offer: null,
            candidate,
            slotId: interest.slotId ?? null,
        });
    }, [
        revealInterest,
        selectedLevelByShift,
        counterOffersByShift,
        updateOfferCache,
        resetWorkerRatings,
        loadWorkerRatings,
        showSnackbar,
        loadCounterOffers,
    ]);

    const handleReviewOffer = useCallback(
        async (shift: Shift, offer: any, tabDataState: any, slotId: number | null) => {
            resetWorkerRatings();

            const interest = findInterestForOffer(offer, tabDataState, slotId);

            let revealedUser: any = null;

            if (interest && !interest.revealed) {
                try {
                    const levelKey = selectedLevelByShift[shift.id] ?? PUBLIC_LEVEL_KEY;
                    revealedUser = await revealInterest(shift, interest, levelKey);

                    if (revealedUser) {
                        updateOfferCache(shift.id, offer.id, revealedUser);
                    }

                    await loadCounterOffers(shift.id);
                } catch (error) {
                    console.error('Failed to reveal offer candidate', error);
                }
            }

            const userObj =
                revealedUser ||
                offer.userDetail ||
                offer.user_detail ||
                (typeof offer.user === 'object' ? offer.user : null);
            const interestAny = interest as any;
            const candidate =
                userObj || interest
                    ? {
                        userId: userObj?.id ?? interestAny?.userId ?? interest?.userId ?? offer?.user?.id ?? null,
                        name:
                            userObj?.firstName && userObj?.lastName
                                ? `${userObj.firstName} ${userObj.lastName}`
                                : userObj?.name ||
                                userObj?.displayName ||
                                interestAny?.userName ||
                                'Candidate',
                        email: userObj?.email || interestAny?.email,
                        shortBio: userObj?.shortBio || interestAny?.shortBio || interestAny?.short_bio || '',
                    }
                    : null;

            const interestUserId =
                typeof interestAny?.user === 'object' && interestAny?.user
                    ? interestAny.user.id
                    : null;
            const ratingsUserId = userObj?.id ?? interest?.userId ?? interestUserId ?? offer?.user?.id ?? null;
            if (ratingsUserId != null) {
                try {
                    await loadWorkerRatings(ratingsUserId, 1);
                } catch (error) {
                    console.error('Failed to load worker ratings', error);
                }
            }

            const isSingleUserShift = Boolean((shift as any).singleUserOnly);
            const offerSlotIds = getOfferSlotIds(offer);
            const slotFromOffer = offerSlotIds[0] ?? null;
            const fallbackSlotId = shift.slots?.[0]?.id ?? null;
            const slotMatchesOffer = slotId != null && offerSlotIds.length > 0 ? offerSlotIds.includes(slotId) : true;
            const resolvedSlotId = isSingleUserShift
                ? null
                : (slotMatchesOffer ? slotId : null) ?? slotFromOffer ?? slotId ?? fallbackSlotId;

            const mappedSlots = mapOfferSlotsWithShift(offer, shift, resolvedSlotId);

            setReviewOfferDialog({
                open: true,
                shiftId: shift.id,
                offer: { ...offer, _mappedSlots: mappedSlots },
                candidate,
                slotId: resolvedSlotId,
            });
        },
        [
            revealInterest,
            selectedLevelByShift,
            resetWorkerRatings,
            loadCounterOffers,
            loadWorkerRatings,
            updateOfferCache,
            getOfferSlotIds,
        ]
    );

    const handleReviewCandidate = useCallback(
        async (shift: Shift, member: ShiftMemberStatus, offer: any | null, slotId: number | null) => {
            resetWorkerRatings();

            const candidate = {
                userId: (member as any).userId ?? (member as any).user?.id ?? null,
                name:
                    (member as any).firstName && (member as any).lastName
                        ? `${(member as any).firstName} ${(member as any).lastName}`
                        : member.displayName || (member as any).email || 'Candidate',
                email: (member as any).email || '',
                shortBio: (member as any).shortBio || '',
            };

            if ((member as any).userId != null) {
                try {
                    await loadWorkerRatings((member as any).userId, 1);
                } catch (error) {
                    console.error('Failed to load worker ratings', error);
                }
            }

            const isSingleUserShift = Boolean((shift as any).singleUserOnly);
            const offerSlotIds = getOfferSlotIds(offer);
            const slotFromOffer = offerSlotIds[0] ?? null;
            const fallbackSlotId = shift.slots?.[0]?.id ?? null;
            const slotMatchesOffer = slotId != null && offerSlotIds.length > 0 ? offerSlotIds.includes(slotId) : true;
            const resolvedSlotId = isSingleUserShift
                ? null
                : (slotMatchesOffer ? slotId : null) ?? slotFromOffer ?? slotId ?? fallbackSlotId;

            const mappedSlots = offer ? mapOfferSlotsWithShift(offer, shift, resolvedSlotId) : [];

            setReviewOfferDialog({
                open: true,
                shiftId: shift.id,
                offer: offer ? { ...offer, _mappedSlots: mappedSlots } : null,
                candidate,
                slotId: resolvedSlotId,
            });
        },
        [resetWorkerRatings, loadWorkerRatings, getOfferSlotIds]
    );

    const handleAcceptOffer = useCallback(
        async (offer: any, shiftId: number | null, slotId: number | null) => {
            if (!offer || shiftId == null) return;
            const targetShift = shifts.find(s => s.id === shiftId);
            const requiresSlot = targetShift ? !((targetShift as any).singleUserOnly) : false;
            const offerSlotIds = getOfferSlotIds(offer);
            const slotMatchesOffer = slotId != null && offerSlotIds.length > 0 ? offerSlotIds.includes(slotId) : true;
            const resolvedSlotId = requiresSlot
                ? (slotMatchesOffer ? slotId : null) ?? offerSlotIds[0] ?? slotId
                : null;
            if (requiresSlot && resolvedSlotId == null) {
                showSnackbar('Select a slot to accept this offer.');
                return;
            }
            await acceptOffer({ offer, shiftId, slotId: resolvedSlotId }, async () => {
                showSnackbar('Counter offer accepted');
                setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null });
                await loadShifts();
            });
        },
        [acceptOffer, showSnackbar, loadShifts, shifts, getOfferSlotIds]
    );

    const handleRejectOffer = useCallback(
        async (offer: any, shiftId: number | null) => {
            if (!offer || shiftId == null) return;
            await rejectOffer({ offer, shiftId }, async () => {
                showSnackbar('Counter offer rejected');
                setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null });
                await loadShifts();
            });
        },
        [rejectOffer, showSnackbar, loadShifts]
    );

    const handleAssignCandidate = useCallback(
        async (userId: number, shiftId: number | null, slotId: number | null) => {
            if (!userId || shiftId == null) return;
            const success = await handleAccept(shiftId, userId, slotId);
            if (success) {
                setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null });
                await loadShifts();
            }
        },
        [handleAccept, loadShifts]
    );

    const toggleShiftExpansion = useCallback((shiftId: number) => {
        setExpandedShifts(prev => {
            const next = new Set(prev);
            if (next.has(shiftId)) {
                next.delete(shiftId);
            } else {
                next.add(shiftId);
            }
            return next;
        });
    }, []);

    const handleLevelChange = useCallback(
        (shift: Shift, newLevel: EscalationLevelKey) => {
            const currentLevelKey = getCurrentLevelKey(shift);
            const viewableLevels = deriveLevelSequence(currentLevelKey);
            if (!viewableLevels.includes(newLevel as any)) {
                showSnackbar('Escalate to this level to review members status.');
                return;
            }
            setSelectedLevelByShift(prev => ({ ...prev, [shift.id]: newLevel }));
            loadTabDataForShift(shift, newLevel);
        },
        [loadTabDataForShift, showSnackbar]
    );

    const handleSlotSelection = useCallback((shiftId: number, slotId: number) => {
        setSelectedSlotByShift(prev => ({ ...prev, [shiftId]: slotId }));
    }, []);

    const handleEditShift = useCallback((shift: Shift) => {
        const pharmacyId = (shift as any).pharmacyDetail?.id ?? (shift as any).pharmacy_detail?.id ?? (shift as any).pharmacy;
        const baseRoute =
            user?.role?.startsWith('ORG_')
                ? '/organization/post-shift'
                : user?.role === 'PHARMACY_ADMIN'
                    ? (pharmacyId != null ? `/admin/${pharmacyId}/post-shift` : '/admin/post-shift')
                    : '/owner/post-shift';
        router.push({ pathname: baseRoute as any, params: { edit: String(shift.id) } });
    }, [router, user]);

    const isDedicatedShift = useCallback((shift: Shift) => {
        const shiftAny = shift as any;
        return Boolean(shiftAny.dedicatedUser ?? shiftAny.dedicated_user);
    }, []);

    const getLevelLabelForShift = useCallback((level: EscalationLevelKey) => {
        return getLevelLabel(level);
    }, []);

    useEffect(() => {
        expandedShifts.forEach((shiftId) => {
            if (Object.prototype.hasOwnProperty.call(counterOffersByShift, shiftId)) return;
            loadCounterOffers(shiftId);
        });
    }, [expandedShifts, counterOffersByShift, loadCounterOffers]);

    const orderedShifts = useMemo(() => {
        const list = [...shifts];
        list.sort((a, b) => {
            const aDedicated = isDedicatedShift(a) ? 1 : 0;
            const bDedicated = isDedicatedShift(b) ? 1 : 0;
            return bDedicated - aDedicated;
        });
        return list;
    }, [shifts, isDedicatedShift]);

    if (shiftsLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={customTheme.colors.primary} />
                <Text style={styles.loadingText}>Loading shifts...</Text>
            </View>
        );
    }

    if (shifts.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No active shifts found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{title}</Text>
                {orderedShifts.map((shift, idx) => {
                    const isDedicated = isDedicatedShift(shift);
                    const prev = idx > 0 ? orderedShifts[idx - 1] : null;
                    const showSectionHeader = idx === 0 || (prev && isDedicatedShift(prev) !== isDedicated);
                    const isExpanded = expandedShifts.has(shift.id);
                    const isSingleUserShift = Boolean((shift as any).singleUserOnly);
                    const shiftLevel = getCurrentLevelKey(shift);
                    const selectedLevel = selectedLevelByShift[shift.id] ?? shiftLevel;
                    const tabKey = getTabKey(shift.id, selectedLevel);
                    const currentTabData = tabData[tabKey] || { loading: false };
                    const selectedSlotId = isSingleUserShift
                        ? null
                        : selectedSlotByShift[shift.id] ?? resolveSlotId(shift.slots?.[0]) ?? null;
                    const offers = counterOffersByShift[shift.id];
                    const counterOffersLoaded = Object.prototype.hasOwnProperty.call(counterOffersByShift, shift.id);
                    const counterOffersLoading = counterOffersLoadingByShift[shift.id] ?? false;
                    const membersForView = isSingleUserShift
                        ? currentTabData.members || []
                        : currentTabData.membersBySlot?.[selectedSlotId ?? -1] || [];

                    const cardBorderColor = getCardBorderColor((shift as any).visibility ?? 'PLATFORM');
                    const summaryText = getShiftSummary(shift);
                    const location = getLocationText(shift);
                    const roleNeeded = (shift as any).roleNeeded ?? (shift as any).role_needed ?? null;
                    const employmentType = (shift as any).employmentType ?? (shift as any).employment_type ?? null;
                    const isUrgent = Boolean((shift as any).isUrgent ?? (shift as any).is_urgent);
                    const description = (shift as any).description ?? null;
                    const hasBadges = Boolean(roleNeeded || employmentType || isUrgent);
                    const labelOverrides = undefined;
                    const candidatesLabel = isDedicated ? 'Direct / Private' : getLevelLabelForShift(selectedLevel);

                    return (
                        <React.Fragment key={shift.id}>
                            {showSectionHeader && (
                                <Text style={styles.sectionTitle}>
                                    {isDedicated ? 'Direct / Private Offers' : 'Active Shifts'}
                                </Text>
                            )}
                            <Card
                                style={[styles.shiftCard, { borderLeftColor: cardBorderColor }]}
                            >
                            <TouchableOpacity onPress={() => toggleShiftExpansion(shift.id)}>
                                <Card.Title
                                    title={(shift as any).pharmacyDetail?.name ?? 'Unnamed Pharmacy'}
                                    subtitle={summaryText}
                                    titleStyle={styles.cardTitle}
                                    subtitleStyle={styles.cardSubtitle}
                                    right={() => (
                                        <IconButton icon={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} />
                                    )}
                                />
                            </TouchableOpacity>

                            <Card.Content>
                                {hasBadges ? (
                                    <View style={styles.badgeRow}>
                                        {roleNeeded && (
                                            <Chip
                                                style={[styles.primaryBadge, { backgroundColor: cardBorderColor }]}
                                                textStyle={styles.primaryBadgeText}
                                            >
                                                {roleNeeded}
                                            </Chip>
                                        )}
                                        {employmentType && (
                                            <Chip mode="outlined" style={styles.outlineBadge}>
                                                {employmentType}
                                            </Chip>
                                        )}
                                        {isUrgent && (
                                            <Chip style={styles.urgentBadge} textStyle={styles.urgentBadgeText}>
                                                Urgent
                                            </Chip>
                                        )}
                                    </View>
                                ) : null}

                                <View style={styles.metaRow}>
                                    <Text style={styles.location} numberOfLines={1}>
                                        {location}
                                    </Text>
                                    <View style={styles.headerActions}>
                                        <IconButton
                                            icon="share-variant"
                                            size={20}
                                            onPress={() => handleShare(shift)}
                                            disabled={sharingShiftId === shift.id}
                                            style={styles.actionButton}
                                        />
                                        <IconButton
                                            icon="pencil"
                                            size={20}
                                            onPress={() => handleEditShift(shift)}
                                            style={styles.actionButton}
                                        />
                                        <IconButton
                                            icon="delete"
                                            size={20}
                                            onPress={() => setDeleteConfirmDialog({ open: true, shiftId: shift.id })}
                                            disabled={actionLoading[`delete_${shift.id}`]}
                                            style={styles.actionButton}
                                        />
                                    </View>
                                </View>

                                {isDedicated ? (
                                    <View style={styles.directBadgeRow}>
                                        <Chip style={styles.directBadge} textStyle={styles.directBadgeText}>
                                            Direct / Private
                                        </Chip>
                                        <Chip mode="outlined" style={styles.pendingBadge} textStyle={styles.pendingBadgeText}>
                                            Pending
                                        </Chip>
                                    </View>
                                ) : null}

                                {isExpanded && (
                                    <>
                                        <Divider style={styles.divider} />

                                        {description ? (
                                            <View style={styles.descriptionBox}>
                                                <Text style={styles.descriptionText}>{description}</Text>
                                            </View>
                                        ) : null}

                                            <EscalationStepper
                                                shift={shift}
                                                currentLevel={shiftLevel}
                                                selectedLevel={selectedLevel}
                                                onSelectLevel={(levelKey) => handleLevelChange(shift, levelKey)}
                                            onEscalate={async (_s, _levelKey) => {
                                                const success = await handleEscalate(shift.id);
                                                if (!success) return;
                                                setSelectedLevelByShift(prev => {
                                                    const next = { ...prev };
                                                    delete next[shift.id];
                                                    return next;
                                                });
                                                await loadShifts();
                                                }}
                                                escalating={actionLoading[`escalate_${shift.id}`]}
                                            labelOverrides={labelOverrides}
                                            showPrivateFirst={isDedicated}
                                            />

                                        <Divider style={styles.divider} />

                                        <View style={styles.sectionHeader}>
                                            <Divider style={styles.sectionDivider} />
                                            <Chip mode="outlined" style={styles.sectionChip}>
                                                Candidates for {candidatesLabel}
                                            </Chip>
                                            <Divider style={styles.sectionDivider} />
                                        </View>

                                        {currentTabData.loading ? (
                                            <ActivityIndicator style={{ padding: 20 }} />
                                        ) : selectedLevel === PUBLIC_LEVEL_KEY ? (
                                            counterOffersLoading || !counterOffersLoaded ? (
                                                <ActivityIndicator style={{ padding: 20 }} />
                                            ) : (
                                                <PublicLevelView
                                                    shift={shift}
                                                    slotId={selectedSlotId}
                                                    interestsAll={currentTabData.interestsAll || []}
                                                    counterOffers={offers || []}
                                                    counterOffersLoaded={counterOffersLoaded}
                                                    onReveal={handleRevealInterest}
                                                    onSelectSlot={(slotId) => handleSlotSelection(shift.id, slotId)}
                                                    onReviewOffer={(s, o, slotId) =>
                                                        handleReviewOffer(s, o, currentTabData, slotId)
                                                    }
                                                    revealingInterestId={revealingInterestId}
                                                />
                                            )
                                        ) : (
                                            <CommunityLevelView
                                                shift={shift}
                                                members={membersForView}
                                                selectedSlotId={selectedSlotId}
                                                offers={offers || []}
                                                onSelectSlot={(slotId) => handleSlotSelection(shift.id, slotId)}
                                                onReviewCandidate={(member, _shiftId, offer, slotId) =>
                                                    handleReviewCandidate(shift, member, offer, slotId)
                                                }
                                                reviewLoadingId={reviewLoadingId}
                                            />
                                        )}
                                    </>
                                )}
                            </Card.Content>
                        </Card>
                        </React.Fragment>
                    );
                })}
            </ScrollView>

            <DeleteConfirmDialog
                visible={deleteConfirmDialog.open}
                loading={deleteConfirmDialog.shiftId ? actionLoading[`delete_${deleteConfirmDialog.shiftId}`] ?? false : false}
                onDismiss={() => setDeleteConfirmDialog({ open: false, shiftId: null })}
                onConfirm={async () => {
                    if (deleteConfirmDialog.shiftId) {
                        const success = await handleDelete(deleteConfirmDialog.shiftId);
                        if (success) {
                            setDeleteConfirmDialog({ open: false, shiftId: null });
                        }
                    }
                }}
            />

            <CounterOfferDialog
                visible={reviewOfferDialog.open}
                offer={reviewOfferDialog.offer}
                candidate={reviewOfferDialog.candidate}
                slotId={reviewOfferDialog.slotId}
                assignLabel={reviewOfferDialog.slotId != null ? 'Assign to Slot' : 'Assign to Shift'}
                assignLoading={
                    reviewOfferDialog.shiftId != null && reviewOfferDialog.candidate?.userId != null
                        ? actionLoading[`accept_${reviewOfferDialog.shiftId}_${reviewOfferDialog.candidate.userId}`] ?? false
                        : false
                }
                workerRatingSummary={workerRatingSummary}
                workerRatingComments={workerRatingComments}
                workerCommentsPage={workerCommentsPage}
                workerCommentsPageCount={workerCommentsPageCount}
                counterActionLoading={counterActionLoading}
                onDismiss={() => setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null })}
                onAccept={(offer) => handleAcceptOffer(offer, reviewOfferDialog.shiftId, reviewOfferDialog.slotId)}
                onReject={(offer) => handleRejectOffer(offer, reviewOfferDialog.shiftId)}
                onAssign={(userId, slotId) => handleAssignCandidate(userId, reviewOfferDialog.shiftId, slotId)}
                onPageChange={(page) => {
                    if (reviewOfferDialog.candidate) {
                        const userId = (reviewOfferDialog.offer?.user as any)?.id ?? reviewOfferDialog.candidate?.userId;
                        if (userId) {
                            loadWorkerRatings(userId, page);
                        }
                    }
                }}
            />

            <Snackbar
                visible={snackbarOpen}
                onDismiss={() => setSnackbarOpen(false)}
                duration={4000}
            >
                {snackbarMessage}
            </Snackbar>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: customTheme.colors.greyLight,
    },
    content: {
        padding: customTheme.spacing.md,
        gap: customTheme.spacing.md,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: customTheme.colors.text,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        color: customTheme.colors.textMuted,
        letterSpacing: 1,
        marginTop: customTheme.spacing.sm,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: customTheme.colors.text,
    },
    cardSubtitle: {
        fontSize: 13,
        color: customTheme.colors.textMuted,
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: customTheme.spacing.md,
    },
    loadingText: {
        color: customTheme.colors.textMuted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: customTheme.spacing.xl,
    },
    emptyText: {
        fontSize: 16,
        color: customTheme.colors.textMuted,
    },
    shiftCard: {
        marginBottom: customTheme.spacing.md,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: customTheme.colors.border,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: customTheme.spacing.xs,
        marginBottom: customTheme.spacing.sm,
    },
    primaryBadge: {
        borderWidth: 0,
    },
    primaryBadgeText: {
        color: '#fff',
        fontWeight: '600',
    },
    outlineBadge: {
        borderColor: customTheme.colors.border,
    },
    urgentBadge: {
        backgroundColor: customTheme.colors.errorLight,
    },
    urgentBadgeText: {
        color: customTheme.colors.error,
        fontWeight: '600',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: customTheme.spacing.sm,
    },
    location: {
        flex: 1,
        fontSize: 13,
        color: customTheme.colors.textMuted,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: customTheme.spacing.xs,
    },
    directBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: customTheme.spacing.sm,
        marginTop: customTheme.spacing.sm,
        marginBottom: customTheme.spacing.sm,
    },
    directBadge: {
        backgroundColor: '#E0F2FE',
    },
    directBadgeText: {
        color: '#0369A1',
        fontWeight: '600',
    },
    pendingBadge: {
        borderColor: customTheme.colors.border,
    },
    pendingBadgeText: {
        color: customTheme.colors.textMuted,
        fontWeight: '600',
    },
    actionButton: {
        margin: 0,
    },
    divider: {
        marginVertical: customTheme.spacing.md,
    },
    descriptionBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: customTheme.colors.border,
        padding: customTheme.spacing.md,
        marginBottom: customTheme.spacing.md,
    },
    descriptionText: {
        color: customTheme.colors.text,
        fontSize: 13,
        lineHeight: 18,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: customTheme.spacing.sm,
        marginBottom: customTheme.spacing.sm,
    },
    sectionDivider: {
        flex: 1,
    },
    sectionChip: {
        backgroundColor: '#fff',
        borderColor: customTheme.colors.border,
    },
});

export default ActiveShiftsPage;
