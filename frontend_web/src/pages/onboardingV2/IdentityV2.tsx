// src/pages/onboardingV2/IdentityV2.tsx
import * as React from 'react';
import { Box, Button, Link, TextField, Typography, MenuItem, Chip, Alert, Snackbar } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import apiClient from '../../utils/apiClient';
import { API_BASE_URL, API_ENDPOINTS } from '../../constants/api';

type ApiData = {
  government_id?: string | null;
  government_id_type?: 'GOV_ID' | 'DRIVER_LICENSE' | 'VISA' | 'AUS_PASSPORT' | 'OTHER_PASSPORT' | string | null;
  gov_id_verified?: boolean | null;
  gov_id_verification_note?: string | null;
};

const DOC_TYPES: Array<{ value: NonNullable<ApiData['government_id_type']>, label: string }> = [
  { value: 'GOV_ID',        label: 'Government ID' },
  { value: 'DRIVER_LICENSE',label: 'Driving license' },
  { value: 'VISA',          label: 'Visa' },
  { value: 'AUS_PASSPORT',  label: 'Australian Passport' },
  { value: 'OTHER_PASSPORT',label: 'Other Passport' },
];

export default function IdentityV2() {
  const url = API_ENDPOINTS.onboardingV2Detail('pharmacist');
  const [data, setData] = React.useState<ApiData>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [snack, setSnack] = React.useState('');
  const [error, setError] = React.useState('');

  const getFileUrl = (path?: string | null) =>
    path ? (path.startsWith('http') ? path : `${API_BASE_URL}${path}`) : '';

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const res = await apiClient.get(url);
        if (!mounted) return;
        setData(res.data || {});
      } catch (e: any) {
        setError(e?.response?.data?.detail || e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [url]);

  const setField = (name: keyof ApiData, value: any) =>
    setData(prev => ({ ...prev, [name]: value }));

  const save = async (submitForVerification: boolean) => {
    setSaving(true); setSnack(''); setError('');
    try {
      const fd = new FormData();
      fd.append('tab', 'identity');
      if (submitForVerification) fd.append('submitted_for_verification', 'true');
      if (data.government_id_type != null) fd.append('government_id_type', String(data.government_id_type));
      if (file) fd.append('government_id', file);

      const res = await apiClient.patch(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setData(res.data || {});
      setFile(null);
      setSnack(submitForVerification ? 'Submitted for verification.' : 'Saved.');
    } catch (e: any) {
      const resp = e.response?.data;
      setError(
        resp && typeof resp === 'object'
          ? Object.entries(resp).map(([k, v]) => `${k}: ${(v as any[]).join(', ')}`).join('\n')
          : e.message
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Typography>Loading…</Typography>;

  const VerifiedChip = ({ ok, label }: { ok?: boolean | null; label: string }) => {
    if (ok === true)   return <Chip icon={<CheckCircleOutlineIcon />} color="success" label={label} variant="outlined" />;
    if (ok === false)  return <Chip icon={<ErrorOutlineIcon />}   color="error"   label={label} variant="outlined" />;
    return               <Chip icon={<HourglassBottomIcon />}      label={label}               variant="outlined" />;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Identity Document
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          select
          label="Document Type"
          value={data.government_id_type || ''}
          onChange={e => setField('government_id_type', e.target.value)}
          sx={{ minWidth: 260, maxWidth: 360 }}
        >
          {DOC_TYPES.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>

        <Button variant="outlined" component="label">
          {file ? 'Change file' : (data.government_id ? 'Replace file' : 'Upload file')}
          <input hidden type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
        </Button>

        {data.government_id ? (
          <Link href={getFileUrl(data.government_id)} target="_blank" rel="noopener noreferrer">View current</Link>
        ) : (
          <Typography variant="body2" color="text.secondary">No file uploaded</Typography>
        )}

        <VerifiedChip ok={data.gov_id_verified} label="Identity" />
      </Box>

      {typeof data.gov_id_verified === 'boolean' && (
        <Typography
          variant="body2"
          title={data.gov_id_verification_note || (data.gov_id_verified ? 'Verified' : 'Pending/Not verified')}
          sx={{
            color: data.gov_id_verified
              ? 'success.main'
              : (data.gov_id_verification_note ? 'error.main' : 'text.secondary'),
            mb: 2,
          }}
        >
          {data.gov_id_verification_note || (data.gov_id_verified ? 'Document verified.' : 'Pending/Not verified')}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button variant="outlined" disabled={saving} onClick={() => save(false)}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="contained"
          disabled={saving || (!file && !data.government_id)}
          onClick={() => save(true)}
        >
          {saving ? 'Submitting…' : 'Submit & Verify'}
        </Button>
      </Box>

      <Snackbar open={!!snack} autoHideDuration={2400} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
