import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Stack,
    Paper,
    Divider,
    Chip,
    CircularProgress,
    Rating,
    Skeleton,
    Pagination,
} from '@mui/material';

interface CounterOfferDialogProps {
    open: boolean;
    offer: any | null;
    candidate: any | null;
    slotId: number | null;
    workerRatingSummary: any;
    workerRatingComments: any[];
    workerCommentsPage: number;
    workerCommentsPageCount: number;
    counterActionLoading: number | null;
    onClose: () => void;
    onAccept: (offer: any) => void;
    onReject: (offer: any) => void;
    onPageChange: (_: React.ChangeEvent<unknown>, value: number) => void;
}

export const CounterOfferDialog: React.FC<CounterOfferDialogProps> = ({
    open,
    offer,
    candidate,
    slotId,
    workerRatingSummary,
    workerRatingComments,
    workerCommentsPage,
    workerCommentsPageCount,
    counterActionLoading,
    onClose,
    onAccept,
    onReject,
    onPageChange,
}) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 'bold' }}>
                {offer ? 'Counter Offer' : 'Candidate Review'}
            </DialogTitle>
            <DialogContent dividers>
                {candidate || offer ? (
                    <Stack spacing={1.5}>
                        {/* Candidate Information */}
                        {candidate && (
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="subtitle2">Candidate</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {candidate.name || 'Candidate'}
                                </Typography>
                                {candidate.shortBio && (
                                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                                        {candidate.shortBio}
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {/* Only show offer details if there is an offer */}
                        {offer && (
                            <>
                                {/* Message */}
                                {offer.message && (
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {offer.message}
                                    </Typography>
                                )}

                                <Divider sx={{ my: 1 }} />

                                {/* Offer Slots */}
                                {(() => {
                                    const rawSlots = offer._mappedSlots || offer.slots || [];
                                    const filterId = slotId;
                                    const visible =
                                        filterId == null
                                            ? rawSlots
                                            : rawSlots.filter(
                                                (s: any) =>
                                                    (s.slotId ?? s.slot_id ?? s.slot?.id ?? s.id) === filterId
                                            );
                                    return (visible.length ? visible : rawSlots).map((slot: any, idx: number) => (
                                        <Paper
                                            key={`${slot.slotId ?? slot.id ?? idx}-${slot.slotDate ?? slot.slot?.date ?? slot.date ?? idx
                                                }`}
                                            variant="outlined"
                                            sx={{ p: 1.5, borderRadius: 2 }}
                                        >
                                            <Typography variant="body2" fontWeight="bold">
                                                {slot.date || slot.slotDate || slot.slot?.date
                                                    ? new Date(
                                                        slot.date || slot.slotDate || slot.slot?.date!
                                                    ).toLocaleDateString()
                                                    : 'Shift-wide'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {(
                                                    slot.proposedStart ??
                                                    slot.proposedStartTime ??
                                                    slot.proposed_start_time ??
                                                    slot.startTime ??
                                                    slot.start_time
                                                )?.slice(0, 5)}{' '}
                                                -{' '}
                                                {(
                                                    slot.proposedEnd ??
                                                    slot.proposedEndTime ??
                                                    slot.proposed_end_time ??
                                                    slot.endTime ??
                                                    slot.end_time
                                                )?.slice(0, 5)}
                                            </Typography>
                                            {slot.proposedRate != null ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    Proposed rate: ${slot.proposedRate}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    Proposed rate: N/A
                                                </Typography>
                                            )}
                                        </Paper>
                                    ));
                                })()}

                                {/* Travel Support */}
                                {offer.requestTravel && (
                                    <Chip size="small" color="info" label="Requested travel support" />
                                )}

                                <Divider sx={{ my: 2 }} />
                            </>
                        )}

                        {/* Ratings & Reviews - Always show if we have candidate info */}
                        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Ratings & Reviews
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {workerRatingSummary ? (
                                <>
                                    <Rating
                                        value={workerRatingSummary.average}
                                        precision={0.5}
                                        readOnly
                                    />
                                    <Typography variant="body1" color="text.secondary">
                                        {workerRatingSummary.average.toFixed(1)} (
                                        {workerRatingSummary.count} reviews)
                                    </Typography>
                                </>
                            ) : (
                                <Skeleton variant="rectangular" width={200} height={28} />
                            )}
                        </Box>
                        <Box sx={{ display: 'grid', gap: 1.5, mt: 2 }}>
                            {workerRatingComments.map((comment) => (
                                <Paper
                                    key={comment.id}
                                    variant="outlined"
                                    sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Rating value={comment.stars} readOnly size="small" />
                                        {comment.createdAt && (
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(comment.createdAt).toLocaleDateString()}
                                            </Typography>
                                        )}
                                    </Box>
                                    {comment.comment && (
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {comment.comment}
                                        </Typography>
                                    )}
                                </Paper>
                            ))}
                            {workerRatingComments.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    No reviews yet.
                                </Typography>
                            )}
                            {workerCommentsPageCount > 1 && (
                                <Box display="flex" justifyContent="center" mt={1}>
                                    <Pagination
                                        count={workerCommentsPageCount}
                                        page={workerCommentsPage}
                                        onChange={onPageChange}
                                        color="primary"
                                        size="small"
                                    />
                                </Box>
                            )}
                        </Box>
                    </Stack>
                ) : (
                    <Typography color="text.secondary">No candidate information available.</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                {offer && (
                    <>
                        <Button
                            variant="contained"
                            color="success"
                            onClick={() => onAccept(offer)}
                            disabled={counterActionLoading === offer.id}
                            startIcon={
                                counterActionLoading === offer.id ? (
                                    <CircularProgress size={16} color="inherit" />
                                ) : undefined
                            }
                        >
                            Accept offer
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => onReject(offer)}
                            disabled={counterActionLoading === offer.id}
                        >
                            Reject offer
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};
