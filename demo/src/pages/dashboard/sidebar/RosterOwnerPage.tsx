import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Tabs,
  Tab,
  Stack,
  Skeleton,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  OutlinedInput,
  FormControlLabel,
  Paper,
  Chip,
  Snackbar,
  IconButton,
  Avatar,
  Divider,
  Card,
  useTheme,
  Grid,
  Tooltip,
} from '@mui/material';

import {
  Add as AddIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  AttachMoney as MoneyIcon,
  Schedule as ClockIcon,
} from '@mui/icons-material';

// Calendar Imports
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { getDateRangeForView, CalendarViewKey } from './calendarViews';

import { useAuth } from '../../../contexts/AuthContext';

import {
  PharmacySummary,
  RosterAssignment,
  WorkerShiftRequest,
  OpenShift,
  RosterPharmacyMember,
  fetchPharmaciesService,
  fetchRosterOwnerAssignments,
  fetchWorkerShiftRequestsService,
  fetchOwnerOpenShifts,
  fetchRosterOwnerMembersService,
  createShiftAndAssignService,
  deleteRosterAssignmentService,
  createOpenShiftService,
} from '@chemisttasker/shared-core';

const localizer = momentLocalizer(moment);

type AssignmentViewModel = RosterAssignment;

// --- Constants ---
const ROLES = ['PHARMACIST', 'ASSISTANT', 'INTERN', 'TECHNICIAN'];
const ALL_STAFF = 'ALL';

// --- Modern Palette ---
const MODERN_ROSTER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PHARMACIST: { bg: '#ecfdf5', text: '#047857', border: '#10b981' },
  ASSISTANT: { bg: '#f5f3ff', text: '#7c3aed', border: '#8b5cf6' },
  INTERN: { bg: '#fff7ed', text: '#c2410c', border: '#f97316' },
  TECHNICIAN: { bg: '#f0f9ff', text: '#0369a1', border: '#0ea5e9' },
  DEFAULT: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
  OPEN: { bg: '#ffffff', text: '#6b7280', border: '#d1d5db' },
  LEAVE: { bg: '#fef2f2', text: '#b91c1c', border: '#ef4444' },
  COVER: { bg: '#fffbeb', text: '#b45309', border: '#f59e0b' },
};

// --- Styles ---
const styles = {
  pageContainer: {
    bgcolor: '#f3f4f6',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    pt: 2,
    pb: 4,
    px: 3,
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
  },
  statsBar: {
    display: 'flex',
    gap: 3,
    bgcolor: 'white',
    p: 1.5,
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #e5e7eb',
    alignItems: 'center',
  },
  statItem: {
    display: 'flex', alignItems: 'center', gap: 1,
    pr: 3,
    borderRight: '1px solid #f3f4f6',
    '&:last-child': { borderRight: 'none', pr: 0 },
  },
  calendarCard: {
    height: '100%',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb',
    bgcolor: 'white',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 600
  },
  shiftPoolCard: {
    flex: 1,
    bgcolor: 'white',
    borderRadius: '16px',
    p: 2,
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 300
  },
  toolbar: {
    p: 2,
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    bgcolor: '#ffffff',
  },
  viewToggleGroup: {
    bgcolor: '#f3f4f6',
    p: 0.5,
    borderRadius: '8px',
    display: 'flex',
    gap: 0.5,
  },
  viewButtonOf(active: boolean) {
    return {
      textTransform: 'capitalize',
      fontSize: '0.85rem',
      fontWeight: 600,
      color: active ? 'black' : '#6b7280',
      bgcolor: active ? 'white' : 'transparent',
      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
      borderRadius: '6px',
      minWidth: '60px',
      '&:hover': { bgcolor: active ? 'white' : '#e5e7eb' },
    };
  },
};

