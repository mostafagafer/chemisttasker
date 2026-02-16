import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Card, Chip, Divider, IconButton, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getActiveShifts, getOnboarding } from '@chemisttasker/shared-core';
import getShiftPharmacyName from '@/roles/shared/shifts/utils/getShiftPharmacyName';

const { width } = Dimensions.get('window');

type ShiftSummary = {
  id: number;
  pharmacy_name: string;
  date: string;
  status?: string;
  role?: string;
};

type DashboardData = {
  upcoming_shifts_count: number;
  confirmed_shifts_count: number;
  shifts: ShiftSummary[];
};

type OwnerProfile = {
  first_name?: string;
  username?: string;
};

export default function OwnerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  const welcomeName = useMemo(
    () => ownerProfile?.first_name || ownerProfile?.username || (user as any)?.first_name || (user as any)?.username || 'there',
    [ownerProfile?.first_name, ownerProfile?.username, user]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }, []);

  const formatShiftDate = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [shiftsRes, profileRes] = await Promise.all([
        getActiveShifts() as any,
        getOnboarding('owner' as any).catch(() => null),
      ]);

      const shiftList: any[] = Array.isArray(shiftsRes?.results)
        ? shiftsRes.results
        : Array.isArray(shiftsRes)
          ? shiftsRes
          : [];

      const normalizedShifts: ShiftSummary[] = shiftList.map((s) => ({
        id: s.id,
        pharmacy_name: getShiftPharmacyName(s),
        date: s.date || s.start_time || s.start || '',
        status: s.status,
        role: s.role_needed || s.role || 'Staff',
      }));

      setDashboardData({
        upcoming_shifts_count: shiftList.length,
        confirmed_shifts_count: shiftList.filter((s) => (s.status || '').toUpperCase() === 'CONFIRMED').length,
        shifts: normalizedShifts.slice(0, 5),
      });
      setOwnerProfile(profileRes as any);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const quickActions = useMemo(
    () => [
      { title: 'Post Shift', icon: 'plus-circle', route: '/owner/post-shift', gradient: ['#6366F1', '#8B5CF6'] as const },
      { title: 'Pharmacies', icon: 'store', route: '/owner/pharmacies', gradient: ['#EC4899', '#F43F5E'] as const },
      { title: 'Roster', icon: 'calendar-month', route: '/owner/shifts', gradient: ['#06B6D4', '#0EA5E9'] as const },
      { title: 'Calendar', icon: 'calendar', route: '/owner/calendar', gradient: ['#22C55E', '#16A34A'] as const },
      { title: 'Staff', icon: 'account-group', route: '/owner/staff', gradient: ['#10B981', '#14B8A6'] as const },
      { title: 'Locums', icon: 'account-heart', route: '/owner/locums', gradient: ['#F59E0B', '#F97316'] as const },
      { title: 'Talent Board', icon: 'account-search', route: '/owner/talent-board', gradient: ['#2563EB', '#1D4ED8'] as const },
      { title: 'Messages', icon: 'message-text', route: '/owner/chat', gradient: ['#8B5CF6', '#A78BFA'] as const },
    ],
    []
  );

  const statCards = useMemo(
    () => [
      { label: 'Active Shifts', value: dashboardData?.upcoming_shifts_count ?? 0, icon: 'calendar-clock', color: '#6366F1' },
      { label: 'Confirmed', value: dashboardData?.confirmed_shifts_count ?? 0, icon: 'calendar-check', color: '#10B981' },
    ],
    [dashboardData?.confirmed_shifts_count, dashboardData?.upcoming_shifts_count]
  );

  const upcomingShifts = dashboardData?.shifts ?? [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text variant="bodyMedium" style={styles.greetingText}>
                {greeting} ☀️
              </Text>
              <Text variant="headlineMedium" style={styles.nameText}>
                {welcomeName}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Card style={styles.heroCard}>
            <LinearGradient colors={['#6366F1', '#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientCard}>
              <View style={styles.heroContent}>
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Text variant="displaySmall" style={styles.heroStatValue}>
                      {dashboardData?.upcoming_shifts_count ?? 0}
                    </Text>
                    <Text variant="bodySmall" style={styles.heroStatLabel}>
                      Active Shifts
                    </Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStatItem}>
                    <Text variant="displaySmall" style={styles.heroStatValue}>
                      {dashboardData?.confirmed_shifts_count ?? 0}
                    </Text>
                    <Text variant="bodySmall" style={styles.heroStatLabel}>
                      Confirmed
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/owner/post-shift' as any)}>
                  <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']} style={styles.heroButtonGradient}>
                    <IconButton icon="plus-circle" size={20} iconColor="#FFFFFF" />
                    <Text style={styles.heroButtonText}>Post New Shift</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Card>
        </Animated.View>

        {/* <View style={styles.statsContainer}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Performance Overview
            </Text>
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((stat) => (
              <Animated.View key={stat.label} style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim }] }}>
                <Card style={styles.statCard}>
                  <Card.Content style={styles.statCardContent}>
                    <View style={styles.statCardHeader}>
                      <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                        <IconButton icon={stat.icon} size={20} iconColor={stat.color} />
                      </View>
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
                <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickActionGradient}>
                  <IconButton icon={action.icon} size={28} iconColor="#FFFFFF" />
                </LinearGradient>
                <Text variant="labelMedium" style={styles.quickActionTitle}>
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {upcomingShifts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Upcoming Shifts
              </Text>
              <TouchableOpacity onPress={() => router.push('/owner/shifts' as any)}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {upcomingShifts.slice(0, 3).map((shift) => (
              <Card key={shift.id} style={styles.shiftPreviewCard}>
                <Card.Content style={styles.shiftPreviewContent}>
                  <View style={styles.shiftPreviewLeft}>
                    <View style={styles.shiftIconContainer}>
                      <IconButton icon="calendar-clock" size={20} iconColor="#6366F1" />
                    </View>
                    <View style={styles.shiftTextColumn}>
                      <Text variant="labelMedium" style={styles.shiftPharmacyName} numberOfLines={1} ellipsizeMode="tail">
                        {shift.pharmacy_name}
                      </Text>
                      <Text variant="bodySmall" style={styles.shiftRole} numberOfLines={1} ellipsizeMode="tail">
                        {shift.role || 'Staff'}
                        {formatShiftDate(shift.date) ? ` · ${formatShiftDate(shift.date)}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Chip
                    style={[
                      styles.shiftStatusChip,
                      { backgroundColor: shift.status?.toUpperCase() === 'CONFIRMED' ? '#D1FAE5' : '#FEF3C7' },
                    ]}
                    textStyle={{
                      color: shift.status?.toUpperCase() === 'CONFIRMED' ? '#059669' : '#D97706',
                      fontSize: 11,
                      lineHeight: 14,
                    }}
                    compact
                  >
                    {shift.status || 'Pending'}
                  </Chip>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        <Surface style={styles.bottomSection}>
          <TouchableOpacity style={styles.bottomMenuItem} onPress={() => router.push('/owner/profile' as any)}>
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

          <TouchableOpacity style={styles.bottomMenuItem} onPress={() => router.push('/contact' as any)}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingText: { color: '#6B7280', marginBottom: 4, fontSize: 14 },
  nameText: { fontWeight: 'bold', color: '#111827', fontSize: 28 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { position: 'relative' },
  notificationBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444' },
  avatar: { backgroundColor: '#6366F1' },
  avatarLabel: { color: '#FFFFFF', fontWeight: 'bold' },
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
  gradientCard: { padding: 24 },
  heroContent: { gap: 20 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  heroStatItem: { alignItems: 'center', flex: 1 },
  heroStatValue: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 44, lineHeight: 52 },
  heroStatLabel: { color: 'rgba(255, 255, 255, 0.9)', marginTop: 4, fontSize: 13 },
  heroDivider: { width: 1, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  heroButton: { borderRadius: 12, overflow: 'hidden' },
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
  heroButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16, marginLeft: -8 },
  statsContainer: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontWeight: '700', color: '#111827', fontSize: 18 },
  seeAllText: { color: '#6366F1', fontWeight: '600', fontSize: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  statCard: {
    width: 180,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  statCardContent: { paddingVertical: 20, paddingHorizontal: 18, gap: 10, alignItems: 'center' },
  statCardHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  statIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontWeight: 'bold', color: '#111827', fontSize: 30 },
  statLabel: { color: '#6B7280', fontSize: 13 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeaderText: { fontWeight: '700', color: '#111827', marginBottom: 16, fontSize: 18 },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  quickActionCard: { width: (width - 64) / 2, alignItems: 'center', gap: 8 },
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
  quickActionTitle: { fontWeight: '600', color: '#111827', textAlign: 'center', fontSize: 12 },
  activityCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  activityIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityContent: { flex: 1, gap: 2 },
  activityTitle: { color: '#111827', fontWeight: '600' },
  activityDesc: { color: '#6B7280', fontSize: 12 },
  activityTime: { color: '#9CA3AF', fontSize: 11 },
  activityDivider: { marginHorizontal: 16 },
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
  shiftPreviewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  shiftPreviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  shiftIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  shiftTextColumn: { flex: 1, minWidth: 0 },
  shiftPharmacyName: { color: '#111827', fontWeight: '600' },
  shiftRole: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  shiftStatusChip: {
    height: 26,
    alignSelf: 'center',
    marginLeft: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
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
  bottomMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  bottomMenuIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  bottomMenuContent: { flex: 1, marginLeft: 12 },
  bottomMenuTitle: { color: '#111827', fontWeight: '600' },
  bottomMenuDesc: { color: '#6B7280', fontSize: 12, marginTop: 2 },
});
