import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Card, CardContent, Button, Skeleton, Box, Chip, Divider,} from '@mui/material';
import apiClient from '../utils/apiClient';
import { API_ENDPOINTS } from '../constants/api';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

interface Shift {
  id: number;
  pharmacy_detail: {
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  description?: string;
  role_needed: string;
  created_at: string;
  post_anonymously?: boolean;
}

const PublicJobBoardPage: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(API_ENDPOINTS.getPublicJobBoard)
      .then(res => setShifts(res.data.results || res.data))
      .catch(err => console.error("Failed to load public job board", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom><Skeleton width="40%" /></Typography>
        {[...Array(3)].map((_, i) => <Card key={i} sx={{ mb: 2 }}><CardContent><Skeleton height={100} /></CardContent></Card>)}
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Public Job Board</Typography>
      {shifts.length === 0 ? (
        <Typography>There are no public shifts available at the moment.</Typography>
      ) : (
        shifts.map(shift => (
          <Card key={shift.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="h6">
                    {shift.post_anonymously
                      ? (shift.pharmacy_detail.suburb
                          ? `Shift in ${shift.pharmacy_detail.suburb}`
                          : 'Anonymous Shift')
                      : shift.pharmacy_detail.name}
                  </Typography>
                  {(!shift.post_anonymously ||
                    (shift.post_anonymously && shift.pharmacy_detail.suburb)) && (
                    <Typography variant="body2" color="text.secondary">
                      {shift.post_anonymously
                        ? shift.pharmacy_detail.suburb
                        : [shift.pharmacy_detail.street_address, shift.pharmacy_detail.suburb, shift.pharmacy_detail.state, shift.pharmacy_detail.postcode]
                            .filter(Boolean)
                            .join(', ')}
                    </Typography>
                  )}
                  <Divider sx={{ my: 1 }} />

                  <Chip label={shift.role_needed} color="primary" size="small" sx={{ mt: 1 }}/>
                </Box>

                
                <Button component={RouterLink} to={`/shifts/link?id=${shift.id}`} variant="contained">
                  View Details
                </Button>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {shift.description && (
                <Typography variant="body1" color="text.primary" sx={{ mt: 1,  whiteSpace: 'pre-wrap' }}>
                  {shift.description}
                </Typography>
              )}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
                Posted {formatDistanceToNow(dayjs.utc(shift.created_at).toDate(), { addSuffix: true })}
              </Typography>
            </CardContent>
          </Card>
        ))
      )}
    </Container>
  );
};

export default PublicJobBoardPage;
