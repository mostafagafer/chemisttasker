import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PharmacyDetailView from '@/features/pharmacies/PharmacyDetailView';

export default function OrganizationPharmacyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <PharmacyDetailView pharmacyId={String(id)} basePath="/organization" /> : null;
}
