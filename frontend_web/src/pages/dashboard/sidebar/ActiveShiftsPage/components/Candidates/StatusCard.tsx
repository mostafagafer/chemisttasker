import React from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Avatar,
    Typography,
    Chip,
    Stack,
    Paper,
    Button,
    CircularProgress,
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { ShiftMemberStatus } from '@chemisttasker/shared-core';

interface StatusCardProps {
    title: string;
    members: ShiftMemberStatus[];
    icon: React.ReactElement;
    color: 'success' | 'error' | 'warning' | 'info';
    shiftId: number;
    onReviewCandidate: (member: ShiftMemberStatus, shiftId: number, offer: any | null, slotId: number | null) => void;
    getOfferForMember?: (member: ShiftMemberStatus) => { offer: any | null; slotId: number | null };
    reviewLoadingId?: number | null;
}

export const StatusCard: React.FC<StatusCardProps> = ({
    title,
    members,
    icon,
    color,
    shiftId,
    onReviewCandidate,
    getOfferForMember,
    reviewLoadingId,
}) => {
    return (
        <Card
            sx={{
                background: '#F9FAFB',
                boxShadow: 'none',
                border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
        >
            <CardHeader
                avatar={
                    <Avatar
                        sx={{
                            bgcolor: (theme) => theme.palette[color].light,
                            color: (theme) => theme.palette[color].dark,
                        }}
                    >
                        {icon}
                    </Avatar>
                }
                title={
                    <Typography
                        variant="h6"
                        sx={{ fontWeight: 'bold', color: (theme) => theme.palette[color].dark }}
                    >
                        {title}
                    </Typography>
                }
                action={
                    <Chip
                        label={members.length}
                        size="small"
                        sx={{
                            backgroundColor: (theme) => theme.palette[color].dark,
                            color: 'white',
                            fontWeight: 'bold',
                        }}
                    />
                }
            />
            <CardContent>
                {members.length > 0 ? (
                    <Stack spacing={2}>
                        {members.map((member) => {
                            const memberAny = member as any;
                            const ratingValue = memberAny.averageRating ?? memberAny.rating ?? null;
                            return (
                                <Paper key={memberAny.userId} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Stack>
                                            <Typography variant="body1" fontWeight="bold">
                                                {memberAny.name || `${memberAny.first_name} ${memberAny.last_name}`}
                                            </Typography>
                                            {memberAny.employmentType && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {memberAny.employmentType}
                                                </Typography>
                                            )}
                                        </Stack>
                                        {ratingValue ? (
                                            <Chip
                                                icon={<Star sx={{ fontSize: 16 }} />}
                                                label={ratingValue.toFixed(1)}
                                                size="small"
                                                color="warning"
                                                variant="outlined"
                                            />
                                        ) : null}
                                    </Stack>
                                    {title === 'Interested' && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="secondary"
                                            fullWidth
                                            sx={{ mt: 1.5 }}
                                            onClick={() => {
                                                const match = getOfferForMember
                                                    ? getOfferForMember(member)
                                                    : { offer: null, slotId: null };
                                                onReviewCandidate(member, shiftId, match.offer, match.slotId);
                                            }}
                                            disabled={reviewLoadingId === memberAny.userId}
                                            startIcon={
                                                reviewLoadingId === memberAny.userId ? (
                                                    <CircularProgress size={16} color="inherit" />
                                                ) : undefined
                                            }
                                        >
                                            Review Candidate
                                        </Button>
                                    )}
                                </Paper>
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        No candidates yet.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
};
