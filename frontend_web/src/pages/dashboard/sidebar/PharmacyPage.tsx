// src/pages/dashboard/sidebar/PharmacyPage.tsx
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Card,
  CardContent,
  IconButton,
  Snackbar,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Link,
  Checkbox,
  FormGroup,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { AxiosError, AxiosResponse } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import apiClient from '../../../utils/apiClient';
import { API_BASE_URL, API_ENDPOINTS } from '../../../constants/api';

interface Pharmacy {
  id: string;
  owner: number;
  name: string;
  address: string;
  chain: number | null;
  abn: string;
  asic_number: string;
  methadone_s8_protocols?: string;
  qld_sump_docs?: string;
  sops?: string;
  induction_guides?: string;
  employment_types?: string[];
  roles_needed?: string[];
  weekdays_start: string | null;
  weekdays_end: string | null;
  saturdays_start: string | null;
  saturdays_end: string | null;
  sundays_start: string | null;
  sundays_end: string | null;
  public_holidays_start: string | null;
  public_holidays_end: string | null;
  default_rate_type: 'FIXED' | 'FLEXIBLE' | 'PHARMACIST_PROVIDED' | null;
  default_fixed_rate: string | null;
  about: string;
}

export default function PharmacyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // helper to extract filename from a URL or path
  const getFilename = (url: string) => url.split('/').pop() || url;

  // ─── State ────────────────────────────────────────────────────────────────
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  // dialog & editing
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);

  // tabs
  const tabLabels = ['Basic','Regulatory','Docs','Employment','Hours','Rate','About'];
  const [tabIndex, setTabIndex] = useState(0);

  // Basic fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  // Regulatory
  const [asicNumber, setAsicNumber] = useState('');
  const [abn, setAbn] = useState('');
  const [approvalCertFile, setApprovalCertFile] = useState<File | null>(null);
  const [existingApprovalCert, setExistingApprovalCert] = useState<string | null>(null);

  // Docs
  const [sopsFile, setSopsFile] = useState<File | null>(null);
  const [existingSops, setExistingSops] = useState<string | null>(null);
  const [inductionGuidesFile, setInductionGuidesFile] = useState<File | null>(null);
  const [existingInductionGuides, setExistingInductionGuides] = useState<string | null>(null);
  const [sumpDocsFile, setSumpDocsFile] = useState<File | null>(null);
  const [existingSumpDocs, setExistingSumpDocs] = useState<string | null>(null);

  // Employment & Roles
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);

  // Hours
  const [weekdaysStart, setWeekdaysStart] = useState('');
  const [weekdaysEnd, setWeekdaysEnd] = useState('');
  const [saturdaysStart, setSaturdaysStart] = useState('');
  const [saturdaysEnd, setSaturdaysEnd] = useState('');
  const [sundaysStart, setSundaysStart] = useState('');
  const [sundaysEnd, setSundaysEnd] = useState('');
  const [publicHolidaysStart, setPublicHolidaysStart] = useState('');
  const [publicHolidaysEnd, setPublicHolidaysEnd] = useState('');

  // Rate
  const RATE_TYPES = [
    { value: 'FIXED', label: 'Fixed' },
    { value: 'FLEXIBLE', label: 'Flexible' },
    { value: 'PHARMACIST_PROVIDED', label: 'Pharmacist Provided' },
  ] as const;
  const [defaultRateType, setDefaultRateType] = useState<string>('');
  const [defaultFixedRate, setDefaultFixedRate] = useState<string>('');

  // About
  const [about, setAbout] = useState('');

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [error, setError] = useState('');

  // hoursFields helper
  const hoursFields = [
    { label: 'Weekdays', start: weekdaysStart, setStart: setWeekdaysStart, end: weekdaysEnd, setEnd: setWeekdaysEnd },
    { label: 'Saturdays', start: saturdaysStart, setStart: setSaturdaysStart, end: saturdaysEnd, setEnd: setSaturdaysEnd },
    { label: 'Sundays', start: sundaysStart, setStart: setSundaysStart, end: sundaysEnd, setEnd: setSundaysEnd },
    { label: 'Public Holidays', start: publicHolidaysStart, setStart: setPublicHolidaysStart, end: publicHolidaysEnd, setEnd: setPublicHolidaysEnd },
  ];

  // Function to get the proper URL for files
  const getFileUrl = (path: string | null) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  };

  // ─── Fetch & Onboarding Check ───────────────────────────────────────────────
  useEffect(() => {
    // const isOrgAdmin = user?.memberships?.some(m => m.role === 'ORG_ADMIN');
    const isOrgAdmin = (user?.memberships || []).some(m => m.role === 'ORG_ADMIN');
    const load = () => {
      apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`)
        .then((res: AxiosResponse<Pharmacy[]>) => setPharmacies(res.data))
        .catch((err: AxiosError) => console.error(err))
        .finally(() => setLoading(false));
    };
    if (isOrgAdmin) {
      load();
    } else {
      apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.onboardingDetail('owner')}`)
        .then(load)
        .catch((err: AxiosError) => {
          if (err.response?.status === 404) setNeedsOnboarding(true);
          else console.error(err);
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  // ─── Open/Edit Dialog ───────────────────────────────────────────────────────
  const openDialog = (p?: Pharmacy) => {
    // clear new-file picks
    setApprovalCertFile(null);
    setSopsFile(null);
    setInductionGuidesFile(null);
    setSumpDocsFile(null);

    if (p) {
      setEditing(p);
      // populate all fields from p
      setName(p.name || '');
      setAddress(p.address || '');
      setAsicNumber(p.asic_number || '');
      setAbn(p.abn || '');
      setExistingApprovalCert(p.methadone_s8_protocols || null);
      setExistingSops(p.sops || null);
      setExistingInductionGuides(p.induction_guides || null);
      setExistingSumpDocs(p.qld_sump_docs || null);
      setEmploymentTypes(p.employment_types || []);
      setRolesNeeded(p.roles_needed || []);
      setWeekdaysStart(p.weekdays_start || '');
      setWeekdaysEnd(p.weekdays_end || '');
      setSaturdaysStart(p.saturdays_start || '');
      setSaturdaysEnd(p.saturdays_end || '');
      setSundaysStart(p.sundays_start || '');
      setSundaysEnd(p.sundays_end || '');
      setPublicHolidaysStart(p.public_holidays_start || '');
      setPublicHolidaysEnd(p.public_holidays_end || '');
      setDefaultRateType(p.default_rate_type || '');
      setDefaultFixedRate(p.default_fixed_rate || '');
      setAbout(p.about || '');
    } else {
      setEditing(null);
      setName(''); setAddress('');
      setAsicNumber(''); setAbn('');
      setExistingApprovalCert(null);
      setExistingSops(null);
      setExistingInductionGuides(null);
      setExistingSumpDocs(null);
      setEmploymentTypes([]); setRolesNeeded([]);
      setWeekdaysStart(''); setWeekdaysEnd('');
      setSaturdaysStart(''); setSaturdaysEnd('');
      setSundaysStart(''); setSundaysEnd('');
      setPublicHolidaysStart(''); setPublicHolidaysEnd('');
      setDefaultRateType(''); setDefaultFixedRate('');
      setAbout('');
    }

    setTabIndex(0);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  // ─── Save Handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');
    if (!asicNumber) {
      setError('ASIC Number is required.');
      return;
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('address', address);
    fd.append('asic_number', asicNumber);
    fd.append('abn', abn);
    if (approvalCertFile)    fd.append('methadone_s8_protocols', approvalCertFile);
    if (sopsFile)            fd.append('sops', sopsFile);
    if (inductionGuidesFile) fd.append('induction_guides', inductionGuidesFile);
    if (sumpDocsFile)        fd.append('qld_sump_docs', sumpDocsFile);
    fd.append('employment_types', JSON.stringify(employmentTypes));
    fd.append('roles_needed', JSON.stringify(rolesNeeded));
    fd.append('weekdays_start', weekdaysStart);
    fd.append('weekdays_end', weekdaysEnd);
    fd.append('saturdays_start', saturdaysStart);
    fd.append('saturdays_end', saturdaysEnd);
    fd.append('sundays_start', sundaysStart);
    fd.append('sundays_end', sundaysEnd);
    fd.append('public_holidays_start', publicHolidaysStart);
    fd.append('public_holidays_end', publicHolidaysEnd);
    fd.append('default_rate_type', defaultRateType);
    if (defaultRateType === 'FIXED') {
      fd.append('default_fixed_rate', defaultFixedRate);
    }
    fd.append('about', about);

    // const orgMem = user?.memberships?.find(m => m.role === 'ORG_ADMIN');
    // if (orgMem) {
    //   fd.append('organization', orgMem.organization_id.toString());
    // }
    const orgMem = (user?.memberships || []).find(m => m && m.role === 'ORG_ADMIN');
      if (orgMem) {
        fd.append('organization', orgMem.organization_id.toString());
      }


    try {
      let res: AxiosResponse<Pharmacy>;
      const urlBase = `${API_BASE_URL}${API_ENDPOINTS.pharmacies}`;
      if (editing) {
        res = await apiClient.put(`${urlBase}${editing.id}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPharmacies(prev =>
          prev.map(x => (x.id === editing.id ? res.data : x))
        );
        setSnackMsg('Pharmacy updated!');
      } else {
        res = await apiClient.post(urlBase, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPharmacies(prev => [...prev, res.data]);
        setSnackMsg('Pharmacy added!');
      }
      setSnackbarOpen(true);
      closeDialog();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}${id}/`);
      setPharmacies(prev => prev.filter(p => p.id !== id));
      setSnackMsg('Deleted successfully!');
      setSnackbarOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Early Returns ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box p={4} textAlign="center">
        <CircularProgress />
      </Box>
    );
  }
  if (needsOnboarding) {
    return (
      <Box p={4} textAlign="center">
        <Alert severity="warning">
          Please complete <strong>Owner Onboarding</strong> first.
        </Alert>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate('/onboarding/owner')}
        >
          Go to Onboarding
        </Button>
      </Box>
    );
  }

  const paginated = pharmacies.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <Box p={2}>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => openDialog()}
      >
        Add Pharmacy
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editing ? 'Edit Pharmacy' : 'Add Pharmacy'}
        </DialogTitle>
        <DialogContent sx={{ minHeight: 450 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Tabs
            value={tabIndex}
            onChange={(_, i) => setTabIndex(i)}
            centered
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            {tabLabels.map(label => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>

          {/* Basic */}
          {tabIndex === 0 && (
            <Box sx={{ p: 2 }}>
              <TextField
                label="Pharmacy Name"
                fullWidth
                margin="normal"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <TextField
                label="Address"
                fullWidth
                margin="normal"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </Box>
          )}

          {/* Regulatory */}
          {tabIndex === 1 && (
            <Box sx={{ p: 2 }}>
              <Typography>
                Approval Certificate{' '}
                <Typography component="span" color="error">*</Typography>
              </Typography>
              {existingApprovalCert && (
                <Typography variant="body2">
                  Current:&nbsp;
                  <Link
                    href={getFileUrl(existingApprovalCert)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {getFilename(existingApprovalCert)}
                  </Link>
                </Typography>
              )}
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ my: 2 }}
              >
                Upload Certificate
                <input
                  hidden
                  type="file"
                  onChange={e =>
                    setApprovalCertFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
              {approvalCertFile && (
                <Typography variant="body2">
                  Selected: {approvalCertFile.name}
                </Typography>
              )}

              <TextField
                label="ASIC Number"
                required
                fullWidth
                margin="normal"
                value={asicNumber}
                onChange={e => setAsicNumber(e.target.value)}
              />
              <TextField
                label="ABN (optional)"
                fullWidth
                margin="normal"
                value={abn}
                onChange={e => setAbn(e.target.value)}
              />
            </Box>
          )}

          {/* Docs */}
          {tabIndex === 2 && (
            <Box sx={{ p: 2 }}>
              <Typography>SOPs (optional)</Typography>
              {existingSops && (
                <Typography variant="body2">
                  Current:&nbsp;
                  <Link
                    href={getFileUrl(existingSops)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {getFilename(existingSops)}
                  </Link>
                </Typography>
              )}
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ mb: 2 }}
              >
                Upload SOPs
                <input
                  hidden
                  type="file"
                  onChange={e =>
                    setSopsFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
              {sopsFile && (
                <Typography variant="body2">
                  Selected: {sopsFile.name}
                </Typography>
              )}

              <Typography>Induction Guides (optional)</Typography>
              {existingInductionGuides && (
                <Typography variant="body2">
                  Current:&nbsp;
                  <Link
                    href={getFileUrl(existingInductionGuides)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {getFilename(existingInductionGuides)}
                  </Link>
                </Typography>
              )}
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ mb: 2 }}
              >
                Upload Induction Guides
                <input
                  hidden
                  type="file"
                  onChange={e =>
                    setInductionGuidesFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
              {inductionGuidesFile && (
                <Typography variant="body2">
                  Selected: {inductionGuidesFile.name}
                </Typography>
              )}

              <Typography>S8/SUMP Docs (optional)</Typography>
              {existingSumpDocs && (
                <Typography variant="body2">
                  Current:&nbsp;
                  <Link
                    href={getFileUrl(existingSumpDocs)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {getFilename(existingSumpDocs)}
                  </Link>
                </Typography>
              )}
              <Button variant="outlined" component="label" fullWidth>
                Upload S8/SUMP
                <input
                  hidden
                  type="file"
                  onChange={e =>
                    setSumpDocsFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
              {sumpDocsFile && (
                <Typography variant="body2">
                  Selected: {sumpDocsFile.name}
                </Typography>
              )}
            </Box>
          )}

          {/* Employment & Roles */}
          {tabIndex === 3 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="h6">Employment Types</Typography>
              <FormGroup
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  mb: 2,
                }}
              >
                {['PART_TIME', 'FULL_TIME', 'LOCUMS'].map(v => (
                  <FormControlLabel
                    key={v}
                    control={
                      <Checkbox
                        checked={employmentTypes.includes(v)}
                        onChange={() =>
                          setEmploymentTypes(prev =>
                            prev.includes(v)
                              ? prev.filter(x => x !== v)
                              : [...prev, v]
                          )
                        }
                      />
                    }
                    label={v.replace('_', ' ')}
                  />
                ))}
              </FormGroup>
              <Typography variant="h6">Roles Needed</Typography>
              <FormGroup
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                }}
              >
                {[
                  'PHARMACIST','INTERN','ASSISTANT',
                  'TECHNICIAN','STUDENT','ADMIN','DRIVER',
                ].map(v => (
                  <FormControlLabel
                    key={v}
                    control={
                      <Checkbox
                        checked={rolesNeeded.includes(v)}
                        onChange={() =>
                          setRolesNeeded(prev =>
                            prev.includes(v)
                              ? prev.filter(x => x !== v)
                              : [...prev, v]
                          )
                        }
                      />
                    }
                    label={v.charAt(0) + v.slice(1).toLowerCase()}
                  />
                ))}
              </FormGroup>
            </Box>
          )}

          {/* Hours */}
          {tabIndex === 4 && (
            <Box sx={{ p: 2 }}>
              {hoursFields.map(({ label, start, setStart, end, setEnd }) => (
                <Box
                  key={label}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '150px 1fr 1fr',
                    gap: 2,
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography>{label}</Typography>
                  <TextField
                    label="Start"
                    type="time"
                    fullWidth
                    value={start}
                    onChange={e => setStart(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End"
                    type="time"
                    fullWidth
                    value={end}
                    onChange={e => setEnd(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              ))}
            </Box>
          )}

          {/* Rate */}
          {tabIndex === 5 && (
            <Box sx={{ p: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Rate Type</InputLabel>
                <Select
                  value={defaultRateType}
                  label="Rate Type"
                  onChange={e => setDefaultRateType(e.target.value)}
                >
                  {RATE_TYPES.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {defaultRateType === 'FIXED' && (
                <TextField
                  label="Fixed Rate"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={defaultFixedRate}
                  onChange={e => setDefaultFixedRate(e.target.value)}
                />
              )}
            </Box>
          )}

          {/* About */}
          {tabIndex === 6 && (
            <Box sx={{ p: 2 }}>
              <TextField
                label="About your pharmacy"
                multiline
                rows={6}
                fullWidth
                value={about}
                onChange={e => setAbout(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            disabled={tabIndex === 0}
            onClick={() => setTabIndex(i => i - 1)}
          >
            Back
          </Button>
          {tabIndex < tabLabels.length - 1 ? (
            <Button onClick={() => setTabIndex(i => i + 1)}>Next</Button>
          ) : (
            <Button variant="contained" onClick={handleSave}>
              Submit
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackMsg}
      />

      <Box mt={4}>
        {pharmacies.length === 0 ? (
          <Typography variant="h6">You have no pharmacies.</Typography>
        ) : (
          paginated.map(p => (
            <Card key={p.id} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6">{p.name}</Typography>
                <Typography color="textSecondary">{p.address}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <IconButton onClick={() => openDialog(p)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(p.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))
        )}

        {pharmacies.length > itemsPerPage && (
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination
              count={Math.ceil(pharmacies.length / itemsPerPage)}
              page={page}
              onChange={(_, val) => setPage(val)}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}