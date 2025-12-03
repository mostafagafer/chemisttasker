import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getCommunityShiftDetail,
  getPublicShiftDetail,
  getConfirmedShiftDetail,
  expressInterestInPublicShift,
  expressInterestInCommunityShift,
  claimShift,
} from '@chemisttasker/shared-core';

type ShiftDetail = {
  id: number;
  pharmacyDetail?: { name?: string; suburb?: string; state?: string };
  pharmacy_name?: string;
  pharmacyName?: string;
  roleNeeded?: string;
  status?: string;
  startDatetime?: string;
  endDatetime?: string;
  hourlyRate?: string | number;
  hourly_rate?: string | number;
  rateType?: string;
  slots?: Array<{
    id: number;
    start_time?: string;
    end_time?: string;
    role_needed?: string;
  }>;
};

function formatDate(value?: string) {
  if (!value) return 'Not provided';
  return value.replace('T', ' ').replace('Z', '');
}

export default function PharmacistShiftDetail() {
  const { id, source } = useLocalSearchParams<{ id?: string; source?: string }>();
  const router = useRouter();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const shiftId = Number(id);
      const loaders = [
        getConfirmedShiftDetail,
        getCommunityShiftDetail,
        getPublicShiftDetail,
      ];
      let result: any = null;
      for (const loader of loaders) {
        try {
          // @ts-ignore overload
          result = await loader(shiftId);
          if (result) break;
        } catch {
          // keep trying other loaders
        }
      }
      if (!result) throw new Error('Shift not found');
      setShift(result as any);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load shift');
      setShift(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInterest = useCallback(async () => {
    if (!id || !shift) return;
    const shiftId = Number(id);
    setActioning(true);
    try {
      const tab = Array.isArray(source) ? source[0] : source;
      const useCommunity = tab === 'community' || tab === 'roster';
      if (useCommunity) {
        await expressInterestInCommunityShift(shiftId, {});
      } else {
        await expressInterestInPublicShift(shiftId, {});
      }
      setError(null);
      setSuccessMessage('✓ Interest submitted successfully!');
      // Reload shift details to show updated status
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit interest');
      setSuccessMessage(null);
    } finally {
      setActioning(false);
    }
  }, [id, shift, source, load]);

  const handleClaim = useCallback(async () => {
    if (!id) return;
    const shiftId = Number(id);
    setClaiming(true);
    try {
      await claimShift(shiftId, {});
      setError(null);
      setSuccessMessage('✓ Shift claimed successfully!');
      // Reload shift details to show updated status
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to claim shift');
      setSuccessMessage(null);
    } finally {
      setClaiming(false);
    }
  }, [id, load]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (error || !shift) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <Text variant="titleMedium">Shift Details</Text>
        </View>
        <Card mode="outlined" style={styles.errorCard}>
          <Card.Content style={styles.errorContent}>
            <IconButton icon="alert-circle" size={48} iconColor="#EF4444" />
            <Text variant="titleMedium" style={{ color: '#EF4444' }}>Unable to load shift</Text>
            <Text variant="bodyMedium" style={styles.muted}>{error}</Text>
            <Button mode="contained" buttonColor="#6366F1" style={{ marginTop: 16 }} onPress={load}>
              Retry
            </Button>
          </Card.Content>
        </Card>
      </SafeAreaView>
    );
  }

  const pharmacyName =
    shift.pharmacyDetail?.name || shift.pharmacy_name || shift.pharmacyName || 'Pharmacy';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <Text variant="titleMedium" style={styles.headerTitle}>Shift Details</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.content}>
          <Card style={styles.mainCard}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientHeader}
            >
              <View style={styles.pharmacyIcon}>
                <IconButton icon="store" size={32} iconColor="#6366F1" />
              </View>
              <Text variant="headlineSmall" style={styles.pharmacyName}>{pharmacyName}</Text>
              <Text variant="bodyMedium" style={styles.pharmacyLocation}>
                {shift.pharmacyDetail?.suburb ? `${shift.pharmacyDetail.suburb}, ${shift.pharmacyDetail.state ?? ''}` : 'Location Hidden'}
              </Text>

              <View style={styles.statusChipRow}>
                {shift.status && (
                  <Chip
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    textStyle={{ color: '#FFFFFF' }}
                  >
                    {shift.status}
                  </Chip>
                )}
              </View>
            </LinearGradient>

            <Card.Content style={styles.cardContent}>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text variant="labelMedium" style={styles.label}>Role</Text>
                  <Text variant="bodyLarge" style={styles.value}>{shift.roleNeeded || 'Pharmacist'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text variant="labelMedium" style={styles.label}>Rate Type</Text>
                  <Text variant="bodyLarge" style={styles.value}>{shift.rateType || 'N/A'}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <IconButton icon="clock-outline" size={20} iconColor="#6366F1" />
                  <Text variant="titleSmall" style={styles.sectionTitle}>Timing</Text>
                </View>
                <View style={styles.timeRow}>
                  <View>
                    <Text variant="labelSmall" style={styles.muted}>Start</Text>
                    <Text variant="bodyMedium">{formatDate(shift.startDatetime)}</Text>
                  </View>
                  <View>
                    <Text variant="labelSmall" style={styles.muted}>End</Text>
                    <Text variant="bodyMedium">{formatDate(shift.endDatetime)}</Text>
                  </View>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <IconButton icon="cash" size={20} iconColor="#10B981" />
                  <Text variant="titleSmall" style={styles.sectionTitle}>Compensation</Text>
                </View>
                <Text variant="displaySmall" style={styles.rate}>
                  ${shift.hourlyRate ?? shift.hourly_rate ?? '0'}
                  <Text variant="bodyMedium" style={styles.muted}>/hr</Text>
                </Text>
              </View>

              {Array.isArray(shift.slots) && shift.slots.length > 0 && (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <IconButton icon="format-list-bulleted" size={20} iconColor="#6366F1" />
                      <Text variant="titleSmall" style={styles.sectionTitle}>Slots</Text>
                    </View>
                    {shift.slots.map((slot) => (
                      <View key={slot.id} style={styles.slotRow}>
                        <Text variant="bodyMedium" style={styles.value}>
                          {slot.start_time || '--'} - {slot.end_time || '--'}
                        </Text>
                        <Text variant="bodySmall" style={styles.muted}>
                          {slot.role_needed || shift.roleNeeded || 'Pharmacist'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </Card.Content>
          </Card>

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleInterest}
              style={styles.actionButton}
              loading={actioning}
              contentStyle={{ height: 48 }}
            >
              {actioning ? 'Submitting...' : 'Express interest'}
            </Button>
            <Button
              mode="outlined"
              onPress={handleClaim}
              style={styles.secondaryButton}
              loading={claiming}
              contentStyle={{ height: 48 }}
            >
              {claiming ? 'Claiming...' : 'Claim shift'}
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={styles.secondaryButton}
              textColor="#6B7280"
            >
              Cancel
            </Button>
            {successMessage ? (
              <Text variant="bodySmall" style={{ color: '#10B981', textAlign: 'center' }}>
                {successMessage}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerTitle: {
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    marginBottom: 24,
  },
  gradientHeader: {
    padding: 24,
    alignItems: 'center',
  },
  pharmacyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  pharmacyName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  pharmacyLocation: {
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
  },
  statusChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cardContent: {
    padding: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
  },
  label: {
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -12,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#374151',
  },
  timeRow: {
    gap: 12,
  },
  rate: {
    fontWeight: 'bold',
    color: '#111827',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    backgroundColor: '#6366F1',
  },
  secondaryButton: {
    borderRadius: 12,
    borderColor: '#D1D5DB',
  },
  errorCard: {
    margin: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  errorContent: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  muted: {
    color: '#6B7280',
  },
  slotRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
});
