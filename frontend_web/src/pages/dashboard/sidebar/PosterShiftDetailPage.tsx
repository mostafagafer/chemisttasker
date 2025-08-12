import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Tooltip,
  Divider,
  Skeleton, // Used for initial loading state JSX
  Card,     // Explicitly imported for usage
  CardContent, // Explicitly imported for usage
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { green, grey } from '@mui/material/colors';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';

// --- Interface Definitions (Moved PaginatedResponse here for scope) ---
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  is_recurring?: boolean;
  recurring_days?: number[];
  recurring_end_date?: string | null;
}

interface PharmacyDetail {
  id: number;
  name: string;
  street_address?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  owner?: { id: number; organization_claimed?: boolean; user?: { id: number; email?: string } };
  organization?: { id: number; name?: string };
}

interface Shift {
  id: number;
  single_user_only: boolean;
  visibility: string;
  pharmacy_detail: PharmacyDetail;
  role_needed: string;
  slots: Slot[];
  description?: string;
  slot_assignments: { slot_id: number; user_id: number }[];
  slot_count?: number;
  assigned_count?: number;
  escalation_level: number;
  escalate_to_locum_casual: string | null;
  escalate_to_owner_chain: string | null;
  escalate_to_org_chain: string | null;
  escalate_to_platform: string | null;
  allowed_escalation_levels: string[];
  created_at: string;
  created_by?: number;
}

interface MemberStatus {
  user_id: number;
  name: string;
  employment_type: string;
  role: string;
  status: 'no_response' | 'interested' | 'rejected' | 'accepted';
  is_member: boolean;
  membership_id?: number;
}

interface Interest { // From ShiftInterestViewSet (Public tab)
  id: number;
  user_id: number;
  slot_id: number | null;
  slot_time: string;
  revealed: boolean;
  user: string;
}

interface RatePreference {
  weekday: string;
  saturday: string;
  sunday: string;
  public_holiday: string;
  early_morning: string;
  late_night: string;
}

interface UserDetail { // For the popover after reveal
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  short_bio?: string;
  resume?: string;
  rate_preference?: RatePreference | null;
}

// AuthUser interface (from AuthContext)
interface AuthUser {
  id: number;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  organization_memberships?: Array<{
    organization: { id: number; name: string };
    role: string;
  }>;
}

const ESCALATION_LEVELS = [
  { level: 0, key: 'FULL_PART_TIME', label: 'My Pharmacy (Full/Part Time)' },
  { level: 1, key: 'LOCUM_CASUAL', label: 'My Pharmacy (Locum/Casual)' },
  { level: 2, key: 'OWNER_CHAIN', label: 'Chain' },
  { level: 3, key: 'ORG_CHAIN', label: 'Organization' },
  { level: 4, key: 'PLATFORM', label: 'Platform (Public)' },
];

const PUBLIC_LEVEL_KEY = 'PLATFORM';

interface TabDataState {
  loading: boolean;
  membersBySlot?: Record<number, MemberStatus[]>;
  interestsBySlot?: Record<number, Interest[]>;
  interestsAll?: Interest[];
}

const PosterShiftDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user as AuthUser;
  const theme = useTheme();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [expandedShift, setExpandedShift] = useState<number | false>(false);
  const [activeTabs, setActiveTabs] = useState<Record<number, number>>({});
  const [tabData, setTabData] = useState<Record<string, TabDataState>>({});
  const [platformInterestDialog, setPlatformInterestDialog] = useState<{
    open: boolean;
    user: UserDetail | null;
    shiftId: number | null;
    interest: Interest | null;
  }>({ open: false, user: null, shiftId: null, interest: null });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [escalating, setEscalating] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);
  const [shiftToDelete, setShiftToDelete] = useState<number | null>(null);

  // @ts-ignore: `shiftId` and `levelIdx` are parameters of the callback dependency array, not unused variables.
  const getTabKey = useCallback((shiftId: number, levelIdx: number) => `${shiftId}_${levelIdx}`, []);

  const findWholeShiftMembers = useCallback((membersBySlot: Record<number, MemberStatus[]>, slotCount: number, status: 'interested' | 'rejected'): MemberStatus[] => {
    const userIdToCounts: Record<number, { member: MemberStatus; count: number }> = {};
    for (const slotIdStr in membersBySlot) {
      const slotMembers = membersBySlot[parseInt(slotIdStr)];
      for (const mem of slotMembers) {
        if (mem.status === status) {
          if (!userIdToCounts[mem.user_id]) userIdToCounts[mem.user_id] = { member: mem, count: 1 };
          else userIdToCounts[mem.user_id].count++;
        }
      }
    }
    return Object.values(userIdToCounts)
      .filter(x => x.count === slotCount)
      .map(x => x.member);
  }, []);

  const showSnackbar = (msg: string) => {
    setSnackbar({ open: true, message: msg });
  };

  // @ts-ignore: `closeSnackbar` is used in Snackbar `onClose` prop.
  const closeSnackbar = () => setSnackbar({ open: false, message: '' });

  const loadTabData = useCallback(async (currentShift: Shift, levelIdx: number) => {
    const tabKey = getTabKey(currentShift.id, levelIdx);
    const escLevel = ESCALATION_LEVELS[levelIdx].key;

    setTabData(td => ({
      ...td,
      [tabKey]: { loading: true },
    }));

    try {
      if (escLevel === PUBLIC_LEVEL_KEY) {
        const res = await apiClient.get<PaginatedResponse<Interest>>(API_ENDPOINTS.getShiftInterests, { params: { shift: currentShift.id } });
        const interests: Interest[] = Array.isArray(res.data.results) ? res.data.results : [];

        const interestsBySlot: Record<number, Interest[]> = {};
        const interestsAll: Interest[] = [];

        interests.forEach(interest => {
          if (interest.slot_id === null) {
            interestsAll.push(interest);
          } else {
            const sid = Number(interest.slot_id);
            if (!interestsBySlot[sid]) {
              interestsBySlot[sid] = [];
            }
            interestsBySlot[sid].push(interest);
          }
        });

        setTabData(td => ({
          ...td,
          [tabKey]: {
            loading: false,
            interestsBySlot: interestsBySlot,
            interestsAll: interestsAll,
          },
        }));

      } else {
        const membersBySlot: Record<number, MemberStatus[]> = {};

        for (const slot of currentShift.slots) {
          const res = await apiClient.get<MemberStatus[]>(
            `${API_ENDPOINTS.getActiveShifts}${currentShift.id}/member_status/`,
            {
              params: {
                slot_id: slot.id,
                visibility: escLevel
              }
            }
          );
          membersBySlot[slot.id] = res.data;
        }

        setTabData(td => ({
          ...td,
          [tabKey]: {
            loading: false,
            membersBySlot: membersBySlot,
          },
        }));
      }
    } catch (err: any) {
      console.error(`Failed to load tab data for ${escLevel}:`, err.response?.data || err);
      showSnackbar(err.response?.data?.detail || `Failed to load data for ${ESCALATION_LEVELS[levelIdx].label}`);
      setTabData(td => ({
        ...td,
        [tabKey]: { ...td[tabKey], loading: false },
      }));
    }
  }, [getTabKey, findWholeShiftMembers]);

  const handleAccordionChange = useCallback((currentShift: Shift) => (_: React.SyntheticEvent, expanded: boolean) => {
    setExpandedShift(expanded ? currentShift.id : false);
    if (expanded) {
      const currentLevelIdx = ESCALATION_LEVELS.findIndex(level => level.key === currentShift.visibility);
      setActiveTabs(prevActiveTabs => {
        const determinedActiveTabIdx = prevActiveTabs[currentShift.id] ?? currentLevelIdx;
        if (!tabData[getTabKey(currentShift.id, determinedActiveTabIdx)]) {
          loadTabData(currentShift, determinedActiveTabIdx);
        }
        return { ...prevActiveTabs, [currentShift.id]: determinedActiveTabIdx };
      });
    }
  }, [getTabKey, loadTabData, tabData]);

  const handleTabChange = useCallback((currentShift: Shift, newTabIndex: number) => {
    setActiveTabs(prevActiveTabs => ({ ...prevActiveTabs, [currentShift.id]: newTabIndex }));
    if (!tabData[getTabKey(currentShift.id, newTabIndex)]) {
      loadTabData(currentShift, newTabIndex);
    }
  }, [getTabKey, loadTabData, tabData]);

  const handleEscalate = async (currentShift: Shift, targetLevelIdx: number) => {
    setEscalating(e => ({ ...e, [currentShift.id]: true }));
    const nextVisKey = ESCALATION_LEVELS[targetLevelIdx].key;

    try {
      await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/escalate/`);
      showSnackbar(`Shift escalated to ${ESCALATION_LEVELS[targetLevelIdx].label}`);

      setShift(prevShift => prevShift ? { ...prevShift, visibility: nextVisKey, escalation_level: targetLevelIdx } : null);
      // Re-fetch the shift to ensure all its fields are up-to-date after escalation
      const updatedShiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/`);
      setShift(updatedShiftRes.data);

      setActiveTabs(prevActiveTabs => ({ ...prevActiveTabs, [currentShift.id]: targetLevelIdx }));
      loadTabData(currentShift, targetLevelIdx);

    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to escalate shift');
    } finally {
      setEscalating(e => ({ ...e, [currentShift.id]: false }));
    }
  };

  const handleEdit = (currentShift: Shift) => {
    let baseRoute = '/dashboard/owner/post-shift';
    if (user?.role === 'ORG_ADMIN' || user?.role === 'ORG_OWNER' || user?.role === 'ORG_STAFF') { // Assuming these roles can post/edit
      baseRoute = '/dashboard/organization/post-shift';
    }
    navigate(`${baseRoute}?edit=${currentShift.id}`);
  };

  const handleDelete = (currentShift: Shift) => {
    setShiftToDelete(currentShift.id);
    setOpenDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (shiftToDelete === null) return;

    setDeleting(d => ({ ...d, [shiftToDelete]: true }));
    try {
      await apiClient.delete(`${API_ENDPOINTS.getActiveShifts}${shiftToDelete}/`);
      showSnackbar('Shift cancelled/deleted successfully.');
      navigate(-1); // Go back to the previous page (e.g., Active Shifts list)
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to cancel shift.' });
    } finally {
      setDeleting(d => ({ ...d, [shiftToDelete]: false }));
      setOpenDeleteConfirm(false);
      setShiftToDelete(null);
    }
  };

  const cancelDelete = () => {
    setOpenDeleteConfirm(false);
    setShiftToDelete(null);
  };

  const handleAssign = async (currentShift: Shift, userId: number, slotId: number | null) => {
    try {
      await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/accept_user/`, { user_id: userId, slot_id: slotId });
      showSnackbar('User assigned.');

      // Re-fetch the entire shift to update assignments in UI
      const updatedShiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/`);
      setShift(updatedShiftRes.data);

      const currentActiveTabIdx = activeTabs[currentShift.id] ?? ESCALATION_LEVELS.findIndex(l => l.key === currentShift.visibility);
      if (currentActiveTabIdx >= 0) {
        loadTabData(currentShift, currentActiveTabIdx); // Reload current tab data to reflect changes
      }
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to assign user.');
    }
  };

  const handleRevealPlatform = async (currentShift: Shift, interest: Interest) => {
    try {
      const res = await apiClient.post<UserDetail>(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/reveal_profile/`, { slot_id: interest.slot_id, user_id: interest.user_id });
      setPlatformInterestDialog({ open: true, user: res.data, shiftId: currentShift.id, interest });
      const publicTabIdx = ESCALATION_LEVELS.findIndex(l => l.key === PUBLIC_LEVEL_KEY);
      loadTabData(currentShift, publicTabIdx);
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to reveal candidate.');
    }
  };

  const handleAssignPlatform = async () => {
    const { shiftId, user: candidateUser, interest } = platformInterestDialog;
    if (!shiftId || !candidateUser || !interest || !shift) return;

    try {
      await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${shiftId}/accept_user/`, { user_id: candidateUser.id, slot_id: interest.slot_id });
      showSnackbar('User assigned.');
      setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null });

      // Re-fetch the entire shift to update assignments in UI
      const updatedShiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${shiftId}/`);
      setShift(updatedShiftRes.data);

      const publicTabIdx = ESCALATION_LEVELS.findIndex(l => l.key === PUBLIC_LEVEL_KEY);
      loadTabData(shift, publicTabIdx); // Reload public tab data
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to assign user.');
    }
  };

  useEffect(() => {
    if (!id || !user) {
      setLoadingInitial(false);
      return;
    }
    setLoadingInitial(true);

    const fetchShiftData = async () => {
      try {
        const shiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${id}/`);
        setShift(shiftRes.data);
        setExpandedShift(shiftRes.data.id);
        const currentLevelIdx = ESCALATION_LEVELS.findIndex(level => level.key === shiftRes.data.visibility);
        setActiveTabs({ [shiftRes.data.id]: currentLevelIdx });
        loadTabData(shiftRes.data, currentLevelIdx);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to load shift. It might not exist or you may not have permission to view it.';
        console.error("Shift detail load error:", err.response?.data || err);
        showSnackbar(errorMessage);
        setShift(null);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchShiftData();
  }, [id, user, loadTabData]);

  // Render Skeleton for initial loading
  if (loadingInitial) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <Box sx={{ py: 2 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={30} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={120} />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="rectangular" width={100} height={36} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  // If shift is null after loading, display an error message
  if (!shift) {
    return (
      <Container sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="textSecondary">
          Shift details could not be loaded. It might not exist or you may not have permission to view it.
        </Typography>
      </Container>
    );
  }

  // Use the fetched single shift data as currentShift
  const currentShift = shift;
  const currentLevelIdx = ESCALATION_LEVELS.findIndex(l => l.key === currentShift.visibility);
  const activeTabIdx = activeTabs[currentShift.id] ?? currentLevelIdx;
  const currentTabData = tabData[getTabKey(currentShift.id, activeTabIdx)];

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Active Shift Details</Typography>
      <Accordion
        key={currentShift.id}
        expanded={expandedShift === currentShift.id}
        onChange={handleAccordionChange(currentShift)}
        sx={{
          mb: 3,
          border: `1px solid ${grey[300]}`,
          borderRadius: 2,
          boxShadow: '0 2px 10px 0 rgba(0,0,0,0.07)',
          '&.Mui-expanded': {
            margin: 'auto',
            boxShadow: '0 4px 15px 0 rgba(0,0,0,0.1)',
          },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">{currentShift.pharmacy_detail.name}</Typography>
                <Chip label={currentShift.role_needed} size="small" color="primary" />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Current Escalation: <b style={{ color: green[700] }}>{ESCALATION_LEVELS[currentLevelIdx]?.label}</b>
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                       {[
                  currentShift.pharmacy_detail.street_address,
                  currentShift.pharmacy_detail.suburb,
                  currentShift.pharmacy_detail.state,
                  currentShift.pharmacy_detail.postcode
                ]
                  .filter(Boolean) // This removes any empty parts
                  .join(', ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Slots: {currentShift.slots.map(s => `${s.date} ${s.start_time}–${s.end_time}`).join(' | ')}
              </Typography>

              {shift.description && (
              <Typography variant="body1" color="text.primary" sx={{ mt: 1,  whiteSpace: 'pre-wrap' }}>
                {shift.description}
              </Typography>
            )}

            </Box>

            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
              <Tooltip title="Edit Shift">
                <IconButton
                  onClick={(e) => { e.stopPropagation(); handleEdit(currentShift); }}
                  size="small"
                  color="info"
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel/Delete Shift">
                <IconButton
                  onClick={(e) => { e.stopPropagation(); handleDelete(currentShift); }}
                  size="small"
                  color="error"
                  disabled={deleting[currentShift.id]}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Tabs
            value={activeTabIdx}
            onChange={(_, v) => handleTabChange(currentShift, v)}
            sx={{ mb: 2 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {ESCALATION_LEVELS
              .filter(level => currentShift.allowed_escalation_levels.includes(level.key))
              .map((level) => {
                const originalIdx = ESCALATION_LEVELS.findIndex(l => l.key === level.key);
                const isDisabled = originalIdx !== currentLevelIdx && !currentShift.allowed_escalation_levels.includes(level.key);

                return (
                  <Tab
                    key={level.key}
                    label={level.label}
                    value={originalIdx}
                    disabled={isDisabled}
                    sx={{
                      bgcolor: originalIdx === currentLevelIdx ? theme.palette.success.light : undefined,
                      color: originalIdx === currentLevelIdx ? theme.palette.success.contrastText : undefined,
                      fontWeight: originalIdx === currentLevelIdx ? 'bold' : undefined,
                      ...(originalIdx === currentLevelIdx + 1 && !escalating[currentShift.id] && !isDisabled && {
                        color: theme.palette.success.main,
                      }),
                    }}
                  />
                );
              })}
          </Tabs>
          {(() => {
            if (!currentTabData || currentTabData.loading) {
              return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
            }

            const selectedTabKey = ESCALATION_LEVELS[activeTabIdx].key;
            const isSelectedTabHigher = activeTabIdx > currentLevelIdx;
            const canEscalateToSelectedTab = currentShift.allowed_escalation_levels.includes(selectedTabKey);

            if (isSelectedTabHigher && canEscalateToSelectedTab) {
              return (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="textSecondary" sx={{ mb: 2 }}>
                    Shift is currently at "{ESCALATION_LEVELS[currentLevelIdx].label}". Click below to escalate.
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleEscalate(currentShift, activeTabIdx)}
                    disabled={escalating[currentShift.id]}
                  >
                    {escalating[currentShift.id] ? 'Escalating…' : `Escalate to ${ESCALATION_LEVELS[activeTabIdx].label}`}
                  </Button>
                </Box>
              );
            }

            if (selectedTabKey === PUBLIC_LEVEL_KEY) {
              const interestsBySlot = currentTabData.interestsBySlot || {};
              const interestsAll = currentTabData.interestsAll || [];

              const publicCandidateCellSx = { padding: '4px', width: '40%' };
              const publicStatusCellSx = { padding: '4px', width: '30%' };
              const publicActionCellSx = { padding: '4px', width: '30%' };

              return (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Interests for each slot:</Typography>
                  {currentShift.slots.length === 0 ? (
                    <Typography color="textSecondary">No slots available for this shift.</Typography>
                  ) : (
                    currentShift.slots.map((slot) => {
                      const slotInterests = interestsBySlot[Number(slot.id)] || [];
                      return (
                        <Box key={slot.id} sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                            Slot: {slot.date} {slot.start_time}–{slot.end_time}
                          </Typography>
                          {slotInterests.length === 0 ? (
                            <Typography color="textSecondary">No one has shown interest for this slot.</Typography>
                          ) : (
                            <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}>
                              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={publicCandidateCellSx}>Candidate</TableCell>
                                    <TableCell sx={publicStatusCellSx}>Status</TableCell>
                                    <TableCell sx={publicActionCellSx}>Action</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {slotInterests.map((interest: Interest) => (
                                    <TableRow key={interest.id}>
                                      <TableCell sx={publicCandidateCellSx}>{interest.user}</TableCell>
                                      <TableCell sx={publicStatusCellSx}>
                                        <Chip label="Interested" color="success" size="small" />
                                      </TableCell>
                                      <TableCell sx={publicActionCellSx}>
                                        <Button
                                          size="small"
                                          variant={interest.revealed ? "outlined" : "contained"}
                                          onClick={() => handleRevealPlatform(currentShift, interest)}
                                        >
                                          {interest.revealed ? "Review Candidate" : "Reveal Candidate"}
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </Box>
                      );
                    })
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Interest in All Slots (Whole Shift):</Typography>
                  {interestsAll.length === 0 ? (
                    <Typography color="textSecondary">No one has shown interest in all slots yet.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={publicCandidateCellSx}>Candidate</TableCell>
                            <TableCell sx={publicStatusCellSx}>Status</TableCell>
                            <TableCell sx={publicActionCellSx}>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {interestsAll.map((interest: Interest) => (
                            <TableRow key={interest.id}>
                              <TableCell sx={publicCandidateCellSx}>{interest.user}</TableCell>
                              <TableCell sx={publicStatusCellSx}>
                                <Chip label="Interested" color="success" size="small" />
                              </TableCell>
                              <TableCell sx={publicActionCellSx}>
                                <Button
                                  size="small"
                                  variant={interest.revealed ? "outlined" : "contained"}
                                  onClick={() => handleRevealPlatform(currentShift, interest)}
                                >
                                  {interest.revealed ? "Review Candidate" : "Reveal Candidate"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              );
            }

            const membersBySlot = currentTabData.membersBySlot || {};
            const allEligibleMembersMap = new Map<number, MemberStatus>();
            for (const slotId in membersBySlot) {
              membersBySlot[slotId].forEach(member => {
                const existing = allEligibleMembersMap.get(member.user_id);
                if (!existing || existing.status !== 'accepted') {
                  allEligibleMembersMap.set(member.user_id, member);
                }
              });
            }
            const membersWithConsolidatedStatus = Array.from(allEligibleMembersMap.values());

            const interestedMembers = membersWithConsolidatedStatus.filter(m => m.status === 'interested');
            const rejectedMembers = membersWithConsolidatedStatus.filter(m => m.status === 'rejected');
            const noResponseMembers = membersWithConsolidatedStatus.filter(m => m.status === 'no_response');
            const assignedMembers = membersWithConsolidatedStatus.filter(m => m.status === 'accepted');

            const nameCellSx = { padding: '4px', width: '35%' };
            const empTypeCellSx = { padding: '4px', width: '25%' };
            const statusCellSx = { padding: '4px', width: '20%' };
            const actionCellSx = { padding: '4px', width: '20%' };

            return (
              <>
                {assignedMembers.length > 0 && (
                  <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Assigned:
                    </Typography>
                    <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={nameCellSx}>Name</TableCell>
                            <TableCell sx={empTypeCellSx}>Emp. Type</TableCell>
                            <TableCell sx={statusCellSx}>Status</TableCell>
                            <TableCell sx={actionCellSx}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {assignedMembers.map(member => (
                            <TableRow key={member.user_id}>
                              <TableCell sx={nameCellSx}>{member.name}</TableCell>
                              <TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell>
                              <TableCell sx={statusCellSx}>
                                <Chip label="Assigned" color="success" variant="filled" sx={{ bgcolor: theme.palette.success.dark, color: theme.palette.success.contrastText }} size="small" />
                              </TableCell>
                              <TableCell sx={actionCellSx}></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Interested in Shift:
                  </Typography>
                  {interestedMembers.length === 0 ? (
                    <Typography color="textSecondary" sx={{ mt: 0.5 }}>No members have shown interest in this shift.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={nameCellSx}>Name</TableCell>
                            <TableCell sx={empTypeCellSx}>Emp. Type</TableCell>
                            <TableCell sx={statusCellSx}>Status</TableCell>
                            <TableCell sx={actionCellSx}>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {interestedMembers.map(member => (
                            <TableRow key={member.user_id}>
                              <TableCell sx={nameCellSx}>{member.name}</TableCell>
                              <TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell>
                              <TableCell sx={statusCellSx}><Chip label="Interested" color="success" size="small" /></TableCell>
                              <TableCell sx={actionCellSx}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleAssign(currentShift, member.user_id, null)}
                                >
                                  Assign
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>

                <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Rejected Shift:
                  </Typography>
                  {rejectedMembers.length === 0 ? (
                    <Typography color="textSecondary" sx={{ mt: 0.5 }}>No members rejected this shift.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={nameCellSx}>Name</TableCell>
                            <TableCell sx={empTypeCellSx}>Emp. Type</TableCell>
                            <TableCell sx={statusCellSx}>Status</TableCell>
                            <TableCell sx={actionCellSx}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rejectedMembers.map(member => (
                            <TableRow key={member.user_id}>
                              <TableCell sx={nameCellSx}>{member.name}</TableCell>
                              <TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell>
                              <TableCell sx={statusCellSx}><Chip label="Rejected" color="error" size="small" /></TableCell>
                              <TableCell sx={actionCellSx}></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>

                <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    No Response:
                  </Typography>
                  {noResponseMembers.length === 0 ? (
                    <Typography color="textSecondary" sx={{ mt: 0.5 }}>All relevant members have responded for this shift.</Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={nameCellSx}>Name</TableCell>
                            <TableCell sx={empTypeCellSx}>Emp. Type</TableCell>
                            <TableCell sx={statusCellSx}>Status</TableCell>
                            <TableCell sx={actionCellSx}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {noResponseMembers.map(member => (
                            <TableRow key={member.user_id}>
                              <TableCell sx={nameCellSx}>{member.name}</TableCell>
                              <TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell>
                              <TableCell sx={statusCellSx}><Chip label="No Response" variant="outlined" size="small" /></TableCell>
                              <TableCell sx={actionCellSx}></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              </>
            );
          })()}
        </AccordionDetails>
      </Accordion>

      {/* Dialog for revealing platform candidate details (existing) */}
      <Dialog open={platformInterestDialog.open} onClose={() => setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null })}>
        <DialogTitle>Candidate Details</DialogTitle>
        <DialogContent>
          {platformInterestDialog.user ? (
            <Box>
              <Typography variant="body1"><b>Name:</b> {platformInterestDialog.user.first_name} {platformInterestDialog.user.last_name}</Typography>
              <Typography variant="body2"><b>Email:</b> {platformInterestDialog.user.email}</Typography>
              {platformInterestDialog.user.phone_number && <Typography variant="body2"><b>Phone:</b> {platformInterestDialog.user.phone_number}</Typography>}
              {platformInterestDialog.user.short_bio && <Typography variant="body2"><b>Bio:</b> {platformInterestDialog.user.short_bio}</Typography>}
              {platformInterestDialog.user.resume && (
                <Button href={platformInterestDialog.user.resume} target="_blank" sx={{ mt: 1 }}>Download CV</Button>
              )}
              {platformInterestDialog.user.rate_preference && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Rate Preference</strong>
                  </Typography>
                  <List dense>
                    {Object.entries(platformInterestDialog.user.rate_preference).map(([key, value]) => (
                      <ListItem key={key} sx={{ py: 0, px: 0 }}>
                        <ListItemText primary={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} secondary={value || "N/A"} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          ) : (
            <CircularProgress />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null })}>
            Close
          </Button>
          {platformInterestDialog.user && (
            <Button variant="contained" color="success" onClick={handleAssignPlatform}>Assign to Shift</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* --- START OF NEW DELETE CONFIRMATION DIALOG --- */}
      <Dialog
        open={openDeleteConfirm}
        onClose={cancelDelete}
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
      >
        <DialogTitle id="delete-confirmation-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography id="delete-confirmation-description">
            Are you sure you want to cancel/delete this shift? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="primary" variant="outlined">
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleting[shiftToDelete || 0]}>
            {deleting[shiftToDelete || 0] ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* --- END OF NEW DELETE CONFIRMATION DIALOG --- */}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
};

export default PosterShiftDetailPage;