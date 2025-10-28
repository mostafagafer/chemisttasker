// frontend: src/pages/dashboard/organization/ClaimPharmaciesPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Container,
  TextField,
  Button,
  Table,
  TableHead,
  TableCell,
  TableBody,
  TableRow,
  Alert,
  CircularProgress,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import type { OrgMembership } from '../../../contexts/AuthContext';
import { ORG_ROLES } from '../../../constants/roles';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

type ClaimStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

interface UserSummary {
  id: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface PharmacySummary {
  id: number;
  name: string;
  email: string | null;
  organization_id: number | null;
  owner: {
    id: number;
    user_id: number;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface PharmacyClaimItem {
  id: number;
  status: ClaimStatus;
  status_display?: string;
  pharmacy: PharmacySummary;
  message?: string | null;
  response_message?: string | null;
  requested_by_user?: UserSummary | null;
  responded_by_user?: UserSummary | null;
  created_at: string;
  responded_at: string | null;
}

const STATUS_COLOR: Record<ClaimStatus, 'success' | 'warning' | 'error'> = {
  ACCEPTED: 'success',
  PENDING: 'warning',
  REJECTED: 'error',
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

export default function ClaimPharmaciesPage() {
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

  const [pharmacyEmail, setPharmacyEmail] = useState('');
  const [claims, setClaims] = useState<PharmacyClaimItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!orgId) {
      setError('Organization not found.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get(API_ENDPOINTS.organizationDashboard(orgId));
      const payload = Array.isArray(res.data?.pharmacy_claims) ? res.data.pharmacy_claims : [];
      setClaims(payload);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load claim requests.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  const handleClaim = async () => {
    if (!pharmacyEmail.trim()) {
      setError('Please enter a pharmacy email.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post(API_ENDPOINTS.claimOnboarding, {
        pharmacy_email: pharmacyEmail.trim(),
      });
      setPharmacyEmail('');
      await loadClaims();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ??
        'Claim failed. Please confirm you are an Org-Admin.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const { pendingCount, acceptedCount } = useMemo(() => {
    const pending = claims.filter(c => c.status === 'PENDING').length;
    const accepted = claims.filter(c => c.status === 'ACCEPTED').length;
    return { pendingCount: pending, acceptedCount: accepted };
  }, [claims]);

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Claim Pharmacies by Email
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        label="Pharmacy Email"
        margin="normal"
        value={pharmacyEmail}
        onChange={e => setPharmacyEmail(e.target.value)}
      />
      <Button
        variant="contained"
        onClick={handleClaim}
        disabled={submitting}
        sx={{ mt: 1 }}
      >
        {submitting ? <CircularProgress size={20} /> : 'Submit Claim'}
      </Button>

      <Box sx={{ display: 'flex', gap: 3, mt: 4 }}>
        <Typography variant="body1">
          Pending: <strong>{pendingCount}</strong>
        </Typography>
        <Typography variant="body1">
          Accepted: <strong>{acceptedCount}</strong>
        </Typography>
      </Box>

      <Typography variant="h6" sx={{ mt: 2 }}>
        Claim Activity
      </Typography>

      {loading && <CircularProgress sx={{ mt: 2 }} />}

      {!loading && claims.length === 0 && (
        <Typography sx={{ mt: 2 }}>
          No claim activity yet.
        </Typography>
      )}

      {!loading && claims.length > 0 && (
        <Table sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Pharmacy</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell>Responded</TableCell>
              <TableCell>Response Note</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {claims.map(claim => (
              <TableRow key={claim.id}>
                <TableCell>
                  <Typography fontWeight={600}>{claim.pharmacy?.name ?? '—'}</Typography>
                  {claim.pharmacy?.email && (
                    <Typography variant="body2" color="text.secondary">
                      {claim.pharmacy.email}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={claim.status_display ?? claim.status}
                    color={STATUS_COLOR[claim.status]}
                    size="small"
                  />
                </TableCell>
                <TableCell>{formatDateTime(claim.created_at)}</TableCell>
                <TableCell>{formatDateTime(claim.responded_at)}</TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  {claim.response_message ? (
                    <Typography variant="body2">{claim.response_message}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {claim.status === 'PENDING'
                        ? 'Awaiting owner decision'
                        : '—'}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}
