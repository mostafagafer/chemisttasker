import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Candidate } from "../types";

export default function AvailabilitySidebar({
  candidate,
  onClose,
}: {
  candidate: Candidate | null;
  onClose: () => void;
}) {
  if (!candidate) return null;

  const today = new Date();
  const daysInView = 28;
  const calendarGrid: Array<{ dayNum: number; isAvailable: boolean; date: Date }> = [];

  for (let i = 0; i < daysInView; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const isAvailable = candidate.availableDates.includes(dateStr);
    calendarGrid.push({ date, dayNum: date.getDate(), isAvailable });
  }

  return (
    <Drawer anchor="right" open onClose={onClose}>
      <Box sx={{ width: 320, display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ px: 2.5, py: 2, bgcolor: "grey.50", borderBottom: 1, borderColor: "grey.200" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Availability
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {candidate.refId} • {candidate.role}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ p: 2.5, flex: 1, overflowY: "auto" }}>
          <Box sx={{ bgcolor: "primary.50", border: 1, borderColor: "primary.100", p: 1.5, borderRadius: 2, mb: 2 }}>
            <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ mb: 0.5 }}>
              Typical Pattern:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {candidate.availabilityText}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1 }}>
            Next 4 Weeks
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mt: 1 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
              <Typography key={d} variant="caption" color="text.disabled" textAlign="center" fontWeight={700}>
                {d}
              </Typography>
            ))}
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mt: 0.5 }}>
            {calendarGrid.map((day, idx) => (
              <Box
                key={idx}
                title={day.date.toDateString()}
                sx={{
                  aspectRatio: "1 / 1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 1.5,
                  fontSize: 12,
                  border: 1,
                  borderColor: day.isAvailable ? "success.light" : "grey.200",
                  bgcolor: day.isAvailable ? "success.50" : "grey.50",
                  color: day.isAvailable ? "success.dark" : "text.disabled",
                  fontWeight: day.isAvailable ? 700 : 400,
                }}
              >
                {day.dayNum}
              </Box>
            ))}
          </Box>

          <Stack direction="row" justifyContent="center" spacing={2} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: "success.50", border: 1, borderColor: "success.light", borderRadius: 0.5 }} />
              <Typography variant="caption" color="text.secondary">
                Available
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: "grey.50", border: 1, borderColor: "grey.200", borderRadius: 0.5 }} />
              <Typography variant="caption" color="text.secondary">
                Unavailable
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Divider />
        <Box sx={{ p: 2.5 }}>
          <Button fullWidth variant="contained">
            Request Booking
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
