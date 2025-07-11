import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Card, CardContent, Button, Skeleton, Box, Chip, Divider } from '@mui/material';
import apiClient from '../utils/apiClient';
import { API_ENDPOINTS } from '../constants/api';
import { useAuth } from '../contexts/AuthContext';

interface Shift {
  id: number;
  pharmacy_detail: { name: string; address?: string; state?: string; };
  role_needed: string;
  slots: { date: string; start_time: string; end_time: string }[];
}

const SharedShiftLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // FIX: Only destructure the 'user' property, as 'loading' is not available.
  const { user } = useAuth();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true); // This is for the local API call loading state
  const [error, setError] = useState('');

  const token = searchParams.get('token');
  const id = searchParams.get('id');

  useEffect(() => {
    // The effect will now re-run when the 'user' object changes (e.g., from null to a user object after login check)
    const fetchShift = async () => {
        try {
            const response = await apiClient.get(API_ENDPOINTS.getViewSharedShift, {
                params: { token, id }
            });
            const fetchedShift = response.data;
            setShift(fetchedShift);

            // If user is logged in, redirect them to the internal dashboard page
            if (user && fetchedShift) {
                const rolePath = user.role.toLowerCase().replace('_', '');
                navigate(`/dashboard/${rolePath}/shifts/${fetchedShift.id}`, { replace: true });
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Could not load this shift.");
        } finally {
            // Only stop loading if the user is not logged in.
            // If they are logged in, the page will redirect away, so we don't need to change the loading state.
            if (!user) {
              setLoading(false);
            }
        }
    };

    if (!token && !id) {
        setError("No shift specified. A link must contain a shift ID or a share token.");
        setLoading(false);
    } else {
        fetchShift();
    }

  // FIX: The dependency array is simplified to not include the non-existent 'authLoading'.
  }, [id, token, user, navigate]);


  // FIX: The skeleton loader condition is simplified.
  // It will show while the API call is loading OR if a user is logged in (to hide the page before redirect).
  if (loading || user) {
    return (
      <Container sx={{ textAlign: 'center', py: 5 }}>
        <Skeleton variant="text" width="40%" height={40} />
        <Card sx={{ mt: 2 }}><CardContent><Skeleton height={200} /></CardContent></Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="h5" color="error">{error}</Typography>
        <Button sx={{ mt: 2 }} variant="contained" component={RouterLink} to="/shifts/public-board">Explore Other Shifts</Button>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      {shift && (
        <>
            <Typography variant="h4" gutterBottom>Shift Opportunity</Typography>
            <Card>
                <CardContent>
                    <Typography variant="h5">{shift.pharmacy_detail.name}</Typography>
                    <Typography color="text.secondary" gutterBottom>{shift.pharmacy_detail.address}</Typography>
                    <Chip label={shift.role_needed} color="primary" sx={{ my: 2 }} />
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="h6">Slots:</Typography>
                    {shift.slots.map((slot, index) => (
                        <Typography key={index}>{new Date(slot.date).toLocaleDateString()} from {slot.start_time} to {slot.end_time}</Typography>
                    ))}
                </CardContent>
            </Card>

            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" gutterBottom>Interested in this shift?</Typography>
                <Button component={RouterLink} to="/login" variant="contained" size="large" sx={{ mr: 2 }}>
                    Login to Apply
                </Button>
                <Button component={RouterLink} to="/shifts/public-board" variant="outlined" size="large">
                    Explore Job Board
                </Button>
            </Box>
        </>
      )}
    </Container>
  );
};

export default SharedShiftLandingPage;