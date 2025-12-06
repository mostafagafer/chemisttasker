import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, IconButton, FAB, Portal, Modal, TextInput, HelperText, Menu } from 'react-native-paper';
import { getUserAvailability, deleteUserAvailability, createUserAvailability } from '@chemisttasker/shared-core';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

type Availability = {
  id: number;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  [key: string]: any;
};

const DAYS = [
  { label: 'Monday', value: 'MONDAY' },
  { label: 'Tuesday', value: 'TUESDAY' },
  { label: 'Wednesday', value: 'WEDNESDAY' },
  { label: 'Thursday', value: 'THURSDAY' },
  { label: 'Friday', value: 'FRIDAY' },
  { label: 'Saturday', value: 'SATURDAY' },
  { label: 'Sunday', value: 'SUNDAY' },
];

export default function PharmacistAvailabilityScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Add Modal State
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState('MONDAY');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [menuVisible, setMenuVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserAvailability();
      setItems(Array.isArray(data) ? data : ((data as any)?.results ?? []));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load availability');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      await deleteUserAvailability(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete availability');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const showModal = () => setVisible(true);
  const hideModal = () => {
    setVisible(false);
    setDay('MONDAY');
    setStartTime('09:00');
    setEndTime('17:00');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createUserAvailability({
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
      });
      hideModal();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to create availability');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>Availability</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>Manage your working hours</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : error ? (
        <Card mode="outlined" style={styles.errorCard}>
          <Card.Content style={styles.errorContent}>
            <IconButton icon="alert-circle" size={32} iconColor="#EF4444" />
            <Text variant="titleMedium" style={{ color: '#EF4444' }}>Error loading availability</Text>
            <Text variant="bodyMedium" style={styles.muted}>{error}</Text>
            <Button mode="contained" buttonColor="#6366F1" style={{ marginTop: 12 }} onPress={load}>
              Retry
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.itemCard}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.row}>
                  <View style={styles.dayContainer}>
                    <View style={styles.iconBox}>
                      <IconButton icon="calendar-clock" size={24} iconColor="#6366F1" />
                    </View>
                    <View>
                      <Text variant="titleMedium" style={styles.dayText}>
                        {item.day_of_week ? item.day_of_week.charAt(0) + item.day_of_week.slice(1).toLowerCase() : 'Any day'}
                      </Text>
                      <Text variant="bodySmall" style={styles.timeText}>
                        {item.start_time?.slice(0, 5) || '--'} - {item.end_time?.slice(0, 5) || '--'}
                      </Text>
                    </View>
                  </View>
                  <IconButton
                    icon="delete-outline"
                    iconColor="#EF4444"
                    size={24}
                    onPress={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    loading={deletingId === item.id}
                  />
                </View>
                <View style={styles.chipRow}>
                  <Chip compact style={styles.chip} textStyle={styles.chipText}>{item.timezone || 'Local'}</Chip>
                </View>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconButton icon="calendar-remove" size={64} iconColor="#E5E7EB" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No availability set</Text>
              <Text variant="bodyMedium" style={styles.emptyDesc}>
                Add your availability to start receiving shift offers.
              </Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        color="#FFFFFF"
        onPress={showModal}
        label="Add Slot"
      />

      <Portal>
        <Modal visible={visible} onDismiss={hideModal} contentContainerStyle={styles.modalContainer}>
          <Card style={styles.modalCard}>
            <Card.Title title="Add Availability" />
            <Card.Content>
              <View style={styles.inputContainer}>
                <Text variant="bodyMedium" style={styles.label}>Day of Week</Text>
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setMenuVisible(true)}
                      style={styles.dropdownButton}
                      textColor="#111827"
                    >
                      {DAYS.find(d => d.value === day)?.label || day}
                    </Button>
                  }
                >
                  {DAYS.map((d) => (
                    <Menu.Item
                      key={d.value}
                      onPress={() => { setDay(d.value); setMenuVisible(false); }}
                      title={d.label}
                    />
                  ))}
                </Menu>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <TextInput
                    label="Start Time"
                    value={startTime}
                    onChangeText={setStartTime}
                    mode="outlined"
                    placeholder="09:00"
                    style={styles.input}
                  />
                  <HelperText type="info">Format: HH:MM</HelperText>
                </View>
                <View style={styles.halfInput}>
                  <TextInput
                    label="End Time"
                    value={endTime}
                    onChangeText={setEndTime}
                    mode="outlined"
                    placeholder="17:00"
                    style={styles.input}
                  />
                  <HelperText type="info">Format: HH:MM</HelperText>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button onPress={hideModal} style={styles.modalButton}>Cancel</Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                  buttonColor="#6366F1"
                  style={styles.modalButton}
                >
                  Save
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
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
  headerTitle: {
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    color: '#6B7280',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontWeight: '600',
    color: '#111827',
  },
  timeText: {
    color: '#6B7280',
  },
  chipRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  chipText: {
    color: '#4B5563',
    fontSize: 11,
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6366F1',
    borderRadius: 30,
  },
  modalContainer: {
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    color: '#374151',
    fontWeight: '500',
  },
  dropdownButton: {
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  halfInput: {
    flex: 1,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    borderRadius: 8,
  },
});
