// src/pages/onboarding/OwnerOnboarding.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Button,
  Alert,
  Snackbar,
  Switch,
  FormControlLabel,
  InputAdornment,
  Chip,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import { API_BASE_URL } from '../../constants/api';
import { getOnboardingDetail, updateOnboardingForm } from '@chemisttasker/shared-core';
import { useNavigate } from 'react-router-dom';
import ProfilePhotoUploader from '../../components/profilePhoto/ProfilePhotoUploader';
import AccountDeletionSection from '../../components/AccountDeletionSection';

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: 'MANAGER' | 'PHARMACIST';
  chain_pharmacy: boolean;
  ahpra_number: string;
  ahpra_years_since_first_registration?: number | null;
  ahpra_verified?: boolean | null;
  ahpra_verification_note?: string | null;
  profile_photo?: string | null;
  profile_photo_url?: string | null;
}

const ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Pharmacy Manager' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
];

export default function OwnerOnboarding() {
  const roleKey = 'owner';
  const navigate = useNavigate();

  const [data, setData] = useState<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'MANAGER',
    chain_pharmacy: false,
    ahpra_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [profilePhotoCleared, setProfilePhotoCleared] = useState(false);

  useEffect(() => {
    getOnboardingDetail(roleKey)
      .then(res => {
        const d: any = res;
        setData({
          username: d.username || '',
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          phone_number: d.phone_number || '',
          role: (d.role as 'MANAGER' | 'PHARMACIST') || 'MANAGER',
          chain_pharmacy: !!d.chain_pharmacy,
          ahpra_number: d.ahpra_number || '',
          ahpra_years_since_first_registration: d.ahpra_years_since_first_registration ?? null,
          ahpra_verified: typeof d.ahpra_verified === 'boolean' ? d.ahpra_verified : null,
          ahpra_verification_note: d.ahpra_verification_note || null,
        });
        const nextPhoto =
          d.profile_photo_url || (d.profile_photo ? `${API_BASE_URL}${d.profile_photo}` : null);
        setProfilePhotoPreview(nextPhoto);
        setProfilePhotoFile(null);
        setProfilePhotoCleared(false);
      })
      .catch(err => {
        if (err.response?.status !== 404) {
          setError(err.response?.data?.detail || err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [roleKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setData(prev => ({ ...prev, [name]: checked }));
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    const payload = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      payload.append(k, String(v));
    });
    payload.append('submitted_for_verification', 'true');
    if (profilePhotoFile) {
      payload.append('profile_photo', profilePhotoFile);
    } else if (profilePhotoCleared) {
      payload.append('profile_photo_clear', 'true');
    }

    await updateOnboardingForm(roleKey, payload);

    setSnackbarOpen(true);
    setLoading(false);
    setProfilePhotoFile(null);
    setProfilePhotoCleared(false);
  } catch (err: any) {
    setError(err.response?.data?.detail || err.message);
    setLoading(false);
  }
};


  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
    navigate('/dashboard/owner');
  };

  const VerifiedChip = ({ ok, label }: { ok?: boolean | null; label: string }) => {
    if (ok === true)   return <Chip icon={<CheckCircleOutlineIcon />} color="success" label={label} variant="outlined" />;
    if (ok === false)  return <Chip icon={<ErrorOutlineIcon />}   color="error"   label={`${label}`} variant="outlined" />;
    return               <Chip icon={<HourglassBottomIcon />}      label={`${label}`}               variant="outlined" />;
  };

  if (loading) return <Typography>Loading…</Typography>;

  return (
    <Container maxWidth="lg">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Profile saved successfully!
        </Alert>
      </Snackbar>

      <Paper sx={{ p: 4, mt: 4 }} elevation={3}>
        <Typography variant="h5" gutterBottom>
          Complete Onboarding
        </Typography>

        <Box sx={{ mb: 3 }}>
          <ProfilePhotoUploader
            value={profilePhotoPreview}
            onChange={(file, previewUrl, cleared) => {
              setProfilePhotoFile(file);
              setProfilePhotoPreview(previewUrl);
              setProfilePhotoCleared(Boolean(cleared) && !file);
            }}
            disabled={loading}
            helperText="This image will appear in chat and Hub for your owner persona."
          />
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            margin="normal"
            label="First Name"
            name="first_name"
            value={data.first_name}
            onChange={handleChange}
            required
          />

          <TextField
            fullWidth
            margin="normal"
            label="Last Name"
            name="last_name"
            value={data.last_name}
            onChange={handleChange}
            required
          />

          <TextField
            fullWidth
            margin="normal"
            label="Username"
            name="username"
            value={data.username}
            onChange={handleChange}
            required
          />

          <TextField
            fullWidth
            margin="normal"
            label="Phone Number"
            name="phone_number"
            value={data.phone_number}
            onChange={handleChange}
            required
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
            select
            fullWidth
            margin="normal"
            label="Role"
            name="role"
            value={data.role}
            onChange={handleChange}
            required
          >
            {ROLE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          {data.role === 'PHARMACIST' && (
            <>
              <TextField
                fullWidth
                margin="normal"
                label="AHPRA Number"
                name="ahpra_number"
                value={data.ahpra_number}
                onChange={handleChange}
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">PHA000</InputAdornment>,
                }}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Years Since First Registration"
                value={
                  data.ahpra_years_since_first_registration != null
                    ? String(data.ahpra_years_since_first_registration)
                    : ''
                }
                disabled
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mt: 1 }}>
                <VerifiedChip ok={data.ahpra_verified} label="AHPRA" />
                {typeof data.ahpra_verified === 'boolean' && (
                  <Typography
                    variant="body2"
                    title={data.ahpra_verification_note || (data.ahpra_verified ? 'Verified' : 'Pending/Not verified')}
                    sx={{
                      color: data.ahpra_verified
                        ? 'success.main'
                        : (data.ahpra_verification_note ? 'error.main' : 'text.secondary'),
                      flex: '1 1 260px',
                      minWidth: 180,
                      maxWidth: 520,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {data.ahpra_verification_note || (data.ahpra_verified ? 'AHPRA registration is valid and current.' : 'Pending/Not verified')}
                  </Typography>
                )}
              </Box>
            </>
          )}

          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Saving…' : 'Submit'}
            </Button>
          </Box>
        </Box>

        <AccountDeletionSection />
      </Paper>
    </Container>
  );
}
