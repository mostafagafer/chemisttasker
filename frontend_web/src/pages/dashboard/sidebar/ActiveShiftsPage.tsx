import React, { useCallback, useEffect, useState } from 'react';
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
  Chip,
  Tooltip,
  Divider,
  Skeleton,
  Rating,
  Pagination,
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
  CheckCircle as Check,
  ExpandMore as ChevronDown,
  Close as X,
  Edit,
  Delete as Trash2,
  Share as Share2,
  Business as Building,
  Info,
  CalendarToday as CalendarDays,
  PersonAdd as UserCheck,
  PersonRemove as UserX,
  HourglassEmpty as Clock,
  Star,
  Favorite,
  People,
  Store,
  CorporateFare,
  Public,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';

// Injecting Inter font from Google Fonts
const fontStyle = document.createElement('style');
fontStyle.innerHTML = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
`;
document.head.appendChild(fontStyle);

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
        root: { borderRadius: '8px', textTransform: 'none', fontWeight: 600, boxShadow: 'none' },
        containedPrimary: {
          color: 'white',
          background: 'linear-gradient(to right, #8B5CF6, #6D28D9)',
          '&:hover': { background: 'linear-gradient(to right, #A78BFA, #8B5CF6)' },
        },
        containedSecondary: { color: 'white' },
      },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: '16px', border: '1px solid #E5E7EB' } },
    },
  },
});

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
}

interface Shift {
  id: number;
  visibility: string;
  pharmacy_detail: {
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
    organization?: { id?: number; name?: string } | null;
    owner?: { organization_claimed?: boolean } | null;
  };
  role_needed: string;
  slots: Slot[];
  description?: string;
  allowed_escalation_levels: string[];
  escalation_level: number;
}

interface MemberStatus {
  user_id: number;
  name: string;
  employment_type: string;
  status: 'no_response' | 'interested' | 'rejected' | 'accepted';
  average_rating?: number | null;
  rating?: number | null;
}

interface Interest {
  id: number;
  user_id: number;
  slot_id: number | null;
  revealed: boolean;
  user: string;
  average_rating?: number | null;
  rating?: number | null;
}

interface UserDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  short_bio?: string;
  resume?: string;
  employment_type?: string;
}

interface TabDataState {
  loading: boolean;
  membersBySlot?: Record<number, MemberStatus[]>;
  interestsBySlot?: Record<number, Interest[]>;
  interestsAll?: Interest[];
  isPastLevel?: boolean;
}

type EscalationKey = 'FULL_PART_TIME' | 'LOCUM_CASUAL' | 'OWNER_CHAIN' | 'ORG_CHAIN' | 'PLATFORM';

const PUBLIC_LEVEL_KEY: EscalationKey = 'PLATFORM';
const FAVOURITE_LEVEL_KEY: EscalationKey = 'LOCUM_CASUAL';

const ESCALATION_LEVELS: Array<{
  key: EscalationKey;
  label: string;
  icon: React.ElementType;
  requiresOrganization?: boolean;
}> = [
  { key: 'FULL_PART_TIME', label: 'My Pharmacy', icon: People },
  { key: FAVOURITE_LEVEL_KEY, label: 'Favourites', icon: Favorite },
  { key: 'OWNER_CHAIN', label: 'Chain', icon: Store },
  { key: 'ORG_CHAIN', label: 'Organization', icon: CorporateFare, requiresOrganization: true },
  { key: PUBLIC_LEVEL_KEY, label: 'Platform', icon: Public },
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
    const normalizedRating = member.average_rating ?? member.rating ?? null;
    const normalized: MemberStatus = { ...member, average_rating: normalizedRating };
    const existing = map.get(member.user_id);
    if (!existing) {
      map.set(member.user_id, normalized);
      return;
    }
    if (STATUS_PRIORITY[normalized.status] > STATUS_PRIORITY[existing.status]) {
      map.set(member.user_id, normalized);
      return;
    }
    if (STATUS_PRIORITY[normalized.status] === STATUS_PRIORITY[existing.status]) {
      const existingRating = existing.average_rating ?? existing.rating ?? -1;
      if ((normalized.average_rating ?? normalized.rating ?? -1) > existingRating) {
        map.set(member.user_id, normalized);
      }
    }
  });
  return Array.from(map.values());
};

const ColorStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 24,
    left: 'calc(-50% + 30px)',
    right: 'calc(50% + 30px)',
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: '#E5E7EB',
    borderTopWidth: 2,
    borderRadius: 1,
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    borderColor: theme.palette.primary.main,
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    borderColor: theme.palette.primary.main,
  },
}));

const ColorStepIconRoot = styled('div')<{ ownerState: { completed?: boolean; active?: boolean } }>(
  ({ theme, ownerState }) => ({
    backgroundColor: '#E5E7EB',
    zIndex: 1,
    color: '#6B7280',
    width: 50,
    height: 50,
    display: 'flex',
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.3s ease-in-out',
    ...(ownerState.active && {
      backgroundColor: theme.palette.primary.main,
      color: '#fff',
      boxShadow: '0 6px 15px 0 rgba(109, 40, 217, 0.4)',
    }),
    ...(ownerState.completed && {
      backgroundColor: theme.palette.primary.dark,
      color: '#fff',
    }),
  })
);

function ColorStepIcon(props: { active?: boolean; completed?: boolean; icon: React.ElementType }) {
  const { icon: Icon } = props;
  return (
    <ColorStepIconRoot ownerState={props}>
      <Icon sx={{ fontSize: 24 }} />
    </ColorStepIconRoot>
  );
}

const ActiveShiftsPage: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [expandedShift, setExpandedShift] = useState<number | false>(false);
  const [tabData, setTabData] = useState<Record<string, TabDataState>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [escalating, setEscalating] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<number | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const [sharingShiftId, setSharingShiftId] = useState<number | null>(null);
  const [selectedLevelByShift, setSelectedLevelByShift] = useState<Record<number, EscalationKey>>({});
  const [reviewCandidateDialog, setReviewCandidateDialog] = useState<{
    open: boolean;
    candidate: MemberStatus | null;
    shiftId: number | null;
  }>({ open: false, candidate: null, shiftId: null });
  const [platformInterestDialog, setPlatformInterestDialog] = useState<{
    open: boolean;
    user: UserDetail | null;
    shiftId: number | null;
    interest: Interest | null;
  }>({ open: false, user: null, shiftId: null, interest: null });
  const [workerRatingSummary, setWorkerRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [workerRatingComments, setWorkerRatingComments] = useState<
    Array<{ id: number; stars: number; comment?: string; created_at?: string }>
  >([]);
  const [workerCommentsPage, setWorkerCommentsPage] = useState(1);
  const [workerCommentsPageCount, setWorkerCommentsPageCount] = useState(1);
  const [loadingWorkerRatings, setLoadingWorkerRatings] = useState(false);

  const showSnackbar = useCallback((message: string) => {
    setSnackbar({ open: true, message });
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbar({ open: false, message: '' });
  }, []);

  const resetWorkerRatings = () => {
    setWorkerRatingSummary(null);
    setWorkerRatingComments([]);
    setWorkerCommentsPage(1);
    setWorkerCommentsPageCount(1);
  };

  const getTabKey = useCallback((shiftId: number, levelKey: EscalationKey) => `${shiftId}_${levelKey}`, []);

  const deriveLevelSequence = useCallback((shift: Shift) => {
    const hasOrganizationAccess =
      Boolean(shift.pharmacy_detail?.organization?.id) ||
      Boolean(shift.pharmacy_detail?.owner?.organization_claimed) ||
      shift.visibility === 'ORG_CHAIN';

    return ESCALATION_LEVELS.filter(level =>
      level.requiresOrganization ? hasOrganizationAccess : true
    );
  }, []);

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true);
    try {
      const res = await apiClient.get(API_ENDPOINTS.getActiveShifts);
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setShifts(data);
    } catch (error) {
      console.error('Failed to load active shifts', error);
      showSnackbar('Failed to load active shifts.');
    } finally {
      setLoadingShifts(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const loadWorkerRatings = useCallback(async (workerId: number, page: number = 1) => {
    setLoadingWorkerRatings(true);
    try {
      const summaryRes = await apiClient.get(
        `${API_ENDPOINTS.ratingsSummary}?target_type=worker&target_id=${workerId}`
      );
      setWorkerRatingSummary({
        average: summaryRes.data?.average ?? 0,
        count: summaryRes.data?.count ?? 0,
      });

      const commentsRes = await apiClient.get(
        `${API_ENDPOINTS.ratings}?target_type=worker&target_id=${workerId}&page=${page}`
      );
      const items = Array.isArray(commentsRes.data)
        ? commentsRes.data
        : Array.isArray(commentsRes.data?.results)
        ? commentsRes.data.results
        : [];
      setWorkerRatingComments(
        items.map((item: any) => ({
          id: item.id,
          stars: item.stars,
          comment: item.comment,
          created_at: item.created_at,
        }))
      );
      if (commentsRes.data?.count && Array.isArray(commentsRes.data?.results)) {
        const perPage = commentsRes.data.results.length || 1;
        setWorkerCommentsPageCount(Math.max(1, Math.ceil(commentsRes.data.count / perPage)));
      } else {
        setWorkerCommentsPageCount(1);
      }
      setWorkerCommentsPage(page);
    } catch (error) {
      console.error('Failed to load worker ratings', error);
      setWorkerRatingSummary(null);
      setWorkerRatingComments([]);
    } finally {
      setLoadingWorkerRatings(false);
    }
  }, []);

  const loadTabData = useCallback(
    async (shift: Shift, levelKey: EscalationKey) => {
      const tabKey = getTabKey(shift.id, levelKey);
      setTabData(prev => ({
        ...prev,
        [tabKey]: { ...prev[tabKey], loading: true },
      }));

      const level = ESCALATION_LEVELS.find(item => item.key === levelKey);
      if (!level) {
        setTabData(prev => ({
          ...prev,
          [tabKey]: { loading: false },
        }));
        return;
      }

      try {
        if (level.key === PUBLIC_LEVEL_KEY) {
          const res = await apiClient.get(API_ENDPOINTS.getShiftInterests, {
            params: { shift: shift.id },
          });
          const interestsRaw = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.results)
            ? res.data.results
            : [];

          const interestsBySlot: Record<number, Interest[]> = {};
          const interestsAll: Interest[] = [];

          interestsRaw.forEach((interest: any) => {
            const slotId = interest.slot_id === null || interest.slot_id === undefined ? null : Number(interest.slot_id);
            const normalized: Interest = {
              id: interest.id,
              user_id: interest.user_id,
              slot_id: slotId,
              revealed: Boolean(interest.revealed),
              user:
                interest.user ||
                `${interest.user_first_name ?? ''} ${interest.user_last_name ?? ''}`.trim() ||
                'Candidate',
              average_rating: interest.average_rating ?? interest.rating ?? null,
              rating: interest.rating ?? interest.average_rating ?? null,
            };

            if (normalized.slot_id === null) {
              interestsAll.push(normalized);
            } else {
              if (!interestsBySlot[normalized.slot_id]) {
                interestsBySlot[normalized.slot_id] = [];
              }
              interestsBySlot[normalized.slot_id].push(normalized);
            }
          });

          setTabData(prev => ({
            ...prev,
            [tabKey]: { loading: false, interestsBySlot, interestsAll },
          }));
          return;
        }

        if (!shift.slots?.length) {
          setTabData(prev => ({
            ...prev,
            [tabKey]: { loading: false, membersBySlot: {} },
          }));
          return;
        }

        const membersBySlotEntries = await Promise.all(
          shift.slots.map(async slot => {
            try {
              const res = await apiClient.get(
                `${API_ENDPOINTS.getActiveShifts}${shift.id}/member_status/`,
                { params: { slot_id: slot.id, visibility: level.key } }
              );
              const membersRaw = Array.isArray(res.data)
                ? res.data
                : Array.isArray(res.data?.results)
                ? res.data.results
                : [];
              const members: MemberStatus[] = membersRaw.map((member: any) => ({
                user_id: member.user_id,
                name: member.name ?? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim(),
                employment_type: member.employment_type ?? member.user_employment_type ?? '',
                status: member.status,
                average_rating: member.average_rating ?? member.rating ?? null,
                rating: member.rating ?? member.average_rating ?? null,
              }));
              return [slot.id, members] as const;
            } catch (error) {
              console.error(`Failed to load members for shift ${shift.id} slot ${slot.id}`, error);
              return [slot.id, [] as MemberStatus[]] as const;
            }
          })
        );

        const membersBySlot = membersBySlotEntries.reduce<Record<number, MemberStatus[]>>((acc, [slotId, members]) => {
          acc[slotId] = members;
          return acc;
        }, {});

        setTabData(prev => ({
          ...prev,
          [tabKey]: { loading: false, membersBySlot },
        }));
      } catch (error) {
        console.error('Failed to load tab data', error);
        showSnackbar(`Failed to load data for ${level.label}`);
        setTabData(prev => ({
          ...prev,
          [tabKey]: { loading: false },
        }));
      }
    },
    [getTabKey, showSnackbar]
  );

  const handleAccordionChange = useCallback(
    (shift: Shift) => (_event: React.SyntheticEvent, expanded: boolean) => {
      const shiftId = shift.id;
      setExpandedShift(expanded ? shiftId : false);

      if (expanded) {
        const levels = deriveLevelSequence(shift);
        const currentIdx = Math.max(0, levels.findIndex(level => level.key === shift.visibility));
        const currentLevel = levels[currentIdx];

        // Set the initially selected level to the shift's current level
        setSelectedLevelByShift(prev => ({ ...prev, [shiftId]: currentLevel.key }));

        // Pre-load data for all levels up to the current one
        const levelsToEnsure = levels.slice(0, currentIdx + 1);
        levelsToEnsure.forEach(level => {
          const tabKey = getTabKey(shiftId, level.key);
          if (!tabData[tabKey]) {
            loadTabData(shift, level.key);
          }
        });
      }
    },
    [deriveLevelSequence, getTabKey, loadTabData, tabData]
  );

  const handleLevelSelect = (shiftId: number, levelKey: EscalationKey) => {
    setSelectedLevelByShift(prev => ({ ...prev, [shiftId]: levelKey }));
  };

  const handleShare = async (shift: Shift) => {
    if (shift.visibility !== PUBLIC_LEVEL_KEY) {
      showSnackbar('Escalate to Platform to get a shareable link.');
      return;
    }
    setSharingShiftId(shift.id);
    try {
      const res = await apiClient.post(API_ENDPOINTS.generateShareLink(shift.id));
      const token = res.data?.share_token ?? res.data?.token;
      if (!token) {
        throw new Error('Missing share token');
      }
      const publicUrl = `${window.location.origin}/shifts/link?token=${token}`;
      await navigator.clipboard.writeText(publicUrl);
      showSnackbar('Public share link copied to clipboard!');
    } catch (error) {
      console.error('Share Error:', error);
      showSnackbar('Error: Could not generate share link.');
    } finally {
      setSharingShiftId(null);
    }
  };

  const handleEscalate = async (shift: Shift, targetLevelKey: EscalationKey) => {
    const targetLevel = ESCALATION_LEVELS.find(level => level.key === targetLevelKey);
    const targetLevelIdx = ESCALATION_LEVELS.findIndex(level => level.key === targetLevelKey);

    if (!targetLevel || targetLevelIdx === -1) {
      showSnackbar('Unable to escalate shift.');
      return;
    }

    setEscalating(prev => ({ ...prev, [shift.id]: true }));
    try {
      await apiClient.post(`${API_ENDPOINTS.getActiveShifts}${shift.id}/escalate/`);
      const updatedShift = { ...shift, visibility: targetLevel.key, escalation_level: targetLevelIdx };
      setShifts(prev => prev.map(s => (s.id === shift.id ? updatedShift : s)));
      loadTabData(updatedShift, targetLevel.key);
      // After escalating, set the selected level to the new level
      setSelectedLevelByShift(prev => ({ ...prev, [shift.id]: targetLevel.key }));
      showSnackbar(`Shift escalated to ${targetLevel.label}`);
    } catch (error) {
      console.error('Failed to escalate shift', error);
      showSnackbar('Failed to escalate shift.');
    } finally {
      setEscalating(prev => ({ ...prev, [shift.id]: false }));
    }
  };

  const handleEdit = (shiftId: number) => {
    const baseRoute = user?.role?.startsWith('ORG_') ? '/dashboard/organization/post-shift' : '/dashboard/owner/post-shift';
    navigate(`${baseRoute}?edit=${shiftId}`);
  };

  const handleDelete = (shiftId: number) => {
    setShiftToDelete(shiftId);
    setOpenDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (shiftToDelete === null) return;
    setDeleting(prev => ({ ...prev, [shiftToDelete]: true }));
    try {
      await apiClient.delete(`${API_ENDPOINTS.getActiveShifts}${shiftToDelete}/`);
      setShifts(prev => prev.filter(shift => shift.id !== shiftToDelete));
      setTabData(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (key.startsWith(`${shiftToDelete}_`)) {
            delete updated[key];
          }
        });
        return updated;
      });
      setExpandedShift(prev => (prev === shiftToDelete ? false : prev));
      showSnackbar('Shift cancelled successfully.');
      setOpenDeleteConfirm(false);
      setShiftToDelete(null);
    } catch (error) {
      console.error('Failed to delete shift', error);
      showSnackbar('Failed to delete shift.');
    } finally {
      setDeleting(prev => ({ ...prev, [shiftToDelete]: false }));
    }
  };

  const handleAssign = async (shiftId: number, userId: number, slotId: number | null) => {
    try {
      await apiClient.post(API_ENDPOINTS.acceptUserToShift(shiftId), { user_id: userId, slot_id: slotId });
      showSnackbar('User assigned successfully.');
      setReviewCandidateDialog({ open: false, candidate: null, shiftId: null });
      setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null });
      setShifts(prev => prev.filter(shift => shift.id !== shiftId));
      setExpandedShift(prev => (prev === shiftId ? false : prev));
      setTabData(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (key.startsWith(`${shiftId}_`)) {
            delete updated[key];
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to assign user', error);
      showSnackbar('Failed to assign user.');
    }
  };

  const handleReviewCandidate = (candidate: MemberStatus, shiftId: number) => {
    resetWorkerRatings();
    setReviewCandidateDialog({ open: true, candidate, shiftId });
    loadWorkerRatings(candidate.user_id, 1);
  };

  const handleRevealPlatform = async (shift: Shift, interest: Interest) => {
    try {
      resetWorkerRatings();
      const res = await apiClient.post(API_ENDPOINTS.revealProfile(shift.id), {
        user_id: interest.user_id,
        slot_id: interest.slot_id,
      });
      const userDetail: UserDetail = res.data;
      setPlatformInterestDialog({ open: true, user: userDetail, shiftId: shift.id, interest });
      loadWorkerRatings(userDetail.id, 1);

      const tabKey = getTabKey(shift.id, PUBLIC_LEVEL_KEY);
      setTabData(prev => {
        const current = prev[tabKey];
        if (!current) return prev;
        const updatedInterestsBySlot = { ...(current.interestsBySlot || {}) };
        if (interest.slot_id !== null && updatedInterestsBySlot[interest.slot_id]) {
          updatedInterestsBySlot[interest.slot_id] = updatedInterestsBySlot[interest.slot_id].map(item =>
            item.id === interest.id ? { ...item, revealed: true } : item
          );
        }
        const updatedInterestsAll = (current.interestsAll || []).map(item =>
          item.id === interest.id ? { ...item, revealed: true } : item
        );
        return {
          ...prev,
          [tabKey]: { ...current, interestsBySlot: updatedInterestsBySlot, interestsAll: updatedInterestsAll },
        };
      });
    } catch (error) {
      console.error('Failed to reveal platform candidate', error);
      showSnackbar('Failed to reveal candidate.');
    }
  };

  const handleAssignPlatform = async () => {
    const { shiftId, user, interest } = platformInterestDialog;
    if (!shiftId || !user) return;
    await handleAssign(shiftId, user.id, interest?.slot_id ?? null);
  };

  const handleWorkerCommentsPageChange = async (_: React.ChangeEvent<unknown>, value: number) => {
    const userId = reviewCandidateDialog.candidate?.user_id ?? platformInterestDialog.user?.id;
    if (!userId) return;
    await loadWorkerRatings(userId, value);
    const dialogRef = document.querySelector('[role="dialog"]');
    dialogRef?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const renderStatusCard = (
    title: string,
    members: MemberStatus[],
    icon: React.ReactElement,
    color: 'success' | 'error' | 'warning' | 'info',
    shiftId: number
  ) => (
    <Card sx={{ background: customTheme.palette.background.default, boxShadow: 'none', border: `1px solid ${customTheme.palette.divider}` }}>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: customTheme.palette[color].light, color: customTheme.palette[color].dark }}>
            {icon}
          </Avatar>
        }
        title={
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: customTheme.palette[color].dark }}>
            {title}
          </Typography>
        }
        action={
          <Chip
            label={members.length}
            size="small"
            sx={{
              backgroundColor: customTheme.palette[color].dark,
              color: 'white',
              fontWeight: 'bold',
            }}
          />
        }
      />
      <CardContent>
        {members.length > 0 ? (
          <Stack spacing={2}>
            {members.map((member) => {
              const ratingValue = member.average_rating ?? member.rating ?? null;
              return (
                <Paper key={member.user_id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack>
                      <Typography variant="body1" fontWeight="bold">
                        {member.name}
                      </Typography>
                      {member.employment_type && (
                        <Typography variant="caption" color="text.secondary">
                          {member.employment_type}
                        </Typography>
                      )}
                    </Stack>
                    {ratingValue ? (
                      <Chip
                        icon={<Star sx={{ fontSize: 16 }} />}
                        label={ratingValue.toFixed(1)}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    ) : null}
                  </Stack>
                  {title === 'Interested' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      fullWidth
                      sx={{ mt: 1.5 }}
                      onClick={() => handleReviewCandidate(member, shiftId)}
                    >
                      Review Candidate
                    </Button>
                  )}
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No candidates yet.
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ThemeProvider theme={customTheme}>
      <Container
        maxWidth={false}
        sx={{ py: 4, backgroundColor: customTheme.palette.background.default, minHeight: '100vh' }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#111827' }}>
          Active Shifts
        </Typography>
        {loadingShifts ? (
          <Box sx={{ py: 2, display: 'grid', gap: 3 }}>
            {[...Array(2)].map((_, idx) => (
              <Skeleton key={idx} variant="rounded" width="100%" height={200} />
            ))}
          </Box>
        ) : shifts.length === 0 ? (
          <Paper elevation={0} sx={{ textAlign: 'center', p: 4, bgcolor: 'white', borderRadius: 4 }}>
            <Typography variant="h6">No active shifts found.</Typography>
            <Typography color="text.secondary">New shifts you post will appear here.</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gap: 3 }}>
          {shifts.map(shift => {
            const levelSequence = deriveLevelSequence(shift);
            const currentLevelIdx = Math.max(
              0,
              levelSequence.findIndex(level => level.key === shift.visibility)
            );
            const selectedLevelKey = selectedLevelByShift[shift.id] ?? levelSequence[currentLevelIdx]?.key;
            const isExpanded = expandedShift === shift.id;
            const cardBorderColor =
              shift.visibility === PUBLIC_LEVEL_KEY
                ? customTheme.palette.secondary.light
                : customTheme.palette.primary.light;
              const location = [
                shift.pharmacy_detail.street_address,
                shift.pharmacy_detail.suburb,
                shift.pharmacy_detail.state,
                shift.pharmacy_detail.postcode,
              ]
                .filter(Boolean)
                .join(', ');
              const shiftSlots = shift.slots
                ?.map(slot => `${slot.date} (${slot.start_time}–${slot.end_time})`)
                .join(' | ');

              return (
                <Card
                  key={shift.id}
                  sx={{
                    boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
                    borderLeft: `4px solid ${cardBorderColor}`,
                  }}
                >
                  <CardHeader
                    disableTypography
                    title={
                      <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                        {shift.pharmacy_detail.name}
                      </Typography>
                    }
                    subheader={
                      <Chip
                        label={shift.role_needed}
                        size="small"
                        sx={{ backgroundColor: cardBorderColor, color: 'white', fontWeight: 500, mt: 0.5 }}
                      />
                    }
                    action={
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Tooltip title="Share">
                          <span>
                            <IconButton
                              size="small"
                              onClick={e => {
                                e.stopPropagation();
                                handleShare(shift);
                              }}
                              disabled={sharingShiftId === shift.id}
                            >
                              <Share2 fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              handleEdit(shift.id);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              handleDelete(shift.id);
                            }}
                            disabled={deleting[shift.id]}
                          >
                            <Trash2 fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={e => {
                            e.stopPropagation();
                            handleAccordionChange(shift)(e, !isExpanded);
                          }}
                        >
                          <ChevronDown
                            style={{
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s',
                            }}
                          />
                        </IconButton>
                      </Box>
                    }
                    sx={{ pb: isExpanded ? 1 : 2 }}
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        color="text.secondary"
                      >
                        <Building sx={{ fontSize: 16 }} />
                        {location || 'Address not available'}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        color="text.secondary"
                      >
                        <CalendarDays sx={{ fontSize: 16 }} />
                        {shiftSlots || 'No slots defined'}
                      </Typography>
                    </Box>

                    {isExpanded && (
                      <>
                        {shift.description ? (
                          <Typography
                            variant="body2"
                            color="text.primary"
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              my: 2,
                              whiteSpace: 'pre-wrap',
                              bgcolor: '#F9FAFB',
                              p: 1.5,
                              borderRadius: 2,
                              border: '1px solid #E5E7EB',
                            }}
                          >
                            <Info sx={{ fontSize: 16, color: theme.palette.text.secondary, mt: '4px', flexShrink: 0 }} />
                            {shift.description}
                          </Typography>
                        ) : null}
                        <Box sx={{ width: '100%', my: 4 }}>
                          <Stepper alternativeLabel activeStep={currentLevelIdx} connector={<ColorStepConnector />}>
                            {levelSequence.map((level, index) => (
                              <Step key={level.key} completed={index < currentLevelIdx}>
                                <ButtonBase
                                  onClick={() => handleLevelSelect(shift.id, level.key)}
                                  disabled={index > currentLevelIdx}
                                  sx={{ width: '100%', pt: 2, borderRadius: 2, transition: 'background-color 0.3s' }}
                                >
                                  <StepLabel
                                    StepIconComponent={props => <ColorStepIcon {...props} icon={level.icon} />}
                                    sx={{
                                      flexDirection: 'column',
                                      '& .MuiStepLabel-label': {
                                        mt: 1.5,
                                        fontWeight: 500,
                                        color:
                                          selectedLevelKey === level.key
                                            ? theme.palette.primary.main
                                            : theme.palette.text.secondary,
                                        ...(index > currentLevelIdx && { color: theme.palette.text.disabled }),
                                      },
                                    }}
                                  >
                                    {level.label}
                                  </StepLabel>
                                </ButtonBase>
                              </Step>
                            ))}
                          </Stepper>
                        </Box>

                        {(() => {
                          const nextLevel = levelSequence[currentLevelIdx + 1];
                          if (
                            nextLevel &&
                            shift.allowed_escalation_levels.includes(nextLevel.key) &&
                            !escalating[shift.id]
                          ) {
                            return (
                              <Box
                                sx={{
                                  py: 2,
                                  textAlign: 'center',
                                  bgcolor: '#F9FAFB',
                                  borderRadius: 2,
                                  border: '1px dashed #E5E7EB',
                                }}
                              >
                                <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                  Ready to widen your search?
                                </Typography>
                                <Button variant="contained" onClick={() => handleEscalate(shift, nextLevel.key)}>
                                  Escalate to {nextLevel.label}
                                </Button>
                              </Box>
                            );
                          }
                          if (escalating[shift.id]) {
                            return (
                              <Box
                                sx={{
                                  py: 2,
                                  textAlign: 'center',
                                  bgcolor: '#F9FAFB',
                                  borderRadius: 2,
                                  border: '1px dashed #E5E7EB',
                                }}
                              >
                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                Escalating...
                              </Box>
                            );
                          }
                          return null;
                        })()}

                        <Divider sx={{ my: 3 }}>
                          <Chip label={`Candidates for ${levelSequence.find(l => l.key === selectedLevelKey)?.label}`} />
                        </Divider>

                        {(() => {
                          const tabKey = getTabKey(shift.id, selectedLevelKey);
                          const currentTabData = tabData[tabKey];

                          if (!currentTabData || currentTabData.loading) {
                            return (
                              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                              </Box>
                            );
                          }

                          // Special handling for Platform level to show aggregated previous levels + new interests
                          if (selectedLevelKey === PUBLIC_LEVEL_KEY) {
                            const previousLevels = levelSequence.slice(0, currentLevelIdx);
                            const previousLevelEntries = previousLevels.map(level => tabData[getTabKey(shift.id, level.key)]);
                            const aggregatedMembers = dedupeMembers(
                              previousLevelEntries.flatMap(entry =>
                                entry?.membersBySlot ? Object.values(entry.membersBySlot).flat() : []
                              )
                            );

                            const interested = aggregatedMembers.filter(m => m.status === 'interested');
                            const assigned = aggregatedMembers.filter(m => m.status === 'accepted');
                            const rejected = aggregatedMembers.filter(m => m.status === 'rejected');
                            const noResponse = aggregatedMembers.filter(m => m.status === 'no_response');

                            const interestsBySlot = currentTabData.interestsBySlot || {};
                            const interestsAll = currentTabData.interestsAll || [];

                            return (
                              <>
                                {aggregatedMembers.length > 0 && (
                                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, mt: 2 }}>
                                    {renderStatusCard('Interested', interested, <UserCheck />, 'success', shift.id)}
                                    {renderStatusCard('Assigned', assigned, <Check />, 'info', shift.id)}
                                    {renderStatusCard('Rejected', rejected, <UserX />, 'error', shift.id)}
                                    {renderStatusCard('No Response', noResponse, <Clock />, 'warning', shift.id)}
                                  </Box>
                                )}
                                <Divider sx={{ my: 3 }}><Chip label="Public Interest" /></Divider>
                                {Object.keys(interestsBySlot).length === 0 && interestsAll.length === 0 ? (
                                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                                    No public interest yet.
                                  </Typography>
                                ) : (
                                  <Box mt={2}>
                                    {shift.slots?.map(slot => {
                                      const slotInterests = interestsBySlot[slot.id] || [];
                                      if (slotInterests.length === 0) return null;
                                      return (
                                        <Paper key={slot.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                                          <Typography variant="body1" fontWeight="bold">
                                            Slot: {slot.date} ({slot.start_time} - {slot.end_time})
                                          </Typography>
                                          {slotInterests.map(interest => (
                                            <Box key={interest.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 1, borderTop: '1px solid #eee' }}>
                                              <Typography variant="body2">{interest.user}</Typography>
                                              <Button size="small" variant={interest.revealed ? 'outlined' : 'contained'} onClick={() => handleRevealPlatform(shift, interest)}>
                                                {interest.revealed ? 'Review' : 'Reveal'}
                                              </Button>
                                            </Box>
                                          ))}
                                        </Paper>
                                      );
                                    })}
                                    {interestsAll.length > 0 && (
                                      <Paper variant="outlined" sx={{ p: 2 }}>
                                        <Typography variant="body1" fontWeight="bold">Interest in All Slots</Typography>
                                        {interestsAll.map(interest => (
                                          <Box key={interest.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 1, borderTop: '1px solid #eee' }}>
                                            <Typography variant="body2">{interest.user}</Typography>
                                            <Button size="small" variant={interest.revealed ? 'outlined' : 'contained'} onClick={() => handleRevealPlatform(shift, interest)}>
                                              {interest.revealed ? 'Review' : 'Reveal'}
                                            </Button>
                                          </Box>
                                        ))}
                                      </Paper>
                                    )}
                                  </Box>
                                )}
                              </>
                            );
                          }

                          const members = dedupeMembers(Object.values(currentTabData.membersBySlot || {}).flat());
                          const interested = members.filter(m => m.status === 'interested');
                          const assigned = members.filter(m => m.status === 'accepted');
                          const rejected = members.filter(m => m.status === 'rejected');
                          const noResponse = members.filter(m => m.status === 'no_response');

                          if (members.length === 0) {
                            return (
                                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                                  No candidates found for this level.
                                </Typography>
                            )
                          }

                          return (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, mt: 2 }}>
                              {renderStatusCard('Interested', interested, <UserCheck />, 'success', shift.id)}
                              {renderStatusCard('Assigned', assigned, <Check />, 'info', shift.id)}
                              {renderStatusCard('Rejected', rejected, <UserX />, 'error', shift.id)}
                              {renderStatusCard('No Response', noResponse, <Clock />, 'warning', shift.id)}
                            </Box>
                          );
                        })()}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3500}
          onClose={closeSnackbar}
          message={snackbar.message}
          action={
            <IconButton size="small" color="inherit" onClick={closeSnackbar}>
              <X fontSize="small" />
            </IconButton>
          }
        />

        <Dialog
          open={reviewCandidateDialog.open}
          onClose={() => {
            setReviewCandidateDialog({ open: false, candidate: null, shiftId: null });
            resetWorkerRatings();
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 'bold' }}>Review Candidate</DialogTitle>
          <DialogContent>
            {reviewCandidateDialog.candidate && !loadingWorkerRatings ? (
              <Box>
                <Typography variant="h6">{reviewCandidateDialog.candidate.name}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {reviewCandidateDialog.candidate.employment_type}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Ratings & Reviews
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {workerRatingSummary ? (
                    <>
                      <Rating value={workerRatingSummary.average} precision={0.5} readOnly />
                      <Typography variant="body1" color="text.secondary">
                        {workerRatingSummary.average.toFixed(1)} ({workerRatingSummary.count} reviews)
                      </Typography>
                    </>
                  ) : (
                    <Skeleton variant="rectangular" width={200} height={28} />
                  )}
                </Box>
                <Box sx={{ display: 'grid', gap: 1.5, mt: 2 }}>
                  {workerRatingComments.map(comment => (
                    <Paper key={comment.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Rating value={comment.stars} readOnly size="small" />
                        {comment.created_at && (
                          <Typography variant="caption" color="text.secondary">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                      {comment.comment && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {comment.comment}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                  {workerRatingComments.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No reviews yet.
                    </Typography>
                  )}
                  {workerCommentsPageCount > 1 && (
                    <Box display="flex" justifyContent="center" mt={1}>
                      <Pagination
                        count={workerCommentsPageCount}
                        page={workerCommentsPage}
                        onChange={handleWorkerCommentsPageChange}
                        color="primary"
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: '16px 24px' }}>
            <Button
              onClick={() => {
                setReviewCandidateDialog({ open: false, candidate: null, shiftId: null });
                resetWorkerRatings();
              }}
            >
              Close
            </Button>
            {reviewCandidateDialog.candidate && reviewCandidateDialog.shiftId && (
              <Button
                variant="contained"
                color="success"
                onClick={() => handleAssign(reviewCandidateDialog.shiftId!, reviewCandidateDialog.candidate!.user_id, null)}
              >
                Assign to Shift
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <Dialog
          open={platformInterestDialog.open}
          onClose={() => {
            setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null });
            resetWorkerRatings();
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 'bold' }}>Review Candidate</DialogTitle>
          <DialogContent>
            {platformInterestDialog.user && !loadingWorkerRatings ? (
              <Box>
                <Typography variant="h6">
                  {platformInterestDialog.user.first_name} {platformInterestDialog.user.last_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
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
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Ratings & Reviews
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {workerRatingSummary ? (
                    <>
                      <Rating value={workerRatingSummary.average} precision={0.5} readOnly />
                      <Typography variant="body1" color="text.secondary">
                        {workerRatingSummary.average.toFixed(1)} ({workerRatingSummary.count} reviews)
                      </Typography>
                    </>
                  ) : (
                    <Skeleton variant="rectangular" width={200} height={28} />
                  )}
                </Box>
                <Box sx={{ display: 'grid', gap: 1.5, mt: 2 }}>
                  {workerRatingComments.map(comment => (
                    <Paper key={comment.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Rating value={comment.stars} readOnly size="small" />
                        {comment.created_at && (
                          <Typography variant="caption" color="text.secondary">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                      {comment.comment && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {comment.comment}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                  {workerRatingComments.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No reviews yet.
                    </Typography>
                  )}
                  {workerCommentsPageCount > 1 && (
                    <Box display="flex" justifyContent="center" mt={1}>
                      <Pagination
                        count={workerCommentsPageCount}
                        page={workerCommentsPage}
                        onChange={handleWorkerCommentsPageChange}
                        color="primary"
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: '16px 24px' }}>
            <Button
              onClick={() => {
                setPlatformInterestDialog({ open: false, user: null, shiftId: null, interest: null });
                resetWorkerRatings();
              }}
            >
              Close
            </Button>
            {platformInterestDialog.user && (
              <Button variant="contained" color="success" onClick={handleAssignPlatform}>
                Assign to Shift
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to cancel/delete this shift? This action cannot be undone.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteConfirm(false)}>Cancel</Button>
            <Button
              onClick={confirmDelete}
              color="error"
              variant="contained"
              disabled={shiftToDelete !== null && deleting[shiftToDelete]}
            >
              {shiftToDelete !== null && deleting[shiftToDelete] ? <CircularProgress size={24} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
};

export default ActiveShiftsPage;

