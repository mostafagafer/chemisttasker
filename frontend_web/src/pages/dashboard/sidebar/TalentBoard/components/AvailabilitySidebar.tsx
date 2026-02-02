import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useMemo, useState } from "react";
import { Candidate } from "../types";

export default function AvailabilitySidebar({
  candidate,
  onClose,
  canRequestBooking = false,
  onRequestBooking,
  currentUserId,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  canRequestBooking?: boolean;
  onRequestBooking?: (candidate: Candidate) => void;
  currentUserId?: number | null;
}) {
  if (!candidate) return null;

  const today = new Date();
  const daysInView = 28;
  const calendarGrid: Array<{ dayNum: number; isAvailable: boolean; date: Date }> = [];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isOwnPost = currentUserId != null && candidate.authorUserId === currentUserId;

  for (let i = 0; i < daysInView; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const isAvailable = candidate.availableDates.includes(dateStr);
    calendarGrid.push({ date, dayNum: date.getDate(), isAvailable });
  }

  const slotsForSelected = useMemo(() => {
    if (!selectedDate) return [];
    return (candidate.availableSlots || []).filter((slot) => slot.date === selectedDate);
  }, [candidate.availableSlots, selectedDate]);

  return (
    <Drawer anchor="right" open onClose={onClose}>
      <Box sx={{ width: 320, display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
        <Box
          sx={(theme) => ({
            px: 2.5,
            py: 2,
            bgcolor: theme.palette.mode === "dark"
              ? alpha(theme.palette.common.white, 0.04)
              : theme.palette.action.hover,
            borderBottom: 1,
            borderColor: "divider",
          })}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Availability
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ p: 2.5, flex: 1, overflowY: "auto" }}>
          <Box
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08),
              border: 1,
              borderColor: alpha(theme.palette.primary.main, 0.35),
              p: 1.5,
              borderRadius: 2,
              mb: 2,
            })}
          >
            <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ mb: 0.5 }}>
              Availability
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Dates selected in the pitch calendar.
            </Typography>
            {selectedDate && slotsForSelected.length > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {slotsForSelected.map((slot, idx) => {
                  const start = slot.startTime ?? (slot as any).start_time ?? null;
                  const end = slot.endTime ?? (slot as any).end_time ?? null;
                  return (
                    <Typography key={`${slot.date}-${idx}`} variant="caption" color="text.secondary">
                      {slot.date}{" "}
                      {slot.isAllDay
                        ? "- All Day"
                        : start && end
                          ? `- ${start}-${end}`
                          : "- Time not set"}
                    </Typography>
                  );
                })}
              </Stack>
            )}
            {!selectedDate && (candidate.availableSlots?.length || 0) > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Select a date to see the time slot.
              </Typography>
            )}
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
            {calendarGrid.map((day, idx) => {
              const dateStr = day.date.toISOString().split("T")[0];
              const isSelected = selectedDate === dateStr;
              return (
                <Box
                  key={idx}
                  title={day.date.toDateString()}
                  onClick={() => {
                    if (!day.isAvailable) return;
                    setSelectedDate(dateStr);
                  }}
                  sx={(theme) => ({
                    aspectRatio: "1 / 1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 1.5,
                    fontSize: 12,
                    border: 1,
                    borderColor: isSelected
                      ? theme.palette.primary.main
                      : day.isAvailable
                        ? alpha(theme.palette.success.main, 0.6)
                        : theme.palette.divider,
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.25 : 0.18)
                      : day.isAvailable
                        ? alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.22 : 0.16)
                        : theme.palette.mode === "dark"
                          ? alpha(theme.palette.common.white, 0.03)
                          : theme.palette.action.hover,
                    color: day.isAvailable ? theme.palette.success.main : theme.palette.text.disabled,
                    fontWeight: day.isAvailable ? 700 : 400,
                    cursor: day.isAvailable ? "pointer" : "default",
                  })}
                >
                  {day.dayNum}
                </Box>
              );
            })}
          </Box>

          <Stack direction="row" justifyContent="center" spacing={2} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={(theme) => ({
                  width: 12,
                  height: 12,
                  bgcolor: alpha("#22c55e", theme.palette.mode === "dark" ? 0.2 : 0.16),
                  border: 1,
                  borderColor: alpha("#22c55e", 0.6),
                  borderRadius: 0.5,
                })}
              />
              <Typography variant="caption" color="text.secondary">
                Available
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={(theme) => ({
                  width: 12,
                  height: 12,
                  bgcolor: theme.palette.mode === "dark"
                    ? alpha(theme.palette.common.white, 0.03)
                    : theme.palette.action.hover,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 0.5,
                })}
              />
              <Typography variant="caption" color="text.secondary">
                Unavailable
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Divider />
        {!isOwnPost && (
          <Box sx={{ p: 2.5 }}>
            <Button
              fullWidth
              variant="contained"
              disabled={!canRequestBooking || !selectedDate}
              onClick={() => onRequestBooking?.(candidate)}
            >
              Request Booking
            </Button>
            {!canRequestBooking && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", textAlign: "center" }}>
                Owners and admins only.
              </Typography>
            )}
            {canRequestBooking && !selectedDate && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", textAlign: "center" }}>
                Select a date to request booking.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
