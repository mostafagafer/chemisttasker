import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  // CircularProgress,
  Snackbar,
  IconButton,
  Pagination,
  Rating,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton, // Added Skeleton import
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

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
  pharmacy_detail: { name: string; id: number };
  role_needed: string;
  slots: Slot[];
}

interface InvoiceLineItem {
  id: number;
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
}

interface Invoice {
  id: number;
  invoice_date: string;
  due_date: string;
  pharmacy_name_snapshot: string;
  subtotal: string;
  gst_amount: string;
  super_amount: string;
  total: string;
  line_items: InvoiceLineItem[];
}

export default function MyHistoryShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true); // Set to true initially for skeleton loading
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: '',
  });
  const [page, setPage] = useState(1);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<number, number>>({});

  const itemsPerPage = 5;
  const pageCount = Math.ceil(shifts.length / itemsPerPage);
  const displayed = shifts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setLoading(true); // Ensure loading is true when fetching starts
    apiClient
      .get(API_ENDPOINTS.getMyHistoryShifts)
      .then((res) => {
        const raw = res.data as any;
        const data: Shift[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.results)
          ? raw.results
          : [];
        setShifts(data);
      })
      .catch(() =>
        setSnackbar({ open: true, msg: 'Failed to load history shifts' })
      )
      .finally(() => setLoading(false)); // Ensure loading is set to false
  }, []);

  const closeSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerateInvoice = async (shift: Shift) => {
    try {
      setGeneratingId(shift.id);
      const res = await apiClient.post(API_ENDPOINTS.generateInvoice, {
        pharmacy_id: shift.pharmacy_detail.id,
        shift_ids: [shift.id],
      });

      const { invoice_id } = res.data;

      const invoiceRes = await apiClient.get(`/client-profile/invoices/${invoice_id}/`);
      setSelectedInvoice(invoiceRes.data);
      setModalOpen(true);
    } catch (error) {
      setSnackbar({ open: true, msg: 'Failed to generate invoice.' });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedInvoice(null);
  };

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        {[...Array(3)].map((_, index) => ( // Render 3 skeleton papers
          <Paper key={index} sx={{ p: 2, mb: 2 }}>
            <Skeleton variant="text" width="70%" height={30} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="50%" height={20} sx={{ mb: 2 }} />
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...Array(2)].map((__, slotIndex) => (
                    <Box key={slotIndex} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Skeleton variant="text" width="40%" />
                        <Rating readOnly size="small" value={0} /> {/* Placeholder for Rating */}
                    </Box>
                ))}
            </Box>
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Skeleton variant="rectangular" width={150} height={36} />
            </Box>
          </Paper>
        ))}
      </Container>
    );
  }

  if (!shifts.length) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>No past shifts to rate.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        My Shift History
      </Typography>

      {displayed.map((shift) => (
        <Paper key={shift.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">{shift.pharmacy_detail.name}</Typography>
          <Typography>Role: {shift.role_needed}</Typography>

          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {shift.slots.map((slot) => (
              <Box
                key={slot.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2">
                  {slot.date} {slot.start_time}–{slot.end_time}
                </Typography>
                <Rating
                  size="small"
                  value={ratings[slot.id] || 0}
                  onChange={(_, v) =>
                    setRatings((r) => ({ ...r, [slot.id]: v || 0 }))
                  }
                />
              </Box>
            ))}
          </Box>

          <Box mt={2} textAlign="right">
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => handleGenerateInvoice(shift)}
              disabled={generatingId === shift.id}
            >
              {generatingId === shift.id ? 'Generating...' : 'Generate Invoice'}
            </Button>
          </Box>
        </Paper>
      ))}

      {pageCount > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>Invoice Summary</DialogTitle>
        <DialogContent dividers>
          {selectedInvoice ? (
            <>
              <Typography variant="subtitle1">
                Invoice #{selectedInvoice.id}
              </Typography>
              <Typography variant="body2">
                Pharmacy: {selectedInvoice.pharmacy_name_snapshot}
              </Typography>
              <Typography variant="body2">
                Date: {selectedInvoice.invoice_date}
              </Typography>
              <Box mt={2}>
                {selectedInvoice.line_items.map((item) => (
                  <Box key={item.id} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {item.description} — {item.quantity} x ${item.unit_price} = ${item.total}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box mt={2}>
                <Typography variant="body2">Subtotal: ${selectedInvoice.subtotal}</Typography>
                <Typography variant="body2">GST: ${selectedInvoice.gst_amount}</Typography>
                <Typography variant="body2">Super: ${selectedInvoice.super_amount}</Typography>
                <Typography variant="subtitle1">Total: ${selectedInvoice.total}</Typography>
              </Box>
            </>
          ) : (
            <Typography>Loading invoice...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" disabled>Download as PDF</Button>
          <Button variant="contained" color="primary" disabled>Send Invoice</Button>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        message={snackbar.msg}
        action={
          <IconButton size="small" color="inherit" onClick={closeSnackbar}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
}