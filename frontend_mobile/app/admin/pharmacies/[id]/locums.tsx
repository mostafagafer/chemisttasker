import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import StaffManagerMobile from '@/features/pharmacies/StaffManagerMobile';

export default function AdminPharmacyLocumsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <StaffManagerMobile pharmacyId={String(id)} category="locum" />;
}
