// src/pages/dashboard/sidebar/InvoiceGeneratePage.tsx
import { useState, useEffect, useCallback  } from 'react';
import {
  Container, Paper, Typography, Tabs, Tab,
  Box, TextField, MenuItem, Checkbox, FormControlLabel,
  Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, TableContainer
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';

interface ShiftSlot {
  id: number;
  date: string;               // "YYYY-MM-DD"
  start_time: string;         // "HH:MM:SS"
  end_time: string;           // "HH:MM:SS"
  is_recurring: boolean;
  recurring_days: number[];   // 0=Sun..6=Sat
  recurring_end_date: string | null; // "YYYY-MM-DD"
}

interface Shift {
  id: number;
  pharmacy_detail: { id: number; name: string; abn: string|null; address?:string };
  created_by_first_name?: string;
  created_by_last_name?:  string;
  created_by_email?:      string;
  fixed_rate: string;
  slots: ShiftSlot[];
}


interface LineItem {
  id: string;
  shiftSlotId?: number;
  date: string;        // "YYYY-MM-DD"
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

const CATEGORY_CHOICES = [
  { code: 'ProfessionalServices', label: 'Professional services' },
  { code: 'Superannuation', label: 'Superannuation' },
  { code: 'Transportation', label: 'Transportation' },
  { code: 'Accommodation', label: 'Accommodation' },
];
const UNIT_CHOICES = ['Hours', 'Item'];

export default function InvoiceGeneratePage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // --- Mode & Dates ---
    const [mode, setMode] = useState<'internal'|'external'>('internal');
    const today = new Date().toISOString().slice(0,10);
    const [invoiceDate, setInvoiceDate] = useState(today);
    const [dueDate, setDueDate]       = useState(today);

    // --- Shifts Fetch/Select ---
    const [shifts, setShifts]               = useState<Shift[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [shiftError, setShiftError]       = useState<string|null>(null);
    const [selectedShiftId, setSelectedShiftId] = useState<number|''>('');

    // ─── Issuer Details ──────────────────────────────────  
    const [issuerFirstName, setIssuerFirstName] = useState('');
    const [issuerLastName,  setIssuerLastName]  = useState('');
    const [issuerEmail,     setIssuerEmail]     = useState(user?.email     ?? '');
    const [issuerAbn,       setIssuerAbn]       = useState('');

    // ─── Recipient (Shift-Creator) & Pharmacy Snapshots ──  
    const [billToFirstName,        setBillToFirstName]        = useState('');
    const [billToLastName,         setBillToLastName]         = useState('');
    const [billToEmail,            setBillToEmail]            = useState('');
    const [billToAbn,              setBillToAbn]              = useState('');
    const [pharmacyNameSnapshot,   setPharmacyNameSnapshot]   = useState('');
    const [pharmacyAddressSnapshot,setPharmacyAddressSnapshot]= useState('');
    const [facilityAbn,            setFacilityAbn]            = useState('');

    // ─── External Bill-To (fallback for mode==='external') ─  
    const [externalName,    setExternalName]    = useState('');
    const [externalAddress, setExternalAddress] = useState('');

    // ─── GST / Super / Banking / CC …────────────────────  
    const [gstRegistered, setGstRegistered]       = useState(true);
    const [gstCertFile,  setGstCertFile]          = useState<File|null>(null);
    const [superRateSnapshot, setSuperRateSnapshot]     = useState(10);
    const [superFundName,     setSuperFundName]         = useState('');
    const [superUsi,          setSuperUsi]              = useState('');
    const [superMemberNumber, setSuperMemberNumber]     = useState('');
    const [bankAccountName,   setBankAccountName]       = useState('');
    const [bsb,               setBsb]                   = useState('');
    const [accountNumber,     setAccountNumber]         = useState('');
    const [ccEmails,          setCcEmails]              = useState('');

    // --- Line Items & Submit State ---
    const [lineItems, setLineItems]     = useState<LineItem[]>([]);
    const [submitting, setSubmitting]   = useState(false);
    const [submitError, setSubmitError] = useState<string|null>(null);

  
  // Helper: expand recurring slots just like your Python
  function expandRecurringSlots(slots: ShiftSlot[]): { date:string; start:string; end:string }[] {
    const entries: {date:string, start:string, end:string}[] = [];
    slots.forEach(slot => {
        if (slot.is_recurring && slot.recurring_end_date) {
        const startDate = new Date(slot.date);
        const endDate   = new Date(slot.recurring_end_date);
        for (
            let d = new Date(startDate);
            d <= endDate;
            d.setDate(d.getDate() + 1)
        ) {
            if (slot.recurring_days.includes(d.getDay())) {
            entries.push({
                date:  d.toISOString().slice(0,10),
                start: slot.start_time,
                end:   slot.end_time
            });
            }
        }
        } else {
        entries.push({
            date:  slot.date,
            start: slot.start_time,
            end:   slot.end_time
        });
        }
    });
    return entries;
  }

// ─── A) Load issuer details once on mount ─────────────
useEffect(() => {
  if (!user) return;
  apiClient
    .get(API_ENDPOINTS.onboardingDetail(user.role.toLowerCase()))
    .then(res => {
      setIssuerFirstName(res.data.first_name);
      setIssuerLastName(res.data.last_name);
      setIssuerAbn(res.data.abn ?? '');
    })
    .catch(() => {
      // handle error if needed
    });
}, [user]);

// ─── 1) Fetch shifts whenever we enter internal mode ────
useEffect(() => {
  if (mode !== 'internal') return;
  setLoadingShifts(true);

  apiClient.get<Shift[]>(API_ENDPOINTS.getMyHistoryShifts)
    .then(res => {
      setShifts(res.data);
      setShiftError(null);
    })
    .catch(() => {
      setShiftError('Failed to load shifts');
    })
    .finally(() => {
      setLoadingShifts(false);
    });
}, [mode]);

// ─── 2) Build line items AND snapshot pharmacy + recipient ───
useEffect(() => {
  // Only run in internal mode when a shift is selected, shifts are loaded, and we have a logged-in user
  if (mode !== 'internal' || !selectedShiftId || shifts.length === 0 || !user) {
    return;
  }

  // Find the selected shift
  const shift = shifts.find(s => s.id === selectedShiftId);
  if (!shift) return;

  // — Pharmacy snapshot —
  setPharmacyNameSnapshot(shift.pharmacy_detail.name);
  setPharmacyAddressSnapshot(shift.pharmacy_detail.address ?? '');
  setFacilityAbn(shift.pharmacy_detail.abn ?? '');

  // — Recipient (shift creator) snapshot via flat fields —
  setBillToFirstName(shift.created_by_first_name ?? '');
  setBillToLastName( shift.created_by_last_name  ?? '');
  setBillToEmail(    shift.created_by_email     ?? '');

  // — Fetch the recipient’s ABN if we have their email/role —
  const roleForOnboard = (shift as any).created_by_role?.toLowerCase() 
    ?? user.role.toLowerCase();
  if (shift.created_by_email) {
    apiClient
      .get(API_ENDPOINTS.onboardingDetail(roleForOnboard))
      .then(r => setBillToAbn(r.data.abn ?? ''))
      .catch(() => setBillToAbn(''));
  } else {
    setBillToAbn('');
  }

  // — Expand recurring slots & build serviceRows —
  const entries = expandRecurringSlots(shift.slots);
  const rate    = parseFloat(shift.fixed_rate);
  const serviceRows: LineItem[] = entries.map((e, idx) => {
    const start = new Date(`${e.date}T${e.start}`);
    const end   = new Date(`${e.date}T${e.end}`);
    const hours = parseFloat(
      ((end.getTime() - start.getTime()) / 3600000).toFixed(2)
    );
    return {
      id:          `${shift.id}-${idx}`,
      shiftSlotId: shift.id,
      date:        e.date,
      start_time:  e.start,
      end_time:    e.end,
      category:    'ProfessionalServices',
      unit:        'Hours',
      quantity:    hours,
      unit_price:  rate,
      discount:    0,
      total:       parseFloat((hours * rate).toFixed(2)),
    };
  });

  // — Preserve any manual extras (Transportation / Accommodation / etc) —
  const manualExtras = lineItems
    .filter(li => !li.shiftSlotId && li.category !== 'Superannuation')
    .map(item => {
      if (
        item.quantity === 0 &&
        ['Transportation', 'Accommodation'].includes(item.category)
      ) {
        const tot = parseFloat(
          (1 * item.unit_price * (1 - item.discount / 100)).toFixed(2)
        );
        return { ...item, quantity: 1, total: tot };
      }
      return item;
    });

  // — Final line items set —
  setLineItems([...serviceRows, ...manualExtras]);
}, [
  mode,
  selectedShiftId,
  shifts,
  user,      // guard to ensure user is non-null
]);


// ─── 3) Recompute Superannuation (unchanged) ─────────────
useEffect(() => {
  const serviceBase = lineItems
    .filter(li => li.category === 'ProfessionalServices')
    .reduce((sum, li) => sum + li.total, 0);

  const newSuper = parseFloat(((serviceBase * superRateSnapshot) / 100).toFixed(2));
  const existing = lineItems.find(li => li.category === 'Superannuation');
  if (existing && existing.total === newSuper) return;

  const withoutSuper = lineItems.filter(li => li.category !== 'Superannuation');
  const superLine: LineItem = {
    id:         'super',
    date:       today,
    start_time: '00:00:00',
    end_time:   '00:00:00',
    category:   'Superannuation',
    unit:       'Item',
    quantity:   1,
    unit_price: newSuper,
    discount:   0,
    total:      newSuper,
  };
  setLineItems([...withoutSuper, superLine]);
}, [lineItems, superRateSnapshot]);


  // Recalc & row ops
    const recalc = useCallback((li: LineItem) => 
    parseFloat((li.quantity * li.unit_price * (1-li.discount/100)).toFixed(2)),
    []);
    
  // FIX 3: Improved updateRow function to handle manual extras
  const updateRow = (
    idx: number,
    field: keyof Omit<LineItem,'total'>,
    value: any
  ) => {
    const c = [...lineItems];
    // @ts-ignore
    c[idx][field] = value;
    
    // Recalc hours if start/end changed
    if(field === 'start_time' || field === 'end_time'){
      const { date, start_time, end_time } = c[idx];
      const s = new Date(`${date}T${start_time}`);
      const e = new Date(`${date}T${end_time}`);
      c[idx].quantity = parseFloat(((e.getTime()-s.getTime())/3600000).toFixed(2));
    }
    
    // Set quantity to 1 for Transportation and Accommodation
    if (field === 'category' && ['Transportation', 'Accommodation'].includes(value)) {
      c[idx].quantity = 1;
    }
    
    c[idx].total = recalc(c[idx]);
    setLineItems(c);
  };
  
  // FIX 3: Improved addRow with better defaults
  const addRow = () => {
    setLineItems(items => [
      ...items,
      {
        id: `man-${Date.now()}`,
        date: today,
        start_time: '00:00:00',
        end_time: '00:00:00',
        category: '',
        unit: 'Item',
        quantity: 1, // Default to 1 for new rows
        unit_price: 0,
        discount: 0,
        total: 0,
      }
    ]);
  };
  
  const removeRow = (idx:number) =>
    setLineItems(items => { const c=[...items]; c.splice(idx,1); return c; });

  const subtotal = lineItems
    .filter(li => li.category !== 'Superannuation')
    .reduce((sum, li) => sum + li.total, 0);

  const transportation = lineItems
    .filter(li => li.category === 'Transportation')
    .reduce((sum, li) => sum + li.total, 0);

  const accommodation = lineItems
    .filter(li => li.category === 'Accommodation')
    .reduce((sum, li) => sum + li.total, 0);

  const gst = gstRegistered
    ? parseFloat(
        (
            lineItems
            .filter(li =>
                li.category !== 'Superannuation' &&
                li.category !== 'Transportation' &&
                li.category !== 'Accommodation'
            )
            .reduce((sum, li) => sum + li.total, 0)
            * 0.10
        ).toFixed(2)
        )
    : 0;


  const superAmount = lineItems.find(li => li.category === 'Superannuation')?.total || 0;

  // Grand total is correct, but we need to make sure transportation and accommodation
  // items have the right quantity and total values
  const grandTotal = parseFloat(
    (subtotal + gst + superAmount).toFixed(2)
  );

  // Submit via FormData to include the file
const handleGenerate = () => {
  const fd = new FormData();

  // Issuer snapshot
  fd.append('issuer_first_name',   issuerFirstName);
  fd.append('issuer_last_name',    issuerLastName);
  fd.append('issuer_email',        issuerEmail);
  fd.append('issuer_abn',          issuerAbn);

  // Core billing data
  fd.append('gst_registered',      String(gstRegistered));
  fd.append('super_rate_snapshot', superRateSnapshot.toString());
  if (gstCertFile) fd.append('gst_certificate', gstCertFile);
  fd.append('super_fund_name',     superFundName);
  fd.append('super_usi',           superUsi);
  fd.append('super_member_number', superMemberNumber);
  fd.append('bank_account_name',   bankAccountName);
  fd.append('bsb',                 bsb);
  fd.append('account_number',      accountNumber);
  fd.append('cc_emails',           ccEmails);

  // Invoice dates
  fd.append('invoice_date',        invoiceDate);
  fd.append('due_date',            dueDate);

  if (mode === 'internal') {
    // Link to pharmacy + snapshot
    fd.append('pharmacy',                  String(selectedShiftId));
    fd.append('shift_ids',                 JSON.stringify([selectedShiftId]));
    fd.append('pharmacy_name_snapshot',    pharmacyNameSnapshot);
    fd.append('pharmacy_address_snapshot', pharmacyAddressSnapshot);
    fd.append('pharmacy_abn_snapshot',     facilityAbn);

    // Recipient snapshot (shift creator)
    fd.append('bill_to_first_name',        billToFirstName);
    fd.append('bill_to_last_name',         billToLastName);
    fd.append('bill_to_email',             billToEmail);
    fd.append('bill_to_abn',               billToAbn);
  } else {
    // External: free‐form bill-to
    fd.append('external',                  'true');
    fd.append('custom_bill_to_name',       externalName);
    fd.append('custom_bill_to_address',    externalAddress);

    // And let user overwrite billToEmail if they wish
    fd.append('bill_to_email',             billToEmail);
  }

  // Finally the line items
  fd.append('line_items', JSON.stringify(
    lineItems.map(li => ({
      description:      `${li.date} ${li.start_time.slice(0,5)}–${li.end_time.slice(0,5)}`,
      category_code:    li.category,
      unit:             li.unit,
      quantity:         li.quantity,
      unit_price:       li.unit_price,
      discount:         li.discount,
      total:            li.total,
    }))
  ));

  setSubmitting(true);
  apiClient.post(API_ENDPOINTS.generateInvoice, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  .then(() => navigate('/dashboard/pharmacist/invoice'))
  .catch(ex => setSubmitError(ex.response?.data?.error || 'Server error'))
  .finally(() => setSubmitting(false));
};


  return (
    <Container maxWidth="lg">
      <Paper sx={{ p:4, mt:4 }}>
        <Typography variant="h5">Generate Invoice</Typography>

        {/* Mode */}
        <Tabs
            value={mode}
            onChange={(_, newMode) => {
                setMode(newMode);
                if (newMode === 'external') {
                setLineItems([]);
                setIssuerAbn('');
                }
            }}
            >
          <Tab label="Internal" value="internal"/>
          <Tab label="External" value="external"/>
        </Tabs>

        {/* Dates */}
        <Box mt={5} display="flex" gap={2}>
          <TextField
            label="Invoice Date"
            type="date"
            value={invoiceDate}
            onChange={e=>setInvoiceDate(e.target.value)}
            InputLabelProps={{ shrink:true }}
          />
          <TextField
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={e=>setDueDate(e.target.value)}
            InputLabelProps={{ shrink:true }}
          />
        </Box>

        {/* Shift selector */}
        {mode==='internal' && (
          <Box mt={3}>
            {loadingShifts
              ? <Typography>Loading shifts…</Typography>
              : shiftError
                ? <Typography color="error">{shiftError}</Typography>
                : (
                  <TextField
                    select fullWidth label="Select Shift"
                    value={selectedShiftId}
                    onChange={e=>setSelectedShiftId(Number(e.target.value))}
                  >
                    <MenuItem value="">-- Choose Shift --</MenuItem>
                    {shifts.map(s=>(
                      <MenuItem key={s.id} value={s.id}>
                        {s.pharmacy_detail.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
          </Box>
        )}

        {/* Line Items */}
        <Box mt={3}>
        <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="medium" padding="checkbox" stickyHeader >
            <TableHead>
                <TableRow>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '20%' }}>Category</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '10%' }}>Date</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '10%' }}>Start</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '8%' }}>End</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '5%' }}>Hours</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '5%' }}>Unit</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '20%' }}>Price</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '5%' }}>Discount</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '10%' }}>Amount</TableCell>
                <TableCell align="center" sx={{ tableLayout: 'fixed', width: '100%' }}></TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {lineItems.map((li, idx) => (
                <TableRow key={li.id}>
                    {/* Category */}
                    <TableCell align="center">
                    <TextField
                        select size="medium" fullWidth
                        value={li.category}
                        onChange={e => updateRow(idx, 'category', e.target.value)}
                    >
                        {CATEGORY_CHOICES.map(c => (
                        <MenuItem key={c.code} value={c.code}>
                            {c.label}
                        </MenuItem>
                        ))}
                    </TextField>
                    </TableCell>

                    {/* Only show Date/Start/End for Professional services */}
                    {li.category === 'ProfessionalServices' ? (
                    <>
                        <TableCell align="center">
                        <TextField
                            size="small" type="date" fullWidth
                            value={li.date}
                            onChange={e => updateRow(idx, 'date', e.target.value)}
                        />
                        </TableCell>
                        <TableCell align="center">
                        <TextField
                            size="small" type="time"
                            value={li.start_time || '00:00'}
                            onChange={e => {
                                const raw = e.target.value;
                                const newVal = raw ? raw + ':00' : '00:00:00';
                                updateRow(idx, 'start_time', newVal);
                                }}

                        />
                        </TableCell>
                        <TableCell align="center">
                        <TextField
                            size="small" type="time"
                            value={li.end_time || '00:00'}

                            onChange={e => {
                                const raw = e.target.value;
                                const newVal = raw ? raw + ':00' : '00:00:00';
                                updateRow(idx, 'end_time', newVal);
                                }}
                        />
                        </TableCell>
                    {/* Only show Hours for Professional services */}
                    <TableCell align="center">
                        {li.quantity.toFixed(2)}
                    </TableCell>
                    </>
                    ) : (
                    <>
                        <TableCell align="center" />
                        <TableCell align="center" />
                        <TableCell align="center" />
                    {/* hide Hours for non-professional */}
                    {/* FIX 2: For Transportation/Accommodation, show a hidden quantity of 1 */}
                    <TableCell align="center">
                        {['Transportation', 'Accommodation'].includes(li.category) ? '1.00' : ''}
                    </TableCell>
                    </>
                    )}

                    {/* Unit */}
                    <TableCell align="center">
                    <TextField
                        select size="small" fullWidth
                        value={li.unit}
                        onChange={e => updateRow(idx, 'unit', e.target.value)}
                    >
                        {UNIT_CHOICES.map(u => (
                        <MenuItem key={u} value={u}>{u}</MenuItem>
                        ))}
                    </TextField>
                    </TableCell>

                    {/* Price */}
                    <TableCell align="center">
                    <TextField
                        size="small" type="number" inputProps={{ step: 0.01, min: 0 }}
                        value={li.unit_price}
                        onChange={e => updateRow(idx, 'unit_price', +e.target.value)}
                        disabled={!!li.shiftSlotId || li.category === 'Superannuation'}

                    />
                    </TableCell>

                    {/* Discount */}
                    <TableCell align="center">
                    <TextField
                        size="small" type="number" inputProps={{ min: 0, max: 100 }}
                        value={li.discount}
                        onChange={e => updateRow(idx, 'discount', +e.target.value)}
                    />
                    </TableCell>

                    {/* Amount */}
                    <TableCell align="center">
                    {li.total.toFixed(2)}
                    </TableCell>

                    {/* Delete */}
                    <TableCell align="center">
                    <IconButton onClick={() => removeRow(idx)} size="small">
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </TableContainer>

        <Box mt={1}>
            <Button startIcon={<AddIcon />} onClick={addRow} size="small">
            Add Line Item
            </Button>
        </Box>
        </Box>

        {/* Totals & Submit */}
        <Box mt={4} textAlign="right">
        <Typography>Subtotal: ${subtotal.toFixed(2)}</Typography>
        <Typography>Transportation: ${transportation.toFixed(2)}</Typography>
        <Typography>Accommodation: ${accommodation.toFixed(2)}</Typography>
        <Typography>GST (10%): ${gst.toFixed(2)}</Typography>
        <Typography>Super ({superRateSnapshot}%): ${superAmount.toFixed(2)}</Typography>
        <Typography variant="h6">Grand Total: ${grandTotal.toFixed(2)}</Typography>
        </Box>

<Container maxWidth="md">
  <Paper sx={{ p: 4, mt: 4 }}>

    {/* ─── 1. Billing-To (Recipient) Details ─────────────────────────── */}
    <Typography variant="h6" gutterBottom>Billing-To Details</Typography>
{/* 1. Billing-To (Recipient) / Facility */}
<Box display="flex" gap={2} flexWrap="wrap" mb={4}>
  {/* Facility snapshot */}
  {mode==='internal' && <>
    <Box flex="1 1 30%">
      <TextField label="Facility Name" value={pharmacyNameSnapshot} InputProps={{readOnly:true}} fullWidth/>
    </Box>
    <Box flex="1 1 15%">
      <TextField label="Facility ABN"  value={facilityAbn}            InputProps={{readOnly:true}} fullWidth/>
    </Box>
    <Box flex="1 1 45%">
      <TextField label="Facility Address" value={pharmacyAddressSnapshot} InputProps={{readOnly:true}} fullWidth/>
    </Box>
  </>}

  {/* Recipient snapshot */}
  {mode==='internal' && <>
    <Box flex="1 1 30%">
      <TextField label="Bill-To Name"  value={`${billToFirstName} ${billToLastName}`} InputProps={{readOnly:true}} fullWidth/>
    </Box>
    <Box flex="1 1 30%">
      <TextField label="Bill-To Email" value={billToEmail}  InputProps={{readOnly:true}} fullWidth/>
    </Box>
    <Box flex="1 1 20%">
      <TextField label="Bill-To ABN"   value={billToAbn}    InputProps={{readOnly:true}} fullWidth/>
    </Box>
  </>}

  {/* External fallback */}
  {mode==='external' && <>
    <Box flex="1 1 45%">
      <TextField label="Bill-To Name" value={externalName} onChange={e=>setExternalName(e.target.value)} fullWidth/>
    </Box>
    <Box flex="1 1 45%">
      <TextField label="Bill-To Address" value={externalAddress} onChange={e=>setExternalAddress(e.target.value)} fullWidth/>
    </Box>
    <Box flex="1 1 45%">
      <TextField label="Bill-To Email" value={billToEmail} onChange={e=>setBillToEmail(e.target.value)} fullWidth/>
    </Box>
    <Box flex="1 1 45%">
      <TextField label="Bill-To ABN"   value={billToAbn} onChange={e=>setBillToAbn(e.target.value)} fullWidth/>
    </Box>
  </>}

  {/* CC Emails */}
  <Box flex="1 1 45%">
    <TextField label="CC Emails" helperText="Comma-separated" value={ccEmails} onChange={e=>setCcEmails(e.target.value)} fullWidth/>
  </Box>
</Box>

{/* 2. Issuer summary on left */}
<Box display="flex" justifyContent="flex-start" mb={4}>
  <Box>
    <Typography variant="subtitle1">Issuer</Typography>
    <Typography>{issuerFirstName} {issuerLastName}</Typography>
    <Typography variant="body2">ABN: {issuerAbn}</Typography>
  </Box>
</Box>


    {/* ─── 3. GST & Certificate ─────────────────────────────────────── */}
    <Typography variant="h6" gutterBottom>GST Information</Typography>
    <Box display="flex" gap={2} alignItems="center" mb={4}>
      <FormControlLabel
        control={
          <Checkbox
            checked={gstRegistered}
            onChange={e => setGstRegistered(e.target.checked)}
          />
        }
        label="GST Registered"
      />
      <Box>
        <Typography variant="body2" gutterBottom>GST Certificate</Typography>
        <input
          type="file"
          accept=".pdf,.jpg,.png"
          onChange={e => setGstCertFile(e.target.files?.[0] ?? null)}
        />
      </Box>
    </Box>

    {/* ─── 4. Superannuation Details ───────────────────────────────── */}
    <Typography variant="h6" gutterBottom>Superannuation</Typography>
    <Box display="flex" gap={2} flexWrap="wrap" mb={4}>
      <Box sx={{ flex: '1 1 20%' }}>
        <TextField
          fullWidth
          label="Super Rate (%)"
          type="number"
          value={superRateSnapshot}
          onChange={e => setSuperRateSnapshot(+e.target.value)}
        />
      </Box>
      <Box sx={{ flex: '1 1 40%' }}>
        <TextField
          fullWidth
          label="Super Fund Name"
          value={superFundName}
          onChange={e => setSuperFundName(e.target.value)}
        />
      </Box>
      <Box sx={{ flex: '1 1 20%' }}>
        <TextField
          fullWidth
          label="Super USI"
          value={superUsi}
          onChange={e => setSuperUsi(e.target.value)}
        />
      </Box>
      <Box sx={{ flex: '1 1 20%' }}>
        <TextField
          fullWidth
          label="Member #"
          value={superMemberNumber}
          onChange={e => setSuperMemberNumber(e.target.value)}
        />
      </Box>
    </Box>

    {/* ─── 5. Banking Details ──────────────────────────────────────── */}
    <Typography variant="h6" gutterBottom>Banking Details</Typography>
    <Box display="flex" gap={2} flexWrap="wrap" mb={4}>
      <Box sx={{ flex: '1 1 45%' }}>
        <TextField
          fullWidth
          label="Account Name"
          value={bankAccountName}
          onChange={e => setBankAccountName(e.target.value)}
        />
      </Box>
      <Box sx={{ flex: '1 1 25%' }}>
        <TextField
          fullWidth
          label="BSB"
          value={bsb}
          onChange={e => setBsb(e.target.value)}
        />
      </Box>
      <Box sx={{ flex: '1 1 25%' }}>
        <TextField
          fullWidth
          label="Account Number"
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value)}
        />
      </Box>
    </Box>

    {/* …your line-items table and Generate button here… */}

  </Paper>
</Container>




        {submitError && (
          <Typography color="error" mt={1}>{submitError}</Typography>
        )}
        <Box mt={2} textAlign="right">
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={
              submitting ||
              (mode==='internal' && !selectedShiftId) ||
              lineItems.length===0
            }
          >
            {submitting ? 'Generating…' : 'Generate Invoice'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}