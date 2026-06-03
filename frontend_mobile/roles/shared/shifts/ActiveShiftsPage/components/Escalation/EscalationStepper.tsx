import React from 'react';
import { Image, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
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

const chemisttaskerBadge = require('../../../../../../assets/images/chemisttasker-platform.png');

const levelIcons: Record<EscalationLevelKey, string> = {
    FULL_PART_TIME: 'account-group',
    LOCUM_CASUAL: 'heart',
    OWNER_CHAIN: 'storefront',
    ORG_CHAIN: 'office-building',
    PLATFORM: 'web',
};

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
    const resolveLabel = (level: EscalationLevelKey) =>
        level === 'PLATFORM' ? 'Chemisttasker' : labelOverrides?.[level] ?? getLevelLabel(level);

    const canEscalate =
        selectedIndex > uiCurrentIndex &&
        selectedIndex !== -1 &&
        allowedKeys.has(levelSequence[selectedIndex]);

    return (
        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
                <View style={styles.track} />
                <View style={[styles.progressTrack, { width: `${Math.min(100, Math.max(0, ((Math.max(selectedIndex, uiCurrentIndex) + (showPrivateFirst ? 1 : 0)) / Math.max(1, levelSequence.length - 1 + (showPrivateFirst ? 1 : 0))) * 100))}%` }]} />
                {showPrivateFirst && (
                    <Surface style={styles.stepWrap} elevation={0}>
                        <View style={[styles.stepCircle, styles.stepCircleReached]}>
                            <IconButton icon="lock" size={26} iconColor="#fff" style={styles.stepIcon} />
                        </View>
                        <View style={styles.stepDot} />
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
                    const isPlatform = level === 'PLATFORM';
                    const isPlatformEscalated = isPlatform && index <= uiCurrentIndex;
                    const selectable = index <= uiCurrentIndex + 1 && allowedKeys.has(level);

                    const label = resolveLabel(level);
                    return (
                        <TouchableOpacity
                            key={level}
                            activeOpacity={0.8}
                            disabled={!selectable}
                            onPress={() => onSelectLevel(level)}
                        >
                            <Surface
                                style={[
                                    styles.stepWrap,
                                    !selectable && styles.stepDisabled,
                                ]}
                                elevation={0}
                            >
                                <View style={[styles.stepCircle, (isActive || isCompleted || isSelected) && !isPlatform ? styles.stepCircleReached : styles.stepCircleMuted, isSelected && !isPlatform && { borderColor: color }]}>
                                    {isPlatform ? (
                                        <Image
                                            source={chemisttaskerBadge}
                                            style={[
                                                styles.platformBadge,
                                                !isPlatformEscalated && styles.platformBadgeDisabled,
                                            ]}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <IconButton icon={levelIcons[level]} size={26} iconColor="#fff" style={styles.stepIcon} />
                                    )}
                                </View>
                                <View style={[styles.stepDot, { backgroundColor: isPlatform ? (isPlatformEscalated ? color : '#CBD5E1') : isActive || isCompleted || isSelected ? color : '#CBD5E1' }]} />
                                <Text
                                    style={[
                                        styles.stepText,
                                        { color: isPlatform ? (isPlatformEscalated ? '#111827' : customTheme.colors.textMuted) : isSelected ? color : isActive || isCompleted ? '#111827' : customTheme.colors.textMuted },
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
                    <View style={styles.escalateIcon}><ActivityIndicator size="small" color="#fff" /></View>
                    <View style={styles.escalateCopy}>
                        <Text style={styles.escalateTitle}>Escalating...</Text>
                        <Text style={styles.escalateText}>Escalate to the next audience to find the right candidate.</Text>
                    </View>
                </View>
            ) : canEscalate ? (
                <View style={styles.escalateBox}>
                    <View style={styles.escalateIcon}>
                        <IconButton icon="trending-up" size={24} iconColor="#fff" style={styles.stepIcon} />
                    </View>
                    <View style={styles.escalateCopy}>
                        <Text style={styles.escalateTitle}>Ready to widen your search?</Text>
                        <Text style={styles.escalateText}>Escalate to the next audience to find the right candidate.</Text>
                    </View>
                    <Button mode="contained" style={styles.escalateButton} onPress={() => onEscalate(shift, levelSequence[selectedIndex])}>
                        Escalate to {resolveLabel(levelSequence[selectedIndex])}
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
        position: 'relative',
        paddingVertical: customTheme.spacing.lg,
        paddingHorizontal: customTheme.spacing.md,
        gap: customTheme.spacing.xl,
    },
    track: {
        position: 'absolute',
        left: 42,
        right: 42,
        top: 48,
        height: 5,
        borderRadius: 999,
        backgroundColor: '#E5E7EB',
    },
    progressTrack: {
        position: 'absolute',
        left: 42,
        top: 48,
        height: 5,
        borderRadius: 999,
        backgroundColor: '#7C3AED',
    },
    stepWrap: {
        minWidth: 118,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    stepCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 6,
        borderColor: '#E9D5FF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
        elevation: 5,
    },
    stepCircleReached: {
        backgroundColor: '#7C3AED',
    },
    stepCircleMuted: {
        backgroundColor: '#CBD5E1',
        borderColor: '#E5E7EB',
        shadowOpacity: 0.08,
    },
    stepIcon: {
        margin: 0,
    },
    platformBadge: {
        width: 52,
        height: 52,
    },
    platformBadgeDisabled: {
        opacity: 0.42,
        tintColor: '#94A3B8',
    },
    stepDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginTop: -3,
        marginBottom: 4,
        backgroundColor: '#7C3AED',
        borderWidth: 3,
        borderColor: '#fff',
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
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: customTheme.spacing.md,
        gap: customTheme.spacing.md,
        backgroundColor: '#FAF5FF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    escalateIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
    },
    escalateCopy: {
        flex: 1,
        minWidth: 180,
    },
    escalateTitle: {
        color: customTheme.colors.text,
        fontWeight: '900',
        fontSize: 15,
    },
    escalateText: {
        color: customTheme.colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    escalateButton: {
        borderRadius: 10,
    },
});
