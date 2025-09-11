/// <reference types="@types/google.maps" />

import { useState, useEffect, useRef } from 'react';
import { GlobalStyles } from '@mui/material';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Card,
  CardContent, IconButton, Snackbar, Alert, Tabs, Tab, Link as MuiLink, Checkbox, FormGroup,
  FormControlLabel, MenuItem, Select, FormControl, InputLabel, Pagination, Accordion,
  AccordionSummary, AccordionDetails, AccordionActions, Skeleton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,  InputAdornment,  
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AddCircleOutline as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ContentCopy as ContentCopyIcon, Done as DoneIcon, Close as CloseIcon } from '@mui/icons-material';
import { AxiosError, AxiosResponse } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import type { OrgMembership } from '../../../contexts/AuthContext';

import apiClient from '../../../utils/apiClient';
import { API_BASE_URL, API_ENDPOINTS } from '../../../constants/api';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

// --- Constants & Types ---
const GOOGLE_LIBRARIES = ['places'] as Array<'places'>;

interface Pharmacy {
  id: string; owner: number; name: string; street_address: string; suburb: string; postcode: string;
  google_place_id: string; latitude: number | null; longitude: number | null; state: string;
  chain: number | null; abn: string;  methadone_s8_protocols?: string;
  qld_sump_docs?: string; sops?: string; induction_guides?: string; employment_types?: string[];
  roles_needed?: string[]; weekdays_start: string | null; weekdays_end: string | null;
  saturdays_start: string | null; saturdays_end: string | null; sundays_start: string | null;
  sundays_end: string | null; public_holidays_start: string | null; public_holidays_end: string | null;
  default_rate_type: 'FIXED' | 'FLEXIBLE' | 'PHARMACIST_PROVIDED' | null; default_fixed_rate: string | null;
  about: string;
}
interface MemberInvite { email: string; invited_name: string; role: string; employment_type: string; pharmacist_award_level: string; otherstaff_classification_level: string; intern_half: string; student_year: string; }

const PHARMACIST_AWARD_LEVELS = [ { value: 'PHARMACIST', label: 'Pharmacist' }, { value: 'EXPERIENCED_PHARMACIST', label: 'Experienced Pharmacist' }, { value: 'PHARMACIST_IN_CHARGE', label: 'Pharmacist In Charge' }, { value: 'PHARMACIST_MANAGER', label: 'Pharmacist Manager' }];
const OTHERSTAFF_CLASSIFICATIONS = [ { value: 'LEVEL_1', label: 'Level 1' }, { value: 'LEVEL_2', label: 'Level 2' }, { value: 'LEVEL_3', label: 'Level 3' }, { value: 'LEVEL_4', label: 'Level 4' }];
const INTERN_HALVES = [ { value: 'FIRST_HALF', label: 'First Half' }, { value: 'SECOND_HALF', label: 'Second Half' }];
const STUDENT_YEARS = [ { value: 'YEAR_1', label: 'Year 1' }, { value: 'YEAR_2', label: 'Year 2' }, { value: 'YEAR_3', label: 'Year 3' }, { value: 'YEAR_4', label: 'Year 4' }];
// --- Invite UI constants ---
const ROLE_OPTIONS = [
  { value: 'PHARMACY_ADMIN', label: 'Admin' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'TECHNICIAN', label: 'Technician' },
  { value: 'ASSISTANT', label: 'Assistant' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'STUDENT', label: 'Student' },
] as const;

const EMPLOYMENT_TYPES_INTERNAL = ['FULL_TIME', 'PART_TIME', 'CASUAL'] as const;
const EMPLOYMENT_TYPES_EXTERNAL = ['LOCUM', 'SHIFT_HERO'] as const;


const labelEmploymentType = (v?: string) =>
  (v || '—')
    .toLowerCase()
    .split('_')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

const getAllowedTypesForCategory = (cat: 'FULL_PART_TIME' | 'LOCUM_CASUAL') =>
  cat === 'FULL_PART_TIME'
    ? ['FULL_TIME', 'PART_TIME', 'CASUAL']
    : ['LOCUM', 'SHIFT_HERO'];

const getMemberClassification = (member: any) => {
  switch (member.role) {
    case 'PHARMACIST': return PHARMACIST_AWARD_LEVELS.find(l => l.value === member.pharmacist_award_level)?.label || member.pharmacist_award_level;
    case 'ASSISTANT': case 'TECHNICIAN': return OTHERSTAFF_CLASSIFICATIONS.find(l => l.value === member.otherstaff_classification_level)?.label || member.otherstaff_classification_level;
    case 'INTERN': return INTERN_HALVES.find(l => l.value === member.intern_half)?.label || member.intern_half;
    case 'STUDENT': return STUDENT_YEARS.find(l => l.value === member.student_year)?.label || member.student_year;
    default: return null;
  }
};


// const STATE_BOUNDS: Record<string, google.maps.LatLngBoundsLiteral> = {
//   NSW: { south: -38.5, west: 140.9, north: -28.0, east: 153.7 },
//   QLD: { south: -29.5, west: 138.0, north: -9.0,  east: 153.6 },
//   VIC: { south: -39.2, west: 140.9, north: -33.9, east: 150.1 },
//   SA:  { south: -38.1, west: 129.0, north: -25.9, east: 141.0 },
//   WA:  { south: -35.2, west: 112.9, north: -13.7, east: 129.0 },
//   TAS: { south: -43.8, west: 144.3, north: -39.0, east: 148.7 },
//   ACT: { south: -35.8, west: 148.7, north: -35.1, east: 149.4 },
//   NT:  { south: -25.9, west: 129.0, north: -10.9, east: 138.0 },
// };

