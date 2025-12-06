import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, FAB, Searchbar, Text, Dialog, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { fetchPharmaciesService, fetchMembershipsByPharmacy, deletePharmacy } from '@chemisttasker/shared-core';
import type { PharmacyDTO } from './types';

const PRIMARY = '#7C3AED';

type Props = {
  basePath?: string; // e.g. /owner or /admin/[id]
};

export default function PharmaciesListView({ basePath = '/owner' }: Props) {
  const router = useRouter();
  const scopedPharmacyId = null;

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pharmacies, setPharmacies] = useState<PharmacyDTO[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPharmacies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data: any = await fetchPharmaciesService({});
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const normalized = list.map((item: any) => ({ ...item, id: String(item.id ?? item.pharmacy_id ?? '') }));
      const scoped =
        scopedPharmacyId != null
          ? normalized.filter((p: any) => Number(p.id) === scopedPharmacyId)
          : normalized;
      setPharmacies(scoped);

      // Load staff counts per pharmacy (number of memberships)
      const counts: Record<string, number> = {};
      await Promise.all(
        scoped.map(async (p: any) => {
          try {
            const memberships: any = await fetchMembershipsByPharmacy(Number(p.id));
            counts[p.id] = Array.isArray(memberships) ? memberships.length : 0;
          } catch {
            counts[p.id] = 0;
          }
        })
      );
      setStaffCounts(counts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pharmacies');
    } finally {
      setLoading(false);
    }
  }, [scopedPharmacyId]);

  useEffect(() => {
    void loadPharmacies();
  }, [loadPharmacies]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPharmacies();
    setRefreshing(false);
  }, [loadPharmacies]);

  const filtered = pharmacies.filter((p) => {
    const name = (p as any).name || '';
    const suburb = (p as any).suburb || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suburb.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const goTo = (path: string) => router.push(path as any);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>My Pharmacies</Text>
        <Searchbar
          placeholder="Search pharmacies..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.muted}>Loading pharmacies...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <Button mode="contained" onPress={loadPharmacies}>Retry</Button>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.centered}>
              <Text variant="titleMedium" style={styles.title}>No pharmacies</Text>
              <Text style={styles.muted}>{searchQuery ? 'Try a different search' : 'Add your first pharmacy'}</Text>
              {!searchQuery && (
                <Button mode="contained" onPress={() => goTo(`${basePath}/pharmacies/add`)} style={{ marginTop: 8 }}>
                  Add Pharmacy
                </Button>
              )}
            </View>
          ) : (
            filtered.map((p) => {
              const address = [(p as any).street_address, (p as any).suburb, (p as any).state, (p as any).postcode]
                .filter(Boolean)
                .join(', ');
              return (
                <Card
                  key={p.id}
                  style={styles.card}
                  onPress={() => goTo(`${basePath}/pharmacies/${p.id}`)}
                  mode="elevated"
                >
                  <Card.Title
                    title={(p as any).name || 'Pharmacy'}
                    subtitle={address}
                  right={() =>
                    staffCounts[p.id] ? (
                      <Chip style={styles.countChip} textStyle={styles.countChipText}>
                        Staff: {staffCounts[p.id]}
                      </Chip>
                    ) : null
                  }
                />
                <Card.Actions>
                  <Button onPress={() => goTo(`${basePath}/pharmacies/${p.id}`)}>Open</Button>
                  <Button onPress={() => goTo(`${basePath}/pharmacies/${p.id}/edit`)}>Edit</Button>
                  <Button textColor="#B91C1C" onPress={() => setConfirmDelete({ id: String(p.id), name: (p as any).name || 'Pharmacy' })}>
                    Delete
                  </Button>
                </Card.Actions>
              </Card>
            );
          })
        )}
        </ScrollView>
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => goTo(`${basePath}/pharmacies/add`)}
        label="Add Pharmacy"
      />

      <Portal>
        <Dialog visible={!!confirmDelete} onDismiss={() => setConfirmDelete(null)}>
          <Dialog.Title>Delete pharmacy</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete {(confirmDelete?.name) || 'this pharmacy'}?</Text>
            <Text style={styles.muted}>This removes the pharmacy record (matches web delete).</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
            <Button
              onPress={async () => {
                if (!confirmDelete) return;
                setDeleting(true);
                try {
                  await deletePharmacy(confirmDelete.id);
                  setConfirmDelete(null);
                  await loadPharmacies();
                } catch (err: any) {
                  setError(err?.message || 'Failed to delete pharmacy');
                } finally {
                  setDeleting(false);
                }
              }}
              textColor="#B91C1C"
              loading={deleting}
              disabled={deleting}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontWeight: '700' },
  searchBar: { marginTop: 8, backgroundColor: '#F3F4F6', elevation: 0 },
  list: { padding: 12, paddingBottom: 96, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  muted: { color: '#6B7280' },
  error: { color: '#B91C1C', textAlign: 'center', marginBottom: 8 },
  card: { borderRadius: 12, backgroundColor: '#FFFFFF' },
  countChip: { backgroundColor: '#EEF2FF' },
  countChipText: { color: '#4B5563', fontWeight: '700' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
