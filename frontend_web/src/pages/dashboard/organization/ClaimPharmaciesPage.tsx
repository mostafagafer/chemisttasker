// frontend: src/pages/dashboard/organization/ClaimPharmaciesPage.tsx

import { useEffect, useState } from 'react';
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
} from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { ORG_ROLES } from '../../../constants/roles';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

export default function ClaimPharmaciesPage() {
  const { user } = useAuth();
  // const orgMembership = user?.memberships?.find(m =>
  //   ORG_ROLES.includes(m.role as any)
  // );
  const orgMembership = Array.isArray(user?.memberships)
    ? user.memberships.find(m => m?.role && ORG_ROLES.includes(m.role as any))
    : null;


  const orgId = orgMembership?.organization_id;

  const [email, setEmail] = useState('');
  const [claimed, setClaimed] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadClaimed = () => {
    if (!orgId) {
      setError('Organization not found.');
      return;
    }
    setLoading(true);
    apiClient
      .get(API_ENDPOINTS.organizationDashboard(orgId))
      .then(res => {
        setClaimed(res.data.claimed_pharmacies);
        setError(null);
      })
      .catch(() => setError('Failed to load claimed pharmacies'))
      .finally(() => setLoading(false));
  };

  useEffect(loadClaimed, [orgId]);

  const handleClaim = async () => {
    if (!email) {
      setError('Please enter an owner email');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiClient.post(API_ENDPOINTS.claimOnboarding, { email });
      await loadClaimed();
    } catch (err: any) {
        // try to show the server’s `detail` first
        const msg = err.response?.data?.detail
                   ?? 'Claim failed. Are you an Org-Admin?';
        setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Claim Pharmacies by Owner Email
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        fullWidth
        label="Owner Email"
        margin="normal"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <Button
        variant="contained"
        onClick={handleClaim}
        disabled={loading}
        sx={{ mt: 1 }}
      >
        {loading ? <CircularProgress size={20} /> : 'Claim'}
      </Button>

      <Typography variant="h6" sx={{ mt: 4 }}>
        Claimed Onboarding Profiles
      </Typography>

      {loading && <CircularProgress sx={{ mt: 2 }} />}

      {!loading && claimed.length === 0 && (
        <Typography sx={{ mt: 2 }}>No pharmacies claimed yet.</Typography>
      )}

      {!loading && claimed.length > 0 && (
        <Table sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell># Pharmacies</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {claimed.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.username}</TableCell>
                <TableCell>{item.phone_number}</TableCell>
                <TableCell>{item.pharmacies_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}
