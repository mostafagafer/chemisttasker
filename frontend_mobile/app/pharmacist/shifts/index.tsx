import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, SegmentedButtons, ActivityIndicator, Button, IconButton, Searchbar, Snackbar, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPublicShifts,
  getCommunityShifts,
  getMyConfirmedShifts,
  getMyHistoryShifts,
  getRosterWorker,
  expressInterestInPublicShift,
  expressInterestInCommunityShift,
  claimShift,
} from '@chemisttasker/shared-core';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useAuth } from '../../../context/AuthContext';

type Shift = {
  id: number;
  pharmacy_name?: string;
  pharmacyName?: string;
  suburb?: string;
  state?: string;
  start_datetime?: string;
  end_datetime?: string;
  startDatetime?: string;
  endDatetime?: string;
  status?: string;
  rateType?: string;
  hourly_rate?: string | number;
  hourlyRate?: string | number;
};

// Tabs change based on workspace
const getTabsForWorkspace = (workspace: 'internal' | 'platform') => {
  if (workspace === 'internal') {
    return [
      { value: 'roster', label: 'My Roster' },
      { value: 'community', label: 'Community' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'history', label: 'History' },
    ];
  } else {
    return [
      { value: 'public', label: 'Public' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'history', label: 'History' },
    ];
  }
};

function formatDateRange(shift: Shift) {
  const start = shift.startDatetime || shift.start_datetime;
  const end = shift.endDatetime || shift.end_datetime;
  if (!start || !end) return 'Date not provided';
  // Simple format for now, can be enhanced
  return `${start.replace('T', ' ').slice(0, 16)} - ${end.replace('T', ' ').slice(11, 16)}`;
}

