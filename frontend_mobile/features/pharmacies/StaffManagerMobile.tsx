import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  IconButton,
  Menu,
  Portal,
  Snackbar,
  Text,
  TextInput,
  Chip,
} from 'react-native-paper';
import {
  ADMIN_CAPABILITY_MANAGE_STAFF,
  API_ENDPOINTS,
  ROLE_LABELS,
  bulkInviteMembersService,
  createMembershipInviteLinkService,
  deleteMembershipService,
  fetchMembershipsByPharmacy,
} from '@chemisttasker/shared-core';
import type { MembershipDTO, Role, WorkType } from './types';
import {
  describeRoleMismatch,
  fetchUserRoleByEmail,
  formatExistingUserRole,
  normalizeEmail,
} from './inviteUtils';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';

type Category = 'staff' | 'locum';

type InviteState = {
  invited_name: string;
  email: string;
  role: Role;
  employment_type: WorkType;
  job_title: string;
};

const STAFF_ROLE_VALUES: Role[] = ['PHARMACIST', 'TECHNICIAN', 'ASSISTANT', 'INTERN', 'STUDENT'];
const LOCUM_ROLE_VALUES: Role[] = ['PHARMACIST', 'TECHNICIAN', 'ASSISTANT'];
const STAFF_WORK: WorkType[] = ['FULL_TIME', 'PART_TIME', 'CASUAL'];
const LOCUM_WORK: WorkType[] = ['LOCUM', 'SHIFT_HERO'];

const PRIMARY = '#7C3AED';

type Props = {
  pharmacyId: string;
  category: Category;
};

