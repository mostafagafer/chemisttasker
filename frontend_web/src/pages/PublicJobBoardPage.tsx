import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Container, Typography, Card, CardContent, Button, Skeleton, Box, Chip, Divider, Stack } from '@mui/material';
import { getPublicJobBoard } from '@chemisttasker/shared-core';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import AuthLayout from '../layouts/AuthLayout';

dayjs.extend(utc);

interface Shift {
  id: number;
  pharmacy_detail?: {
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  pharmacyDetail?: {
    name?: string;
    streetAddress?: string | null;
    suburb?: string | null;
    postcode?: string | null;
    state?: string | null;
  } | null;
  description?: string;
  role_needed?: string;
  roleNeeded?: string;
  created_at?: string;
  createdAt?: string;
  post_anonymously?: boolean;
  postAnonymously?: boolean;
}

const PublicJobBoardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orgId = searchParams.get("organization") || undefined;
    getPublicJobBoard(orgId ? { organization: orgId } : undefined)
      .then((res: any) => {
        const list = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setShifts(list as Shift[]);
      })
      .catch(err => console.error("Failed to load public job board", err))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const renderContent = () => {
    if (loading) {
      return (
        <Stack spacing={3}>
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 3 }} />
          {[...Array(3)].map((_, i) => (
            <Card key={i} sx={{ borderRadius: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rectangular" height={80} sx={{ mt: 1, borderRadius: 2 }} />
              </CardContent>
            </Card>
          ))}
        </Stack>
      );
    }

    if (shifts.length === 0) {
      return (
        <Card sx={{ borderRadius: 3, boxShadow: 6 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              No public shifts right now
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Check back soon for new opportunities.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Stack spacing={2.5}>
        {shifts.map(shift => (
          <Card key={shift.id} sx={{ borderRadius: 3, boxShadow: '0 18px 40px rgba(0,0,0,0.06)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h6">
                {shift.post_anonymously ?? shift.postAnonymously
                      ? ((shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb)
                          ? `Shift in ${shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb}`
                          : 'Anonymous Shift')
                      : (shift.pharmacy_detail?.name ?? shift.pharmacyDetail?.name)}
                  </Typography>
                  {(!(shift.post_anonymously ?? shift.postAnonymously) ||
                    ((shift.post_anonymously ?? shift.postAnonymously) && (shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb))) && (
                    <Typography variant="body2" color="text.secondary">
                      {shift.post_anonymously ?? shift.postAnonymously
                        ? (shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb)
                        : [
                            shift.pharmacy_detail?.street_address ?? shift.pharmacyDetail?.streetAddress,
                            shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb,
                            shift.pharmacy_detail?.state ?? shift.pharmacyDetail?.state,
                            shift.pharmacy_detail?.postcode ?? shift.pharmacyDetail?.postcode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                    </Typography>
                  )}
                  <Divider sx={{ my: 1 }} />

                  <Chip label={shift.role_needed ?? shift.roleNeeded} color="primary" size="small" sx={{ mt: 1 }}/>
                </Box>

                
                <Button component={RouterLink} to={`/shifts/link?id=${shift.id}`} variant="contained">
                  View Details
                </Button>
              </Box>

              <Box sx={{ mt: 1 }}>
                {shift.description && (
                <Typography variant="body1" color="text.primary" sx={{ mt: 1,  whiteSpace: 'pre-wrap' }}>
                  {shift.description}
                </Typography>
              )}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
                Posted {formatDistanceToNow(dayjs.utc(shift.created_at ?? shift.createdAt as any).toDate(), { addSuffix: true })}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  };

  return (
    <AuthLayout title="Public Job Board" maxWidth="lg" noCard showTitle={false}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="h4" gutterBottom>Public Job Board</Typography>
        {renderContent()}
      </Container>
    </AuthLayout>
  );
};

export default PublicJobBoardPage;
