// src/pages/dashboard/sidebar/owner/TopBar.tsx
import { Box, Breadcrumbs, Button, IconButton, TextField, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import { alpha, useTheme } from "@mui/material/styles";
import { surface } from "./types";

export default function TopBar({ onBack, breadcrumb }: { onBack?: () => void; breadcrumb?: string[] }) {
  const t = useTheme();
  const s = surface(t);
  return (
    <Box
      position="sticky"
      top={0}
      zIndex={10}
      sx={{
        backdropFilter: "blur(6px)",
        backgroundColor: alpha(t.palette.background.paper, 0.85),
        borderBottom: `1px solid ${s.border}`,
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 2 }}>
        {onBack && (
          <Button variant="outlined" size="small" onClick={onBack}>
            ← Back
          </Button>
        )}
        <Breadcrumbs separator={<span>/</span>} aria-label="breadcrumb">
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <HomeIcon fontSize="small" />
            <Typography variant="body2" sx={{ color: s.textMuted }}>
              Home
            </Typography>
          </Box>
          {breadcrumb?.map((b, i) => (
            <Typography key={i} variant="body2" sx={{ color: s.textMuted }}>
              {b}
            </Typography>
          ))}
        </Breadcrumbs>
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search…"
            sx={{
              "& .MuiInputBase-root": { backgroundColor: s.bg },
            }}
          />
          <IconButton>
            <SearchIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
