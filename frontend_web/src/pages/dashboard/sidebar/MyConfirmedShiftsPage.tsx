// src/pages/dashboard/sidebar/MyConfirmedShiftsPage.tsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Snackbar,
  IconButton,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Rating,
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

interface PharmacyDetail {
  id?: number;
  name: string;
  address?: string;
  methadone_s8_protocols?: string;
  qld_sump_docs?: string;
  sops?: string;
  induction_guides?: string;
}

interface Shift {
  id: number;
  pharmacy_detail: PharmacyDetail;
  role_needed: string;
  rate_type: 'FIXED' | 'FLEXIBLE' | 'PHARMACIST_PROVIDED' | null;
  fixed_rate: string | null;
  workload_tags: string[];
  slots: Slot[];
  owner_adjusted_rate: string | null;

}

const curvedPaperSx = {
  borderRadius: 3,
  boxShadow: '0 20px 45px rgba(109, 40, 217, 0.08)',
};

const gradientButtonSx = {
  borderRadius: 2,
  background: 'linear-gradient(90deg, #8B5CF6 0%, #6D28D9 100%)',
  color: '#fff',
  '&:hover': { background: 'linear-gradient(90deg, #A78BFA 0%, #8B5CF6 100%)' },
};

export default function MyConfirmedShiftsPage() {
  const [shifts, setShifts]     = useState<Shift[]>([]);
  const [loading, setLoading]   = useState(true); // Set to true initially for skeleton loading
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: '',
  });
  const [page, setPage]         = useState(1);

  // Dialog state for pharmacy details
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [currentPharm, setCurrentPharm] = useState<PharmacyDetail | null>(null);
  // Ratings state for dialog (pharmacy)
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [ratingComments, setRatingComments] = useState<Array<{ id: number; stars: number; comment?: string; created_at?: string }>>([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsPageCount, setCommentsPageCount] = useState(1);
  const [loadingRatings, setLoadingRatings] = useState(false);

  const itemsPerPage = 5;
  const pageCount    = Math.ceil(shifts.length / itemsPerPage);
  const displayed    = shifts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  useEffect(() => {
    setLoading(true); // Ensure loading is true when fetching starts
    apiClient
      .get(API_ENDPOINTS.getMyConfirmedShifts)
      .then(res => {
        const raw = res.data as any;
        const data: Shift[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.results)
            ? raw.results
            : [];
        setShifts(data);
      })
      .catch(() => setSnackbar({ open: true, msg: 'Failed to load shifts' }))
      .finally(() => setLoading(false)); // Ensure loading is set to false
  }, []);

  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));
  // Normalize DRF pagination arrays
  const unpackArray = (d: any) =>
    Array.isArray(d) ? d
    : Array.isArray(d?.results) ? d.results
    : Array.isArray(d?.data) ? d.data
    : Array.isArray(d?.items) ? d.items
    : [];

  const openDialog = async (p: PharmacyDetail) => {
    setCurrentPharm(p);
    setDialogOpen(true);
    setRatingSummary(null);
    setRatingComments([]);
    setCommentsPage(1);
    setCommentsPageCount(1);

    if (!p?.id) return; // no id → skip ratings silently

    setLoadingRatings(true);
    try {
      // 1) Summary
      const sumRes = await apiClient.get(
        `${API_ENDPOINTS.ratingsSummary}?target_type=pharmacy&target_id=${p.id}`
      );
      setRatingSummary({
        average: sumRes.data?.average ?? 0,
        count: sumRes.data?.count ?? 0,
      });

      // 2) First page of comments
      const listRes = await apiClient.get(
        `${API_ENDPOINTS.ratings}?target_type=pharmacy&target_id=${p.id}&page=1`
      );
      const items = unpackArray(listRes.data);
      setRatingComments(items.map((r: any) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        created_at: r.created_at,
      })));
      // compute page count if paginated
      if (listRes.data?.count && listRes.data?.results) {
        const per = listRes.data.results.length || 1;
        setCommentsPageCount(Math.max(1, Math.ceil(listRes.data.count / per)));
      } else {
        setCommentsPageCount(1);
      }
    } catch {
      // leave summary/comments empty on error
    } finally {
      setLoadingRatings(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCurrentPharm(null);
    setRatingSummary(null);
    setRatingComments([]);
    setCommentsPage(1);
    setCommentsPageCount(1);
  };

  const handleCommentsPageChange = async (_: React.ChangeEvent<unknown>, value: number) => {
    setCommentsPage(value);
    if (!currentPharm?.id) return;
    setLoadingRatings(true);
    try {
      const listRes = await apiClient.get(
        `${API_ENDPOINTS.ratings}?target_type=pharmacy&target_id=${currentPharm.id}&page=${value}`
      );
      const items = unpackArray(listRes.data);
      setRatingComments(items.map((r: any) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        created_at: r.created_at,
      })));
      // keep pageCount stable; compute if missing
      if (listRes.data?.count && listRes.data?.results) {
        const per = listRes.data.results.length || 1;
        setCommentsPageCount(Math.max(1, Math.ceil(listRes.data.count / per)));
      }
    } catch {
      // keep old state
    } finally {
      setLoadingRatings(false);
      // scroll to top of dialog for UX
      const dlg = document.querySelector('[role="dialog"]');
      dlg?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        {[...Array(3)].map((_, index) => ( // Render 3 skeleton papers
          <Paper key={index} sx={{ p: 2, mb: 2, ...curvedPaperSx }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton variant="text" width="60%" height={30} />
              <Skeleton variant="rectangular" width={120} height={36} />
            </Box>
            <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
            <Skeleton variant="text" width="50%" height={20} />
            <Box sx={{ mt: 2 }}>
              {[...Array(2)].map((__, slotIndex) => (
                <Skeleton key={slotIndex} variant="text" width="80%" height={20} />
              ))}
            </Box>
          </Paper>
        ))}
      </Container>
    );
  }

  if (!shifts.length) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>No upcoming confirmed shifts.</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        My Confirmed Shifts
      </Typography>

