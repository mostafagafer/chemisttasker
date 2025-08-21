import { Box, Button, FormControlLabel, Checkbox, Stack, TextField, Typography, Divider } from "@mui/material";

export default function PaymentV2() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Payment (V2)</Typography>

      {/* ABN or TFN paths (placeholder UI) */}
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>ABN Path</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="ABN" />
            <FormControlLabel control={<Checkbox />} label="GST registered" />
            <FormControlLabel control={<Checkbox />} label="Plus Super" />
            <Stack spacing={2} sx={{ pl: 3 }}>
              <TextField fullWidth label="USI" />
              <TextField fullWidth label="Super fund name" />
              <TextField fullWidth label="Member number" />
            </Stack>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>TFN Path</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="TFN (Tax File Number)" />
            <TextField fullWidth label="USI" />
            <TextField fullWidth label="Super fund name" />
            <TextField fullWidth label="Member number" />
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Rates (V2)</Typography>
          <Typography variant="body2">Add $ prefix to rate inputs; allow “tie Late/Early to Day” per day (placeholder).</Typography>
          <Stack spacing={2}>
            <TextField fullWidth label="$ Sunday - Day rate" />
            <FormControlLabel control={<Checkbox />} label="Tie Late Night & Early Morning to Sunday Day rate" />
            <TextField fullWidth label="$ Sunday - Late Night rate" />
            <TextField fullWidth label="$ Sunday - Early Morning rate" />
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="contained">Save (placeholder)</Button>
        </Stack>
      </Stack>
    </Box>
  );
}
