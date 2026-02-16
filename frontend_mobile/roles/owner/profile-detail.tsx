import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, HelperText, Menu, Text, TextInput } from 'react-native-paper';
import { getOnboarding, updateOnboardingForm } from '@chemisttasker/shared-core';
import { useRouter } from 'expo-router';

type OwnerRole = 'MANAGER' | 'PHARMACIST';
type OwnerFormData = {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: OwnerRole;
  chain_pharmacy: boolean;
  ahpra_number: string;
  ahpra_years_since_first_registration?: number | null;
  ahpra_verified?: boolean | null;
  ahpra_verification_note?: string | null;
};

const ROLE_OPTIONS: Array<{ value: OwnerRole; label: string }> = [
  { value: 'MANAGER', label: 'Pharmacy Manager' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
];

export default function OwnerProfileDetailScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [form, setForm] = useState<OwnerFormData>({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'MANAGER',
    chain_pharmacy: false,
    ahpra_number: '',
    ahpra_years_since_first_registration: null,
    ahpra_verified: null,
    ahpra_verification_note: null,
  });

  const roleLabel = useMemo(
    () => ROLE_OPTIONS.find((o) => o.value === form.role)?.label || 'Select role',
    [form.role]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await getOnboarding('owner');
        setForm({
          username: data?.username || '',
          first_name: data?.first_name || '',
          last_name: data?.last_name || '',
          phone_number: data?.phone_number || '',
          role: (data?.role as OwnerRole) || 'MANAGER',
          chain_pharmacy: Boolean(data?.chain_pharmacy),
          ahpra_number: data?.ahpra_number || '',
          ahpra_years_since_first_registration: data?.ahpra_years_since_first_registration ?? null,
          ahpra_verified: typeof data?.ahpra_verified === 'boolean' ? data.ahpra_verified : null,
          ahpra_verification_note: data?.ahpra_verification_note || null,
        });
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Unable to load owner profile detail.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const submit = async () => {
    setError('');
    if (!form.first_name || !form.last_name || !form.username || !form.phone_number) {
      setError('Please complete first name, last name, username, and phone number.');
      return;
    }
    if (form.role === 'PHARMACIST' && !form.ahpra_number) {
      setError('AHPRA number is required for Pharmacist role.');
      return;
    }

    const payload = new FormData();
    payload.append('first_name', form.first_name);
    payload.append('last_name', form.last_name);
    payload.append('username', form.username);
    payload.append('phone_number', form.phone_number);
    payload.append('role', form.role);
    payload.append('chain_pharmacy', String(form.chain_pharmacy));
    payload.append('ahpra_number', form.role === 'PHARMACIST' ? form.ahpra_number : '');
    payload.append('submitted_for_verification', 'true');

    setSaving(true);
    try {
      await updateOnboardingForm('owner', payload);
      Alert.alert('Saved', 'Owner profile detail updated.');
      router.back();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to save owner profile detail.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loader}>
          <Text>Loading owner profile detail...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>

        <TextInput mode="outlined" label="First Name" value={form.first_name} onChangeText={(v) => setForm((p) => ({ ...p, first_name: v }))} />
        <TextInput mode="outlined" label="Last Name" value={form.last_name} onChangeText={(v) => setForm((p) => ({ ...p, last_name: v }))} />
        <TextInput mode="outlined" label="Username" value={form.username} onChangeText={(v) => setForm((p) => ({ ...p, username: v }))} />
        <TextInput mode="outlined" label="Phone Number" value={form.phone_number} onChangeText={(v) => setForm((p) => ({ ...p, phone_number: v }))} />

        <View style={styles.switchRow}>
          <Text variant="bodyMedium">Do you have more than one pharmacy?</Text>
          <Button mode={form.chain_pharmacy ? 'contained' : 'outlined'} compact onPress={() => setForm((p) => ({ ...p, chain_pharmacy: !p.chain_pharmacy }))}>
            {form.chain_pharmacy ? 'Yes' : 'No'}
          </Button>
        </View>

        <Menu
          visible={roleMenuVisible}
          onDismiss={() => setRoleMenuVisible(false)}
          anchor={<Button mode="outlined" onPress={() => setRoleMenuVisible(true)}>{roleLabel}</Button>}
        >
          {ROLE_OPTIONS.map((opt) => (
            <Menu.Item key={opt.value} title={opt.label} onPress={() => {
              setForm((p) => ({ ...p, role: opt.value }));
              setRoleMenuVisible(false);
            }} />
          ))}
        </Menu>

        {form.role === 'PHARMACIST' ? (
          <>
            <TextInput
              mode="outlined"
              label="AHPRA Number"
              value={form.ahpra_number}
              onChangeText={(v) => setForm((p) => ({ ...p, ahpra_number: v }))}
              left={<TextInput.Affix text="PHA000" />}
            />
            <TextInput
              mode="outlined"
              label="Years Since First Registration"
              value={form.ahpra_years_since_first_registration != null ? String(form.ahpra_years_since_first_registration) : ''}
              editable={false}
            />
            <Chip
              mode="outlined"
              icon={form.ahpra_verified === true ? 'check-circle-outline' : form.ahpra_verified === false ? 'close-circle-outline' : 'clock-outline'}
            >
              AHPRA {form.ahpra_verified === true ? 'Verified' : form.ahpra_verified === false ? 'Not Verified' : 'Pending'}
            </Chip>
            {form.ahpra_verification_note ? <HelperText type="info">{form.ahpra_verification_note}</HelperText> : null}
          </>
        ) : null}

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <View style={styles.actions}>
          <Button mode="outlined" onPress={() => router.back()}>Cancel</Button>
          <Button mode="contained" onPress={submit} loading={saving} disabled={saving}>
            {saving ? 'Saving...' : 'Submit'}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { color: '#111827', fontWeight: '700' },
  subtitle: { color: '#6B7280', marginBottom: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
