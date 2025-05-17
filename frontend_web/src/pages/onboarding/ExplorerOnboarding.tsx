// src/pages/onboarding/ExplorerOnboarding.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  Typography,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Snackbar,
  FormGroup,
  Button,
  Alert,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../../constants/api';

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  government_id: File | null;
  role_type: string;
  interests: string[];
  referee1_email: string;
  referee2_email: string;
  short_bio: string;
  resume: File | null;
}

const ROLE_CHOICES = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'CAREER_SWITCHER', label: 'Career Switcher' },
];
const INTERESTS = ['Shadowing', 'Volunteering', 'Placement', 'Junior Assistant Role'];
const labels = ['Basic Info', 'Interests', 'Referees', 'Profile'];

export default function ExplorerOnboarding() {
  const navigate = useNavigate();
  const detailUrl = API_ENDPOINTS.onboardingDetail('explorer');
  const createUrl = API_ENDPOINTS.onboardingCreate('explorer');

  const [data, setData] = useState<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    government_id: null,
    role_type: '',
    interests: [],
    referee1_email: '',
    referee2_email: '',
    short_bio: '',
    resume: null,
  });
  const [existingGovId, setExistingGovId] = useState('');
  const [existingResume, setExistingResume] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const getFileUrl = (path: string) =>
    path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  useEffect(() => {
    apiClient
      .get(detailUrl)
      .then(res => {
        const d = res.data as any;
        setData({
          username: d.username || '',
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          phone_number: d.phone_number || '',
          government_id: null,
          role_type: d.role_type || '',
          interests: d.interests || [],
          referee1_email: d.referee1_email || '',
          referee2_email: d.referee2_email || '',
          short_bio: d.short_bio || '',
          resume: null,
        });
        setExistingGovId(d.government_id || '');
        setExistingResume(d.resume || '');
        setProfileExists(true);
      })
      .catch(err => {
        if (err.response?.status !== 404) {
          setError(err.response?.data?.detail || err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [detailUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  const handleFile = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setData(prev => ({ ...prev, [field]: file }));
  };
  const handleInterest = (val: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setData(prev => ({
      ...prev,
      interests: e.target.checked
        ? [...prev.interests, val]
        : prev.interests.filter(x => x !== val),
    }));
  };
  const handleTabChange = (_: any, idx: number) => setTabIndex(idx);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); 
    setLoading(true);
    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v == null) return;
        if (v instanceof File) form.append(k, v);
        else form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      const res = await apiClient.request({
        method: profileExists ? 'patch' : 'post',
        url: profileExists ? detailUrl : createUrl,
        data: form,
      });
      const d = res.data as any;
      setExistingGovId(d.government_id || existingGovId);
      setExistingResume(d.resume || existingResume);
      setProfileExists(true);
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Loading…</Typography>;

  const panels: React.ReactNode[] = [
    // Basic Info
    <Box sx={{ p: 2 }} key="basic">
      <Typography variant="h6">Basic Info</Typography>
      <TextField fullWidth margin="normal" label="First Name" name="first_name" value={data.first_name} onChange={handleChange} required />
      <TextField fullWidth margin="normal" label="Last Name" name="last_name" value={data.last_name} onChange={handleChange} required />
      <TextField fullWidth margin="normal" label="Username" name="username" value={data.username} onChange={handleChange} required />
      <TextField fullWidth margin="normal" label="Phone Number" name="phone_number" value={data.phone_number} onChange={handleChange} required />

      <Typography sx={{ mt: 2 }}>Government ID</Typography>
      <Button variant="outlined" component="label">
        Upload ID
        <input
          hidden
          type="file"
          accept="image/*,.pdf"
          onChange={handleFile('government_id')}
        />
      </Button>
      {existingGovId && (
        <Link
          href={getFileUrl(existingGovId)}
          target="_blank"
          sx={{ ml: 2, fontSize: '0.875rem' }}
        >
          View
        </Link>
      )}

      <TextField
        select
        fullWidth
        margin="normal"
        label="Role"
        name="role_type"
        value={data.role_type}
        onChange={handleChange}
        required
      >
        {ROLE_CHOICES.map(o => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
    </Box>,

    // Interests
    <Box sx={{ p: 2 }} key="interests">
      <Typography variant="h6">Interests</Typography>
      <FormGroup>
        {INTERESTS.map(i => (
          <FormControlLabel
            key={i}
            control={
              <Checkbox
                checked={data.interests.includes(i)}
                onChange={handleInterest(i)}
              />
            }
            label={i}
          />
        ))}
      </FormGroup>
    </Box>,

    // References
    <Box sx={{ p: 2 }} key="refs">
      <Typography variant="h6">References</Typography>
      <TextField
        fullWidth
        margin="normal"
        label="Referee 1 Email"
        name="referee1_email"
        value={data.referee1_email}
        onChange={handleChange}
        required
      />
      <TextField
        fullWidth
        margin="normal"
        label="Referee 2 Email"
        name="referee2_email"
        value={data.referee2_email}
        onChange={handleChange}
        required
      />
    </Box>,

    // Profile
    <Box sx={{ p: 2 }} key="profile">
      <Typography variant="h6">Profile</Typography>
      <TextField
        fullWidth
        multiline
        rows={4}
        margin="normal"
        label="Short Bio"
        name="short_bio"
        value={data.short_bio}
        onChange={handleChange}
      />
      <Button variant="outlined" component="label">
        Upload Resume
        <input
          hidden
          accept="application/pdf"
          type="file"
          onChange={handleFile('resume')}
        />
      </Button>
      {existingResume && (
        <Link
          href={getFileUrl(existingResume)}
          target="_blank"
          sx={{ ml: 2, fontSize: '0.875rem' }}
        >
          View
        </Link>
      )}
    </Box>,
  ];

  // block Enter on non-final panels
  const preventFormSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tabIndex < panels.length - 1) {
      e.preventDefault();
    }
  };

  return (
    <Container maxWidth="lg">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => {
          setSnackbarOpen(false);
          navigate('/dashboard/explorer/overview');
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Profile saved successfully!
        </Alert>
      </Snackbar>

      <Paper sx={{ p: 3, mt: 4 }} elevation={3}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            borderBottom: 1,
            borderColor: 'divider',
            mb: 3,
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            textColor="secondary"
            indicatorColor="secondary"
          >
            {labels.map((l, i) => (
              <Tab key={i} label={l} />
            ))}
          </Tabs>
        </Box>

        {tabIndex === panels.length - 1 ? (
          // only final panel is a form
          <Box
            component="form"
            onSubmit={handleSubmit}
            onKeyDown={preventFormSubmit}
          >
            {panels[tabIndex]}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                type="button"
                disabled={tabIndex === 0}
                onClick={() => setTabIndex(i => i - 1)}
              >
                Back
              </Button>
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Saving…' : 'Submit'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box onKeyDown={preventFormSubmit}>
            {panels[tabIndex]}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                type="button"
                disabled={tabIndex === 0}
                onClick={() => setTabIndex(i => i - 1)}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setTabIndex(i => i + 1)}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
