import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Link,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';
import { ORG_ROLES } from '../constants/roles';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../layouts/AuthLayout';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // All your state and logic functions are unchanged
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        { email: email.toLowerCase(), password }
      );
      const { access, refresh, user: userInfo } = data;
      if (!access || !refresh) {
        throw new Error('Both access and refresh tokens are required');
      }

      login(access, refresh, userInfo);

      const isOrgMember = Array.isArray(userInfo?.memberships)
        ? userInfo.memberships.some((m: any) => m?.role && ORG_ROLES.includes(m.role))
        : false;

      if (isOrgMember) {
        navigate('/dashboard/organization/overview');
        return;
      }

      // If Pharmacy Admin (membership-based), land on Owner dashboard
      const isPharmacyAdmin = Array.isArray(userInfo?.memberships)
        ? userInfo.memberships.some((m: any) => m?.role === 'PHARMACY_ADMIN')
        : false;
      if (isPharmacyAdmin) {
        navigate('/dashboard/owner/overview');
        return;
      }

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
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.detail ||
          (Array.isArray(err.response?.data?.email)
            ? err.response?.data?.email[0]
            : err.response?.data?.message) ||
          'Login failed. Please check your credentials.';
        setError(msg);

        if (
          msg &&
          msg.toLowerCase().includes("please verify your email address")
        ) {
          navigate("/otp-verify", { state: { email: email.toLowerCase() } });
        }

      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back">
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
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          autoComplete="username"
        />

        <TextField
          fullWidth
          margin="normal"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((show) => !show)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box mt={3}>
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ 
              py: 1.5,
              backgroundColor: '#00a99d', // Themed button color
              '&:hover': {
                  backgroundColor: '#00877d'
              }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
          </Button>
        </Box>
      </form>

      <Box mt={2} textAlign="center">
        <Link component={RouterLink} to="/password-reset" color="#00a99d">
          Forgot Password?
        </Link>
      </Box>

      <Typography variant="body2" mt={3} textAlign="center">
        Don&apos;t have an account?{' '}
        <Link component={RouterLink} to="/register" fontWeight="bold" color="#00a99d">
          Register
        </Link>
      </Typography>
    </AuthLayout>
  );
}