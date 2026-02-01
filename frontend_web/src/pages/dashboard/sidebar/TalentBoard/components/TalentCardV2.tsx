import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
  Button,
} from "@mui/material";
import {
  LocationOnOutlined as LocationOnOutlinedIcon,
  FlightTakeoffOutlined as FlightTakeoffOutlinedIcon,
  Star as StarIcon,
  FavoriteBorderOutlined as FavoriteBorderOutlinedIcon,
  FavoriteRounded as FavoriteRoundedIcon,
  MailOutline as MailOutlineIcon,
  CalendarTodayOutlined as CalendarTodayOutlinedIcon,
  AccessTimeOutlined as AccessTimeOutlinedIcon,
  WorkOutline as WorkOutlineIcon,
  SchoolOutlined as SchoolOutlinedIcon,
  LocalPharmacyOutlined as LocalPharmacyOutlinedIcon,
  PersonOutline as PersonOutlineIcon,
} from "@mui/icons-material";
import { Candidate } from "../types";

export default function TalentCard({
  candidate,
  onContact,
  onViewCalendar,
  onToggleLike,
}: {
  candidate: Candidate;
  onContact: (candidate: Candidate) => void;
  onViewCalendar: (candidate: Candidate) => void;
  onToggleLike: (candidate: Candidate) => void;
}) {
  let roleColor: "primary" | "success" | "warning" = "primary";
  let RoleIcon = WorkOutlineIcon;

  if (candidate.role.includes("Student") || candidate.role.includes("Intern")) {
    roleColor = "success";
    RoleIcon = SchoolOutlinedIcon;
  } else if (candidate.role.includes("Pharmacist")) {
    roleColor = "primary";
    RoleIcon = LocalPharmacyOutlinedIcon;
  } else if (candidate.role.includes("Junior")) {
    roleColor = "warning";
    RoleIcon = PersonOutlineIcon;
  }

  const getAvailabilityLabel = () => {
    if (candidate.workTypes.includes("Full Time")) return "Status";
    if (candidate.workTypes.includes("Part Time")) return "Days";
    return "Avail";
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", position: "relative" }}>
      <Box sx={{ px: 2.5, py: 1.5, bgcolor: "grey.50", borderBottom: 1, borderColor: "grey.100" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocationOnOutlinedIcon fontSize="small" />
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {candidate.city || candidate.state}
            </Typography>
            <Chip
              size="small"
              icon={<FlightTakeoffOutlinedIcon fontSize="inherit" />}
              label={candidate.willingToTravel ? "Open to Travel" : candidate.coverageRadius}
              variant="outlined"
              sx={{ borderColor: "grey.300", color: "text.secondary" }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
            {candidate.refId}
          </Typography>
        </Stack>
      </Box>

      <CardContent sx={{ pt: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
          <Stack alignItems="center" spacing={1} sx={{ minWidth: 80 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: `${roleColor}.50`,
                border: 2,
                borderColor: `${roleColor}.100`,
              }}
            >
              <RoleIcon color={roleColor} />
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <StarIcon fontSize="small" color="warning" />
              <Typography variant="caption" fontWeight={700}>
                {candidate.ratingAverage.toFixed(1)} ({candidate.ratingCount})
              </Typography>
            </Stack>
          </Stack>

          <Box sx={{ flex: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {candidate.role}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  {candidate.headline}
                </Typography>
                {candidate.pitch ? (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic" }} color="text.secondary">
                    "{candidate.pitch}"
                  </Typography>
                ) : null}
              </Box>
              <Chip
                size="small"
                label={`Engagement: ${candidate.workTypes.length ? candidate.workTypes.join(", ") : "�"}`}
                variant="outlined"
                sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
              />
            </Stack>

            <Box sx={{ mt: 2, p: 1.5, bgcolor: "grey.50", borderRadius: 2, border: 1, borderColor: "grey.100" }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Stack direction="row" spacing={1} alignItems="center">
                  {candidate.workTypes.includes("Full Time") ? (
                    <CalendarTodayOutlinedIcon fontSize="small" color="action" />
                  ) : (
                    <AccessTimeOutlinedIcon fontSize="small" color="action" />
                  )}
                  <Typography variant="body2">
                    {getAvailabilityLabel()}: <strong>{candidate.availabilityText}</strong>
                  </Typography>
                </Stack>
                {candidate.showCalendar && (
                  <Button size="small" onClick={() => onViewCalendar(candidate)}>
                    View Calendar
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>

          <Stack spacing={1} sx={{ minWidth: 160 }}>
            <Button
              variant="contained"
              startIcon={<MailOutlineIcon />}
              onClick={() => onContact(candidate)}
            >
              Contact
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, flexWrap: "wrap" }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            Skills:
          </Typography>
          {candidate.skills.length > 0 ? (
            candidate.skills.map((skill) => <Chip key={skill} size="small" label={skill} />)
          ) : (
            <Typography variant="caption" color="text.secondary">
              --
            </Typography>
          )}
        </Stack>

        {candidate.attachments.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Attachments:
            </Typography>
            {candidate.attachments.map((att) => {
              const label = att.caption || att.file?.split("/").pop() || "Attachment";
              return (
                <Chip
                  key={att.id}
                  size="small"
                  label={label}
                  component="a"
                  href={att.file}
                  clickable
                  target="_blank"
                  rel="noreferrer"
                />
              );
            })}
          </Stack>
        )}
      </CardContent>

      <Box sx={{ position: "absolute", right: 16, bottom: 16 }}>
        <IconButton
          onClick={() => onToggleLike(candidate)}
          color={candidate.isLikedByMe ? "error" : "default"}
          size="small"
        >
          {candidate.isLikedByMe ? <FavoriteRoundedIcon /> : <FavoriteBorderOutlinedIcon />}
        </IconButton>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          {candidate.likeCount}
        </Typography>
      </Box>
    </Card>
  );
}
