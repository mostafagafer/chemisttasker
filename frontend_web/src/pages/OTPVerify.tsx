import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Link,
} from '@mui/material';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';
import { useLocation } from "react-router-dom";

export default function OTPVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = location.state?.email || '';
  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);

    try {
      await axios.post(`${API_BASE_URL}${API_ENDPOINTS.verifyOtp}`, { email, otp });
      setStatus('Verification successful! Redirecting...');
      setTimeout(() => navigate('/login'), 1000); // Or wherever you want
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.detail ||
          'Verification failed. Please check your code.';
        setError(msg);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}${API_ENDPOINTS.resendOtp}`, { email });
      setStatus('A new code has been sent to your email.');
    } catch (err) {
      setError('Could not resend code. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" textAlign="center" mb={3}>
          Email Verification
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {status && <Alert severity="success" sx={{ mb: 2 }}>{status}</Alert>}
        <form onSubmit={handleVerify}>
            <TextField
            fullWidth
            margin="normal"
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            />

          <TextField
            fullWidth
            margin="normal"
            label="Enter OTP Code"
            value={otp}
            onChange={e => setOtp(e.target.value)}
            required
          />
          <Box mt={3}>
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify'}
            </Button>
          </Box>
        </form>
        <Box mt={2} textAlign="center">
          <Link component="button" onClick={handleResend} disabled={loading}>
            Resend Code
          </Link>
        </Box>
        <Typography variant="body2" mt={3} textAlign="center">
          Back to{' '}
          <Link component={RouterLink} to="/login">
            Login
          </Link>
        </Typography>
      </Paper>
    </Container>
  );
}
