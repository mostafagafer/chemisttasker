// src/pages/Login.tsx

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
import { ORG_ROLES } from '../constants/roles';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.login}`,
        { email, password }
      );
      const { access, refresh, user: userInfo } = data;
      if (!access || !refresh) {
        throw new Error('Both access and refresh tokens are required');
      }

      login(access, refresh, userInfo);

      // if they hold any org role, go to org dashboard
      // const isOrgMember = userInfo.memberships?.some(
      //   (m: any) => ORG_ROLES.includes(m.role)
      // );
      // if (isOrgMember) {
      //   navigate('/dashboard/organization/overview');
      //   return;
      // }


      const isOrgMember = (userInfo?.memberships || []).some(
        (m: any) => ORG_ROLES.includes(m.role)
      );

      if (isOrgMember) {
        navigate('/dashboard/organization/overview');
        return;
      }

      // else by base role
      switch (userInfo.role) {
        case 'OWNER':
          navigate('/dashboard/owner/overview');
          break;
        case 'PHARMACIST':
          navigate('/dashboard/pharmacist/overview');
          break;
        case 'OTHER_STAFF':
          navigate('/dashboard/otherstaff/overview');
          break;
        case 'EXPLORER':
          navigate('/dashboard/explorer/overview');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.detail ||
          (Array.isArray(err.response?.data?.email)
            ? err.response?.data?.email[0]
            : err.response?.data?.message) ||
          'Login failed. Please check your credentials.';
        setError(msg);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" textAlign="center" mb={3}>
          Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            fullWidth
            margin="normal"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Box mt={3}>
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
          </Box>
        </form>

        <Box mt={2} textAlign="center">
          <Link component={RouterLink} to="/password-reset">
            Forgot Password?
          </Link>
        </Box>

        <Typography variant="body2" mt={3} textAlign="center">
          Don&apos;t have an account?{' '}
          <Link component={RouterLink} to="/register">
            Register
          </Link>
        </Typography>
      </Paper>
    </Container>
  );
}
