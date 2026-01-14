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
    Grid,
    Divider,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';
import { ORG_ROLES } from '../constants/roles';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../layouts/AuthLayout';

const PERSONA_KEY_PREFIX = 'ct-active-persona';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const executeLogin = async (loginEmail: string, loginPass: string) => {
        if (!loginEmail || !loginPass) {
            setError('Please enter both email and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data } = await axios.post(
                `${API_BASE_URL}${API_ENDPOINTS.login}`,
                { email: loginEmail.toLowerCase(), password: loginPass }
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

            const resolveStaffPath = (role: string | undefined | null) => {
                switch (role) {
                    case 'OWNER':
                        return '/dashboard/owner/overview';
                    case 'PHARMACIST':
                        return '/dashboard/pharmacist/overview';
                    case 'OTHER_STAFF':
                        return '/dashboard/otherstaff/overview';
                    case 'ORG_STAFF':
                        return '/dashboard/organization/overview';
                    case 'EXPLORER':
                        return '/dashboard/explorer/overview';
                    default:
                        return '/';
                }
            };

            const personaKey =
                typeof userInfo?.id === 'number'
                    ? `${PERSONA_KEY_PREFIX}:${userInfo.id}`
                    : PERSONA_KEY_PREFIX;
            const storedPersona = personaKey ? localStorage.getItem(personaKey) : null;
            const adminAssignments = Array.isArray(userInfo?.admin_assignments)
                ? userInfo.admin_assignments
                : [];

            const findAssignmentById = (assignmentId: number) =>
                adminAssignments.find((assignment: any) => assignment?.id === assignmentId);

            let redirectPath: string | null = null;

            if (storedPersona?.startsWith('ADMIN:')) {
                const storedId = Number(storedPersona.split(':')[1]);
                const matchedAssignment = Number.isFinite(storedId) ? findAssignmentById(storedId) : null;
                const fallbackAssignment = adminAssignments.find(
                    (assignment: any) => typeof assignment?.pharmacy_id === 'number'
                );
                const targetAssignment = matchedAssignment ?? fallbackAssignment ?? null;

                if (targetAssignment?.pharmacy_id != null) {
                    redirectPath = `/dashboard/admin/${targetAssignment.pharmacy_id}/overview`;
                } else if (personaKey) {
                    localStorage.removeItem(personaKey);
                }
            } else if (storedPersona?.startsWith('ROLE:')) {
                const storedRole = storedPersona.split(':')[1];
                if (storedRole === 'PHARMACIST' && userInfo.role === 'PHARMACIST') {
                    redirectPath = '/dashboard/pharmacist/overview';
                } else if (storedRole === 'OTHER_STAFF' && userInfo.role === 'OTHER_STAFF') {
                    redirectPath = '/dashboard/otherstaff/overview';
                } else if (storedRole === 'OWNER' && userInfo.role === 'OWNER') {
                    redirectPath = '/dashboard/owner/overview';
                } else if (personaKey) {
                    localStorage.removeItem(personaKey);
                }
            }

            if (!redirectPath) {
                redirectPath = resolveStaffPath(userInfo.role);
            }

            navigate(redirectPath);
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
                    navigate("/otp-verify", { state: { email: loginEmail.toLowerCase() } });
                }

            } else {
                setError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        executeLogin(email, password);
    };

    const handleDemoLogin = (role: string) => {
        console.log(`Switching to ${role}`);
        localStorage.setItem('demo_role', role);
        // Set fixed demo credentials that match the mock expectations if needed,
        // or just anything since mock accepts anything.
        // We set email to match the role mostly for visual consistency if we wanted to populate the field.
        const demoEmail = `${role.toLowerCase().replace('_', '')}@demo.com`;
        setEmail(demoEmail);
        setPassword('demo123');
        executeLogin(demoEmail, 'demo123');
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

            <Box mt={4} mb={2}>
                <Divider>DEMO ACCESS</Divider>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mb={2}>
                Select a role to login instantly (Mock Data)
            </Typography>

            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <Button variant="outlined" fullWidth onClick={() => handleDemoLogin('OWNER')}>
                        Unknown Owner
                    </Button>
                </Grid>
                <Grid item xs={6}>
                    <Button variant="outlined" fullWidth onClick={() => handleDemoLogin('ORG_ADMIN')}>
                        Org Admin
                    </Button>
                </Grid>
                <Grid item xs={6}>
                    <Button variant="outlined" fullWidth onClick={() => handleDemoLogin('PHARMACIST')}>
                        Pharmacist
                    </Button>
                </Grid>
                <Grid item xs={6}>
                    <Button variant="outlined" fullWidth onClick={() => handleDemoLogin('OTHER_STAFF')}>
                        Assistant/Intern
                    </Button>
                </Grid>
            </Grid>

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
