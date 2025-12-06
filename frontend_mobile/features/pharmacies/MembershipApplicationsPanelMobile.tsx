import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, IconButton, Portal, Snackbar, Text } from 'react-native-paper';
import {
  approveMembershipApplicationService,
  fetchMembershipApplicationsService,
  rejectMembershipApplicationService,
  type MembershipApplication,
} from '@chemisttasker/shared-core';

const PRIMARY = '#7C3AED';

type Props = {
  pharmacyId: string;
  category: 'FULL_PART_TIME' | 'LOCUM_CASUAL';
  title: string;
  allowedEmploymentTypes: string[];
  defaultEmploymentType: string;
  onApproved?: () => void;
  onNotification?: (message: string, severity: 'success' | 'error') => void;
};

const labelEmploymentType = (value?: string) =>
  (value || '')
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const labelCategory = (category: 'FULL_PART_TIME' | 'LOCUM_CASUAL') =>
  category === 'FULL_PART_TIME' ? 'Full/Part-time' : 'Favourite (Locum/Shift Hero)';

export default function MembershipApplicationsPanelMobile({
  pharmacyId,
  category,
  title,
  allowedEmploymentTypes,
  defaultEmploymentType,
  onApproved,
  onNotification,
}: Props) {
  const [applications, setApplications] = useState<MembershipApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [approveTypeById, setApproveTypeById] = useState<Record<number, string>>({});
  const [snackbar, setSnackbar] = useState('');
  const isFetchingRef = useRef(false);

  const notify = useCallback(
    (message: string, severity: 'success' | 'error') => {
      onNotification?.(message, severity);
      setSnackbar(message);
    },
    [onNotification],
  );

  const fetchApplications = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const results = await fetchMembershipApplicationsService({ status: 'PENDING' });
      const filtered = results.filter(
        (app: MembershipApplication) =>
          String(app.pharmacy) === String(pharmacyId) && app.category === category,
      );
      setApplications(filtered);
      setApproveTypeById((prev) => {
        const base = { ...prev };
        filtered.forEach((app: MembershipApplication) => {
          if (!base[app.id]) {
            base[app.id] = defaultEmploymentType;
          }
        });
        return base;
      });
    } catch (error: any) {
      notify(error?.response?.data?.detail || 'Failed to load applications.', 'error');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [category, defaultEmploymentType, notify, pharmacyId]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  const allowedTypes = useMemo(() => {
    if (!allowedEmploymentTypes?.length) return [defaultEmploymentType];
    return Array.from(new Set([...allowedEmploymentTypes, defaultEmploymentType]));
  }, [allowedEmploymentTypes, defaultEmploymentType]);

  const handleApprove = useCallback(
    async (app: MembershipApplication) => {
      const employmentType = approveTypeById[app.id] || defaultEmploymentType;
      try {
        await approveMembershipApplicationService(app.id, { employment_type: employmentType });
        notify('Application approved.', 'success');
        await fetchApplications();
        onApproved?.();
      } catch (error: any) {
        notify(error?.response?.data?.detail || 'Failed to approve application.', 'error');
      }
    },
    [approveTypeById, defaultEmploymentType, fetchApplications, notify, onApproved],
  );

  const handleReject = useCallback(
    async (app: MembershipApplication) => {
      try {
        await rejectMembershipApplicationService(app.id);
        notify('Application rejected.', 'success');
        await fetchApplications();
      } catch (error: any) {
        notify(error?.response?.data?.detail || 'Failed to reject application.', 'error');
      }
    },
    [fetchApplications, notify],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
  };

  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
      {loading ? (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.muted}>Loading applications...</Text>
        </View>
      ) : applications.length === 0 ? (
        <Text style={styles.muted}>No pending applications.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {applications.map((app) => {
            const name = [app.firstName, app.lastName].filter(Boolean).join(' ') || 'Applicant';
            const selectedType = approveTypeById[app.id] || defaultEmploymentType;
            return (
              <Card key={app.id} style={styles.card} mode="outlined">
                <Card.Title
                  title={name}
                  subtitle={app.email || undefined}
                  left={() => (
                    <View style={{ gap: 4 }}>
                      <Chip>{app.role}</Chip>
                      <Chip mode="outlined">{labelCategory(app.category)}</Chip>
                    </View>
                  )}
                />
                <Card.Content>
                  <Text style={styles.muted}>Approve as:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {allowedTypes.map((type) => (
                      <Chip
                        key={type}
                        selected={selectedType === type}
                        onPress={() =>
                          setApproveTypeById((prev) => ({
                            ...prev,
                            [app.id]: type,
                          }))
                        }
                      >
                        {labelEmploymentType(type)}
                      </Chip>
                    ))}
                  </ScrollView>
                  <View style={styles.actionRow}>
                    <Button mode="contained" onPress={() => handleApprove(app)}>
                      Approve
                    </Button>
                    <Button mode="outlined" onPress={() => handleReject(app)}>
                      Reject
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      )}
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontWeight: '700', color: '#111827' },
  muted: { color: '#6B7280' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderRadius: 12, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' },
});
