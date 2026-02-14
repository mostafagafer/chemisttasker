import React from 'react';
import { Stack, Box, IconButton, Button } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface SlotSelectorProps {
    slots: any[];
    selectedSlotId: number | null;
    onSelectSlot: (slotId: number) => void;
    slotHasUpdates?: Record<number, boolean>;
}

export const SlotSelector: React.FC<SlotSelectorProps> = ({ slots, selectedSlotId, onSelectSlot, slotHasUpdates }) => {
    const formatSlotDate = (slot: any) => {
        const date = new Date(slot.date);
        return `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
    };

    const formatTime = (time?: string | null) => (time ? time.slice(0, 5) : '');

    const formatLabel = (slot: any) =>
        `${formatSlotDate(slot)} (${formatTime(slot.startTime)} - ${formatTime(slot.endTime)})`;

    const currentIdx = slots.findIndex((s) => s.id === selectedSlotId);
    const prevId = slots[Math.max(0, currentIdx - 1)]?.id ?? slots[0]?.id ?? null;
    const nextId =
        slots[Math.min(slots.length - 1, currentIdx + 1)]?.id ?? slots[slots.length - 1]?.id ?? null;

    return (
        <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
            <IconButton
                size="small"
                onClick={() => onSelectSlot(prevId)}
                disabled={selectedSlotId === prevId}
            >
                <ChevronLeft />
            </IconButton>
            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    overflowX: 'auto',
                    px: 1,
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { display: 'none' },
                }}
            >
                {slots.map((slot) => (
                    <Button
                        key={slot.id}
                        variant={slot.id === selectedSlotId ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => onSelectSlot(slot.id!)}
                    >
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                            {formatLabel(slot)}
                            {Boolean(slotHasUpdates?.[slot.id]) && (
                                <Box
                                    component="span"
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: 'error.main',
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
            >
                <ChevronRight />
            </IconButton>
        </Stack>
    );
};
