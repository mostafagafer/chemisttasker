import React from 'react';
import PharmacyForm from '@/features/pharmacies/PharmacyForm';

export default function OrganizationAddPharmacyScreen() {
  return <PharmacyForm mode="create" onSuccessPath="/organization/pharmacies" />;
}
