
// src/pages/onboarding/PharmacistOnboardingForm.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  Typography,
  TextField,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  FormGroup,
  Button,
  Alert,
  Divider,
  Link,
} from '@mui/material';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../../constants/api';

interface RatePreference {
  weekdays: string;
  saturdays: string;
  sundays: string;
  public_holidays: string;
  early_morning: string;
  late_night: string;
}

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  government_id: File | null;
  ahpra_number: string;
  skills: string[];
  software_experience: string[];
  payment_preference: 'ABN' | 'TFN';
  abn: string;
  gst_registered: boolean;
  gst_file: File | null;
  tfn_declaration: File | null;
  super_fund_name: string;
  super_usi: string;
  super_member_number: string;
  rate_preference: RatePreference;
  referee1_email: string;
  referee2_email: string;
  short_bio: string;
  resume: File | null;
}

const SKILL_CHOICES = [
  { value: 'VACCINATION', label: 'Vaccination (w/ Anaphylaxis training)' },
  { value: 'CANNABIS', label: 'Cannabis handling (no cert)' },
  { value: 'COMPOUNDING', label: 'Compounding' },
  { value: 'CRED_PHARM', label: 'Credentialed Pharmacist' },
  { value: 'FIRST_AID', label: 'First Aid/CPR' },
  { value: 'PDL', label: 'PDL Insurance Certificate' },
];

const SOFTWARE_CHOICES = [
  { value: 'EXCEL', label: 'Excel' },
  { value: 'WORD', label: 'Word' },
];

const labels = [
  'Basic Info',
  'Skills',
  'Payment',
  'Rates',
  'Referees',
  'Profile',
];

