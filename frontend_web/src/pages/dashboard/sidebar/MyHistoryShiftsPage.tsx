import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Snackbar,
  IconButton,
  Pagination,
  Rating,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Skeleton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

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


export default function MyHistoryShiftsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const base =
    user?.role === 'PHARMACIST'
      ? '/dashboard/pharmacist'
      : user?.role === 'OTHER_STAFF'
      ? '/dashboard/otherstaff'
      : '/dashboard/pharmacist'; // sensible fallback

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true); // Set to true initially for skeleton loading
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: '',
  });
  const [page, setPage] = useState(1);
  const [generatingId, _setGeneratingId] = useState<number | null>(null);
  // Rating Modal State
  const [pharmacySummaries, setPharmacySummaries] = useState<Record<number, { average: number; count: number }>>({});
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<{ id: number; name: string } | null>(null);
  const [currentStars, setCurrentStars] = useState<number>(0);
  const [currentComment, setCurrentComment] = useState<string>('');
  const [loadingRating, setLoadingRating] = useState(false);
  const [loadingExistingRating, setLoadingExistingRating] = useState(false);

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

                // Fetch rating summaries for each unique pharmacy
        const uniquePharmacyIds = Array.from(new Set(data.map((shift) => shift.pharmacy_detail.id)));
        uniquePharmacyIds.forEach(async (pharmacyId) => {
          try {
            const res = await apiClient.get(
              `${API_ENDPOINTS.ratingsSummary}?target_type=pharmacy&target_id=${pharmacyId}`
            );
            setPharmacySummaries((prev) => ({
              ...prev,
              [pharmacyId]: {
                average: res.data.average,
                count: res.data.count,
              },
            }));
          } catch {
            console.error('Failed to fetch rating summary for pharmacy', pharmacyId);
          }
        });

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

  const handleGenerateInvoice = (shift: Shift) => {
    navigate(
      `${base}/invoice/new?shiftId=${shift.id}&pharmacyId=${shift.pharmacy_detail.id}`
    );
  };

  // Re-fetch the pharmacy rating summary (average + count)
const fetchSummaryForPharmacy = async (pharmacyId: number) => {
  try {
    const res = await apiClient.get(
      `${API_ENDPOINTS.ratingsSummary}?target_type=pharmacy&target_id=${pharmacyId}`
    );
    setPharmacySummaries((prev) => ({
      ...prev,
      [pharmacyId]: {
        average: res.data.average,
        count: res.data.count,
      },
    }));
  } catch {
    console.error('Failed to refresh pharmacy rating summary');
  }
};

  const handleOpenRatingModal = async (pharmacyId: number, pharmacyName: string) => {
    setSelectedPharmacy({ id: pharmacyId, name: pharmacyName });
    setLoadingExistingRating(true);
    setRatingModalOpen(true);

    try {
      // Fetch existing rating
      const res = await apiClient.get(
        `${API_ENDPOINTS.ratingsMine}?target_type=pharmacy&target_id=${pharmacyId}`
      );
      if (res.data && res.data.id) {
        // Pre-fill with existing rating
        setCurrentStars(res.data.stars || 0);
        setCurrentComment(res.data.comment || '');
      } else {
        // No rating yet
        setCurrentStars(0);
        setCurrentComment('');
      }
    } catch (err) {
      setSnackbar({ open: true, msg: 'Failed to load existing rating' });
      setCurrentStars(0);
      setCurrentComment('');
    } finally {
      setLoadingExistingRating(false);
    }
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
                        {/* <Rating readOnly size="small" value={0} /> Placeholder for Rating */}
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
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{shift.pharmacy_detail.name}</Typography>

            {pharmacySummaries[shift.pharmacy_detail.id] && (
              <Box display="flex" alignItems="center" gap={1}>
                <Rating
                  value={pharmacySummaries[shift.pharmacy_detail.id].average}
                  precision={0.5}
                  readOnly
                  size="small"
                />
                <Typography variant="body2" color="textSecondary">
                  ({pharmacySummaries[shift.pharmacy_detail.id].count})
                </Typography>
              </Box>
            )}
          </Box>

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
                {/* <Rating
                  size="small"
                  value={ratings[slot.id] || 0}
                  onChange={(_, v) =>
                    setRatings((r) => ({ ...r, [slot.id]: v || 0 }))
                  }
                /> */}
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
                    <Box mt={1} textAlign="right">
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={() => handleOpenRatingModal(shift.pharmacy_detail.id, shift.pharmacy_detail.name)}
            >
              Rate Pharmacy
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

      {/* === Rating Modal === */}
      <Dialog
        open={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {selectedPharmacy ? `Rate ${selectedPharmacy.name}` : 'Rate Pharmacy'}
        </DialogTitle>
        <DialogContent>
          {loadingExistingRating ? (
            <Box display="flex" justifyContent="center" py={3}>
              <Skeleton variant="rectangular" width="100%" height={100} />
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Typography>Select a star rating:</Typography>
              <Rating
                name="pharmacy-rating"
                value={currentStars}
                size="large"
                onChange={(_, value) => setCurrentStars(value || 0)}
              />
              <TextField
                label="Comment (optional)"
                multiline
                minRows={3}
                value={currentComment}
                onChange={(e) => setCurrentComment(e.target.value)}
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRatingModalOpen(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!selectedPharmacy) return;
              setLoadingRating(true);
              try {
                await apiClient.post(API_ENDPOINTS.ratings, {
                  direction: 'WORKER_TO_PHARMACY',
                  ratee_pharmacy: selectedPharmacy.id,
                  stars: currentStars,
                  comment: currentComment,
                });

                // ✅ refresh the summary stars/count shown on the main page
                await fetchSummaryForPharmacy(selectedPharmacy.id);

                setSnackbar({ open: true, msg: 'Rating saved successfully!' });
                setRatingModalOpen(false);
              } catch {
                setSnackbar({ open: true, msg: 'Failed to save rating' });
              } finally {
                setLoadingRating(false);
              }
            }}
            variant="contained"
            color="primary"
            disabled={loadingRating || currentStars === 0}
          >
            {loadingRating ? 'Saving...' : 'Save Rating'}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}