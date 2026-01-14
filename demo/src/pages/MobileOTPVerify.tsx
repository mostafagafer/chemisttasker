import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Link,
  Typography,
} from '@mui/material';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';
import AuthLayout from '../layouts/AuthLayout';

export default function MobileOTPVerify() {
  const [mobile, setMobile]   = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState('');
  const [error, setError]     = useState('');

  const requestCode = async () => {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.mobileRequestOtp}`,
        { mobile_number: mobile },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setStatus('We sent a code to your mobile.');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to send code.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.mobileVerifyOtp}`,
        { otp },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setStatus('Mobile verified! Redirecting...');
      setTimeout(() => window.location.assign('/login'), 800);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.response?.data?.detail || 'Verification failed.');
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
      await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.mobileResendOtp}`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setStatus('A new code has been sent to your mobile.');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.response?.data?.detail || 'Could not resend code.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Mobile Verification">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {status && <Alert severity="success" sx={{ mb: 2 }}>{status}</Alert>}

      <form onSubmit={handleVerify}>
        <TextField
          fullWidth
          margin="normal"
          label="Mobile Number"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="e.g., 0412 345 678 or 61412345678"
          required
        />

        <Box mt={1}>
          <Button
            fullWidth
            type="button"
            onClick={requestCode}
            variant="outlined"
            disabled={loading || !mobile}
            sx={{ py: 1.25, borderColor: '#00a99d', color: '#00a99d' }}
          >
            {loading ? <CircularProgress size={22} /> : 'Send Code'}
          </Button>
        </Box>

        <TextField
          fullWidth
          margin="normal"
          label="Enter OTP Code"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />

        <Box mt={3}>
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ py: 1.5, backgroundColor: '#00a99d', '&:hover': { backgroundColor: '#00877d' } }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
          </Button>
        </Box>
      </form>

      <Box mt={2} textAlign="center">
        <Link component="button" onClick={handleResend} disabled={loading} color="#00a99d">
          Resend Code
        </Link>
      </Box>

      <Typography variant="body2" mt={3} textAlign="center">
        Back to{' '}
        <Link component={RouterLink} to="/login" fontWeight="bold" color="#00a99d">
          Login
        </Link>
      </Typography>
    </AuthLayout>
  );
}
