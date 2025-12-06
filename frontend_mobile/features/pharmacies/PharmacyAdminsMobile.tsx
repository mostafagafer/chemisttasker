import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import {
  ADMIN_CAPABILITY_MANAGE_ADMINS,
  ADMIN_LEVEL_HELPERS,
  ADMIN_LEVEL_LABELS,
  ADMIN_LEVEL_OPTIONS,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_OPTIONS,
  createPharmacyAdminService,
  deletePharmacyAdminService,
  fetchPharmacyAdminsService,
  type AdminLevel,
  type AdminStaffRole,
  type PharmacyAdminDTO,
} from '@chemisttasker/shared-core';
import { useAuth } from '@/context/AuthContext';
import { fetchUserRoleByEmail, formatExistingUserRole, normalizeEmail } from './inviteUtils';

const PRIMARY = '#7C3AED';

type Props = {
  pharmacyId: string;
};

type InviteForm = {
  invited_name: string;
  email: string;
  admin_level: AdminLevel;
  staff_role: AdminStaffRole;
  job_title: string;
};

const DEFAULT_FORM: InviteForm = {
  invited_name: '',
  email: '',
  admin_level: (ADMIN_LEVEL_OPTIONS[0]?.value as AdminLevel) || 'MANAGER',
  staff_role: (STAFF_ROLE_OPTIONS[0]?.value as AdminStaffRole) || 'PHARMACIST',
  job_title: '',
};

