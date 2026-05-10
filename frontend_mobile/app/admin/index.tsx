import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Chip, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/utils/apiClient';

export default function AdminHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [pillSummary, setPillSummary] = useState({ balance: 0, shift_post_cost: 0 });
  const assignment = useMemo(() => {
    const assignments = Array.isArray((user as any)?.admin_assignments)
      ? (user as any).admin_assignments
      : [];
    return assignments.find((item: any) => item?.pharmacy_id || item?.pharmacyId) || assignments[0] || null;
  }, [user]);
  const pharmacyId = assignment?.pharmacy_id ?? assignment?.pharmacyId ?? assignment?.pharmacy ?? null;
  const pharmacyName = assignment?.pharmacy_name ?? assignment?.pharmacyName ?? (pharmacyId ? `Pharmacy #${pharmacyId}` : 'Admin pharmacy');

  useEffect(() => {
    let mounted = true;
    apiClient.get('/client-profile/pill-rewards/balance/')
      .then(({ data }) => {
        if (!mounted) return;
        setPillSummary({
          balance: Number(data?.balance ?? 0),
          shift_post_cost: Number(data?.shift_post_cost ?? 0),
        });
      })
      .catch(() => {
        if (mounted) setPillSummary({ balance: 0, shift_post_cost: 0 });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const adminPath = (path: string) => {
    if (pharmacyId) {
      return `/admin/${pharmacyId}/${path}`;
    }
    return `/admin/${path}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Surface style={styles.hero}>
          <Text variant="labelLarge" style={styles.eyebrow}>Admin workspace</Text>
          <Text variant="headlineSmall" style={styles.title}>{pharmacyName}</Text>
          <Text style={styles.subtitle}>
            Manage shifts, referrals, and pill rewards for the pharmacy you administer.
          </Text>
        </Surface>

        <TouchableOpacity
          style={styles.pillHero}
          onPress={() => router.push(adminPath('pills') as any)}
          activeOpacity={0.84}
        >
          <LinearGradient colors={['#4F46E5', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pillHeroGradient}>
            <View style={styles.pillHeroCopy}>
              <Text variant="labelMedium" style={styles.pillHeroEyebrow}>Pharmacy admin pills</Text>
              <View style={styles.pillBalanceRow}>
                <Text variant="displaySmall" style={styles.pillBalanceValue}>{pillSummary.balance}</Text>
                <Text variant="titleMedium" style={styles.pillBalanceLabel}>pills</Text>
              </View>
              <Text variant="bodySmall" style={styles.pillHeroText}>Use pills toward shift posting for this admin workspace.</Text>
              <View style={styles.pillMetaRow}>
                <Chip compact style={styles.pillMetaChip} textStyle={styles.pillMetaChipText}>
                  {pillSummary.shift_post_cost} pills per shift post
                </Chip>
                {pharmacyId ? (
                  <Chip compact style={styles.pillMetaChip} textStyle={styles.pillMetaChipText}>
                    Pharmacy #{pharmacyId}
                  </Chip>
                ) : null}
              </View>
            </View>
            <Image source={require('@/assets/images/drugs.png')} style={styles.pillHeroImage} resizeMode="contain" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.grid}>
          <ActionCard title="Shift Centre" description="Active, confirmed, and history" onPress={() => router.push('/admin/shifts' as any)} />
          <ActionCard title="Post Shift" description="Create a shift for this pharmacy" onPress={() => router.push(adminPath('post-shift') as any)} />
          <ActionCard title="Pharmacies" description="Manage pharmacy details and staff" onPress={() => router.push('/admin/pharmacies' as any)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ActionCard({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  return (
    <Surface style={styles.card}>
      <Text variant="titleMedium" style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{description}</Text>
      <Button mode="contained-tonal" onPress={onPress} style={styles.cardButton}>Open</Button>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, gap: 16 },
  hero: { borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF' },
  eyebrow: { color: '#6366F1', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#111827', fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#6B7280', marginTop: 8, lineHeight: 20 },
  grid: { gap: 12 },
  card: { borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF' },
  cardTitle: { color: '#111827', fontWeight: '800' },
  cardText: { color: '#6B7280', marginTop: 4, marginBottom: 12 },
  cardButton: { alignSelf: 'flex-start' },
  pillHero: { borderRadius: 22, overflow: 'hidden' },
  pillHeroGradient: {
    minHeight: 180,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillHeroCopy: { flex: 1, paddingRight: 8 },
  pillHeroEyebrow: { color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: 1 },
  pillBalanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  pillBalanceValue: { color: '#FFFFFF', fontWeight: '900', lineHeight: 48 },
  pillBalanceLabel: { color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  pillHeroText: { color: 'rgba(255,255,255,0.9)', marginTop: 8, maxWidth: 230 },
  pillMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pillMetaChip: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pillMetaChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  pillHeroImage: { width: 118, height: 118, marginRight: -8 },
});
