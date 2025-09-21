// src/pages/dashboard/sidebar/PostShiftPage.tsx

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Snackbar,
  IconButton,
  Typography,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from '@mui/icons-material/InfoOutlined';

import { Close as CloseIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface Pharmacy {
  id: number;
  name: string;
  has_chain: boolean;
  claimed: boolean;
}

interface SlotEntry {
  date: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurringDays: number[];
  recurringEndDate: string;
}

const ESCALATION_LABELS: Record<string, string> = {
  LOCUM_CASUAL: 'Favourite Staff (Locum/Casual)',
  OWNER_CHAIN: 'Owner Chain',
  ORG_CHAIN: 'Organization Chain',
  PLATFORM: 'Platform',
};



export default function PostShiftPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const editingShiftId = params.get('edit');

  // — Load pharmacies —
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  useEffect(() => {
    apiClient
      .get(API_ENDPOINTS.pharmacies) // We expect a paginated object or an array
      .then(res => {
        // FIX: Check if the response is paginated and extract the 'results' array.
        // If not, assume the data itself is the array.
        const pharmacyData = Array.isArray(res.data.results) ? res.data.results : res.data;
        setPharmacies(pharmacyData);
      })
      .catch(() => showSnackbar('Failed to load pharmacies'));
  }, []);


  // — Form state —
  const [pharmacyId, setPharmacyId] = useState<number | ''>('');
  const [allowedVis, setAllowedVis] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string>('');
  const [escalationDates, setEscalationDates] = useState<Record<string, string>>({
    LOCUM_CASUAL: '',
    OWNER_CHAIN: '',
    ORG_CHAIN: '',
    PLATFORM: '',
  });

  useEffect(() => {
     if (pharmacies.length === 1 && !editingShiftId && !pharmacyId) {
       setPharmacyId(pharmacies[0].id);
     }
   }, [pharmacies, editingShiftId, pharmacyId]);

  // compute allowedVis & default visibility only when pharmacyId or user.role changes
  useEffect(() => {
    if (!pharmacyId) {
      setAllowedVis([]);
      setVisibility('');
      return;
    }
    const p = pharmacies.find(x => x.id === pharmacyId);
    if (!p) return;

    let allowed: string[];
    if (user.role === 'ORG_ADMIN') {
      allowed = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'];
    } else {
      if (!p.has_chain && !p.claimed) {
        allowed = ['PLATFORM'];
      } else if (p.has_chain && !p.claimed) {
        allowed = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'PLATFORM'];
      } else if (!p.has_chain && p.claimed) {
        allowed = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'ORG_CHAIN', 'PLATFORM'];
      } else {
        allowed = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'];
      }
    }
    setAllowedVis(allowed);
    setVisibility(prev => (allowed.includes(prev) ? prev : allowed[0]));
    setEscalationDates({
      LOCUM_CASUAL: '',
      OWNER_CHAIN: '',
      ORG_CHAIN: '',
      PLATFORM: '',
    });
  }, [pharmacyId, pharmacies, user.role]);

  // At the top of your component:
  const [shiftPrefill, setShiftPrefill] = useState<any>(null);

  useEffect(() => {
    if (!editingShiftId) return;
    apiClient
      .get(`${API_ENDPOINTS.getActiveShifts}${editingShiftId}/`)
      .then(res => setShiftPrefill(res.data))
      .catch(() => showSnackbar('Failed to load shift for editing'));
  }, [editingShiftId]);

  useEffect(() => {
    if (!shiftPrefill || pharmacies.length === 0) return;

    // --- Pre-fill all fields ---
    setPharmacyId(shiftPrefill.pharmacy); // For your <Select>
    setRoleNeeded(shiftPrefill.role_needed);
    setDescription(shiftPrefill.description || ''); 
    setEmploymentType(shiftPrefill.employment_type);
    setVisibility(shiftPrefill.visibility);

    setWorkloadTags(shiftPrefill.workload_tags || []);
    setMustHave(shiftPrefill.must_have || []);
    setNiceToHave(shiftPrefill.nice_to_have || []);
    setRateType(shiftPrefill.rate_type || '');
    setFixedRate(shiftPrefill.fixed_rate || '');
    setOwnerAdjustedRate(shiftPrefill.owner_adjusted_rate || '');
    setSingleUserOnly(!!shiftPrefill.single_user_only);

    setEscalationDates({
      LOCUM_CASUAL: shiftPrefill.escalate_to_locum_casual || '',
      OWNER_CHAIN:  shiftPrefill.escalate_to_owner_chain || '',
      ORG_CHAIN:    shiftPrefill.escalate_to_org_chain || '',
      PLATFORM:     shiftPrefill.escalate_to_platform || '',
    });

    setSlots(
      (shiftPrefill.slots || []).map((s: any) => ({
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        isRecurring: s.is_recurring,
        recurringDays: s.recurring_days || [],
        recurringEndDate: s.recurring_end_date || '',
      }))
    );

    // --- Clear buffer to avoid looping ---
    setShiftPrefill(null);
  }, [shiftPrefill, pharmacies]);


  // — Other form fields —
  const [roleNeeded, setRoleNeeded] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [employmentType, setEmploymentType] = useState<string>('LOCUM');
  const workloadOptions = ['Sole Pharmacist', 'High Script Load', 'Webster Packs'];
  const [workloadTags, setWorkloadTags] = useState<string[]>([]);
  const toggleWorkloadTag = (tag: string) =>
    setWorkloadTags(w =>
      w.includes(tag) ? w.filter(x => x !== tag) : [...w, tag]
    );

  const skillOptions = [
    'Vaccination', 'Methadone', 'CPR', 'First Aid',
    'Anaphylaxis', 'Credentialed Badge', 'PDL Insurance',
  ];
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [niceToHave, setNiceToHave] = useState<string[]>([]);
  const toggleMustHave = (s: string) =>
    setMustHave(m => (m.includes(s) ? m.filter(x => x !== s) : [...m, s]));
  const toggleNiceToHave = (s: string) =>
    setNiceToHave(n => (n.includes(s) ? n.filter(x => x !== s) : [...n, s]));

  const [rateType, setRateType] = useState<string>('');
  const [fixedRate, setFixedRate] = useState<string>('');
  const [ownerAdjustedRate, setOwnerAdjustedRate] = useState('');

  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotStartTime, setSlotStartTime] = useState<string>('09:00');
  const [slotEndTime, setSlotEndTime] = useState<string>('17:00');
  const [slotIsRecurring, setSlotIsRecurring] = useState<boolean>(false);
  const [slotRecurringDays, setSlotRecurringDays] = useState<number[]>([]);
  const [slotRecurringEndDate, setSlotRecurringEndDate] = useState<string>('');
  const weekDays = [
    { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ];

  // — Single-user toggle & submitting flag —
  const [submitting, setSubmitting] = useState(false);
  const [singleUserOnly, setSingleUserOnly] = useState(false);

  // — Snackbar —
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const showSnackbar = (msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  };
  const closeSnackbar = () => setSnackbarOpen(false);

  // — Tabs setup —
  const tabs = [
    { key: 'details', label: 'Details' },
    ...(allowedVis.length > 1 ? [{ key: 'visibility', label: 'Visibility' }] : []),
    { key: 'required', label: 'Required Skills' },
    { key: 'nice', label: 'Nice to Have' },
    { key: 'rate', label: 'Rate' },
    { key: 'slots', label: 'Slots' },
  ];
  const [activeTab, setActiveTab] = useState(0);
  const currentKey = tabs[activeTab].key;
  const goNext = () => setActiveTab(i => Math.min(i + 1, tabs.length - 1));
  const goBack = () => setActiveTab(i => Math.max(i - 1, 0));

  // — Add slot —
  const handleAddSlot = () => {
    if (!slotDate) return showSnackbar('Please select slot date');
    if (new Date(`1970-01-01T${slotEndTime}`) <= new Date(`1970-01-01T${slotStartTime}`))
      return showSnackbar('End must follow start');
    if (slotIsRecurring && (!slotRecurringEndDate || !slotRecurringDays.length))
      return showSnackbar('Configure recurrence completely');

    setSlots(s => [
      ...s,
      {
        date: slotDate,
        startTime: slotStartTime,
        endTime: slotEndTime,
        isRecurring: slotIsRecurring,
        recurringDays: slotIsRecurring ? slotRecurringDays : [],
        recurringEndDate: slotIsRecurring ? slotRecurringEndDate : '',
      },
    ]);
    setSlotDate(''); setSlotStartTime('09:00'); setSlotEndTime('17:00');
    setSlotIsRecurring(false); setSlotRecurringDays([]); setSlotRecurringEndDate('');
  };

  // — Submit —
  const handleSubmit = async () => {
    if (!pharmacyId || !roleNeeded || !employmentType) {
      return showSnackbar('Fill all required fields');
    }
    const startIdx = allowedVis.indexOf(visibility);
    if (startIdx === -1) return showSnackbar('Select a valid visibility');
    const nextTiers = allowedVis.slice(startIdx + 1);

    // Validate escalation dates for all next tiers
    for (const tier of nextTiers) {
      if (!escalationDates[tier]) {
        return showSnackbar(`Enter date → ${ESCALATION_LABELS[tier] || tier}`);
      }
    }
    if (
      roleNeeded === 'PHARMACIST' &&
      (!rateType || (rateType === 'FIXED' && !fixedRate))
    ) {
      return showSnackbar('Select rate type & fixed rate if FIXED');
    }
    if (!slots.length) return showSnackbar('Add at least one slot');

    setSubmitting(true);

    // Prepare the payload as before
    const payload = {
      pharmacy: pharmacyId,
      role_needed: roleNeeded,
      description: description, 
      employment_type: employmentType,
      visibility,
      escalate_to_locum_casual: escalationDates['LOCUM_CASUAL'] || null,
      escalate_to_owner_chain:  escalationDates['OWNER_CHAIN'] || null,
      escalate_to_org_chain:    escalationDates['ORG_CHAIN'] || null,
      escalate_to_platform:     escalationDates['PLATFORM'] || null,
      workload_tags: workloadTags,
      must_have:     mustHave,
      nice_to_have:  niceToHave,
      rate_type:     roleNeeded === 'PHARMACIST' ? rateType : null,
      fixed_rate:    roleNeeded === 'PHARMACIST' && rateType === 'FIXED' ? fixedRate : null,
      owner_adjusted_rate: roleNeeded !== 'PHARMACIST' && ownerAdjustedRate ? Number(ownerAdjustedRate) : null,
      single_user_only: singleUserOnly,
      slots: slots.map(s => ({
        date: s.date,
        start_time: s.startTime,
        end_time: s.endTime,
        is_recurring: s.isRecurring,
        recurring_days: s.recurringDays,
        recurring_end_date: s.recurringEndDate || null,
      })),
    };

    try {
      if (editingShiftId) {
        // PATCH (edit) if editingShiftId exists
        await apiClient.patch(`${API_ENDPOINTS.getActiveShifts}${editingShiftId}/`, payload);
        showSnackbar('Shift updated successfully');
      } else {
        // POST (create)
        await apiClient.post(API_ENDPOINTS.getActiveShifts, payload);
        showSnackbar('Shift created successfully');
      }
      setTimeout(() => navigate('../shifts/active'), 500);
    } catch {
      showSnackbar(editingShiftId ? 'Failed to update shift' : 'Failed to create shift');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} centered>
          {tabs.map(t => <Tab key={t.key} label={t.label} />)}
        </Tabs>

        <Box sx={{ mt: 2 }}>
        {currentKey === 'details' && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Pharmacy</InputLabel>
                <Select
                  value={pharmacyId}
                  label="Pharmacy"
                  onChange={e => setPharmacyId(Number(e.target.value))}
                >
                  {pharmacies.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Employment Type</InputLabel>
                <Select
                  value={employmentType}
                  label="Employment Type"
                  onChange={e => setEmploymentType(e.target.value)}
                >
                  <MenuItem value="LOCUM">Locum</MenuItem>
                  <MenuItem value="FULL_TIME">Full-Time</MenuItem>
                  <MenuItem value="PART_TIME">Part-Time</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Role Needed</InputLabel>
                <Select
                  value={roleNeeded}
                  label="Role Needed"
                  onChange={e => setRoleNeeded(e.target.value)}
                >
                  <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
                  <MenuItem value="TECHNICIAN">Dispensary Technician</MenuItem>
                  <MenuItem value="ASSISTANT">Assistant</MenuItem>
                  <MenuItem value="INTERN">Intern Pharmacist</MenuItem>
                  <MenuItem value="STUDENT">Pharmacy Student</MenuItem>
                  <MenuItem value="EXPLORER">Explorer</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Shift Description"
                multiline
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                fullWidth
                placeholder="Provide a plain English description of the shift, including any key responsibilities or context for the worker."
              />

              <Typography variant="subtitle1">Workload Tags</Typography>
              <Box sx={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
                {workloadOptions.map(opt => (
                  <FormControlLabel
                    key={opt}
                    control={<Checkbox
                      checked={workloadTags.includes(opt)}
                      onChange={() => toggleWorkloadTag(opt)}
                    />}
                    label={opt}
                  />
                ))}
              </Box>
            </Box>
          )}
          {currentKey === 'visibility' && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={visibility}
                  label="Visibility"
                  onChange={e => setVisibility(e.target.value)}
                >
                  {allowedVis.map(opt => (
                    <MenuItem key={opt} value={opt}>
                      { {
                            FULL_PART_TIME: 'Pharmacy Members (Full/Part Time)',
                            LOCUM_CASUAL:   'Favourite Staff (Locum/Casual)',
                            OWNER_CHAIN:    'Owner Chain',
                            ORG_CHAIN:      'Organization Chain',
                            PLATFORM:       'Platform (Public)',
                      }[opt] }
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Render all escalation pickers after the chosen visibility */}
              {allowedVis.slice(allowedVis.indexOf(visibility) + 1).map(tier => (
                <TextField
                  key={tier}
                  label={`Escalate → ${ESCALATION_LABELS[tier] ?? tier}`}
                  type="datetime-local"
                  value={escalationDates[tier] || ''}
                  onChange={e => setEscalationDates(d => ({ ...d, [tier]: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              ))}


            </Box>
          )}

          {currentKey === 'required' && (
            <Box sx={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
              {skillOptions.map(s => (
                <FormControlLabel
                  key={s}
                  control={<Checkbox checked={mustHave.includes(s)} onChange={() => toggleMustHave(s)} />}
                  label={s}
                />
              ))}
            </Box>
          )}

          {currentKey === 'nice' && (
            <Box sx={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
              {skillOptions.map(s => (
                <FormControlLabel
                  key={s}
                  control={<Checkbox checked={niceToHave.includes(s)} onChange={() => toggleNiceToHave(s)} />}
                  label={s}
                />
              ))}
            </Box>
          )}

          {currentKey === 'rate' && (
            <Box sx={{ display:'grid', gap:2 }}>
              {roleNeeded === 'PHARMACIST' ? (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Rate Type</InputLabel>
                    <Select
                      value={rateType}
                      label="Rate Type"
                      onChange={e => setRateType(e.target.value)}
                    >
                      <MenuItem value="FIXED">Fixed</MenuItem>
                      <MenuItem value="FLEXIBLE">Flexible</MenuItem>
                      <MenuItem value="PHARMACIST_PROVIDED">Pharmacist Provided</MenuItem>
                    </Select>
                  </FormControl>
                  {rateType === 'FIXED' && (
                    <TextField
                      label="Fixed Rate"
                      type="number"
                      value={fixedRate}
                      onChange={e => setFixedRate(e.target.value)}
                      fullWidth
                    />
                  )}
                </>
              ) : (
                  <Box>
                    <Typography align="center" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                      Rate set by government award
                      <Tooltip title="Click to view pay guide PDF from Fair Work Commission" arrow>
                        <a
                          href="https://portal.fairwork.gov.au/ArticleDocuments/872/pharmacy-industry-award-ma000012-pay-guide.pdf.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <InfoIcon fontSize="small" color="action" />
                        </a>
                      </Tooltip>
                    </Typography>

                    <TextField
                      label="Owner Bonus (AUD$/hr, optional)"
                      type="number"
                      value={ownerAdjustedRate}
                      onChange={e => setOwnerAdjustedRate(e.target.value)}
                      fullWidth
                      sx={{ mt: 2 }}
                      helperText="This bonus will be added to the award rate"
                    />
                  </Box>
              )}
            </Box>
          )}

          {currentKey === 'slots' && (
            <Box sx={{ display:'grid', gap:2 }}>
              {/* single-user-only toggle */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={singleUserOnly}
                    onChange={e => setSingleUserOnly(e.target.checked)}
                  />
                }
                label="Require single user for entire shift"
              />
              <Typography variant="h6">Add a Time Slot</Typography>
              <TextField
                label="Date" type="date"
                value={slotDate}
                onChange={e => setSlotDate(e.target.value)}
                InputLabelProps={{ shrink:true }}
                fullWidth
              />
              <Box sx={{ display:'flex', gap:2 }}>
                <TextField
                  label="Start Time" type="time"
                  value={slotStartTime}
                  onChange={e => setSlotStartTime(e.target.value)}
                  InputLabelProps={{ shrink:true }}
                  sx={{ flex:1 }}
                />
                <TextField
                  label="End Time" type="time"
                  value={slotEndTime}
                  onChange={e => setSlotEndTime(e.target.value)}
                  InputLabelProps={{ shrink:true }}
                  sx={{ flex:1 }}
                />
              </Box>
              <FormControlLabel
                control={<Checkbox
                  checked={slotIsRecurring}
                  onChange={e => {
                    setSlotIsRecurring(e.target.checked);
                    if (!e.target.checked) {
                      setSlotRecurringDays([]);
                      setSlotRecurringEndDate('');
                    }
                  }}
                />}
                label="Repeat Weekly"
              />
              {slotIsRecurring && (
                <>
                  <TextField
                    label="Repeat Until" type="date"
                    value={slotRecurringEndDate}
                    onChange={e => setSlotRecurringEndDate(e.target.value)}
                    InputLabelProps={{ shrink:true }}
                    fullWidth
                  />
                  <Box sx={{ display:'flex', flexWrap:'wrap', gap:1 }}>
                    {weekDays.map(d => (
                      <FormControlLabel
                        key={d.value}
                        control={<Checkbox
                          checked={slotRecurringDays.includes(d.value)}
                          onChange={() =>
                            setSlotRecurringDays(days =>
                              days.includes(d.value)
                                ? days.filter(x => x !== d.value)
                                : [...days, d.value]
                            )
                          }
                        />}
                        label={d.label}
                      />
                    ))}
                  </Box>
                </>
              )}
              <Button variant="outlined" onClick={handleAddSlot}>Add Slot</Button>
              {slots.map((s, i) => (
                <Paper key={i} sx={{ p:2, mt:1 }}>
                  <Typography>
                    {s.date} — {s.startTime}–{s.endTime}
                  </Typography>
                  {s.isRecurring && (
                    <Typography variant="caption">
                      Repeats {s.recurringDays.map(d => weekDays.find(w => w.value===d)?.label).join(', ')} until {s.recurringEndDate}
                    </Typography>
                  )}
                  <Button color="error" size="small" onClick={() => setSlots(slots.filter((_, idx) => idx!==i))}>
                    Delete
                  </Button>
                </Paper>
              ))}
            </Box>
          )}

          {/* Footer */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={goBack} disabled={activeTab === 0}>Back</Button>
            {activeTab < tabs.length - 1 ? (
              <Button onClick={goNext}>Next</Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting || !pharmacyId || !roleNeeded || slots.length === 0}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <Snackbar
        open={snackbarOpen}
        onClose={closeSnackbar}
        message={snackbarMsg}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        action={
          <IconButton size="small" color="inherit" onClick={closeSnackbar}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />

    </Container>
  );
}
