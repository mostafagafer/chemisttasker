import React from 'react';
import { Stack, Box, IconButton, Button, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight, Groups } from '@mui/icons-material';

interface SlotSelectorProps {
    slots: any[];
    selectedSlotId: number | null;
    onSelectSlot: (slotId: number) => void;
    slotHasUpdates?: Record<number, boolean>;
    slotCandidateCounts?: Record<number, number>;
}

export const SlotSelector: React.FC<SlotSelectorProps> = ({
    slots,
    selectedSlotId,
    onSelectSlot,
    slotHasUpdates,
    slotCandidateCounts,
}) => {
    const formatTime = (time?: string | null) => (time ? time.slice(0, 5) : '');

    const formatParts = (slot: any) => {
        const date = new Date(slot.date);
        return {
            day: date.toLocaleDateString(undefined, { weekday: 'short' }),
            date: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            time: `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`,
        };
    };
    const getSlotCandidateCount = (slot: any) => {
        const computedCount = slot?.id != null ? slotCandidateCounts?.[slot.id] : undefined;
        return computedCount ?? slot?.candidateCount ?? slot?.candidate_count ?? slot?.assignedCount ?? slot?.assigned_count ?? 0;
    };

    const currentIdx = slots.findIndex((s) => s.id === selectedSlotId);
    const prevId = slots[Math.max(0, currentIdx - 1)]?.id ?? slots[0]?.id ?? null;
    const nextId =
        slots[Math.min(slots.length - 1, currentIdx + 1)]?.id ?? slots[slots.length - 1]?.id ?? null;

    return (
        <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Box>
                    <Typography sx={{ fontWeight: 900, color: '#111827' }}>Upcoming Shift Dates</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {slots.length} upcoming shifts
                    </Typography>
                </Box>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={{ xs: 0.25, sm: 1 }} justifyContent="center" sx={{ minWidth: 0 }}>
            <IconButton
                size="small"
                onClick={() => onSelectSlot(prevId)}
                disabled={selectedSlotId === prevId}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
                <ChevronLeft />
            </IconButton>
            <Box
                sx={{
                    display: 'grid',
                    gridAutoFlow: { xs: 'column', md: 'initial' },
                    gridAutoColumns: { xs: 'minmax(170px, 78vw)', md: 'initial' },
                    gridTemplateColumns: { xs: 'none', md: 'repeat(5, minmax(150px, 1fr))' },
                    gap: { xs: 1, sm: 1.5 },
                    overflowX: 'auto',
                    width: '100%',
                    px: { xs: 0, sm: 1 },
                    pb: { xs: 0.5, sm: 0 },
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { display: 'none' },
                    scrollbarWidth: 'none',
                }}
            >
                {slots.map((slot) => (
                    <Button
                        key={slot.id}
                        variant="outlined"
                        onClick={() => onSelectSlot(slot.id!)}
                        sx={{
                            position: 'relative',
                            justifyContent: 'flex-start',
                            alignItems: 'stretch',
                            minHeight: 92,
                            p: { xs: 1.25, sm: 1.5 },
                            borderRadius: 2,
                            borderColor: slot.id === selectedSlotId ? '#8B5CF6' : '#E5E7EB',
                            bgcolor: slot.id === selectedSlotId ? '#FAF5FF' : '#fff',
                            color: '#111827',
                            boxShadow: slot.id === selectedSlotId ? '0 10px 24px rgba(124,58,237,.12)' : '0 8px 20px rgba(15,23,42,.04)',
                            textTransform: 'none',
                        }}
                    >
                        <Box component="span" sx={{ display: 'flex', width: '100%', flexDirection: 'column', alignItems: 'flex-start' }}>
                            {(() => {
                                const parts = formatParts(slot);
                                return (
                                    <>
                                        <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>{parts.day}</Typography>
                                        <Typography sx={{ color: '#111827', fontWeight: 900, lineHeight: 1.2 }}>{parts.date}</Typography>
                                        <Box component="span" sx={{ mt: 1, px: 1, py: 0.25, borderRadius: 999, bgcolor: '#F3E8FF', color: '#7C3AED', fontSize: 12, fontWeight: 800 }}>
                                            {parts.time}
                                        </Box>
                                        <Typography variant="caption" sx={{ mt: 0.75, color: '#475569', fontWeight: 700 }}>
                                            <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, mr: 0.75, borderRadius: '50%', bgcolor: '#16A34A' }} />
                                            Open
                                        </Typography>
                                        <Typography variant="caption" sx={{ position: 'absolute', right: 12, bottom: 10, color: '#64748B', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                                            <Groups sx={{ fontSize: 14 }} />
                                            {getSlotCandidateCount(slot)}
                                        </Typography>
                                    </>
                                );
                            })()}
                            {Boolean(slotHasUpdates?.[slot.id]) && (
                                <Box
                                    component="span"
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: 'error.main',
                                        position: 'absolute',
                                        top: 10,
                                        right: 10,
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                        </Box>
                    </Button>
                ))}
            </Box>
            <IconButton
                size="small"
                onClick={() => onSelectSlot(nextId)}
                disabled={selectedSlotId === nextId}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
                <ChevronRight />
            </IconButton>
        </Stack>
        </Box>
    );
};
