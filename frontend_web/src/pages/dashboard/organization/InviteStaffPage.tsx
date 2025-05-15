// src/pages/dashboard/organization/InviteStaffPage.tsx

import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { OrgMembership } from '../../../types/';
import { Container, TextField, Button, Alert, MenuItem } from '@mui/material';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

const ROLE_CHOICES = [
  { value: 'REGION_ADMIN', label: 'Region Admin' },
  { value: 'SHIFT_MANAGER', label: 'Shift Manager' },
  { value: 'ORG_ADMIN', label: 'Organization Admin' },
];

export default function InviteStaffPage() {
  const { user } = useAuth();
  if (!user) return <div>Loading user info…</div>;

  // find the organization where this user is ORG_ADMIN
  const orgMembership = user.memberships?.find((m: OrgMembership) => m.role === 'ORG_ADMIN');
  const orgId = orgMembership?.organization_id;
  if (!orgId) return <Alert severity="error">You are not an org admin.</Alert>;

  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState(ROLE_CHOICES[0].value);
  const [region, setRegion]   = useState('');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');

  const handleInvite = async () => {
    setError(''); setMessage('');
    try {
      await apiClient.post(API_ENDPOINTS.inviteOrgUser, { email, organization: orgId, role, region });
      setMessage('Invitation sent. Check console for reset link.');
    } catch {
      setError('Failed to send invite.');
    }
  };

  return (
    <Container sx={{ mt: 4, maxWidth: 500 }}>
      {error   && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <TextField fullWidth label="Email" margin="normal"
        value={email} onChange={e => setEmail(e.target.value)} />

      <TextField select fullWidth label="Role" margin="normal"
        value={role} onChange={e => setRole(e.target.value)}>
        {ROLE_CHOICES.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      <TextField fullWidth label="Region" margin="normal"
        value={region} onChange={e => setRegion(e.target.value)} />

      <Button variant="contained" onClick={handleInvite} sx={{ mt: 2 }}>
        Send Invite
      </Button>
    </Container>
  );
}
