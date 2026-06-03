import React from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Avatar,
    Box,
    Typography,
    Chip,
    Stack,
    Paper,
    Button,
    CircularProgress,
} from '@mui/material';
import { Cancel, CheckCircle, Description, Favorite, HourglassEmpty, Person, Star } from '@mui/icons-material';
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

const StatusIllustration = ({ title, color }: { title: string; color: StatusCardProps['color'] }) => {
    const isInterested = title === 'Interested';
    const isAssigned = title === 'Assigned';
    const isRejected = title === 'Rejected';
    const isHourglass = title === 'No Response';

    return (
        <Box sx={{ position: 'relative', width: 92, height: 66, flexShrink: 0 }}>
            <Box
                sx={{
                    position: 'absolute',
                    inset: 4,
                    borderRadius: '50%',
                    background: (theme) => `radial-gradient(circle, ${theme.palette[color].main}22 0%, transparent 68%)`,
                    filter: 'blur(1px)',
                }}
            />

            {isInterested && (
                <>
                    {[18, 48, 78].map((left, idx) => (
                        <Avatar
                            key={left}
                            sx={{
                                position: 'absolute',
                                left: left - 10,
                                top: idx === 1 ? 4 : 20,
                                width: idx === 1 ? 30 : 25,
                                height: idx === 1 ? 30 : 25,
                                bgcolor: '#EEF2FF',
                                color: '#64748B',
                                boxShadow: '0 10px 18px rgba(99,102,241,.18)',
                            }}
                        >
                            <Person fontSize="small" />
                        </Avatar>
                    ))}
                    <Avatar
                        sx={{
                            position: 'absolute',
                            left: 32,
                            bottom: 2,
                            width: 38,
                            height: 38,
                            bgcolor: '#EEF2FF',
                            color: '#7C3AED',
                            boxShadow: '0 12px 24px rgba(124,58,237,.22)',
                        }}
                    >
                        <Favorite />
                    </Avatar>
                </>
            )}

            {(isAssigned || isRejected) && (
                <>
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 20,
                            top: 2,
                            width: 42,
                            height: 56,
                            borderRadius: 2,
                            bgcolor: '#fff',
                            color: isAssigned ? '#2563EB' : '#64748B',
                            display: 'grid',
                            placeItems: 'center',
                            boxShadow: '0 12px 24px rgba(15,23,42,.14)',
                        }}
                    >
                        <Description sx={{ fontSize: 30 }} />
                    </Box>
                    <Avatar
                        sx={{
                            position: 'absolute',
                            right: 12,
                            bottom: 2,
                            width: 32,
                            height: 32,
                            bgcolor: isAssigned ? '#0EA5E9' : '#EF4444',
                            color: '#fff',
                            boxShadow: '0 10px 20px rgba(15,23,42,.18)',
                        }}
                    >
                        {isAssigned ? <CheckCircle /> : <Cancel />}
                    </Avatar>
                </>
            )}

            {isHourglass && (
                <Avatar
                    sx={{
                        position: 'absolute',
                        left: 28,
                        top: 2,
                        width: 48,
                        height: 58,
                        bgcolor: '#fff',
                        color: '#F59E0B',
                        borderRadius: 4,
                        boxShadow: '0 14px 26px rgba(245,158,11,.20)',
                    }}
                >
                    <HourglassEmpty sx={{ fontSize: 34 }} />
                </Avatar>
            )}
        </Box>
    );
};

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
                background: (theme) => theme.palette[color].light,
                boxShadow: '0 12px 28px rgba(15,23,42,.06)',
                border: (theme) => `1px solid ${theme.palette[color].main}33`,
                borderRadius: 3,
                height: '100%',
                minHeight: 190,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <CardHeader
                sx={{
                    pb: 0,
                    pt: 1.5,
                    px: 2,
                    '& .MuiCardHeader-content': { minWidth: 0 },
                    '& .MuiCardHeader-action': { alignSelf: 'flex-start', mt: 0 },
                }}
                avatar={
                    <Avatar
                        sx={{
                            bgcolor: '#fff',
                            color: (theme) => theme.palette[color].dark,
                            boxShadow: '0 10px 20px rgba(15,23,42,.10)',
                        }}
                    >
                        {icon}
                    </Avatar>
                }
                title={
                    <Typography
                        sx={{ fontSize: 18, fontWeight: 900, color: (theme) => theme.palette[color].dark }}
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
                            height: 24,
                            minWidth: 28,
                            '& .MuiChip-label': { px: 1 },
                        }}
                    />
                }
            />
            <CardContent sx={{ pt: 1.25, pb: '16px !important', px: 2, flex: 1, minHeight: 0 }}>
                <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 70 }}>
                        <StatusIllustration title={title} color={color} />
                    </Box>
                    {members.length > 0 ? (
                        <Stack
                            spacing={1}
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                minHeight: 0,
                                maxHeight: 245,
                                overflowY: 'auto',
                                pr: 0.25,
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                                '&::-webkit-scrollbar': {
                                    display: 'none',
                                    width: 0,
                                    height: 0,
                                },
                                '&::-webkit-scrollbar-button': {
                                    display: 'none',
                                    width: 0,
                                    height: 0,
                                },
                            }}
                        >
                            {members.map((member) => {
                                const memberAny = member as any;
                                const ratingValue = memberAny.averageRating ?? memberAny.rating ?? null;
                                const match = getOfferForMember
                                    ? getOfferForMember(member)
                                    : { offer: null, slotId: null };
                                const hasOffer = Boolean(match.offer);
                                return (
                                    <Paper
                                        key={memberAny.userId}
                                        variant="outlined"
                                        sx={{
                                            p: 1.25,
                                            borderRadius: 2,
                                            bgcolor: '#fff',
                                            minWidth: 0,
                                            boxShadow: '0 8px 18px rgba(15,23,42,.04)',
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                                                <Stack sx={{ minWidth: 0 }}>
                                                    <Typography fontWeight={800} sx={{ lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                                                        {memberAny.name || `${memberAny.first_name} ${memberAny.last_name}`}
                                                    </Typography>
                                                    {memberAny.employmentType && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                            {memberAny.employmentType}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                                {ratingValue ? (
                                                    <Chip
                                                        icon={<Star sx={{ fontSize: 14 }} />}
                                                        label={ratingValue.toFixed(1)}
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                        sx={{ flexShrink: 0 }}
                                                    />
                                                ) : null}
                                            </Stack>
                                            {title === 'Interested' && hasOffer && (
                                                <Chip
                                                    label="Counter offer"
                                                    size="small"
                                                    color="info"
                                                    sx={{
                                                        alignSelf: 'flex-start',
                                                        maxWidth: '100%',
                                                        '& .MuiChip-label': {
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        },
                                                    }}
                                                />
                                            )}
                                        {title === 'Interested' && (
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="secondary"
                                                fullWidth
                                                sx={{
                                                    minHeight: 36,
                                                    borderRadius: 1.5,
                                                    fontWeight: 800,
                                                    whiteSpace: 'normal',
                                                    lineHeight: 1.2,
                                                }}
                                                onClick={() => {
                                                    onReviewCandidate(member, shiftId, match.offer, match.slotId);
                                                }}
                                                disabled={reviewLoadingId === memberAny.userId}
                                                startIcon={
                                                    reviewLoadingId === memberAny.userId ? (
                                                        <CircularProgress size={16} color="inherit" />
                                                    ) : undefined
                                                }
                                            >
                                                {hasOffer ? 'Review offer' : 'Review Candidate'}
                                            </Button>
                                        )}
                                        </Stack>
                                    </Paper>
                                );
                            })}
                        </Stack>
                    ) : (
                        <Box sx={{ maxWidth: 220, mx: 'auto', textAlign: 'center' }}>
                            <Typography color="text.secondary" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                                No candidates yet.
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.45 }}>
                                {title === 'Interested'
                                    ? "When candidates show interest, they'll appear here."
                                    : title === 'Assigned'
                                        ? 'Assigned candidates will appear here.'
                                        : title === 'Rejected'
                                            ? 'Candidates you reject will appear here.'
                                            : 'No responses will appear here.'}
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
};