export default function PharmacyAdminsMobile({ pharmacyId }: Props) {
  const { hasCapability } = useAuth();
  const canManageAdmins = useMemo(
    () => hasCapability(ADMIN_CAPABILITY_MANAGE_ADMINS, pharmacyId),
    [hasCapability, pharmacyId],
  );

  const [admins, setAdmins] = useState<PharmacyAdminDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<InviteForm>(DEFAULT_FORM);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [existingUserRole, setExistingUserRole] = useState<any>(undefined);
  const [removeTarget, setRemoveTarget] = useState<PharmacyAdminDTO | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await fetchPharmacyAdminsService({ pharmacy_id: Number(pharmacyId), page_size: 500 } as any);
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      // keep owners hidden from edits (matches web)
      const visible = list.filter((a: any) => (a.admin_level || '').toUpperCase() !== 'OWNER');
      setAdmins(visible);
    } catch (err: any) {
      setSnackbar(err?.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEmailBlur = async () => {
    const normalized = normalizeEmail(form.email);
    if (!normalized || !normalized.includes('@')) {
      setExistingUserRole(undefined);
      return;
    }
    setCheckingRole(true);
    try {
      const role = await fetchUserRoleByEmail(normalized);
      setExistingUserRole(role);
    } catch {
      setExistingUserRole(undefined);
    } finally {
      setCheckingRole(false);
    }
  };

  const handleInvite = async () => {
    const email = normalizeEmail(form.email);
    if (!email || !email.includes('@')) {
      setSnackbar('Please provide a valid email.');
      return;
    }
    if (!canManageAdmins) {
      setSnackbar('You do not have permission to invite admins.');
      return;
    }
    setInviteLoading(true);
    try {
      await createPharmacyAdminService({
        pharmacy: Number(pharmacyId),
        email,
        invited_name: form.invited_name?.trim() || undefined,
        admin_level: form.admin_level,
        staff_role: form.staff_role,
        job_title: form.job_title?.trim() || undefined,
      });
      setSnackbar('Admin invitation sent.');
      setInviteOpen(false);
      setForm(DEFAULT_FORM);
      setExistingUserRole(undefined);
      await load();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;
      setSnackbar(detail || 'Failed to send invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget?.id) return;
    if (!canManageAdmins || removeTarget.can_remove === false) {
      setSnackbar('You do not have permission to remove this admin.');
      return;
    }
    setRemoveLoading(true);
    try {
      await deletePharmacyAdminService(removeTarget.id);
      setSnackbar('Admin removed.');
      setRemoveTarget(null);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message;
      setSnackbar(detail || 'Failed to remove admin.');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Admins</Text>
        {canManageAdmins ? (
          <Button mode="contained" onPress={() => setInviteOpen(true)}>
            Invite Admin
          </Button>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : admins.length === 0 ? (
        <Text style={styles.muted}>No admins yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 8 }}>
          {admins.map((adm, idx) => {
            const adminLevel = (adm as any).admin_level;
            const adminLabel = ADMIN_LEVEL_LABELS[adminLevel as keyof typeof ADMIN_LEVEL_LABELS] || adminLevel;
            const helper = ADMIN_LEVEL_HELPERS[adminLevel as keyof typeof ADMIN_LEVEL_HELPERS];
            const staffRoleLabel = (adm as any).staff_role
              ? STAFF_ROLE_LABELS[(adm as any).staff_role as keyof typeof STAFF_ROLE_LABELS]
              : undefined;
            const canRemove = canManageAdmins && (adm as any).can_remove !== false;
            return (
              <Card key={`${adm.id ?? idx}`} style={styles.card} mode="outlined">
                <Card.Title
                  title={
                    adm.invited_name ||
                    [adm.user_details?.first_name, adm.user_details?.last_name].filter(Boolean).join(' ') ||
                    adm.email ||
                    'Admin'
                  }
                  subtitle={[adminLabel, staffRoleLabel].filter(Boolean).join(' • ') || 'Admin'}
                  right={(props) =>
                    canRemove ? <IconButton {...props} icon="delete" onPress={() => setRemoveTarget(adm)} /> : undefined
                  }
                />
                {helper ? (
                  <Card.Content>
                    <Text style={styles.muted}>{helper}</Text>
                  </Card.Content>
                ) : null}
              </Card>
            );
          })}
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={inviteOpen} onDismiss={() => setInviteOpen(false)}>
          <Dialog.Title>Invite Admin</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <TextInput
              label="Full Name"
              value={form.invited_name}
              onChangeText={(v) => setForm((prev) => ({ ...prev, invited_name: v }))}
            />
            <TextInput
              label="Email"
              value={form.email}
              onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
              onBlur={handleEmailBlur}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {checkingRole ? <Text style={styles.muted}>Checking account...</Text> : null}
            {!checkingRole && existingUserRole ? (
              <Text style={styles.muted}>{formatExistingUserRole(existingUserRole)}</Text>
            ) : null}
            <TextInput
              label="Admin Level"
              value={form.admin_level}
              onChangeText={(v) => setForm((prev) => ({ ...prev, admin_level: v as AdminLevel }))}
              right={<TextInput.Icon icon="menu-down" />}
            />
            <Text style={styles.muted}>Admins inherit capabilities by level (web-parity).</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ADMIN_LEVEL_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={form.admin_level === opt.value}
                  onPress={() => setForm((prev) => ({ ...prev, admin_level: opt.value as AdminLevel }))}
                >
                  {opt.label}
                </Chip>
              ))}
            </View>
            <TextInput
              label="Staff Role"
              value={form.staff_role}
              onChangeText={(v) => setForm((prev) => ({ ...prev, staff_role: v as AdminStaffRole }))}
              right={<TextInput.Icon icon="menu-down" />}
            />
            <Text style={styles.muted}>Staff role gates roster/communications access (matches web labels).</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {STAFF_ROLE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={form.staff_role === opt.value}
                  onPress={() => setForm((prev) => ({ ...prev, staff_role: opt.value as AdminStaffRole }))}
                >
                  {STAFF_ROLE_LABELS[opt.value as keyof typeof STAFF_ROLE_LABELS] || opt.label || opt.value}
                </Chip>
              ))}
            </View>
            <TextInput
              label="Job Title (optional)"
              value={form.job_title}
              onChangeText={(v) => setForm((prev) => ({ ...prev, job_title: v }))}
            />
            <Text style={styles.muted}>
              Owners cannot be removed. Managers can remove lower levels only (same as web).
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInviteOpen(false)}>Cancel</Button>
            <Button onPress={handleInvite} mode="contained" loading={inviteLoading} disabled={inviteLoading}>
              {inviteLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!removeTarget} onDismiss={() => setRemoveTarget(null)}>
          <Dialog.Title>Remove Admin</Dialog.Title>
          <Dialog.Content>
            <Text>Remove {removeTarget?.invited_name || removeTarget?.email || 'this admin'}?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveTarget(null)} disabled={removeLoading}>Cancel</Button>
            <Button onPress={handleRemove} textColor="#B91C1C" loading={removeLoading} disabled={removeLoading}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontWeight: '700', color: '#111827' },
  muted: { color: '#6B7280' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { borderRadius: 12, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
});
