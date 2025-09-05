// src/pages/dashboard/sidebar/OverviewPageOwner.tsx
// MUI-only (no <Grid/>). Works next to your existing left sidebar.
// ✅ Hooks real pharmacy + membership data (props or auto-fetch fallback)
// ✅ Dark mode contrast fixed (theme-aware colors)

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  Breadcrumbs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Tooltip,
  Stack,
  Alert,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// Icons
import HomeIcon from "@mui/icons-material/Home";
import StoreIcon from "@mui/icons-material/Store";
import DomainIcon from "@mui/icons-material/Domain";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import ListAltIcon from "@mui/icons-material/ListAlt";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import AddIcon from "@mui/icons-material/Add";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FilterListIcon from "@mui/icons-material/FilterList";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SecurityIcon from "@mui/icons-material/Security";
import KeyIcon from "@mui/icons-material/Key";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import AppsIcon from "@mui/icons-material/Apps";

// ------- OPTIONAL: keep these if you want the auto-fetch fallback -------
import apiClient from "../../../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../../../constants/api";

// ======================= Types =======================
export type Role = "PHARMACIST" | "TECHNICIAN" | "ASSISTANT" | "PHARMACY_ADMIN";
export type WorkType = "FULL_TIME" | "PART_TIME" | "CASUAL";

type PharmacyDTO = {
  id: string;
  name: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
};

type MembershipDTO = {
  id: string | number;
  role?: Role | string;
  employment_type?: WorkType | string;
  invited_name?: string;
  name?: string;
  user_details?: { email?: string; first_name?: string; last_name?: string };
  email?: string;
};

type OwnerOverviewProps = {
  // If you already have these loaded in a parent, pass them in:
  pharmacies?: PharmacyDTO[];
  membershipsByPharmacy?: Record<string, MembershipDTO[]>;
};

// ======================= Role/Work UI helpers =======================
const ROLE_CHIP_COLOR: Record<Role, "success" | "info" | "warning" | "secondary"> = {
  PHARMACIST: "success",
  TECHNICIAN: "info",
  ASSISTANT: "warning",
  PHARMACY_ADMIN: "secondary",
};

const WORK_LABEL: Record<WorkType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CASUAL: "Casual",
};

function coerceRole(raw?: string): Role {
  const r = (raw || "").toUpperCase();
  if (r.includes("PHARM")) return "PHARMACIST";
  if (r.includes("TECH")) return "TECHNICIAN";
  if (r.includes("ASSIST")) return "ASSISTANT";
  return "ASSISTANT";
}
function coerceWorkType(raw?: string): WorkType {
  const r = (raw || "").toUpperCase().replace("-", "_");
  if (r.includes("FULL")) return "FULL_TIME";
  if (r.includes("PART")) return "PART_TIME";
  return "CASUAL";
}

function uid() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function generateGenericStaffInvite(pharmacyId: string, days: number) {
  const token = uid();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return `https://chemisttasker.com/invite/${token}?exp=${expiresAt}&generic=true&ownerApproval=true&scope=${encodeURIComponent(
    pharmacyId
  )}`;
}

// ======================= Theming helpers (dark-mode safe) =======================
const surface = (t: any) => ({
  bg: t.palette.background.paper,
  subtle: alpha(t.palette.text.primary, 0.04), // mild tint that works in dark & light
  hover: alpha(t.palette.primary.main, 0.08),
  border: t.palette.divider,
  textMuted: alpha(t.palette.text.primary, 0.7),
});

// ======================= UI bits =======================
function IconCard({
  title,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      sx={(t) => ({
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        backgroundColor: surface(t).bg,
        borderColor: surface(t).border,
        transition: "all .15s",
        ":hover": { boxShadow: onClick ? 6 : undefined, backgroundColor: surface(t).subtle },
      })}
      variant="outlined"
    >
      <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={(t) => ({ p: 1.2, borderRadius: 2, bgcolor: surface(t).hover })}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={600}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" sx={(t) => ({ mt: 0.5, color: surface(t).textMuted })}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <ChevronRightIcon sx={(t) => ({ ml: "auto", color: surface(t).textMuted })} />
      </CardContent>
    </Card>
  );
}