export default function StaffManagerMobile({ pharmacyId, category }: Props) {
  const { hasCapability } = useAuth();
  const [memberships, setMemberships] = useState<MembershipDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [existingUserRole, setExistingUserRole] = useState<any>(undefined);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState('14');
  const [form, setForm] = useState<InviteState>({
    invited_name: '',
    email: '',
    role: category === 'staff' ? 'PHARMACIST' : 'PHARMACIST',
    employment_type: category === 'staff' ? 'FULL_TIME' : 'LOCUM',
    job_title: '',
  });
  const [removeTarget, setRemoveTarget] = useState<MembershipDTO | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [filterRole, setFilterRole] = useState<Role | null>(null);
  const [filterWork, setFilterWork] = useState<WorkType | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'work'>('role');
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [workMenuVisible, setWorkMenuVisible] = useState(false);

  const canManageStaff = useMemo(
    () => hasCapability(ADMIN_CAPABILITY_MANAGE_STAFF, pharmacyId),
    [hasCapability, pharmacyId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await fetchMembershipsByPharmacy(Number(pharmacyId));
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const filtered = list.filter((m: any) => {
        const work = String((m as any).employmentType ?? (m as any).employment_type ?? '').toUpperCase();
        if (category === 'staff') {
          return STAFF_WORK.includes(work as WorkType);
        }
        return LOCUM_WORK.includes(work as WorkType);
      });
      setMemberships(filtered);
    } catch (err: any) {
      setSnackbar(err?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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

  const roleOptions = category === 'staff' ? STAFF_ROLE_VALUES : LOCUM_ROLE_VALUES;
  const workOptions = category === 'staff' ? STAFF_WORK : LOCUM_WORK;

  const handleInvite = async () => {
    const email = normalizeEmail(form.email);
    if (!email || !email.includes('@')) {
      setSnackbar('Please provide a valid email.');
      return;
    }
    if (!canManageStaff) {
      setSnackbar('You do not have permission to invite.');
      return;
    }
    if (existingUserRole !== undefined) {
      const mismatch = describeRoleMismatch(form.role, existingUserRole as any);
      if (mismatch) {
        setSnackbar(mismatch);
        return;
      }
    }
    if (form.employment_type === 'FULL_TIME' || form.employment_type === 'PART_TIME') {
      if (!form.job_title.trim()) {
        setSnackbar('Job title is required for full or part-time staff.');
        return;
      }
    }
    setInviteLoading(true);
    try {
      const payload = {
        invitations: [
          {
            email,
            invited_name: form.invited_name?.trim() || undefined,
            role: form.role,
            employment_type: form.employment_type,
            pharmacy: Number(pharmacyId),
            job_title: form.job_title?.trim() || undefined,
          },
        ],
      };
      await bulkInviteMembersService(payload as any);
      setSnackbar('Invitation sent.');
      setInviteOpen(false);
      setForm({
        invited_name: '',
        email: '',
        role: category === 'staff' ? 'PHARMACIST' : 'PHARMACIST',
        employment_type: category === 'staff' ? 'FULL_TIME' : 'LOCUM',
        job_title: '',
      });
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

  const handleGenerateLink = async () => {
    setInviteLink('');
    setInviteLinkLoading(true);
    try {
      const expires = Number(linkExpiry) || 14;
      const response: any = await createMembershipInviteLinkService({
        pharmacy: Number(pharmacyId),
        category: category === 'staff' ? 'FULL_PART_TIME' : 'LOCUM_CASUAL',
        expires_in_days: expires,
      });
      const token = response?.token ?? response?.data?.token ?? response;
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
      const fullLink = `${base}${API_ENDPOINTS.magicMembershipApply(String(token))}`;
      setInviteLink(fullLink);
      setSnackbar('Invite link generated (copy to share).');
    } catch (err: any) {
      setSnackbar(err?.response?.data?.detail || err?.message || 'Failed to generate link');
    } finally {
      setInviteLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await Clipboard.setStringAsync(inviteLink);
      setSnackbar('Link copied.');
    } catch {
      setSnackbar('Copy failed.');
    }
  };

  const handleRemove = async () => {
    if (!removeTarget?.id) return;
    if (!canManageStaff || (removeTarget as any).can_remove === false) {
      setSnackbar('You do not have permission to remove this member.');
      return;
    }
    setRemoveLoading(true);
    try {
      await deleteMembershipService(removeTarget.id);
      setSnackbar('Removed.');
      setRemoveTarget(null);
      await load();
    } catch (err: any) {
      setSnackbar(err?.response?.data?.detail || err?.message || 'Failed to remove');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          <View style={styles.actions}>
            {canManageStaff && (
              <>
                <Button mode="contained" onPress={() => setInviteOpen(true)}>
                  Invite {category === 'staff' ? 'Staff' : 'Locum'}
                </Button>
                <Button mode="outlined" onPress={handleGenerateLink} loading={inviteLinkLoading}>
                  Generate Invite Link
                </Button>
                <TextInput
                  mode="outlined"
                  label="Expiry (days)"
                  value={linkExpiry}
                  onChangeText={setLinkExpiry}
                  keyboardType="numeric"
                  style={{ width: 120 }}
                />
              </>
            )}
          </View>

          <View style={styles.filterRow}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                mode={sortBy === 'role' ? 'contained' : 'outlined'}
                icon="filter-variant"
                onPress={() => setSortBy('role')}
              >
                Sort: Role
              </Button>
              <Button
                mode={sortBy === 'work' ? 'contained' : 'outlined'}
                icon="filter-variant"
                onPress={() => setSortBy('work')}
              >
                Sort: Work Type
              </Button>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <Menu
                visible={roleMenuVisible}
                onDismiss={() => setRoleMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setRoleMenuVisible(true)} icon="menu-down">
                    {filterRole ? (ROLE_LABELS[filterRole as keyof typeof ROLE_LABELS] || filterRole) : 'All roles'}
                  </Button>
                }
              >
                <Menu.Item onPress={() => { setFilterRole(null); setRoleMenuVisible(false); }} title="All roles" />
                {roleOptions.map((r) => (
                  <Menu.Item
                    key={r}
                    onPress={() => { setFilterRole(r); setRoleMenuVisible(false); }}
                    title={ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r.replace('_', ' ')}
                  />
                ))}
              </Menu>
              <Menu
                visible={workMenuVisible}
                onDismiss={() => setWorkMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setWorkMenuVisible(true)} icon="menu-down">
                    {filterWork ? filterWork.replace('_', ' ') : 'All work types'}
                  </Button>
                }
              >
                <Menu.Item onPress={() => { setFilterWork(null); setWorkMenuVisible(false); }} title="All work types" />
                {workOptions.map((w) => (
                  <Menu.Item
                    key={w}
                    onPress={() => { setFilterWork(w); setWorkMenuVisible(false); }}
                    title={w.replace('_', ' ')}
                  />
                ))}
              </Menu>
            </View>
          </View>

          {memberships.length === 0 ? (
            <Text style={styles.muted}>No {category === 'staff' ? 'staff' : 'locums'} yet.</Text>
          ) : (
            (() => {
              const filtered = memberships.filter((m: any) => {
                const role = String((m as any).role || '').toUpperCase();
                const work = String((m as any).employmentType ?? (m as any).employment_type ?? '').toUpperCase();
                if (filterRole && role !== String(filterRole).toUpperCase()) return false;
                if (filterWork && work !== String(filterWork).toUpperCase()) return false;
                return true;
              });
              const sorted = [...filtered].sort((a, b) => {
                const userA = (a as any).userDetails ?? (a as any).user_details;
                const userB = (b as any).userDetails ?? (b as any).user_details;
                const nameA =
                  a.invited_name ||
                  (a as any).name ||
                  [userA?.firstName, userA?.lastName, userA?.first_name, userA?.last_name]
                    .filter(Boolean)
                    .join(' ') ||
                  a.email ||
                  userA?.email ||
                  '';
                const nameB =
                  b.invited_name ||
                  (b as any).name ||
                  [userB?.firstName, userB?.lastName, userB?.first_name, userB?.last_name]
                    .filter(Boolean)
                    .join(' ') ||
                  b.email ||
                  userB?.email ||
                  '';
                const roleA = String((a as any).role || '');
                const roleB = String((b as any).role || '');
                const workA = String((a as any).employmentType ?? (a as any).employment_type ?? '');
                const workB = String((b as any).employmentType ?? (b as any).employment_type ?? '');
                if (sortBy === 'name') return nameA.localeCompare(nameB);
                if (sortBy === 'role') return roleA.localeCompare(roleB);
                return workA.localeCompare(workB);
              });
              return sorted.map((m, idx) => {
                const user = (m as any).userDetails ?? (m as any).user_details;
                const role = (m as any).role || '';
                const work = ((m as any).employmentType ?? (m as any).employment_type) ?? '';
                const canRemove = canManageStaff && (m as any).can_remove !== false;
                const name =
                  m.invited_name ||
                  (m as any).name ||
                  [user?.firstName, user?.lastName, user?.first_name, user?.last_name]
                    .filter(Boolean)
                    .join(' ') ||
                  m.email ||
                  user?.email ||
                  'Member';
                const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role.replace('_', ' ');
                const workLabel = String(work).replace('_', ' ');
                const email = (m as any).email || (m as any).userDetails?.email || '';
                return (
                  <Card key={`${m.id ?? idx}`} style={styles.card} mode="outlined">
                    <Card.Title
                      title={name}
                      subtitle={`${roleLabel} • ${workLabel}`}
                      right={(props) =>
                        canRemove ? <IconButton {...props} icon="delete" onPress={() => setRemoveTarget(m)} /> : undefined
                      }
                    />
                    <Card.Content style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <Chip compact mode="flat">{roleLabel}</Chip>
                      <Chip compact mode="flat">{workLabel}</Chip>
                      {email ? <Chip compact mode="flat">{email}</Chip> : null}
                    </Card.Content>
                  </Card>
                );
              });
            })()
          )}
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={inviteOpen} onDismiss={() => setInviteOpen(false)}>
          <Dialog.Title>Invite {category === 'staff' ? 'Staff' : 'Locum'}</Dialog.Title>
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
              label="Role"
              value={form.role}
              onChangeText={(v) => setForm((prev) => ({ ...prev, role: v as Role }))}
              right={<TextInput.Icon icon="menu-down" />}
            />
            <Text style={styles.muted}>Must match the user’s existing account role.</Text>
            <TextInput
              label="Employment Type"
              value={form.employment_type}
              onChangeText={(v) => setForm((prev) => ({ ...prev, employment_type: v as WorkType }))}
              right={<TextInput.Icon icon="menu-down" />}
            />
            <TextInput
              label="Job Title (required for FT/PT)"
              value={form.job_title}
              onChangeText={(v) => setForm((prev) => ({ ...prev, job_title: v }))}
            />
            <Text style={styles.muted}>
              Full/part-time invitations require a job title. Locum invites skip job title (mirrors web).
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInviteOpen(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleInvite} loading={inviteLoading} disabled={inviteLoading}>
              {inviteLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!inviteLink} onDismiss={() => setInviteLink('')}>
          <Dialog.Title>Invite Link</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <TextInput value={inviteLink} editable={false} multiline />
            <Text style={styles.muted}>Link expires in {linkExpiry || '14'} days.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInviteLink('')}>Close</Button>
            <Button onPress={handleCopyLink} mode="contained">
              Copy Link
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!removeTarget} onDismiss={() => setRemoveTarget(null)}>
          <Dialog.Title>Remove member</Dialog.Title>
          <Dialog.Content>
            <Text>Remove {removeTarget?.invited_name || removeTarget?.email || 'this member'}?</Text>
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
  list: { padding: 12, gap: 12, paddingBottom: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', marginBottom: 8 },
  card: { borderRadius: 12, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  muted: { color: '#6B7280' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  filterRow: { marginBottom: 12, gap: 8 },
});
