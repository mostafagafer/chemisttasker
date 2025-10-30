
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Tooltip,
  Divider,
  Skeleton,
  Card,
  CardContent,
  CardHeader,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled,
  createTheme,
  ThemeProvider,
  Stack,
  Avatar,
  ButtonBase,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  Info as InfoIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassIcon,
  Favorite as FavoriteIcon,
  People as PeopleIcon,
  Store as StoreIcon,
  CorporateFare as CorporateFareIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
// --- Timezone handling (match PostShiftPage) ---
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

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

type ClaimStatus = "PENDING" | "ACCEPTED" | "REJECTED" | null;

interface PharmacyDetail {
  id: number;
  name: string;
  street_address?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  owner?: { id: number; user?: { id: number; email?: string } | undefined } | null;
  organization?: { id: number; name?: string } | number | null;
  claim_status?: ClaimStatus;
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

interface Interest {
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

interface UserDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  short_bio?: string;
  resume?: string;
  rate_preference?: RatePreference | null;
}

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

type EscalationKey = 'FULL_PART_TIME' | 'LOCUM_CASUAL' | 'OWNER_CHAIN' | 'ORG_CHAIN' | 'PLATFORM';

const PUBLIC_LEVEL_KEY: EscalationKey = 'PLATFORM';

const fontStyleId = 'inter-font-import';
if (typeof document !== 'undefined' && !document.head.querySelector(`#${fontStyleId}`)) {
  const fontStyle = document.createElement('style');
  fontStyle.id = fontStyleId;
  fontStyle.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  `;
  document.head.appendChild(fontStyle);
}

const customTheme = createTheme({
  palette: {
    primary: { main: '#6D28D9', light: '#8B5CF6', dark: '#5B21B6' },
    secondary: { main: '#10B981', light: '#6EE7B7', dark: '#047857' },
    success: { main: '#10B981', light: '#E0F2F1', dark: '#047857' },
    error: { main: '#EF4444', light: '#FEE2E2', dark: '#B91C1C' },
    warning: { main: '#F59E0B', light: '#FFFBEB', dark: '#B45309' },
    info: { main: '#0EA5E9', light: '#E0F2FE', dark: '#0284C7' },
    background: { default: '#F9FAFB', paper: '#FFFFFF' },
  },
  typography: { fontFamily: "'Inter', sans-serif" },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600, boxShadow: 'none' },
        containedPrimary: {
          color: '#FFFFFF',
          background: 'linear-gradient(to right, #8B5CF6, #6D28D9)',
          '&:hover': { background: 'linear-gradient(to right, #A78BFA, #8B5CF6)' },
        },
        containedSecondary: {
          color: '#FFFFFF',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid #E5E7EB' },
      },
    },
  },
});

const ESCALATION_LEVELS: Array<{
  key: EscalationKey;
  label: string;
  icon: React.ElementType;
  requiresOrganization?: boolean;
}> = [
  { key: 'FULL_PART_TIME', label: 'My Pharmacy', icon: PeopleIcon },
  { key: 'LOCUM_CASUAL', label: 'Favourites', icon: FavoriteIcon },
  { key: 'OWNER_CHAIN', label: 'Chain', icon: StoreIcon },
  { key: 'ORG_CHAIN', label: 'Organization', icon: CorporateFareIcon, requiresOrganization: true },
  { key: 'PLATFORM', label: 'Platform', icon: PublicIcon },
];

const STATUS_PRIORITY: Record<MemberStatus['status'], number> = {
  rejected: 0,
  no_response: 1,
  interested: 2,
  accepted: 3,
};
const dedupeMembers = (members: MemberStatus[]): MemberStatus[] => {
  const map = new Map<number, MemberStatus>();
  members.forEach(member => {
    const existing = map.get(member.user_id);
    if (!existing || STATUS_PRIORITY[member.status] > STATUS_PRIORITY[existing.status]) {
      map.set(member.user_id, member);
    }
  });
  return Array.from(map.values());
};

const deriveLevelSequence = (shift: Shift) => {
  const allowed = new Set(shift.allowed_escalation_levels ?? []);
  if (!allowed.size) {
    return ESCALATION_LEVELS;
  }
  return ESCALATION_LEVELS.filter(level => allowed.has(level.key));
};

interface ColorStepIconProps {
  completed?: boolean;
  active?: boolean;
  className?: string;
  icon: React.ElementType;
}

const ColorStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #8B5CF6 0%, #6D28D9 50%, #5B21B6 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #8B5CF6 0%, #6D28D9 50%, #5B21B6 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#E0E7FF',
    borderRadius: 1,
  },
}));

const ColorStepIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean };
}>(({ ownerState }) => ({
  backgroundColor: ownerState.completed || ownerState.active ? '#6D28D9' : '#E0E7FF',
  zIndex: 1,
  color: ownerState.completed || ownerState.active ? '#FFFFFF' : '#6B7280',
  width: 48,
  height: 48,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'all 0.2s ease',
  boxShadow: ownerState.active ? '0 8px 16px rgba(109, 40, 217, 0.25)' : 'none',
}));

const ColorStepIcon: React.FC<ColorStepIconProps> = ({ active, completed, className, icon: Icon }) => (
  <ColorStepIconRoot ownerState={{ completed, active }} className={className}>
    <Icon sx={{ fontSize: 24 }} />
  </ColorStepIconRoot>
);

interface TabDataState {
  loading: boolean;
  membersBySlot?: Record<number, MemberStatus[]>;
  interestsBySlot?: Record<number, Interest[]>;
  interestsAll?: Interest[];
}

const formatAddress = (pharmacy: PharmacyDetail) =>
  [
    pharmacy.street_address,
    pharmacy.suburb,
    pharmacy.state,
    pharmacy.postcode,
  ]
    .filter(Boolean)
    .join(', ');

const formatSlotLabel = (slot: Slot) => {
  const localDate = dayjs.utc(`${slot.date}T${slot.start_time}`).local().format('ddd, MMM D YYYY h:mm A');
  const localEnd = dayjs.utc(`${slot.date}T${slot.end_time}`).local().format('h:mm A');
  return `${localDate} – ${localEnd}`;
};
const PosterShiftDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user as AuthUser | undefined;
  const outerTheme = useTheme();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [tabData, setTabData] = useState<Record<string, TabDataState>>({});
  const [selectedLevelKey, setSelectedLevelKey] = useState<EscalationKey | null>(null);
  const [platformInterestDialog, setPlatformInterestDialog] = useState<{
    open: boolean;
    user: UserDetail | null;
    shiftId: number | null;
    interest: Interest | null;
  }>({ open: false, user: null, shiftId: null, interest: null });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [escalating, setEscalating] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<number | null>(null);
  const [revealingInterestId, setRevealingInterestId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const showSnackbar = useCallback((message: string) => {
    setSnackbar({ open: true, message });
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbar({ open: false, message: '' });
  }, []);

  const getTabKey = useCallback((shiftId: number, levelKey: EscalationKey) => `${shiftId}_${levelKey}`, []);

  const loadTabData = useCallback(
    async (currentShift: Shift, levelKey: EscalationKey) => {
      const tabKey = getTabKey(currentShift.id, levelKey);

      setTabData(prev => ({
        ...prev,
        [tabKey]: { ...(prev[tabKey] ?? {}), loading: true },
      }));

      try {
        if (levelKey === PUBLIC_LEVEL_KEY) {
          const res = await apiClient.get<PaginatedResponse<Interest>>(API_ENDPOINTS.getShiftInterests, {
            params: { shift: currentShift.id },
          });

          const interests = Array.isArray(res.data.results) ? res.data.results : [];
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

          setTabData(prev => ({
            ...prev,
            [tabKey]: {
              loading: false,
              interestsBySlot,
              interestsAll,
            },
          }));
        } else {
          const membersBySlotEntries = await Promise.all(
            currentShift.slots.map(async slot => {
              const response = await apiClient.get<MemberStatus[]>(
                `${API_ENDPOINTS.getActiveShifts}${currentShift.id}/member_status/`,
                { params: { slot_id: slot.id, visibility: levelKey } }
              );
              return [slot.id, response.data] as const;
            })
          );

          const membersBySlot = membersBySlotEntries.reduce<Record<number, MemberStatus[]>>((acc, [slotId, members]) => {
            acc[slotId] = members;
            return acc;
          }, {});

          setTabData(prev => ({
            ...prev,
            [tabKey]: {
              loading: false,
              membersBySlot,
            },
          }));
        }
      } catch (err: any) {
        const levelMeta = ESCALATION_LEVELS.find(level => level.key === levelKey);
        console.error(`Failed to load tab data for ${levelKey}:`, err.response?.data || err);
        showSnackbar(err.response?.data?.detail || `Failed to load data for ${levelMeta?.label ?? 'selected level'}.`);
        setTabData(prev => ({
          ...prev,
          [tabKey]: { ...(prev[tabKey] ?? {}), loading: false },
        }));
      }
    },
    [getTabKey, showSnackbar]
  );

  const handleLevelSelect = useCallback(
    (currentShift: Shift, levelKey: EscalationKey) => {
      const allowedKeys = new Set(currentShift.allowed_escalation_levels || []);
      if (!allowedKeys.size) {
        ESCALATION_LEVELS.forEach(level => allowedKeys.add(level.key));
      }
      if (!allowedKeys.has(levelKey)) {
        return;
      }

      setSelectedLevelKey(levelKey);
      const tabKey = getTabKey(currentShift.id, levelKey);
      if (!tabData[tabKey]) {
        loadTabData(currentShift, levelKey);
      }
    },
    [getTabKey, loadTabData, tabData]
  );
  const handleEscalate = useCallback(
    async (currentShift: Shift, targetLevelKey: EscalationKey) => {
      const targetLevelIdx = ESCALATION_LEVELS.findIndex(level => level.key === targetLevelKey);
      if (targetLevelIdx === -1) return;

      setEscalating(prev => ({ ...prev, [currentShift.id]: true }));
      try {
        await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/escalate/`, {
          target_visibility: targetLevelKey,
        });
        showSnackbar(`Shift escalated to ${ESCALATION_LEVELS[targetLevelIdx].label}.`);