export default function PharmacistOnboardingForm() {
  const detailUrl = API_ENDPOINTS.onboardingDetail('pharmacist');
  const createUrl = API_ENDPOINTS.onboardingCreate('pharmacist');

  const [data, setData] = useState<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    government_id: null,
    ahpra_number: '',
    skills: [],
    software_experience: [],
    payment_preference: 'TFN',
    abn: '',
    gst_registered: false,
    gst_file: null,
    tfn_declaration: null,
    super_fund_name: '',
    super_usi: '',
    super_member_number: '',
    rate_preference: {
      weekdays: '',
      saturdays: '',
      sundays: '',
      public_holidays: '',
      early_morning: '',
      late_night: '',
    },
    referee1_email: '',
    referee2_email: '',
    short_bio: '',
    resume: null,
  });
  const [existingGovernmentId, setExistingGovernmentId] = useState<string>('');
  const [existingGstFile, setExistingGstFile] = useState<string>('');
  const [existingTfnDeclaration, setExistingTfnDeclaration] = useState<string>('');
  const [existingResume, setExistingResume] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const getFilename = (url: string) => {
    // drop everything after the “?” (the SAS token)
    const clean = url.split('?')[0]
    // then take the last path segment
    return decodeURIComponent(clean.split('/').pop() || '')
  }

  const getFileUrl = (path: string) =>
    path.startsWith('http') ? path : `${API_BASE_URL}${path}`

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
          ahpra_number: d.ahpra_number || '',
          skills: d.skills || [],
          software_experience: d.software_experience || [],
          payment_preference: d.payment_preference || 'TFN',
          abn: d.abn || '',
          gst_registered: d.gst_registered || false,
          gst_file: null,
          tfn_declaration: null,
          super_fund_name: d.super_fund_name || '',
          super_usi: d.super_usi || '',
          super_member_number: d.super_member_number || '',
          rate_preference: d.rate_preference || data.rate_preference,
          referee1_email: d.referee1_email || '',
          referee2_email: d.referee2_email || '',
          short_bio: d.short_bio || '',
          resume: null,
        });
        setExistingGovernmentId(d.government_id || '');
        setExistingGstFile(d.gst_file || '');
        setExistingTfnDeclaration(d.tfn_declaration || '');
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

  const handleFileChange =
    (field: keyof Pick<FormData, 'government_id' | 'gst_file' | 'tfn_declaration' | 'resume'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setData(prev => ({
        ...prev,
        [field]: e.target.files?.[0] ?? null,
      }));
    };

  const handleMultiCheckbox =
    (field: 'skills' | 'software_experience', val: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setData(prev => {
        const arr = prev[field];
        return {
          ...prev,
          [field]: e.target.checked ? [...arr, val] : arr.filter(x => x !== val),
        };
      });
    };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      rate_preference: { ...prev.rate_preference, [name]: value },
    }));
  };

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    setTabIndex(newIndex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v == null) return;
        if (v instanceof File) form.append(k, v);
        else if (typeof v === 'object') form.append(k, JSON.stringify(v));
        else form.append(k, String(v));
      });

      const res = await apiClient.request({
        method: profileExists ? 'patch' : 'post',
        url: profileExists ? detailUrl : createUrl,
        data: form,
      });

      const d = res.data as any;
      setProfileExists(true);
      setExistingGovernmentId(d.government_id || existingGovernmentId);
      setExistingGstFile(d.gst_file || existingGstFile);
      setExistingTfnDeclaration(d.tfn_declaration || existingTfnDeclaration);
      setExistingResume(d.resume || existingResume);
      setSuccess(true);
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        setError(
          Object.entries(data)
            .map(([f, msgs]) => `${f}: ${(msgs as string[]).join(', ')}`)
            .join('\n')
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Loading…</Typography>;

  const panels: React.ReactNode[] = [
    <Box sx={{ p: 2 }} key="basic">
      <Typography variant="h6">Basic Information</Typography>
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

      <Typography sx={{ mt: 2 }}>Government ID</Typography>
      {existingGovernmentId && (
        <Typography variant="body2">
          Current:&nbsp;
          <Link
            href={getFileUrl(existingGovernmentId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {getFilename(existingGovernmentId)}
          </Link>
        </Typography>
      )}
      <Button variant="outlined" component="label" sx={{ mt: 1 }}>
        Upload Government ID
        <input
          hidden
          accept="image/*,.pdf"
          type="file"
          onChange={handleFileChange('government_id')}
        />
      </Button>

      <TextField
        fullWidth
        margin="normal"
        label="AHPRA Number"
        name="ahpra_number"
        value={data.ahpra_number}
        onChange={handleChange}
        required
      />
    </Box>,

    <Box sx={{ p: 2 }} key="skills">
      <Typography variant="h6">Skills</Typography>
      <FormGroup row>
        {SKILL_CHOICES.map(s => (
          <FormControlLabel
            key={s.value}
            control={
              <Checkbox
                checked={data.skills.includes(s.value)}
                onChange={handleMultiCheckbox('skills', s.value)}
              />
            }
            label={s.label}
          />
        ))}
      </FormGroup>
      <Typography variant="h6" sx={{ mt: 2 }}>
        Software Experience
      </Typography>
      <FormGroup row>
        {SOFTWARE_CHOICES.map(s => (
          <FormControlLabel
            key={s.value}
            control={
              <Checkbox
                checked={data.software_experience.includes(s.value)}
                onChange={handleMultiCheckbox('software_experience', s.value)}
              />
            }
            label={s.label}
          />
        ))}
      </FormGroup>
    </Box>,

    <Box sx={{ p: 2 }} key="payment">
      <Typography variant="h6">Payment Method</Typography>
      <FormControl component="fieldset">
        <RadioGroup
          row
          name="payment_preference"
          value={data.payment_preference}
          onChange={handleChange}
        >
          <FormControlLabel
            value="TFN"
            control={<Radio />}
            label="TFN (Payslip)"
          />
          <FormControlLabel
            value="ABN"
            control={<Radio />}
            label="ABN (Contractor)"
          />
        </RadioGroup>
      </FormControl>

      {data.payment_preference === 'ABN' && (
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            margin="normal"
            label="ABN"
            name="abn"
            value={data.abn}
            onChange={handleChange}
          />
          <FormControlLabel
            control={
              <Checkbox
                name="gst_registered"
                checked={data.gst_registered}
                onChange={handleChange}
              />
            }
            label="GST Registered"
          />
          {existingGstFile && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link
                href={getFileUrl(existingGstFile)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {getFilename(existingGstFile)}
              </Link>
            </Typography>
          )}
          {data.gst_registered && (
            <Button variant="outlined" component="label" sx={{ mt: 1 }}>
              Upload GST Certificate
              <input
                hidden
                type="file"
                onChange={handleFileChange('gst_file')}
              />
            </Button>
          )}
        </Box>
      )}

      {data.payment_preference === 'TFN' && (
        <Box sx={{ mt: 2 }}>
          {existingTfnDeclaration && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link
                href={getFileUrl(existingTfnDeclaration)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {getFilename(existingTfnDeclaration)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label">
            Upload TFN Declaration
            <input
              hidden
              type="file"
              onChange={handleFileChange('tfn_declaration')}
            />
          </Button>
          <TextField
            fullWidth
            margin="normal"
            label="Super Fund Name"
            name="super_fund_name"
            value={data.super_fund_name}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="USI"
            name="super_usi"
            value={data.super_usi}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Member Number"
            name="super_member_number"
            value={data.super_member_number}
            onChange={handleChange}
          />
        </Box>
      )}
    </Box>,

    <Box sx={{ p: 2 }} key="rate">
      <Typography variant="h6">Rate Preferences</Typography>
      {Object.entries(data.rate_preference).map(([k, v]) => (
        <TextField
          key={k}
          fullWidth
          margin="normal"
          type="number"
          label={
            k
              .replace('_', ' ')
              .replace(/\b\w/g, c => c.toUpperCase())
          }
          name={k}
          value={v}
          onChange={handleRateChange}
        />
      ))}
    </Box>,

    <Box sx={{ p: 2 }} key="refs">
      <Typography variant="h6">Referees</Typography>
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

    <Box sx={{ p: 2 }} key="profile">
      <Typography variant="h6">Profile & Resume</Typography>
      <TextField
        fullWidth
        margin="normal"
        label="Short Bio"
        name="short_bio"
        value={data.short_bio}
        onChange={handleChange}
        multiline
        rows={4}
      />
      <Divider sx={{ my: 2 }}>Resume (Required)</Divider>
      {existingResume && (
        <Typography variant="body2">
          Current:&nbsp;
          <Link
            href={getFileUrl(existingResume)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {getFilename(existingResume)}
          </Link>
        </Typography>
      )}
      <Button variant="outlined" component="label">
        Upload Resume/CV
        <input
          hidden
          accept="application/pdf"
          type="file"
          onChange={handleFileChange('resume')}
        />
      </Button>
    </Box>,
  ];

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, mt: 4 }} elevation={3}>
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Saved!</Alert>}
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
            sx={{ width: 'auto' }}
          >
            {labels.map((l, i) => (
              <Tab key={i} label={l} />
            ))}
          </Tabs>
        </Box>
        <Box component="form" onSubmit={handleSubmit}>
          {panels[tabIndex]}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mt: 2,
            }}
          >
            <Button disabled={tabIndex === 0} onClick={() => setTabIndex(i => i - 1)}>
              Back
            </Button>
            {tabIndex < panels.length - 1 ? (
              <Button onClick={() => setTabIndex(i => i + 1)}>Next</Button>
            ) : (
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Saving…' : 'Submit'}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