function TopBar({ onBack, breadcrumb }: { onBack?: () => void; breadcrumb?: string[] }) {
  return (
    <Box
      position="sticky"
      top={0}
      zIndex={10}
      sx={(t) => ({
        backdropFilter: "blur(6px)",
        backgroundColor: alpha(t.palette.background.paper, 0.85),
        borderBottom: `1px solid ${surface(t).border}`,
      })}
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
            <Typography variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
              Home
            </Typography>
          </Box>
          {breadcrumb?.map((b, i) => (
            <Typography key={i} variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
              {b}
            </Typography>
          ))}
        </Breadcrumbs>
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search…"
            sx={(t) => ({
              "& .MuiInputBase-root": { backgroundColor: surface(t).bg },
            })}
          />
          <IconButton>
            <SearchIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={(t) => ({ backgroundColor: surface(t).bg, borderColor: surface(t).border })}>
      <CardContent>
        <Typography variant="h4" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="body2" sx={(t) => ({ mt: 0.5, color: surface(t).textMuted })}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ======================= Invite Staff — Generic Link =======================
function InviteStaffModal({ pharmacyId }: { pharmacyId: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("7");
  const [link, setLink] = useState("");

  const generate = () => {
    const n = Number(days || "0");
    setLink(generateGenericStaffInvite(pharmacyId, Number.isNaN(n) ? 7 : n));
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {}
  };

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)} startIcon={<PeopleIcon />}>
        Invite Staff
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create generic invite link</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={(t) => ({ mb: 2, color: surface(t).textMuted })}>
            Share this link with anyone. After signup, the staff member still requires <b>owner approval</b> in Manage
            Staff.
          </Typography>
          <TextField label="Expiry (days)" value={days} onChange={(e) => setDays(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button onClick={generate} startIcon={<LinkIcon />}>
              Generate
            </Button>
            <Button onClick={copy} startIcon={<ContentCopyIcon />} disabled={!link}>
              Copy
            </Button>
          </Stack>
          {link && <TextField label="Invite link" fullWidth value={link} InputProps={{ readOnly: true }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ======================= Shared Add Dialog (one-time link OR manual) =======================
function AddPersonDialog({
  mode,
  onAdd,
}: {
  mode: "staff" | "locum";
  onAdd: (payload: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"onetime" | "manual">("onetime");

  const [target, setTarget] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState("7");
  const [genLink, setGenLink] = useState("");

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("PHARMACIST");
  const [workType, setWorkType] = useState<WorkType>("CASUAL");
  const [email2, setEmail2] = useState("");

  const generate = () => {
    const token = uid();
    const exp = new Date(Date.now() + Number(days || "0") * 86400000).toISOString();
    const base = mode === "staff" ? "invite" : "locum-invite";
    setGenLink(`https://chemisttasker.com/${base}/${token}?exp=${exp}&oneTime=true&ownerApproval=true`);
  };

  const copy = async () => {
    if (!genLink) return;
    try {
      await navigator.clipboard.writeText(genLink);
    } catch {}
  };

  const submitManual = () => {
    onAdd({ id: uid(), name: name || (role === "PHARMACIST" ? "New Pharmacist" : "New Member"), email: email2, role, workType });
    setOpen(false);
  };

  return (
    <>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
        Add
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{mode === "staff" ? "Add staff" : "Add locum"}</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant={method === "onetime" ? "contained" : "outlined"} onClick={() => setMethod("onetime")}>
              One-time invite
            </Button>
            <Button variant={method === "manual" ? "contained" : "outlined"} onClick={() => setMethod("manual")}>
              Manual add
            </Button>
          </Stack>

          {method === "onetime" && (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button
                  variant={target === "email" ? "contained" : "outlined"}
                  startIcon={<MailOutlineIcon />}
                  onClick={() => setTarget("email")}
                >
                  Email
                </Button>
                <Button
                  variant={target === "phone" ? "contained" : "outlined"}
                  startIcon={<SmartphoneIcon />}
                  onClick={() => setTarget("phone")}
                >
                  Phone
                </Button>
              </Stack>
              <TextField
                label={target === "email" ? "Email" : "Phone"}
                value={target === "email" ? email : phone}
                onChange={(e) => (target === "email" ? setEmail(e.target.value) : setPhone(e.target.value))}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField label="Expiry (days)" value={days} onChange={(e) => setDays(e.target.value)} fullWidth sx={{ mb: 2 }} />
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button onClick={generate} startIcon={<LinkIcon />}>
                  Generate
                </Button>
                <Button onClick={copy} startIcon={<ContentCopyIcon />} disabled={!genLink}>
                  Copy
                </Button>
              </Stack>
              {genLink && <TextField label="Invite link" fullWidth value={genLink} InputProps={{ readOnly: true }} />}
            </>
          )}

          {method === "manual" && (
            <Stack spacing={2}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField label="Email (optional)" value={email2} onChange={(e) => setEmail2(e.target.value)} fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="role-label">Role</InputLabel>
                  <Select labelId="role-label" label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
                    <MenuItem value="TECHNICIAN">Technician</MenuItem>
                    <MenuItem value="ASSISTANT">Assistant</MenuItem>
                  </Select>
                </FormControl>
                {mode === "staff" && (
                  <FormControl fullWidth>
                    <InputLabel id="work-label">Work type</InputLabel>
                    <Select
                      labelId="work-label"
                      label="Work type"
                      value={workType}
                      onChange={(e) => setWorkType(e.target.value as WorkType)}
                    >
                      <MenuItem value="FULL_TIME">Full-time</MenuItem>
                      <MenuItem value="PART_TIME">Part-time</MenuItem>
                      <MenuItem value="CASUAL">Casual</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {method === "manual" ? (
            <Button onClick={submitManual} variant="contained">
              Save
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)}>Done</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

// ======================= Staff Manager (uses memberships) =======================
type Staff = {
  id: string | number;
  name: string;
  email?: string;
  role: Role;
  workType: WorkType;
};

function StaffManager({
  pharmacyId,
  memberships,
  onLocalAdd, // optional local-only add
}: {
  pharmacyId: string;
  memberships: MembershipDTO[];
  onLocalAdd?: (s: Staff) => void;
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
        role: coerceRole(m.role as string),
        workType: coerceWorkType(m.employment_type as string),
      };
    });
  }, [memberships]);

  const [list, setList] = useState<Staff[]>(derivedStaff);
  useEffect(() => setList(derivedStaff), [derivedStaff]);

  const [sortBy, setSortBy] = useState<"role" | "workType">("role");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");
  const [filterWork, setFilterWork] = useState<WorkType | "ALL">("ALL");

  // pending signups (example local state)
  const [pending, setPending] = useState<any[]>([]);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const data = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1));
    return copy.filter((s) => (filterRole === "ALL" || s.role === filterRole) && (filterWork === "ALL" || s.workType === filterWork));
  }, [list, sortBy, filterRole, filterWork]);

  const addManual = (s: Staff) => {
    setList((l) => [...l, s]);
    onLocalAdd?.(s);
  };
  const remove = (id: string | number) => setList((l) => l.filter((x) => x.id !== id));
  const editName = (id: string | number) => {
    const name = window.prompt("New name?");
    if (!name) return;
    setList((l) => l.map((x) => (x.id === id ? { ...x, name } : x)));
  };

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
        <AddPersonDialog mode="staff" onAdd={addManual} />
        <Button variant="outlined" startIcon={<NotificationsNoneIcon />} onClick={() => setApprovalsOpen(true)}>
          Awaiting Approval {pending.length > 0 && <Chip label={pending.length} size="small" sx={{ ml: 1 }} />}
        </Button>
      </Stack>

      {/* Approvals dialog (placeholder local flow) */}
      <Dialog open={approvalsOpen} onClose={() => setApprovalsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Pending staff approvals</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info">No pending requests.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Staff cards — responsive flex wrap */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {data.map((s) => (
          <Card key={s.id} variant="outlined" sx={(t) => ({ flex: "1 1 420px", maxWidth: 560, background: surface(t).bg })}>
            <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <Chip label={s.role} color={ROLE_CHIP_COLOR[s.role]} variant="filled" />
              <Chip label={WORK_LABEL[s.workType]} variant="outlined" />
              <Box sx={{ ml: 1 }}>
                <Typography fontWeight={600}>{s.name}</Typography>
                {s.email && (
                  <Typography variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
                    {s.email}
                  </Typography>
                )}
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

// ======================= Favourite Locums (kept simple/local) =======================
function FavouriteLocums() {
  const [pool, setPool] = useState([
    { id: "l1", name: "Ava Nguyen", email: "ava@demo.com", role: "PHARMACIST" as Role },
    { id: "l2", name: "Marcus Chen", email: "marcus@demo.com", role: "TECHNICIAN" as Role },
  ]);
  const [favs, setFavs] = useState<Record<string, boolean>>({});

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
        <AddPersonDialog
          mode="locum"
          onAdd={(l) => setPool((p) => [...p, l])}
        />
      </Stack>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {pool.map((l) => (
          <Card key={l.id} variant="outlined" sx={(t) => ({ flex: "1 1 420px", maxWidth: 560, background: surface(t).bg })}>
            <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <Chip label={l.role} color={ROLE_CHIP_COLOR[l.role]} variant="filled" />
              <Box sx={{ ml: 1 }}>
                <Typography fontWeight={600}>{l.name}</Typography>
                <Typography variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
                  {l.email}
                </Typography>
              </Box>
              <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
                <Button variant="outlined" size="small" onClick={() => setFavs((f) => ({ ...f, [l.id]: !f[l.id] }))}>
                  {favs[l.id] ? "✓ In Favourites" : "Add to Favourites"}
                </Button>
                <IconButton size="small">
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => setPool((p) => p.filter((x) => x.id !== l.id))}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

// ======================= Admin Invite (one-time or manual) =======================
function AddAdminDialog({ pharmacyId, onAdd }: { pharmacyId: string; onAdd: (a: any) => void }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"onetime" | "manual">("onetime");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("7");
  const [link, setLink] = useState("");
  const [name, setName] = useState("");

  const generate = () => {
    const token = uid();
    const exp = new Date(Date.now() + Number(days || "0") * 86400000).toISOString();
    setLink(
      `https://chemisttasker.com/admin-invite/${token}?exp=${exp}&oneTime=true&ownerApproval=true&scope=${encodeURIComponent(
        pharmacyId
      )}`
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {}
  };

  const saveManual = () => {
    onAdd({ id: uid(), name: name || "New Admin", email: email || "new@admin.com", pharmacies: [pharmacyId] });
    setOpen(false);
  };

  return (
    <>
      <Button variant="contained" startIcon={<ManageAccountsIcon />} onClick={() => setOpen(true)}>
        Add Admin
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Assign pharmacy admin</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={(t) => ({ mb: 2, color: surface(t).textMuted })}>
            A scoped admin can manage staff, edit details and post shifts for this pharmacy only.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant={method === "onetime" ? "contained" : "outlined"} onClick={() => setMethod("onetime")}>
              One-time invite
            </Button>
            <Button variant={method === "manual" ? "contained" : "outlined"} onClick={() => setMethod("manual")}>
              Manual add
            </Button>
          </Stack>

          {method === "onetime" && (
            <Stack spacing={2}>
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <TextField label="Expiry (days)" value={days} onChange={(e) => setDays(e.target.value)} fullWidth />
              <Stack direction="row" spacing={1}>
                <Button onClick={generate} startIcon={<KeyIcon />}>
                  Generate
                </Button>
                <Button onClick={copy} startIcon={<ContentCopyIcon />} disabled={!link}>
                  Copy
                </Button>
              </Stack>
              {link && <TextField label="Admin invite" fullWidth value={link} InputProps={{ readOnly: true }} />}
            </Stack>
          )}

          {method === "manual" && (
            <Stack spacing={2}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {method === "manual" ? (
            <Button variant="contained" onClick={saveManual}>
              Save
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)}>Done</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

function PharmacyAdmins({ pharmacy }: { pharmacy: { id: string; name: string } }) {
  const [admins, setAdmins] = useState<any[]>([]);

  const addAdmin = (a: any) => setAdmins((curr) => [...curr, a]);
  const removeAdmin = (id: string) => setAdmins((a) => a.filter((x) => x.id !== id));

  return (
    <Card variant="outlined">
      <CardHeader title={`Admins for ${pharmacy.name}`} />
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "center" }}>
          <Typography variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
            Scoped admins can manage this pharmacy only.
          </Typography>
          <AddAdminDialog pharmacyId={pharmacy.id} onAdd={addAdmin} />
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {admins.length === 0 && (
            <Alert sx={{ flex: "1 1 420px", maxWidth: 560 }} severity="info">
              No admins yet. Add one with the button above.
            </Alert>
          )}
          {admins.map((a) => (
            <Card key={a.id} variant="outlined" sx={(t) => ({ flex: "1 1 420px", maxWidth: 560, background: surface(t).bg })}>
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Chip label="PHARMACY ADMIN" color="secondary" />
                <Box sx={{ ml: 1 }}>
                  <Typography fontWeight={600}>{a.name}</Typography>
                  <Typography variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
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

// ======================= Main Page =======================
export default function OverviewPageOwner(props: OwnerOverviewProps) {
  // If parent passes data, we use it. If not, auto-fetch here.
  const [pharmaciesState, setPharmaciesState] = useState<PharmacyDTO[] | null>(props.pharmacies ?? null);
  const [membershipsState, setMembershipsState] = useState<Record<string, MembershipDTO[]> | null>(
    props.membershipsByPharmacy ?? null
  );

  // Auto-fetch fallback (runs only if props not provided)
  useEffect(() => {
    if (props.pharmacies && props.membershipsByPharmacy) return;

    let mounted = true;
    (async () => {
      try {
        if (!pharmaciesState) {
          const res = await apiClient.get<PharmacyDTO[]>(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`);
          if (!mounted) return;
          setPharmaciesState(res.data);
        }
      } catch (e) {
        console.error("Failed to load pharmacies", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [props.pharmacies, props.membershipsByPharmacy, pharmaciesState]);

  useEffect(() => {
    if (props.pharmacies && props.membershipsByPharmacy) return;
    if (!pharmaciesState) return;
    if (membershipsState) return; // already loaded

    let mounted = true;
    (async () => {
      try {
        const map: Record<string, MembershipDTO[]> = {};
        await Promise.all(
          pharmaciesState.map(async (p) => {
            const res = await apiClient.get<MembershipDTO[]>(
              `${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${p.id}`
            );
            map[p.id] = res.data || [];
          })
        );
        if (!mounted) return;
        setMembershipsState(map);
      } catch (e) {
        console.error("Failed to load memberships", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pharmaciesState, props.pharmacies, props.membershipsByPharmacy, membershipsState]);

  // Sources of truth
  const pharmacies: PharmacyDTO[] = props.pharmacies ?? pharmaciesState ?? [];
  const membershipsByPharmacy: Record<string, MembershipDTO[]> = props.membershipsByPharmacy ?? membershipsState ?? {};

  const [view, setView] = useState<"overview" | "pharmacies" | "pharmacy" | "admins" | "staff" | "locums">("overview");
  const [activePharmacy, setActivePharmacy] = useState<PharmacyDTO | null>(null);

  const cardPharmacies = useMemo(
    () =>
      pharmacies.map((p) => ({
        id: p.id,
        name: p.name,
        addressLine: [p.street_address, p.suburb].filter(Boolean).join(", "),
        state: p.state,
        postcode: p.postcode,
        staffCount: (membershipsByPharmacy[p.id] || []).length,
      })),
    [pharmacies, membershipsByPharmacy]
  );

  const openPharmacy = (pId: string) => {
    const p = pharmacies.find((x) => x.id === pId) || null;
    setActivePharmacy(p);
    setView("pharmacy");
  };
  const openAdmins = (pId: string) => {
    const p = pharmacies.find((x) => x.id === pId) || null;
    setActivePharmacy(p);
    setView("admins");
  };
  const openStaff = () => setView("staff");
  const openLocums = () => setView("locums");

  return (
    <Box sx={(t) => ({ flex: 1, minWidth: 0, bgcolor: t.palette.background.default })}>
      {/* OVERVIEW */}
      {view === "overview" && (
        <>
          <TopBar breadcrumb={["Overview"]} />
          <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2, mb: 3 }}>
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  Welcome back
                </Typography>
                <Typography sx={(t) => ({ color: surface(t).textMuted })}>
                  Quick access to everything from the cards below.
                </Typography>
              </Box>
              <Card variant="outlined" sx={(t) => ({ minWidth: 260, background: surface(t).bg })}>
                <CardContent>
                  <Typography fontWeight={600}>💊 Bills / Gamification</Typography>
                  <Typography>Total billed: —</Typography>
                  <Typography>Points: —</Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Icon cards layout (CSS Grid via Box, not MUI Grid component) */}
            <Box
              sx={{
                display: "grid",
                gap: 12 / 8, // 1.5
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
              }}
            >
              <IconCard title="Manage Pharmacies" subtitle="Create, edit and configure stores" icon={<StoreIcon />} onClick={() => setView("pharmacies")} />
              <IconCard title="My Pharmacies" subtitle="View and open a pharmacy" icon={<DomainIcon />} onClick={() => setView("pharmacies")} />
              <IconCard title="Assign Admins" subtitle="Manage pharmacy admins" icon={<SecurityIcon />} onClick={() => setView("pharmacies")} />
              <IconCard title="Internal Roster" subtitle="Plan team coverage" icon={<CalendarMonthIcon />} />
              <IconCard title="Post Shift" subtitle="Publish an open shift" icon={<ListAltIcon />} />
              <IconCard title="Shifts" subtitle="Upcoming & confirmed" icon={<WorkOutlineIcon />} />
              <IconCard title="Explore Interests" subtitle="Recommendations" icon={<AppsIcon />} />
              <IconCard title="Learning Materials" subtitle="Guides & training" icon={<DomainIcon />} />
              <IconCard title="Profile" subtitle="Account & verification" icon={<PeopleIcon />} />
              <IconCard title="Settings" subtitle="Platform preferences" icon={<SettingsIcon />} />
            </Box>

            {/* At a glance stats */}
            <Box
              sx={{
                mt: 3,
                display: "grid",
                gap: 12 / 8,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
              }}
            >
              <Stat label="Upcoming Shifts" value={"0"} />
              <Stat label="Confirmed Shifts" value={"2"} />
              <Stat label="Total Pharmacies" value={String(pharmacies.length)} />
              <Stat label="Favourites" value={"5"} />
            </Box>
          </Box>
        </>
      )}

      {/* PHARMACIES */}
      {view === "pharmacies" && (
        <>
          <TopBar onBack={() => setView("overview")} breadcrumb={["My Pharmacies"]} />
          <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {cardPharmacies.map((p) => (
                <Card key={p.id} variant="outlined" sx={(t) => ({ flex: "1 1 420px", maxWidth: 560, background: surface(t).bg })}>
                  <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                    <Box sx={(t) => ({ p: 1.2, borderRadius: 2, bgcolor: surface(t).hover })}>
                      <DomainIcon />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600}>{p.name}</Typography>
                      <Typography variant="body2" sx={(t) => ({ color: surface(t).textMuted })}>
                        {p.addressLine}, {p.state} {p.postcode}
                      </Typography>
                      {!!p.staffCount && (
                        <Typography variant="caption" sx={(t) => ({ color: surface(t).textMuted })}>
                          Staff: {p.staffCount}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small" onClick={() => openPharmacy(p.id)}>
                        Open
                      </Button>
                      <Button variant="contained" size="small" onClick={() => openAdmins(p.id)}>
                        Admins
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        </>
      )}

      {/* PHARMACY DETAIL */}
      {view === "pharmacy" && activePharmacy && (
        <>
          <TopBar onBack={() => setView("pharmacies")} breadcrumb={["My Pharmacies", activePharmacy.name]} />
          <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                alignItems: { md: "flex-end" },
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {activePharmacy.name}
                </Typography>
                <Typography sx={(t) => ({ color: surface(t).textMuted })}>
                  {[activePharmacy.street_address, activePharmacy.suburb, activePharmacy.state, activePharmacy.postcode]
                    .filter(Boolean)
                    .join(", ")}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined">Edit</Button>
                <InviteStaffModal pharmacyId={activePharmacy.id} />
              </Stack>
            </Box>

            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 12 / 8,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
              }}
            >
              <IconCard title="Manage Staff" subtitle="Add/remove team" icon={<PeopleIcon />} onClick={openStaff} />
              <IconCard title="Check Shifts" subtitle="Roster & history" icon={<CalendarMonthIcon />} />
              <IconCard title="Favourite Locums" subtitle="Quick-pick shortlist" icon={<StarOutlineIcon />} onClick={openLocums} />
              <IconCard title="Admins" subtitle="Assign scoped admins" icon={<ManageAccountsIcon />} onClick={() => setView("admins")} />
              <IconCard title="Post Shift" subtitle="Publish an open shift" icon={<ListAltIcon />} />
              <IconCard title="Configurations" subtitle="Hours, details, rates" icon={<SettingsIcon />} />
            </Box>
          </Box>
        </>
      )}

      {/* ADMINS */}
      {view === "admins" && activePharmacy && (
        <>
          <TopBar onBack={() => setView("pharmacy")} breadcrumb={["My Pharmacies", activePharmacy.name, "Admins"]} />
          <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <PharmacyAdmins pharmacy={activePharmacy} />
          </Box>
        </>
      )}

      {/* STAFF */}
      {view === "staff" && activePharmacy && (
        <>
          <TopBar onBack={() => setView("pharmacy")} breadcrumb={["My Pharmacies", activePharmacy.name, "Manage Staff"]} />
          <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <StaffManager
              pharmacyId={activePharmacy.id}
              memberships={membershipsByPharmacy[activePharmacy.id] || []}
            />
          </Box>
        </>
      )}

      {/* LOCUMS */}
      {view === "locums" && activePharmacy && (
        <>
          <TopBar onBack={() => setView("pharmacy")} breadcrumb={["My Pharmacies", activePharmacy.name, "Favourite Locums"]} />
          <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <FavouriteLocums />
          </Box>
        </>
      )}
    </Box>
  );
}

// ======================= Lightweight runtime checks (dev only) =======================
if (typeof window !== "undefined") {
  const sampleToken = uid();
  console.assert(sampleToken && typeof sampleToken === "string", "uid() should produce a string token");
}
