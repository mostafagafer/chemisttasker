import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, SegmentedButtons, IconButton, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

// Shared components
import PublicShiftsView from '@/roles/shared/shifts/PublicShiftsView';
import CommunityShiftsView from '@/roles/shared/shifts/CommunityShiftsView';
import WorkerConfirmedShiftsView from '@/roles/shared/shifts/WorkerConfirmedShiftsView';
import WorkerHistoryShiftsView from '@/roles/shared/shifts/WorkerHistoryShiftsView';

// Tabs change based on workspace
const getTabsForWorkspace = (workspace: 'internal' | 'platform') => {
  if (workspace === 'internal') {
    return [
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

export default function OtherStaffShiftsScreen() {
  const { workspace, setWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('public');
  const [workspaceMenuVisible, setWorkspaceMenuVisible] = useState(false);

  const tabs = useMemo(() => getTabsForWorkspace(workspace), [workspace]);

  // Update active tab when workspace changes to avoid invalid states
  useEffect(() => {
    if (workspace === 'internal' && activeTab === 'public') {
      setActiveTab('community');
    } else if (workspace === 'platform' && activeTab === 'community') {
      setActiveTab('public');
    }
  }, [workspace]);

  const subtitle = useMemo(() => {
    switch (activeTab) {
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

      <View style={styles.content}>
        {activeTab === 'public' && <PublicShiftsView />}
        {activeTab === 'community' && <CommunityShiftsView />}
        {activeTab === 'confirmed' && <WorkerConfirmedShiftsView />}
        {activeTab === 'history' && <WorkerHistoryShiftsView invoiceRoute="/otherstaff/invoice/new" />}
      </View>
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
  content: {
    flex: 1,
  },
});
