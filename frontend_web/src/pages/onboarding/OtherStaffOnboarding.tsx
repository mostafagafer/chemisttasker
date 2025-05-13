// src/pages/onboarding/OtherStaffOnboarding.tsx
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
  MenuItem,
  Button,
  Alert,
  Divider,
  Link,
} from '@mui/material';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../../constants/api';

interface FormData {
  username: string;
  phone_number: string;
  government_id: File | null;
  role_type: string;
  skills: string[];
  years_experience: string;
  ahpra_proof: File | null;
  hours_proof: File | null;
  certificate: File | null;
  university_id: File | null;
  cpr_certificate: File | null;
  s8_certificate: File | null;
  payment_preference: 'ABN' | 'TFN';
  abn: string;
  gst_registered: boolean;
  gst_file: File | null;
  tfn_declaration: File | null;
  super_fund_name: string;
  super_usi: string;
  super_member_number: string;
  referee1_email: string;
  referee2_email: string;
  short_bio: string;
  resume: File | null;
}

const ROLE_CHOICES = [
  { value: 'INTERN', label: 'Intern Pharmacist' },
  { value: 'TECHNICIAN', label: 'Dispensary Technician' },
  { value: 'ASSISTANT', label: 'Assistant' },
  { value: 'STUDENT', label: 'Pharmacy Student' },
];
const YEARS = ['<1 year', '1–3 years', '3-5 years', '5-10 years', '+10 years'];
const SKILL_CHOICES = [
  { value: 'FIRST_AID', label: 'First Aid' },
  { value: 'COMPOUNDING', label: 'Compounding' },
  { value: 'S8', label: 'S8 handling' },
];
const labels = ['Basic Info', 'Reg Docs', 'Skills', 'Payment', 'Refs', 'Profile'];

