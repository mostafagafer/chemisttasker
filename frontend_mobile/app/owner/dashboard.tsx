import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Surface, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import apiClient from '../../utils/apiClient';

interface DashboardStats {
    pharmacies_count: number;
    active_shifts_count: number;
    completion_percentage: number;
}

export default function OwnerDashboard() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        pharmacies_count: 0,
        active_shifts_count: 0,
        completion_percentage: 0,
    });
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [pharmaciesRes, shiftsRes] = await Promise.all([
                apiClient.get('/client-profile/pharmacies/'),
                apiClient.get('/client-profile/shifts/owner/'),
            ]);

            setStats({
                pharmacies_count: pharmaciesRes.data.length || 0,
                active_shifts_count: shiftsRes.data.filter((s: any) => s.status === 'OPEN').length || 0,
                completion_percentage: 92,
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboardData();
        setRefreshing(false);
    };

    const quickActions = [
        {
            title: 'Manage Pharmacies',
            description: 'Add, edit and configure stores',
            icon: 'store',
            color: '#6366F1',
            route: '/owner/pharmacies',
        },
        {
            title: 'Internal Roster',
            description: 'Manage shift roster',
            icon: 'calendar-month',
            color: '#EC4899',
            route: '/owner/shifts',
        },
        {
            title: 'Post Shift',
            description: ' Publish an open shift in seconds',
            icon: 'calendar-plus',
            color: '#06B6D4',
            route: '/owner/shifts/create',
        },
        {
            title: 'Shift Centre',
            description: 'Upcoming & confirmed shifts',
            icon: 'clock-outline',
            color: '#F59E0B',
            route: '/owner/shifts',
        },
        {
            title: 'Explore Interests',
            description: 'Discover & recommended topics',
            icon: 'lightbulb-outline',
            color: '#8B5CF6',
            route: '/owner/pharmacies',
        },
        {
            title: 'Profile & Verification',
            description: 'Manage your registration profile',
            icon: 'account-circle',
            color: '#3B82F6',
            route: '/owner/profile',
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text variant="bodyMedium" style={styles.welcomeText}>
                            Welcome back 👋
                        </Text>
                        <Text variant="headlineSmall" style={styles.brandText}>
                            ChemistTasker
                        </Text>
                    </View>
                    <View style={styles.headerIcons}>
                        <IconButton icon="bell-outline" size={24} onPress={() => { }} />
                    </View>
                </View>

                {/* Main Stats Card with Gradient */}
                <Card style={styles.statsCard}>
                    <LinearGradient
                        colors={['#6366F1', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientCard}
                    >
                        <Text variant="titleMedium" style={styles.statsTitle}>
                            Your pharmacies at a glance
                        </Text>
                        <Text variant="bodySmall" style={styles.statsSubtitle}>
                            Review staffing, shifts and operations in one place. Get deeper insights with the quick links below.
                        </Text>

                        <View style={styles.actionButtonsRow}>
                            <Surface style={styles.actionButton}>
                                <Text variant="labelMedium" style={styles.actionButtonText}>
                                    Post a shift
                                </Text>
                            </Surface>
                            <Surface style={styles.actionButton}>
                                <Text variant="labelMedium" style={styles.actionButtonText}>
                                    Manage pharmacies
                                </Text>
                            </Surface>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text variant="headlineMedium" style={styles.statNumber}>
                                    {stats.pharmacies_count}
                                </Text>
                                <Text variant="bodySmall" style={styles.statLabel}>
                                    pharmacies
                                </Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text variant="headlineMedium" style={styles.statNumber}>
                                    {stats.completion_percentage}%
                                </Text>
                                <Text variant="bodySmall" style={styles.statLabel}>
                                    profile completion
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </Card>

                {/* Mini Stats */}
                <View style={styles.miniStatsRow}>
                    <Card style={styles.miniStatCard}>
                        <Card.Content style={styles.miniStatContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#E0E7FF' }]}>
                                <IconButton icon="store" size={20} iconColor="#6366F1" />
                            </View>
                            <Text variant="headlineSmall" style={styles.miniStatNumber}>
                                {stats.pharmacies_count}
                            </Text>
                            <Text variant="bodySmall" style={styles.miniStatLabel}>
                                Total Pharmacies
                            </Text>
                        </Card.Content>
                    </Card>

                    <Card style={styles.miniStatCard}>
                        <Card.Content style={styles.miniStatContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                                <IconButton icon="calendar" size={20} iconColor="#3B82F6" />
                            </View>
                            <Text variant="headlineSmall" style={styles.miniStatNumber}>
                                {stats.active_shifts_count}
                            </Text>
                            <Text variant="bodySmall" style={styles.miniStatLabel}>
                                Open Shifts
                            </Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Quick Actions
                    </Text>

                    <View style={styles.quickActionsGrid}>
                        {quickActions.map((action, index) => (
                            <Card
                                key={index}
                                style={styles.quickActionCard}
                                onPress={() => router.push(action.route as any)}
                            >
                                <Card.Content style={styles.quickActionContent}>
                                    <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                                        <IconButton icon={action.icon} size={24} iconColor={action.color} />
                                    </View>
                                    <Text variant="labelLarge" style={styles.quickActionTitle}>
                                        {action.title}
                                    </Text>
                                    <Text variant="bodySmall" style={styles.quickActionDescription}>
                                        {action.description}
                                    </Text>
                                    <IconButton icon="arrow-right" size={16} style={styles.quickActionArrow} />
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                </View>

                {/* Bottom Actions */}
                <Surface style={styles.bottomSection}>
                    <View style={styles.bottomMenuItem}>
                        <IconButton icon="cog" size={24} iconColor="#6B7280" />
                        <View style={{ flex: 1 }}>
                            <Text variant="labelLarge">Settings</Text>
                            <Text variant="bodySmall" style={styles.bottomMenuDesc}>
                                Preferences and configurations
                            </Text>
                        </View>
                        <IconButton icon="chevron-right" size={24} iconColor="#6B7280" />
                    </View>

                    <View style={styles.bottomMenuItem}>
                        <IconButton icon="book-open-variant" size={24} iconColor="#6B7280" />
                        <View style={{ flex: 1 }}>
                            <Text variant="labelLarge">Learning Materials</Text>
                            <Text variant="bodySmall" style={styles.bottomMenuDesc}>
                                Guides, articles and resources
                            </Text>
                        </View>
                        <IconButton icon="chevron-right" size={24} iconColor="#6B7280" />
                    </View>

                    <Surface style={styles.logoutButton} onTouchEnd={logout}>
                        <IconButton icon="logout" size={20} iconColor="#EF4444" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </Surface>
                </Surface>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    welcomeText: {
        color: '#6B7280',
    },
    brandText: {
        fontWeight: 'bold',
        color: '#111827',
    },
    headerIcons: {
        flexDirection: 'row',
    },
    statsCard: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientCard: {
        padding: 20,
    },
    statsTitle: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    statsSubtitle: {
        color: '#E0E7FF',
        marginBottom: 16,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    actionButtonText: {
        color: '#6366F1',
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 32,
    },
    statItem: {
        gap: 4,
    },
    statNumber: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#E0E7FF',
    },
    miniStatsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    miniStatCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    miniStatContent: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    miniStatNumber: {
        fontWeight: 'bold',
        color: '#111827',
    },
    miniStatLabel: {
        color: '#6B7280',
        fontSize: 11,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#111827',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickActionCard: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    quickActionContent: {
        paddingVertical: 16,
        position: 'relative',
    },
    quickActionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginBottom: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionTitle: {
        fontWeight: '600',
        marginBottom: 4,
        color: '#111827',
    },
    quickActionDescription: {
        color: '#6B7280',
        fontSize: 11,
    },
    quickActionArrow: {
        position: 'absolute',
        right: 0,
        top: 4,
    },
    bottomSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    bottomMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    bottomMenuDesc: {
        color: '#6B7280',
        fontSize: 12,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        marginTop: 16,
        paddingVertical: 4,
    },
    logoutText: {
        color: '#EF4444',
        fontWeight: '600',
    },
});