{displayed.map(shift => {
  const isPharmacist = shift.role_needed === 'PHARMACIST';
  const showBonus = !!shift.owner_adjusted_rate && !isPharmacist;

  // Determine rate label:
  let rateLabel = '';
  if (isPharmacist) {
    if (shift.rate_type === 'FIXED') {
      rateLabel = `Fixed – ${shift.fixed_rate} AUD/hr`;
    } else if (shift.rate_type === 'FLEXIBLE') {
      rateLabel = 'Flexible';
    } else if (shift.rate_type === 'PHARMACIST_PROVIDED') {
      rateLabel = 'Pharmacist Provided';
    } else {
      rateLabel = 'Flexible (Fair Work)';
    }
  } else {
    rateLabel = 'Award Rate (Fair Work Commission, July 2025)';
  }

  return (
    <Paper key={shift.id} sx={{ p: 2, mb: 2, ...curvedPaperSx }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">
          {shift.pharmacy_detail.name}
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={() => openDialog(shift.pharmacy_detail)}
          sx={gradientButtonSx}
        >
          Pharmacy Details
        </Button>
      </Box>

      <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
        <Typography>
          <strong>Role:</strong> {shift.role_needed}
        </Typography>

        <Typography>
          <strong>Rate:</strong> {rateLabel}
        </Typography>

        {showBonus && (
          <Typography
            sx={{ color: 'green', fontWeight: 'bold', mt: 1 }}
          >
            💰 Bonus: +{shift.owner_adjusted_rate} AUD/hr on top of Award Rate
          </Typography>
        )}

        {shift.workload_tags.length > 0 && (
          <Typography>
            <strong>Workload Tags:</strong>{' '}
            {shift.workload_tags.join(', ')}
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        {shift.slots.map(slot => (
          <Typography key={slot.id} variant="body2">
            {slot.date} {slot.start_time}–{slot.end_time}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
})}



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

      {/* Pharmacy Details Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Pharmacy Details</DialogTitle>
        <DialogContent dividers>
          {currentPharm && (
            <>
              <Typography>
                <strong>Name:</strong> {currentPharm.name}
              </Typography>
              {currentPharm.address && (
                <Typography>
                  <strong>Address:</strong> {currentPharm.address}
                </Typography>
              )}

              {currentPharm.methadone_s8_protocols && (
                <Typography>
                  <strong>Methadone S8 Protocols:</strong>{' '}
                  <Button
                    href={currentPharm.methadone_s8_protocols}
                    target="_blank"
                  >
                    Download
                  </Button>
                </Typography>
              )}
              {currentPharm.qld_sump_docs && (
                <Typography>
                  <strong>QLD Sump Docs:</strong>{' '}
                  <Button
                    href={currentPharm.qld_sump_docs}
                    target="_blank"
                  >
                    Download
                  </Button>
                </Typography>
              )}
              {currentPharm.sops && (
                <Typography>
                  <strong>SOPs:</strong>{' '}
                  <Button href={currentPharm.sops} target="_blank">
                    Download
                  </Button>
                </Typography>
              )}
              {currentPharm.induction_guides && (
                <Typography>
                  <strong>Induction Guides:</strong>{' '}
                  <Button
                    href={currentPharm.induction_guides}
                    target="_blank"
                  >
                    Download
                  </Button>
                </Typography>
              )}

              
              {/* Rating summary */}
              {currentPharm.id ? (
                <Box sx={{ mt: 1, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {ratingSummary ? (
                    <>
                      <Rating value={ratingSummary.average} precision={0.5} readOnly size="small" />
                      <Typography variant="body2" color="text.secondary">
                        ({ratingSummary.count})
                      </Typography>
                    </>
                  ) : (
                    <Skeleton variant="rectangular" width={140} height={24} />
                  )}
                </Box>
              ) : null}

              {/* Comments (paginated) */}
              {currentPharm.id ? (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Reviews
                  </Typography>

                  {loadingRatings && ratingComments.length === 0 ? (
                    <>
                      <Skeleton variant="text" width="80%" height={22} />
                      <Skeleton variant="text" width="70%" height={22} />
                      <Skeleton variant="text" width="60%" height={22} />
                    </>
                  ) : ratingComments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No comments yet.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                      {ratingComments.map(rc => (
                        <Box key={rc.id} sx={{ p: 1.2, borderRadius: 1, bgcolor: 'action.hover' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Rating value={rc.stars} readOnly size="small" />
                            {rc.created_at && (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(rc.created_at).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                          {rc.comment && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {rc.comment}
                            </Typography>
                          )}
                        </Box>
                      ))}

                      {/* Pagination for comments */}
                      {commentsPageCount > 1 && (
                        <Box display="flex" justifyContent="center" mt={1}>
                          <Pagination
                            count={commentsPageCount}
                            page={commentsPage}
                            onChange={handleCommentsPageChange}
                            color="primary"
                            size="small"
                          />
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              ) : null}

            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Close</Button>
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
