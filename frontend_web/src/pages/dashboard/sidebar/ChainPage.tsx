// src/pages/dashboard/sidebar/ChainPage.tsx

import { useState, useEffect } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, IconButton,
  Typography, Accordion, AccordionSummary,
  AccordionDetails, AccordionActions, List,
  ListItem, ListItemText, Autocomplete, Tabs, Tab
} from '@mui/material';
import Grid from '@mui/material/Grid'; // CORRECT import for Grid!
import {
  Add as AddIcon, Delete as DeleteIcon,
  Edit as EditIcon, ExpandMore as ExpandMoreIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import apiClient from '../../../utils/apiClient';
import { API_BASE_URL, API_ENDPOINTS } from '../../../constants/api';

// New types for invite rows
type InviteRow = {
  email: string;
  role: string;
  employment_type: string;
};

const ROLES = [
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "INTERN", label: "Intern" },
  { value: "STUDENT", label: "Student" }
];

const MEMBER_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" }
];

const LOCUM_TYPES = [
  { value: "LOCUM", label: "Locum" },
  { value: "CASUAL", label: "Casual" }
];

type Chain = {
  id: string;
  name: string;
  primary_contact_email: string;
  logo?: string | null;
};
type Pharmacy = { id: string; name: string };
type User = { id: string; email: string; role: string };
type Membership = { id: string; user_details: User };