// --- Component ---
export default function PharmacyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_Maps_API_KEY || '',
    libraries: GOOGLE_LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [memberships, setMemberships] = useState<Record<string, any[]>>({});
  const [openStaffDlg, setOpenStaffDlg] = useState(false);

  // Magic link dialog state
  const [openLinkDlg, setOpenLinkDlg] = useState(false);
  const [linkCategory, setLinkCategory] = useState<'FULL_PART_TIME' | 'LOCUM_CASUAL'>('FULL_PART_TIME');
  const [linkExpiryDays, setLinkExpiryDays] = useState<number>(14);
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState<string | null>(null);

  // Applications state (per pharmacy)
  const [applications, setApplications] = useState<Record<string, any[]>>({});

  const [approveTypeById, setApproveTypeById] = useState<Record<number, string>>({});

    // Invite mode and admin single-row state
  const [inviteMode, setInviteMode] = useState<'internal' | 'locum' | 'admin'>('internal');
  const [adminInvite, setAdminInvite] = useState<Partial<MemberInvite>>({
    email: '',
    invited_name: '',
    role: 'PHARMACY_ADMIN',
    employment_type: 'FULL_TIME',
  });
  const [currentPh, setCurrentPh] = useState<Pharmacy | null>(null);
  const [memberInvites, setMemberInvites] = useState<Partial<MemberInvite>[]>([{ email: '', invited_name: '', role: 'PHARMACIST', employment_type: 'FULL_TIME', pharmacist_award_level: 'PHARMACIST' }]);
  const [locumInvites, setLocumInvites] = useState<Partial<MemberInvite>[]>([{ email: '', invited_name: '', role: 'PHARMACIST', employment_type: 'LOCUM', pharmacist_award_level: 'PHARMACIST' }]);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const tabLabels = ['Basic', 'Regulatory', 'Docs', 'Employment', 'Hours', 'Rate', 'About'];
  const [name, setName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [postcode, setPostcode] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [state, setState] = useState('');
  const [abn, setAbn] = useState('');
  const [approvalCertFile, setApprovalCertFile] = useState<File | null>(null);
  const [existingApprovalCert, setExistingApprovalCert] = useState<string | null>(null);
  const [sopsFile, setSopsFile] = useState<File | null>(null);
  const [existingSops, setExistingSops] = useState<string | null>(null);
  const [inductionGuidesFile, setInductionGuidesFile] = useState<File | null>(null);
  const [existingInductionGuides, setExistingInductionGuides] = useState<string | null>(null);
  const [sumpDocsFile, setSumpDocsFile] = useState<File | null>(null);
  const [existingSumpDocs, setExistingSumpDocs] = useState<string | null>(null);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [rolesNeeded, setRolesNeeded] = useState<string[]>([]);
  const [weekdaysStart, setWeekdaysStart] = useState('');
  const [weekdaysEnd, setWeekdaysEnd] = useState('');
  const [saturdaysStart, setSaturdaysStart] = useState('');
  const [saturdaysEnd, setSaturdaysEnd] = useState('');
  const [sundaysStart, setSundaysStart] = useState('');
  const [sundaysEnd, setSundaysEnd] = useState('');
  const [publicHolidaysStart, setPublicHolidaysStart] = useState('');
  const [publicHolidaysEnd, setPublicHolidaysEnd] = useState('');
  const [defaultRateType, setDefaultRateType] = useState<string>('');
  const [defaultFixedRate, setDefaultFixedRate] = useState<string>('');
  const [about, setAbout] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [error, setError] = useState('');

  const hoursFields = [ { label: 'Weekdays', start: weekdaysStart, setStart: setWeekdaysStart, end: weekdaysEnd, setEnd: setWeekdaysEnd }, { label: 'Saturdays', start: saturdaysStart, setStart: setSaturdaysStart, end: saturdaysEnd, setEnd: setSaturdaysEnd }, { label: 'Sundays', start: sundaysStart, setStart: setSundaysStart, end: sundaysEnd, setEnd: setSundaysEnd }, { label: 'Public Holidays', start: publicHolidaysStart, setStart: setPublicHolidaysStart, end: publicHolidaysEnd, setEnd: setPublicHolidaysEnd }];
  const RATE_TYPES = [ { value: 'FIXED', label: 'Fixed' }, { value: 'FLEXIBLE', label: 'Flexible' }, { value: 'PHARMACIST_PROVIDED', label: 'Pharmacist Provided' }] as const;
  const abnDigits = abn.replace(/\D/g, '');
  const abnInvalid = abnDigits.length > 0 && abnDigits.length !== 11;

  const getFileUrl = (path: string | null) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  };


  const loadMembers = (phId: string) => { return apiClient.get<any[]>(`${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${phId}`).then(res => setMemberships(m => ({ ...m, [phId]: res.data }))).catch(console.error); };


const loadApplications = (phId: string) => {
  return apiClient
    .get<any[]>(`${API_BASE_URL}${API_ENDPOINTS.membershipApplications}?status=PENDING`)
    .then(res => {
      const filtered = (res.data || []).filter((a: any) => String(a.pharmacy) === String(phId));
      setApplications(prev => ({ ...prev, [phId]: filtered }));
    })
    .catch(console.error);
};

