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
    getCurrentLevelKey,
    getShiftSummary,
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
    const { actionLoading, handleEscalate, handleDelete } = useShiftActions(setShifts, showSnackbar);
    const { sharingShiftId, handleShare } = useShareShift(showSnackbar);

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

            // Map slots
            const mappedSlots = mapOfferSlotsWithShift(offer, shift, slotId);

            // Open dialog
            setReviewOfferDialog({
                open: true,
                shiftId: shift.id,
                offer: { ...offer, _mappedSlots: mappedSlots },
                candidate,
                slotId,
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

            // Map slots if offer exists
            const mappedSlots = offer ? mapOfferSlotsWithShift(offer, shift, slotId) : [];

            setReviewOfferDialog({
                open: true,
                shiftId: shift.id,
                offer: offer ? { ...offer, _mappedSlots: mappedSlots } : null,
                candidate,
                slotId,
            });
        },
        [resetWorkerRatings, loadWorkerRatings]
    );

    // Handle accept/reject counter offer
    const handleAcceptOffer = useCallback(
        async (offer: any, shiftId: number | null, slotId: number | null) => {
            if (!offer || shiftId == null) return;
            await acceptOffer({ offer, shiftId, slotId }, async () => {
                showSnackbar('Counter offer accepted');
                setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null });
                await loadShifts();
            });
        },
        [acceptOffer, showSnackbar, loadShifts]
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
            setSelectedLevelByShift(prev => ({ ...prev, [shift.id]: newLevel }));
            loadTabDataForShift(shift, newLevel);
        },
        [loadTabDataForShift]
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
                        {shifts.map(shift => {
                            const isExpanded = expandedShifts.has(shift.id);
                            // Use shift's actual visibility level, not PUBLIC as default
                            const shiftLevel = getCurrentLevelKey(shift);
                            const currentLevel = selectedLevelByShift[shift.id] ?? shiftLevel;
                            const tabKey = getTabKey(shift.id, currentLevel);
                            const currentTabData = tabData[tabKey] || { loading: false };
                            const selectedSlotId = selectedSlotByShift[shift.id] ?? shift.slots?.[0]?.id ?? null;
                            const offers = counterOffersByShift[shift.id];
                            const counterOffersLoaded = Object.prototype.hasOwnProperty.call(counterOffersByShift, shift.id);
                            const counterOffersLoading = counterOffersLoadingByShift[shift.id] ?? false;

                            const cardBorderColor = getCardBorderColor((shift as any).visibility ?? 'PLATFORM');
                            const summaryText = getShiftSummary(shift);
                            const location = getLocationText(shift);

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
                                                    <ChevronDown />
                                                </IconButton>
                                            </Box>
                                        }
                                        sx={{ pb: isExpanded ? 1 : 2 }}
                                    />
                                    <CardContent sx={{ pt: 0 }}>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                                gap: 2,
                                                mb: 2,
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                                color="text.secondary"
                                            >
                                                <Building sx={{ fontSize: 16 }} />
                                                {location}
                                            </Typography>
                                        </Box>

                                        {isExpanded && (
                                            <>
                                                <CardContent>
                                                    {shift.description && (
                                                        <Typography
                                                            variant="body2"
                                                            color="text.primary"
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'flex-start',
                                                                gap: 1,
                                                                my: 2,
                                                                whiteSpace: 'pre-wrap',
                                                                bgcolor: '#F9FAFB',
                                                                p: 1.5,
                                                                borderRadius: 2,
                                                                border: '1px solid #E5E7EB',
                                                            }}
                                                        >
                                                            {shift.description}
                                                        </Typography>
                                                    )}

                                                    {/* Escalation Stepper - Inline from backup */}
                                                    <EscalationStepper
                                                        shift={shift}
                                                        currentLevel={currentLevel as any}
                                                        selectedLevel={currentLevel as any}
                                                        onSelectLevel={(levelKey: any) => handleLevelChange(shift, levelKey)}
                                                        onEscalate={(_s: any, _levelKey: any) => {
                                                            // Escalate logic here
                                                            handleEscalate(shift.id);
                                                        }}
                                                        escalating={actionLoading[`escalate_${shift.id}`]}
                                                    />

                                                    <Divider sx={{ my: 3 }}>
                                                        <Chip label={`Candidates for ${currentLevel}`} />
                                                    </Divider>

                                                    {/* Content based on level */}
                                                    {currentTabData.loading ? (
                                                        <Box display="flex" justifyContent="center" py={4}>
                                                            <CircularProgress />
                                                        </Box>
                                                    ) : currentLevel === PUBLIC_LEVEL_KEY ? (
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
                                                            members={
                                                                currentTabData.membersBySlot?.[
                                                                    selectedSlotId ?? -1
                                                                ] || []
                                                            }
                                                            selectedSlotId={selectedSlotId}
                                                            offers={offers || []}
                                                            onSelectSlot={(slotId) => handleSlotSelection(shift.id, slotId)}
                                                            onReviewCandidate={(member, _shiftId, offer, slotId) => handleReviewCandidate(shift, member, offer, slotId)}
                                                            reviewLoadingId={reviewLoadingId}
                                                        />
                                                    )}
                                                </CardContent>
                                            </>
                                        )}
                                    </CardContent>
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
                    workerRatingSummary={workerRatingSummary}
                    workerRatingComments={workerRatingComments}
                    workerCommentsPage={workerCommentsPage}
                    workerCommentsPageCount={workerCommentsPageCount}
                    counterActionLoading={counterActionLoading}
                    onClose={() => setReviewOfferDialog({ open: false, shiftId: null, offer: null, candidate: null, slotId: null })}
                    onAccept={(offer) => handleAcceptOffer(offer, reviewOfferDialog.shiftId, reviewOfferDialog.slotId)}
                    onReject={(offer) => handleRejectOffer(offer, reviewOfferDialog.shiftId)}
                    onPageChange={(_, value) => {
                        if (reviewOfferDialog.candidate) {
                            // Re-load ratings for the new page
                            const userId = (reviewOfferDialog.offer?.user as any)?.id;
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
