// src/pages/dashboard/owner/shifts/ActiveShiftsPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
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
  Skeleton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
// --- 1. ADD IMPORT ---
import ShareIcon from '@mui/icons-material/Share';
import { green, grey } from '@mui/material/colors';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

// ... All your interfaces remain unchanged ...
interface Slot { id: number; date: string; start_time: string; end_time: string; is_recurring?: boolean; recurring_days?: number[]; recurring_end_date?: string | null; }
interface Shift { id: number; single_user_only: boolean; visibility: string; pharmacy_detail: { name: string; address?: string; state?: string; }; role_needed: string; slots: Slot[]; slot_assignments: { slot_id: number; user_id: number }[]; slot_count?: number; assigned_count?: number; escalation_level: number; escalate_to_locum_casual: string | null; escalate_to_owner_chain: string | null; escalate_to_org_chain: string | null; escalate_to_platform: string | null; allowed_escalation_levels: string[]; created_at: string; }
interface MemberStatus { user_id: number; name: string; employment_type: string; role: string; status: 'no_response' | 'interested' | 'rejected' | 'accepted'; is_member: boolean; membership_id?: number; }
interface Interest { id: number; user_id: number; slot_id: number | null; slot_time: string; revealed: boolean; user: string; }
interface RatePreference { weekday: string; saturday: string; sunday: string; public_holiday: string; early_morning: string; late_night: string; }
interface UserDetail { id: number; first_name: string; last_name: string; email: string; phone_number?: string; short_bio?: string; resume?: string; rate_preference?: RatePreference | null; }

const ESCALATION_LEVELS = [
  { level: 0, key: 'FULL_PART_TIME', label: 'My Pharmacy (Full/Part Time)' },
  { level: 1, key: 'LOCUM_CASUAL', label: 'My Pharmacy (Locum/Casual)' },
  { level: 2, key: 'OWNER_CHAIN', label: 'Chain' },
  { level: 3, key: 'ORG_CHAIN', label: 'Organization' },
  { level: 4, key: 'PLATFORM', label: 'Platform (Public)' },
];
const PUBLIC_LEVEL_KEY = 'PLATFORM';
interface TabDataState { loading: boolean; membersBySlot?: Record<number, MemberStatus[]>; interestsBySlot?: Record<number, Interest[]>; interestsAll?: Interest[]; }

const ActiveShiftsPage: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [expandedShift, setExpandedShift] = useState<number | false>(false);
  const [activeTabs, setActiveTabs] = useState<Record<number, number>>({});
  const [tabData, setTabData] = useState<Record<string, TabDataState>>({});
  const [platformInterestDialog, setPlatformInterestDialog] = useState<{ open: boolean; user: UserDetail | null; shiftId: number | null; interest: Interest | null; }>({ open: false, user: null, shiftId: null, interest: null });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [escalating, setEscalating] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<number | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  
  // --- 2. ADD STATE AND HANDLER FUNCTION FOR SHARING ---
  const [sharingShiftId, setSharingShiftId] = useState<number | null>(null);

