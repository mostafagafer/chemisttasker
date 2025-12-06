import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PharmacyDetailView from '@/features/pharmacies/PharmacyDetailView';

export default function PharmacyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id ? <PharmacyDetailView pharmacyId={String(id)} basePath="/owner" /> : null;
}
