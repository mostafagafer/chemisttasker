import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Link,
  Typography,
  MenuItem,
  Divider,
} from '@mui/material';
import AuthLayout from '../layouts/AuthLayout';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';

// ---- Types ----
interface MagicInfo {
  pharmacy: number;
  pharmacy_name: string;
  category: 'FULL_PART_TIME' | 'LOCUM_CASUAL';
  expires_at: string; // ISO string
}

// ---- Helpers ----
const prettyCategory = (c?: MagicInfo['category']) =>
  c === 'FULL_PART_TIME' ? 'Full/Part-time' : c === 'LOCUM_CASUAL' ? 'Locum/Casual' : '—';

const ROLE_OPTIONS = [
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'OTHER_STAFF', label: 'Other Staff' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'STUDENT', label: 'Student' },
];


// Match backend choices exactly
const PHARMACIST_AWARD_LEVEL_OPTIONS = [
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'EXPERIENCED_PHARMACIST', label: 'Experienced Pharmacist' },
  { value: 'PHARMACIST_IN_CHARGE', label: 'Pharmacist In Charge' },
  { value: 'PHARMACIST_MANAGER', label: 'Pharmacist Manager' },
];

const OTHERSTAFF_CLASSIFICATION_OPTIONS = [
  { value: 'LEVEL_1', label: 'Level 1' },
  { value: 'LEVEL_2', label: 'Level 2' },
  { value: 'LEVEL_3', label: 'Level 3' },
  { value: 'LEVEL_4', label: 'Level 4' },
];

const INTERN_HALF_OPTIONS = [
  { value: 'FIRST_HALF', label: 'First Half' },
  { value: 'SECOND_HALF', label: 'Second Half' },
];

const STUDENT_YEAR_OPTIONS = [
  { value: 'YEAR_1', label: 'Year 1' },
  { value: 'YEAR_2', label: 'Year 2' },
  { value: 'YEAR_3', label: 'Year 3' },
  { value: 'YEAR_4', label: 'Year 4' },
];

export default function MembershipApplyPage() {
  const { token } = useParams<{ token: string }>();

  // Link info
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [info, setInfo] = useState<MagicInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [role, setRole] = useState<string>('PHARMACIST');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState(''); // optional
  const [jobTitle, setJobTitle] = useState('');

  // Role-specific fields
  const [pharmacistLevel, setPharmacistLevel] = useState('');
  const [otherStaffLevel, setOtherStaffLevel] = useState('');
  const [internHalf, setInternHalf] = useState('');
  const [studentYear, setStudentYear] = useState('');

  // Which extra field to show
// Which extra field to show
const activeLevelField = useMemo(() => {
  switch (role) {
    case 'PHARMACIST':
      return {
        key: 'pharmacist_award_level',
        label: 'Pharmacist Award Level',
        value: pharmacistLevel,
        set: setPharmacistLevel,
        options: PHARMACIST_AWARD_LEVEL_OPTIONS,
      } as const;
    case 'OTHER_STAFF':
      return {
        key: 'otherstaff_classification_level',
        label: 'Other Staff Classification Level',
        value: otherStaffLevel,
        set: setOtherStaffLevel,
        options: OTHERSTAFF_CLASSIFICATION_OPTIONS,
      } as const;
    case 'INTERN':
      return {
        key: 'intern_half',
        label: 'Intern (First or Second Half)',
        value: internHalf,
        set: setInternHalf,
        options: INTERN_HALF_OPTIONS,
      } as const;
    case 'STUDENT':
      return {
        key: 'student_year',
        label: 'Student Year',
        value: studentYear,
        set: setStudentYear,
        options: STUDENT_YEAR_OPTIONS,
      } as const;
    default:
      return null;
  }
}, [role, pharmacistLevel, otherStaffLevel, internHalf, studentYear]);

  // Load link info on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token) throw new Error('Missing token');
        setLoadingInfo(true);
        setInfoError(null);
        const { data } = await axios.get<MagicInfo>(`${API_BASE_URL}${API_ENDPOINTS.magicMembershipInfo(token)}`);
        if (mounted) setInfo(data);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 410) setInfoError('This link has expired. Please contact the pharmacy to request a new link.');
        else if (status === 404) setInfoError('This link is invalid.');
        else setInfoError('Unable to load link information. Please try again later.');
      } finally {
        if (mounted) setLoadingInfo(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const requiresJobTitle = info?.category === 'FULL_PART_TIME';
      const trimmedJobTitle = jobTitle.trim();
      if (requiresJobTitle && !trimmedJobTitle) {
        setSubmitError('Please enter your job title.');
        setSubmitting(false);
        return;
      }
      const payload: any = {
        role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile_number: mobile.trim(),
        email: email.trim().toLowerCase(), // always present

      };
      if (email) payload.email = email.trim().toLowerCase();

      if (!email.trim()) {
      setSubmitError('Please enter your email address.');
      setSubmitting(false);
      return;
    }

      if (requiresJobTitle) {
        payload.job_title = trimmedJobTitle;
      }

      // include all role fields (backend allows blanks)
      payload.pharmacist_award_level = pharmacistLevel || null;
      payload.otherstaff_classification_level = otherStaffLevel || null;
      payload.intern_half = internHalf || null;
      payload.student_year = studentYear || null;

      await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.magicMembershipApply(token)}`,
        payload
      );
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Could not submit your application.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Render ---
  if (loadingInfo) {
    return (
      <AuthLayout title="Join This Pharmacy">
        <Box textAlign="center" mt={4}><CircularProgress /></Box>
      </AuthLayout>
    );
  }

  if (infoError) {
    return (
      <AuthLayout title="Join This Pharmacy">
        <Alert severity="error" sx={{ mb: 2 }}>{infoError}</Alert>
        <Typography variant="body2">Back to{' '}
          <Link component={RouterLink} to="/login" fontWeight="bold" color="#00a99d">Login</Link>
        </Typography>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Join This Pharmacy">
      {submitted ? (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Application submitted! The pharmacy will review your details and contact you.
          </Alert>
          <Typography variant="body2" sx={{ mt: 1 }}>
            You can now close this page. Back to{' '}
            <Link component={RouterLink} to="/login" fontWeight="bold" color="#00a99d">Login</Link>
          </Typography>
        </>
      ) : (
        <>
          {/* Header info */}
          <Box mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>{info?.pharmacy_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Application Type: {prettyCategory(info?.category)}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              select
              fullWidth
              margin="normal"
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              {ROLE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              margin="normal"
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />

            <TextField
              fullWidth
              margin="normal"
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />

            <TextField
              fullWidth
              margin="normal"
              label="Mobile Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="e.g., 0412 345 678 or 61412345678"
              required
            />

            {/* Optional: email helps the pharmacy match your account */}
            <TextField
              fullWidth
              margin="normal"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {info?.category === 'FULL_PART_TIME' && (
              <TextField
                fullWidth
                margin="normal"
                label="Job Title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            )}

            {/* Role-specific field */}
            {activeLevelField && (
              <TextField
                select
                fullWidth
                margin="normal"
                label={activeLevelField.label}
                value={activeLevelField.value}
                onChange={(e) => activeLevelField.set(e.target.value)}
                // make it required only if you want to force selection:
                // required
              >
                <MenuItem value="">{/* empty option */}—</MenuItem>
                {activeLevelField.options.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Box mt={3}>
              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{ py: 1.5, backgroundColor: '#00a99d', '&:hover': { backgroundColor: '#00877d' } }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Application'}
              </Button>
            </Box>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
