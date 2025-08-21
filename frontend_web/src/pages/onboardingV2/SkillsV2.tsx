import { Box, Button, Stack, TextField, Typography, Chip } from "@mui/material";

export default function SkillsV2() {
  // Placeholder: your real skills list & per-skill doc uploads will go here
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Skills (V2)</Typography>
      <Stack spacing={2}>
        <Typography variant="body2">
          When a user selects a skill, they must upload the relevant training/document (placeholder UI).
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip label="Immunisation" />
          <Chip label="Opioid Substitution" />
          <Chip label="Aseptic Compounding" />
        </Stack>
        <TextField fullWidth label="Upload placeholder: e.g. Training_Cert.pdf" />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="contained">Save (placeholder)</Button>
        </Stack>
      </Stack>
    </Box>
  );
}
