import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, HelperText, Menu, Text, TextInput } from 'react-native-paper';
import { getOnboarding, updateOnboarding } from '@chemisttasker/shared-core';
import GooglePlacesInput from '../../shared/pharmacies/GooglePlacesInput';

type ExplorerRole = 'STUDENT' | 'JUNIOR' | 'CAREER_SWITCHER' | '';
type ApiData = {
  username?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  date_of_birth?: string | null;
  street_address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  google_place_id?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  role_type?: ExplorerRole | string | null;
};

const EXPLORER_ROLE_CHOICES = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'CAREER_SWITCHER', label: 'Career switcher' },
] as const;

const roleKey = 'explorer';

export default function ExplorerBasicInfoScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [form, setForm] = useState<ApiData>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data: any = await getOnboarding(roleKey as any);
        if (!mounted) return;
        setForm(data || {});
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.response?.data?.detail || err?.message || 'Unable to load basic info.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const setField = (k: keyof ApiData, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const roleLabel = EXPLORER_ROLE_CHOICES.find((r) => r.value === form.role_type)?.label || 'Select role';
  const handlePlaceSelect = (place: {
    address: string;
    place_id?: string;
    street_address: string;
    suburb: string;
    state: string;
    postcode: string;
    latitude?: number;
    longitude?: number;
  }) => {
    setForm((prev) => ({
      ...prev,
      street_address: place.street_address || place.address || prev.street_address || '',
      suburb: place.suburb || prev.suburb || '',
      state: place.state || prev.state || '',
      postcode: place.postcode || prev.postcode || '',
      google_place_id: place.place_id || prev.google_place_id || '',
      latitude: place.latitude ?? prev.latitude ?? null,
      longitude: place.longitude ?? prev.longitude ?? null,
    }));
  };

  const save = async (submitForVerification: boolean) => {
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('tab', 'basic');
      if (submitForVerification) fd.append('submitted_for_verification', 'true');
      if (form.username != null) fd.append('username', String(form.username));
      if (form.first_name != null) fd.append('first_name', String(form.first_name));
      if (form.last_name != null) fd.append('last_name', String(form.last_name));
      if (form.role_type != null) fd.append('role_type', String(form.role_type));
      if (form.phone_number != null) fd.append('phone_number', String(form.phone_number));
      if (form.date_of_birth != null) fd.append('date_of_birth', String(form.date_of_birth));
      (
        ['street_address', 'suburb', 'state', 'postcode', 'google_place_id', 'latitude', 'longitude'] as const
      ).forEach((k) => {
        const v = form[k];
        if (v != null && v !== '') fd.append(k, String(v));
      });
      const res: any = await updateOnboarding(roleKey as any, fd as any);
      setForm(res || {});
      Alert.alert('Saved', submitForVerification ? 'Submitted for verification.' : 'Basic info saved.');
    } catch (err: any) {
      const resp = err?.response?.data;
      if (resp && typeof resp === 'object') {
        setError(Object.entries(resp).map(([k, v]) => `${k}: ${(v as any[]).join(', ')}`).join('\n'));
      } else {
        setError(err?.message || 'Failed to save basic info.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loader}><Text>Loading basic info...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleLarge" style={styles.title}>Basic Info</Text>
        <TextInput mode="outlined" label="First Legal Name" value={form.first_name || ''} onChangeText={(v) => setField('first_name', v)} />
        <TextInput mode="outlined" label="Last Legal Name" value={form.last_name || ''} onChangeText={(v) => setField('last_name', v)} />
        <TextInput mode="outlined" label="Username" value={form.username || ''} onChangeText={(v) => setField('username', v)} />
        <TextInput mode="outlined" label="Phone Number" value={form.phone_number || ''} onChangeText={(v) => setField('phone_number', v)} />
        <Menu visible={roleMenuVisible} onDismiss={() => setRoleMenuVisible(false)} anchor={<Button mode="outlined" onPress={() => setRoleMenuVisible(true)}>{roleLabel}</Button>}>
          {EXPLORER_ROLE_CHOICES.map((opt) => (
            <Menu.Item key={opt.value} title={opt.label} onPress={() => { setField('role_type', opt.value); setRoleMenuVisible(false); }} />
          ))}
        </Menu>
        <TextInput mode="outlined" label="Date of Birth" value={form.date_of_birth || ''} onChangeText={(v) => setField('date_of_birth', v)} placeholder="YYYY-MM-DD" />
        <Text variant="titleSmall" style={styles.sectionTitle}>Address</Text>
        <View style={{ minHeight: 56, zIndex: 10 }}>
          <GooglePlacesInput
            label="Search Address"
            value={form.street_address || ''}
            onPlaceSelected={handlePlaceSelect}
          />
        </View>
        <TextInput mode="outlined" label="Street Address" value={form.street_address || ''} onChangeText={(v) => setField('street_address', v)} />
        <TextInput mode="outlined" label="Suburb" value={form.suburb || ''} onChangeText={(v) => setField('suburb', v)} />
        <View style={styles.row}>
          <TextInput style={styles.flex} mode="outlined" label="State" value={form.state || ''} onChangeText={(v) => setField('state', v)} />
          <TextInput style={styles.flex} mode="outlined" label="Postcode" value={form.postcode || ''} onChangeText={(v) => setField('postcode', v)} />
        </View>
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <View style={styles.actions}>
          <Button mode="outlined" onPress={() => save(false)} loading={saving} disabled={saving}>Save</Button>
          <Button mode="contained" onPress={() => save(true)} loading={saving} disabled={saving}>Submit & Verify Basic</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontWeight: '700', color: '#111827' },
  sectionTitle: { marginTop: 4, color: '#374151', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  actions: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
});