export default function ChainPage() {
  // ── Chain ─────────────────────────
  const [chain, setChain] = useState<Chain | null>(null);
  const [chainName, setChainName] = useState('');
  const [chainEmail, setChainEmail] = useState('');
  const [chainLogo, setChainLogo] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [openChainDlg, setOpenChainDlg] = useState(false);

  // ── Pharmacies ────────────────────
  const [allPharmacies, setAllPharmacies] = useState<Pharmacy[]>([]);
  const [chainPharmacies, setChainPharmacies] = useState<Pharmacy[]>([]);
  const [openPharmDlg, setOpenPharmDlg] = useState(false);
  const [tempPharmacies, setTempPharmacies] = useState<Pharmacy[]>([]);

  // ── Users & memberships ───────────
  const [memberships, setMemberships] = useState<Record<string, Membership[]>>({});
  const [openStaffDlg, setOpenStaffDlg] = useState(false);
  const [currentPh, setCurrentPh] = useState<Pharmacy | null>(null);

  // Staff invite dialog state
  const [staffTab, setStaffTab] = useState(0); // 0 = Members, 1 = Favourite Locums
  const [memberInvites, setMemberInvites] = useState<InviteRow[]>([
    { email: '', role: 'PHARMACIST', employment_type: 'FULL_TIME' }
  ]);
  const [locumInvites, setLocumInvites] = useState<InviteRow[]>([
    { email: '', role: 'PHARMACIST', employment_type: 'LOCUM' }
  ]);
  const [loading, setLoading] = useState(false);

  // ── Snackbar ──────────────────────
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });

  // ── Load initial data ──────────────
  useEffect(() => {
    apiClient.get<Chain[]>(`${API_BASE_URL}${API_ENDPOINTS.chains}`)
      .then(res => res.data.length && setChain(res.data[0]))
      .catch(console.error);

    apiClient.get<Pharmacy[]>(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`)
      .then(res => setAllPharmacies(res.data))
      .catch(console.error);

    apiClient.get<User[]>(`${API_BASE_URL}${API_ENDPOINTS.users}`)
      .catch(console.error); // Users state no longer used in new dialog
  }, []);

  // ── Whenever chain changes, load its pharmacies + members ─────────────
  useEffect(() => {
    if (!chain) return;
    apiClient
      .get<Pharmacy[]>(
        `${API_BASE_URL}${API_ENDPOINTS.chainDetail(chain.id)}pharmacies/`
      )
      .then(res => {
        setChainPharmacies(res.data);
        res.data.forEach(p => loadMembers(p.id));
      })
      .catch(console.error);
  }, [chain]);

  function loadMembers(phId: string) {
    apiClient
      .get<Membership[]>(
        `${API_BASE_URL}${API_ENDPOINTS.membershipList}?pharmacy_id=${phId}`
      )
      .then(res => {
        setMemberships(m => ({ ...m, [phId]: res.data }));
      })
      .catch(console.error);
  }

  // ── Chain Dialog Handlers ────────────────────────────────────────────
  function openCreateChain() {
    setIsEditing(false);
    setChainName('');
    setChainEmail('');
    setChainLogo(null);
    setOpenChainDlg(true);
  }
  function openEditChain() {
    if (!chain) return;
    setIsEditing(true);
    setChainName(chain.name);
    setChainEmail(chain.primary_contact_email);
    setChainLogo(null);
    setOpenChainDlg(true);
  }
  async function handleSaveChain() {
    try {
      const fd = new FormData();
      fd.append('name', chainName);
      fd.append('primary_contact_email', chainEmail);
      if (chainLogo) fd.append('logo', chainLogo);

      let res;
      if (isEditing && chain) {
        res = await apiClient.put<Chain>(
          `${API_BASE_URL}${API_ENDPOINTS.chainDetail(chain.id)}`, fd
        );
        setSnack({ open: true, msg: 'Chain updated' });
      } else {
        res = await apiClient.post<Chain>(
          `${API_BASE_URL}${API_ENDPOINTS.chains}`, fd
        );
        setSnack({ open: true, msg: 'Chain created' });
      }
      setChain(res.data);
      setOpenChainDlg(false);
    } catch (e) {
      console.error(e);
    }
  }
  async function handleDeleteChain() {
    if (!chain) return;
    await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.chainDetail(chain.id)}`);
    setChain(null);
    setChainPharmacies([]);
    setSnack({ open: true, msg: 'Chain deleted' });
  }

  // ── Manage Pharmacies ────────────────────────────────────────────────
  function openManagePharmacies() {
    setTempPharmacies(chainPharmacies);
    setOpenPharmDlg(true);
  }
  function closeManagePharmacies() {
    setOpenPharmDlg(false);
  }
  async function saveManagePharmacies() {
    if (!chain) return;
    const origIds = chainPharmacies.map(p => p.id);
    const selIds = tempPharmacies.map(p => p.id);
    const toAdd = tempPharmacies.filter(p => !origIds.includes(p.id));
    const toRem = chainPharmacies.filter(p => !selIds.includes(p.id));

    await Promise.all(toAdd.map(p =>
      apiClient.post(
        `${API_BASE_URL}${API_ENDPOINTS.addPharmacyToChain(chain.id)}`,
        { pharmacy_id: p.id }
      )
    ));
    await Promise.all(toRem.map(p =>
      apiClient.post(
        `${API_BASE_URL}${API_ENDPOINTS.removePharmacyFromChain(chain.id)}`,
        { pharmacy_id: p.id }
      )
    ));

    setOpenPharmDlg(false);
    setSnack({ open: true, msg: 'Pharmacies updated' });
    setChain(c => c && ({ ...c })); // trigger reload
  }

  // ── Staff Dialog ────────────────────────────────────────────────────
  function openStaff(ph: Pharmacy) {
    setCurrentPh(ph);
    setStaffTab(0);
    setMemberInvites([{ email: '', role: 'PHARMACIST', employment_type: 'FULL_TIME' }]);
    setLocumInvites([{ email: '', role: 'PHARMACIST', employment_type: 'LOCUM' }]);
    setOpenStaffDlg(true);
  }
  function closeStaff() {
    setOpenStaffDlg(false);
  }

  async function handleBulkInvite(type: 'member' | 'locum') {
    if (!currentPh) return;
    const invites = (type === 'member' ? memberInvites : locumInvites)
      .filter(row => row.email && row.role && row.employment_type)
      .map(row => ({
        ...row,
        pharmacy: currentPh.id
      }));

    if (invites.length === 0) {
      setSnack({ open: true, msg: 'Please enter at least one complete invitation.' });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(
        `${API_BASE_URL}${API_ENDPOINTS.membershipBulkInvite}`,
        { invitations: invites }
      );
      loadMembers(currentPh.id);
      setSnack({ open: true, msg: 'Invitations sent!' });
      closeStaff();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.detail || 'Failed to send invitations.' });
    }
    setLoading(false);
  }

  async function removeStaff(memId: string, phId: string) {
    await apiClient.delete(`${API_BASE_URL}${API_ENDPOINTS.membershipDelete(memId)}`);
    loadMembers(phId);
    setSnack({ open: true, msg: 'Staff removed' });
  }

  // ── RENDER ──────────────────────────────────────────────────────────
  return (
    <Box p={4}>
      {!chain ? (
        <>
          <Typography>You haven’t set up a chain yet.</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateChain}
            sx={{ mt: 2 }}
          >
            Create Chain
          </Button>
        </>
      ) : (
        <>
          {/* Header with Logo */}
          <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center">
              {chain.logo && (
                <Box
                  component="img"
                  src={chain.logo.startsWith('http') ? chain.logo : `${API_BASE_URL}${chain.logo}`}
                  alt="Logo"
                  sx={{ width: 48, height: 48, objectFit: 'contain', mr: 2 }}
                />
              )}
              <Typography variant="h4">{chain.name}</Typography>
            </Box>
            <Box>
              <IconButton onClick={openEditChain}><EditIcon /></IconButton>
              <IconButton onClick={handleDeleteChain}><DeleteIcon /></IconButton>
              <Button onClick={openManagePharmacies} sx={{ ml: 1 }}>
                Manage Pharmacies
              </Button>
            </Box>
          </Grid>
          <Typography sx={{ mb: 4 }}>{chain.primary_contact_email}</Typography>

          {/* Staff by Pharmacy */}
          <Typography variant="h5" sx={{ mb: 2 }}>Staff by Pharmacy</Typography>
          {chainPharmacies.map(ph => (
            <Accordion key={ph.id} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{ph.name}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {(memberships[ph.id] || []).map(m => (
                    <ListItem
                      key={m.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => removeStaff(m.id, ph.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={m.user_details.email}
                        secondary={m.user_details.role}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
              <AccordionActions>
                <Button
                  startIcon={<PersonAddIcon />}
                  onClick={() => openStaff(ph)}
                >
                  Add Staff
                </Button>
              </AccordionActions>
            </Accordion>
          ))}
        </>
      )}

      {/* Create/Edit Chain Dialog */}
      <Dialog open={openChainDlg} onClose={() => setOpenChainDlg(false)} fullWidth>
        <DialogTitle>{isEditing ? 'Edit Chain' : 'Create Chain'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Name"
            value={chainName} onChange={e => setChainName(e.target.value)}
          />
          <TextField
            fullWidth margin="normal" label="Contact Email"
            value={chainEmail} onChange={e => setChainEmail(e.target.value)}
          />
          {isEditing && chain?.logo && (
            <Box my={2}>
              <Typography variant="subtitle2">Current Logo:</Typography>
              <Box
                component="img"
                src={chain.logo.startsWith('http') ? chain.logo : `${API_BASE_URL}${chain.logo}`}
                alt="Current Logo"
                sx={{ width: 80, height: 80, objectFit: 'contain', mt: 1 }}
              />
            </Box>
          )}
          <Button variant="outlined" component="label" sx={{ my: 2 }}>
            {isEditing ? 'Replace Logo' : 'Upload Logo'}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={e => setChainLogo(e.target.files?.[0] ?? null)}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenChainDlg(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!chainName || !chainEmail}
            onClick={handleSaveChain}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Pharmacies Dialog */}
      <Dialog open={openPharmDlg} onClose={closeManagePharmacies} fullWidth>
        <DialogTitle>Manage Pharmacies</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            options={allPharmacies}
            getOptionLabel={o => o.name}
            value={tempPharmacies}
            onChange={(_, v) => setTempPharmacies(v)}
            filterSelectedOptions
            renderInput={params => <TextField {...params} label="Select Pharmacies" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeManagePharmacies}>Cancel</Button>
          <Button variant="contained" onClick={saveManagePharmacies}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Staff Dialog */}
<Dialog open={openStaffDlg} onClose={closeStaff} fullWidth>
  <DialogTitle>Invite Staff to {currentPh?.name}</DialogTitle>
  <DialogContent>
    <Tabs value={staffTab} onChange={(_, v) => setStaffTab(v)}>
      <Tab label="Members" />
      <Tab label="Favourite Locums" />
    </Tabs>

    {/* Members Tab */}
    {staffTab === 0 && (
      <Box mt={2}>
        {memberInvites.map((row, idx) => (
          <Box
            key={idx}
            sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}
          >
            <TextField
              label="Email"
              fullWidth
              value={row.email}
              onChange={e => {
                const v = [...memberInvites];
                v[idx].email = e.target.value;
                setMemberInvites(v);
              }}
            />
            <TextField
              select
              label="Role"
              value={row.role}
              onChange={e => {
                const v = [...memberInvites];
                v[idx].role = e.target.value;
                setMemberInvites(v);
              }}
              SelectProps={{ native: true }}
              sx={{ minWidth: 140 }}
            >
              {ROLES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </TextField>
            <TextField
              select
              label="Employment Type"
              value={row.employment_type}
              onChange={e => {
                const v = [...memberInvites];
                v[idx].employment_type = e.target.value;
                setMemberInvites(v);
              }}
              SelectProps={{ native: true }}
              sx={{ minWidth: 120 }}
            >
              {MEMBER_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </TextField>
            {memberInvites.length > 1 && (
              <IconButton
                onClick={() =>
                  setMemberInvites(v => v.filter((_, i) => i !== idx))
                }
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        ))}
        <Box mt={2} display="flex" alignItems="center">
          <Button
            onClick={() =>
              setMemberInvites(v => [
                ...v,
                { email: '', role: 'PHARMACIST', employment_type: 'FULL_TIME' }
              ])
            }
            disabled={loading}
          >
            + Add Another
          </Button>
          <Button
            variant="contained"
            sx={{ ml: 2 }}
            onClick={() => handleBulkInvite('member')}
            disabled={loading}
          >
            Send Invitations
          </Button>
        </Box>
      </Box>
    )}

    {/* Favourite Locums Tab */}
    {staffTab === 1 && (
      <Box mt={2}>
        {locumInvites.map((row, idx) => (
          <Box
            key={idx}
            sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}
          >
            <TextField
              label="Email"
              fullWidth
              value={row.email}
              onChange={e => {
                const v = [...locumInvites];
                v[idx].email = e.target.value;
                setLocumInvites(v);
              }}
            />
            <TextField
              select
              label="Role"
              value={row.role}
              onChange={e => {
                const v = [...locumInvites];
                v[idx].role = e.target.value;
                setLocumInvites(v);
              }}
              SelectProps={{ native: true }}
              sx={{ minWidth: 140 }}
            >
              {ROLES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </TextField>
            <TextField
              select
              label="Employment Type"
              value={row.employment_type}
              onChange={e => {
                const v = [...locumInvites];
                v[idx].employment_type = e.target.value;
                setLocumInvites(v);
              }}
              SelectProps={{ native: true }}
              sx={{ minWidth: 120 }}
            >
              {LOCUM_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </TextField>
            {locumInvites.length > 1 && (
              <IconButton
                onClick={() =>
                  setLocumInvites(v => v.filter((_, i) => i !== idx))
                }
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        ))}
        <Box mt={2} display="flex" alignItems="center">
          <Button
            onClick={() =>
              setLocumInvites(v => [
                ...v,
                { email: '', role: 'PHARMACIST', employment_type: 'LOCUM' }
              ])
            }
            disabled={loading}
          >
            + Add Another
          </Button>
          <Button
            variant="contained"
            sx={{ ml: 2 }}
            onClick={() => handleBulkInvite('locum')}
            disabled={loading}
          >
            Send Invitations
          </Button>
        </Box>
      </Box>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={closeStaff} disabled={loading}>Cancel</Button>
  </DialogActions>
</Dialog>


      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </Box>
  );
}
