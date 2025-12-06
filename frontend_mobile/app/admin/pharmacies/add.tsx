import React from 'react';
import PharmacyForm from '@/features/pharmacies/PharmacyForm';

export default function AdminAddPharmacyScreen() {
  return <PharmacyForm mode="create" onSuccessPath="/admin/pharmacies" />;
}
