import { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Typography, Skeleton, Alert, Container, Button
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
  role?: string;
};

type ShiftSummary = {
  id: number;
  pharmacy_name: string;
  date: string;
};

// Make fields optional so Explorer responses (which are minimal) still fit
type DashboardData = {
  user: User;
  message?: string;
  upcoming_shifts_count?: number;
  confirmed_shifts_count?: number;
  community_shifts_count?: number;
  shifts?: ShiftSummary[];
  community_shifts?: ShiftSummary[];
  bills_summary?: Record<string, string>;
};

export default function OverviewPageStaff() {
  const { user } = useAuth() as { user: User };
  const role = (user?.role || "").toLowerCase();
  const isPharmacist = role === "pharmacist";
  const isOtherStaff = role === "otherstaff";
  const isExplorer = role === "explorer";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // Pick endpoint per role
    const endpoint = isPharmacist
      ? API_ENDPOINTS.pharmacistDashboard
      : isOtherStaff
      ? API_ENDPOINTS.otherStaffDashboard
      : isExplorer
      ? API_ENDPOINTS.explorerDashboard
      : API_ENDPOINTS.otherStaffDashboard; // safe fallback

    apiClient
      .get(endpoint)
      .then((response) => {
        setData(response.data);
        setError(null);
      })
      .catch((err) => {
        // If you want: try Explorer endpoint automatically when 403 returned from staff endpoints
        if (!isExplorer && err?.response?.status === 403) {
          return apiClient.get(API_ENDPOINTS.explorerDashboard).then((r2) => {
            setData(r2.data);
            setError(null);
          });
        }
        setError("Error loading dashboard.");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [isPharmacist, isOtherStaff, isExplorer]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* skeleton unchanged */}
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

  // If Explorer: render a very simple overview and bail out early
  if (isExplorer) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          Welcome, {data?.user?.first_name || data?.user?.username || "Explorer"}
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body1" sx={{ mb: 1 }}>
              {data?.message || "Your Explorer dashboard is coming soon."}
            </Typography>
            {/* Add quick links if you want */}
            {/* <Button component={Link} to="/onboarding" variant="contained">Complete Onboarding</Button> */}
          </CardContent>
        </Card>
      </Container>
    );
  }

  // Staff/Pharmacist view (unchanged)
  const shifts: ShiftSummary[] = data?.shifts ?? [];
  const communityShifts: ShiftSummary[] = data?.community_shifts ?? [];
  const roleForLinks = isPharmacist ? "pharmacist" : "otherstaff";

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Welcome back, {data?.user?.first_name || data?.user?.username || "Staff"}
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
                  to={`/dashboard/${roleForLinks}/shifts/${shift.id}`}
                  sx={{ ml: 2 }}
                >
                  View
                </Button>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

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
                  to={`/dashboard/${roleForLinks}/community-shifts/${shift.id}`}
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