        const updatedShiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/`);
        setShift(updatedShiftRes.data);
        setSelectedLevelKey(targetLevelKey);
        loadTabData(updatedShiftRes.data, targetLevelKey);
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to escalate shift.');
      } finally {
        setEscalating(prev => ({ ...prev, [currentShift.id]: false }));
      }
    },
    [loadTabData, showSnackbar]
  );

  const handleEdit = useCallback(
    (currentShift: Shift) => {
      let baseRoute = '/dashboard/owner/post-shift';
      if (user?.role === 'ORG_ADMIN' || user?.role === 'ORG_OWNER' || user?.role === 'ORG_STAFF') {
        baseRoute = '/dashboard/organization/post-shift';
      }
      navigate(`${baseRoute}?edit=${currentShift.id}`);
    },
    [navigate, user?.role]
  );

  const handleDelete = useCallback((currentShift: Shift) => {
    setShiftToDelete(currentShift.id);
    setOpenDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (shiftToDelete === null) return;

    setDeleting(prev => ({ ...prev, [shiftToDelete]: true }));
    try {
      await apiClient.delete(`${API_ENDPOINTS.getActiveShifts}${shiftToDelete}/`);
      showSnackbar('Shift cancelled/deleted successfully.');
      navigate(-1);
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to cancel shift.');
    } finally {
      setDeleting(prev => ({ ...prev, [shiftToDelete]: false }));
      setOpenDeleteConfirm(false);
      setShiftToDelete(null);
    }
  }, [navigate, shiftToDelete, showSnackbar]);

  const cancelDelete = useCallback(() => {
    setOpenDeleteConfirm(false);
    setShiftToDelete(null);
  }, []);

  const handleAssign = useCallback(
    async (currentShift: Shift, userId: number, slotId: number | null) => {
      setAssigning(true);
      try {
        await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/accept_user/`, {
          user_id: userId,
          slot_id: slotId,
        });
        showSnackbar('User assigned.');

        const updatedShiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${currentShift.id}/`);
        setShift(updatedShiftRes.data);
        const levelKey = selectedLevelKey ?? (updatedShiftRes.data.visibility as EscalationKey);
        loadTabData(updatedShiftRes.data, levelKey);
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to assign user.');
      } finally {
        setAssigning(false);
      }
    },
    [loadTabData, selectedLevelKey, showSnackbar]
  );

  const handleRevealPlatform = useCallback(
    async (currentShift: Shift, interest: Interest) => {
      setRevealingInterestId(interest.id);
      try {
        const res = await apiClient.post<UserDetail>(
          `${API_ENDPOINTS.getActiveShifts}${currentShift.id}/reveal_profile/`,
          { slot_id: interest.slot_id, user_id: interest.user_id }
        );
        setPlatformInterestDialog({ open: true, user: res.data, shiftId: currentShift.id, interest });
        loadTabData(currentShift, PUBLIC_LEVEL_KEY);
      } catch (err: any) {
        showSnackbar(err.response?.data?.detail || 'Failed to reveal candidate.');
      } finally {
        setRevealingInterestId(null);
      }
    },
    [loadTabData, showSnackbar]
  );

  const handleAssignPlatform = useCallback(async () => {
    const { shiftId, user: candidateUser, interest } = platformInterestDialog;
    if (!shift || !shiftId || !candidateUser || !interest) return;

    setAssigning(true);
    try {
      await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${shiftId}/accept_user/`, {
        user_id: candidateUser.id,
        slot_id: interest.slot_id,
      });
      showSnackbar('User assigned.');
      setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null });

      const updatedShiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${shiftId}/`);
      setShift(updatedShiftRes.data);
      setSelectedLevelKey(PUBLIC_LEVEL_KEY);
      loadTabData(updatedShiftRes.data, PUBLIC_LEVEL_KEY);
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to assign user.');
    } finally {
      setAssigning(false);
    }
  }, [loadTabData, platformInterestDialog, shift, showSnackbar]);

  useEffect(() => {
    if (!id || !user) {
      setLoadingInitial(false);
      return;
    }

    const fetchShiftData = async () => {
      setLoadingInitial(true);
      try {
        const shiftRes = await apiClient.get<Shift>(`${API_ENDPOINTS.getActiveShifts}${id}/`);
        setShift(shiftRes.data);
        const currentVisibility = shiftRes.data.visibility as EscalationKey;
        setSelectedLevelKey(currentVisibility);
        loadTabData(shiftRes.data, currentVisibility);
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.detail ||
          'Failed to load shift. It might not exist or you may not have permission to view it.';
        console.error('Shift detail load error:', err.response?.data || err);
        showSnackbar(errorMessage);
        setShift(null);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchShiftData();
  }, [id, loadTabData, showSnackbar, user]);

  const renderStatusCard = useCallback(
    (
      title: string,
      members: MemberStatus[],
      icon: React.ReactElement,
      color: 'success' | 'info' | 'error' | 'warning',
      options: { showAssign?: boolean; emptyLabel?: string } = {}
    ) => {
      if (!shift) return null;

      return (
        <Card
          sx={{
            backgroundColor: customTheme.palette.background.paper,
            boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
            border: '1px solid rgba(15,23,42,0.08)',
          }}
        >
          <CardHeader
            avatar={
              <Avatar
                sx={{
                  bgcolor: customTheme.palette[color].light,
                  color: customTheme.palette[color].dark,
                }}
              >
                {icon}
              </Avatar>
            }
            title={
              <Typography variant="h6" sx={{ fontWeight: 700, color: customTheme.palette[color].dark }}>
                {title}
              </Typography>
            }
            action={
              <Chip
                label={members.length}
                size="small"
                sx={{
                  backgroundColor: customTheme.palette[color].dark,
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              />
            }
          />
          <CardContent>
            {members.length > 0 ? (
              <Stack spacing={1.5}>
                {members.map(member => (
                  <Paper
                    key={member.user_id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      borderColor: 'rgba(148,163,184,0.35)',
                      backgroundColor: 'rgba(99,102,241,0.03)',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1.5}
                    >
                      <Box>
                        <Typography fontWeight={600}>{member.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {member.employment_type.replace(/_/g, ' ')}
                        </Typography>
                        {member.role && (
                          <Typography variant="caption" color="text.secondary">
                            {member.role}
                          </Typography>
                        )}
                      </Box>
                      {options.showAssign && (
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          onClick={() => handleAssign(shift, member.user_id, null)}
                          disabled={assigning}
                          startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : undefined}
                        >
                          Assign
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                {options.emptyLabel ?? 'No candidates yet.'}
              </Typography>
            )}
          </CardContent>
        </Card>
      );
    },
    [assigning, handleAssign, shift]
  );

  const levelSequence = useMemo(
    () => (shift ? deriveLevelSequence(shift) : ESCALATION_LEVELS),
    [shift]
  );

  const currentLevelIdx = shift
    ? levelSequence.findIndex(level => level.key === shift.visibility)
    : -1;

  const defaultLevelKey: EscalationKey =
    shift && currentLevelIdx >= 0 && levelSequence[currentLevelIdx]
      ? levelSequence[currentLevelIdx].key
      : shift
      ? (shift.visibility as EscalationKey)
      : levelSequence[0]?.key ?? PUBLIC_LEVEL_KEY;

  const effectiveLevelKey: EscalationKey =
    selectedLevelKey && levelSequence.some(level => level.key === selectedLevelKey)
      ? selectedLevelKey
      : defaultLevelKey;

  const currentTabKey = shift ? getTabKey(shift.id, effectiveLevelKey) : null;
  const currentTabData = currentTabKey ? tabData[currentTabKey] : undefined;

  const selectedLevelIdx = levelSequence.findIndex(level => level.key === effectiveLevelKey);

  const allowedKeys = new Set(shift?.allowed_escalation_levels || []);
  if (!allowedKeys.size) {
    ESCALATION_LEVELS.forEach(level => allowedKeys.add(level.key));
  }

  const nextLevel =
    currentLevelIdx !== -1 && currentLevelIdx + 1 < levelSequence.length
      ? levelSequence[currentLevelIdx + 1]
      : undefined;

  const canEscalateToSelected =
    !!(shift && selectedLevelIdx > currentLevelIdx && selectedLevelIdx !== -1 && allowedKeys.has(effectiveLevelKey));

  const canEscalateToNext =
    !!(shift && nextLevel && allowedKeys.has(nextLevel.key));

  const escalateTarget =
    canEscalateToSelected
      ? levelSequence[selectedLevelIdx]
      : canEscalateToNext
      ? nextLevel
      : undefined;


  const aggregatedMembers = useMemo(() => {
    if (!currentTabData?.membersBySlot) return [] as MemberStatus[];
    return dedupeMembers(Object.values(currentTabData.membersBySlot).flat());
  }, [currentTabData]);

  const platformAggregatedMembers = useMemo(() => {
    if (!shift || effectiveLevelKey !== PUBLIC_LEVEL_KEY) return [] as MemberStatus[];
    const levelsToAggregate = levelSequence.slice(0, Math.max(0, currentLevelIdx));
    const previousEntries = levelsToAggregate.map(level => tabData[getTabKey(shift.id, level.key)]);
    return dedupeMembers(
      previousEntries.flatMap(entry =>
        entry?.membersBySlot ? Object.values(entry.membersBySlot).flat() : []
      )
    );
  }, [currentLevelIdx, effectiveLevelKey, getTabKey, levelSequence, shift, tabData]);

  if (loadingInitial) {
    return (
      <ThemeProvider theme={customTheme}>
        <Container
          maxWidth={false}
          sx={{ py: 4, backgroundColor: customTheme.palette.background.default, minHeight: '100vh' }}
        >
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Active Shift Details
          </Typography>
          <Card sx={{ mb: 3, boxShadow: '0 8px 20px rgba(15,23,42,0.08)' }}>
            <CardContent>
              <Skeleton variant="text" width="40%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="60%" height={24} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={140} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={220} sx={{ mt: 3, borderRadius: 2 }} />
            </CardContent>
          </Card>
        </Container>
      </ThemeProvider>
    );
  }

  if (!shift) {
    return (
      <ThemeProvider theme={customTheme}>
        <Container
          maxWidth={false}
          sx={{ py: 4, backgroundColor: customTheme.palette.background.default, minHeight: '100vh' }}
        >
          <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            Shift details could not be loaded. It might not exist or you may not have permission to view it.
          </Typography>
        </Container>
      </ThemeProvider>
    );
  }

  const effectiveLevelMeta = levelSequence.find(level => level.key === effectiveLevelKey);

  const cardBorderColor =
    effectiveLevelKey === PUBLIC_LEVEL_KEY
      ? customTheme.palette.secondary.light
      : customTheme.palette.primary.light;

  const interestedMembers = aggregatedMembers.filter(member => member.status === 'interested');
  const assignedMembers = aggregatedMembers.filter(member => member.status === 'accepted');
  const rejectedMembers = aggregatedMembers.filter(member => member.status === 'rejected');
  const noResponseMembers = aggregatedMembers.filter(member => member.status === 'no_response');

  const platformInterested = platformAggregatedMembers.filter(member => member.status === 'interested');
  const platformAssigned = platformAggregatedMembers.filter(member => member.status === 'accepted');
  const platformRejected = platformAggregatedMembers.filter(member => member.status === 'rejected');
  const platformNoResponse = platformAggregatedMembers.filter(member => member.status === 'no_response');
  return (
    <ThemeProvider theme={customTheme}>
      <Container
        maxWidth={false}
        sx={{ py: 4, backgroundColor: customTheme.palette.background.default, minHeight: '100vh' }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#111827' }}>
          Active Shift Details
        </Typography>

        <Card
          sx={{
            boxShadow: '0 16px 40px rgba(15,23,42,0.12)',
            borderLeft: `6px solid ${cardBorderColor}`,
            overflow: 'hidden',
          }}
        >
          <CardHeader
            disableTypography
            title={
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {shift.pharmacy_detail.name}
              </Typography>
            }
            subheader={
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Chip
                  label={shift.role_needed}
                  size="small"
                  sx={{
                    backgroundColor: cardBorderColor,
                    color: '#FFFFFF',
                    fontWeight: 600,
                    letterSpacing: 0.4,
                  }}
                />
                {effectiveLevelMeta && (
                  <Typography variant="body2" color="text.secondary">
                    Current escalation: <strong>{effectiveLevelMeta.label}</strong>
                  </Typography>
                )}
              </Stack>
            }
            action={
              <Stack direction="row" spacing={1}>
                <Tooltip title="Edit shift">
                  <IconButton color="primary" onClick={() => handleEdit(shift)}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel/Delete shift">
                  <span>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(shift)}
                      disabled={deleting[shift.id]}
                    >
                      {deleting[shift.id] ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
            sx={{ pb: 0 }}
          />

          <CardContent sx={{ pt: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 2,
                mb: 3,
              }}
            >
              <Typography
                variant="body2"
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#4B5563' }}
              >
                <BusinessIcon sx={{ fontSize: 18 }} />
                {formatAddress(shift.pharmacy_detail) || 'Address not available'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#4B5563' }}
              >
                <CalendarIcon sx={{ fontSize: 18 }} />
                {shift.slots.length
                  ? shift.slots.map(slot => formatSlotLabel(slot)).join(' | ')
                  : 'No slots defined'}
              </Typography>
            </Box>

            {shift.description && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 3,
                  borderColor: 'rgba(148,163,184,0.35)',
                  backgroundColor: 'rgba(99,102,241,0.05)',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <InfoIcon sx={{ mt: '2px', fontSize: 20, color: '#6366F1' }} />
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#1F2937' }}>
                    {shift.description}
                  </Typography>
                </Stack>
              </Paper>
            )}

            <Stepper alternativeLabel activeStep={Math.max(0, currentLevelIdx)} connector={<ColorStepConnector />}>
              {levelSequence.map((level, index) => (
                <Step key={level.key} completed={index < currentLevelIdx}>
                  {(() => {
                    const levelSelectable = index <= currentLevelIdx || allowedKeys.has(level.key);
                    return (
                      <ButtonBase
                        onClick={() => (levelSelectable ? handleLevelSelect(shift, level.key) : undefined)}
                        disabled={!levelSelectable}
                        sx={{
                          width: '100%',
                          pt: 2,
                          borderRadius: 2,
                          transition: 'background-color 0.3s',
                        }}
                      >
                        <StepLabel
                          StepIconComponent={props => <ColorStepIcon {...props} icon={level.icon} />}
                          sx={{
                            flexDirection: 'column',
                            '& .MuiStepLabel-label': {
                              mt: 1.5,
                              fontWeight: 500,
                              color:
                                effectiveLevelKey === level.key
                                  ? customTheme.palette.primary.main
                                  : outerTheme.palette.text.secondary,
                              ...(!levelSelectable && { color: outerTheme.palette.text.disabled }),
                            },
                          }}
                        >
                          {level.label}
                        </StepLabel>
                      </ButtonBase>
                    );
                  })()}
                </Step>
              ))}
            </Stepper>

            {shift && escalateTarget && (
              <Paper
                variant="outlined"
                sx={{
                  my: 3,
                  p: 3,
                  borderRadius: 3,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(148,163,184,0.5)',
                  backgroundColor: '#F9FAFB',
                  textAlign: 'center',
                }}
              >
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Ready to expand your reach? Escalate this shift to <strong>{escalateTarget.label}</strong>.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleEscalate(shift, escalateTarget.key)}
                  disabled={escalating[shift.id]}
                  startIcon={
                    escalating[shift.id] ? <CircularProgress size={18} color="inherit" /> : undefined
                  }
                >
                  {escalating[shift.id] ? 'Escalating...' : `Escalate to ${escalateTarget.label}`}
                </Button>
              </Paper>
            )}

            <Divider sx={{ my: 4 }}>
              <Chip
                label={`Candidates for ${effectiveLevelMeta?.label ?? 'selected level'}`}
                sx={{ fontWeight: 600 }}
              />
            </Divider>
            {!currentTabData || currentTabData.loading ? (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : effectiveLevelKey === PUBLIC_LEVEL_KEY ? (
              <>
                {platformAggregatedMembers.length > 0 && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 2,
                      mb: 4,
                    }}
                  >
                    {renderStatusCard('Interested', platformInterested, <PersonAddIcon />, 'success', {
                      emptyLabel: 'No interested candidates from previous levels yet.',
                    })}
                    {renderStatusCard('Assigned', platformAssigned, <CheckCircleIcon />, 'info', {
                      emptyLabel: 'No assignments yet.',
                    })}
                    {renderStatusCard('Rejected', platformRejected, <PersonRemoveIcon />, 'error', {
                      emptyLabel: 'No rejections yet.',
                    })}
                    {renderStatusCard('No Response', platformNoResponse, <HourglassIcon />, 'warning', {
                      emptyLabel: 'Everyone has responded from previous levels.',
                    })}
                  </Box>
                )}

                <Divider sx={{ mb: 3 }}>
                  <Chip label="Public Interest" sx={{ fontWeight: 600 }} />
                </Divider>

                {(() => {
                  const interestsBySlot = currentTabData.interestsBySlot ?? {};
                  const interestsAll = currentTabData.interestsAll ?? [];

                  const slotSections = shift.slots
                    .map(slot => {
                      const slotInterests = interestsBySlot[slot.id] || [];
                      if (slotInterests.length === 0) return null;

                      return (
                        <Paper key={slot.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 2.5 }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {formatSlotLabel(slot)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {slotInterests.length} candidate{slotInterests.length > 1 ? 's' : ''}
                              </Typography>
                            </Box>
                            <Chip
                              label="Slot-specific"
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                            />
                          </Stack>

                          <Stack spacing={1.5} sx={{ mt: 2 }}>
                            {slotInterests.map(interest => (
                              <Paper
                                key={interest.id}
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  borderRadius: 2,
                                  borderColor: 'rgba(148,163,184,0.35)',
                                  backgroundColor: 'rgba(16,185,129,0.04)',
                                }}
                              >
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                                  justifyContent="space-between"
                                  spacing={1.5}
                                >
                                  <Box>
                                    <Typography fontWeight={600}>{interest.user}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {interest.slot_time}
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip
                                      label={interest.revealed ? 'Revealed' : 'Interested'}
                                      size="small"
                                      color={interest.revealed ? 'info' : 'success'}
                                      variant={interest.revealed ? 'outlined' : 'filled'}
                                    />
                                    <Button
                                      size="small"
                                      variant={interest.revealed ? 'outlined' : 'contained'}
                                      color="secondary"
                                      onClick={() => handleRevealPlatform(shift, interest)}
                                      disabled={revealingInterestId === interest.id || assigning}
                                      startIcon={
                                        revealingInterestId === interest.id ? (
                                          <CircularProgress size={16} color="inherit" />
                                        ) : undefined
                                      }
                                    >
                                      {interest.revealed ? 'Review Candidate' : 'Reveal Candidate'}
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        </Paper>
                      );
                    })
                    .filter(Boolean);

                  const generalInterestSection =
                    interestsAll.length > 0 ? (
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              Whole-shift Interest
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {interestsAll.length} candidate{interestsAll.length > 1 ? 's' : ''}
                            </Typography>
                          </Box>
                          <Chip
                            label="All slots"
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                          />
                        </Stack>

                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                          {interestsAll.map(interest => (
                            <Paper
                              key={interest.id}
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                borderColor: 'rgba(148,163,184,0.35)',
                                backgroundColor: 'rgba(14,165,233,0.05)',
                              }}
                            >
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                justifyContent="space-between"
                                spacing={1.5}
                              >
                                <Typography fontWeight={600}>{interest.user}</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip label="Interested" size="small" color="success" />
                                  <Button
                                    size="small"
                                    variant={interest.revealed ? 'outlined' : 'contained'}
                                    onClick={() => handleRevealPlatform(shift, interest)}
                                    disabled={revealingInterestId === interest.id || assigning}
                                    startIcon={
                                      revealingInterestId === interest.id ? (
                                        <CircularProgress size={16} color="inherit" />
                                      ) : undefined
                                    }
                                  >
                                    {interest.revealed ? 'Review Candidate' : 'Reveal Candidate'}
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </Paper>
                    ) : null;

                  if (!slotSections.length && !generalInterestSection) {
                    return (
                      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        No public interest yet.
                      </Typography>
                    );
                  }

                  return (
                    <Stack spacing={2.5}>
                      {slotSections}
                      {generalInterestSection}
                    </Stack>
                  );
                })()}
              </>
            ) : aggregatedMembers.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 2,
                }}
              >
                {renderStatusCard('Interested', interestedMembers, <PersonAddIcon />, 'success', {
                  showAssign: true,
                  emptyLabel: 'No members have shown interest yet.',
                })}
                {renderStatusCard('Assigned', assignedMembers, <CheckCircleIcon />, 'info', {
                  emptyLabel: 'No members have been assigned yet.',
                })}
                {renderStatusCard('Rejected', rejectedMembers, <PersonRemoveIcon />, 'error', {
                  emptyLabel: 'No members have been rejected.',
                })}
                {renderStatusCard('No Response', noResponseMembers, <HourglassIcon />, 'warning', {
                  emptyLabel: 'Everyone has responded.',
                })}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No members have responded at this escalation level yet.
              </Typography>
            )}
          </CardContent>
        </Card>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3500}
          onClose={closeSnackbar}
          message={snackbar.message}
          action={
            <IconButton size="small" color="inherit" onClick={closeSnackbar}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        />

        <Dialog
          open={platformInterestDialog.open}
          onClose={() => setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null })}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Candidate Details</DialogTitle>
          <DialogContent dividers>
            {platformInterestDialog.user ? (
              <Stack spacing={1.5}>
                <Typography variant="h6">
                  {platformInterestDialog.user.first_name} {platformInterestDialog.user.last_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {platformInterestDialog.user.email}
                </Typography>
                {platformInterestDialog.user.phone_number && (
                  <Typography variant="body2" color="text.secondary">
                    {platformInterestDialog.user.phone_number}
                  </Typography>
                )}
                {platformInterestDialog.user.short_bio && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {platformInterestDialog.user.short_bio}
                  </Typography>
                )}
                {platformInterestDialog.user.resume && (
                  <Button
                    href={platformInterestDialog.user.resume}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    sx={{ mt: 1 }}
                  >
                    Download CV
                  </Button>
                )}
                {platformInterestDialog.user.rate_preference && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Rate Preference
                    </Typography>
                    <List dense>
                      {Object.entries(platformInterestDialog.user.rate_preference).map(([key, value]) => (
                        <ListItem key={key} sx={{ py: 0, px: 0 }}>
                          <ListItemText
                            primary={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            secondary={value || 'N/A'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Stack>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null })}>
              Close
            </Button>
            {platformInterestDialog.user && (
              <Button
                variant="contained"
                color="success"
                onClick={handleAssignPlatform}
                disabled={assigning}
                startIcon={assigning ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                Assign to Shift
              </Button>
            )}
          </DialogActions>
        </Dialog>

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
            <Button onClick={cancelDelete} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              color="error"
              variant="contained"
              disabled={shiftToDelete !== null && deleting[shiftToDelete]}
              startIcon={
                shiftToDelete !== null && deleting[shiftToDelete] ? <CircularProgress size={16} color="inherit" /> : undefined
              }
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
};

export default PosterShiftDetailPage;
