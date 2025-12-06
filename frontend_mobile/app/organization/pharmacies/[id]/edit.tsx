import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PharmacyForm from '@/features/pharmacies/PharmacyForm';

export default function OrganizationEditPharmacyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <PharmacyForm mode="edit" pharmacyId={String(id)} onSuccessPath={`/organization/pharmacies/${id}`} />;
}
