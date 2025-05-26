import React, { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import axios from "axios";
import apiClient from "../utils/apiClient";
import { API_ENDPOINTS } from "../constants/api";
import {
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Box,
  Link,
} from "@mui/material";

type Role = "OWNER" | "PHARMACIST" | "OTHER_STAFF" | "EXPLORER";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    role: Role;
  }>({
    email: "",
    password: "",
    confirmPassword: "",
    role: "OWNER",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // basic front-end validation
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
      // map confirmPassword → confirm_password
      const payload = {
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        role: formData.role,
      };

      await apiClient.post(API_ENDPOINTS.register, payload);
      alert("Account created successfully! Please check your email for the verification code.");
      navigate("/otp-verify", { state: { email: formData.email } });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, string[]>;
        const firstKey = Object.keys(data)[0];
        const firstMsg = Array.isArray(data[firstKey])
          ? data[firstKey][0]
          : data[firstKey];
        setError(firstMsg || "Registration failed. Please check your input.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" mb={2} textAlign="center">
          Create Account
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleRegister}>
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <TextField
            fullWidth
            margin="normal"
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />

          <TextField
            fullWidth
            margin="normal"
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
          />

          <Typography mt={2} mb={1}>
            Select Role:
          </Typography>
          <ToggleButtonGroup
            fullWidth
            color="primary"
            exclusive
            value={formData.role}
            onChange={(_, newRole) => {
              if (newRole) {
                setFormData({ ...formData, role: newRole as Role });
              }
            }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="OWNER">Pharmacy Owner</ToggleButton>
            <ToggleButton value="PHARMACIST">Pharmacist</ToggleButton>
            <ToggleButton value="OTHER_STAFF">Other Staff</ToggleButton>
            <ToggleButton value="EXPLORER">Explorer</ToggleButton>
          </ToggleButtonGroup>

          <Box mt={3}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5, mt: 1 }}
            >
              {loading ? <CircularProgress size={24} /> : "Register"}
            </Button>
          </Box>
        </form>

        <Typography variant="body2" mt={3} textAlign="center">
          Already have an account?{" "}
          <Link component={RouterLink} to="/login">
            Login
          </Link>
        </Typography>
      </Paper>
    </Container>
  );
}