export default function OtherStaffOnboarding() {
  const detailUrl = API_ENDPOINTS.onboardingDetail('otherstaff');
  const createUrl = API_ENDPOINTS.onboardingCreate('otherstaff');

  const [data, setData] = useState<FormData>({
    username: '',
    phone_number: '',
    government_id: null,
    role_type: '',
    skills: [],
    years_experience: '',
    ahpra_proof: null,
    hours_proof: null,
    certificate: null,
    university_id: null,
    cpr_certificate: null,
    s8_certificate: null,
    payment_preference: 'TFN',
    abn: '',
    gst_registered: false,
    gst_file: null,
    tfn_declaration: null,
    super_fund_name: '',
    super_usi: '',
    super_member_number: '',
    referee1_email: '',
    referee2_email: '',
    short_bio: '',
    resume: null,
  });
  const [existingGovernmentId, setExistingGovernmentId] = useState<string>('');
  const [existingAhpraProof, setExistingAhpraProof] = useState<string>('');
  const [existingHoursProof, setExistingHoursProof] = useState<string>('');
  const [existingCertificate, setExistingCertificate] = useState<string>('');
  const [existingUniversityId, setExistingUniversityId] = useState<string>('');
  const [existingCprCertificate, setExistingCprCertificate] = useState<string>('');
  const [existingS8Certificate, setExistingS8Certificate] = useState<string>('');
  const [existingGstFile, setExistingGstFile] = useState<string>('');
  const [existingTfnDeclaration, setExistingTfnDeclaration] = useState<string>('');
  const [existingResume, setExistingResume] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const getFilename = (url: string) => url.split('/').pop() || url;
  const getFileUrl = (path: string) =>
    path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  useEffect(() => {
    apiClient
      .get(detailUrl)
      .then(res => {
        const d = res.data as any;
        setData({
          username: d.username || '',
          phone_number: d.phone_number || '',
          government_id: null,
          role_type: d.role_type || '',
          skills: d.skills || [],
          years_experience: d.years_experience || '',
          ahpra_proof: null,
          hours_proof: null,
          certificate: null,
          university_id: null,
          cpr_certificate: null,
          s8_certificate: null,
          payment_preference: d.payment_preference || 'TFN',
          abn: d.abn || '',
          gst_registered: d.gst_registered || false,
          gst_file: null,
          tfn_declaration: null,
          super_fund_name: d.super_fund_name || '',
          super_usi: d.super_usi || '',
          super_member_number: d.super_member_number || '',
          referee1_email: d.referee1_email || '',
          referee2_email: d.referee2_email || '',
          short_bio: d.short_bio || '',
          resume: null,
        });
        setExistingGovernmentId(d.government_id || '');
        setExistingAhpraProof(d.ahpra_proof || '');
        setExistingHoursProof(d.hours_proof || '');
        setExistingCertificate(d.certificate || '');
        setExistingUniversityId(d.university_id || '');
        setExistingCprCertificate(d.cpr_certificate || '');
        setExistingS8Certificate(d.s8_certificate || '');
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
    (field: keyof Pick<FormData,
      | 'government_id'
      | 'ahpra_proof'
      | 'hours_proof'
      | 'certificate'
      | 'university_id'
      | 'cpr_certificate'
      | 's8_certificate'
      | 'gst_file'
      | 'tfn_declaration'
      | 'resume'>
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setData(prev => ({
        ...prev,
        [field]: e.target.files?.[0] ?? null,
      }));
    };

  const handleMultiCheckbox =
    (field: 'skills', val: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setData(prev => {
        const arr = prev[field];
        return {
          ...prev,
          [field]: e.target.checked ? [...arr, val] : arr.filter(x => x !== val),
        };
      });
    };

  const handleTabChange = (_: any, newIndex: number) => {
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
      setExistingAhpraProof(d.ahpra_proof || existingAhpraProof);
      setExistingHoursProof(d.hours_proof || existingHoursProof);
      setExistingCertificate(d.certificate || existingCertificate);
      setExistingUniversityId(d.university_id || existingUniversityId);
      setExistingCprCertificate(d.cpr_certificate || existingCprCertificate);
      setExistingS8Certificate(d.s8_certificate || existingS8Certificate);
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
      <Typography variant="h6">Basic Info</Typography>
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
          <Link href={getFileUrl(existingGovernmentId)} target="_blank">
            {getFilename(existingGovernmentId)}
          </Link>
        </Typography>
      )}
      <Button variant="outlined" component="label" sx={{ mt: 1 }}>
        Upload ID
        <input hidden type="file" onChange={handleFileChange('government_id')} />
      </Button>

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
        {ROLE_CHOICES.map(c => (
          <MenuItem key={c.value} value={c.value}>
            {c.label}
          </MenuItem>
        ))}
      </TextField>
    </Box>,

    <Box sx={{ p: 2 }} key="reg">
      <Typography variant="h6">Regulatory Docs</Typography>
      {data.role_type === 'INTERN' && (
        <>
          <Typography>AHPRA Proof</Typography>
          {existingAhpraProof && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingAhpraProof)} target="_blank">
                {getFilename(existingAhpraProof)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label" sx={{ mr: 1 }}>
            Upload AHPRA
            <input hidden type="file" onChange={handleFileChange('ahpra_proof')} />
          </Button>

          <Typography sx={{ mt: 2 }}>Hours Proof</Typography>
          {existingHoursProof && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingHoursProof)} target="_blank">
                {getFilename(existingHoursProof)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label">
            Upload Hours
            <input hidden type="file" onChange={handleFileChange('hours_proof')} />
          </Button>
        </>
      )}
      {['TECHNICIAN', 'ASSISTANT'].includes(data.role_type) && (
        <>
          <Typography sx={{ mt: 2 }}>Certificate</Typography>
          {existingCertificate && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingCertificate)} target="_blank">
                {getFilename(existingCertificate)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label">
            Upload Certificate
            <input hidden type="file" onChange={handleFileChange('certificate')} />
          </Button>
        </>
      )}
      {data.role_type === 'STUDENT' && (
        <>
          <Typography sx={{ mt: 2 }}>University ID</Typography>
          {existingUniversityId && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingUniversityId)} target="_blank">
                {getFilename(existingUniversityId)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label">
            Upload University ID
            <input hidden type="file" onChange={handleFileChange('university_id')} />
          </Button>
        </>
      )}
      {data.role_type === 'OTHER' && (
        <>
          <Typography sx={{ mt: 2 }}>CPR Certificate</Typography>
          {existingCprCertificate && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingCprCertificate)} target="_blank">
                {getFilename(existingCprCertificate)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label" sx={{ mr: 1 }}>
            Upload CPR
            <input hidden type="file" onChange={handleFileChange('cpr_certificate')} />
          </Button>

          <Typography sx={{ mt: 2 }}>S8 Certificate</Typography>
          {existingS8Certificate && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingS8Certificate)} target="_blank">
                {getFilename(existingS8Certificate)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label">
            Upload S8
            <input hidden type="file" onChange={handleFileChange('s8_certificate')} />
          </Button>
        </>
      )}
    </Box>,

    <Box sx={{ p: 2 }} key="skills">
      <Typography variant="h6">Skills & Experience</Typography>
      <FormGroup row>
        {SKILL_CHOICES.map(s => (
          <FormControlLabel
            key={s.value}
            control={(
              <Checkbox
                checked={data.skills.includes(s.value)}
                onChange={handleMultiCheckbox('skills', s.value)}
              />
            )}
            label={s.label}
          />
        ))}
      </FormGroup>
      <TextField
        select
        fullWidth
        margin="normal"
        label="Years Experience"
        name="years_experience"
        value={data.years_experience}
        onChange={handleChange}
        required
      >
        {YEARS.map(y => (
          <MenuItem key={y} value={y}>{y}</MenuItem>
        ))}
      </TextField>
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
          <FormControlLabel value="TFN" control={<Radio />} label="TFN" />
          <FormControlLabel value="ABN" control={<Radio />} label="ABN" />
        </RadioGroup>
      </FormControl>

      {data.payment_preference === 'ABN' ? (
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
            control={(
              <Checkbox
                name="gst_registered"
                checked={data.gst_registered}
                onChange={handleChange}
              />
            )}
            label="GST Registered"
          />
          {existingGstFile && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingGstFile)} target="_blank">
                {getFilename(existingGstFile)}
              </Link>
            </Typography>
          )}
          {data.gst_registered && (
            <Button variant="outlined" component="label" sx={{ mt: 1 }}>
              Upload GST
              <input hidden type="file" onChange={handleFileChange('gst_file')} />
            </Button>
          )}
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          {existingTfnDeclaration && (
            <Typography variant="body2">
              Current:&nbsp;
              <Link href={getFileUrl(existingTfnDeclaration)} target="_blank">
                {getFilename(existingTfnDeclaration)}
              </Link>
            </Typography>
          )}
          <Button variant="outlined" component="label" sx={{ mb: 2 }}>
            Upload TFN
            <input hidden type="file" onChange={handleFileChange('tfn_declaration')} />
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
          <Link href={getFileUrl(existingResume)} target="_blank">
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
            {tabIndex < labels.length - 1 ? (
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
