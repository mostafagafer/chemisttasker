import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View, StyleSheet } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import {
  fetchHistoryShifts,
  viewAssignedShiftProfileService,
  fetchMyRatingForTargetService,
  createRatingService,
  type Shift,
  type ShiftUser,
} from '@chemisttasker/shared-core';

const PRIMARY = '#7C3AED';

export default function HistoryShiftsView() {
  const { activePersona, activeAdminPharmacyId } = useAuth();
  const scopedPharmacyId =
    activePersona === 'admin' && typeof activeAdminPharmacyId === 'number'
      ? activeAdminPharmacyId
      : null;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState<string>('');

  const [profileDialog, setProfileDialog] = useState(false);
  const [profile, setProfile] = useState<ShiftUser | null>(null);

  const [ratingDialog, setRatingDialog] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [currentStars, setCurrentStars] = useState<number>(0);
  const [currentComment, setCurrentComment] = useState<string>('');
  const [loadingRating, setLoadingRating] = useState(false);
  const [savingRating, setSavingRating] = useState(false);

  const closeSnackbar = () => setSnackbar('');

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHistoryShifts();
      const filtered =
        scopedPharmacyId != null
          ? data.filter((shift: Shift) => {
              const targetId =
                (shift as any).pharmacyDetail?.id ??
                (shift as any).pharmacy_detail?.id ??
                (shift as any).pharmacyId ??
                (shift as any).pharmacy ??
                null;
              return Number(targetId ?? NaN) === scopedPharmacyId;
            })
          : data;
      setShifts(Array.isArray(filtered) ? filtered : []);
    } catch (err: any) {
      setSnackbar(err?.response?.data?.detail || 'Failed to load history shifts');
    } finally {
      setLoading(false);
    }
  }, [scopedPharmacyId]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadShifts();
    setRefreshing(false);
  }, [loadShifts]);

  const openProfile = async (shiftId: number, slotId: number | null, userId: number) => {
    try {
      const result = await viewAssignedShiftProfileService({
        type: 'history',
        shiftId,
        slotId: slotId ?? undefined,
        userId,
      });
      setProfile(result);
      setProfileDialog(true);
    } catch (err: any) {
      setSnackbar(err?.response?.data?.detail || 'Failed to load profile');
    }
  };

  const openRateWorker = async (userId: number) => {
    setSelectedWorkerId(userId);
    setRatingDialog(true);
    setLoadingRating(true);
    try {
      const existing = await fetchMyRatingForTargetService({
        targetType: 'worker',
        targetId: userId,
      });
      if (existing) {
        setCurrentStars(existing.stars || 0);
        setCurrentComment(existing.comment || '');
      } else {
        setCurrentStars(0);
        setCurrentComment('');
      }
    } catch {
      setSnackbar('Failed to load existing rating');
      setCurrentStars(0);
      setCurrentComment('');
    } finally {
      setLoadingRating(false);
    }
  };

  const saveRating = async () => {
    if (!selectedWorkerId || currentStars === 0) return;
    setSavingRating(true);
    try {
      await createRatingService({
        direction: 'OWNER_TO_WORKER',
        ratee_user: selectedWorkerId,
        stars: currentStars,
        comment: currentComment,
      });
      setSnackbar('Worker rating saved successfully!');
      setRatingDialog(false);
    } catch {
      setSnackbar('Failed to save worker rating');
    } finally {
      setSavingRating(false);
    }
  };

  const renderStars = () => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((val) => (
        <IconButton
          key={val}
          icon={val <= currentStars ? 'star' : 'star-outline'}
          iconColor={val <= currentStars ? '#F59E0B' : '#9CA3AF'}
          onPress={() => setCurrentStars(val)}
        />
      ))}
    </View>
  );

  const renderProfileDialog = () => (
    <Portal>
      <Dialog visible={profileDialog} onDismiss={() => setProfileDialog(false)}>
        <Dialog.Title>Assigned Profile</Dialog.Title>
        <Dialog.Content>
          {profile ? (
            <View style={{ gap: 6 }}>
              <Text><Text style={styles.bold}>Name:</Text> {profile.firstName} {profile.lastName}</Text>
              <Text><Text style={styles.bold}>Email:</Text> {profile.email}</Text>
              {profile.phoneNumber ? <Text><Text style={styles.bold}>Phone:</Text> {profile.phoneNumber}</Text> : null}
              {profile.shortBio ? <Text><Text style={styles.bold}>Bio:</Text> {profile.shortBio}</Text> : null}
              {profile.resume ? <Button mode="text" onPress={() => {}}>Download CV</Button> : null}
              {profile.ratePreference ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.bold}>Rate Preference</Text>
                  <Text>Weekday: {profile.ratePreference.weekday || 'N/A'}</Text>
                  <Text>Saturday: {profile.ratePreference.saturday || 'N/A'}</Text>
                  <Text>Sunday: {profile.ratePreference.sunday || 'N/A'}</Text>
                  <Text>Public Holiday: {profile.ratePreference.publicHoliday || 'N/A'}</Text>
                  <Text>Early Morning: {profile.ratePreference.earlyMorning || 'N/A'}</Text>
                  <Text>Late Night: {profile.ratePreference.lateNight || 'N/A'}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.centered}>
              <Text>No profile data.</Text>
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setProfileDialog(false)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  const renderRatingDialog = () => (
    <Portal>
      <Dialog visible={ratingDialog} onDismiss={() => setRatingDialog(false)}>
        <Dialog.Title>Rate Assigned Worker</Dialog.Title>
        <Dialog.Content>
          {loadingRating ? (
            <View style={styles.centered}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Text>Select a star rating:</Text>
              {renderStars()}
              <TextInput
                mode="outlined"
                label="Comment (optional)"
                multiline
                value={currentComment}
                onChangeText={setCurrentComment}
              />
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setRatingDialog(false)}>Cancel</Button>
          <Button
            onPress={saveRating}
            mode="contained"
            disabled={savingRating || currentStars === 0}
            loading={savingRating}
            style={styles.primaryBtn}
            labelStyle={styles.primaryBtnText}
          >
            {savingRating ? 'Saving...' : 'Save Rating'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  const renderShiftCard = (shift: Shift) => {
    const slots = shift.slots ?? [];
    const assignments = (shift as any).slotAssignments ?? (shift as any).slot_assignments ?? [];
    const pharmacyName =
      (shift as any).pharmacyName ??
      (shift as any).pharmacy_name ??
      (shift as any).pharmacyDetail?.name ??
      (shift as any).pharmacy_detail?.name ??
      'Pharmacy';

    return (
      <Card key={shift.id} style={styles.card} mode="outlined">
        <Card.Title
          title={pharmacyName}
          subtitle={`${(shift as any).roleNeeded ?? shift.role_needed ?? 'Role'} • ${(shift as any).visibility ?? shift.visibility ?? ''}`}
        />
        <Card.Content>
          <View style={{ gap: 10 }}>
            {slots.map((slot, idx) => {
              const assign = assignments.find((a: any) => a.slotId === slot.id || a.slot_id === slot.id);
              return (
                <View key={`${slot.id ?? idx}`} style={styles.slotRow}>
                  <View>
                    <Text style={styles.slotText}>
                      {slot.date} {slot.startTime ?? slot.start_time}-{slot.endTime ?? slot.end_time}
                    </Text>
                  </View>
                  {assign ? (
                    <View style={styles.actionRow}>
                      <Button
                        mode="outlined"
                        onPress={() => openProfile(shift.id, slot.id ?? null, assign.userId ?? assign.user_id)}
                      >
                        View Assigned
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() => openRateWorker(assign.userId ?? assign.user_id)}
                        style={styles.primaryBtn}
                        labelStyle={styles.primaryBtnText}
                      >
                        Rate Chemist
                      </Button>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : shifts.length === 0 ? (
        <View style={styles.centered}>
          <Text>No past shifts found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {shifts.map(renderShiftCard)}
        </ScrollView>
      )}

      {renderProfileDialog()}
      {renderRatingDialog()}

      <Snackbar visible={!!snackbar} onDismiss={closeSnackbar} duration={3000}>
        {snackbar}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 12, borderColor: '#E5E7EB' },
  slotRow: { gap: 6 },
  slotText: { color: '#111827' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  primaryBtn: { backgroundColor: PRIMARY },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  bold: { fontWeight: '700' },
});
