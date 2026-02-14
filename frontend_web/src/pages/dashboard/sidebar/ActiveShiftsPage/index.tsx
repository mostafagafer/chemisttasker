import React, { useState, useCallback, useMemo } from 'react';
import {
    Container,
    Typography,
    Box,
    CircularProgress,
    Snackbar,
    IconButton,
    Card,
    CardContent,
    CardHeader,
    Stack,
    Chip,
    Tooltip,
    ThemeProvider,
    Divider,
} from '@mui/material';
import {
    Close as X,
    Edit,
    Delete as Trash2,
    ExpandMore as ChevronDown,
    Share as Share2,
    Business as Building,
    CalendarToday as CalendarDays,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    Shift,
    ShiftInterest,
    ShiftMemberStatus,
    EscalationLevelKey,
} from '@chemisttasker/shared-core';
import { useAuth } from '../../../../contexts/AuthContext';


// Hooks
import { useShiftsData } from './hooks/useShiftsData';
import { useTabData } from './hooks/useTabData';
import { useCounterOffers } from './hooks/useCounterOffers';
import { useRevealInterest } from './hooks/useRevealInterest';
import { useWorkerRatings } from './hooks/useWorkerRatings';
import { useShiftActions } from './hooks/useShiftActions';
import { useShareShift } from './hooks/useShareShift';

// Components
import { DeleteConfirmDialog } from './components/Dialogs/DeleteConfirmDialog';
import { CounterOfferDialog } from './components/Dialogs/CounterOfferDialog';
import { EscalationStepper } from './components/Escalation/EscalationStepper';

import { PublicLevelView } from './components/Candidates/PublicLevelView';
import { CommunityLevelView } from './components/Candidates/CommunityLevelView';

// Utils
import {
    PUBLIC_LEVEL_KEY,
    CustomEscalationLevelKey,
    getCurrentLevelKey,
    getShiftSummary,
    deriveLevelSequence,
} from './utils/shiftHelpers';
import { findInterestForOffer } from './utils/candidateHelpers';
import { mapOfferSlotsWithShift } from './utils/offerHelpers';
import { getCardBorderColor, getLocationText } from './utils/displayHelpers';

// Types
import {
    ReviewOfferDialogState,
    DeleteConfirmDialogState,
} from './types';

// Theme
import { customTheme } from './theme';

const ACTIVE_SHIFT_SLOT_SEEN_KEY_PREFIX = 'active_shift_slot_seen_v2';

