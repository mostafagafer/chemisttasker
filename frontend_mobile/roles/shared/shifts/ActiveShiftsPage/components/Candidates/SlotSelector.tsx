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
    slotHasUpdates?: Record<number, boolean>;
}

export default function SlotSelector({ slots, selectedSlotId, onSelectSlot, slotHasUpdates }: SlotSelectorProps) {
    const getSlotId = (slot: any): number | null =>
        (slot?.id ?? slot?.slotId ?? slot?.slot_id ?? null);

    const normalizedSlots = slots
        .map((slot) => ({ ...slot, _slotId: getSlotId(slot) }))
        .filter((slot) => slot._slotId != null);

    if (normalizedSlots.length === 0) {
        return null;
    }

    const formatSlotDate = (slot: any) => {
        const date = new Date(slot.date);
        return `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
    };

    const formatTime = (time?: string | null) => (time ? time.slice(0, 5) : '');

    const formatLabel = (slot: any) =>
        `${formatSlotDate(slot)} (${formatTime(slot.startTime)} - ${formatTime(slot.endTime)})`;

    const currentIdx = normalizedSlots.findIndex((s) => s._slotId === selectedSlotId);
    const prevId = normalizedSlots[Math.max(0, currentIdx - 1)]?._slotId ?? normalizedSlots[0]?._slotId ?? null;
    const nextId =
        normalizedSlots[Math.min(normalizedSlots.length - 1, currentIdx + 1)]?._slotId ??
        normalizedSlots[normalizedSlots.length - 1]?._slotId ?? null;

    return (
        <Surface style={styles.container} elevation={0}>
            <IconButton
                icon="chevron-left"
                size={20}
                onPress={() => {
                    if (prevId != null) onSelectSlot(prevId);
                }}
                disabled={prevId == null || selectedSlotId === prevId}
                style={styles.navButton}
            />
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {normalizedSlots.map((slot) => (
                    <View key={slot._slotId} style={styles.slotButtonWrap}>
                        <Button
                            mode={slot._slotId === selectedSlotId ? 'contained' : 'outlined'}
                            compact
                            onPress={() => onSelectSlot(slot._slotId!)}
                            style={styles.slotButton}
                        >
                            {formatLabel(slot)}
                        </Button>
                        {Boolean(slotHasUpdates?.[slot._slotId]) && <View style={styles.updateDot} />}
                    </View>
                ))}
            </ScrollView>
            <IconButton
                icon="chevron-right"
                size={20}
                onPress={() => {
                    if (nextId != null) onSelectSlot(nextId);
                }}
                disabled={nextId == null || selectedSlotId === nextId}
                style={styles.navButton}
            />
        </Surface>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: customTheme.spacing.sm,
        paddingHorizontal: customTheme.spacing.xs,
        marginBottom: customTheme.spacing.md,
        backgroundColor: customTheme.colors.greyLight,
        borderRadius: 8,
    },
    scrollContent: {
        paddingHorizontal: customTheme.spacing.xs,
        gap: customTheme.spacing.xs,
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    slotButton: {
        marginHorizontal: 2,
    },
    slotButtonWrap: {
        position: 'relative',
    },
    updateDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#DC2626',
    },
    navButton: {
        margin: 0,
    },
});