useEffect(() => {
  if (!user) return;

  const isOrgAdmin =
    Array.isArray(user?.memberships) &&
    user.memberships.some((m: any) => m?.role === 'ORG_ADMIN');

  const isPharmacyAdmin =
    !!user?.is_pharmacy_admin ||
    (Array.isArray(user?.memberships) &&
      user.memberships.some((m: any) => m?.role === 'PHARMACY_ADMIN'));

  const load = async () => {
    try {
      const res: AxiosResponse<Pharmacy[]> = await apiClient.get(
        `${API_BASE_URL}${API_ENDPOINTS.pharmacies}`
      );
      setPharmacies(res.data);

      // load members + applications for each pharmacy
      const membershipPromises = res.data.map(ph => loadMembers(ph.id));
      const applicationPromises = res.data.map(ph => loadApplications(ph.id));
      await Promise.all([...membershipPromises, ...applicationPromises]);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setNeedsOnboarding(true);
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (isOrgAdmin || isPharmacyAdmin) {
    // Admins (and org-admins) should load pharmacies immediately
    load();
  } else {
    // Owners still need onboarding check first
    apiClient
      .get(`${API_BASE_URL}${API_ENDPOINTS.onboardingDetail('owner')}`)
      .then(load)
      .catch((err: unknown) => {
        if (err instanceof AxiosError && err.response?.status === 404) {
          setNeedsOnboarding(true);
        } else {
          console.error(err);
        }
      });
    // Note: no extra setLoading(false) here; load() already sets it
  }
}, [user]);


//   useEffect(() => {
//   if (!isLoaded || !autocompleteRef.current) return;
//   const bounds = STATE_BOUNDS[state];
//   if (!bounds) {
//     // No state selected: allow AU-wide bias only
//     autocompleteRef.current.setOptions({
//       componentRestrictions: { country: 'au' },
//       strictBounds: false,
//       bounds: undefined,
//     });
//     return;
//   }

//   autocompleteRef.current.setOptions({
//     componentRestrictions: { country: 'au' },
//     bounds,               // rectangular restriction for the state
//     strictBounds: true,   // hard limit to the bounds
//     fields: ['address_components', 'geometry', 'place_id', 'name'],
//   });
// }, [state, isLoaded]);

  const openDialog = (p?: Pharmacy) => {
    setApprovalCertFile(null); setSopsFile(null); setInductionGuidesFile(null); setSumpDocsFile(null);
    if (p) {
      setEditing(p); setName(p.name || ''); setStreetAddress(p.street_address || ''); setSuburb(p.suburb || ''); setPostcode(p.postcode || '');
      setGooglePlaceId(p.google_place_id || ''); setLatitude(p.latitude || null); setLongitude(p.longitude || null); setState(p.state || '');
      setAbn(p.abn || ''); setExistingApprovalCert(p.methadone_s8_protocols || null);
      setExistingSops(p.sops || null); setExistingInductionGuides(p.induction_guides || null); setExistingSumpDocs(p.qld_sump_docs || null);
      setEmploymentTypes(p.employment_types || []); setRolesNeeded(p.roles_needed || []); setWeekdaysStart(p.weekdays_start || '');
      setWeekdaysEnd(p.weekdays_end || ''); setSaturdaysStart(p.saturdays_start || ''); setSaturdaysEnd(p.saturdays_end || '');
      setSundaysStart(p.sundays_start || ''); setSundaysEnd(p.sundays_end || ''); setPublicHolidaysStart(p.public_holidays_start || '');
      setPublicHolidaysEnd(p.public_holidays_end || ''); setDefaultRateType(p.default_rate_type || ''); setDefaultFixedRate(p.default_fixed_rate || '');
      setAbout(p.about || '');
    } else {
      setEditing(null); setName(''); setStreetAddress(''); setSuburb(''); setPostcode(''); setGooglePlaceId(''); setLatitude(null);
      setLongitude(null); setAbn(''); setState(''); setExistingApprovalCert(null); setExistingSops(null);
      setExistingInductionGuides(null); setExistingSumpDocs(null); setEmploymentTypes([]); setRolesNeeded([]); setWeekdaysStart('');
      setWeekdaysEnd(''); setSaturdaysStart(''); setSaturdaysEnd(''); setSundaysStart(''); setSundaysEnd(''); setPublicHolidaysStart('');
      setPublicHolidaysEnd(''); setDefaultRateType(''); setDefaultFixedRate(''); setAbout('');
    }
    setTabIndex(0); setDialogOpen(true);
  };
  
  const closeDialog = () => setDialogOpen(false);

  const clearAddress = () => {
    setStreetAddress(''); setSuburb(''); setPostcode(''); setGooglePlaceId(''); setLatitude(null); setLongitude(null);
    if (autocompleteRef.current) {
        const input = document.getElementById('autocomplete-textfield') as HTMLInputElement;
        if(input) input.value = '';
    }
  };

const handlePlaceChanged = () => {
  if (!autocompleteRef.current) return;
  const place = autocompleteRef.current.getPlace();
  if (!place || !place.address_components) return;

  let streetNumber = '';
  let route = '';
  let locality = '';
  let postalCode = '';
  let stateShort = '';

  place.address_components.forEach(component => {
    const types = component.types;
    if (types.includes('street_number')) streetNumber = component.long_name;
    if (types.includes('route')) route = component.short_name;
    if (types.includes('locality')) locality = component.long_name;
    if (types.includes('postal_code')) postalCode = component.long_name;
    if (types.includes('administrative_area_level_1')) stateShort = component.short_name; // e.g., 'NSW'
  });

  setStreetAddress(`${streetNumber} ${route}`.trim());
  setSuburb(locality);
  setPostcode(postalCode);
  setState(stateShort);                 // auto-fill state (editable field)
  setGooglePlaceId(place.place_id || '');
  if (place.geometry?.location) {
    setLatitude(place.geometry.location.lat());
    setLongitude(place.geometry.location.lng());
  }
  // Always set name from the Google Place
  if (place.name) setName(place.name);
};


  const handleSave = async () => {
    if (abnDigits.length !== 11) { setError('ABN must be 11 digits.'); return; }
    const fd = new FormData();
    fd.append('name', name); fd.append('street_address', streetAddress); fd.append('suburb', suburb); fd.append('postcode', postcode);
    fd.append('google_place_id', googlePlaceId);
    if (latitude !== null) fd.append('latitude', latitude.toFixed(6));
    if (longitude !== null) fd.append('longitude', longitude.toFixed(6));

    fd.append('state', state);
    fd.append('abn', abnDigits);
    if (approvalCertFile) fd.append('methadone_s8_protocols', approvalCertFile);
    if (sopsFile) fd.append('sops', sopsFile);
    if (inductionGuidesFile) fd.append('induction_guides', inductionGuidesFile);
    if (sumpDocsFile) fd.append('qld_sump_docs', sumpDocsFile);
    fd.append('employment_types', JSON.stringify(employmentTypes)); fd.append('roles_needed', JSON.stringify(rolesNeeded));
    fd.append('weekdays_start', weekdaysStart); fd.append('weekdays_end', weekdaysEnd);
    fd.append('saturdays_start', saturdaysStart); fd.append('saturdays_end', saturdaysEnd);
    fd.append('sundays_start', sundaysStart); fd.append('sundays_end', sundaysEnd);
    fd.append('public_holidays_start', publicHolidaysStart); fd.append('public_holidays_end', publicHolidaysEnd);
    fd.append('default_rate_type', defaultRateType);
    if (defaultRateType === 'FIXED') fd.append('default_fixed_rate', defaultFixedRate);
    fd.append('about', about);
const orgMem = Array.isArray(user?.memberships)
  ? user.memberships.find(
      (m): m is OrgMembership =>
        (m as any)?.role === 'ORG_ADMIN' && 'organization_id' in (m as any)
    )
  : undefined;

if (orgMem?.organization_id) {
  fd.append('organization', String(orgMem.organization_id));
}
    try {
      const urlBase = `${API_BASE_URL}${API_ENDPOINTS.pharmacies}`;
      if (editing) {
        const res = await apiClient.patch(`${urlBase}${editing.id}/`, fd);
        setPharmacies(prev => prev.map(x => (x.id === editing.id ? res.data : x)));
        setSnackMsg('Pharmacy updated!');
      } else {
        const res = await apiClient.post(urlBase, fd);
        setPharmacies(prev => [...prev, res.data]);
        setSnackMsg('Pharmacy added!');
      }
      setSnackbarOpen(true); closeDialog();
    } catch (err: unknown) {
      if (err instanceof AxiosError) setError(err.response?.data?.detail || err.message);
      else setError('An unexpected error occurred.');
    }
  };
  const handleDelete = async (id: string) => { try { await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}${id}/`); setPharmacies(prev => prev.filter(p => p.id !== id)); setSnackMsg('Deleted successfully!'); setSnackbarOpen(true); } catch (err) { console.error(err); } };
  const handleOpenInviteDialog = (pharmacy: Pharmacy, mode: 'internal' | 'locum' | 'admin') => {
    setCurrentPh(pharmacy);
    setInviteMode(mode);

    if (mode === 'internal') {
      setMemberInvites([{
        email: '',
        invited_name: '',
        role: 'PHARMACIST',
        employment_type: 'FULL_TIME',
        pharmacist_award_level: 'PHARMACIST',
      }]);
    } else if (mode === 'locum') {
      setLocumInvites([{
        email: '',
        invited_name: '',
        role: 'PHARMACIST',
        employment_type: 'LOCUM',
        pharmacist_award_level: 'PHARMACIST',
      }]);
    } else {
      setAdminInvite({
        email: '',
        invited_name: '',
        role: 'PHARMACY_ADMIN',
        employment_type: 'FULL_TIME',
      });
    }

    setOpenStaffDlg(true);
  };


const handleOpenLinkDialog = (pharmacy: Pharmacy, category: 'FULL_PART_TIME' | 'LOCUM_CASUAL') => {
  setCurrentPh(pharmacy);
  setLinkCategory(category);
  setLinkExpiryDays(14);
  setGeneratedLinkUrl(null);
  setOpenLinkDlg(true);
};

const handleCreateMagicLink = async () => {
  if (!currentPh) return;
  try {
    const body = {
      pharmacy: currentPh.id,
      category: linkCategory,
      expires_in_days: linkExpiryDays,
    };
    const res = await apiClient.post(`${API_BASE_URL}${API_ENDPOINTS.membershipInviteLinks}`, body);
    const token = res.data?.token;
    const url = `${window.location.origin}/membership/apply/${token}`;
    setGeneratedLinkUrl(url);
  } catch (e: any) {
    setSnackMsg(e?.response?.data?.detail || 'Failed to generate link.');
    setSnackbarOpen(true);
  }
};

const copyLinkToClipboard = async () => {
  if (!generatedLinkUrl) return;
  await navigator.clipboard.writeText(generatedLinkUrl);
  setSnackMsg('Link copied to clipboard');
  setSnackbarOpen(true);
};

const approveApplication = async (appId: number, pharmacyId: string, employmentType?: string) => {

  try {
    await apiClient.post(
      `${API_BASE_URL}${API_ENDPOINTS.membershipApplications}${appId}/approve/`,
      employmentType ? { employment_type: employmentType } : {}
    );

    await loadApplications(pharmacyId);
    await loadMembers(pharmacyId);
    setSnackMsg('Application approved');
  } catch (e: any) {
    setSnackMsg(e?.response?.data?.detail || 'Failed to approve.');
  }
  setSnackbarOpen(true);
};

const rejectApplication = async (appId: number, pharmacyId: string) => {
  try {
    await apiClient.post(`${API_BASE_URL}${API_ENDPOINTS.membershipApplications}${appId}/reject/`, {});
    await loadApplications(pharmacyId);
    setSnackMsg('Application rejected');
  } catch (e: any) {
    setSnackMsg(e?.response?.data?.detail || 'Failed to reject.');
  }
  setSnackbarOpen(true);
};


  const handleSendInvites = async () => {
    let invites: any[] = [];

    if (inviteMode === 'admin') {
      if (!adminInvite.email) {
        setSnackMsg('Please enter an email.');
        setSnackbarOpen(true);
        return;
      }
      invites = [{
        ...adminInvite,
        role: 'PHARMACY_ADMIN',
        employment_type: adminInvite.employment_type || 'FULL_TIME',
        pharmacy: currentPh?.id,
      }];
    } else {
      const rows = inviteMode === 'internal' ? memberInvites : locumInvites;
      invites = rows
        .filter(row => row.email && row.role)
        .map(row => {
          const base = { ...row, pharmacy: currentPh?.id };
          if (base.role === 'PHARMACY_ADMIN' && !base.employment_type) {
            base.employment_type = 'FULL_TIME';
          }
          return base;
        });
    }

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
      if (currentPh) await loadMembers(currentPh.id);
      setSnackMsg('Invitations sent!');
    } catch (e: any) {
      setSnackMsg(e?.response?.data?.detail || 'Failed to send invitations.');
    }

    setSnackbarOpen(true);
    setOpenStaffDlg(false);
  };


  if (needsOnboarding) { return ( <Box p={4} textAlign="center"> <Alert severity="warning"> Please complete <strong>Owner Onboarding</strong> first. </Alert> <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/onboarding/owner')}> Go to Onboarding </Button> </Box> ); }
  const paginatedPharmacies = pharmacies.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <Box p={2}>
      <GlobalStyles styles={{ '.pac-container': { zIndex: 1400 } }} />
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>Add Pharmacy</Button>
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md" disableEnforceFocus>
        <DialogTitle>{editing ? 'Edit Pharmacy' : 'Add Pharmacy'}</DialogTitle>
        <DialogContent sx={{ minHeight: 450 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Tabs value={tabIndex} onChange={(_, i) => setTabIndex(i)} centered sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            {tabLabels.map(label => (<Tab key={label} label={label} />))}
          </Tabs>

          {tabIndex === 0 && (
            <Box sx={{ p: 2 }}>

              {isLoaded && !googlePlaceId && (
                <Autocomplete
                  onLoad={ref => (autocompleteRef.current = ref)}
                  onPlaceChanged={handlePlaceChanged}
                  options={{
                    componentRestrictions: { country: 'au' },
                    fields: ['address_components', 'geometry', 'place_id', 'name'],
                  }}
                >
                  <TextField fullWidth margin="normal" label="Search Address" id="autocomplete-textfield" />
                </Autocomplete>
              )}
              {loadError && <Alert severity="error">Google Maps failed to load.</Alert>}
              
              {googlePlaceId && (
                <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
                <TextField label="Street Address" fullWidth margin="normal" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} />
                <TextField label="Suburb"         fullWidth margin="normal" value={suburb}         onChange={e => setSuburb(e.target.value)} />
                <TextField label="State"         fullWidth margin="normal" value={state}         onChange={e => setState(e.target.value)} />
                <TextField label="Postcode"       fullWidth margin="normal" value={postcode}       onChange={e => setPostcode(e.target.value)} />
                  <Button size="small" onClick={clearAddress} sx={{ mt: 1 }}>Clear Address & Search Again</Button>
                </Box>
              )}

                <TextField label="Pharmacy Name" fullWidth margin="normal" value={name} onChange={e => setName(e.target.value)} />

            </Box>
          )}

          {tabIndex === 1 && ( <Box sx={{ p: 2 }}> <Typography>Approval Certificate</Typography> <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}> <Button variant="outlined" component="label">Upload Certificate<input hidden type="file" onChange={e => setApprovalCertFile(e.target.files?.[0] || null)} /></Button> {approvalCertFile ? (<Typography variant="body2">{approvalCertFile.name}</Typography>) : existingApprovalCert ? (<MuiLink href={getFileUrl(existingApprovalCert)} target="_blank" rel="noopener noreferrer">View</MuiLink>) : (<Typography variant="body2" color="text.secondary">No file uploaded</Typography>)} </Box>  <TextField
            label="ABN"
            required
            fullWidth
            margin="normal"
            value={abn}
            onChange={e => setAbn(e.target.value)}
            error={abnInvalid}
            helperText={abnInvalid ? 'ABN must be 11 digits' : 'Enter 11 digits (spaces/dashes allowed)'}
          />
          </Box> )}
          {tabIndex === 2 && ( <Box sx={{ p: 2 }}> <Typography>SOPs (optional)</Typography> <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, mb: 2 }}> <Button variant="outlined" component="label">Upload SOPs<input hidden type="file" onChange={e => setSopsFile(e.target.files?.[0] || null)} /></Button> {sopsFile ? (<Typography variant="body2">{sopsFile.name}</Typography>) : existingSops ? (<MuiLink href={getFileUrl(existingSops)} target="_blank" rel="noopener noreferrer">View</MuiLink>) : (<Typography variant="body2" color="text.secondary">No file uploaded</Typography>)} </Box> <Typography>Induction Guides (optional)</Typography> <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, mb: 2 }}> <Button variant="outlined" component="label">Upload Induction Guides<input hidden type="file" onChange={e => setInductionGuidesFile(e.target.files?.[0] || null)} /></Button> {inductionGuidesFile ? (<Typography variant="body2">{inductionGuidesFile.name}</Typography>) : existingInductionGuides ? (<MuiLink href={getFileUrl(existingInductionGuides)} target="_blank" rel="noopener noreferrer">View</MuiLink>) : (<Typography variant="body2" color="text.secondary">No file uploaded</Typography>)} </Box> <Typography>S8/SUMP Docs (optional)</Typography> <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}> <Button variant="outlined" component="label">Upload S8/SUMP<input hidden type="file" onChange={e => setSumpDocsFile(e.target.files?.[0] || null)} /></Button> {sumpDocsFile ? (<Typography variant="body2">{sumpDocsFile.name}</Typography>) : existingSumpDocs ? (<MuiLink href={getFileUrl(existingSumpDocs)} target="_blank" rel="noopener noreferrer">View</MuiLink>) : (<Typography variant="body2" color="text.secondary">No file uploaded</Typography>)} </Box> </Box> )}
          {tabIndex === 3 && ( <Box sx={{ p: 2 }}> <Typography variant="h6">Employment Types</Typography> <FormGroup sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}> {['PART_TIME', 'FULL_TIME', 'LOCUMS'].map(v => ( <FormControlLabel key={v} control={<Checkbox checked={employmentTypes.includes(v)} onChange={() => setEmploymentTypes(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))} />} label={v.replace('_', ' ')} /> ))} </FormGroup> <Typography variant="h6">Roles Needed</Typography> <FormGroup sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}> {['PHARMACIST', 'INTERN', 'ASSISTANT', 'TECHNICIAN', 'STUDENT', 'ADMIN', 'DRIVER'].map(v => ( <FormControlLabel key={v} control={<Checkbox checked={rolesNeeded.includes(v)} onChange={() => setRolesNeeded(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))} />} label={v.charAt(0) + v.slice(1).toLowerCase()} /> ))} </FormGroup> </Box> )}
          {tabIndex === 4 && ( <Box sx={{ p: 2 }}> {hoursFields.map(({ label, start, setStart, end, setEnd }) => ( <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr', gap: 2, alignItems: 'center', mb: 2 }}> <Typography>{label}</Typography> <TextField label="Start" type="time" fullWidth value={start} onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} /> <TextField label="End" type="time" fullWidth value={end} onChange={e => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} /> </Box> ))} </Box> )}
          {tabIndex === 5 && ( 
            <Box sx={{ p: 2 }}> <FormControl fullWidth margin="normal"> 
              <InputLabel>Rate Type</InputLabel> 
              <Select value={defaultRateType} label="Rate Type" onChange={e => setDefaultRateType(e.target.value)}> 
                {RATE_TYPES.map(opt => ( <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem> ))} 
              </Select> </FormControl> 
              
              {defaultRateType === 'FIXED' && ( 
                <TextField label="Fixed Rate per hour" 
                          type="number" 
                          fullWidth margin="normal" 
                          value={defaultFixedRate} onChange={e => setDefaultFixedRate(e.target.value)}  
                          InputProps={{startAdornment: <InputAdornment position="start">$</InputAdornment>,}}
                          /> )} 
            </Box> )}
          {tabIndex === 6 && ( <Box sx={{ p: 2 }}> <TextField label="About your pharmacy" multiline rows={6} fullWidth value={about} onChange={e => setAbout(e.target.value)} /> </Box> )}
        </DialogContent>
        <DialogActions>
          <Button disabled={tabIndex === 0} onClick={() => setTabIndex(i => i - 1)}>Back</Button>
          {tabIndex < tabLabels.length - 1 ? ( <Button onClick={() => setTabIndex(i => i + 1)}>Next</Button> ) : ( <Button variant="contained" onClick={handleSave}>Submit</Button> )}
        </DialogActions>
      </Dialog>
      <Dialog open={openStaffDlg} onClose={() => setOpenStaffDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {inviteMode === 'admin'
            ? `Assign Admin for ${currentPh?.name ?? ''}`
            : inviteMode === 'internal'
              ? `Invite Full/Part Time to ${currentPh?.name ?? ''}`
              : `Invite Favorite Staff (Locum/Shift Hero) to ${currentPh?.name ?? ''}` }
        </DialogTitle>

        <DialogContent sx={{ pt: 2, pb: 2, minWidth: 400 }}>
          {/* INTERNAL (Full/Part) */}
          {inviteMode === 'internal' && (
            <>
              {memberInvites.map((row, idx) => {
                const handleInviteChangeInternal = (field: keyof MemberInvite, value: string) => {
                  const next = [...memberInvites];
                  next[idx] = { ...next[idx], [field]: value };
                  setMemberInvites(next);
                };

                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 2,
                      mb: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 2,
                    }}
                  >
                    <TextField
                      label="Full Name"
                      value={row.invited_name || ''}
                      onChange={e => handleInviteChangeInternal('invited_name', e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      value={row.email || ''}
                      onChange={e => handleInviteChangeInternal('email', e.target.value)}
                      fullWidth
                    />

                    {/* Role (Admin has its own button/flow) */}
                    <TextField
                      select
                      label="Role"
                      value={row.role || ''}
                      onChange={e => handleInviteChangeInternal('role', e.target.value)}
                      fullWidth
                    >
                      {ROLE_OPTIONS.filter(opt => opt.value !== 'PHARMACY_ADMIN').map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>

                    {row.role === 'PHARMACIST' && (
                      <TextField
                        select
                        fullWidth
                        label="Award Level"
                        value={row.pharmacist_award_level || 'PHARMACIST'}
                        onChange={e => handleInviteChangeInternal('pharmacist_award_level', e.target.value)}
                      >
                        {PHARMACIST_AWARD_LEVELS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {(row.role === 'ASSISTANT' || row.role === 'TECHNICIAN') && (
                      <TextField
                        select
                        fullWidth
                        label="Classification Level"
                        value={row.otherstaff_classification_level || 'LEVEL_1'}
                        onChange={e => handleInviteChangeInternal('otherstaff_classification_level', e.target.value)}
                      >
                        {OTHERSTAFF_CLASSIFICATIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {row.role === 'INTERN' && (
                      <TextField
                        select
                        fullWidth
                        label="Intern Half"
                        value={row.intern_half || 'FIRST_HALF'}
                        onChange={e => handleInviteChangeInternal('intern_half', e.target.value)}
                      >
                        {INTERN_HALVES.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {row.role === 'STUDENT' && (
                      <TextField
                        select
                        fullWidth
                        label="Student Year"
                        value={row.student_year || 'YEAR_1'}
                        onChange={e => handleInviteChangeInternal('student_year', e.target.value)}
                      >
                        {STUDENT_YEARS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {/* Employment Type — INTERNAL options only */}
                    <TextField
                      select
                      label="Employment Type"
                      value={row.employment_type || ''}
                      onChange={e => handleInviteChangeInternal('employment_type', e.target.value)}
                      fullWidth
                    >
                      {EMPLOYMENT_TYPES_INTERNAL.map(opt => (
                        <MenuItem key={opt} value={opt}>
                          {opt.replace('_', ' ')}
                        </MenuItem>
                      ))}
                    </TextField>

                    {memberInvites.length > 1 && (
                      <Box>
                        <Button color="secondary" onClick={() => setMemberInvites(v => v.filter((_, i) => i !== idx))}>
                          Remove
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}

              <Box mt={2} display="flex" alignItems="center">
                <Button
                  onClick={() =>
                    setMemberInvites(v => [
                      ...v,
                      {
                        email: '',
                        invited_name: '',
                        role: 'PHARMACIST',
                        employment_type: 'FULL_TIME',
                        pharmacist_award_level: 'PHARMACIST',
                      },
                    ])
                  }
                >
                  + Add Another
                </Button>
                <Button variant="contained" sx={{ ml: 'auto' }} onClick={handleSendInvites}>
                  Send Invitations
                </Button>
              </Box>
            </>
          )}

          {/* LOCUM/CASUAL */}
          {inviteMode === 'locum' && (
            <>
              {locumInvites.map((row, idx) => {
                const handleInviteChangeLocum = (field: keyof MemberInvite, value: string) => {
                  const next = [...locumInvites];
                  next[idx] = { ...next[idx], [field]: value };
                  setLocumInvites(next);
                };

                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 2,
                      mb: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 2,
                    }}
                  >
                    <TextField
                      label="Full Name"
                      value={row.invited_name || ''}
                      onChange={e => handleInviteChangeLocum('invited_name', e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      value={row.email || ''}
                      onChange={e => handleInviteChangeLocum('email', e.target.value)}
                      fullWidth
                    />

                    {/* Role (Admin has its own button/flow) */}
                    <TextField
                      select
                      label="Role"
                      value={row.role || ''}
                      onChange={e => handleInviteChangeLocum('role', e.target.value)}
                      fullWidth
                    >
                      {ROLE_OPTIONS.filter(opt => opt.value !== 'PHARMACY_ADMIN').map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>

                    {row.role === 'PHARMACIST' && (
                      <TextField
                        select
                        fullWidth
                        label="Award Level"
                        value={row.pharmacist_award_level || 'PHARMACIST'}
                        onChange={e => handleInviteChangeLocum('pharmacist_award_level', e.target.value)}
                      >
                        {PHARMACIST_AWARD_LEVELS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {(row.role === 'ASSISTANT' || row.role === 'TECHNICIAN') && (
                      <TextField
                        select
                        fullWidth
                        label="Classification Level"
                        value={row.otherstaff_classification_level || 'LEVEL_1'}
                        onChange={e => handleInviteChangeLocum('otherstaff_classification_level', e.target.value)}
                      >
                        {OTHERSTAFF_CLASSIFICATIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {row.role === 'INTERN' && (
                      <TextField
                        select
                        fullWidth
                        label="Intern Half"
                        value={row.intern_half || 'FIRST_HALF'}
                        onChange={e => handleInviteChangeLocum('intern_half', e.target.value)}
                      >
                        {INTERN_HALVES.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {row.role === 'STUDENT' && (
                      <TextField
                        select
                        fullWidth
                        label="Student Year"
                        value={row.student_year || 'YEAR_1'}
                        onChange={e => handleInviteChangeLocum('student_year', e.target.value)}
                      >
                        {STUDENT_YEARS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {/* Employment Type — EXTERNAL options only */}
                    <TextField
                      select
                      label="Employment Type"
                      value={row.employment_type || ''}
                      onChange={e => handleInviteChangeLocum('employment_type', e.target.value)}
                      fullWidth
                    >
                      {EMPLOYMENT_TYPES_EXTERNAL.map(opt => (
                        <MenuItem key={opt} value={opt}>
                          {opt.replace('_', ' ')}
                        </MenuItem>
                      ))}
                    </TextField>

                    {locumInvites.length > 1 && (
                      <Box>
                        <Button color="secondary" onClick={() => setLocumInvites(v => v.filter((_, i) => i !== idx))}>
                          Remove
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}

              <Box mt={2} display="flex" alignItems="center">
                <Button
                  onClick={() =>
                    setLocumInvites(v => [
                      ...v,
                      {
                        email: '',
                        invited_name: '',
                        role: 'PHARMACIST',
                        employment_type: 'LOCUM',
                        pharmacist_award_level: 'PHARMACIST',
                      },
                    ])
                  }
                >
                  + Add Another
                </Button>
                <Button variant="contained" sx={{ ml: 'auto' }} onClick={handleSendInvites}>
                  Send Invitations
                </Button>
              </Box>
            </>
          )}

          {/* ADMIN */}
          {inviteMode === 'admin' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
              <TextField
                label="Full Name"
                value={adminInvite.invited_name || ''}
                onChange={e => setAdminInvite(i => ({ ...i, invited_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Email"
                value={adminInvite.email || ''}
                onChange={e => setAdminInvite(i => ({ ...i, email: e.target.value }))}
                fullWidth
              />
              <TextField label="Role" value="Admin" fullWidth disabled />
              <Box mt={1} display="flex">
                <Button variant="contained" sx={{ ml: 'auto' }} onClick={handleSendInvites}>
                  Send Invitation
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions><Button onClick={() => setOpenStaffDlg(false)}>Cancel</Button></DialogActions>


      </Dialog>


      <Dialog open={openLinkDlg} onClose={() => setOpenLinkDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generate Membership Link</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
            <TextField
              select
              label="Category"
              value={linkCategory}
              onChange={(e) => setLinkCategory(e.target.value as any)}
              fullWidth
            >
              <MenuItem value="FULL_PART_TIME">Full/Part-time</MenuItem>
              <MenuItem value="LOCUM_CASUAL">Favorite (Locum/Shift Hero)</MenuItem>

            </TextField>

            <TextField
              label="Expires In (days)"
              type="number"
              value={linkExpiryDays}
              onChange={(e) => setLinkExpiryDays(Number(e.target.value || 14))}
              fullWidth
              inputProps={{ min: 1, max: 90 }}
            />

            {generatedLinkUrl && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField fullWidth label="Shareable Link" value={generatedLinkUrl} InputProps={{ readOnly: true }} />
                <IconButton aria-label="copy" onClick={copyLinkToClipboard}><ContentCopyIcon /></IconButton>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLinkDlg(false)}>Close</Button>
          <Button variant="contained" onClick={handleCreateMagicLink}>
            {generatedLinkUrl ? 'Regenerate' : 'Create Link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} message={snackMsg} />
      <Box mt={4}>
        {loading ? ( Array.from(new Array(3)).map((_, index) => (<Skeleton key={index} variant="rectangular" height={150} sx={{ mb: 3, borderRadius: 2 }} />)) ) : pharmacies.length === 0 ? ( <Typography variant="h6">You have no pharmacies.</Typography> ) : ( paginatedPharmacies.map(p => (
            <Box key={p.id} sx={{ mb: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{p.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{`${p.street_address}, ${p.suburb}, ${p.state} ${p.postcode}`}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <IconButton onClick={() => openDialog(p)}><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(p.id)}><DeleteIcon /></IconButton>
                  </Box>
                </CardContent>
                              <Accordion sx={{ mt: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>{p.name} — Staff</Typography></AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650 }} aria-label="staff members table">
                      <TableHead>
                        <TableRow>
                          <TableCell>Member</TableCell><TableCell>Role</TableCell><TableCell>Type</TableCell><TableCell>Level</TableCell><TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(memberships[p.id] || []).map(m => { const classification = getMemberClassification(m); return (
                            <TableRow key={m.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                              <TableCell component="th" scope="row">
                                <Box sx={{ fontWeight: 'bold' }}>{m.user_details?.email}</Box>
                                {m.invited_name && (<Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{m.invited_name}</Box>)}
                              </TableCell>
                              <TableCell>{m.role}</TableCell>
                              <TableCell>{labelEmploymentType(m.employment_type)}</TableCell>
                              <TableCell>{classification || '—'}</TableCell>
                              <TableCell align="right"><IconButton edge="end" aria-label="delete member" onClick={() => apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.membershipDelete(m.id)}`).then(() => loadMembers(p.id))}><DeleteIcon /></IconButton></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
                <AccordionActions>
                  <Button onClick={() => handleOpenInviteDialog(p, 'internal')}>Invite Full/Part</Button>
                  <Button onClick={() => handleOpenInviteDialog(p, 'locum')}>Invite Favorite (Locum/Shift Hero)</Button>
                  <Button onClick={() => handleOpenInviteDialog(p, 'admin')}>Assign Admin</Button>
                  <Button onClick={() => handleOpenLinkDialog(p, 'FULL_PART_TIME')}>Generate Full/Part Link</Button>
                  <Button onClick={() => handleOpenLinkDialog(p, 'LOCUM_CASUAL')}>Generate Favorite Link</Button>
                </AccordionActions>

                <Accordion sx={{ mt: 1 }}>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    <Typography>{p.name} — Applications</Typography>
  </AccordionSummary>
  <AccordionDetails>
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="applications table">
        <TableHead>
          <TableRow>
            <TableCell>Applicant</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Submitted</TableCell>
            <TableCell>Approve As</TableCell>

            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(applications[p.id] || []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>

                No pending applications.
              </TableCell>
            </TableRow>
          ) : (
            (applications[p.id] || []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Box sx={{ fontWeight: 600 }}>
                    {a.first_name} {a.last_name}
                  </Box>
                  {a.email && (
                    <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {a.email}
                    </Box>
                  )}
                </TableCell>
                <TableCell>{a.role}</TableCell>
                <TableCell>{a.category === 'FULL_PART_TIME' ? 'Full/Part-time' : 'Favorite (Locum/Shift Hero)'}</TableCell>

                <TableCell>
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                </TableCell>

                <TableCell>
                  <FormControl fullWidth size="small">
                    <Select
                      value={
                        approveTypeById[a.id] ??
                        (a.category === 'FULL_PART_TIME' ? 'CASUAL' : 'LOCUM')
                      }
                      onChange={(e) =>
                        setApproveTypeById((prev) => ({ ...prev, [a.id]: String(e.target.value) }))
                      }
                    >
                      {getAllowedTypesForCategory(a.category).map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {labelEmploymentType(opt)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>

                <TableCell align="right">
                  <IconButton
                    aria-label="approve"
                    color="success"
                    onClick={() =>
                      approveApplication(
                        a.id,
                        p.id,
                        approveTypeById[a.id] ?? (a.category === 'FULL_PART_TIME' ? 'CASUAL' : 'LOCUM')
                      )
                    }
                  >

                    <DoneIcon />
                  </IconButton>
                  <IconButton aria-label="reject" color="error" onClick={() => rejectApplication(a.id, p.id)}>
                    <CloseIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </AccordionDetails>
</Accordion>

              </Accordion>
              </Card>

            </Box>
          ))
        )}
        {pharmacies.length > itemsPerPage && !loading && ( <Box display="flex" justifyContent="center" mt={2}><Pagination count={Math.ceil(pharmacies.length / itemsPerPage)} page={page} onChange={(_, val) => setPage(val)} /></Box>)}
      </Box>
    </Box>
  );
}