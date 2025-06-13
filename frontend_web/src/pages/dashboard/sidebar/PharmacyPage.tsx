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
  Accordion, AccordionSummary,
  AccordionDetails, AccordionActions,
  List,
  ListItem,
  ListItemText,
  Skeleton,

} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
  state: string;
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
  const [memberships, setMemberships] = useState<Record<string, any[]>>({});
  const [openStaffDlg, setOpenStaffDlg] = useState(false);
  const [currentPh, setCurrentPh] = useState<Pharmacy | null>(null);
  const [memberInvites, setMemberInvites] = useState([
    { email: '', invited_name: '', role: 'PHARMACIST', employment_type: 'FULL_TIME' }
  ]);
  const [staffTab, setStaffTab] = useState(0); // 0=Internal, 1=External
  const [locumInvites, setLocumInvites] = useState([
    { email: '', invited_name: '', role: 'PHARMACIST', employment_type: 'LOCUM' }
  ]);


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
  const [state, setState] = useState('');

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
  // FIX: Corrected useState declarations from previous error.
  const [weekdaysStart, setWeekdaysStart] = useState('');
  const [weekdaysEnd, setWeekdaysEnd] = useState(''); // Fixed here
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
    if (!user) return; // Don't run until user is set

    const isOrgAdmin = Array.isArray(user?.memberships)
      ? user.memberships.some(m => m?.role === 'ORG_ADMIN')
      : false;

    // Make 'load' an async function
    const load = async () => {
      try {
        const res: AxiosResponse<Pharmacy[]> = await apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`);
        setPharmacies(res.data);

        // Fetch memberships for all pharmacies concurrently and wait for them
        const membershipPromises = res.data.map(ph => loadMembers(ph.id));
        await Promise.all(membershipPromises); // Wait for all memberships to load before marking loading as false

      } catch (err: unknown) { // FIX: Changed 'err: AxiosError' to 'err: unknown'
        if (err instanceof AxiosError && err.response?.status === 404) setNeedsOnboarding(true); // Type guard for AxiosError
        else console.error(err);
      } finally {
        setLoading(false); // Set loading to false only after all data (pharmacies + memberships) is fetched
      }
    };

    // This part remains the same, deciding whether to load directly or check onboarding
    if (isOrgAdmin) {
      load();
    } else {
      apiClient.get(`${API_BASE_URL}${API_ENDPOINTS.onboardingDetail('owner')}`)
        .then(load) // Call the async load function
        .catch((err: unknown) => { // FIX: Changed 'err: AxiosError' to 'err: unknown'
          if (err instanceof AxiosError && err.response?.status === 404) setNeedsOnboarding(true); // Type guard for AxiosError
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
      setState(p.state || '');

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
      setAsicNumber(''); setAbn('');setState('');
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
    fd.append('state', state);
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

    const orgMem = Array.isArray(user?.memberships)
      ? user.memberships.find(m => m?.role === 'ORG_ADMIN')
      : null;

    if (orgMem?.organization_id) {
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
    } catch (err: unknown) { // FIX: Changed 'err: any' to 'err: unknown'
      // You can add a type guard if you need to access properties of AxiosError
      if (err instanceof AxiosError) {
        console.error(err);
        setError(err.response?.data?.detail || err.message);
      } else {
        console.error(err);
        setError('An unexpected error occurred.');
      }
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

  // loadMembers now explicitly returns the promise from apiClient.get
  function loadMembers(phId: string) {
    return apiClient
      .get<any[]>(`${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${phId}`)
      .then(res => setMemberships(m => ({ ...m, [phId]: res.data })))
      .catch(console.error);
  }

  // ─── Early Returns ──────────────────────────────────────────────────────────
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
              <TextField
                select
                fullWidth
                margin="normal"
                label="State"
                value={state}
                onChange={e => setState(e.target.value)}
                required
              >
                {[
                  { value: 'QLD', label: 'Queensland' },
                  { value: 'NSW', label: 'New South Wales' },
                  { value: 'VIC', label: 'Victoria' },
                  { value: 'SA', label: 'South Australia' },
                  { value: 'WA', label: 'Western Australia' },
                  { value: 'TAS', label: 'Tasmania' },
                  { value: 'ACT', label: 'Australian Capital Territory' },
                  { value: 'NT', label: 'Northern Territory' },
                ].map(s => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>

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

<Dialog open={openStaffDlg} onClose={() => setOpenStaffDlg(false)} fullWidth maxWidth="sm">
  <DialogTitle>
    Invite Staff to {currentPh?.name}
  </DialogTitle>
  <DialogContent
    sx={{
      // no overflow, nice padding
      pt: 2,
      pb: 2,
      minWidth: 400
    }}
  >
    <Tabs
      value={staffTab}
      onChange={(_, v) => setStaffTab(v)}
      sx={{
        mb: 2,
        '.MuiTab-root': { minWidth: 120 },
      }}
      variant="fullWidth"
      textColor="inherit"
      indicatorColor="primary"
    >
      <Tab label="Internal (Full/Part Time)" />
      <Tab label="External (Locum/Casual)" />
    </Tabs>

    {staffTab === 0 && memberInvites.map((row, idx) => (
      <Box
        key={idx}
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 2,
          mb: 2,
          borderRadius: 2,
          p: 2,
        }}
      >
        <TextField
          label="Full Name"
          value={row.invited_name}
          onChange={e => {
            const v = [...memberInvites];
            v[idx].invited_name = e.target.value;
            setMemberInvites(v);
          }}
          fullWidth
        />
        <TextField
          label="Email"
          value={row.email}
          onChange={e => {
            const v = [...memberInvites];
            v[idx].email = e.target.value;
            setMemberInvites(v);
          }}
          fullWidth
        />
        <TextField
          select
          label="Role"
          value={row.role}
          onChange={e => {
            const v = [...memberInvites];
            v[idx].role = e.target.value;
            setMemberInvites(v);
          }}
          fullWidth
        >
          {['PHARMACIST', 'TECHNICIAN', 'ASSISTANT', 'INTERN', 'STUDENT'].map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt.charAt(0) + opt.slice(1).toLowerCase()}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Employment Type"
          value={row.employment_type}
          onChange={e => {
            const v = [...memberInvites];
            v[idx].employment_type = e.target.value;
            setMemberInvites(v);
          }}
          fullWidth
        >
          {['FULL_TIME', 'PART_TIME'].map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt.replace('_', ' ')}
            </MenuItem>
          ))}
        </TextField>
        {memberInvites.length > 1 && (
          <Box>
            <Button
              color="secondary"
              onClick={() => setMemberInvites(v => v.filter((_, i) => i !== idx))}
            >
              Remove
            </Button>
          </Box>
        )}
      </Box>
    ))}

    {staffTab === 1 && locumInvites.map((row, idx) => (
      <Box
        key={idx}
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 2,
          mb: 2,
          borderRadius: 2,
          p: 2,
        }}
      >
        <TextField
          label="Full Name"
          value={row.invited_name}
          onChange={e => {
            const v = [...locumInvites];
            v[idx].invited_name = e.target.value;
            setLocumInvites(v);
          }}
          fullWidth
        />
        <TextField
          label="Email"
          value={row.email}
          onChange={e => {
            const v = [...locumInvites];
            v[idx].email = e.target.value;
            setLocumInvites(v);
          }}
          fullWidth
        />
        <TextField
          select
          label="Role"
          value={row.role}
          onChange={e => {
            const v = [...locumInvites];
            v[idx].role = e.target.value;
            setLocumInvites(v);
          }}
          fullWidth
        >
          {['PHARMACIST', 'TECHNICIAN', 'ASSISTANT', 'INTERN', 'STUDENT'].map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt.charAt(0) + opt.slice(1).toLowerCase()}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Employment Type"
          value={row.employment_type}
          onChange={e => {
            const v = [...locumInvites];
            v[idx].employment_type = e.target.value;
            setLocumInvites(v);
          }}
          fullWidth
        >
          {['LOCUM', 'CASUAL'].map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt.charAt(0) + opt.slice(1).toLowerCase()}
            </MenuItem>
          ))}
        </TextField>
        {locumInvites.length > 1 && (
          <Box>
            <Button
              color="secondary"
              onClick={() => setLocumInvites(v => v.filter((_, i) => i !== idx))}
            >
              Remove
            </Button>
          </Box>
        )}
      </Box>
    ))}

    <Box mt={2} display="flex" alignItems="center">
      {staffTab === 0 ? (
        <Button
          onClick={() =>
            setMemberInvites(v => [
              ...v,
              { email: '', invited_name: '', role: 'PHARMACIST', employment_type: 'FULL_TIME' }
            ])
          }
        >
          + Add Another
        </Button>
      ) : (
        <Button
          onClick={() =>
            setLocumInvites(v => [
              ...v,
              { email: '', invited_name: '', role: 'PHARMACIST', employment_type: 'LOCUM' }
            ])
          }
        >
          + Add Another
        </Button>
      )}
      <Button
        variant="contained"
        sx={{ ml: 2 }}
        onClick={async () => {
          // 1. Get correct invites array
          const invites =
            staffTab === 0
              ? memberInvites
                  .filter(row => row.email && row.role && row.employment_type)
                  .map(row => ({
                    ...row,
                    pharmacy: currentPh?.id, // Must supply pharmacy!
                  }))
              : locumInvites
                  .filter(row => row.email && row.role && row.employment_type)
                  .map(row => ({
                    ...row,
                    pharmacy: currentPh?.id,
                  }));

          if (!invites.length) {
            setSnackMsg('Please fill out at least one invite.');
            setSnackbarOpen(true);
            return;
          }

          try {
            await apiClient.post(
              `${API_BASE_URL}${API_ENDPOINTS.membershipBulkInvite}`,
              { invitations: invites }
            );
            // Reload members:
            if (currentPh) loadMembers(currentPh.id);
            setSnackMsg('Invitations sent!');
          } catch (e: any) {
            setSnackMsg(e?.response?.data?.detail || 'Failed to send invitations.');
          }

          setSnackbarOpen(true);
          setOpenStaffDlg(false);
        }}
      >
        Send Invitations
      </Button>

    </Box>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setOpenStaffDlg(false)}>Cancel</Button>
  </DialogActions>
</Dialog>


      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackMsg}
      />

      <Box mt={4}>
        {loading ? ( // Render skeleton if loading is true
          Array.from(new Array(itemsPerPage)).map((_, index) => (
            <Box key={index} sx={{ mb: 3 }}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={30} sx={{ mb: 1 }} />
                  <Skeleton variant="text" width="40%" height={20} sx={{ mb: 0.5 }} />
                  <Skeleton variant="text" width="80%" height={20} />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 1 }} />
                    <Skeleton variant="circular" width={40} height={40} />
                  </Box>
                </CardContent>
              </Card>
              <Accordion sx={{ mt: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Skeleton variant="text" width="50%" height={20} />
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {Array.from(new Array(2)).map((_, idx) => ( // Placeholder for 2 staff members
                      <ListItem key={idx}>
                        <ListItemText
                          primary={<Skeleton variant="text" width="70%" />}
                          secondary={<Skeleton variant="text" width="90%" />}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
                <AccordionActions>
                  <Skeleton variant="rectangular" width={100} height={36} />
                </AccordionActions>
              </Accordion>
            </Box>
          ))
        ) : pharmacies.length === 0 ? (
          <Typography variant="h6">You have no pharmacies.</Typography>
        ) : (
          paginated.map(p => (
            <Box key={p.id} sx={{ mb: 3 }}>
              {/* Pharmacy Card */}
              <Card>
                <CardContent>
                  <Typography variant="h6">{p.name}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {p.state}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {p.address}
                  </Typography>
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
              {/* Accordion for staff — DIRECTLY under each card */}
              <Accordion sx={{ mt: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>{p.name} — Staff</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {(memberships[p.id] || []).map(m => (
                      <ListItem
                        key={m.id}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            onClick={() => {
                              apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.membershipDelete(m.id)}`)
                                .then(() => loadMembers(p.id));
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <>
                              <strong>{m.user_details?.email}</strong>
                              {m.invited_name && <> &mdash; <em>{m.invited_name}</em></>}
                            </>
                          }
                          secondary={
                            <>
                              <span>Role: <b>{m.role}</b></span>
                              &nbsp;|&nbsp;
                              <span>Type: <b>{m.employment_type}</b></span>
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
                <AccordionActions>
                  <Button onClick={() => {
                    setCurrentPh(p);
                    setOpenStaffDlg(true);
                  }}>
                    Invite Staff
                  </Button>
                </AccordionActions>
              </Accordion>
            </Box>
          ))
        )}
        {pharmacies.length > itemsPerPage && !loading && (
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