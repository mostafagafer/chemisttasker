import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Snackbar,
  Text,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MembershipApplicationsPanelMobile from './MembershipApplicationsPanelMobile';
import StaffManagerMobile from './StaffManagerMobile';
import {
  fetchMembershipsByPharmacy,
  getPharmacyById,
  type PharmacyDTO,
  type MembershipDTO,
} from '@chemisttasker/shared-core';
import PharmacyAdminsMobile from './PharmacyAdminsMobile';

const PRIMARY = '#7C3AED';

type Props = {
  pharmacyId: string;
  basePath?: string; // e.g. /owner or /admin/[id]
};

const splitMemberships = (memberships: MembershipDTO[]) => {
  const nonOwners = memberships.filter((m: any) => !m.is_pharmacy_owner);
  const staff = nonOwners.filter((m: any) => {
    const role = String(m.role || '').toUpperCase();
    const work = String((m as any).employment_type || '').toUpperCase();
    return !role.includes('ADMIN') && !work.includes('LOCUM') && !work.includes('SHIFT');
  });
  const locums = nonOwners.filter((m: any) => {
    const role = String(m.role || '').toUpperCase();
    const work = String((m as any).employment_type || '').toUpperCase();
    return !role.includes('ADMIN') && (work.includes('LOCUM') || work.includes('SHIFT'));
  });
  return { staff, locums };
};

export default function PharmacyDetailView({ pharmacyId, basePath = '/owner' }: Props) {
  const router = useRouter();
  const scopedPharmacyId = null;

  const [pharmacy, setPharmacy] = useState<PharmacyDTO | null>(null);
  const [memberships, setMemberships] = useState<MembershipDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        getPharmacyById(pharmacyId),
        fetchMembershipsByPharmacy(Number(pharmacyId)),
      ]);
      setPharmacy(p as PharmacyDTO);
      setMemberships(Array.isArray(m) ? m : []);
    } catch (err: any) {
      setSnackbar(err?.message || 'Failed to load pharmacy');
    } finally {
      setLoading(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const { staff, locums } = useMemo(() => splitMemberships(memberships), [memberships]);

  const address = useMemo(() => {
    if (!pharmacy) return '';
    return [
      (pharmacy as any).street_address,
      (pharmacy as any).suburb,
      (pharmacy as any).state,
      (pharmacy as any).postcode,
    ]
      .filter(Boolean)
      .join(', ');
  }, [pharmacy]);

  const goTo = (path: string) => router.push(path as any);
  const resolve = (suffix: string) => {
    if (scopedPharmacyId != null) {
      return `/admin/${scopedPharmacyId}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
    }
    return `${basePath}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
  };

  if (loading && !pharmacy) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.muted}>Loading pharmacy...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pharmacy) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.error}>Pharmacy not found.</Text>
          <Button mode="contained" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={styles.title}>{(pharmacy as any).name}</Text>
            <Text style={styles.muted}>{address}</Text>
          </View>
          <Button mode="outlined" onPress={() => goTo(resolve(`/pharmacies/${pharmacy.id}/edit`))}>
            Edit
          </Button>
        </View>

        <View style={styles.actionsGrid}>
          <ActionTile title="Manage Staff" subtitle="Add/remove team" onPress={() => goTo(resolve(`/pharmacies/${pharmacy.id}/staff`))} />
          <ActionTile title="Check Shifts" subtitle="Roster & history" onPress={() => goTo(resolve('/shift-center'))} />
          <ActionTile title="Favourite Locums" subtitle="Quick-pick shortlist" onPress={() => goTo(resolve(`/pharmacies/${pharmacy.id}/locums`))} />
          <ActionTile title="Admins" subtitle="Assign scoped admins" onPress={() => goTo(resolve(`/pharmacies/${pharmacy.id}/admins`))} />
          <ActionTile title="Post Shift" subtitle="Publish an open shift" onPress={() => goTo(resolve('/post-shift'))} />
          <ActionTile title="Configurations" subtitle="Hours, details, rates" onPress={() => goTo(resolve('/pharmacies/manage'))} />
        </View>

        <Section title="Staff">
          <StaffManagerMobile pharmacyId={pharmacyId} category="staff" />
          <MembershipApplicationsPanelMobile
            pharmacyId={pharmacyId}
            category="FULL_PART_TIME"
            title="Pending Staff Applications"
            allowedEmploymentTypes={['FULL_TIME', 'PART_TIME', 'CASUAL']}
            defaultEmploymentType="CASUAL"
            onApproved={() => load()}
          />
        </Section>

        <Section title="Favourite Locums">
          <StaffManagerMobile pharmacyId={pharmacyId} category="locum" />
          <MembershipApplicationsPanelMobile
            pharmacyId={pharmacyId}
            category="LOCUM_CASUAL"
            title="Pending Locum Applications"
            allowedEmploymentTypes={['LOCUM', 'SHIFT']}
            defaultEmploymentType="LOCUM"
            onApproved={() => load()}
          />
        </Section>

        <Section title="Admins">
          <PharmacyAdminsMobile pharmacyId={pharmacyId} />
        </Section>
      </ScrollView>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>
    </SafeAreaView>
  );
}

const ActionTile = ({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) => (
  <Card style={styles.actionCard} mode="outlined" onPress={onPress}>
    <Card.Content>
      <Text style={styles.actionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </Card.Content>
  </Card>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 8 }}>
    <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontWeight: '700' },
  muted: { color: '#6B7280' },
  error: { color: '#B91C1C', marginBottom: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { flexBasis: '48%', borderRadius: 12, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  actionTitle: { fontWeight: '700' },
  sectionTitle: { fontWeight: '700', color: '#111827' },
  memberCard: { borderRadius: 12, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
});
