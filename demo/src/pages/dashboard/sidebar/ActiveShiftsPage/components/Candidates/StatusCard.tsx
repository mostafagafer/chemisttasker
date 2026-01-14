import React from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Avatar,
    Typography,
    Chip,
    Stack,
    Box,
    Button,
    CircularProgress,
    Divider,
} from '@mui/material';
import { Star, Person } from '@mui/icons-material';
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
                background: '#FFFFFF',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden'
            }}
        >
            <CardHeader
                avatar={
                    <Avatar
                        sx={{
                            bgcolor: (theme) => theme.palette[color].light,
                            color: (theme) => theme.palette[color].dark,
                            width: 32,
                            height: 32
                        }}
                    >
                        {React.cloneElement(icon as React.ReactElement<any>, { fontSize: 'small' })}
                    </Avatar>
                }
                title={
                    <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, color: (theme) => theme.palette[color].dark }}
                    >
                        {title}
                    </Typography>
                }
                action={
                    <Chip
                        label={members.length}
                        size="small"
                        sx={{
                            backgroundColor: (theme) => theme.palette[color].main,
                            color: 'white',
                            fontWeight: 'bold',
                            height: 20,
                            fontSize: '0.7rem'
                        }}
                    />
                }
                sx={{
                    py: 1.5,
                    px: 2,
                    borderBottom: '1px solid',
                    borderColor: 'rgba(0,0,0,0.04)'
                }}
            />
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {members.length > 0 ? (
                    <Stack divider={<Divider />}>
                        {members.map((member) => {
                            const memberAny = member as any;
                            const ratingValue = memberAny.averageRating ?? memberAny.rating ?? null;
                            const match = getOfferForMember
                                ? getOfferForMember(member)
                                : { offer: null, slotId: null };
                            const hasOffer = Boolean(match.offer);
                            const name = memberAny.name || `${memberAny.first_name} ${memberAny.last_name}`;
                            const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                            return (
                                <Box
                                    key={memberAny.userId}
                                    sx={{
                                        p: 2,
                                        transition: 'background-color 0.2s',
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <Stack direction="row" spacing={2} alignItems="flex-start">
                                        <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.light', fontSize: '0.875rem' }}>
                                            {initials || <Person />}
                                        </Avatar>

                                        <Box flex={1}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        {name}
                                                    </Typography>
                                                    {memberAny.employmentType && (
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {memberAny.employmentType}
                                                        </Typography>
                                                    )}
                                                </Box>

                                                <Stack direction="column" alignItems="flex-end" spacing={0.5}>
                                                    {ratingValue && (
                                                        <Box display="flex" alignItems="center" bgcolor="warning.light" px={0.5} py={0.25} borderRadius={1}>
                                                            <Star sx={{ fontSize: 12, color: 'warning.dark', mr: 0.5 }} />
                                                            <Typography variant="caption" fontWeight="bold" color="warning.dark">
                                                                {ratingValue.toFixed(1)}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Stack>
                                            </Stack>

                                            <Stack direction="row" alignItems="center" justifyContent="space-between" mt={1.5}>
                                                <Box>
                                                    {title === 'Interested' && hasOffer && (
                                                        <Chip label="Counter offer" size="small" color="info" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                    )}
                                                </Box>

                                                {title === 'Interested' && (
                                                    <Button
                                                        size="small"
                                                        variant={hasOffer ? "contained" : "outlined"}
                                                        color={hasOffer ? "primary" : "secondary"}
                                                        onClick={() => {
                                                            onReviewCandidate(member, shiftId, match.offer, match.slotId);
                                                        }}
                                                        disabled={reviewLoadingId === memberAny.userId}
                                                        startIcon={
                                                            reviewLoadingId === memberAny.userId ? (
                                                                <CircularProgress size={16} color="inherit" />
                                                            ) : undefined
                                                        }
                                                        sx={{
                                                            minWidth: 100,
                                                            borderRadius: 20,
                                                            py: 0.5,
                                                            fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        {hasOffer ? 'Review Offer' : 'Review'}
                                                    </Button>
                                                )}
                                            </Stack>
                                        </Box>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center', fontStyle: 'italic' }}>
                        No candidates here yet.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
};
