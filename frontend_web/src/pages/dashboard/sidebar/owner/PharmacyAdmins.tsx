// src/pages/dashboard/sidebar/owner/PharmacyAdmins.tsx
import { useState } from "react";
import { Alert, Box, Card, CardContent, CardHeader, Chip, Divider, IconButton, Tooltip, Typography, Button } from "@mui/material";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SecurityIcon from "@mui/icons-material/Security";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTheme } from "@mui/material/styles";
import { surface } from "./types";

function uid() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function AddAdminInline({ pharmacyId, onAdd }: { pharmacyId: string; onAdd: (a: any) => void }) {
  const add = () => {
    const name = window.prompt("Admin name?");
    const email = window.prompt("Admin email?");
    if (!name || !email) return;
    onAdd({ id: uid(), name, email, pharmacies: [pharmacyId] });
  };
  return (
    <Button variant="contained" startIcon={<ManageAccountsIcon />} onClick={add}>
      Add Admin
    </Button>
  );
}

export default function PharmacyAdmins({ pharmacy }: { pharmacy: { id: string; name: string } }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const t = useTheme(); const s = surface(t);

  const addAdmin = (a: any) => setAdmins((curr) => [...curr, a]);
  const removeAdmin = (id: string) => setAdmins((a) => a.filter((x) => x.id !== id));

  return (
    <Card variant="outlined" sx={{ background: s.bg, borderColor: s.border }}>
      <CardHeader title={`Admins for ${pharmacy.name}`} />
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: s.textMuted }}>
            Scoped admins can manage this pharmacy only.
          </Typography>
          <AddAdminInline pharmacyId={pharmacy.id} onAdd={addAdmin} />
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {admins.length === 0 && (
            <Alert sx={{ flex: "1 1 420px", maxWidth: 560 }} severity="info">
              No admins yet. Add one with the button above.
            </Alert>
          )}
          {admins.map((a) => (
            <Card key={a.id} variant="outlined" sx={{ flex: "1 1 420px", maxWidth: 560, background: s.bg, borderColor: s.border }}>
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Chip label="PHARMACY ADMIN" color="secondary" />
                <Box sx={{ ml: 1 }}>
                  <Typography fontWeight={600}>{a.name}</Typography>
                  <Typography variant="body2" sx={{ color: s.textMuted }}>
                    {a.email}
                  </Typography>
                </Box>
                <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                  <Tooltip title="Permissions">
                    <IconButton>
                      <SecurityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton color="error" onClick={() => removeAdmin(a.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
