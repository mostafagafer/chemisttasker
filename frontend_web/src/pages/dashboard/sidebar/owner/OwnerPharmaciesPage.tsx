// src/pages/dashboard/sidebar/owner/OwnerPharmaciesPage.tsx
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import DomainIcon from "@mui/icons-material/Domain";
import { PharmacyDTO, surface } from "./types";
import { useTheme } from "@mui/material/styles";

export default function OwnerPharmaciesPage({
  pharmacies,
  staffCounts,
  onOpenPharmacy,
  onOpenAdmins: _onOpenAdmins,
  onEditPharmacy,
  onDeletePharmacy,
}: {
  pharmacies: PharmacyDTO[];
  staffCounts: Record<string, number>;
  onOpenPharmacy: (pharmacyId: string) => void;
  onOpenAdmins?: (pharmacyId: string) => void;
  onEditPharmacy?: (pharmacy: PharmacyDTO) => void;
  onDeletePharmacy?: (pharmacyId: string) => void;
}) {
  const t = useTheme();
  const s = surface(t);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {pharmacies.map((p) => {
          const address = [p.street_address, p.suburb].filter(Boolean).join(", ");
          return (
            <Card
              key={p.id}
              variant="outlined"
              sx={{ flex: "1 1 420px", maxWidth: 560, background: s.bg, borderColor: s.border }}
            >
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: s.hover }}>
                  <DomainIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={600}>{p.name}</Typography>
                  <Typography variant="body2" sx={{ color: s.textMuted }}>
                    {address}, {p.state} {p.postcode}
                  </Typography>
                  {!!staffCounts[p.id] && (
                    <Typography variant="caption" sx={{ color: s.textMuted }}>
                      Staff: {staffCounts[p.id]}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" onClick={() => onOpenPharmacy(p.id)}>
                    Open
                  </Button>
                  {onEditPharmacy && (
                    <Button variant="outlined" size="small" onClick={() => onEditPharmacy(p)}>
                      Edit
                    </Button>
                  )}
                  {onDeletePharmacy && (
                    <Button color="error" size="small" onClick={() => onDeletePharmacy(p.id)}>
                      Delete
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
