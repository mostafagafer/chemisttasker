import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Chip, Divider, IconButton, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { getActiveShifts } from '@chemisttasker/shared-core';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/utils/apiClient';
import getShiftPharmacyName from '@/roles/shared/shifts/utils/getShiftPharmacyName';

const { width } = Dimensions.get('window');

type ShiftSummary = {
  id: number;
  pharmacyName: string;
  date: string;
  status?: string;
  role?: string;
};

type PillSummary = {
  balance: number;
  shift_post_cost: number;
};

const getOrganizationName = (user: any) => {
  const memberships = Array.isArray(user?.memberships) ? user.memberships : [];
  const orgMembership = memberships.find((membership: any) => membership?.organization_name || membership?.organizationName);
  return (
    orgMembership?.organization_name ||
    orgMembership?.organizationName ||
    user?.organization_name ||
    user?.organizationName ||
    user?.username ||
    'Organization'
  );
};

export default function OrganizationDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [pillSummary, setPillSummary] = useState<PillSummary>({ balance: 0, shift_post_cost: 0 });
  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const organizationName = useMemo(() => getOrganizationName(user), [user]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [shiftsRes, pillRes] = await Promise.all([
        getActiveShifts().catch(() => []),
        apiClient.get('/client-profile/pill-rewards/balance/').catch(() => null),
      ]);

      const list: any[] = Array.isArray((shiftsRes as any)?.results)
        ? (shiftsRes as any).results
        : Array.isArray(shiftsRes)
          ? shiftsRes
          : [];

      setShifts(
        list.slice(0, 5).map((shift: any) => ({
          id: shift.id,
          pharmacyName: getShiftPharmacyName(shift),
          date: shift.date || shift.start_time || shift.start || '',
          status: shift.status,
          role: shift.role_needed || shift.role || 'Staff',
        }))
      );

      if (pillRes?.data) {
        setPillSummary({
          balance: Number(pillRes.data?.balance ?? 0),
          shift_post_cost: Number(pillRes.data?.shift_post_cost ?? 0),
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const quickActions = useMemo(
    () => [
      { title: 'Post Shift', icon: 'plus-circle', route: '/organization/post-shift', gradient: ['#6366F1', '#8B5CF6'] as const },
      { title: 'Invite Staff', icon: 'account-plus', route: '/organization/invite', gradient: ['#10B981', '#14B8A6'] as const },
      { title: 'Pharmacies', icon: 'store', route: '/organization/pharmacies', gradient: ['#EC4899', '#F43F5E'] as const },
      { title: 'Shifts', icon: 'calendar-month', route: '/organization/shifts', gradient: ['#06B6D4', '#0EA5E9'] as const },
      { title: 'Calendar', icon: 'calendar', route: '/organization/calendar', gradient: ['#22C55E', '#16A34A'] as const },
      { title: 'Hub', icon: 'account-group', route: '/organization/hub', gradient: ['#F59E0B', '#F97316'] as const },
      { title: 'Talent Hub', icon: 'account-search', route: '/organization/talent-board', gradient: ['#2563EB', '#1D4ED8'] as const },
      { title: 'Messages', icon: 'message-text', route: '/organization/chat', gradient: ['#8B5CF6', '#A78BFA'] as const },
    ],
    []
  );

  const formatShiftDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text>Loading organization dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="bodyMedium" style={styles.greetingText}>
            {greeting}
          </Text>
          <Text variant="headlineMedium" style={styles.nameText}>
            {organizationName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.pillHero}
          onPress={() => router.push('/organization/pills' as any)}
          activeOpacity={0.82}
        >
          <LinearGradient colors={['#4F46E5', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pillHeroGradient}>
            <View style={styles.pillHeroCopy}>
              <Text variant="labelMedium" style={styles.pillHeroEyebrow}>
                Organization rewards
              </Text>
              <View style={styles.pillBalanceRow}>
                <Text variant="displaySmall" style={styles.pillBalanceValue}>
                  {pillSummary.balance}
                </Text>
                <Text variant="titleMedium" style={styles.pillBalanceLabel}>
                  pills
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.pillHeroText}>
                Use pills toward organization shift posting actions.
              </Text>
              <View style={styles.pillMetaRow}>
                <Chip compact style={styles.pillMetaChip} textStyle={styles.pillMetaChipText}>
                  {pillSummary.shift_post_cost} pills per shift post
                </Chip>
                <Chip compact style={styles.pillMetaChip} textStyle={styles.pillMetaChipText}>
                  View activity
                </Chip>
              </View>
            </View>
            <Image source={require('@/assets/images/drugs.png')} style={styles.pillHeroImage} resizeMode="contain" />
          </LinearGradient>
        </TouchableOpacity>

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

        {shifts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Active Shifts
              </Text>
              <TouchableOpacity onPress={() => router.push('/organization/shifts' as any)}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {shifts.slice(0, 3).map((shift) => (
              <Surface key={shift.id} style={styles.shiftPreviewCard}>
                <View style={styles.shiftPreviewContent}>
                  <View style={styles.shiftPreviewLeft}>
                    <View style={styles.shiftIconContainer}>
                      <IconButton icon="calendar-clock" size={20} iconColor="#6366F1" />
                    </View>
                    <View style={styles.shiftTextColumn}>
                      <Text variant="labelMedium" style={styles.shiftPharmacyName} numberOfLines={1}>
                        {shift.pharmacyName}
                      </Text>
                      <Text variant="bodySmall" style={styles.shiftRole} numberOfLines={1}>
                        {shift.role || 'Staff'}
                        {formatShiftDate(shift.date) ? ` · ${formatShiftDate(shift.date)}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Chip compact style={styles.shiftStatusChip}>
                    {shift.status || 'Pending'}
                  </Chip>
                </View>
              </Surface>
            ))}
          </View>
        )}

        <Surface style={styles.bottomSection}>
          <TouchableOpacity style={styles.bottomMenuItem} onPress={() => router.push('/organization/profile' as any)}>
            <View style={styles.bottomMenuIcon}>
              <IconButton icon="account-cog" size={24} iconColor="#6366F1" />
            </View>
            <View style={styles.bottomMenuContent}>
              <Text variant="labelLarge" style={styles.bottomMenuTitle}>
                Account Settings
              </Text>
              <Text variant="bodySmall" style={styles.bottomMenuDesc}>
                Manage organization profile and preferences
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
  greetingText: { color: '#6B7280', marginBottom: 4, fontSize: 14 },
  nameText: { fontWeight: 'bold', color: '#111827', fontSize: 28 },
  pillHero: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  pillHeroGradient: {
    minHeight: 176,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillHeroCopy: { flex: 1, paddingRight: 8 },
  pillHeroEyebrow: {
    color: 'rgba(255, 255, 255, 0.78)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  pillBalanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  pillBalanceValue: { color: '#FFFFFF', fontWeight: '900', lineHeight: 48 },
  pillBalanceLabel: { color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700' },
  pillHeroText: { color: 'rgba(255, 255, 255, 0.88)', marginTop: 6, maxWidth: 230 },
  pillMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pillMetaChip: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  pillMetaChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  pillHeroImage: { width: 126, height: 126, marginRight: -8 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeaderText: { fontWeight: '700', color: '#111827', marginBottom: 16, fontSize: 18 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontWeight: '700', color: '#111827', fontSize: 18 },
  seeAllText: { color: '#6366F1', fontWeight: '600', fontSize: 14 },
  shiftPreviewCard: { marginBottom: 12, borderRadius: 12, backgroundColor: '#FFFFFF', elevation: 1 },
  shiftPreviewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  shiftPreviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  shiftIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  shiftTextColumn: { flex: 1, minWidth: 0 },
  shiftPharmacyName: { color: '#111827', fontWeight: '600' },
  shiftRole: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  shiftStatusChip: { alignSelf: 'center', marginLeft: 8, backgroundColor: '#FEF3C7' },
  bottomSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 2,
  },
  bottomMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  bottomMenuIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  bottomMenuContent: { flex: 1, marginLeft: 12 },
  bottomMenuTitle: { color: '#111827', fontWeight: '600' },
  bottomMenuDesc: { color: '#6B7280', fontSize: 12, marginTop: 2 },
});
