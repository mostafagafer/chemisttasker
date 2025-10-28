// src/pages/dashboard/organization/OrganizationOverviewPage.tsx

import { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Paper, Stack } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import type { OrgMembership } from '../../../contexts/AuthContext';
import { ORG_ROLES } from '../../../constants/roles';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

export default function OrganizationOverviewPage() {
  const { user } = useAuth();
  const isOrgMembership = (membership: unknown): membership is OrgMembership => {
    if (!membership || typeof membership !== 'object') return false;
    const candidate = membership as OrgMembership & { role?: string };
    return (
      typeof candidate.organization_id === 'number' &&
      typeof candidate.role === 'string' &&
      ORG_ROLES.includes(candidate.role as any)
    );
  };
  const orgMembership = Array.isArray(user?.memberships)
    ? user.memberships.find(isOrgMembership)
    : undefined;

  const orgId = orgMembership?.organization_id;

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    apiClient
      .get(API_ENDPOINTS.organizationDashboard(orgId))
      .then(res => {
        setData(res.data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load organization dashboard.');
      });
  }, [orgId]);

  const claims = useMemo(
    () => (Array.isArray(data?.pharmacy_claims) ? data.pharmacy_claims : []),
    [data]
  );

  const pendingClaims = claims.filter((c: any) => c.status === 'PENDING').length;
  const acceptedClaims = claims.filter((c: any) => c.status === 'ACCEPTED').length;

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Typography color="error">{error}</Typography>
      </Container>
    );
  }

  if (!data) return <Typography sx={{ mt: 4 }}>Loading...</Typography>;

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4">{data.organization.name}</Typography>
      <Typography>Role: {data.organization.role}</Typography>
      <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Pending Claims
          </Typography>
          <Typography variant="h6">{pendingClaims}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Accepted Claims
          </Typography>
          <Typography variant="h6">{acceptedClaims}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Active Shifts
          </Typography>
          <Typography variant="h6">{Array.isArray(data.shifts) ? data.shifts.length : 0}</Typography>
        </Paper>
      </Stack>
    </Container>
  );
}