export default function PharmacistShiftsScreen() {
  const router = useRouter();
  const { workspace, setWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('public');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceMenuVisible, setWorkspaceMenuVisible] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rateFilter, setRateFilter] = useState<string>('all');
  const [refreshingListVersion, setRefreshingListVersion] = useState(0);

  const tabs = useMemo(() => getTabsForWorkspace(workspace), [workspace]);

  const load = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      let data: any[] = [];
      switch (tab) {
        case 'roster':
          const rosterData = await getRosterWorker({});
          data = Array.isArray(rosterData) ? rosterData : [];
          break;
        case 'community':
          data = (await getCommunityShifts({})) as any[];
          break;
        case 'confirmed':
          data = (await getMyConfirmedShifts()) as any[];
          break;
        case 'history':
          data = (await getMyHistoryShifts()) as any[];
          break;
        case 'public':
        default:
          data = (await getPublicShifts({})) as any[];
          break;
      }
      setShifts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load shifts');
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch for worker-facing roles
    if (!user || (user.role !== 'PHARMACIST' && user.role !== 'OTHER_STAFF' && user.role !== 'EXPLORER')) {
      return;
    }
    void load(activeTab);
  }, [activeTab, load, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(activeTab);
    setRefreshing(false);
    setRefreshingListVersion((v) => v + 1);
  }, [activeTab, load]);

  const filteredShifts = useMemo(() => {
    let results = shifts;
    if (statusFilter !== 'all') {
      results = results.filter(s => (s.status || '').toLowerCase() === statusFilter.toLowerCase());
    }
    if (rateFilter !== 'all') {
      results = results.filter(s => (s.rateType || '').toLowerCase() === rateFilter.toLowerCase());
    }
    if (!searchQuery) return results;
    const lower = searchQuery.toLowerCase();
    return results.filter(s =>
      (s.pharmacy_name || s.pharmacyName || '').toLowerCase().includes(lower) ||
      (s.suburb || '').toLowerCase().includes(lower)
    );
  }, [shifts, searchQuery, statusFilter, rateFilter]);

  const handleExpressInterest = useCallback(async (shiftId: number) => {
    if (actioningId) return; // Prevent double-click

    try {
      setActioningId(shiftId);

      // Call appropriate API based on shift type
      if (activeTab === 'public') {
        await expressInterestInPublicShift(shiftId, {});
      } else if (activeTab === 'community' || activeTab === 'roster') {
        await expressInterestInCommunityShift(shiftId, {});
      } else {
        setToast({ message: 'Cannot express interest in this shift type.', visible: true });
        return;
      }

      setToast({ message: '✓ Interest submitted successfully!', visible: true });

      // Refresh the list to show updated status
      await load(activeTab);
    } catch (err: any) {
      console.error('Express interest error:', err);
      setToast({
        message: err?.message || 'Failed to submit interest. Please try again.',
        visible: true
      });
    } finally {
      setActioningId(null);
    }
  }, [activeTab, load, actioningId]);

  const subtitle = useMemo(() => {
    switch (activeTab) {
      case 'roster':
        return 'Your assigned roster shifts.';
      case 'community':
        return 'Internal or network shifts shared with you.';
      case 'confirmed':
        return 'Shifts you have accepted.';
      case 'history':
        return 'Completed shifts and history.';
      case 'public':
        return 'Open marketplace shifts available to claim.';
      default:
        return 'Browse available shifts.';
    }
  }, [activeTab]);

  // Update active tab when workspace changes
  useEffect(() => {
    if (workspace === 'internal' && activeTab === 'public') {
      setActiveTab('roster');
    } else if (workspace === 'platform' && activeTab === 'roster') {
      setActiveTab('public');
    }
  }, [workspace]);

  // If not a worker role, render nothing to avoid worker endpoints firing
  if (!user || (user.role !== 'PHARMACIST' && user.role !== 'OTHER_STAFF' && user.role !== 'EXPLORER')) {
    return null;
  }

  // If not a worker role, render nothing and skip worker endpoints
  if (!user || (user.role !== 'PHARMACIST' && user.role !== 'OTHER_STAFF' && user.role !== 'EXPLORER')) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="headlineMedium" style={styles.headerTitle}>Shift Centre</Text>
            <Text variant="bodyMedium" style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
          <Menu
            visible={workspaceMenuVisible}
            onDismiss={() => setWorkspaceMenuVisible(false)}
            anchor={
              <IconButton
                icon="briefcase-variant"
                size={24}
                iconColor="#6366F1"
                onPress={() => setWorkspaceMenuVisible(true)}
                style={styles.workspaceButton}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setWorkspace('platform');
                setWorkspaceMenuVisible(false);
              }}
              title="Platform Mode"
              leadingIcon={workspace === 'platform' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => {
                setWorkspace('internal');
                setWorkspaceMenuVisible(false);
              }}
              title="Internal Mode"
              leadingIcon={workspace === 'internal' ? 'check' : undefined}
            />
          </Menu>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={tabs.map((tab) => ({
            value: tab.value,
            label: tab.label,
            style: styles.segmentButton,
          }))}
          theme={{ colors: { secondaryContainer: '#EEF2FF', onSecondaryContainer: '#6366F1' } }}
        />
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search shifts..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor="#6B7280"
        />
        <View style={styles.filterRow}>
          <Button
            mode="outlined"
            onPress={() => setStatusFilter(statusFilter === 'all' ? 'confirmed' : statusFilter === 'confirmed' ? 'history' : 'all')}
          >
            Status: {statusFilter === 'all' ? 'Any' : statusFilter}
          </Button>
          <Button
            mode="outlined"
            onPress={() => setRateFilter(rateFilter === 'all' ? 'fixed' : rateFilter === 'fixed' ? 'pharmacist_provided' : 'all')}
          >
            Rate: {rateFilter === 'all' ? 'Any' : rateFilter}
          </Button>
        </View>
      </View>

      {(!user || (user.role !== 'PHARMACIST' && user.role !== 'OTHER_STAFF' && user.role !== 'EXPLORER')) ? null : loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : error ? (
        <Card mode="outlined" style={styles.errorCard}>
          <Card.Content>
            <View style={styles.errorContent}>
              <IconButton icon="alert-circle" size={32} iconColor="#EF4444" />
              <Text variant="titleMedium" style={{ color: '#EF4444' }}>Error loading shifts</Text>
              <Text variant="bodyMedium" style={styles.muted}>{error}</Text>
              <Button mode="contained" buttonColor="#6366F1" style={{ marginTop: 12 }} onPress={() => load(activeTab)}>
                Retry
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <FlatList
          data={filteredShifts}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
          contentContainerStyle={styles.listContent}
          extraData={refreshingListVersion}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: `/pharmacist/shifts/${item.id}`, params: { source: activeTab } } as any)}
            >
              <Card style={styles.shiftCard}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.pharmacyIcon}>
                      <IconButton icon="store" size={24} iconColor="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={styles.pharmacyName}>
                        {item.pharmacy_name || item.pharmacyName || 'Pharmacy Shift'}
                      </Text>
                      <Text variant="bodySmall" style={styles.dateRange}>
                        {formatDateRange(item)}
                      </Text>
                    </View>
                    <IconButton icon="chevron-right" size={24} iconColor="#9CA3AF" />
                  </View>

                  <View style={styles.chipRow}>
                    {item.status && (
                      <Chip
                        style={[styles.chip, { backgroundColor: item.status === 'CONFIRMED' ? '#D1FAE5' : '#F3F4F6' }]}
                        textStyle={{ color: item.status === 'CONFIRMED' ? '#059669' : '#4B5563', fontSize: 11 }}
                        compact
                      >
                        {item.status}
                      </Chip>
                    )}
                    {item.suburb && (
                      <Chip style={styles.chip} textStyle={styles.chipText} compact icon="map-marker">
                        {item.suburb}
                      </Chip>
                    )}
                    {(item.hourlyRate || item.hourly_rate) && (
                      <Chip style={styles.chip} textStyle={styles.chipText} compact icon="cash">
                        ${item.hourlyRate || item.hourly_rate}/hr
                      </Chip>
                    )}
                  </View>
                  {(activeTab === 'public' || activeTab === 'community' || activeTab === 'roster') && (
                    <Button
                      mode="outlined"
                      style={{ marginTop: 10 }}
                      onPress={() => handleExpressInterest(item.id)}
                      loading={actioningId === item.id}
                    >
                      {actioningId === item.id ? 'Submitting…' : 'Express interest'}
                    </Button>
                  )}
                </Card.Content>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconButton icon="calendar-blank" size={64} iconColor="#E5E7EB" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No shifts found</Text>
              <Text variant="bodyMedium" style={styles.emptyDesc}>
                Try adjusting your filters or check back later for new opportunities.
              </Text>
            </View>
          }
        />
      )}

      <Snackbar
        visible={toast.visible}
        onDismiss={() => setToast({ message: '', visible: false })}
        duration={3000}
      >
        {toast.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceButton: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    color: '#6B7280',
    marginTop: 4,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  segmentButton: {
    borderColor: '#E5E7EB',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  searchInput: {
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  segmentContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  shiftCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  pharmacyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmacyName: {
    fontWeight: '600',
    color: '#111827',
  },
  dateRange: {
    color: '#6B7280',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    height: 28,
  },
  chipText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '500',
  },
  errorCard: {
    margin: 20,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  errorContent: {
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#374151',
    fontWeight: '600',
    marginTop: 16,
  },
  emptyDesc: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});
