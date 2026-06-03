// SlotSelector Component
// Horizontal selector for multi-slot shifts

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { IconButton, Surface, Text } from 'react-native-paper';
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

    const formatTime = (time?: string | null) => (time ? time.slice(0, 5) : '');

    const formatParts = (slot: any) => {
        const date = new Date(slot.date);
        return {
            day: date.toLocaleDateString(undefined, { weekday: 'short' }),
            date: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            time: `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`,
        };
    };
    const getSlotCandidateCount = (slot: any) =>
        slot?.candidateCount ?? slot?.candidate_count ?? slot?.assignedCount ?? slot?.assigned_count ?? 0;

    const currentIdx = normalizedSlots.findIndex((s) => s._slotId === selectedSlotId);
    const prevId = normalizedSlots[Math.max(0, currentIdx - 1)]?._slotId ?? normalizedSlots[0]?._slotId ?? null;
    const nextId =
        normalizedSlots[Math.min(normalizedSlots.length - 1, currentIdx + 1)]?._slotId ??
        normalizedSlots[normalizedSlots.length - 1]?._slotId ?? null;

    return (
        <Surface style={styles.container} elevation={0}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.heading}>Upcoming Shift Dates</Text>
                    <Text style={styles.subheading}>{normalizedSlots.length} upcoming shifts</Text>
                </View>
            </View>
            <View style={styles.selectorRow}>
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
                    {normalizedSlots.map((slot) => {
                        const parts = formatParts(slot);
                        const selected = slot._slotId === selectedSlotId;
                        return (
                            <TouchableOpacity
                                key={slot._slotId}
                                onPress={() => onSelectSlot(slot._slotId!)}
                                style={[styles.slotButton, selected && styles.slotButtonSelected]}
                            >
                                <Text style={styles.slotDay}>{parts.day}</Text>
                                <Text style={styles.slotDate}>{parts.date}</Text>
                                <Text style={styles.slotTime}>{parts.time}</Text>
                                <View style={styles.slotFooter}>
                                    <View style={styles.openDot} />
                                    <Text style={styles.openText}>Open</Text>
                                </View>
                                <View style={styles.slotCandidateCount}>
                                    <IconButton icon="account-group-outline" size={14} iconColor="#64748B" style={styles.slotCandidateIcon} />
                                    <Text style={styles.slotCandidateText}>{getSlotCandidateCount(slot)}</Text>
                                </View>
                                {Boolean(slotHasUpdates?.[slot._slotId]) && <View style={styles.updateDot} />}
                            </TouchableOpacity>
                        );
                    })}
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
            </View>
        </Surface>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: customTheme.spacing.sm,
        paddingHorizontal: customTheme.spacing.xs,
        marginBottom: customTheme.spacing.md,
        backgroundColor: '#fff',
        borderRadius: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: customTheme.spacing.sm,
        paddingHorizontal: customTheme.spacing.xs,
        gap: customTheme.spacing.sm,
    },
    heading: {
        fontSize: 15,
        fontWeight: '900',
        color: '#111827',
    },
    subheading: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 2,
    },
    selectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: customTheme.spacing.xs,
        gap: customTheme.spacing.md,
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    slotButton: {
        width: 156,
        minHeight: 96,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        padding: customTheme.spacing.md,
        position: 'relative',
    },
    slotButtonSelected: {
        borderColor: '#8B5CF6',
        backgroundColor: '#FAF5FF',
    },
    slotDay: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    slotDate: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 2,
    },
    slotTime: {
        alignSelf: 'flex-start',
        marginTop: customTheme.spacing.sm,
        paddingHorizontal: customTheme.spacing.sm,
        paddingVertical: 2,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: '#F3E8FF',
        color: '#7C3AED',
        fontSize: 12,
        fontWeight: '800',
    },
    slotFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: customTheme.spacing.sm,
    },
    openDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#16A34A',
    },
    openText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '700',
    },
    slotCandidateCount: {
        position: 'absolute',
        right: 10,
        bottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
    },
    slotCandidateIcon: {
        margin: 0,
        width: 18,
        height: 18,
    },
    slotCandidateText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '800',
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
