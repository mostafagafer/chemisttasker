// SlotSelector Component
// Horizontal selector for multi-slot shifts

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, IconButton, Surface } from 'react-native-paper';
import { customTheme } from '../../theme';

interface SlotSelectorProps {
    slots: any[];
    selectedSlotId: number | null;
    onSelectSlot: (slotId: number) => void;
}

export default function SlotSelector({ slots, selectedSlotId, onSelectSlot }: SlotSelectorProps) {
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
        <Surface style={styles.container} elevation={0}>
            <IconButton
                icon="chevron-left"
                size={20}
                onPress={() => onSelectSlot(prevId)}
                disabled={selectedSlotId === prevId}
            />
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {slots.map((slot) => (
                    <Button
                        key={slot.id}
                        mode={slot.id === selectedSlotId ? 'contained' : 'outlined'}
                        compact
                        onPress={() => onSelectSlot(slot.id!)}
                        style={styles.slotButton}
                    >
                        {formatLabel(slot)}
                    </Button>
                ))}
            </ScrollView>
            <IconButton
                icon="chevron-right"
                size={20}
                onPress={() => onSelectSlot(nextId)}
                disabled={selectedSlotId === nextId}
            />
        </Surface>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: customTheme.spacing.sm,
        marginBottom: customTheme.spacing.md,
        backgroundColor: customTheme.colors.greyLight,
        borderRadius: 8,
    },
    scrollContent: {
        paddingHorizontal: customTheme.spacing.xs,
        gap: customTheme.spacing.xs,
    },
    slotButton: {
        marginHorizontal: 2,
    },
});
