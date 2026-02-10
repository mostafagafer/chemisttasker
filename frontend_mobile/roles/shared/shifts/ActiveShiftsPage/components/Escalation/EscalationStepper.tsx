import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface, Button, ActivityIndicator } from 'react-native-paper';
import { EscalationLevelKey, Shift } from '@chemisttasker/shared-core';
import { customTheme, levelColors } from '../../theme';
import { getLevelLabel } from '../../utils/displayHelpers';

const ESCALATION_LEVELS: EscalationLevelKey[] = [
    'FULL_PART_TIME',
    'LOCUM_CASUAL',
    'OWNER_CHAIN',
    'ORG_CHAIN',
    'PLATFORM',
];

interface EscalationStepperProps {
    shift: Shift;
    currentLevel: EscalationLevelKey;
    selectedLevel: EscalationLevelKey;
    onSelectLevel: (level: EscalationLevelKey) => void;
    onEscalate: (shift: Shift, levelKey: EscalationLevelKey) => void;
    escalating?: boolean;
    labelOverrides?: Partial<Record<EscalationLevelKey, string>>;
    showPrivateFirst?: boolean;
}

export default function EscalationStepper({
    shift,
    currentLevel,
    selectedLevel,
    onSelectLevel,
    onEscalate,
    escalating,
    labelOverrides,
    showPrivateFirst,
}: EscalationStepperProps) {
    const allowedKeys = new Set<string>((shift as any).allowedEscalationLevels || []);
    if (!allowedKeys.size) {
        ESCALATION_LEVELS.forEach((level) => allowedKeys.add(level));
    }
    const levelSequence = ESCALATION_LEVELS.filter((level) => allowedKeys.has(level));
    const currentIndex = Math.max(0, levelSequence.indexOf(currentLevel));
    const selectedIndex = levelSequence.indexOf(selectedLevel);
    const uiCurrentIndex = showPrivateFirst ? -1 : currentIndex;

    const canEscalate =
        selectedIndex > uiCurrentIndex &&
        selectedIndex !== -1 &&
        allowedKeys.has(levelSequence[selectedIndex]);

    return (
        <View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.container}
            >
                {showPrivateFirst && (
                    <Surface style={[styles.step, styles.privateStep]} elevation={0}>
                        <Text style={[styles.stepText, styles.privateStepText]} numberOfLines={1}>
                            Direct / Private
                        </Text>
                    </Surface>
                )}
                {levelSequence.map((level, index) => {
                    const isActive = index === uiCurrentIndex;
                    const isSelected = level === selectedLevel;
                    const isCompleted = index < uiCurrentIndex;
                    const color = levelColors[level] || customTheme.colors.grey;
                    const selectable = index <= uiCurrentIndex + 1 && allowedKeys.has(level);

                    const label = labelOverrides?.[level] ?? getLevelLabel(level);
                    return (
                        <TouchableOpacity
                            key={level}
                            activeOpacity={0.8}
                            disabled={!selectable}
                            onPress={() => onSelectLevel(level)}
                        >
                            <Surface
                                style={[
                                    styles.step,
                                    {
                                        backgroundColor: isActive || isCompleted ? color : customTheme.colors.greyLight,
                                        borderColor: isSelected ? color : customTheme.colors.border,
                                    },
                                    !selectable && styles.stepDisabled,
                                ]}
                                elevation={isActive ? 2 : 0}
                            >
                                <Text
                                    style={[
                                        styles.stepText,
                                        { color: isActive || isCompleted ? '#fff' : customTheme.colors.textMuted },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {label}
                                </Text>
                            </Surface>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {escalating ? (
                <View style={styles.escalateBox}>
                    <ActivityIndicator size="small" />
                    <Text style={styles.escalateText}>Escalating...</Text>
                </View>
            ) : canEscalate ? (
                <View style={styles.escalateBox}>
                    <Text style={styles.escalateHint}>Ready to widen your search?</Text>
                    <Button mode="contained" onPress={() => onEscalate(shift, levelSequence[selectedIndex])}>
                        Escalate to {labelOverrides?.[levelSequence[selectedIndex]] ?? getLevelLabel(levelSequence[selectedIndex])}
                    </Button>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: customTheme.spacing.md,
        gap: customTheme.spacing.sm,
    },
    step: {
        paddingHorizontal: customTheme.spacing.sm,
        paddingVertical: customTheme.spacing.xs,
        borderRadius: 16,
        borderWidth: 1,
        minWidth: 110,
        alignItems: 'center',
    },
    stepText: {
        fontSize: 11,
        fontWeight: '600',
    },
    privateStep: {
        backgroundColor: '#E0F2FE',
        borderColor: '#7DD3FC',
    },
    privateStepText: {
        color: '#0369A1',
    },
    stepDisabled: {
        opacity: 0.6,
    },
    escalateBox: {
        paddingVertical: customTheme.spacing.md,
        alignItems: 'center',
        gap: customTheme.spacing.sm,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: customTheme.colors.border,
    },
    escalateHint: {
        color: customTheme.colors.textMuted,
        marginBottom: customTheme.spacing.xs,
    },
    escalateText: {
        color: customTheme.colors.textMuted,
    },
});
