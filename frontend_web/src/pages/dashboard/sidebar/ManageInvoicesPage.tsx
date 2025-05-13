// src/pages/dashboard/sidebar/ManageInvoicesPage.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  CircularProgress,
  Snackbar,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  FormLabel,
  Link,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
// You need an auth hook or context that exposes the logged-in user's role:
import { useAuth } from '../../../contexts/AuthContext';

interface Invoice {
  id: number;
  invoice_date: string;
  due_date: string | null;
  pharmacy_name_snapshot: string;
  custom_bill_to_name?: string;
  total: string;
  status: string;
}

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
}

interface Shift {
  id: number;
  pharmacy_detail: {
    id: number;
    name: string;
    address: string;
    abn: string;
  };
  slots: Slot[];
}

interface InvoiceFormData {
  external: boolean;
  selectedShiftId?: number;
  customBillToName: string;
  customBillToAddress: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyAbn: string;
  slots: Slot[];
  pharmacistAbn: string;
  gstRegistered: boolean;
  gstFileUrl?: string;
  superRateSnapshot: string;
  bankAccountName: string;
  bsb: string;
  accountNumber: string;
  superFundName: string;
  superUSI: string;
  superMemberNumber: string;
  billToEmail: string;
  ccEmails: string;
  dueDate: string;
}

