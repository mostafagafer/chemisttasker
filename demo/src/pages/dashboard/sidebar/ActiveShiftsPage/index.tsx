import React, { useState, useCallback } from 'react';
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

    // Handle slot selection
    const handleSlotSelection = useCallback((shiftId: number, slotId: number) => {
        setSelectedSlotByShift(prev => ({ ...prev, [shiftId]: slotId }));
    }, []);

    const handleEditShift = useCallback((shiftId: number) => {
        const baseRoute =
            scopedPharmacyId != null
                ? `/dashboard/admin/${scopedPharmacyId}/post-shift`
                : user?.role?.startsWith('ORG_')
                    ? '/dashboard/organization/post-shift'
                    : '/dashboard/owner/post-shift';
        navigate(`${baseRoute}?edit=${shiftId}`);
    }, [navigate, scopedPharmacyId, user?.role]);

    // Load counter offers when shift expands
    React.useEffect(() => {
        expandedShifts.forEach(shiftId => {
            if (!counterOffersByShift[shiftId]) {
                loadCounterOffers(shiftId);
            }
        });
    }, [expandedShifts, counterOffersByShift, loadCounterOffers]);

    if (shiftsLoading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="50vh" gap={2}>
                    <CircularProgress size={40} thickness={4} />
                    <Typography variant="body2" color="text.secondary">Loading your shifts...</Typography>
                </Box>
            </Container>
        );
    }

    return (
        <ThemeProvider theme={customTheme}>
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ background: 'linear-gradient(45deg, #111827 30%, #4B5563 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage your active listings, review candidates, and handle shift escalations.
                    </Typography>
                </Box>

                {shifts.length === 0 ? (
                    <Box
                        sx={{
                            textAlign: 'center',
                            py: 8,
                            px: 2,
                            borderRadius: 4,
                            bgcolor: 'background.paper',
                            border: '1px dashed',
                            borderColor: 'divider',
                            opacity: 0.8
                        }}
                    >
                        <CalendarDays sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6" color="text.primary" gutterBottom>
                            No active shifts found
                        </Typography>
                        <Typography variant="body2" color="text.secondary" maxWidth="sm" mx="auto">
                            You don't have any active shifts at the moment. Create a new shift to get started with finding candidates.
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={3}>
                        {shifts.map(shift => {
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

                            const statusColor = getCardBorderColor((shift as any).visibility ?? 'PLATFORM');
                            const summaryText = getShiftSummary(shift);
                            const location = getLocationText(shift);

                            return (
                                <Card
                                    key={shift.id}
                                    sx={{
                                        position: 'relative',
                                        overflow: 'visible',
                                    }}
                                >
                                    {/* Status Indicator Strip */}
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 16,
                                            bottom: 16,
                                            width: 4,
                                            bgcolor: statusColor,
                                            borderRadius: '0 4px 4px 0'
                                        }}
                                    />

                                    <CardHeader
                                        title={
                                            <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                                                <Typography variant="h6" fontWeight="700">
                                                    {(shift as any).pharmacyDetail?.name ?? "Unnamed Pharmacy"}
                                                </Typography>
                                                {summaryText && (
                                                    <Chip
                                                        icon={<CalendarDays sx={{ fontSize: '14px !important' }} />}
                                                        label={summaryText}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ borderColor: 'divider', fontWeight: 500 }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                        subheader={
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                                                <Chip
                                                    label={(shift as any).roleNeeded}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: statusColor,
                                                        color: '#fff',
                                                        fontWeight: 600,
                                                        border: 'none'
                                                    }}
                                                />

                                                {(shift as any).isUrgent && (
                                                    <Chip
                                                        label="Urgent"
                                                        color="error"
                                                        size="small"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                )}

                                                {(shift as any).employmentType && (
                                                    <Chip
                                                        label={(shift as any).employmentType}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </Stack>
                                        }
                                        action={
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: 2 }}>
                                                <Tooltip title="Share">
                                                    <IconButton
                                                        size="small"
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleShare(shift);
                                                        }}
                                                        disabled={sharingShiftId === shift.id}
                                                        sx={{
                                                            bgcolor: 'action.hover',
                                                            '&:hover': { bgcolor: 'action.selected', color: 'primary.main' }
                                                        }}
                                                    >
                                                        <Share2 fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleEditShift(shift.id);
                                                        }}
                                                        sx={{
                                                            bgcolor: 'action.hover',
                                                            '&:hover': { bgcolor: 'action.selected', color: 'info.main' }
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
                                                        sx={{
                                                            bgcolor: 'action.hover',
                                                            '&:hover': { bgcolor: 'error.lighter', color: 'error.main' }
                                                        }}
                                                    >
                                                        <Trash2 fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <IconButton
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        toggleShiftExpansion(shift.id);
                                                    }}
                                                    sx={{
                                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        bgcolor: isExpanded ? 'primary.light' : 'transparent',
                                                        color: isExpanded ? 'white' : 'action.active',
                                                        '&:hover': { bgcolor: isExpanded ? 'primary.main' : 'action.hover' }
                                                    }}
                                                >
                                                    <ChevronDown />
                                                </IconButton>
                                            </Box>
                                        }
                                        sx={{ px: 3, pt: 3, pb: isExpanded ? 1 : 3 }}
                                    />

                                    <CardContent sx={{ px: 3, pt: 0, pb: isExpanded ? 0 : 3 }}>
                                        <Box display="flex" alignItems="center" gap={1} color="text.secondary" ml={2}>
                                            <Building sx={{ fontSize: 18, color: 'text.disabled' }} />
                                            <Typography variant="body2" fontWeight={500}>
                                                {location}
                                            </Typography>
                                        </Box>

                                        {isExpanded && (
                                            <Box sx={{ mt: 3, animation: 'fadeIn 0.3s ease-in' }}>
                                                {/* Styles for animation */}
                                                <style>
                                                    {`@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}
                                                </style>

                                                {shift.description && (
                                                    <Box
                                                        sx={{
                                                            p: 2.5,
                                                            bgcolor: 'background.default',
                                                            borderRadius: 2,
                                                            border: '1px solid',
                                                            borderColor: 'divider',
                                                            mb: 4
                                                        }}
                                                    >
                                                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            Job Description
                                                        </Typography>
                                                        <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                            {shift.description}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                <EscalationStepper
                                                    shift={shift}
                                                    currentLevel={shiftLevel as any}
                                                    selectedLevel={selectedLevel as any}
                                                    onSelectLevel={(levelKey: any) => handleLevelChange(shift, levelKey)}
                                                    onEscalate={async (_s: any, _levelKey: any) => {
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
                                                />

                                                <Divider sx={{ my: 4 }}>
                                                    <Chip
                                                        label={`Candidates`}
                                                        size="small"
                                                        sx={{ fontWeight: 500, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                                                    />
                                                </Divider>

                                                <Box sx={{ minHeight: 100 }}>
                                                    {currentTabData.loading ? (
                                                        <Box display="flex" justifyContent="center" py={4}>
                                                            <CircularProgress />
                                                        </Box>
                                                    ) : selectedLevel === PUBLIC_LEVEL_KEY ? (
                                                        counterOffersLoading || !counterOffersLoaded ? (
                                                            <Box display="flex" justifyContent="center" py={4}>
                                                                <CircularProgress />
                                                            </Box>
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
                                                            onReviewCandidate={(member, _shiftId, offer, slotId) => handleReviewCandidate(shift, member, offer, slotId)}
                                                            reviewLoadingId={reviewLoadingId}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                        )}
                                    </CardContent>

                                    {/* Action Footer (Optional, mostly handled in header/content) */}
                                    {isExpanded && <Box sx={{ height: 16 }} />}
                                </Card>
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
