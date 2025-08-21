import { Box, Button, Stack, TextField, Typography } from "@mui/material";

export default function RefereesV2() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Referees (V2)</Typography>
      <Stack spacing={2}>
        <Typography variant="body2">Add Workplace field per referee (placeholder UI).</Typography>

        <Stack spacing={2} sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
          <TextField fullWidth label="Full name" />
          <TextField fullWidth label="Relationship" />
          <TextField fullWidth label="Phone" />
          <TextField fullWidth label="Email" />
          <TextField fullWidth label="Workplace" />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined">Remove</Button>
            <Button variant="contained">Save (placeholder)</Button>
          </Stack>
        </Stack>

        <Button variant="outlined">+ Add referee</Button>
      </Stack>
    </Box>
  );
}