const toFiniteNumber = (raw: any): number | null => {
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

const resolveSlotId = (slot: any): number | null => {
    const raw = slot?.id ?? slot?.slotId ?? slot?.slot_id ?? null;
    return toFiniteNumber(raw);
};

const getSlotIds = (shift: Shift): number[] => {
    const slots = (shift as any).slots || [];
    return slots
        .map((slot: any) => resolveSlotId(slot))
        .filter((id: number | null): id is number => id != null);
};

const offerBelongsToSlot = (offer: any, slotId: number) => {
    const offerSlots = offer?.slots || offer?.offer_slots || [];
    if (Array.isArray(offerSlots) && offerSlots.length > 0) {
        return offerSlots.some((s: any) => resolveSlotId(s?.slot) === slotId || resolveSlotId(s) === slotId);
    }
    const fallbackSlotId = resolveSlotId(offer?.slot) ?? toFiniteNumber(offer?.slot_id ?? offer?.slotId);
    if (fallbackSlotId == null) return false;
    return fallbackSlotId === slotId;
};

const interestBelongsToSlot = (interest: any, slotId: number) => {
    const explicitSlotId = resolveSlotId(interest?.slot) ?? toFiniteNumber(interest?.slot_id ?? interest?.slotId);
    if (explicitSlotId == null) return false;
    return explicitSlotId === slotId;
};

const buildPublicSlotSignature = (slotId: number, interests: any[], offers: any[]) => {
    const interestSig = interests
        .filter((i: any) => interestBelongsToSlot(i, slotId))
        .map((i: any) => {
            const userId = i?.userId ?? i?.user_id ?? i?.user?.id ?? '';
            const ts = i?.expressedAt ?? i?.expressed_at ?? '';
            return `${i?.id ?? ''}:${userId}:${i?.revealed ? 1 : 0}:${ts}`;
        })
        .sort()
        .join('|');

    const offerSig = offers
        .filter((o: any) => offerBelongsToSlot(o, slotId))
        .map((o: any) => `${o?.id ?? ''}:${o?.status ?? ''}:${o?.updatedAt ?? o?.updated_at ?? o?.createdAt ?? o?.created_at ?? ''}`)
        .sort()
        .join('|');

    return `i:${interestSig}#o:${offerSig}`;
};

const buildMemberSlotSignature = (slotId: number, members: ShiftMemberStatus[], offers: any[]) => {
    const memberSig = members
        .map((m: any) => `${m?.userId ?? m?.user_id ?? ''}:${m?.status ?? ''}`)
        .sort()
        .join('|');
    const offerSig = offers
        .filter((o: any) => offerBelongsToSlot(o, slotId))
        .map((o: any) => `${o?.id ?? ''}:${o?.status ?? ''}:${o?.updatedAt ?? o?.updated_at ?? o?.createdAt ?? o?.created_at ?? ''}`)
        .sort()
        .join('|');
    return `m:${memberSig}#o:${offerSig}`;
};

type ActiveShiftsPageProps = {
    shiftId?: number | null;
    title?: string;
};

const ActiveShiftsPage: React.FC<ActiveShiftsPageProps> = ({ shiftId = null, title = 'Active Shifts' }) => {
    const navigate = useNavigate();
    const { user, activePersona, activeAdminPharmacyId } = useAuth();
    const selectedPharmacyId = null; // TODO: Get from proper context
    const scopedPharmacyId =
        activePersona === 'admin' && typeof activeAdminPharmacyId === 'number'
            ? activeAdminPharmacyId
            : null;

    // Snackbar
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const showSnackbar = useCallback((msg: string) => {
        setSnackbarMessage(msg);
        setSnackbarOpen(true);
    }, []);

    // Escalation level tracking
    const [selectedLevelByShift, setSelectedLevelByShift] = useState<Record<number, EscalationLevelKey>>({});
    const [selectedSlotByShift, setSelectedSlotByShift] = useState<Record<number, number>>({});
    const [slotHasUpdatesByShift, setSlotHasUpdatesByShift] = useState<Record<number, Record<number, boolean>>>({});
    const [seenSlotSignatures, setSeenSlotSignatures] = useState<Record<string, string>>({});
    const [slotSeenReady, setSlotSeenReady] = useState(false);
    const latestSlotSignaturesRef = React.useRef<Record<string, string>>({});
    const reviewLoadingId: number | null = null;

    // Dialogs
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

    // Expanded shifts tracking
    const [expandedShifts, setExpandedShifts] = useState<Set<number>>(new Set());

    // Tab key generator
    const getTabKey = useCallback((shiftId: number, levelKey: EscalationLevelKey) => {
        return `${shiftId}_${levelKey}`;
    }, []);
    const seenStorageKey = useMemo(
        () => `${ACTIVE_SHIFT_SLOT_SEEN_KEY_PREFIX}:${user?.id ?? 'anon'}`,
        [user?.id]
    );

    // Data hooks
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

    const markShiftSlotsUpdated = useCallback((shiftId: number, slotIds: number[] | null) => {
        const shift = shifts.find((s) => s.id === shiftId);
        if (!shift) return;
        const targetSlotIds = (slotIds && slotIds.length > 0) ? slotIds : [];
        if (targetSlotIds.length === 0) return;
        setSlotHasUpdatesByShift((prev) => {
            const nextShiftState = { ...(prev[shiftId] || {}) };
            targetSlotIds.forEach((slotId) => {
                nextShiftState[slotId] = true;
            });
            return {
                ...prev,
                [shiftId]: nextShiftState,
            };
        });
    }, [shifts]);

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(seenStorageKey);
            const parsed = raw ? JSON.parse(raw) : {};
            if (parsed && typeof parsed === 'object') {
                setSeenSlotSignatures(parsed);
            } else {
                setSeenSlotSignatures({});
            }
        } catch {
            setSeenSlotSignatures({});
        } finally {
            setSlotSeenReady(true);
        }
    }, [seenStorageKey]);

    React.useEffect(() => {
        if (!slotSeenReady) return;
        try {
            localStorage.setItem(seenStorageKey, JSON.stringify(seenSlotSignatures));
        } catch {
            // ignore persistence failures
        }
    }, [seenSlotSignatures, seenStorageKey, slotSeenReady]);

    React.useEffect(() => {
        const onShiftSlotActivity = (evt: Event) => {
            const customEvt = evt as CustomEvent<any>;
            const notification = customEvt?.detail;
            const payload = notification?.payload || notification?.data || {};
            const shiftIdRaw = payload.shift_id ?? payload.shiftId;
            const shiftId = Number(shiftIdRaw);
            if (!Number.isFinite(shiftId)) return;

            const rawSlotIds = payload.slot_ids ?? payload.slotIds;
            const slotIdsFromList = Array.isArray(rawSlotIds)
                ? rawSlotIds.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value))
                : [];
            const slotIdRaw = payload.slot_id ?? payload.slotId;
            const slotIdSingle = Number(slotIdRaw);
            const slotIds = slotIdsFromList.length > 0
                ? slotIdsFromList
                : (Number.isFinite(slotIdSingle) ? [slotIdSingle] : null);

            markShiftSlotsUpdated(shiftId, slotIds);
        };

        window.addEventListener('shift-slot-activity', onShiftSlotActivity as EventListener);
        return () => {
            window.removeEventListener('shift-slot-activity', onShiftSlotActivity as EventListener);
        };
    }, [markShiftSlotsUpdated]);

    const getOfferSlotIds = useCallback((offer: any): number[] => {
        const offerSlots = offer?.slots || offer?.offer_slots || [];
        return offerSlots
            .map((s: any) => s.slot_id ?? s.slotId ?? s.slot?.id ?? null)
            .filter((id: any) => id != null);
    }, []);

    // Handle reveal interest
    const handleRevealInterest = useCallback(async (shift: Shift, interest: ShiftInterest) => {
        const levelKey = selectedLevelByShift[shift.id] ?? PUBLIC_LEVEL_KEY;

        resetWorkerRatings();
        let revealedUser: any = null;

        // Reveal if not already revealed
        if (!interest.revealed) {
            try {
                revealedUser = await revealInterest(shift, interest, levelKey);


                // Update counter offer cache if they have an offer
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
            // Already revealed, use existing user data
            revealedUser = interest.user || (interest as any).user_detail;
        }



        // Build candidate object - handle case where user is just a string
        const userObj = (typeof revealedUser === 'object' && revealedUser)
            ? revealedUser
            : (typeof interest.user === 'object' && interest.user)
                ? interest.user
                : (interest as any).user_detail;

        const interestAny = interest as any;

        const candidate = {
            userId: interest.userId ?? userObj?.id ?? null,
            name:
                // Try object properties first
                (userObj?.firstName && userObj?.lastName)
                    ? `${userObj.firstName} ${userObj.lastName}`
                    : (userObj?.first_name && userObj?.last_name)
                        ? `${userObj.first_name} ${userObj.last_name}`
                        : userObj?.name || userObj?.displayName || userObj?.display_name
                        // Fall back to string fields
                        || interestAny?.displayName
                        || (typeof interest.user === 'string' ? interest.user : null)
                        || interest?.userName
                        || 'Candidate',
            email: userObj?.email || interestAny?.email || '',
            shortBio: userObj?.shortBio || userObj?.short_bio || interestAny?.shortBio || interestAny?.short_bio || '',
        };

        // Load ratings
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

        // Open dialog (no counter offer, just showing interest)
        setReviewOfferDialog({
            open: true,
            shiftId: shift.id,
            offer: null,
            candidate,
            slotId: interest.slotId ?? null,
        });
    }, [revealInterest, selectedLevelByShift, counterOffersByShift, updateOfferCache, resetWorkerRatings, loadWorkerRatings, showSnackbar, loadCounterOffers]);

    // Handle review offer dialog
    const handleReviewOffer = useCallback(
        async (shift: Shift, offer: any, tabData: any, slotId: number | null) => {
            resetWorkerRatings();

            // Find the interest for this offer
            const interest = findInterestForOffer(offer, tabData, slotId);

            let revealedUser: any = null;

            // Reveal if necessary
            if (interest && !interest.revealed) {
                try {
                    const levelKey = selectedLevelByShift[shift.id] ?? PUBLIC_LEVEL_KEY;
                    revealedUser = await revealInterest(shift, interest, levelKey);

                    // Update offer cache
                    if (revealedUser) {
                        updateOfferCache(shift.id, offer.id, revealedUser);
                    }

                    await loadCounterOffers(shift.id); // Refresh to get user_detail
                } catch (error) {
                    console.error('Failed to reveal offer candidate', error);
                }
            }

            // Build candidate object
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

            // Load ratings
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

            console.log('[ActiveShifts] Review offer slot resolution', {
                shiftId: shift.id,
                offerId: offer?.id,
                slotId,
                offerSlotIds,
                resolvedSlotId,
            });

            // Map slots
            const mappedSlots = mapOfferSlotsWithShift(offer, shift, resolvedSlotId);

            // Open dialog
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
        ]
    );

    // Handle review candidate (community level)
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

            // Load ratings
            if (member.userId != null) {
                try {
                    await loadWorkerRatings(member.userId, 1);
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

            console.log('[ActiveShifts] Review candidate slot resolution', {
                shiftId: shift.id,
                offerId: offer?.id,
                slotId,
                offerSlotIds,
                resolvedSlotId,
            });

            // Map slots if offer exists
            const mappedSlots = offer ? mapOfferSlotsWithShift(offer, shift, resolvedSlotId) : [];

            setReviewOfferDialog({
                open: true,
                shiftId: shift.id,
                offer: offer ? { ...offer, _mappedSlots: mappedSlots } : null,
                candidate,
                slotId: resolvedSlotId,
            });
        },
        [resetWorkerRatings, loadWorkerRatings]
    );

    // Handle accept/reject counter offer
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
            console.log('[ActiveShifts] Accept counter offer payload', {
                shiftId,
                offerId: offer?.id,
                slotId,
                offerSlotIds,
                resolvedSlotId,
                requiresSlot,
            });
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

    // Toggle shift expansion
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

    // Handle level change
    const handleLevelChange = useCallback(
        (shift: Shift, newLevel: EscalationLevelKey) => {
            const currentLevelKey = getCurrentLevelKey(shift);
            const viewableLevels = deriveLevelSequence(currentLevelKey);
            if (!viewableLevels.includes(newLevel as CustomEscalationLevelKey)) {
                showSnackbar('Escalate to this level to review members status.');
                return;
            }
            setSelectedLevelByShift(prev => ({ ...prev, [shift.id]: newLevel }));
            loadTabDataForShift(shift, newLevel);
        },
        [loadTabDataForShift, showSnackbar]
    );

    const markSlotSeen = useCallback(
        (shiftId: number, slotId: number) => {
            const shift = shifts.find((s) => s.id === shiftId);
            if (!shift) return;
            const levelKey = selectedLevelByShift[shiftId] ?? getCurrentLevelKey(shift);
            const signatureKey = `${shiftId}:${levelKey}:${slotId}`;
            const latestSignature = latestSlotSignaturesRef.current[signatureKey];
            if (!latestSignature) return;
            setSeenSlotSignatures((prev) => {
                if (prev[signatureKey] === latestSignature) return prev;
                return { ...prev, [signatureKey]: latestSignature };
            });
            setSlotHasUpdatesByShift((prev) => ({
                ...prev,
                [shiftId]: {
                    ...(prev[shiftId] || {}),
                    [slotId]: false,
                },
            }));
        },
        [selectedLevelByShift, shifts]
    );

    // Handle slot selection
    const handleSlotSelection = useCallback((shiftId: number, slotId: number) => {
        setSelectedSlotByShift(prev => ({ ...prev, [shiftId]: slotId }));
        markSlotSeen(shiftId, slotId);
    }, [markSlotSeen]);

    const handleEditShift = useCallback((shiftId: number) => {
        const baseRoute =
            scopedPharmacyId != null
                ? `/dashboard/admin/${scopedPharmacyId}/post-shift`
                : user?.role?.startsWith('ORG_')
                    ? '/dashboard/organization/post-shift'
                    : '/dashboard/owner/post-shift';
        navigate(`${baseRoute}?edit=${shiftId}`);
    }, [navigate, scopedPharmacyId, user?.role]);

    const isDedicatedShift = useCallback((shift: Shift) => {
        const shiftAny = shift as any;
        return Boolean(shiftAny.dedicatedUser ?? shiftAny.dedicated_user);
    }, []);

    const getLevelLabel = useCallback((level: EscalationLevelKey) => {
        const labels: Record<EscalationLevelKey, string> = {
            FULL_PART_TIME: 'My Pharmacy',
            LOCUM_CASUAL: 'Favourites',
            OWNER_CHAIN: 'Chain',
            ORG_CHAIN: 'Organization',
            PLATFORM: 'Platform',
        };
        return labels[level] ?? level.replace(/_/g, ' ');
    }, []);

    const renderShiftCard = (shift: Shift, dedicated: boolean) => {
        const isExpanded = expandedShifts.has(shift.id);
        const isSingleUserShift = Boolean((shift as any).singleUserOnly);
        const shiftLevel = getCurrentLevelKey(shift);
        const selectedLevel = selectedLevelByShift[shift.id] ?? shiftLevel;
        const tabKey = getTabKey(shift.id, selectedLevel);
        const currentTabData = tabData[tabKey] || { loading: false };
        const selectedSlotId = isSingleUserShift
            ? null
            : selectedSlotByShift[shift.id] ?? shift.slots?.[0]?.id ?? null;
        const offers = counterOffersByShift[shift.id];
        const counterOffersLoaded = Object.prototype.hasOwnProperty.call(counterOffersByShift, shift.id);
        const counterOffersLoading = counterOffersLoadingByShift[shift.id] ?? false;
        const membersForView = isSingleUserShift
            ? currentTabData.members || []
            : currentTabData.membersBySlot?.[selectedSlotId ?? -1] || [];

        const cardBorderColor = getCardBorderColor((shift as any).visibility ?? 'PLATFORM');
        const summaryText = getShiftSummary(shift);
        const location = getLocationText(shift);
        const labelOverrides = undefined;
        const candidatesLabel = dedicated ? 'Direct / Private' : getLevelLabel(selectedLevel);

        return (
            <Card
                key={shift.id}
                sx={{
                    boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
                    borderLeft: `4px solid ${cardBorderColor}`,
                }}
            >
                <CardHeader
                    disableTypography
                    title={
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                            {(shift as any).pharmacyDetail?.name ?? "Unnamed Pharmacy"}
                        </Typography>
                    }
                    subheader={
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip
                                label={(shift as any).roleNeeded}
                                size="small"
                                sx={{ backgroundColor: cardBorderColor, color: 'white', fontWeight: 500 }}
                            />
                            {(shift as any).employmentType && (
                                <Chip label={(shift as any).employmentType} size="small" variant="outlined" />
                            )}
                            {(shift as any).isUrgent && <Chip label="Urgent" color="error" size="small" />}
                            {summaryText && (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                    <CalendarDays sx={{ fontSize: 16 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {summaryText}
                                    </Typography>
                                </Box>
                            )}
                        </Stack>
                    }
                    action={
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <Tooltip title="Share">
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleShare(shift);
                                        }}
                                        disabled={sharingShiftId === shift.id}
                                    >
                                        <Share2 fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="Edit">
                                <IconButton
                                    size="small"
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleEditShift(shift.id);
                                    }}
                                >
                                    <Edit fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                                <IconButton
                                    size="small"
                                    onClick={e => {
                                        e.stopPropagation();
                                        setDeleteConfirmDialog({ open: true, shiftId: shift.id });
                                    }}
                                    disabled={actionLoading[`delete_${shift.id}`]}
                                >
                                    <Trash2 fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <IconButton
                                size="small"
                                onClick={e => {
                                    e.stopPropagation();
                                    toggleShiftExpansion(shift.id);
                                }}
                                sx={{
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                }}
                            >
                                <ChevronDown fontSize="small" />
                            </IconButton>
                        </Box>
                    }
                />
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Building sx={{ fontSize: 16 }} />
                        <Typography variant="body2" color="text.secondary">
                            {location}
                        </Typography>
                    </Box>

                    {dedicated && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                            <Chip label="Direct / Private" color="info" size="small" />
                            <Chip label="Pending" variant="outlined" size="small" />
                        </Box>
                    )}

                    {isExpanded && (
                        <>
                            <Divider sx={{ my: 2 }} />

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
                                    showPrivateFirst={dedicated}
                                />

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                <Divider sx={{ flex: 1 }} />
                                <Chip label={`Candidates for ${candidatesLabel}`} />
                                <Divider sx={{ flex: 1 }} />
                            </Box>

                            {currentTabData.loading ? (
                                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                                    <CircularProgress />
                                </Box>
                            ) : selectedLevel === PUBLIC_LEVEL_KEY ? (
                                counterOffersLoading || !counterOffersLoaded ? (
                                    <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    <PublicLevelView
                                        shift={shift}
                                        slotId={selectedSlotId}
                                        slotHasUpdates={slotHasUpdatesByShift[shift.id] || {}}
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
                                    slotHasUpdates={slotHasUpdatesByShift[shift.id] || {}}
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
                </CardContent>
            </Card>
        );
    };

    // Load counter offers when shift expands
    React.useEffect(() => {
        expandedShifts.forEach(shiftId => {
            if (!counterOffersByShift[shiftId]) {
                loadCounterOffers(shiftId);
            }
        });
    }, [expandedShifts, counterOffersByShift, loadCounterOffers]);

    React.useEffect(() => {
        if (!slotSeenReady) return;

        const nextUpdatesByShift: Record<number, Record<number, boolean>> = {};
        const nextSignatures: Record<string, string> = {};
        const baselineMissing: Record<string, string> = {};

        shifts.forEach((shift) => {
            const isSingleUserShift = Boolean((shift as any).singleUserOnly);
            if (isSingleUserShift) return;

            const slotIds = getSlotIds(shift);
            if (slotIds.length === 0) return;

            const levelKey = selectedLevelByShift[shift.id] ?? getCurrentLevelKey(shift);
            const tabKey = getTabKey(shift.id, levelKey);
            const currentTabData = tabData[tabKey] || {};

            // Avoid creating a false "seen baseline" from empty/loading state.
            const tabDataReady = Object.prototype.hasOwnProperty.call(tabData, tabKey) && !currentTabData.loading;
            if (!tabDataReady) return;

            // Slot signatures include offers, so wait until they are loaded.
            const offersReady = Object.prototype.hasOwnProperty.call(counterOffersByShift, shift.id);
            if (!offersReady) return;

            const offers = counterOffersByShift[shift.id] || [];

            slotIds.forEach((slotId) => {
                const signature =
                    levelKey === PUBLIC_LEVEL_KEY
                        ? buildPublicSlotSignature(slotId, currentTabData.interestsAll || [], offers)
                        : buildMemberSlotSignature(slotId, currentTabData.membersBySlot?.[slotId] || [], offers);
                const signatureKey = `${shift.id}:${levelKey}:${slotId}`;
                nextSignatures[signatureKey] = signature;

                const seen = seenSlotSignatures[signatureKey];
                if (seen == null) {
                    baselineMissing[signatureKey] = signature;
                    return;
                }
                if (seen !== signature) {
                    if (!nextUpdatesByShift[shift.id]) nextUpdatesByShift[shift.id] = {};
                    nextUpdatesByShift[shift.id][slotId] = true;
                }
            });
        });

        latestSlotSignaturesRef.current = nextSignatures;
        setSlotHasUpdatesByShift(nextUpdatesByShift);
        if (Object.keys(baselineMissing).length > 0) {
            setSeenSlotSignatures((prev) => ({ ...prev, ...baselineMissing }));
        }
    }, [
        shifts,
        tabData,
        counterOffersByShift,
        selectedLevelByShift,
        getTabKey,
        seenSlotSignatures,
        slotSeenReady,
    ]);

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
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <ThemeProvider theme={customTheme}>
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h4" fontWeight="bold">
                        {title}
                    </Typography>
                </Box>

                {shifts.length === 0 ? (
                    <Typography variant="body1" color="text.secondary">
                        No active shifts found.
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {orderedShifts.map((shift, idx) => {
                            const isDedicated = isDedicatedShift(shift);
                            const prev = idx > 0 ? orderedShifts[idx - 1] : null;
                            const showSectionHeader =
                                idx === 0 || (prev && isDedicatedShift(prev) !== isDedicated);
                            return (
                                <React.Fragment key={shift.id}>
                                    {showSectionHeader && (
                                        <Box sx={{ px: 1, pt: idx === 0 ? 0 : 2 }}>
                                            <Typography variant="overline" color="text.secondary">
                                                {isDedicated ? 'Direct / Private Offers' : 'Active Shifts'}
                                            </Typography>
                                        </Box>
                                    )}
                                    {renderShiftCard(shift, isDedicated)}
                                </React.Fragment>
                            );
                        })}
                    </Stack>
                )}

                {/* Dialogs */}
                <DeleteConfirmDialog
                    open={deleteConfirmDialog.open}
                    loading={deleteConfirmDialog.shiftId ? actionLoading[`delete_${deleteConfirmDialog.shiftId}`] ?? false : false}
                    onClose={() => setDeleteConfirmDialog({ open: false, shiftId: null })}
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
                    open={reviewOfferDialog.open}
                    offer={reviewOfferDialog.offer}
                    candidate={reviewOfferDialog.candidate}
                    slotId={reviewOfferDialog.slotId}
                    assignLabel={
                        reviewOfferDialog.slotId != null
                            ? 'Assign to Slot'
                            : 'Assign to Shift'
                    }
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
                    onClose={() => setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null })}
                    onAccept={(offer) => handleAcceptOffer(offer, reviewOfferDialog.shiftId, reviewOfferDialog.slotId)}
                    onReject={(offer) => handleRejectOffer(offer, reviewOfferDialog.shiftId)}
                    onAssign={(userId, slotId) => handleAssignCandidate(userId, reviewOfferDialog.shiftId, slotId)}
                    onPageChange={(_, value) => {
                        if (reviewOfferDialog.candidate) {
                            // Re-load ratings for the new page
                            const userId = (reviewOfferDialog.offer?.user as any)?.id ?? reviewOfferDialog.candidate?.userId;
                            if (userId) {
                                loadWorkerRatings(userId, value);
                            }
                        }
                    }}
                />

                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={4000}
                    onClose={() => setSnackbarOpen(false)}
                    message={snackbarMessage}
                    action={
                        <IconButton size="small" color="inherit" onClick={() => setSnackbarOpen(false)}>
                            <X />
                        </IconButton>
                    }
                />
            </Container>
        </ThemeProvider>
    );
};

export default ActiveShiftsPage;

