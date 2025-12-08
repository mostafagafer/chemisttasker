import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native-paper';
import { getPharmacyById, fetchMembershipsByPharmacy, fetchPharmacyAdminsService, PharmacyDTO, MembershipDTO, PharmacyAdminDTO } from '@chemisttasker/shared-core';
import PharmacyDetailView from '@/roles/shared/pharmacies/PharmacyDetailView';

export default function OrganizationPharmacyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [pharmacy, setPharmacy] = useState<PharmacyDTO | null>(null);
  const [memberships, setMemberships] = useState<MembershipDTO[]>([]);
  const [admins, setAdmins] = useState<PharmacyAdminDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pData, mData, aData] = await Promise.all([
        getPharmacyById(id),
        fetchMembershipsByPharmacy(Number(id)),
        fetchPharmacyAdminsService({ pharmacy: id })
      ]);
      setPharmacy(pData as any);
      setMemberships(mData as any || []);
      setAdmins(aData as any || []);
    } catch (e: any) {
      console.error(e);
      setError('Failed to load pharmacy details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  if (error || !pharmacy) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>{error || 'Pharmacy not found'}</Text></View>;
  }

  return (
    <PharmacyDetailView
      pharmacy={pharmacy}
      memberships={memberships}
      adminAssignments={admins}
      onMembershipsChanged={loadData}
      onAdminsChanged={loadData}
      loading={loading}
    />
  );
}
