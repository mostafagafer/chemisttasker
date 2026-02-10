// ShiftBoardTabsPage - Mobile wrapper with tabs
// Simple wrapper that doesn't fetch data, just provides tab UI

import React, { useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, SegmentedButtons, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import the actual Views that have data fetching
import PublicShiftsView from './PublicShiftsView';
import CommunityShiftsView from './CommunityShiftsView';
import { useWorkspace } from '../../../context/WorkspaceContext';

type ShiftBoardTab = 'browse' | 'saved' | 'interested' | 'rejected' | 'accepted';

const TABS = [
    { value: 'browse' as ShiftBoardTab, label: 'Browse' },
    { value: 'saved' as ShiftBoardTab, label: 'Saved' },
    { value: 'interested' as ShiftBoardTab, label: 'Interested' },
    { value: 'rejected' as ShiftBoardTab, label: 'Rejected' },
    { value: 'accepted' as ShiftBoardTab, label: 'Offers' },
];

export default function ShiftBoardTabsPage() {
    const { workspace } = useWorkspace();
    const [activeTab, setActiveTab] = useState<ShiftBoardTab>('browse');
    const scrollY = useRef(new Animated.Value(0)).current;
    const AnimatedText = useMemo(() => Animated.createAnimatedComponent(Text), []);

    const subtitle = useMemo(() => {
        switch (activeTab) {
            case 'browse':
                return 'Browse open shifts and opportunities.';
            case 'saved':
                return 'Your saved shifts for quick access.';
            case 'interested':
                return 'Shifts you have applied to or countered.';
            case 'rejected':
                return 'Shifts you have passed on.';
            default:
                return 'Discover shifts at a glance.';
        }
    }, [activeTab]);

    // Use the appropriate view based on workspace
    const ShiftsView = workspace === 'internal' ? CommunityShiftsView : PublicShiftsView;
    const heroHeight = scrollY.interpolate({
        inputRange: [0, 140],
        outputRange: [150, 70],
        extrapolate: 'clamp',
    });
    const subtitleOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const labelOpacity = scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
    });
    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Hero Header */}
            <Animated.View style={[styles.heroWrapper, { height: heroHeight }]}>
                <Card style={styles.heroCard} mode="elevated">
                    <Card.Content>
                        <AnimatedText variant="labelSmall" style={[styles.heroLabel, { opacity: labelOpacity }]}>
                            SHIFT BOARD
                        </AnimatedText>
                        <Text variant="headlineMedium" style={styles.heroTitle}>
                            Discover shifts at a glance
                        </Text>
                        <AnimatedText variant="bodyMedium" style={[styles.heroSubtitle, { opacity: subtitleOpacity }]}>
                            {subtitle}
                        </AnimatedText>
                    </Card.Content>
                </Card>
            </Animated.View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <SegmentedButtons
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as ShiftBoardTab)}
                    buttons={TABS.map((tab) => ({
                        value: tab.value,
                        label: tab.label,
                        style: styles.segmentButton,
                    }))}
                    theme={{
                        colors: {
                            secondaryContainer: '#EEF2FF',
                            onSecondaryContainer: '#6366F1',
                        },
                    }}
                />
            </View>

            {/* Content - Pass tab to the view */}
            <View style={styles.content}>
                <ShiftsView
                    activeTabOverride={activeTab}
                    onActiveTabChange={(tab) => setActiveTab(tab as ShiftBoardTab)}
                    hideTabs
                    hideHero
                    onScroll={handleScroll}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    heroCard: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#6366F1',
    },
    heroWrapper: {
        overflow: 'hidden',
    },
    heroLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 1.6,
        marginBottom: 4,
    },
    heroTitle: {
        color: '#FFFFFF',
        fontWeight: '800',
        marginBottom: 8,
    },
    heroSubtitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        maxWidth: 560,
    },
    tabsContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    segmentButton: {
        borderColor: '#E5E7EB',
    },
    content: {
        flex: 1,
    },
});
