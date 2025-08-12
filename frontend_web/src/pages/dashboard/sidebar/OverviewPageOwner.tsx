import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Alert,
  Container,
  Button
} from "@mui/material";
import { Link } from "react-router-dom";
import apiClient from "../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../constants/api";
import { useAuth } from "../../../contexts/AuthContext";

// ---- USER TYPE ----
type User = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  // ...any other fields
};

type ShiftSummary = {
  id: number;
  pharmacy_name: string;
  date: string;
};

type DashboardData = {
  upcoming_shifts_count: number;
  confirmed_shifts_count: number;
  shifts?: ShiftSummary[];
  bills_summary: Record<string, string>;
};

export default function OverviewPage() {
  const { user } = useAuth() as { user: User };
  const [onboarding, setOnboarding] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(API_ENDPOINTS.ownerDashboard)
      .then((response) => {
        setData(response.data);
        setError(null);
      })
      .catch(() => {
        setError("Error loading dashboard.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch the latest onboarding/profile info (owner)
  useEffect(() => {
    apiClient
      .get(`${API_BASE_URL}${API_ENDPOINTS.onboardingDetail('owner')}`)
      .then((res) => setOnboarding(res.data))
      .catch(() => setOnboarding(null));
  }, []);

  const shifts: ShiftSummary[] = data?.shifts ?? [];

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Skeleton variant="text" width={220} height={40} />
            <Skeleton variant="text" width={120} />
          </Box>
          <Card sx={{ minWidth: 220, height: 100 }}>
            <CardContent>
              <Skeleton variant="text" width={120} />
              <Skeleton variant="text" width={60} />
            </CardContent>
          </Card>
        </Box>
        <Box display="flex" gap={3} mb={3}>
          <Card sx={{ flex: 1, minWidth: 120 }}>
            <CardContent>
              <Skeleton variant="text" width={100} />
              <Skeleton variant="rectangular" width={50} height={36} />
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 120 }}>
            <CardContent>
              <Skeleton variant="text" width={100} />
              <Skeleton variant="rectangular" width={50} height={36} />
            </CardContent>
          </Card>
        </Box>
        <Card>
          <CardContent>
            <Skeleton variant="text" width={180} />
            <Skeleton variant="rectangular" height={56} />
            <Skeleton variant="rectangular" height={56} />
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header row */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Welcome back, {onboarding?.first_name || onboarding?.username || user?.first_name || user?.username || "Pharmacy Owner"}
          </Typography>
        </Box>
        <Card sx={{ minWidth: 220 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              💊 Bills / Gamification
            </Typography>
            <Typography>
              Total billed: {data?.bills_summary?.total_billed ?? "—"}
            </Typography>
            <Typography>
              Points: {data?.bills_summary?.points ?? "—"}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box display="flex" gap={3} mb={3}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1">Upcoming Shifts</Typography>
            <Typography variant="h4">{data?.upcoming_shifts_count ?? 0}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1">Confirmed Shifts</Typography>
            <Typography variant="h4">{data?.confirmed_shifts_count ?? 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Shift summary list */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upcoming Shifts
          </Typography>
          <Box>
            {shifts.length === 0 && (
              <Typography color="text.secondary">No upcoming shifts.</Typography>
            )}
            {shifts.map((shift) => (
              <Box
                key={shift.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 1,
                  p: 1,
                  transition: "background 0.2s",
                  textDecoration: "none",
                  color: "inherit",
                  ":hover": { bgcolor: "#f5f5f5" },
                }}
                // NO component / to here
              >
                <Box flex={1}>
                  <Typography fontWeight={600}>{shift.pharmacy_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date: {shift.date || "N/A"}
                  </Typography>
                </Box>
                <Button
                  variant="text"
                  component={Link}                              // <- Link here
                  to={`/dashboard/owner/shifts/${shift.id}`}   // <- with to
                  sx={{ ml: 2 }}
                >
                  View
                </Button>
              </Box>
            ))}

          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
