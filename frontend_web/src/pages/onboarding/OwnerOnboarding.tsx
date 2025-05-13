import React, { useState, useEffect } from 'react';
import {
  Box, Container, Paper, Typography,
  TextField, MenuItem, Button,
  Alert, Switch, FormControlLabel
} from '@mui/material';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import { useNavigate } from 'react-router-dom';

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: 'MANAGER' | 'PHARMACIST';
  chain_pharmacy: boolean;
  ahpra_number: string;
}

const ROLE_OPTIONS = [
  { value: 'MANAGER',   label: 'Pharmacy Manager' },
  { value: 'PHARMACIST', label: 'Pharmacist'    },
];

export default function OwnerOnboarding() {
  const detailUrl = API_ENDPOINTS.onboardingDetail('owner');
  const createUrl = API_ENDPOINTS.onboardingCreate('owner');
  const navigate  = useNavigate();

  const [data, setData] = useState<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'MANAGER',
    chain_pharmacy: false,
    ahpra_number: '',
  });
  const [loading, setLoading]       = useState(true);
  const [profileExists, setProfile] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    apiClient.get(detailUrl)
      .then(res => {
        const d = res.data;
        setData({
          username:       d.username || '',
          first_name:     d.first_name || '',
          last_name:      d.last_name || '',
          phone_number:   d.phone_number || '',
          role:           d.role || 'MANAGER',
          chain_pharmacy: d.chain_pharmacy || false,
          ahpra_number:   d.ahpra_number || '',
        });
        setProfile(true);
      })
      .catch(err => {
        if (err.response?.status !== 404) {
          setError(err.response?.data?.detail || err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [detailUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(d => ({ ...d, [name]: value }));
  };

  const handleSwitch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setData(d => ({ ...d, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    setLoading(true);

    try {
      const payload = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        payload.append(k, String(v));
      });

      await apiClient.request({
        method:  profileExists ? 'put' : 'post',
        url:     profileExists ? detailUrl : createUrl,
        data:    payload,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      navigate('/dashboard/owner');
      setProfile(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Loading…</Typography>;

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 4, mt: 4 }} elevation={3}>
        {error   && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Saved successfully!</Alert>}

        <Typography variant="h5" gutterBottom>
          {profileExists ? 'Update Profile' : 'Complete Onboarding'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth margin="normal" label="First Name"
            name="first_name" value={data.first_name}
            onChange={handleChange} required
          />

          <TextField
            fullWidth margin="normal" label="Last Name"
            name="last_name" value={data.last_name}
            onChange={handleChange} required
          />

          <TextField
            fullWidth margin="normal" label="Username"
            name="username" value={data.username}
            onChange={handleChange} required
          />

          <TextField
            fullWidth margin="normal" label="Phone Number"
            name="phone_number" value={data.phone_number}
             onChange={handleChange} required
          />

         <FormControlLabel
            control={
              <Switch
                checked={data.chain_pharmacy}
                onChange={handleSwitch}
                name="chain_pharmacy"
              />
            }
            label="Do you have more than one pharmacy?"
          />

          <TextField
            select fullWidth margin="normal"
            label="Role" name="role"
            value={data.role} onChange={handleChange} required
          >
            {ROLE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          {data.role === 'PHARMACIST' && (
            <TextField
              fullWidth margin="normal"
              label="AHPRA Number"
              name="ahpra_number"
              value={data.ahpra_number}
              onChange={handleChange}
              required
            />
          )}

          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button
              type="submit" variant="contained"
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Submit'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
