// src/pages/onboarding/OwnerOnboarding.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { API_BASE_URL } from '../../constants/api';
import { getOnboardingDetail, updateOnboardingForm } from '@chemisttasker/shared-core';
import { useNavigate } from 'react-router-dom';
import ProfilePhotoUploader from '../../components/profilePhoto/ProfilePhotoUploader';
import apiClient from '../../utils/apiClient';
import { useAuth, type User } from '../../contexts/AuthContext';
import { UnsavedChangesBoundary, useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { AHPRA_CONSENT_TEXT } from '../../constants/ahpraConsent';

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  gender: string;
  role: 'MANAGER' | 'PHARMACIST';
  chain_pharmacy: boolean;
  number_of_pharmacies: number;
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

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const LIGHT_PAGE_BG = '#F4F7FB';
const LIGHT_SURFACE = '#FFFFFF';
const LIGHT_BORDER = '#D9E2F2';
const HERO_GRADIENT_START = '#6366F1';
const HERO_GRADIENT_END = '#8B5CF6';

type OwnerOnboardingProps = {
  standalone?: boolean;
  onSuccessPath?: string;
};

function OwnerOnboardingContent({
  standalone = false,
  onSuccessPath,
}: OwnerOnboardingProps) {
  const roleKey = 'owner';
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const isMobileVerified = Boolean(user?.is_mobile_verified);

  const [data, setData] = useState<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    gender: '',
    role: 'MANAGER',
    chain_pharmacy: false,
    number_of_pharmacies: 1,
    ahpra_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('Profile saved successfully!');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [profilePhotoCleared, setProfilePhotoCleared] = useState(false);
  const [lockedNames, setLockedNames] = useState({ first: false, last: false });
  const [subscriptionSummary, setSubscriptionSummary] = useState<{
    active: boolean;
    status: string;
    staffCount: number;
    extraSeatCount: number;
  } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const unsaved = useUnsavedChangesGuard({
    disabled: loading,
    value: {
      data,
      profilePhotoCleared,
      profilePhotoFile,
      profilePhotoPreview,
    },
  });
  const displayName = useMemo(() => {
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
    return name || data.username || 'Owner setup';
  }, [data.first_name, data.last_name, data.username]);
  const roleLabel = ROLE_OPTIONS.find((option) => option.value === data.role)?.label ?? 'Owner';
  const showAhpra = data.role === 'PHARMACIST' || Boolean(data.ahpra_number);
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: LIGHT_SURFACE,
      color: '#111827',
      borderRadius: 2,
      '& .MuiInputBase-input': {
        color: '#111827',
        WebkitTextFillColor: '#111827',
      },
      '& .MuiInputBase-input.Mui-disabled': {
        color: '#475569',
        WebkitTextFillColor: '#475569',
      },
      '& .MuiSelect-select': {
        color: '#111827',
      },
      '& .MuiInputAdornment-root': {
        color: '#64748B',
      },
      '& fieldset': {
        borderColor: LIGHT_BORDER,
      },
      '&:hover fieldset': {
        borderColor: '#B8C4DB',
      },
      '&.Mui-focused fieldset': {
        borderColor: HERO_GRADIENT_START,
        borderWidth: 1,
      },
      '&.Mui-disabled': {
        bgcolor: '#F3F6FB',
      },
    },
    '& .MuiInputLabel-root': {
      color: '#64748B',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: HERO_GRADIENT_START,
    },
    '& .MuiFormHelperText-root': {
      color: '#64748B',
      marginLeft: 0,
    },
  } as const;

  useEffect(() => {
    getOnboardingDetail(roleKey)
      .then(res => {
        const d: any = res;
        const nextData = {
          username: d.username || '',
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          phone_number: d.phone_number || '',
          gender: d.gender || '',
          role: (d.role as 'MANAGER' | 'PHARMACIST') || 'MANAGER',
          chain_pharmacy: !!d.chain_pharmacy,
          number_of_pharmacies: Math.max(1, Number(d.number_of_pharmacies) || 1),
          ahpra_number: d.ahpra_number || '',
          ahpra_years_since_first_registration: d.ahpra_years_since_first_registration ?? null,
          ahpra_verified: typeof d.ahpra_verified === 'boolean' ? d.ahpra_verified : null,
          ahpra_verification_note: d.ahpra_verification_note || null,
        };
        setData(nextData);
        setLockedNames({
          first: Boolean(d.first_name),
          last: Boolean(d.last_name),
        });
        const nextPhoto =
          d.profile_photo_url || (d.profile_photo ? `${API_BASE_URL}${d.profile_photo}` : null);
        setProfilePhotoPreview(nextPhoto);
        setProfilePhotoFile(null);
        setProfilePhotoCleared(false);
        unsaved.markClean({
          data: nextData,
          profilePhotoCleared: false,
          profilePhotoFile: null,
          profilePhotoPreview: nextPhoto,
        });
      })
      .catch(err => {
        if (err.response?.status !== 404) {
          setError(err.response?.data?.detail || err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [roleKey]);

  useEffect(() => {
    if (standalone) {
      return;
    }
    apiClient
      .get('/billing/subscription/')
      .then(({ data }) => {
        setSubscriptionSummary({
          active: !!data.active,
          status: data.status || 'inactive',
          staffCount: data.staffCount ?? 5,
          extraSeatCount: data.extraSeatCount ?? 0,
        });
      })
      .catch(() => {
        setSubscriptionSummary(null);
      });
  }, [standalone]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      [name]: name === 'number_of_pharmacies' ? Math.max(1, Number(value) || 1) : value,
    }));
  };

  const handleSwitch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setData(prev => ({
      ...prev,
      [name]: checked,
      ...(name === 'chain_pharmacy' && !checked ? { number_of_pharmacies: 1 } : {}),
    }));
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    const payload = new FormData();
    const normalizedData = {
      ...data,
      number_of_pharmacies: data.chain_pharmacy ? Math.max(1, data.number_of_pharmacies || 1) : 1,
    };
    Object.entries(normalizedData).forEach(([k, v]) => {
      payload.append(k, String(v));
    });
    payload.append('submitted_for_verification', 'true');
    if (profilePhotoFile) {
      payload.append('profile_photo', profilePhotoFile);
    } else if (profilePhotoCleared) {
      payload.append('profile_photo_clear', 'true');
    }

    await updateOnboardingForm(roleKey, payload);
    setUser((prev: User | null) => (
      prev
        ? {
            ...prev,
            mobile_number: data.phone_number,
          }
        : prev
    ));

    setSnackbarMessage('Profile saved successfully!');
    setSnackbarOpen(true);
    setLoading(false);
    setProfilePhotoFile(null);
    setProfilePhotoCleared(false);
    unsaved.markClean({
      data: normalizedData,
      profilePhotoCleared: false,
      profilePhotoFile: null,
      profilePhotoPreview,
    });
  } catch (err: any) {
    setError(err.response?.data?.detail || err.message);
    setLoading(false);
  }
};


  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
    navigate(onSuccessPath || '/dashboard/owner');
  };

  const handleCopyFriendReferral = async () => {
    setReferralLoading(true);
    try {
      const { data: referral } = await apiClient.post('/client-profile/pill-rewards/refer-friend/', {});
      const code = referral?.referral_code;
      if (!code) throw new Error('Referral code was not returned.');
      const url = new URL('/register', window.location.origin);
      url.searchParams.set('referral_code', code);
      await navigator.clipboard.writeText(url.toString());
      setError('');
      setSnackbarMessage('Referral link copied to clipboard.');
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create referral link.');
    } finally {
      setReferralLoading(false);
    }
  };

  const VerifiedChip = ({ ok, label }: { ok?: boolean | null; label: string }) => {
    if (ok === true)   return <Chip icon={<CheckCircleOutlineIcon />} color="success" label={label} variant="outlined" />;
    if (ok === false)  return <Chip icon={<ErrorOutlineIcon />}   color="error"   label={`${label}`} variant="outlined" />;
    return               <Chip icon={<HourglassBottomIcon />}      label={`${label}`}               variant="outlined" />;
  };

  if (loading) return <Typography>Loading…</Typography>;

  return (
    <UnsavedChangesBoundary>
      {() => (
    <Box sx={{ bgcolor: LIGHT_PAGE_BG, minHeight: standalone ? 'calc(100vh - 72px)' : 'auto', py: { xs: 2, md: standalone ? 3 : 0 } }}>
    <Container maxWidth="xl">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Box
        sx={{
          borderRadius: { xs: 3, md: 4 },
          overflow: 'hidden',
          mb: 2,
          background: `linear-gradient(135deg, ${HERO_GRADIENT_START}, ${HERO_GRADIENT_END})`,
          color: '#FFFFFF',
          minHeight: { xs: 220, md: 260 },
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          px: 2,
          py: { xs: 3, md: 4 },
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <ProfilePhotoUploader
            value={profilePhotoPreview}
            onChange={(file, previewUrl, cleared) => {
              setProfilePhotoFile(file);
              setProfilePhotoPreview(previewUrl);
              setProfilePhotoCleared(Boolean(cleared) && !file);
            }}
            disabled={loading}
            title=""
            helperText=""
          />
          <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            {displayName}
          </Typography>
          <Chip
            label={roleLabel.toUpperCase()}
            size="small"
            sx={{
              bgcolor: alpha('#FFFFFF', 0.22),
              color: '#FFFFFF',
              fontWeight: 800,
              letterSpacing: 0,
              border: `1px solid ${alpha('#FFFFFF', 0.28)}`,
            }}
          />
        </Stack>
      </Box>

      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          border: `1px solid ${LIGHT_BORDER}`,
          boxShadow: '0 18px 42px rgba(99, 102, 241, 0.08)',
          bgcolor: LIGHT_SURFACE,
          color: '#111827',
        }}
        elevation={0}
      >
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827' }}>
            {standalone ? 'Complete Owner Setup' : 'Complete Onboarding'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Finish your owner profile before adding your pharmacy workspace.
          </Typography>
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
            disabled={lockedNames.first}
            helperText={lockedNames.first ? 'Locked after initial registration.' : undefined}
            InputProps={lockedNames.first ? {
              endAdornment: (
                <InputAdornment position="end">
                  <LockOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            } : undefined}
            sx={inputSx}
          />

          <TextField
            fullWidth
            margin="normal"
            label="Last Name"
            name="last_name"
            value={data.last_name}
            onChange={handleChange}
            required
            disabled={lockedNames.last}
            helperText={lockedNames.last ? 'Locked after initial registration.' : undefined}
            InputProps={lockedNames.last ? {
              endAdornment: (
                <InputAdornment position="end">
                  <LockOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            } : undefined}
            sx={inputSx}
          />

          <TextField
            fullWidth
            margin="normal"
            label="Username"
            name="username"
            value={data.username}
            onChange={handleChange}
            required
            sx={inputSx}
          />

          <TextField
            fullWidth
            margin="normal"
            label="Phone Number"
            name="phone_number"
            value={data.phone_number}
            onChange={handleChange}
            required
            disabled={isMobileVerified}
            sx={inputSx}
          />
          <Box sx={{ mt: 1, mb: 1 }}>
            <VerifiedChip ok={isMobileVerified} label="Mobile Verified" />
          </Box>

          <TextField
            select
            fullWidth
            margin="normal"
            label="Gender"
            name="gender"
            value={data.gender}
            onChange={handleChange}
            sx={inputSx}
          >
            <MenuItem value="">Select gender</MenuItem>
            {GENDER_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            sx={{
              mt: 0.5,
              color: '#111827',
              '& .MuiFormControlLabel-label': {
                color: '#111827',
                fontWeight: 600,
              },
            }}
            control={
              <Switch
                checked={data.chain_pharmacy}
                onChange={handleSwitch}
                name="chain_pharmacy"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: HERO_GRADIENT_START,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: HERO_GRADIENT_START,
                  },
                }}
              />
            }
            label="Do you have more than one pharmacy?"
          />

          {data.chain_pharmacy && (
            <TextField
              fullWidth
              margin="normal"
              label="Number of Pharmacies"
              name="number_of_pharmacies"
              type="number"
              value={data.number_of_pharmacies}
              onChange={handleChange}
              inputProps={{ min: 1 }}
              helperText="You can add more pharmacies after setup as well."
              required
              sx={inputSx}
            />
          )}

          <TextField
            select
            fullWidth
            margin="normal"
            label="Role"
            name="role"
            value={data.role}
            onChange={handleChange}
            required
            sx={inputSx}
          >
            {ROLE_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          {showAhpra && (
            <>
              <TextField
                fullWidth
                margin="normal"
                label="AHPRA Number"
                name="ahpra_number"
                value={data.ahpra_number}
                onChange={handleChange}
                required={data.role === 'PHARMACIST'}
                helperText={AHPRA_CONSENT_TEXT}
                InputProps={{
                  startAdornment: <InputAdornment position="start">PHA</InputAdornment>,
                }}
                sx={inputSx}
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
                sx={inputSx}
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
                        : (data.ahpra_verification_note ? 'error.main' : '#64748B'),
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
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: '#7C8CF8',
                color: '#FFFFFF',
                px: 3,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#6978F5', boxShadow: 'none' },
              }}
            >
              {loading ? 'Saving…' : 'Submit'}
            </Button>
          </Box>
        </Box>

        {!standalone && (
        <Paper variant="outlined" sx={{ mt: 4, p: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PersonAddAltIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Refer a colleague 
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: '#64748B' }}>
                Copy a referral link. When your friend registers with it, pills can be awarded to your account.
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleCopyFriendReferral} disabled={referralLoading}>
              {referralLoading ? 'Creating...' : 'Copy referral link'}
            </Button>
          </Stack>
        </Paper>
        )}

        {!standalone && (
        <Paper variant="outlined" sx={{ mt: 4, p: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <CreditCardIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Subscription and seats
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: '#64748B' }}>
                {subscriptionSummary?.active
                  ? `Active subscription with ${subscriptionSummary.staffCount} total seats (${subscriptionSummary.extraSeatCount} extra).`
                  : 'No active subscription yet. Once active, you can manage extra seats here.'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard/owner/overview?view=billing&mode=seats')}
            >
              {subscriptionSummary?.active ? 'Manage seats' : 'Open subscription'}
            </Button>
          </Stack>
        </Paper>
        )}
      </Paper>
    </Container>
    </Box>
      )}
    </UnsavedChangesBoundary>
  );
}

export default function OwnerOnboarding(props: OwnerOnboardingProps) {
  return (
    <UnsavedChangesBoundary>
      {() => <OwnerOnboardingContent {...props} />}
    </UnsavedChangesBoundary>
  );
}