// --- Helper Components ---
const StatDisplay = ({ icon, label, value, color }: any) => (
  <Box sx={styles.statItem}>
    <Avatar sx={{ bgcolor: `${color}15`, color: color, width: 32, height: 32 }}>
      {icon}
    </Avatar>
    <Box>
      <Typography variant="caption" display="block" color="text.secondary" fontWeight={600} sx={{ lineHeight: 1 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={700}>{value}</Typography>
    </Box>
  </Box>
);

const CustomEvent = ({ event }: any) => {
  const { resource } = event;
  const isLeave = !!resource.leaveRequest;
  const isCover = resource.isCoverRequest;
  const isOpen = resource.isOpenShift;

  let role = resource.shiftDetail?.roleNeeded || 'DEFAULT';
  if (isOpen) role = 'OPEN';
  if (isLeave) role = 'LEAVE';
  if (isCover) role = 'COVER';

  const theme = MODERN_ROSTER_COLORS[role] || MODERN_ROSTER_COLORS.DEFAULT;

  return (
    <Box sx={{
      height: '100%',
      bgcolor: theme.bg,
      color: theme.text,
      borderRadius: '6px',
      p: 0.5,
      overflow: 'hidden',
      position: 'relative',
      fontSize: '0.75rem',
      lineHeight: 1.2,
      border: isOpen ? `1px dashed ${theme.border}` : `1px solid ${theme.bg}`,
      boxShadow: isOpen ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
      transition: 'all 0.2s',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
        borderColor: theme.border,
      }
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" fontWeight={800} sx={{ opacity: 0.9 }}>
          {moment(event.start).format('h:mm')} - {moment(event.end).format('h:mm A')}
        </Typography>
        {isLeave && <Tooltip title="Leave"><WarningIcon sx={{ fontSize: 12, color: theme.border }} /></Tooltip>}
        {isCover && <Tooltip title="Cover Req"><PersonIcon sx={{ fontSize: 12, color: theme.border }} /></Tooltip>}
      </Box>

      <Typography variant="body2" fontWeight={700} noWrap>
        {event.title}
      </Typography>

      {!isOpen && !isLeave && (
        <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
          {resource.shiftDetail?.roleNeeded ? resource.shiftDetail.roleNeeded.charAt(0) + resource.shiftDetail.roleNeeded.slice(1).toLowerCase() : ''}
        </Typography>
      )}
    </Box>
  );
};

// RE-ADDED SKELETON COMPONENT
const RosterPageSkeleton = () => (
  <Box sx={styles.pageContainer}>
    <Box sx={styles.headerRow}>
      <Skeleton width={200} height={40} />
      <Skeleton width={300} height={40} />
    </Box>
    <Grid container spacing={3}>
      <Grid item xs={12} md={2.5}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '16px', mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: '16px' }} />
      </Grid>
      <Grid item xs={12} md={9.5}>
        <Skeleton variant="rectangular" height={600} sx={{ borderRadius: '16px' }} />
      </Grid>
    </Grid>
  </Box>
);

export default function RosterOwnerPage() {
  const muiTheme = useTheme();
  const { activePersona, activeAdminPharmacyId } = useAuth();

  const scopedPharmacyId = activePersona === 'admin' && typeof activeAdminPharmacyId === 'number' ? activeAdminPharmacyId : null;
  const initialPharmacyFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get('pharmacy') ?? params.get('admin_pharmacy_id');
    const num = candidate ? Number(candidate) : null;
    return Number.isFinite(num) ? num : null;
  }, []);

  // --- State ---
  const [pharmacies, setPharmacies] = useState<PharmacySummary[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentViewModel[]>([]);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [workerRequests, setWorkerRequests] = useState<WorkerShiftRequest[]>([]);
  const [pharmacyMembers, setPharmacyMembers] = useState<RosterPharmacyMember[]>([]);

  // Loading
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Calendar
  const [calendarView, setCalendarView] = useState<CalendarViewKey>('week');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // Dialogs
  const [isAddAssignmentDialogOpen, setIsAddAssignmentDialogOpen] = useState(false);
  const [dialogShiftStartTime, setDialogShiftStartTime] = useState<string | null>(null);
  const [dialogShiftEndTime, setDialogShiftEndTime] = useState<string | null>(null);
  const [dialogShiftDate, setDialogShiftDate] = useState<string | null>(null);
  const [newShiftRoleNeeded, setNewShiftRoleNeeded] = useState<string>('');

  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentViewModel | null>(null);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);

  // Form State
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<number | null>(null);
  const [postAsOpenShiftState, setPostAsOpenShiftState] = useState(false);
  const [roleFilters, setRoleFilters] = useState<string[]>([ALL_STAFF]);

  // Other
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState<RosterPharmacyMember[]>([]);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const showSnackbar = (msg: string) => { setSnackbarMsg(msg); setSnackbarOpen(true); };

  // --- Initial Data Load ---
  useEffect(() => {
    const loadData = async () => {
      setIsPageLoading(true);
      try {
        const loaded = await fetchPharmaciesService({});
        const normalized = loaded.map((p: any) => ({ ...p, id: Number(p.id) }));
        const available = scopedPharmacyId
          ? normalized.filter((p: any) => p.id === scopedPharmacyId)
          : normalized;
        setPharmacies(available);

        const defaultId = scopedPharmacyId ?? initialPharmacyFromUrl ?? (available[0]?.id ? Number(available[0].id) : null);
        if (defaultId) setSelectedPharmacyId(defaultId);
      } catch (e) {
        console.error(e);
      } finally {
        setIsPageLoading(false);
      }
    };
    loadData();
  }, [scopedPharmacyId, initialPharmacyFromUrl]);

  const loadAssignments = useCallback(async (pharmacyId: number, startDate?: string, endDate?: string) => {
    try {
      const [assigns, reqs, opens] = await Promise.all([
        fetchRosterOwnerAssignments({ pharmacyId, startDate, endDate }),
        fetchWorkerShiftRequestsService({ pharmacyId, startDate, endDate }),
        fetchOwnerOpenShifts({ pharmacyId, startDate, endDate }),
      ]);
      const pharmacyName = pharmacies.find(p => p.id === pharmacyId)?.name;
      const validAssigns = pharmacyName
        ? assigns.filter((a: any) => a.shiftDetail?.pharmacyName === pharmacyName)
        : assigns;

      setAssignments(validAssigns);
      setWorkerRequests(reqs.filter((r: any) => Number(r.pharmacy) === pharmacyId));
      setOpenShifts(opens.filter((o: any) => Number(o.pharmacy) === pharmacyId));
    } catch (e) { console.error(e); }
  }, [pharmacies]);

  useEffect(() => {
    if (selectedPharmacyId) {
      const { start, end } = getDateRangeForView(calendarDate, calendarView);
      loadAssignments(selectedPharmacyId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));

      fetchRosterOwnerMembersService(selectedPharmacyId).then(setPharmacyMembers).catch(console.error);
    }
  }, [selectedPharmacyId, calendarDate, calendarView, loadAssignments]);

  const stats = useMemo(() => {
    let totalHours = 0;
    let totalShifts = assignments.length;
    let openCount = openShifts.length;
    let leaveCount = assignments.filter(a => !!a.leaveRequest).length;

    assignments.forEach(a => {
      if (!a.slotDetail) return;
      const start = moment(`${a.slotDate} ${a.slotDetail.startTime}`);
      const end = moment(`${a.slotDate} ${a.slotDetail.endTime}`);
      const duration = moment.duration(end.diff(start)).asHours();
      totalHours += duration;
    });

    return { totalHours: totalHours.toFixed(1), totalShifts, openCount, leaveCount };
  }, [assignments, openShifts]);

  const calendarEvents = useMemo(() => {
    const filteredAssigns = assignments.filter(a => roleFilters.includes(ALL_STAFF) || roleFilters.includes(a.shiftDetail?.roleNeeded || ''));

    // Map assignments
    const ev1 = filteredAssigns.map(a => {
      const name = a.userDetail.firstName || 'Unknown';
      let customTitle = name;
      if (a.leaveRequest) customTitle = `${name} (Leave)`;

      return {
        id: a.id,
        title: customTitle,
        start: moment(`${a.slotDate} ${a.slotDetail?.startTime}`).toDate(),
        end: moment(`${a.slotDate} ${a.slotDetail?.endTime}`).toDate(),
        resource: a,
      };
    });

    // Map Open Shifts
    const ev2 = openShifts.flatMap(s => s.slots.map(sl => ({
      id: `open-${s.id}-${sl.id}`,
      title: 'Open Shift',
      start: moment(`${sl.date} ${sl.startTime}`).toDate(),
      end: moment(`${sl.date} ${sl.endTime}`).toDate(),
      resource: { isOpenShift: true, originalShift: s, shiftDetail: { roleNeeded: s.roleNeeded } }
    })));

    // Map Requests
    const ev3 = workerRequests.filter(r => r.status === 'PENDING').map(r => ({
      id: `req-${r.id}`,
      title: 'Cover Request',
      start: moment(`${r.slotDate} ${r.startTime}`).toDate(),
      end: moment(`${r.slotDate} ${r.endTime}`).toDate(),
      resource: { isCoverRequest: true, originalRequest: r, shiftDetail: { roleNeeded: r.role } }
    }));

    return [...ev1, ...ev2, ...ev3];
  }, [assignments, openShifts, workerRequests, roleFilters]);

  // --- Event Handlers (Actions) ---
  const handleSlotSelect = ({ start, end }: any) => {
    setDialogShiftDate(moment(start).format('YYYY-MM-DD'));
    setDialogShiftStartTime(moment(start).format('HH:mm'));
    setDialogShiftEndTime(moment(end).format('HH:mm'));
    setNewShiftRoleNeeded('');
    setPostAsOpenShiftState(false);
    setSelectedUserForAssignment(null);
    setIsAddAssignmentDialogOpen(true);
  };

  const handleEventSelect = (event: any) => {
    const res = event.resource;
    if (res.isOpenShift) {
      setSelectedAssignment({ ...res, id: res.originalShift.id, userDetail: { firstName: 'Open', lastName: 'Shift' } } as any);
      setIsOptionsDialogOpen(true);
    } else if (res.isCoverRequest) {
      // Handle cover logic - kept simple
    } else {
      setSelectedAssignment(res);
      setIsOptionsDialogOpen(true);
    }
  };

  const handleCreateShift = async () => {
    if (!newShiftRoleNeeded) return;
    setIsCreatingShift(true);
    try {
      if (postAsOpenShiftState) {
        await createOpenShiftService({
          pharmacy_id: selectedPharmacyId!,
          role_needed: newShiftRoleNeeded,
          slot_date: dialogShiftDate!,
          start_time: dialogShiftStartTime!,
          end_time: dialogShiftEndTime!,
          visibility: 'LOCUM_CASUAL',
          description: 'Open shift'
        });
      } else {
        await createShiftAndAssignService({
          pharmacy_id: selectedPharmacyId!,
          role_needed: newShiftRoleNeeded,
          slot_date: dialogShiftDate!,
          start_time: dialogShiftStartTime!,
          end_time: dialogShiftEndTime!,
          user_id: selectedUserForAssignment!
        });
      }
      showSnackbar("Shift created!");
      setIsAddAssignmentDialogOpen(false);
      // reload
      if (selectedPharmacyId) {
        const { start, end } = getDateRangeForView(calendarDate, calendarView);
        loadAssignments(selectedPharmacyId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
      }
    } catch (e) { console.error(e); showSnackbar("Failed to create shift"); }
    finally { setIsCreatingShift(false); }
  };

  // Update filtered members when dialog opens
  useEffect(() => {
    setFilteredMembers(newShiftRoleNeeded ? pharmacyMembers.filter(m => m.role === newShiftRoleNeeded) : pharmacyMembers);
  }, [newShiftRoleNeeded, pharmacyMembers]);


  // --- Render ---
  if (isPageLoading) return <RosterPageSkeleton />;

  return (
    <Box sx={styles.pageContainer}>
      {/* Top Header */}
      <Box sx={styles.headerRow}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={800} color="text.primary" letterSpacing="-0.5px">
              Roster
            </Typography>
          </Box>
          {/* Pharmacy Switcher - Modern Pill Style */}
          <Tabs
            value={selectedPharmacyId}
            onChange={(_, v) => setSelectedPharmacyId(v)}
            sx={{
              minHeight: 36,
              bgcolor: '#e5e7eb',
              borderRadius: '99px',
              p: 0.5,
              '& .MuiTabs-indicator': { display: 'none' }
            }}
          >
            {pharmacies.map(p => (
              <Tab
                key={p.id}
                label={p.name}
                value={p.id}
                sx={{
                  minHeight: 32,
                  borderRadius: '99px',
                  zIndex: 1,
                  fontWeight: 600,
                  px: 2,
                  py: 0.5,
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  '&.Mui-selected': { bgcolor: 'white', color: 'text.primary', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                }}
              />
            ))}
          </Tabs>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Stats Summary Bar */}
          <Box sx={styles.statsBar}>
            <StatDisplay icon={<ClockIcon fontSize="small" />} label="Hrs" value={stats.totalHours} color={muiTheme.palette.primary.main} />
            <StatDisplay icon={<MoneyIcon fontSize="small" />} label="Est. Cost" value={`$${(Number(stats.totalHours) * 45).toLocaleString()}`} color="#10b981" />
            <StatDisplay icon={<WarningIcon fontSize="small" />} label="Open" value={stats.openCount} color="#ef4444" />
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleSlotSelect({ start: new Date(), end: new Date() })}
            sx={{
              height: 48,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}
          >
            New Shift
          </Button>
        </Stack>
      </Box>

      {/* Main Interface Grid */}
      <Grid container spacing={3}>

        {/* Left Sidebar: Filters & Shift Pool */}
        <Grid item xs={12} md={2.5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            <Card sx={{ p: 2, borderRadius: '16px', boxShadow: 'none', border: '1px solid #e5e7eb' }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Filters
              </Typography>
              <FormControl fullWidth size="small">
                {/* <InputLabel>Role</InputLabel> */}
                <Select
                  multiple
                  value={roleFilters}
                  onChange={(e) => {
                    const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                    if (val.includes(ALL_STAFF) && !roleFilters.includes(ALL_STAFF)) setRoleFilters([ALL_STAFF]);
                    else if (val.includes(ALL_STAFF)) setRoleFilters(val.filter(v => v !== ALL_STAFF));
                    else setRoleFilters(val.length ? val : [ALL_STAFF]);
                  }}
                  displayEmpty
                  input={<OutlinedInput />}
                  renderValue={(selected) => (selected.includes(ALL_STAFF) ? 'All Staff' : `${selected.length} Roles`)}
                  sx={{ borderRadius: '8px', bgcolor: '#f9fafb' }}
                >
                  <MenuItem value={ALL_STAFF}>All Roles</MenuItem>
                  {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </FormControl>
            </Card>

            {/* Open Shift Pool Mockup */}
            <Box sx={styles.shiftPoolCard}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Open Shifts Pool</span>
                <Chip label={openShifts.length} size="small" color="error" sx={{ height: 18, fontWeight: 700 }} />
              </Typography>
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {openShifts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4, fontStyle: 'italic' }}>
                    No open shifts.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {openShifts.map(open => (
                      <Paper key={open.id} variant="outlined" sx={{ p: 1.5, borderRadius: '10px', borderLeft: '4px solid #ef4444' }}>
                        <Typography variant="subtitle2" fontWeight={700}>{open.roleNeeded}</Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {moment(open.slots[0].date).format('ddd D MMM')} • {open.slots[0].startTime.substring(0, 5)}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          </Box>
        </Grid>

        {/* Center: Interactive Calendar */}
        <Grid item xs={12} md={9.5}>
          <Box sx={styles.calendarCard}>
            {/* Custom Calendar Toolbar */}
            <Box sx={styles.toolbar}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <IconButton onClick={() => setCalendarDate(moment(calendarDate).subtract(1, calendarView === 'week' ? 'w' : 'd').toDate())} size="small" sx={{ border: '1px solid #e5e7eb' }}>
                  <KeyboardArrowLeft fontSize="small" />
                </IconButton>
                <Typography variant="h6" fontWeight={700}>
                  {moment(calendarDate).format('MMMM YYYY')}
                  {calendarView === 'week' && <Typography component="span" fontWeight={400} color="text.secondary" sx={{ ml: 1 }}>
                    Week {moment(calendarDate).week()}
                  </Typography>}
                </Typography>
                <IconButton onClick={() => setCalendarDate(moment(calendarDate).add(1, calendarView === 'week' ? 'w' : 'd').toDate())} size="small" sx={{ border: '1px solid #e5e7eb' }}>
                  <KeyboardArrowRight fontSize="small" />
                </IconButton>
              </Stack>

              <Box sx={styles.viewToggleGroup}>
                {['month', 'week', 'day'].map((v: any) => (
                  <Button
                    key={v}
                    onClick={() => setCalendarView(v)}
                    sx={styles.viewButtonOf(calendarView === v)}
                  >
                    {v}
                  </Button>
                ))}
              </Box>
            </Box>
            <Divider />

            <Box sx={{ flex: 1, p: 2 }}>
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                defaultView="week"
                view={calendarView}
                date={calendarDate}
                onNavigate={setCalendarDate}
                onView={setCalendarView as any}
                selectable
                onSelectSlot={handleSlotSelect}
                onSelectEvent={handleEventSelect}
                components={{
                  toolbar: () => null, // Hide default toolbar
                  event: CustomEvent, // Use modern card component
                }}
                min={new Date(0, 0, 0, 6, 0, 0)} // Start at 6am
                max={new Date(0, 0, 0, 23, 0, 0)} // End at 11pm
                step={30}
                timeslots={2}
                popup
                style={{ height: '100%' }}
                dayLayoutAlgorithm="no-overlap"
              />
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* --- DIALOGS (Simplified for rewrite, but same logic) --- */}
      <Dialog open={isAddAssignmentDialogOpen} onClose={() => setIsAddAssignmentDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle>Add Shift</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Date" type="date" value={dialogShiftDate || ''} onChange={e => setDialogShiftDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            <Stack direction="row" spacing={2}><TextField label="Start" type="time" value={dialogShiftStartTime || ''} onChange={e => setDialogShiftStartTime(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} /><TextField label="End" type="time" value={dialogShiftEndTime || ''} onChange={e => setDialogShiftEndTime(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} /></Stack>
            <FormControl fullWidth><InputLabel>Role</InputLabel><Select value={newShiftRoleNeeded} label="Role" onChange={(e) => setNewShiftRoleNeeded(e.target.value)}>{ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl>
            {!postAsOpenShiftState && <FormControl fullWidth><InputLabel>Staff</InputLabel><Select value={selectedUserForAssignment || ''} label="Staff" onChange={(e) => setSelectedUserForAssignment(Number(e.target.value))}>{filteredMembers.map(m => <MenuItem key={m.id} value={m.user}>{m.invitedName || 'Staff'}</MenuItem>)}</Select></FormControl>}
            <FormControlLabel control={<Checkbox checked={postAsOpenShiftState} onChange={e => setPostAsOpenShiftState(e.target.checked)} />} label="Post as Open Shift" />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setIsAddAssignmentDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreateShift} disabled={isCreatingShift}>Create</Button></DialogActions>
      </Dialog>

      {/* Simplified Options Dialog */}
      <Dialog open={isOptionsDialogOpen} onClose={() => setIsOptionsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{selectedAssignment?.userDetail.firstName}'s Shift</DialogTitle>
        <DialogContent>
          <Typography>Action menu placeholder for shift management.</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={async () => {
            if (!selectedAssignment) return;
            await deleteRosterAssignmentService(selectedAssignment.id);
            setIsOptionsDialogOpen(false);
            // trigger reload
          }}>Delete</Button>
          <Button onClick={() => setIsOptionsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} message={snackbarMsg} />
    </Box>
  );
}
