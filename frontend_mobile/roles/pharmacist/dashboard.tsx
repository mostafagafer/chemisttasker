import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text, Card, Surface, IconButton, Chip, ActivityIndicator, Divider, Avatar, Badge, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { LinearGradient } from 'expo-linear-gradient';
import { getPharmacistDashboard } from '@chemisttasker/shared-core';

const { width } = Dimensions.get('window');

type ShiftSummary = {
  id: number;
  pharmacy_name?: string;
  pharmacyName?: string;
  date?: string;
  start_datetime?: string;
  startDatetime?: string;
  status?: string;
  role?: string;
};

type DashboardData = {
  user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  message?: string;
  upcoming_shifts_count?: number;
  confirmed_shifts_count?: number;
  community_shifts_count?: number;
  shifts?: ShiftSummary[];
  bills_summary?: {
    total_billed?: string;
    points?: string;
  };
};

function formatShiftDate(value?: string | null) {
  if (!value) return 'No date provided';
  const normalized = value.replace('T', ' ').replace('Z', '');
  // Try to make it look nicer if possible, similar to owner dashboard
  try {
    const date = new Date(normalized);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return normalized;
  }
}

export default function PharmacistOverviewScreen() {
  const { user, logout } = useAuth();
  const { workspace, setWorkspace } = useWorkspace();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [menuVisible, setMenuVisible] = useState(false);

  const loadDashboard = useCallback(async () => {
    // If not refreshing, we might want to show loading initially
    if (!refreshing) setLoading(true);
    try {
      const result = await getPharmacistDashboard();
      setData(result as any);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err: any) {
      console.error('Unable to load dashboard', err);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, fadeAnim, slideAnim]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
  }, [loadDashboard]);

  const shifts = useMemo(() => data?.shifts ?? [], [data?.shifts]);

  const displayName =
    data?.user?.first_name ||
    data?.user?.username ||
    (user as any)?.first_name ||
    (user as any)?.username ||
    'there';

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const statCards = useMemo(() => [
    {
      label: 'Community Opportunities',
      value: data?.community_shifts_count ?? 0,
      icon: 'briefcase-search',
      color: '#F59E0B',
      trend: 'New',
      trendUp: true
    },
    {
      label: 'Points Earned',
      value: data?.bills_summary?.points ?? '0',
      icon: 'star',
      color: '#EC4899',
      trend: 'Total',
      trendUp: true
    },
    {
      label: 'Total Billed',
      value: data?.bills_summary?.total_billed ?? '£0',
      icon: 'cash',
      color: '#10B981',
      trend: 'This Month',
      trendUp: true
    },
  ], [data]);

  const quickActions = useMemo(() => [
    {
      title: 'Find Shifts',
      description: 'Browse jobs',
      icon: 'magnify',
      color: '#6366F1',
      gradient: ['#6366F1', '#8B5CF6'] as const,
      route: '/pharmacist/shifts',
    },
    {
      title: 'Availability',
      description: 'Set schedule',
      icon: 'calendar-clock',
      color: '#EC4899',
      gradient: ['#EC4899', '#F43F5E'] as const,
      route: '/pharmacist/availability',
    },
    {
      title: 'Invoices',
      description: 'View payments',
      icon: 'file-document-outline',
      color: '#06B6D4',
      gradient: ['#06B6D4', '#0EA5E9'] as const,
      route: '/pharmacist/invoice',
    },
    {
      title: 'Learning',
      description: 'CPD & Training',
      icon: 'school',
      color: '#10B981',
      gradient: ['#10B981', '#14B8A6'] as const,
      route: '/pharmacist/learning',
    },
    {
      title: 'Interests',
      description: 'Job preferences',
      icon: 'heart',
      color: '#F59E0B',
      gradient: ['#F59E0B', '#F97316'] as const,
      route: '/pharmacist/interests',
    },
    {
      title: 'Profile',
      description: 'Edit details',
      icon: 'account',
      color: '#8B5CF6',
      gradient: ['#8B5CF6', '#A78BFA'] as const,
      route: '/pharmacist/profile',
    },
  ], []);

  if (loading && !refreshing && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text variant="bodyMedium" style={styles.greetingText}>
                {greeting} 👋
              </Text>
              <Text variant="headlineMedium" style={styles.nameText}>
                {displayName}
              </Text>
            </View>
</View>
        </Animated.View>

        {/* Hero Card */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Card style={styles.heroCard}>
            <LinearGradient
              colors={['#2563EB', '#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Text variant="displaySmall" style={styles.heroStatValue}>
                      {data?.upcoming_shifts_count ?? 0}
                    </Text>
                    <Text variant="bodySmall" style={styles.heroStatLabel}>
                      Upcoming
                    </Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStatItem}>
                    <Text variant="displaySmall" style={styles.heroStatValue}>
                      {data?.confirmed_shifts_count ?? 0}
                    </Text>
                    <Text variant="bodySmall" style={styles.heroStatLabel}>
                      Confirmed
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/pharmacist/shifts')}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                    style={styles.heroButtonGradient}
                  >
                    <IconButton icon="calendar-search" size={20} iconColor="#FFFFFF" />
                    <Text style={styles.heroButtonText}>Find New Shifts</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Card>
        </Animated.View>

        {/* Stats Grid */}
        {/* <View style={styles.statsContainer}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Overview
            </Text>
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((stat) => (
              <Animated.View
                key={stat.label}
                style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim }] }}
              >
                <Card style={styles.statCard}>
                  <Card.Content style={styles.statCardContent}>
                    <View style={styles.statCardHeader}>
                      <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                        <IconButton icon={stat.icon} size={20} iconColor={stat.color} />
                      </View>
                      <Chip
                        style={[styles.trendChip, { backgroundColor: stat.trendUp ? '#D1FAE5' : '#FEE2E2' }]}
                        textStyle={[styles.trendText, { color: stat.trendUp ? '#059669' : '#DC2626' }]}
                        compact
                      >
                        {stat.trend}
                      </Chip>
                    </View>
                    <Text variant="headlineSmall" style={styles.statValue}>
                      {stat.value}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      {stat.label}
                    </Text>
                  </Card.Content>
                </Card>
              </Animated.View>
            ))}
          </View>
        </View> */}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionHeaderText}>
            Quick Actions
          </Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.title}
                style={styles.quickActionCard}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={action.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.quickActionGradient}
                >
                  <IconButton icon={action.icon} size={28} iconColor="#FFFFFF" />
                </LinearGradient>
                <Text variant="labelMedium" style={styles.quickActionTitle}>
                  {action.title}
                </Text>
                <Text variant="bodySmall" style={styles.quickActionDesc}>
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Shifts */}
        {shifts.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Upcoming Shifts
              </Text>
              <TouchableOpacity onPress={() => router.push('/pharmacist/shifts')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {shifts.slice(0, 3).map((shift) => (
              <Card key={shift.id} style={styles.shiftPreviewCard} onPress={() => router.push(`/pharmacist/shifts/${shift.id}` as any)}>
                <Card.Content style={styles.shiftPreviewContent}>
                  <View style={styles.shiftPreviewLeft}>
                    <View style={styles.shiftIconContainer}>
                      <IconButton icon="calendar-clock" size={20} iconColor="#6366F1" />
                    </View>
                    <View>
                      <Text variant="labelMedium" style={styles.shiftPharmacyName}>
                        {shift.pharmacy_name || shift.pharmacyName || 'Pharmacy Shift'}
                      </Text>
                      <Text variant="bodySmall" style={styles.shiftRole}>
                        {formatShiftDate(shift.date || shift.startDatetime || shift.start_datetime)}
                      </Text>
                    </View>
                  </View>
                  <IconButton icon="chevron-right" size={20} iconColor="#9CA3AF" />
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Card mode="outlined" style={styles.emptyCard}>
              <Card.Content style={{ alignItems: 'center', padding: 24 }}>
                <IconButton icon="calendar-blank" size={48} iconColor="#9CA3AF" />
                <Text variant="titleMedium" style={{ marginTop: 8, color: '#6B7280' }}>No upcoming shifts</Text>
                <Text variant="bodySmall" style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 4 }}>
                  Check the community board to find new opportunities.
                </Text>
                <Button mode="contained-tonal" style={{ marginTop: 16 }} onPress={() => router.push('/pharmacist/shifts')}>
                  Find Shifts
                </Button>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Bottom Menu */}
        <Surface style={styles.bottomSection}>
          <TouchableOpacity style={styles.bottomMenuItem} onPress={() => router.push('/pharmacist/profile')}>
            <View style={styles.bottomMenuIcon}>
              <IconButton icon="account-cog" size={24} iconColor="#6366F1" />
            </View>
            <View style={styles.bottomMenuContent}>
              <Text variant="labelLarge" style={styles.bottomMenuTitle}>
                Account Settings
              </Text>
              <Text variant="bodySmall" style={styles.bottomMenuDesc}>
                Manage your profile and preferences
              </Text>
            </View>
            <IconButton icon="chevron-right" size={20} iconColor="#9CA3AF" />
          </TouchableOpacity>

          <Divider />

          <TouchableOpacity style={styles.bottomMenuItem} onPress={() => { }}>
            <View style={styles.bottomMenuIcon}>
              <IconButton icon="help-circle" size={24} iconColor="#10B981" />
            </View>
            <View style={styles.bottomMenuContent}>
              <Text variant="labelLarge" style={styles.bottomMenuTitle}>
                Help & Support
              </Text>
              <Text variant="bodySmall" style={styles.bottomMenuDesc}>
                Get assistance and view FAQs
              </Text>
            </View>
            <IconButton icon="chevron-right" size={20} iconColor="#9CA3AF" />
          </TouchableOpacity>

          <Divider />

          <TouchableOpacity
            style={styles.bottomMenuItem}
            onPress={async () => {
              await logout();
              router.replace('/login' as any);
            }}
          >
            <View style={[styles.bottomMenuIcon, { backgroundColor: '#FEE2E2' }]}>
              <IconButton icon="logout" size={24} iconColor="#DC2626" />
            </View>
            <View style={styles.bottomMenuContent}>
              <Text variant="labelLarge" style={[styles.bottomMenuTitle, { color: '#DC2626' }]}>
                Sign Out
              </Text>
              <Text variant="bodySmall" style={styles.bottomMenuDesc}>
                Logout from your account
              </Text>
            </View>
            <IconButton icon="chevron-right" size={20} iconColor="#9CA3AF" />
          </TouchableOpacity>
        </Surface>

      </ScrollView>
    </SafeAreaView>
  );
}

// Reusing styles from Owner Dashboard for consistency
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    color: '#6B7280',
    marginBottom: 4,
    fontSize: 14,
  },
  nameText: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 28,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workspacePill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  workspaceLabel: { color: '#6B7280', fontSize: 11 },
  workspaceValue: { color: '#111827', fontWeight: '700', fontSize: 12 },
  iconButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
  },
  avatar: {
    backgroundColor: '#6366F1',
  },
  avatarLabel: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  gradientCard: {
    padding: 24,
  },
  heroContent: {
    gap: 20,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  heroStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 44,
    lineHeight: 52,
  },
  heroStatLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontSize: 13,
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: -8,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 18,
  },
  seeAllText: {
    color: '#6366F1',
    fontWeight: '600',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  statCard: {
    width: 180,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statCardContent: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendChip: {
    height: 24,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 26,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeaderText: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    fontSize: 18,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  quickActionCard: {
    width: (width - 64) / 2,
    alignItems: 'center',
    gap: 8,
  },
  quickActionGradient: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  quickActionTitle: {
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    fontSize: 12,
  },
  quickActionDesc: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 10,
  },
  shiftPreviewCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  shiftPreviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  shiftPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  shiftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shiftPharmacyName: {
    color: '#111827',
    fontWeight: '600',
  },
  shiftRole: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  bottomSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  bottomMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bottomMenuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomMenuContent: {
    flex: 1,
    marginLeft: 12,
  },
  bottomMenuTitle: {
    color: '#111827',
    fontWeight: '600',
  },
  bottomMenuDesc: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});

