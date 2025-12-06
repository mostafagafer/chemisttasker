import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, RadioButton, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  createPharmacy,
  updatePharmacy,
  getPharmacyById,
  type PharmacyDTO,
} from '@chemisttasker/shared-core';

type Mode = 'create' | 'edit';

type Props = {
  mode: Mode;
  pharmacyId?: string;
  onSuccessPath?: string; // where to navigate after save
};

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export default function PharmacyForm({ mode, pharmacyId, onSuccessPath }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    street_address: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    abn: '',
  });

  useEffect(() => {
    if (mode !== 'edit' || !pharmacyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await getPharmacyById(pharmacyId)) as PharmacyDTO;
        if (cancelled || !data) return;
        setForm({
          name: (data as any).name || '',
          email: (data as any).email || '',
          street_address: (data as any).street_address || '',
          suburb: (data as any).suburb || '',
          state: (data as any).state || 'NSW',
          postcode: String((data as any).postcode || ''),
          abn: (data as any).abn || '',
        });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load pharmacy');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, pharmacyId]);

  const validate = () => {
    if (!form.name || !form.street_address || !form.suburb || !form.state || !form.postcode) {
      setError('Please fill in all required fields.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      if (mode === 'edit' && pharmacyId) {
        await updatePharmacy(pharmacyId, form as any);
      } else {
        await createPharmacy(form as any);
      }
      if (onSuccessPath) {
        router.replace(onSuccessPath as any);
      } else {
        router.back();
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message;
      setError(detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const title = useMemo(() => (mode === 'edit' ? 'Edit Pharmacy' : 'Add Pharmacy'), [mode]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
            <Text>Loading pharmacy...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="headlineSmall" style={styles.title}>{title}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Surface style={styles.card} elevation={1}>
              <TextInput
                label="Pharmacy Name *"
                value={form.name}
                onChangeText={(v) => setForm((prev) => ({ ...prev, name: v }))}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Email"
                value={form.email}
                onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
              />
              <TextInput
                label="Street Address *"
                value={form.street_address}
                onChangeText={(v) => setForm((prev) => ({ ...prev, street_address: v }))}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Suburb *"
                value={form.suburb}
                onChangeText={(v) => setForm((prev) => ({ ...prev, suburb: v }))}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="State *"
                value={form.state}
                onChangeText={(v) => setForm((prev) => ({ ...prev, state: v }))}
                mode="outlined"
                style={styles.input}
                right={<TextInput.Icon icon="menu-down" />}
              />
              <View style={styles.stateRow}>
                {STATES.map((s) => (
                  <View key={s} style={styles.stateItem}>
                    <RadioButton
                      value={s}
                      status={form.state === s ? 'checked' : 'unchecked'}
                      onPress={() => setForm((prev) => ({ ...prev, state: s }))}
                    />
                    <Text>{s}</Text>
                  </View>
                ))}
              </View>
              <TextInput
                label="Postcode *"
                value={form.postcode}
                onChangeText={(v) => setForm((prev) => ({ ...prev, postcode: v }))}
                mode="outlined"
                style={styles.input}
                keyboardType="numeric"
              />
              <TextInput
                label="ABN"
                value={form.abn}
                onChangeText={(v) => setForm((prev) => ({ ...prev, abn: v }))}
                mode="outlined"
                style={styles.input}
              />
            </Surface>
            <View style={styles.actions}>
              <Button mode="outlined" onPress={() => router.back()} disabled={saving}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
                {mode === 'edit' ? 'Update' : 'Create'}
              </Button>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontWeight: '700' },
  error: { color: '#B91C1C' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF', gap: 10 },
  input: { backgroundColor: '#FFFFFF' },
  stateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
