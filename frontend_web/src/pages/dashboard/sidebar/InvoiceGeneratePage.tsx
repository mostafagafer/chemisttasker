// src/pages/dashboard/sidebar/InvoiceGeneratePage.tsx
import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Button, FormLabel,
  RadioGroup, FormControlLabel, Radio,
  FormControl, InputLabel, Select, MenuItem,
  TextField, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Checkbox,
  Collapse, Snackbar, Stack
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

// --- Types ---
interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  recurring_days: number[];
  recurring_end_date: string | null;
}
interface Shift {
  id: number;
  role_needed: string;
  fixed_rate: number;
  pharmacy_detail: {
    id: number;
    name: string;
    address: string;
    abn: string;
  };
  slots: Slot[];
}
interface LineItem {
  id?: number;
  category_code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  gst_applicable: boolean;
  super_applicable: boolean;
  is_manual: boolean;
  parentIndex?: number;          // for grouping
  collapsed?: boolean;           // for nested view
}

// --- Helper fns ---
function computeHours(start: string, end: string): number {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return parseFloat((((h2 * 60 + m2) - (h1 * 60 + m1)) / 60).toFixed(2));
}
function expandRecurringSlots(slots: Slot[]) {
  const entries: { date: string; hours: number }[] = [];
  slots.forEach(slot => {
    if (slot.is_recurring && slot.recurring_end_date) {
      let cur = new Date(slot.date);
      const last = new Date(slot.recurring_end_date);
      while (cur <= last) {
        if (slot.recurring_days.includes(cur.getDay())) {
          entries.push({
            date: cur.toISOString().slice(0,10),
            hours: computeHours(slot.start_time, slot.end_time)
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      entries.push({
        date: slot.date,
        hours: computeHours(slot.start_time, slot.end_time)
      });
    }
  });
  return entries;
}

export default function InvoiceGeneratePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation<{ invoiceId?: number }>();
  const invoiceId = location.state?.invoiceId;

  // auth guard
  if (!auth?.user) return null;

  // Form state
  const [mode, setMode] = useState<'internal'|'external'>(
    invoiceId ? 'internal' : 'internal'
  );
  const [issueDate, setIssueDate] = useState<Date | null>(new Date());
  const [dueDate, setDueDate]     = useState<Date | null>(new Date());
  const [shifts, setShifts]       = useState<Shift[]>([]);
  const [billing, setBilling]     = useState({
    pharmacistAbn: '',
    gstRegistered: false,
    bankAccountName: '',
    bsb: '',
    accountNumber: '',
    superFundName: '',
    superUSI: '',
    superMemberNumber: '',
    billToEmail: '',
    ccEmails: '',
    customBillToName: '',
    customBillToAddress: '',
  });
  const [lines, setLines] = useState<LineItem[]>([]);
  const [snackbar, setSnackbar] = useState<{open:boolean;msg:string}>({open:false,msg:''});

  // Totals
  const subtotal = lines.reduce((sum,l) => sum + l.total, 0);
  const freight  = lines.filter(l=>l.category_code==='2-1500').reduce((s,l)=>s+l.total,0);
  const gstAmt   = billing.gstRegistered ? parseFloat((subtotal*0.1).toFixed(2)) : 0;
  const superAmt = parseFloat(((subtotal)*(parseFloat(billing.superFundNumber||'11.5')/100)).toFixed(2));
  const total    = parseFloat((subtotal + gstAmt + superAmt).toFixed(2));

  // Load shifts & onboarding or invoice detail
  useEffect(() => {
    if (invoiceId) {
      // fetch existing
      apiClient.get(API_ENDPOINTS.invoiceDetail(invoiceId)).then(res => {
        const inv = res.data;
        setMode(inv.external ? 'external' : 'internal');
        setIssueDate(new Date(inv.invoice_date));
        setDueDate(inv.due_date ? new Date(inv.due_date) : new Date());
        setBilling({
          pharmacistAbn: inv.pharmacist_abn,
          gstRegistered: inv.gst_registered,
          bankAccountName: inv.bank_account_name,
          bsb: inv.bsb,
          accountNumber: inv.account_number,
          superFundName: inv.super_fund_name,
          superUSI: inv.super_usi,
          superMemberNumber: inv.super_member_number,
          billToEmail: inv.bill_to_email,
          ccEmails: inv.cc_emails,
          customBillToName: inv.custom_bill_to_name || '',
          customBillToAddress: inv.custom_bill_to_address || '',
        });
        // map inv.line_items → lines
        setLines(inv.line_items.map((li: any) => ({
          id: li.id,
          category_code: li.category_code,
          description: li.description,
          unit: li.unit,
          quantity: parseFloat(li.quantity),
          unitPrice: parseFloat(li.unit_price),
          discount: parseFloat(li.discount),
          total: parseFloat(li.total),
          gst_applicable: li.gst_applicable,
          super_applicable: li.super_applicable,
          is_manual: li.is_manual,
          collapsed: false,
        })));
      });
    } else {
      // new invoice: fetch shifts + onboarding
      apiClient.get(API_ENDPOINTS.getMyHistoryShifts).then(res=>setShifts(res.data.results||res.data))
      apiClient.get(API_ENDPOINTS.onboardingDetail(auth.user.role==='PHARMACIST'?'pharmacist':'otherstaff'))
        .then(res=>{
          setBilling(b=>({
            ...b,
            pharmacistAbn: res.data.abn||'',
            gstRegistered: res.data.gst_registered,
            superFundName: res.data.super_fund_name||'',
            superUSI: res.data.super_usi||'',
            superMemberNumber: res.data.super_member_number||'',
          }));
        });
    }
  }, [invoiceId, auth.user]);

  const addLine = () => {
    setLines(ls=>[
      ...ls,
      {
        category_code:'4-1300',
        description:'',
        unit:'Hours',
        quantity:0,
        unitPrice:0,
        discount:0,
        total:0,
        gst_applicable:true,
        super_applicable:true,
        is_manual:true,
        collapsed:false,
      }
    ]);
  };

  const updateLine = (i:number, changes:Partial<LineItem>) => {
    setLines(ls=>ls.map((l,idx)=> idx===i ? {
      ...l,
      ...changes,
      total: parseFloat(
        ((changes.quantity ?? l.quantity)* (changes.unitPrice ?? l.unitPrice)
         * (1 - ((changes.discount ?? l.discount)/100))).toFixed(2)
      )
    }:l));
  };

  const removeLine = (i:number) => setLines(ls=>ls.filter((_,idx)=>idx!==i));

  const handleShiftSelect = (e:any) => {
    const sid = +e.target.value;
    const shift = shifts.find(s=>s.id===sid);
    if (!shift) return;
    // flatten slots
    const entries = expandRecurringSlots(shift.slots);
    const newLines = entries.map(en=>({
      category_code:'4-1300',
      description:`${shift.role_needed} on ${en.date}`,
      unit:'Hours',
      quantity:en.hours,
      unitPrice:shift.fixed_rate,
      discount:0,
      total: parseFloat((en.hours*shift.fixed_rate).toFixed(2)),
      gst_applicable: billing.gstRegistered,
      super_applicable:true,
      is_manual:false,
      collapsed:false,
    }));
    // append super line
    const st = newLines.reduce((s,l)=>s+l.total,0);
    const supAmt = parseFloat((st*(parseFloat(billing.superFundName||'11.5')/100)).toFixed(2));
    newLines.push({
      category_code:'6-4200',
      description:'Superannuation',
      unit:'Lump Sum',
      quantity:1,
      unitPrice:supAmt,
      discount:0,
      total:supAmt,
      gst_applicable:false,
      super_applicable:false,
      is_manual:true,
      collapsed:false,
    });
    setLines(newLines);
  };

  const handleSave = async () => {
    try {
      const payload: any = {
        external: mode==='external',
        invoice_date: issueDate?.toISOString().slice(0,10),
        due_date: dueDate?.toISOString().slice(0,10),
        pharmacist_abn: billing.pharmacistAbn,
        gst_registered: billing.gstRegistered,
        super_rate_snapshot: parseFloat(billing.superFundName),
        bank_account_name: billing.bankAccountName,
        bsb: billing.bsb,
        account_number: billing.accountNumber,
        super_fund_name: billing.superFundName,
        super_usi: billing.superUSI,
        super_member_number: billing.superMemberNumber,
        bill_to_email: billing.billToEmail,
        cc_emails: billing.ccEmails,
        custom_bill_to_name: billing.customBillToName,
        custom_bill_to_address: billing.customBillToAddress,
        line_items: lines.map(l=>({
          ...(l.id && { id: l.id }),
          category_code: l.category_code,
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          discount: l.discount,
          gst_applicable: l.gst_applicable,
          super_applicable: l.super_applicable,
          is_manual: l.is_manual,
        })),
      };
      await apiClient.post(API_ENDPOINTS.generateInvoice, payload);
      navigate('/dashboard/pharmacist/invoice');
    } catch {
      setSnackbar({open:true,msg:'Failed to save invoice.'});
    }
  };

  return (
    <Container sx={{py:4}}>
      <Typography variant="h4" gutterBottom>
        {invoiceId ? `Edit Invoice #${invoiceId}` : 'New Invoice'}
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box display="flex" gap={2} mb={2}>
          <TextField
            label="Invoice #"
            value={invoiceId || '—'}
            InputProps={{ readOnly:true }}
            sx={{width:120}}
          />
          <DatePicker
            label="Issue Date"
            value={issueDate}
            onChange={(d)=>setIssueDate(d)}
            slotProps={{ textField:{ size:'small', sx:{width:150} } }}
          />
          <DatePicker
            label="Due Date"
            value={dueDate}
            onChange={(d)=>setDueDate(d)}
            slotProps={{ textField:{ size:'small', sx:{width:150} } }}
          />
        </Box>
      </LocalizationProvider>

      <FormLabel>Invoice Type</FormLabel>
      <RadioGroup
        row
        value={mode}
        onChange={e=>setMode(e.target.value as any)}
        sx={{mb:2}}
      >
        <FormControlLabel value="internal" control={<Radio />} label="Internal (Shift)" />
        <FormControlLabel value="external" control={<Radio />} label="External" />
      </RadioGroup>

      {mode==='internal' ? (
        <>
          <FormControl fullWidth sx={{mb:2}} size="small">
            <InputLabel>Choose Shift</InputLabel>
            <Select
              label="Choose Shift"
              onChange={handleShiftSelect}
              defaultValue=""
            >
              {shifts.map(s=>(
                <MenuItem key={s.id} value={s.id}>
                  {s.pharmacy_detail.name} – {s.slots[0]?.date}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Pharmacy Name"
            value={shifts.find(s=>s.id===lines[0]?.parentIndex)?.pharmacy_detail.name||''}
            InputProps={{ readOnly:true }}
            sx={{mb:1}}
          />
          <TextField
            fullWidth
            label="Pharmacy Address"
            value={shifts.find(s=>s.id===lines[0]?.parentIndex)?.pharmacy_detail.address||''}
            InputProps={{ readOnly:true }}
            sx={{mb:2}}
          />
        </>
      ) : (
        <>
          <TextField
            fullWidth
            label="Bill To Name"
            value={billing.customBillToName}
            onChange={e=>setBilling(b=>({...b,customBillToName:e.target.value}))}
            sx={{mb:1}}
          />
          <TextField
            fullWidth
            label="Bill To Address"
            multiline rows={3}
            value={billing.customBillToAddress}
            onChange={e=>setBilling(b=>({...b,customBillToAddress:e.target.value}))}
            sx={{mb:2}}
          />
        </>
      )}

      {/* Billing ABN/etc */}
      <TextField
        fullWidth
        label="Pharmacist ABN"
        value={billing.pharmacistAbn}
        onChange={e=>setBilling(b=>({...b,pharmacistAbn:e.target.value}))}
        sx={{mb:1}}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={billing.gstRegistered}
            onChange={e=>setBilling(b=>({...b,gstRegistered:e.target.checked}))}
          />
        }
        label="GST Registered"
      />
      <Stack direction="row" gap={2} mb={2}>
        <TextField
          label="Bank Account Name"
          value={billing.bankAccountName}
          onChange={e=>setBilling(b=>({...b,bankAccountName:e.target.value}))}
        />
        <TextField
          label="BSB"
          value={billing.bsb}
          onChange={e=>setBilling(b=>({...b,bsb:e.target.value}))}
        />
        <TextField
          label="Account Number"
          value={billing.accountNumber}
          onChange={e=>setBilling(b=>({...b,accountNumber:e.target.value}))}
        />
      </Stack>

      {/* Line-Items Grid */}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell/>
            <TableCell>Category</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell>Qty</TableCell>
            <TableCell>Unit Price</TableCell>
            <TableCell>Discount %</TableCell>
            <TableCell>Total</TableCell>
            <TableCell>Delete</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((l,i)=>(
            <React.Fragment key={i}>
              <TableRow>
                <TableCell>
                  {l.children ? (
                    <IconButton
                      size="small"
                      onClick={()=>updateLine(i,{collapsed:!l.collapsed})}
                    >
                      {l.collapsed ? <ExpandMoreIcon/> : <ExpandLessIcon/>}
                    </IconButton>
                  ) : null}
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={l.category_code}
                      onChange={e=>updateLine(i,{category_code:e.target.value})}
                    >
                      <MenuItem value="4-1300">4-1300 Professional Services</MenuItem>
                      <MenuItem value="6-4200">6-4200 Superannuation</MenuItem>
                      <MenuItem value="2-1500">2-1500 Travel expenses</MenuItem>
                      <MenuItem value="2-1800">2-1800 Misc reimburse</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={l.description}
                    onChange={e=>updateLine(i,{description:e.target.value})}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={l.unit}
                    onChange={e=>updateLine(i,{unit:e.target.value})}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={l.quantity}
                    onChange={e=>updateLine(i,{quantity:+e.target.value})}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={l.unitPrice}
                    onChange={e=>updateLine(i,{unitPrice:+e.target.value})}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={l.discount}
                    onChange={e=>updateLine(i,{discount:+e.target.value})}
                  />
                </TableCell>
                <TableCell>
                  {l.total.toFixed(2)}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={()=>removeLine(i)}>
                    <DeleteIcon fontSize="small"/>
                  </IconButton>
                </TableCell>
              </TableRow>
              {/* children if any */}
              {l.children && (
                <TableRow>
                  <TableCell colSpan={9} sx={{pl:8, border:0}}>
                    <Collapse in={!l.collapsed} unmountOnExit>
                      {/* render nested lines */}
                    </Collapse>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <Button
        startIcon={<AddIcon />}
        onClick={addLine}
        sx={{mt:1}}
      >
        + Add Line
      </Button>

      {/* Totals & Balance */}
      <Box textAlign="right" mt={3}>
        <Typography>Subtotal: ${subtotal.toFixed(2)}</Typography>
        <Typography>Freight:  ${freight.toFixed(2)}</Typography>
        <Typography>GST:      ${gstAmt.toFixed(2)}</Typography>
        <Typography>Super:    ${superAmt.toFixed(2)}</Typography>
        <Typography variant="h6">Total:  ${total.toFixed(2)}</Typography>
        <Typography>Paid:     $0.00</Typography>
        <Typography variant="h6">Balance: ${total.toFixed(2)}</Typography>
      </Box>

      {/* Actions */}
      <Stack direction="row" justifyContent="flex-end" spacing={2} mt={2}>
        <Button onClick={()=>navigate(-1)}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save Invoice
        </Button>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={()=>setSnackbar(s=>({...s,open:false}))}
        message={snackbar.msg}
      />
    </Container>
  );
}
