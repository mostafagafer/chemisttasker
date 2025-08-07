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
import { API_ENDPOINTS } from "../../../constants/api";
import { useAuth } from "../../../contexts/AuthContext";

type User = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string; // for context role detection
};

type ShiftSummary = {
  id: number;
  pharmacy_name: string;
  date: string;
};

type DashboardData = {
  user: User;
  message: string;
  upcoming_shifts_count: number;
  confirmed_shifts_count: number;
  community_shifts_count: number;
  shifts: ShiftSummary[];
  community_shifts: ShiftSummary[];
  bills_summary: Record<string, string>;
};

export default function OverviewPageStaff() {
  const { user } = useAuth() as { user: User };
  const role =
    user?.role?.toLowerCase() === "pharmacist" ? "pharmacist" : "otherstaff";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const endpoint =
      role === "pharmacist"
        ? API_ENDPOINTS.pharmacistDashboard
        : API_ENDPOINTS.otherStaffDashboard;

    apiClient
      .get(endpoint)
      .then((response) => {
        setData(response.data);
        setError(null);
      })
      .catch(() => {
        setError("Error loading dashboard.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [role]);

  const shifts: ShiftSummary[] = data?.shifts ?? [];
  const communityShifts: ShiftSummary[] = data?.community_shifts ?? [];

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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Welcome back, {user?.first_name || user?.username || "Staff"}
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
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1">Open Community Shifts</Typography>
            <Typography variant="h4">{data?.community_shifts_count ?? 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Upcoming shift summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            My Upcoming Shifts
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
                component={Link}
                to={`/dashboard/shifts/${shift.id}`}
              >
                <Box flex={1}>
                  <Typography fontWeight={600}>{shift.pharmacy_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date: {shift.date || "N/A"}
                  </Typography>
                </Box>
                <Button
                  variant="text"
                  component={Link}
                  to={`/dashboard/${role}/shifts/${shift.id}`}
                  sx={{ ml: 2 }}
                >
                  View
                </Button>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Community shift summary */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Community Shifts (Open)
          </Typography>
          <Box>
            {communityShifts.length === 0 && (
              <Typography color="text.secondary">No open community shifts.</Typography>
            )}
            {communityShifts.map((shift) => (
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
                component={Link}
                to={`/dashboard/community-shifts/${shift.id}`}
              >
                <Box flex={1}>
                  <Typography fontWeight={600}>{shift.pharmacy_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date: {shift.date || "N/A"}
                  </Typography>
                </Box>
                <Button
                  variant="text"
                  component={Link}
                  to={`/dashboard/${role}/community-shifts/${shift.id}`}
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
