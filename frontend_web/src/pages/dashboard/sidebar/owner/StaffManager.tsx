// src/pages/dashboard/sidebar/owner/StaffManager.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { Role, WorkType, MembershipDTO, coerceRole, coerceWorkType, surface } from "./types";
import { useTheme } from "@mui/material/styles";

type Staff = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  workType: WorkType;
};

export default function StaffManager({
  memberships,
}: {
  memberships: MembershipDTO[];
}) {
  // derive staff from memberships
  const derivedStaff: Staff[] = useMemo(() => {
    return (memberships || []).map((m) => {
      const fullName =
        m.invited_name ||
        m.name ||
        [m.user_details?.first_name, m.user_details?.last_name].filter(Boolean).join(" ") ||
        "Team Member";
      const email = m.user_details?.email || m.email;
      return {
        id: m.id,
        name: fullName,
        email,
        role: coerceRole(m.role),
        workType: coerceWorkType(m.employment_type),
      };
    });
  }, [memberships]);

  const [list, setList] = useState<Staff[]>(derivedStaff);
  useEffect(() => setList(derivedStaff), [derivedStaff]);

  const [sortBy, setSortBy] = useState<"role" | "workType">("role");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [filterWork, setFilterWork] = useState<WorkType | "ALL">("ALL");

  const data = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1));
    return copy.filter((s) => (filterRole === "ALL" || s.role === filterRole) && (filterWork === "ALL" || s.workType === filterWork));
  }, [list, sortBy, filterRole, filterWork]);

  const addManual = () => {
    const name = window.prompt("Name?");
    if (!name) return;
    setList((l) => [...l, { id: Date.now(), name, role: "ASSISTANT", workType: "CASUAL" }]);
  };
  const remove = (id: string | number) => setList((l) => l.filter((x) => x.id !== id));
  const editName = (id: string | number) => {
    const name = window.prompt("New name?");
    if (!name) return;
    setList((l) => l.map((x) => (x.id === id ? { ...x, name } : x)));
  };

  const t = useTheme(); const s = surface(t);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setSortBy("role")}>
          Sort: Role
        </Button>
        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={() => setSortBy("workType")}>
          Sort: Work Type
        </Button>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="role-filter">Filter role</InputLabel>
          <Select labelId="role-filter" label="Filter role" value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)}>
            <MenuItem value="ALL">All roles</MenuItem>
            <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
            <MenuItem value="TECHNICIAN">Technician</MenuItem>
            <MenuItem value="ASSISTANT">Assistant</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="work-filter">Filter work type</InputLabel>
          <Select labelId="work-filter" label="Filter work type" value={filterWork} onChange={(e) => setFilterWork(e.target.value as any)}>
            <MenuItem value="ALL">All work types</MenuItem>
            <MenuItem value="FULL_TIME">Full-time</MenuItem>
            <MenuItem value="PART_TIME">Part-time</MenuItem>
            <MenuItem value="CASUAL">Casual</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addManual}>
          Add
        </Button>
      </Stack>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {data.map((s) => (
          <Card key={s.id} variant="outlined" sx={{ flex: "1 1 420px", maxWidth: 560, background: s ? s : undefined }}>
            <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <Chip label={s.role} color={s.role === "PHARMACIST" ? "success" : s.role === "TECHNICIAN" ? "info" : "warning"} />
              <Chip label={s.workType.replace("_", " ")} variant="outlined" />
              <Box sx={{ ml: 1 }}>
                <Typography fontWeight={600}>{s.name}</Typography>
                {s.email && <Typography variant="body2" sx={{ color: surface(useTheme()).textMuted }}>{s.email}</Typography>}
              </Box>
              <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                <Tooltip title="Edit name">
                  <IconButton onClick={() => editName(s.id)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton color="error" onClick={() => remove(s.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