const handleShare = async (shift: Shift) => {
  // 1. Check if visibility is 'PLATFORM' before proceeding
  if (shift.visibility !== 'PLATFORM') {
    setSnackbar({
      open: true,
      message: 'You have to escalate this shift to platform before sharing.',
    });
    return;
  }

  // 2. Proceed with sharing logic
  setSharingShiftId(shift.id);
  try {
    const res = await apiClient.post<{ share_token: string }>(
      API_ENDPOINTS.generateShareLink(shift.id)
    );
    const token = res.data.share_token;
    const publicUrl = `${window.location.origin}/shifts/link?token=${token}`;

    await navigator.clipboard.writeText(publicUrl);

    setSnackbar({
      open: true,
      message: 'Public share link copied to clipboard!',
    });
  } catch (err) {
    console.error('Share link error:', err);
    setSnackbar({
      open: true,
      message: 'Error: Could not generate share link.',
    });
  } finally {
    setSharingShiftId(null);
  }
};

  // ... All your other functions like getTabKey, useEffect, etc. remain exactly as you provided them ...
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
    return Object.values(userIdToCounts).filter(x => x.count === slotCount).map(x => x.member);
  }, []);

  useEffect(() => {
    setLoadingShifts(true);
    apiClient.get<Shift[]>(API_ENDPOINTS.getActiveShifts)
      .then(res => { setShifts(res.data); })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load active shifts' }))
      .finally(() => setLoadingShifts(false));
  }, []);

  const loadTabData = useCallback(async (shift: Shift, levelIdx: number) => {
    const tabKey = getTabKey(shift.id, levelIdx);
    const escLevel = ESCALATION_LEVELS[levelIdx].key;
    setTabData(td => ({ ...td, [tabKey]: { loading: true } }));
    try {
      if (escLevel === PUBLIC_LEVEL_KEY) {
        const res = await apiClient.get<{ results: Interest[] }>(API_ENDPOINTS.getShiftInterests, { params: { shift: shift.id } });
        const interests: Interest[] = Array.isArray(res.data.results) ? res.data.results : [];
        const interestsBySlot: Record<number, Interest[]> = {};
        const interestsAll: Interest[] = [];
        interests.forEach(interest => {
          if (interest.slot_id === null) interestsAll.push(interest);
          else {
            const sid = Number(interest.slot_id);
            if (!interestsBySlot[sid]) interestsBySlot[sid] = [];
            interestsBySlot[sid].push(interest);
          }
        });
        setTabData(td => ({ ...td, [tabKey]: { loading: false, interestsBySlot, interestsAll } }));
      } else {
        const membersBySlot: Record<number, MemberStatus[]> = {};
        for (const slot of shift.slots) {
          const res = await apiClient.get<MemberStatus[]>(`${API_ENDPOINTS.getActiveShifts}${shift.id}/member_status/`, { params: { slot_id: slot.id, visibility: escLevel } });
          membersBySlot[slot.id] = res.data;
        }
        setTabData(td => ({ ...td, [tabKey]: { loading: false, membersBySlot } }));
      }
    } catch (err: any) {
      console.error(`Failed to load tab data for ${escLevel}:`, err.response?.data || err);
      setSnackbar({ open: true, message: err.response?.data?.detail || `Failed to load data for ${ESCALATION_LEVELS[levelIdx].label}` });
      setTabData(td => ({ ...td, [tabKey]: { ...td[tabKey], loading: false } }));
    }
  }, [getTabKey, findWholeShiftMembers]);

  const handleAccordionChange = useCallback((shift: Shift) => (_: React.SyntheticEvent, expanded: boolean) => {
    setExpandedShift(expanded ? shift.id : false);
    if (expanded) {
      const currentLevelIdx = ESCALATION_LEVELS.findIndex(level => level.key === shift.visibility);
      setActiveTabs(prevActiveTabs => {
        const determinedActiveTabIdx = prevActiveTabs[shift.id] ?? currentLevelIdx;
        if (!tabData[getTabKey(shift.id, determinedActiveTabIdx)]) loadTabData(shift, determinedActiveTabIdx);
        return { ...prevActiveTabs, [shift.id]: determinedActiveTabIdx };
      });
    }
  }, [getTabKey, loadTabData, tabData]);

  const handleTabChange = useCallback((shift: Shift, newTabIndex: number) => {
    setActiveTabs(prevActiveTabs => ({ ...prevActiveTabs, [shift.id]: newTabIndex }));
    if (!tabData[getTabKey(shift.id, newTabIndex)]) loadTabData(shift, newTabIndex);
  }, [getTabKey, loadTabData, tabData]);

  const handleEscalate = async (shift: Shift, targetLevelIdx: number) => {
    setEscalating(e => ({ ...e, [shift.id]: true }));
    const nextVisKey = ESCALATION_LEVELS[targetLevelIdx].key;
    try {
      await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${shift.id}/escalate/`);
      setSnackbar({ open: true, message: `Shift escalated to ${ESCALATION_LEVELS[targetLevelIdx].label}` });
      setShifts(prevShifts => prevShifts.map(s => s.id === shift.id ? { ...s, visibility: nextVisKey, escalation_level: targetLevelIdx } : s));
      setActiveTabs(prevActiveTabs => ({ ...prevActiveTabs, [shift.id]: targetLevelIdx }));
      loadTabData(shift, targetLevelIdx);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to escalate shift' });
    } finally {
      setEscalating(e => ({ ...e, [shift.id]: false }));
    }
  };
  
  const { user } = useAuth();
  const handleEdit = (shift: Shift) => {
    let baseRoute = '/dashboard/owner/post-shift';
    if (user?.role === 'ORG_ADMIN' || user?.role === 'ORG_OWNER' || user?.role === 'ORG_STAFF') baseRoute = '/dashboard/organization/post-shift';
    navigate(`${baseRoute}?edit=${shift.id}`);
  };

  const handleDelete = (shift: Shift) => {
    setShiftToDelete(shift.id);
    setOpenDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (shiftToDelete === null) return;
    setDeleting(d => ({ ...d, [shiftToDelete]: true }));
    try {
      await apiClient.delete(`${API_ENDPOINTS.getActiveShifts}${shiftToDelete}/`);
      setSnackbar({ open: true, message: 'Shift cancelled/deleted successfully.' });
      setShifts(shs => shs.filter(s => s.id !== shiftToDelete));
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

  const handleAssign = (shift: Shift, userId: number, slotId: number | null) => {
    apiClient.post(`${API_ENDPOINTS.getActiveShifts}${shift.id}/accept_user/`, { user_id: userId, slot_id: slotId })
      .then(() => {
        setSnackbar({ open: true, message: 'User assigned.' });
        const currentActiveTabIdx = activeTabs[shift.id] ?? ESCALATION_LEVELS.findIndex(l => l.key === shift.visibility);
        if (currentActiveTabIdx >= 0) loadTabData(shift, currentActiveTabIdx);
        apiClient.get<Shift[]>(API_ENDPOINTS.getActiveShifts)
          .then(res => setShifts(res.data))
          .catch(() => setSnackbar({ open: true, message: 'Failed to refresh active shifts after assignment' }));
      })
      .catch((err: any) => setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to assign user.' }));
  };

  const handleRevealPlatform = (shift: Shift, interest: Interest) => {
    apiClient.post<UserDetail>(`${API_ENDPOINTS.getActiveShifts}${shift.id}/reveal_profile/`, { slot_id: interest.slot_id, user_id: interest.user_id })
      .then(res => {
        setPlatformInterestDialog({ open: true, user: res.data, shiftId: shift.id, interest });
        const publicTabIdx = ESCALATION_LEVELS.findIndex(l => l.key === PUBLIC_LEVEL_KEY);
        loadTabData(shift, publicTabIdx);
      })
      .catch((err: any) => setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to reveal candidate.' }));
  };

  const handleAssignPlatform = () => {
    const { shiftId, user, interest } = platformInterestDialog;
    if (!shiftId || !user || !interest) return;
    apiClient.post(`${API_ENDPOINTS.getActiveShifts}${shiftId}/accept_user/`, { user_id: user.id, slot_id: interest.slot_id })
      .then(() => {
        setSnackbar({ open: true, message: 'User assigned.' });
        setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null });
        const publicTabIdx = ESCALATION_LEVELS.findIndex(l => l.key === PUBLIC_LEVEL_KEY);
        loadTabData(shifts.find(s => s.id === shiftId)!, publicTabIdx);
        apiClient.get<Shift[]>(API_ENDPOINTS.getActiveShifts)
          .then(res => setShifts(res.data))
          .catch(() => setSnackbar({ open: true, message: 'Failed to refresh active shifts after assignment' }));
      })
      .catch((err: any) => setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to assign user.' }));
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Active Shifts</Typography>
      {loadingShifts ? (
        <Box sx={{ py: 2 }}>
          {[...Array(3)].map((_, index) => (
            <Accordion key={index} expanded={false} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Skeleton variant="text" width="60%" height={30} />
                  <Skeleton variant="text" width="40%" height={20} />
                  <Skeleton variant="text" width="80%" height={20} />
                </Box>
              </AccordionSummary>
            </Accordion>
          ))}
        </Box>
      ) : shifts.length === 0 ? (
        <Typography>No active shifts.</Typography>
      ) : (
        shifts.map(shift => {
          const currentLevelIdx = ESCALATION_LEVELS.findIndex(l => l.key === shift.visibility);
          const activeTabIdx = activeTabs[shift.id] ?? currentLevelIdx;
          const currentTabData = tabData[getTabKey(shift.id, activeTabIdx)];
          return (
            <Accordion key={shift.id} expanded={expandedShift === shift.id} onChange={handleAccordionChange(shift)} sx={{ mb: 3, border: `1px solid ${grey[300]}`, borderRadius: 2, boxShadow: '0 2px 10px 0 rgba(0,0,0,0.07)', '&.Mui-expanded': { margin: 'auto', boxShadow: '0 4px 15px 0 rgba(0,0,0,0.1)' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6">{shift.pharmacy_detail.name}</Typography>
                      <Chip label={shift.role_needed} size="small" color="primary" />
                      <Typography variant="body2" sx={{ ml: 2 }}>
                        Current Escalation: <b style={{ color: green[700] }}>{ESCALATION_LEVELS[currentLevelIdx]?.label}</b>
                      </Typography>
                                        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                    <Tooltip title="Get Shareable Link">
                      <IconButton
                          onClick={(e) => { e.stopPropagation(); handleShare(shift); }}
                          size="small"
                          color="primary"
                          disabled={sharingShiftId === shift.id}
                      >
                          <ShareIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Shift">
                      <IconButton onClick={(e) => { e.stopPropagation(); handleEdit(shift); }} size="small" color="info">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancel/Delete Shift">
                      <IconButton onClick={(e) => { e.stopPropagation(); handleDelete(shift); }} size="small" color="error" disabled={deleting[shift.id]}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {shift.pharmacy_detail.address ? `${shift.pharmacy_detail.address}, ` : ''}{shift.pharmacy_detail.state || ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {/* MINIMAL FIX: Use optional chaining to prevent crash if shift.slots is undefined */}
                      Slots: {shift.slots?.map(s => `${s.date} ${s.start_time}–${s.end_time}`).join(' | ')}
                    </Typography>
                  </Box>

                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Tabs value={activeTabIdx} onChange={(_, v) => handleTabChange(shift, v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
                  {ESCALATION_LEVELS.filter(level => shift.allowed_escalation_levels.includes(level.key)).map((level) => {
                    const originalIdx = ESCALATION_LEVELS.findIndex(l => l.key === level.key);
                    const isDisabled = originalIdx !== currentLevelIdx && !shift.allowed_escalation_levels.includes(level.key);
                    return (<Tab key={level.key} label={level.label} value={originalIdx} disabled={isDisabled} sx={{ bgcolor: originalIdx === currentLevelIdx ? theme.palette.success.light : undefined, color: originalIdx === currentLevelIdx ? theme.palette.success.contrastText : undefined, fontWeight: originalIdx === currentLevelIdx ? 'bold' : undefined, ...(originalIdx === currentLevelIdx + 1 && !escalating[shift.id] && !isDisabled && { color: theme.palette.success.main, }), }} />);
                  })}
                </Tabs>
                {(() => {
                  if (!currentTabData || currentTabData.loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>;
                  const selectedTabKey = ESCALATION_LEVELS[activeTabIdx].key;
                  const isSelectedTabHigher = activeTabIdx > currentLevelIdx;
                  const canEscalateToSelectedTab = shift.allowed_escalation_levels.includes(selectedTabKey);

                  if (isSelectedTabHigher && canEscalateToSelectedTab) {
                    return (<Box sx={{ py: 4, textAlign: 'center' }}><Typography color="textSecondary" sx={{ mb: 2 }}>Shift is currently at "{ESCALATION_LEVELS[currentLevelIdx].label}". Click below to escalate.</Typography><Button variant="contained" color="success" onClick={() => handleEscalate(shift, activeTabIdx)} disabled={escalating[shift.id]}>{escalating[shift.id] ? 'Escalating…' : `Escalate to ${ESCALATION_LEVELS[activeTabIdx].label}`}</Button></Box>);
                  }
                  if (selectedTabKey === PUBLIC_LEVEL_KEY) {
                    const interestsBySlot = currentTabData.interestsBySlot || {};
                    const interestsAll = currentTabData.interestsAll || [];
                    const publicCandidateCellSx = { padding: '4px', width: '40%' };
                    const publicStatusCellSx = { padding: '4px', width: '30%' };
                    const publicActionCellSx = { padding: '4px', width: '30%' };
                    return (<>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Interests for each slot:</Typography>
                        {/* MINIMAL FIX: Use optional chaining here as well to prevent crash */}
                        {shift.slots?.length === 0 ? <Typography color="textSecondary">No slots available for this shift.</Typography> : shift.slots?.map((slot) => {
                            const slotInterests = interestsBySlot[Number(slot.id)] || [];
                            return (<Box key={slot.id} sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}><Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Slot: {slot.date} {slot.start_time}–{slot.end_time}</Typography>{slotInterests.length === 0 ? <Typography color="textSecondary">No one has shown interest for this slot.</Typography> : <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed' }}><TableHead><TableRow><TableCell sx={publicCandidateCellSx}>Candidate</TableCell><TableCell sx={publicStatusCellSx}>Status</TableCell><TableCell sx={publicActionCellSx}>Action</TableCell></TableRow></TableHead><TableBody>{slotInterests.map((interest: Interest) => (<TableRow key={interest.id}><TableCell sx={publicCandidateCellSx}>{interest.user}</TableCell><TableCell sx={publicStatusCellSx}><Chip label="Interested" color="success" size="small" /></TableCell><TableCell sx={publicActionCellSx}><Button size="small" variant={interest.revealed ? "outlined" : "contained"} onClick={() => handleRevealPlatform(shift, interest)}>{interest.revealed ? "Review Candidate" : "Reveal Candidate"}</Button></TableCell></TableRow>))}</TableBody></Table></TableContainer>}</Box>);
                          })}
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Interest in All Slots (Whole Shift):</Typography>
                        {interestsAll.length === 0 ? <Typography color="textSecondary">No one has shown interest in all slots yet.</Typography> : <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed' }}><TableHead><TableRow><TableCell sx={publicCandidateCellSx}>Candidate</TableCell><TableCell sx={publicStatusCellSx}>Status</TableCell><TableCell sx={publicActionCellSx}>Action</TableCell></TableRow></TableHead><TableBody>{interestsAll.map((interest: Interest) => (<TableRow key={interest.id}><TableCell sx={publicCandidateCellSx}>{interest.user}</TableCell><TableCell sx={publicStatusCellSx}><Chip label="Interested" color="success" size="small" /></TableCell><TableCell sx={publicActionCellSx}><Button size="small" variant={interest.revealed ? "outlined" : "contained"} onClick={() => handleRevealPlatform(shift, interest)}>{interest.revealed ? "Review Candidate" : "Reveal Candidate"}</Button></TableCell></TableRow>))}</TableBody></Table></TableContainer>}
                      </>);
                  }
                  const membersBySlot = currentTabData.membersBySlot || {};
                  const allEligibleMembersMap = new Map<number, MemberStatus>();
                  for (const slotId in membersBySlot) {
                    membersBySlot[slotId].forEach(member => {
                      const existing = allEligibleMembersMap.get(member.user_id);
                      if (!existing || existing.status !== 'accepted') allEligibleMembersMap.set(member.user_id, member);
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
                  return (<>
                      {assignedMembers.length > 0 && <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>Assigned:</Typography><TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed' }}><TableHead><TableRow><TableCell sx={nameCellSx}>Name</TableCell><TableCell sx={empTypeCellSx}>Emp. Type</TableCell><TableCell sx={statusCellSx}>Status</TableCell><TableCell sx={actionCellSx}></TableCell></TableRow></TableHead><TableBody>{assignedMembers.map(member => (<TableRow key={member.user_id}><TableCell sx={nameCellSx}>{member.name}</TableCell><TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell><TableCell sx={statusCellSx}><Chip label="Assigned" color="success" variant="filled" sx={{ bgcolor: theme.palette.success.dark, color: theme.palette.success.contrastText }} size="small" /></TableCell><TableCell sx={actionCellSx}></TableCell></TableRow>))}</TableBody></Table></TableContainer></Box>}
                      <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>Interested in Shift:</Typography>{interestedMembers.length === 0 ? <Typography color="textSecondary" sx={{ mt: 0.5 }}>No members have shown interest in this shift.</Typography> : <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed' }}><TableHead><TableRow><TableCell sx={nameCellSx}>Name</TableCell><TableCell sx={empTypeCellSx}>Emp. Type</TableCell><TableCell sx={statusCellSx}>Status</TableCell><TableCell sx={actionCellSx}>Action</TableCell></TableRow></TableHead><TableBody>{interestedMembers.map(member => (<TableRow key={member.user_id}><TableCell sx={nameCellSx}>{member.name}</TableCell><TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell><TableCell sx={statusCellSx}><Chip label="Interested" color="success" size="small" /></TableCell><TableCell sx={actionCellSx}><Button size="small" variant="contained" color="success" onClick={() => handleAssign(shift, member.user_id, null)}>Assign</Button></TableCell></TableRow>))}</TableBody></Table></TableContainer>}</Box>
                      <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>Rejected Shift:</Typography>{rejectedMembers.length === 0 ? <Typography color="textSecondary" sx={{ mt: 0.5 }}>No members rejected this shift.</Typography> : <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed' }}><TableHead><TableRow><TableCell sx={nameCellSx}>Name</TableCell><TableCell sx={empTypeCellSx}>Emp. Type</TableCell><TableCell sx={statusCellSx}>Status</TableCell><TableCell sx={actionCellSx}></TableCell></TableRow></TableHead><TableBody>{rejectedMembers.map(member => (<TableRow key={member.user_id}><TableCell sx={nameCellSx}>{member.name}</TableCell><TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell><TableCell sx={statusCellSx}><Chip label="Rejected" color="error" size="small" /></TableCell><TableCell sx={actionCellSx}></TableCell></TableRow>))}</TableBody></Table></TableContainer>}</Box>
                      <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>No Response:</Typography>{noResponseMembers.length === 0 ? <Typography color="textSecondary" sx={{ mt: 0.5 }}>All relevant members have responded for this shift.</Typography> : <TableContainer component={Paper} sx={{ mt: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed' }}><TableHead><TableRow><TableCell sx={nameCellSx}>Name</TableCell><TableCell sx={empTypeCellSx}>Emp. Type</TableCell><TableCell sx={statusCellSx}>Status</TableCell><TableCell sx={actionCellSx}></TableCell></TableRow></TableHead><TableBody>{noResponseMembers.map(member => (<TableRow key={member.user_id}><TableCell sx={nameCellSx}>{member.name}</TableCell><TableCell sx={empTypeCellSx}>{member.employment_type.replace('_', ' ')}</TableCell><TableCell sx={statusCellSx}><Chip label="No Response" variant="outlined" size="small" /></TableCell><TableCell sx={actionCellSx}></TableCell></TableRow>))}</TableBody></Table></TableContainer>}</Box>
                    </>);
                })()}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
      <Dialog open={platformInterestDialog.open} onClose={() => setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null })}>
        <DialogTitle>Candidate Details</DialogTitle>
        <DialogContent>{platformInterestDialog.user ? <Box><Typography variant="body1"><b>Name:</b> {platformInterestDialog.user.first_name} {platformInterestDialog.user.last_name}</Typography><Typography variant="body2"><b>Email:</b> {platformInterestDialog.user.email}</Typography>{platformInterestDialog.user.phone_number && <Typography variant="body2"><b>Phone:</b> {platformInterestDialog.user.phone_number}</Typography>}{platformInterestDialog.user.short_bio && <Typography variant="body2"><b>Bio:</b> {platformInterestDialog.user.short_bio}</Typography>}{platformInterestDialog.user.resume && (<Button href={platformInterestDialog.user.resume} target="_blank" sx={{ mt: 1 }}>Download CV</Button>)}{platformInterestDialog.user.rate_preference && (<Box mt={2}><Typography variant="subtitle2" gutterBottom><strong>Rate Preference</strong></Typography><List dense>{Object.entries(platformInterestDialog.user.rate_preference).map(([key, value]) => (<ListItem key={key} sx={{ py: 0, px: 0 }}><ListItemText primary={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} secondary={value || "N/A"} /></ListItem>))}</List></Box>)}</Box> : <CircularProgress />}</DialogContent>
        <DialogActions><Button onClick={() => setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null })}>Close</Button>{platformInterestDialog.user && (<Button variant="contained" color="success" onClick={handleAssignPlatform}>Assign to Shift</Button>)}</DialogActions>
      </Dialog>
      <Dialog open={openDeleteConfirm} onClose={cancelDelete} aria-labelledby="delete-confirmation-title" aria-describedby="delete-confirmation-description">
        <DialogTitle id="delete-confirmation-title">Confirm Delete</DialogTitle><DialogContent><Typography id="delete-confirmation-description">Are you sure you want to cancel/delete this shift? This action cannot be undone.</Typography></DialogContent>
        <DialogActions><Button onClick={cancelDelete} color="primary" variant="outlined">Cancel</Button><Button onClick={confirmDelete} color="error" variant="contained" disabled={deleting[shiftToDelete || 0]}>{deleting[shiftToDelete || 0] ? <CircularProgress size={24} /> : 'Delete'}</Button></DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} action={<IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}><CloseIcon fontSize="small" /></IconButton>} />
    </Container>
  );
};

export default ActiveShiftsPage;