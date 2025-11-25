import React, { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import {
  Button,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Box,
  Link,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import apiClient from "../utils/apiClient";
import { API_ENDPOINTS } from "../constants/api";
import AuthLayout from "../layouts/AuthLayout"; // Import the new layout

type Role = "OWNER" | "PHARMACIST" | "OTHER_STAFF" | "EXPLORER";

export default function Register() {
  const navigate = useNavigate();
  // ... (all your existing useState hooks are unchanged)
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    role: Role;
  }>({ email: "", password: "", confirmPassword: "", role: "OWNER", });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [captchaValue, setCaptchaValue] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // --- THIS ENTIRE LOGIC FUNCTION IS UNCHANGED ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setError("");
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        email: formData.email.toLowerCase(),
        password: formData.password,
        confirm_password: formData.confirmPassword,
        role: formData.role,
        accepted_terms: acceptedTerms,
        captcha_token: captchaValue,
      };
      await apiClient.post(API_ENDPOINTS.register, payload);
      alert("Account created successfully! Please check your email for the verification code.");
      navigate("/otp-verify", { state: { email: formData.email.toLowerCase() } });
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, string[]>;
        if (data?.email && (data.email[0]?.toLowerCase().includes("unique") || data.email[0]?.toLowerCase().includes("already"))) {
          setError("This email is already registered.");
        } else {
          const firstKey = Object.keys(data || {})[0];
          const firstMsg = Array.isArray(data?.[firstKey])
            ? data[firstKey][0]
            : data?.[firstKey];
          setError(firstMsg || "Registration failed. Please check your input.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account">
      {error && (
        <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleRegister}>
        {/* ... (all your TextField, ToggleButtonGroup, and other form elements are unchanged) */}
        <TextField fullWidth margin="normal" label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })} autoComplete="username" />
        <TextField fullWidth margin="normal" label="Password" type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} autoComplete="new-password" InputProps={{ endAdornment: ( <InputAdornment position="end"> <IconButton onClick={() => setShowPassword((show) => !show)} edge="end"> {showPassword ? <VisibilityOff /> : <Visibility />} </IconButton> </InputAdornment> ), }} />
        <TextField fullWidth margin="normal" label="Confirm Password" type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} autoComplete="new-password" InputProps={{ endAdornment: ( <InputAdornment position="end"> <IconButton onClick={() => setShowConfirmPassword((show) => !show)} edge="end"> {showConfirmPassword ? <VisibilityOff /> : <Visibility />} </IconButton> </InputAdornment> ), }} />
        <Typography mt={2} mb={1}> Select Role: </Typography>
        <ToggleButtonGroup fullWidth color="primary" exclusive value={formData.role} onChange={(_, newRole) => { if (newRole) { setFormData({ ...formData, role: newRole as Role }); } }} sx={{ mb: 2 }} >
          <ToggleButton value="OWNER">Pharmacy Owner</ToggleButton>
          <ToggleButton value="PHARMACIST">Pharmacist</ToggleButton>
          <ToggleButton value="OTHER_STAFF">Other Staff</ToggleButton>
          <ToggleButton value="EXPLORER">Explorer</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel control={ <Checkbox checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} required /> } label={ <span> I agree to the{" "} <RouterLink to="/terms-of-service" target="_blank"> Terms of Service </RouterLink> </span> } />
        <Box mb={2} display="flex" justifyContent="center"> <ReCAPTCHA sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY} onChange={setCaptchaValue} /> </Box>
        {hasSubmitted && !acceptedTerms && ( <Alert severity="warning" sx={{ mt: 2 }}> You must accept the Terms of Service to register. </Alert> )}
        {hasSubmitted && !captchaValue && ( <Alert severity="warning" sx={{ mt: 2 }}> Please complete the CAPTCHA to register. </Alert> )}
        <Box mt={3}>
          <Button type="submit" fullWidth variant="contained" disabled={loading || !acceptedTerms || !captchaValue} sx={{ py: 1.5, mt: 1, backgroundColor: '#00a99d', '&:hover': {backgroundColor: '#00877d'} }} >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Register"}
          </Button>
        </Box>
      </form>

      <Typography variant="body2" mt={3} textAlign="center">
        Already have an account?{" "}
        <Link component={RouterLink} to="/login" fontWeight="bold" color="#00a99d">
          Login
        </Link>
      </Typography>
    </AuthLayout>
  );
}