export default function ManageInvoicesPage() {
  const auth = useAuth(); // may be null until loaded
  // 1) While we’re waiting for auth, just show spinner
  if (!auth?.user) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }
  // 2) Now we know auth.user exists
  const roleKey =
    auth.user.role === 'PHARMACIST' ? 'pharmacist' : 'otherstaff';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: '',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>({
    external: false,
    selectedShiftId: undefined,
    customBillToName: '',
    customBillToAddress: '',
    pharmacyName: '',
    pharmacyAddress: '',
    pharmacyAbn: '',
    slots: [],
    pharmacistAbn: '',
    gstRegistered: false,
    gstFileUrl: '',
    superRateSnapshot: '11.5',
    bankAccountName: '',
    bsb: '',
    accountNumber: '',
    superFundName: '',
    superUSI: '',
    superMemberNumber: '',
    billToEmail: '',
    ccEmails: '',
    dueDate: new Date().toISOString().slice(0, 10),
  });

  const closeSnackbar = () =>
    setSnackbar((s) => ({ ...s, open: false }));

  // Load invoices + history shifts once
  useEffect(() => {
    Promise.all([
      apiClient.get(API_ENDPOINTS.invoices),
      apiClient.get(API_ENDPOINTS.getMyHistoryShifts),
    ])
      .then(([invRes, shiftRes]) => {
        setInvoices(invRes.data);
        const raw = shiftRes.data;
        const list: Shift[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.results)
          ? raw.results
          : [];
        setShifts(list);
      })
      .catch(() =>
        setSnackbar({
          open: true,
          msg: 'Failed to load invoices or shifts.',
        })
      )
      .finally(() => setLoading(false));
  }, []);

  // Generic form‐data setter
  const handleChange = <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // When user clicks “Generate Invoice”
  const handleGenerate = useCallback(async () => {
    try {
      // 1) Fetch onboarding for their role
      const onboardRes = await apiClient.get(
        API_ENDPOINTS.onboardingDetail(roleKey)
      );
      const {
        abn,
        gst_registered,
        gst_file,
        super_fund_name,
        super_usi,
        super_member_number,
      } = onboardRes.data;

      // 2) Merge into form
      setFormData((prev) => ({
        ...prev,
        pharmacistAbn: abn || '',
        gstRegistered: gst_registered,
        gstFileUrl: gst_file || '',
        superFundName: super_fund_name || '',
        superUSI: super_usi || '',
        superMemberNumber: super_member_number || '',
      }));
    } catch {
      setSnackbar({
        open: true,
        msg: 'Failed to load your onboarding data.',
      });
    }
    // 3) Finally open the dialog
    setFormOpen(true);
  }, [roleKey]);

  const handleFormClose = () => setFormOpen(false);

  const handleShiftSelect = (shiftId: number) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    // populate pharmacy & slots
    handleChange('selectedShiftId', shiftId);
    handleChange('pharmacyName', shift.pharmacy_detail.name);
    handleChange('pharmacyAddress', shift.pharmacy_detail.address);
    handleChange('pharmacyAbn', shift.pharmacy_detail.abn);
    handleChange('slots', shift.slots);
  };

  const handleSlotChange = (
    index: number,
    field: keyof Slot,
    value: string
  ) => {
    const updated = [...formData.slots];
    // @ts-ignore
    updated[index][field] = value;
    handleChange('slots', updated as Slot[]);
  };

  const handleSubmit = async () => {
    try {
      // Build payload
      const payload: any = {
        external: formData.external,
        pharmacist_abn: formData.pharmacistAbn,
        gst_registered: formData.gstRegistered,
        super_rate_snapshot: formData.superRateSnapshot,
        bank_account_name: formData.bankAccountName,
        bsb: formData.bsb,
        account_number: formData.accountNumber,
        super_fund_name: formData.superFundName,
        super_usi: formData.superUSI,
        super_member_number: formData.superMemberNumber,
        bill_to_email: formData.billToEmail,
        cc_emails: formData.ccEmails,
        due_date: formData.dueDate,
      };

      if (formData.external) {
        payload.custom_bill_to_name = formData.customBillToName;
        payload.custom_bill_to_address =
          formData.customBillToAddress;
      } else {
        payload.pharmacy =
          shifts.find((s) => s.id === formData.selectedShiftId)
            ?.pharmacy_detail.id;
        payload.shift_ids = [formData.selectedShiftId];
      }

      const res = await apiClient.post(
        API_ENDPOINTS.generateInvoice,
        payload
      );
      setInvoices((prev) => [...prev, res.data]);
      setFormOpen(false);
    } catch {
      setSnackbar({
        open: true,
        msg: 'Failed to create invoice.',
      });
    }
  };

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      {/* Header with Generate Button */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4">
          Manage Invoices
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleGenerate}
        >
          Generate Invoice
        </Button>
      </Box>

      {/* Invoice List */}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Client</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Total</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id} hover>
              <TableCell>{inv.id}</TableCell>
              <TableCell>
                {inv.pharmacy_name_snapshot ||
                  inv.custom_bill_to_name}
              </TableCell>
              <TableCell>{inv.invoice_date}</TableCell>
              <TableCell>{inv.total}</TableCell>
              <TableCell>{inv.status}</TableCell>
              <TableCell align="right">
                <IconButton
                  color="error"
                  onClick={() => {
                    /* delete logic */
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Invoice Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={handleFormClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {formData.external
            ? 'External Invoice'
            : 'Internal Invoice'}
        </DialogTitle>
        <DialogContent>
          {/* Invoice Type */}
          <FormLabel component="legend">
            Invoice Type
          </FormLabel>
          <RadioGroup
            row
            value={
              formData.external ? 'external' : 'internal'
            }
            onChange={(e) =>
              handleChange(
                'external',
                e.target.value === 'external'
              )
            }
          >
            <FormControlLabel
              value="internal"
              control={<Radio />}
              label="Internal (Shift)"
            />
            <FormControlLabel
              value="external"
              control={<Radio />}
              label="External"
            />
          </RadioGroup>

          {/* Internal vs External */}
          {formData.external ? (
            <>
              <TextField
                fullWidth
                margin="normal"
                label="Bill To Name"
                value={formData.customBillToName}
                onChange={(e) =>
                  handleChange(
                    'customBillToName',
                    e.target.value
                  )
                }
              />
              <TextField
                fullWidth
                margin="normal"
                label="Bill To Address"
                multiline
                rows={3}
                value={formData.customBillToAddress}
                onChange={(e) =>
                  handleChange(
                    'customBillToAddress',
                    e.target.value
                  )
                }
              />
            </>
          ) : (
            <>
              <FormControl
                fullWidth
                margin="normal"
              >
                <InputLabel>Shift</InputLabel>
                <Select
                  value={
                    formData.selectedShiftId ?? ''
                  }
                  label="Shift"
                  onChange={(e) =>
                    handleShiftSelect(
                      Number(e.target.value)
                    )
                  }
                >
                  {shifts.map((s) => (
                    <MenuItem
                      key={s.id}
                      value={s.id}
                    >
                      {s.pharmacy_detail.name} –{' '}
                      {s.slots[0]?.date}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Pharmacy Snapshot */}
              <TextField
                fullWidth
                margin="normal"
                label="Pharmacy Name"
                value={formData.pharmacyName}
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Pharmacy Address"
                value={formData.pharmacyAddress}
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Pharmacy ABN"
                value={formData.pharmacyAbn}
                InputProps={{ readOnly: true }}
              />

              {/* Slots Editing */}
              {formData.slots.map((slot, idx) => (
                <Box
                  key={slot.id}
                  display="flex"
                  gap={2}
                  alignItems="center"
                  my={1}
                >
                  <TextField
                    label="Date"
                    value={slot.date}
                    onChange={(e) =>
                      handleSlotChange(
                        idx,
                        'date',
                        e.target.value
                      )
                    }
                  />
                  <TextField
                    label="Start Time"
                    value={slot.start_time}
                    onChange={(e) =>
                      handleSlotChange(
                        idx,
                        'start_time',
                        e.target.value
                      )
                    }
                  />
                  <TextField
                    label="End Time"
                    value={slot.end_time}
                    onChange={(e) =>
                      handleSlotChange(
                        idx,
                        'end_time',
                        e.target.value
                      )
                    }
                  />
                </Box>
              ))}
            </>
          )}

          {/* Billing Fields */}
          <TextField
            fullWidth
            margin="normal"
            label="ABN"
            value={formData.pharmacistAbn}
            onChange={(e) =>
              handleChange(
                'pharmacistAbn',
                e.target.value
              )
            }
          />
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.gstRegistered}
                  onChange={(e) =>
                    handleChange(
                      'gstRegistered',
                      e.target.checked
                    )
                  }
                />
              }
              label="GST Registered"
            />
          </FormGroup>
          {/* Show uploaded GST file if present */}
          {formData.gstFileUrl && (
            <Box my={1}>
              <Typography variant="body2">
                GST Certificate:
              </Typography>
              <Link
                href={formData.gstFileUrl}
                target="_blank"
                rel="noopener"
              >
                View uploaded file
              </Link>
            </Box>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Bank Account Name"
            value={formData.bankAccountName}
            onChange={(e) =>
              handleChange(
                'bankAccountName',
                e.target.value
              )
            }
          />
          <Box display="flex" gap={2}>
            <TextField
              margin="normal"
              label="BSB"
              value={formData.bsb}
              onChange={(e) =>
                handleChange('bsb', e.target.value)
              }
            />
            <TextField
              margin="normal"
              label="Account Number"
              value={formData.accountNumber}
              onChange={(e) =>
                handleChange(
                  'accountNumber',
                  e.target.value
                )
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFormClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
          >
            Save Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        message={snackbar.msg}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={closeSnackbar}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
}
