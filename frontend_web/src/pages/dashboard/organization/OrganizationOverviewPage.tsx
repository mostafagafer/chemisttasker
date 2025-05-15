// src/pages/dashboard/organization/OrganizationOverviewPage.tsx

import { useEffect, useState } from 'react';
import { Container, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { ORG_ROLES } from '../../../constants/roles';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

export default function OrganizationOverviewPage() {
  const { user } = useAuth();
  // const orgMembership = user?.memberships?.find((m) =>ORG_ROLES.includes(m.role as any));
  const orgMembership = (user?.memberships || []).find(m =>ORG_ROLES.includes(m.role as any));
  const orgId = orgMembership?.organization_id;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!orgId) return;
    apiClient
      .get(API_ENDPOINTS.organizationDashboard(orgId))
      .then(res => setData(res.data))
      .catch(console.error);
  }, [orgId]);

  if (!data) return <Typography>Loading...</Typography>;

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4">{data.organization.name}</Typography>
      <Typography>Role: {data.organization.role}</Typography>
      <Typography>Claimed Pharmacies: {data.claimed_pharmacies.length}</Typography>
      <Typography>Shifts: {data.shifts.length}</Typography>
    </Container>
  );
}
