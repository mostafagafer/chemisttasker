// src/pages/ResetPasswordPage.tsx

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import apiClient from '../utils/apiClient';
import { API_ENDPOINTS } from '../constants/api';

export default function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate       = useNavigate();
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await apiClient.post(API_ENDPOINTS.passwordResetConfirm, {
        uid,
        token,
        new_password1: newPassword,
        new_password2: confirmPassword,
      });
      navigate('/login');
    } catch {
      setError('Failed to reset password. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" textAlign="center" mb={3}>
          Set a New Password
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            margin="normal"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ mt: 2, py: 1.5 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Reset Password'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
