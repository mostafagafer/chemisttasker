// src/pages/dashboard/sidebar/ChainPage.tsx

import { useState, useEffect } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, IconButton,
  Typography, Accordion, AccordionSummary,
  AccordionDetails, List,
  ListItem, ListItemText, Autocomplete,
  Paper, Skeleton, Container
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon, Delete as DeleteIcon,
  Edit as EditIcon, ExpandMore as ExpandMoreIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import apiClient from '../../../utils/apiClient';
import { API_BASE_URL, API_ENDPOINTS } from '../../../constants/api';

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


  // New loading state for the entire page's initial data fetch
  const [pageLoading, setPageLoading] = useState(true);

  // ── Snackbar ──────────────────────
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });

  // ── Load initial data ──────────────
  useEffect(() => {
    setPageLoading(true);
    Promise.all([
      apiClient.get<Chain[]>(`${API_BASE_URL}${API_ENDPOINTS.chains}`),
      apiClient.get<Pharmacy[]>(`${API_BASE_URL}${API_ENDPOINTS.pharmacies}`)
    ])
    .then(([chainsRes, pharmaciesRes]) => {
      if (chainsRes.data.length) {
        setChain(chainsRes.data[0]);
      }
      setAllPharmacies(pharmaciesRes.data);
    })
    .catch(console.error)
    .finally(() => setPageLoading(false));
  }, []);

  // ── Whenever chain changes, load its pharmacies + members ─────────────
  useEffect(() => {
    if (!chain) return;
    setPageLoading(true);
    apiClient
      .get<Pharmacy[]>(
        `${API_BASE_URL}${API_ENDPOINTS.chainDetail(chain.id)}pharmacies/`
      )
      .then(res => {
        setChainPharmacies(res.data);
        res.data.forEach(p => loadMembers(p.id));
      })
      .catch(console.error)
      .finally(() => setPageLoading(false));
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
    } catch (e: any) { // Catch as 'any' to access response data
      console.error(e);
      // Display API error message in Snackbar
      setSnack({ open: true, msg: e.response?.data?.detail || 'Failed to save chain.' });
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

  // ── RENDER ──────────────────────────────────────────────────────────
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Manage Chains
      </Typography>
      {pageLoading ? (
        // Skeleton for the "Create New Chain" button
        <Box sx={{ mb: 3, mt: 5 }}>
          <Skeleton variant="rectangular" width={180} height={36} />
        </Box>
      ) : (
        // Only show button if no chain exists after loading
        !chain && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateChain}
            sx={{ mb: 3, mt: 5 }}
          >
            Create New Chain
          </Button>
        )
      )}

      {pageLoading ? (
        // Skeletons for main chain/pharmacy content
        <Box sx={{ py: 2 }}>
          {[...Array(3)].map((_, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton variant="text" width="60%" height={30} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="circular" width={40} height={40} />
                </Box>
              </Box>
              <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={80} sx={{ mt: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Skeleton variant="rectangular" width={100} height={36} />
              </Box>
            </Paper>
          ))}
        </Box>
      ) : !chain ? (
        // Message when no chain is set up (after loading)
        <>
          <Typography>You haven’t set up a chain yet.</Typography>
        </>
      ) : (
        // Display chain details and pharmacies when loaded
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
          {chainPharmacies.length === 0 ? (
            <Typography color="textSecondary">No pharmacies assigned to this chain yet. Add pharmacies to manage staff.</Typography>
          ) : (
            chainPharmacies.map(ph => (
              <Accordion key={ph.id} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>{ph.name}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {(memberships[ph.id] || []).map(m => (
                      <ListItem
                        key={m.id}
                        // secondaryAction removed (delete button)
                      >
                        <ListItemText
                          primary={m.user_details.email}
                          secondary={m.user_details.role}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
                {/* Removed AccordionActions block entirely */}
              </Accordion>
            ))
          )}
        </>
      )}

      {/* Create/Edit Chain Dialog */}
      <Dialog open={openChainDlg} onClose={() => setOpenChainDlg(false)} fullWidth>
        <DialogTitle>{isEditing ? 'Edit Chain' : 'Create Chain'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Name"
            value={chainName} onChange={e => setChainName(e.target.value)}
            required
          />
          <TextField
            fullWidth margin="normal" label="Contact Email"
            value={chainEmail} onChange={e => setChainEmail(e.target.value)}
            required
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
            renderInput={params => (
              <TextField
                {...params}
                label="Select Pharmacies"
                // No changes here as per instruction
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeManagePharmacies}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveManagePharmacies}
            // No changes here as per instruction
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Removed Staff Dialog entirely */}


      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        message={snack.msg}
        action={
          <IconButton size="small" onClick={() => setSnack(s => ({ ...s, open: false }))} color="inherit">
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
}