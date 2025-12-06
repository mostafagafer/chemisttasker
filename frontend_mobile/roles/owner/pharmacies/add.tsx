import React from 'react';
import PharmacyForm from '@/features/pharmacies/PharmacyForm';

export default function OwnerAddPharmacyScreen() {
  return <PharmacyForm mode="create" onSuccessPath="/owner/pharmacies" />;
}
