import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import {
  Container,
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
  SelectChangeEvent,
  TextField,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Checkbox,
  OutlinedInput,
  FormControlLabel,
  Paper,
  Chip,
  Snackbar,
  IconButton,
} from '@mui/material';

import { Close as CloseIcon } from '@mui/icons-material';

// Calendar Imports
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { calendarViews, calendarMessages, getDateRangeForView, CalendarViewKey } from './calendarViews';

import { useAuth } from '../../../contexts/AuthContext';
import { ROSTER_COLORS } from '../../../constants/rosterColors';
import {
  PharmacySummary,
  RosterAssignment,
  WorkerShiftRequest,
  OpenShift,
  RosterPharmacyMember,
  RosterSlotDetail,
  RosterShiftDetail,
  fetchPharmaciesService,
  fetchRosterOwnerAssignments,
  fetchWorkerShiftRequestsService,
  fetchOwnerOpenShifts,
  fetchRosterOwnerMembersService,
  createShiftAndAssignService,
  deleteRosterAssignmentService,
  updateRosterShiftService,
  escalateRosterShiftService,
  approveLeaveRequestService,
  rejectLeaveRequestService,
  createOpenShiftService,
  approveWorkerShiftRequestService,
  rejectWorkerShiftRequestService,
} from '@chemisttasker/shared-core';

const localizer = momentLocalizer(moment);

type AssignmentViewModel = RosterAssignment;

interface ShiftForEdit {
  id: number;
  roleNeeded?: string | null;
  slots: RosterSlotDetail[];
}


// --- Constants for Roles, Colors, and Leave (Updated) ---
const ROLES = ['PHARMACIST', 'ASSISTANT', 'INTERN', 'TECHNICIAN'];
const ALL_STAFF = 'ALL';
const LEAVE_TYPES_MAP: { [key: string]: string } = {
    SICK: 'Sick Leave',
    ANNUAL: 'Annual Leave',
    COMPASSIONATE: 'Compassionate Leave',
    STUDY: 'Study Leave',
    CARER: 'Carer\'s Leave',
    UNPAID: 'Unpaid Leave',
    OTHER: 'Other',
};


// --- Skeleton Component for Unified Loading ---
const RosterPageSkeleton = () => (
    <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom><Skeleton width="40%" /></Typography>
        <Skeleton variant="rectangular" height={48} sx={{ mb: 3 }} />
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
            <Typography variant="h5"><Skeleton width="200px" /></Typography>
            <Skeleton variant="rectangular" width={300} height={56} />
        </Box>
        <Typography variant="body2"><Skeleton width="80%" /></Typography>
        <Skeleton variant="rectangular" height={600} sx={{ mt: 2 }} />
    </Container>
);


export default function RosterOwnerPage() {
  const { activePersona, activeAdminPharmacyId } = useAuth();
  const scopedPharmacyId =
    activePersona === 'admin' && typeof activeAdminPharmacyId === 'number'
      ? activeAdminPharmacyId
      : null;
  const initialPharmacyFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get('pharmacy') ?? params.get('admin_pharmacy_id');
    const num = candidate ? Number(candidate) : null;
    return Number.isFinite(num) ? num : null;
  }, []);

  // --- Component State ---
  const [pharmacies, setPharmacies] = useState<PharmacySummary[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentViewModel[]>([]);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]); // NEW: State for open shifts
  const [workerRequests, setWorkerRequests] = useState<WorkerShiftRequest[]>([]); // NEW: State for cover requests
  const [pharmacyMembers, setPharmacyMembers] = useState<RosterPharmacyMember[]>([]);
  
  // --- Loading States ---
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isDialogDataLoading, setIsDialogDataLoading] = useState(false);
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false); // General purpose for dialog actions

  // --- Calendar State ---
  const [calendarView, setCalendarView] = useState<CalendarViewKey>('week');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // --- Dialogs and Forms State (Updated) ---
  const [isAddAssignmentDialogOpen, setIsAddAssignmentDialogOpen] = useState(false);
  const [dialogShiftStartTime, setDialogShiftStartTime] = useState<string | null>(null);
  const [dialogShiftEndTime, setDialogShiftEndTime] = useState<string | null>(null);
  const [dialogShiftDate, setDialogShiftDate] = useState<string | null>(null);
  const [newShiftRoleNeeded, setNewShiftRoleNeeded] = useState<string>('');
  
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentViewModel | null>(null);
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<number | null>(null);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEscalateDialogOpen, setIsEscalateDialogOpen] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<ShiftForEdit | null>(null);
  const [filteredMembers, setFilteredMembers] = useState<RosterPharmacyMember[]>([]);
  const [escalationLevel, setEscalationLevel] = useState<string>('');
  const handleTabChange = useCallback((_: SyntheticEvent, val: number | boolean) => {
    if (scopedPharmacyId != null) {
      return;
    }
    if (typeof val === 'number') {
      setSelectedPharmacyId(val);
    }
  }, [scopedPharmacyId]);
  const [isLeaveManageDialogOpen, setIsLeaveManageDialogOpen] = useState(false); // New dialog state
  const currentShiftDetail: RosterShiftDetail | undefined = selectedAssignment?.shiftDetail;
  const selectableEscalationLevels = useMemo(() => {
    if (!currentShiftDetail) return [];
    const allowed = currentShiftDetail.allowedEscalationLevels || [];
    if (!allowed.length) return [];

    const canonicalOrder = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'];
    const allowedSet = new Set(allowed);
    const ordered = canonicalOrder.filter(level => allowedSet.has(level));
    const extras = allowed.filter(level => !canonicalOrder.includes(level));
    const sequence = [...ordered, ...extras];

    const currentIndex = sequence.indexOf(currentShiftDetail.visibility ?? '');
    if (currentIndex === -1) {
      return sequence;
    }
    return sequence.slice(currentIndex + 1);
  }, [currentShiftDetail]);
  useEffect(() => {
    if (!isEscalateDialogOpen) {
      return;
    }
    if (!selectableEscalationLevels.length) {
      setEscalationLevel('');
      return;
    }
    setEscalationLevel(prev =>
      prev && selectableEscalationLevels.includes(prev) ? prev : selectableEscalationLevels[0]
    );
  }, [isEscalateDialogOpen, selectableEscalationLevels]);
  
  const [isCoverRequestDialogOpen, setIsCoverRequestDialogOpen] = useState(false); // NEW: Dialog for cover requests
  const [postAsOpenShift, setPostAsOpenShift] = useState(false);
  const [selectedCoverRequest, setSelectedCoverRequest] = useState<WorkerShiftRequest | null>(null); // NEW
  const [roleFilters, setRoleFilters] = useState<string[]>([ALL_STAFF]);
  // --- Snackbar ---
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const showSnackbar = (msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  };
  const closeSnackbar = () => setSnackbarOpen(false);

  // --- DATA LOADING ---
  useEffect(() => {
    const loadInitialData = async () => {
      setIsPageLoading(true);
      try {
        const loadedPharmacies = await fetchPharmaciesService({});
        // Normalize ids to numbers to mirror old behavior and keep tab selection stable
        const normalizedPharmacies = loadedPharmacies.map((ph: PharmacySummary) => ({
          ...ph,
          id: Number(ph.id),
        }));
        const filteredByScope =
          scopedPharmacyId != null
            ? normalizedPharmacies.filter((ph: PharmacySummary) => Number(ph.id) === scopedPharmacyId)
            : [];
        const availablePharmacies =
          filteredByScope.length > 0 ? filteredByScope : normalizedPharmacies;

        setPharmacies(availablePharmacies);

        const defaultPharmacyId: number | null =
          scopedPharmacyId != null
            ? scopedPharmacyId
            : initialPharmacyFromUrl != null
            ? initialPharmacyFromUrl
            : availablePharmacies.length > 0
            ? Number(availablePharmacies[0].id)
            : null;

        if (defaultPharmacyId != null) {
          setSelectedPharmacyId(defaultPharmacyId);
          const { start, end } = getDateRangeForView(calendarDate, calendarView);
          const startDate = start.format('YYYY-MM-DD');
          const endDate = end.format('YYYY-MM-DD');
          const assignmentsData = await fetchRosterOwnerAssignments({ pharmacyId: defaultPharmacyId, startDate, endDate });
          const requestsData = await fetchWorkerShiftRequestsService({ pharmacyId: defaultPharmacyId, startDate, endDate });
          const openShiftData = await fetchOwnerOpenShifts({ pharmacyId: defaultPharmacyId, startDate, endDate });
          setAssignments(assignmentsData);
          setWorkerRequests(requestsData);
          setOpenShifts(openShiftData);
        }
      } catch (err) { 
        console.error("Failed to load initial page data", err); 
      } finally {
        setIsPageLoading(false);
      }
    };
    loadInitialData();
  }, [scopedPharmacyId, initialPharmacyFromUrl]);

  useEffect(() => {
    if (!isPageLoading && selectedPharmacyId) { 
      reloadAssignments(); 
    }
  }, [selectedPharmacyId, calendarDate, calendarView]);

  useEffect(() => {
    if ((isAddAssignmentDialogOpen || isEditDialogOpen) && selectedPharmacyId) {
      loadMembersForRoster(selectedPharmacyId);
    }
  }, [isAddAssignmentDialogOpen, isEditDialogOpen, selectedPharmacyId]);

  useEffect(() => {
    const role = isEditDialogOpen ? shiftToEdit?.roleNeeded : newShiftRoleNeeded;
    if (role) {
      setFilteredMembers(pharmacyMembers.filter(member => member.role === role));
    } else {
      setFilteredMembers(pharmacyMembers);
    }
    setSelectedUserForAssignment(null);
  }, [newShiftRoleNeeded, shiftToEdit, pharmacyMembers, isEditDialogOpen]);

  // --- API CALLS (Updated) ---
  const reloadAssignments = () => {
      if (!selectedPharmacyId) return;
      const { start, end } = getDateRangeForView(calendarDate, calendarView);
      loadAssignments(selectedPharmacyId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  }

  const loadAssignments = async (pharmacyId: number, startDate?: string, endDate?: string) => {
    setIsAssignmentsLoading(true);
    try {
      // Fetch both assignments and worker requests in parallel
      const [assignmentsData, requestsData, openShiftData] = await Promise.all([
        fetchRosterOwnerAssignments({ pharmacyId, startDate, endDate }),
        fetchWorkerShiftRequestsService({ pharmacyId, startDate, endDate }),
        fetchOwnerOpenShifts({ pharmacyId, startDate, endDate }),
      ]);
      // Extra safety: filter by active pharmacy in case backend returns broader set
      const activePharmacyName = pharmacies.find(p => Number(p.id) === Number(pharmacyId))?.name;
      const filteredAssignments = activePharmacyName
        ? assignmentsData.filter((a: AssignmentViewModel) => (a.shiftDetail?.pharmacyName ?? '') === activePharmacyName)
        : assignmentsData;
      const filteredRequests = requestsData.filter((req: WorkerShiftRequest) =>
        req.pharmacy == null ? true : Number(req.pharmacy) === Number(pharmacyId)
      );
      const filteredOpen = openShiftData.filter((shift: OpenShift) =>
        shift.pharmacy == null ? true : Number(shift.pharmacy) === Number(pharmacyId)
      );

      setAssignments(filteredAssignments);
      setWorkerRequests(filteredRequests);
      setOpenShifts(filteredOpen);
    } catch (err) { console.error("Failed to load roster assignments", err); }
    finally { setIsAssignmentsLoading(false); }
  };

  const loadMembersForRoster = async (pharmacyId: number) => {
    setIsDialogDataLoading(true);
    try {
      const res = await fetchRosterOwnerMembersService(pharmacyId);
      setPharmacyMembers(res);
    } catch (err) { console.error("Failed to load pharmacy members", err); }
    finally { setIsDialogDataLoading(false); }
  };

  const handleCreateShiftAndAssign = async () => {
    if (!selectedPharmacyId || !newShiftRoleNeeded || !dialogShiftDate || !dialogShiftStartTime || !dialogShiftEndTime || !selectedUserForAssignment) {
      showSnackbar("Please ensure all fields are selected."); return;
    }
    setIsCreatingShift(true);
    try {
      await createShiftAndAssignService({
        pharmacy_id: selectedPharmacyId,
        role_needed: newShiftRoleNeeded,
        slot_date: dialogShiftDate,
        start_time: dialogShiftStartTime,
        end_time: dialogShiftEndTime,
        user_id: selectedUserForAssignment,
      });
      showSnackbar("Shift created and assigned successfully!");
      setIsAddAssignmentDialogOpen(false);
      reloadAssignments();
    } catch (err: any) { 
        showSnackbar(`Failed to create shift: ${err.response?.data?.detail || err.message}`); 
    } finally {
        setIsCreatingShift(false);
    }
  };
  
  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;
    if (!window.confirm("Are you sure you want to remove this assignment?")) return;
    setIsActionLoading(true);
    try {
      await deleteRosterAssignmentService(selectedAssignment.id);
      setAssignments(prev => prev.filter(a => a.id !== selectedAssignment.id));
      showSnackbar("Assignment removed successfully.");
      setIsOptionsDialogOpen(false);
    } catch (err: any) { showSnackbar(`Error: ${err.response?.data?.detail || err.message}`); }
    finally { setIsActionLoading(false); }
  };

  const handleSaveChanges = async () => {
    if (!shiftToEdit) return;
    setIsActionLoading(true);
    const payload: Record<string, unknown> = {
      role_needed: shiftToEdit.roleNeeded,
      slots: shiftToEdit.slots.map(({ id, date, startTime, endTime }) => ({
        id,
        date,
        start_time: startTime,
        end_time: endTime,
      })),
    };
    if (selectedUserForAssignment) {
      payload.user_id = selectedUserForAssignment;
    }
    try {
      await updateRosterShiftService(shiftToEdit.id, payload);
      showSnackbar("Shift updated successfully!");
      setIsEditDialogOpen(false);
      reloadAssignments();
    } catch (err: any) { showSnackbar(`Error updating shift: ${err.response?.data?.detail || err.message}`); }
    finally { setIsActionLoading(false); }
  };

  const handleConfirmEscalation = async () => {
    if (!selectedAssignment || !escalationLevel) {
      showSnackbar("Please select an escalation level.");
      return;
    }
    if (!selectedAssignment.shift) {
      showSnackbar("Shift identifier missing.");
      return;
    }
    setIsActionLoading(true);
    try {
      await escalateRosterShiftService(selectedAssignment.shift, { target_visibility: escalationLevel });
      showSnackbar(`Shift escalated to ${escalationLevel.replace(/_/g, ' ')}.`);
      setIsEscalateDialogOpen(false);
      setEscalationLevel('');
      reloadAssignments();
    } catch (err: any) {
      showSnackbar(`Error escalating shift: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- NEW: Leave Request Handlers ---
  const handleApproveLeave = async () => {
    if (!selectedAssignment?.leaveRequest) return;
    setIsActionLoading(true);
    try {
        await approveLeaveRequestService(selectedAssignment.leaveRequest.id);
        showSnackbar("Leave request has been approved.");
        setIsLeaveManageDialogOpen(false);
        reloadAssignments();
    } catch (err: any) {
        showSnackbar(`Failed to approve leave: ${err.response?.data?.detail || err.message}`);
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleRejectLeave = async () => {
      if (!selectedAssignment?.leaveRequest) return;
      setIsActionLoading(true);
      try {
          await rejectLeaveRequestService(selectedAssignment.leaveRequest.id);
          showSnackbar("Leave request has been rejected.");
          setIsLeaveManageDialogOpen(false);
          reloadAssignments();
      } catch (err: any) {
          showSnackbar(`Failed to reject leave: ${err.response?.data?.detail || err.message}`);
      } finally {
          setIsActionLoading(false);
      }
  };
  
  // NEW: Handle posting an open shift
  const handleCreateOpenShift = async () => {
    if (!selectedPharmacyId || !newShiftRoleNeeded || !dialogShiftDate || !dialogShiftStartTime || !dialogShiftEndTime) {
      showSnackbar("Please ensure role, date, and times are selected."); return;
    }
    setIsCreatingShift(true);
    try {
      await createOpenShiftService({
        pharmacy_id: selectedPharmacyId,
        role_needed: newShiftRoleNeeded,
        slot_date: dialogShiftDate,
        start_time: dialogShiftStartTime,
        end_time: dialogShiftEndTime,
        // You can add a description field to the dialog if needed
        description: "Open shift posted by owner.",
      });
      showSnackbar("Open shift posted successfully!");
      setIsAddAssignmentDialogOpen(false);
      reloadAssignments();
    } catch (err: any) {
      showSnackbar(`Failed to post open shift: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsCreatingShift(false);
    }
  };

  // NEW: Cover Request Handlers
  const handleApproveCoverRequest = async () => {
    if (!selectedCoverRequest) return;
    setIsActionLoading(true);
    try {
      await approveWorkerShiftRequestService(selectedCoverRequest.id);
      showSnackbar("Cover request approved successfully.");
      setIsCoverRequestDialogOpen(false);
      reloadAssignments();
    } catch (err: any) {
      showSnackbar(`Failed to approve request: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectCoverRequest = async () => {
    if (!selectedCoverRequest) return;
    setIsActionLoading(true);
    try {
      await rejectWorkerShiftRequestService(selectedCoverRequest.id);
      showSnackbar("Cover request has been rejected.");
      setIsCoverRequestDialogOpen(false);
      reloadAssignments();
    } catch (err: any) {
      showSnackbar(`Failed to reject request: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- UI HANDLERS (Updated) ---
  const handleSelectSlot = (slotInfo: { start: Date, end: Date }) => {
    setIsAddAssignmentDialogOpen(true);
    setDialogShiftDate(moment(slotInfo.start).format('YYYY-MM-DD'));
    setDialogShiftStartTime(moment(slotInfo.start).format('HH:mm'));
    setDialogShiftEndTime(moment(slotInfo.end).format('HH:mm'));
    setNewShiftRoleNeeded('');
    setPostAsOpenShift(false); // Reset checkbox
    setSelectedUserForAssignment(null);
  };

  const handleSelectEvent = (event: { resource: any }) => {
    const item = event.resource;

    // NEW: Check if it's an open shift
    if (item.isOpenShift) {
      // For now, just show options dialog for open shifts (e.g., to delete it)
      // We create a temporary "Assignment-like" object for the dialog
      const firstSlot = item.originalShift.slots[0];
      const tempAssignment: AssignmentViewModel = {
        id: item.originalShift.id,
        shift: item.originalShift.id,
        slot: firstSlot?.id ?? null,
        slotDate: firstSlot?.date ?? '',
        user: null,
        userDetail: {
          id: 0,
          firstName: 'Open',
          lastName: 'Shift',
          email: '',
        },
        slotDetail: firstSlot
          ? {
              id: firstSlot.id,
              date: firstSlot.date,
              startTime: firstSlot.startTime,
              endTime: firstSlot.endTime,
            }
          : { id: 0, date: '', startTime: '', endTime: '' },
        shiftDetail: {
          id: item.originalShift.id,
          pharmacyName: '',
          roleNeeded: item.shiftDetail?.roleNeeded || item.originalShift.roleNeeded || '',
          visibility: item.shiftDetail?.visibility || 'PRIVATE',
          allowedEscalationLevels: [],
        },
        leaveRequest: null,
      };
      setSelectedAssignment(tempAssignment);
      setIsOptionsDialogOpen(true);
      setIsLeaveManageDialogOpen(false);
      setIsCoverRequestDialogOpen(false);
      return;
    }

    // NEW: Check if it's a cover request
    if (item.isCoverRequest) {
      setSelectedCoverRequest(item.originalRequest);
      setIsCoverRequestDialogOpen(true);
      setIsOptionsDialogOpen(false);
      setIsLeaveManageDialogOpen(false);
      return;
    }

    // Existing logic for assignments and leave requests
    setSelectedAssignment(item);
    if (item.leaveRequest && item.leaveRequest.status === 'PENDING') {
        setIsLeaveManageDialogOpen(true);
        setIsOptionsDialogOpen(false); // Ensure other dialog is closed
        setIsCoverRequestDialogOpen(false);
    } else {
        setIsOptionsDialogOpen(true);
        setIsLeaveManageDialogOpen(false); // Ensure other dialog is closed
        setIsCoverRequestDialogOpen(false);
    }
  };
  
  const handleNewShiftRoleChange = (event: SelectChangeEvent<string>) => {
    setNewShiftRoleNeeded(event.target.value);
  };

  const handleRoleFilterChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    if (value[value.length - 1] === ALL_STAFF || value.length === 0) {
        setRoleFilters([ALL_STAFF]);
    } else {
        setRoleFilters(value.filter(v => v !== ALL_STAFF));
    }
  };

  // --- Memos and Styles (Updated) ---
  const calendarEvents = useMemo(() => {
    const activePharmacyName = pharmacies.find(p => Number(p.id) === Number(selectedPharmacyId))?.name;

    // Map regular assignments
    const assignmentEvents = assignments
      .filter(a => {
        if (!activePharmacyName) return true;
        return (a.shiftDetail?.pharmacyName ?? '') === activePharmacyName;
      })
      .filter(a => {
        if (roleFilters.includes(ALL_STAFF)) {
            return true;
        }
        return roleFilters.includes(a.shiftDetail?.roleNeeded ?? '');
      })
      .map(a => {
        const roleName = a.shiftDetail?.roleNeeded ?? '';
        const userFirstName = a.userDetail.firstName || '';
        let title = `${userFirstName} (${roleName.substring(0,3)})`;
        // Add leave status to title
        if (a.leaveRequest) {
            title = `${title} (Leave: ${a.leaveRequest.status})`;
        }
        return ({
            id: a.id,
            title: title,
            start: moment(`${a.slotDate} ${a.slotDetail?.startTime ?? '00:00'}`).toDate(),
            end: moment(`${a.slotDate} ${a.slotDetail?.endTime ?? '00:00'}`).toDate(),
            allDay: false,
            resource: a
        });
    });

    // NEW: Map worker cover requests
    const requestEvents = workerRequests
      .filter(req => Number(req.pharmacy) === Number(selectedPharmacyId))
      .filter(req => req.status === 'PENDING') // Only show pending requests
      .map(req => ({
        id: `cover-${req.id}`,
        title: `${req.requesterName ?? 'Unknown'} (Cover Request)`,
        start: moment(`${req.slotDate} ${req.startTime}`).toDate(),
        end: moment(`${req.slotDate} ${req.endTime}`).toDate(),
        allDay: false,
        resource: {
          isCoverRequest: true,
          originalRequest: req,
          shiftDetail: { roleNeeded: req.role } // For filtering
        }
      }));

    // NEW: Map owner-created open shifts
    const openShiftEvents = openShifts
      .filter(shift => Number(shift.pharmacy) === Number(selectedPharmacyId))
      .filter(shift => {
        if (roleFilters.includes(ALL_STAFF)) return true;
        return roleFilters.includes(shift.roleNeeded);
      })
      .flatMap(shift =>
        shift.slots.map(slot => ({
            id: `open-${shift.id}-${slot.id}`,
            title: `OPEN: ${shift.roleNeeded}`,
            start: moment(`${slot.date} ${slot.startTime}`).toDate(),
            end: moment(`${slot.date} ${slot.endTime}`).toDate(),
            allDay: false,
            resource: {
              isOpenShift: true,
              originalShift: shift, // Keep original data for context
              shiftDetail: { roleNeeded: shift.roleNeeded } // For filtering and styling
            }
          }))
    );

    return [...assignmentEvents, ...requestEvents, ...openShiftEvents];
  }, [assignments, workerRequests, openShifts, roleFilters]);

  const eventStyleGetter = (event: any) => {
    const assignment = event.resource;
    const role = assignment?.shiftDetail?.roleNeeded;

    // NEW: Style for open shifts
    if (assignment.isOpenShift) {
      return { // Ensure this style is applied
        style: { backgroundColor: ROSTER_COLORS.OPEN_SHIFT, borderRadius: '5px', opacity: 0.9, color: 'white', border: '1px dashed #fff', display: 'block' }
      };
    }
    // NEW: Style for cover requests
    if (assignment.isCoverRequest) {
      return {
        style: { backgroundColor: ROSTER_COLORS.SWAP_PENDING, borderRadius: '5px', opacity: 0.9, color: 'white', border: '0px', display: 'block' }
      };
    }

    let backgroundColor = ROSTER_COLORS[role as keyof typeof ROSTER_COLORS] || ROSTER_COLORS.DEFAULT;

    // Override color for leave requests
    if (assignment?.leaveRequest) {
        if (assignment.leaveRequest.status === 'PENDING') {
            backgroundColor = ROSTER_COLORS.LEAVE_PENDING;
        } else if (assignment.leaveRequest.status === 'APPROVED') {
            backgroundColor = ROSTER_COLORS.LEAVE_APPROVED;
        }
    }

    const style = {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
    };
    return { style };
  };

  if (isPageLoading) {
    return <RosterPageSkeleton />;
  }

  // --- Render Method ---
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Internal Roster</Typography>

      <Tabs value={selectedPharmacyId ?? false} onChange={handleTabChange} sx={{ mb: 3 }} textColor="primary" indicatorColor="primary">
        {pharmacies.map(p => (
          <Tab key={p.id} label={p.name} value={Number(p.id)} />
        ))}
      </Tabs>
      
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h5">Roster Calendar</Typography>
          </Stack>
          <FormControl sx={{ m: 1, width: 300 }}>
              <InputLabel>Filter by Role</InputLabel>
              <Select
                  multiple
                  value={roleFilters}
                  onChange={handleRoleFilterChange}
                  input={<OutlinedInput label="Filter by Role" />}
                  renderValue={(selected) => (selected.includes(ALL_STAFF) ? 'All Staff' : selected.map(s => s.charAt(0) + s.slice(1).toLowerCase()).join(', '))}
              >
                  <MenuItem value={ALL_STAFF}>
                      <Checkbox checked={roleFilters.includes(ALL_STAFF)} />
                      <ListItemText primary="All Staff" />
                  </MenuItem>
                  {ROLES.map((role) => (
                      <MenuItem key={role} value={role}>
                          <Checkbox checked={roleFilters.includes(role)} />
                          <ListItemText primary={role.charAt(0) + role.slice(1).toLowerCase()} />
                      </MenuItem>
                  ))}
              </Select>
          </FormControl>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>Click an empty time slot to create a new shift, or click an existing assignment to manage it. Assignments with pending leave requests are highlighted in grey.</Typography>

      <Box sx={{ 
        position: 'relative',
        '.rbc-calendar': { height: 'auto', minHeight: '800px' },
        '.rbc-time-view': { height: 'auto' },
        '.rbc-time-content': { height: 'auto', overflowY: 'visible', maxHeight: 'none' }
      }}>
        {isAssignmentsLoading && (
            <Box sx={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 10
            }}>
                <CircularProgress />
            </Box>
        )}
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          defaultView={calendarView as any}
          view={calendarView as any}
          date={calendarDate}
          onNavigate={setCalendarDate}
          onView={(nextView: CalendarViewKey | string) => setCalendarView(nextView as CalendarViewKey)}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          views={calendarViews}
          messages={calendarMessages}
        />
      </Box>

      {/* DIALOGS */}
      {/* Add Assignment / Open Shift Dialog */}
      <Dialog open={isAddAssignmentDialogOpen} onClose={() => setIsAddAssignmentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Shift and Assign</DialogTitle>
        <DialogContent dividers>
          {isDialogDataLoading ? ( <Skeleton variant="rectangular" height={150} /> ) : (
            <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField label="Date" type="date" value={dialogShiftDate || ''} InputLabelProps={{ shrink: true }} onChange={(e) => setDialogShiftDate(e.target.value)} required fullWidth/>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Start Time" type="time" value={dialogShiftStartTime || ''} InputLabelProps={{ shrink: true }} onChange={(e) => setDialogShiftStartTime(e.target.value)} required fullWidth/>
                <TextField label="End Time" type="time" value={dialogShiftEndTime || ''} InputLabelProps={{ shrink: true }} onChange={(e) => setDialogShiftEndTime(e.target.value)} required fullWidth/>
              </Box>
              <FormControl fullWidth required>
                <InputLabel>Role Needed</InputLabel>
                <Select value={newShiftRoleNeeded} onChange={handleNewShiftRoleChange} label="Role Needed">
                  <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
                  <MenuItem value="INTERN">Intern</MenuItem>
                  <MenuItem value="TECHNICIAN">Technician</MenuItem>
                  <MenuItem value="ASSISTANT">Assistant</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox checked={postAsOpenShift} onChange={(e) => setPostAsOpenShift(e.target.checked)} />
                }
                label="Post as an Open Shift for the community to claim"
              />

              <FormControl fullWidth required disabled={postAsOpenShift}>
                <InputLabel>Assign Staff Member</InputLabel>
                <Select value={selectedUserForAssignment || ''} onChange={(e) => setSelectedUserForAssignment(e.target.value as number)} label="Assign Staff Member" disabled={!newShiftRoleNeeded || postAsOpenShift}>
              {filteredMembers.length === 0 ? (
                <MenuItem disabled value="">{newShiftRoleNeeded ? "No staff for this role" : "Select a role first"}</MenuItem>
              ) : (
                filteredMembers.map(member => {
                  const displayName = (member.userDetails?.firstName || member.userDetails?.lastName) ? `${member.userDetails?.firstName || ''} ${member.userDetails?.lastName || ''}`.trim() : member.invitedName;
                  const employmentLabel = member.employmentType || 'N/A';
                  return (<MenuItem key={member.id} value={member.user}>{displayName} ({employmentLabel})</MenuItem>);
                })
              )}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddAssignmentDialogOpen(false)} disabled={isCreatingShift}>Cancel</Button>
          <Button 
            onClick={postAsOpenShift ? handleCreateOpenShift : handleCreateShiftAndAssign} 
            variant="contained" 
            color="primary"
            disabled={isCreatingShift}
          >
            {isCreatingShift ? <CircularProgress size={24} color="inherit" /> : (postAsOpenShift ? 'Post Open Shift' : 'Create & Assign')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Existing Options Dialog (Unchanged) */}
      <Dialog open={isOptionsDialogOpen} onClose={() => setIsOptionsDialogOpen(false)}>
        <DialogTitle>Manage Assignment</DialogTitle>
        <DialogContent>
            {selectedAssignment && <List>
                <ListItem><ListItemText primary="Staff" secondary={`${selectedAssignment.userDetail.firstName} ${selectedAssignment.userDetail.lastName}`} /></ListItem>
                <ListItem><ListItemText primary="Date & Time" secondary={`${selectedAssignment.slotDate} @ ${moment(selectedAssignment.slotDetail?.startTime ?? '00:00', ["HH:mm:ss","HH:mm"]).format("h:mm A")}`} /></ListItem>
                {selectedAssignment.leaveRequest?.status === 'APPROVED' &&
                  <ListItem><Chip label="LEAVE APPROVED" color="error" size="small" /></ListItem>
                }
            </List>}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', p: 2, gap: 1}}>
            <Button
              variant="outlined"
              disabled={isActionLoading}
              onClick={() => {
                if (!selectedAssignment) return;
                setIsOptionsDialogOpen(false);
                setIsEditDialogOpen(true);
                setShiftToEdit({
                  id: selectedAssignment.shift ?? selectedAssignment.id,
                  roleNeeded: selectedAssignment.shiftDetail?.roleNeeded,
                  slots: selectedAssignment.slotDetail ? [selectedAssignment.slotDetail] : [],
                });
                setSelectedUserForAssignment(selectedAssignment.user ?? null);
              }}
            >
              Edit Shift / Re-Assign
            </Button>
            <Button
              variant="outlined"
              disabled={isActionLoading || !selectableEscalationLevels.length}
              color="secondary"
              onClick={() => {
                if (!selectedAssignment) {
                  return;
                }
                if (!selectableEscalationLevels.length) {
                  showSnackbar('No higher visibility levels available to escalate to.');
                  return;
                }
                setIsOptionsDialogOpen(false);
                setEscalationLevel(selectableEscalationLevels[0] ?? '');
                setIsEscalateDialogOpen(true);
              }}
            >
              Escalate Shift
            </Button>
            <Button variant="contained" disabled={isActionLoading} color="error" onClick={handleDeleteAssignment}>
                {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Delete Assignment'}
            </Button>
            <Button onClick={() => setIsOptionsDialogOpen(false)} sx={{mt: 1}} disabled={isActionLoading}>Cancel</Button>
        </DialogActions>
      </Dialog>
      
      {/* NEW: Leave Management Dialog */}
      <Dialog open={isLeaveManageDialogOpen} onClose={() => setIsLeaveManageDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Manage Leave Request</DialogTitle>
        <DialogContent dividers>
            {selectedAssignment && selectedAssignment.leaveRequest ? (
                <Box sx={{pt: 1}}>
                    <List dense>
                        <ListItem><ListItemText primary="Staff Member" secondary={`${selectedAssignment.userDetail.firstName} ${selectedAssignment.userDetail.lastName}`} /></ListItem>
                        <ListItem><ListItemText primary="Shift Date" secondary={moment(selectedAssignment.slotDate).format('dddd, MMMM Do YYYY')} /></ListItem>
                        <ListItem><ListItemText primary="Leave Type" secondary={LEAVE_TYPES_MAP[selectedAssignment.leaveRequest.leaveType] || selectedAssignment.leaveRequest.leaveType} /></ListItem>
                    </List>
                    <Typography variant="subtitle2" sx={{ mt: 2, color: 'text.secondary' }}>Worker's Note:</Typography>
                    <Paper variant="outlined" sx={{ p: 2, mt: 1, minHeight: '60px', bgcolor: 'grey.100' }}>
                        <Typography variant="body2" sx={{ fontStyle: selectedAssignment.leaveRequest.note ? 'normal' : 'italic', color: selectedAssignment.leaveRequest.note ? 'text.primary' : 'text.secondary' }}>
                            {selectedAssignment.leaveRequest.note || "No note provided."}
                        </Typography>
                    </Paper>
                </Box>
            ) : <Skeleton variant="rectangular" height={200} />}
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setIsLeaveManageDialogOpen(false)} disabled={isActionLoading}>Cancel</Button>
            <Button onClick={handleRejectLeave} variant="outlined" color="error" disabled={isActionLoading}>
              {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Reject Request'}
            </Button>
            <Button onClick={handleApproveLeave} variant="contained" color="success" disabled={isActionLoading}>
              {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Approve Leave'}
            </Button>
        </DialogActions>
      </Dialog>

      {/* NEW: Cover/Swap Request Management Dialog */}
      <Dialog open={isCoverRequestDialogOpen} onClose={() => setIsCoverRequestDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Manage Cover Request</DialogTitle>
        <DialogContent dividers>
            {selectedCoverRequest ? (
                <Box sx={{pt: 1}}>
                    <List dense>
                        <ListItem><ListItemText primary="Staff Member" secondary={selectedCoverRequest.requesterName || 'Unknown'} /></ListItem>
                        <ListItem><ListItemText primary="Shift Date" secondary={moment(selectedCoverRequest.slotDate).format('dddd, MMMM Do YYYY')} /></ListItem>
                        <ListItem><ListItemText primary="Time" secondary={`${moment(selectedCoverRequest.startTime, "HH:mm:ss").format("h:mm A")} - ${moment(selectedCoverRequest.endTime, "HH:mm:ss").format("h:mm A")}`} /></ListItem>
                        <ListItem><ListItemText primary="Role" secondary={selectedCoverRequest.role} /></ListItem>
                    </List>
                    <Typography variant="subtitle2" sx={{ mt: 2, color: 'text.secondary' }}>Worker's Note:</Typography>
                    <Paper variant="outlined" sx={{ p: 2, mt: 1, minHeight: '60px', bgcolor: 'grey.100' }}>
                        <Typography variant="body2" sx={{ fontStyle: selectedCoverRequest.note ? 'normal' : 'italic', color: selectedCoverRequest.note ? 'text.primary' : 'text.secondary' }}>
                            {selectedCoverRequest.note || "No note provided."}
                        </Typography>
                    </Paper>
                </Box>
            ) : <Skeleton variant="rectangular" height={200} />}
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setIsCoverRequestDialogOpen(false)} disabled={isActionLoading}>Cancel</Button>
            <Button onClick={handleRejectCoverRequest} variant="outlined" color="error" disabled={isActionLoading}>
              {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Reject Request'}
            </Button>
            <Button onClick={handleApproveCoverRequest} variant="contained" color="success" disabled={isActionLoading}>
              {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Approve Request'}
            </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog (Unchanged) */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit Shift</DialogTitle>
          <DialogContent dividers>
              {shiftToEdit && <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                  <TextField label="Date" type="date" value={moment(shiftToEdit.slots[0].date).format('YYYY-MM-DD')} onChange={e => setShiftToEdit(s => s && ({ ...s, slots: [{ ...s.slots[0], date: e.target.value }] }))} InputLabelProps={{ shrink: true }} fullWidth />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label="Start Time" type="time" value={shiftToEdit.slots[0].startTime.substring(0,5)} onChange={e => setShiftToEdit(s => s && ({ ...s, slots: [{ ...s.slots[0], startTime: e.target.value }] }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField label="End Time" type="time" value={shiftToEdit.slots[0].endTime.substring(0,5)} onChange={e => setShiftToEdit(s => s && ({ ...s, slots: [{ ...s.slots[0], endTime: e.target.value }] }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Box>
                  <FormControl fullWidth>
                      <InputLabel>Role Needed</InputLabel>
                      <Select value={shiftToEdit.roleNeeded ?? ''} label="Role Needed" onChange={e => setShiftToEdit(s => s && ({...s, roleNeeded: e.target.value}))}>
                          <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
                          <MenuItem value="INTERN">Intern</MenuItem>
                          <MenuItem value="TECHNICIAN">Technician</MenuItem>
                          <MenuItem value="ASSISTANT">Assistant</MenuItem>
                      </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Assign Staff Member</InputLabel>
                    <Select value={selectedUserForAssignment || ''} onChange={(e) => setSelectedUserForAssignment(e.target.value as number)} label="Assign Staff Member" disabled={!shiftToEdit.roleNeeded}>
                      {filteredMembers.length === 0 ? (
                        <MenuItem disabled value="">{shiftToEdit.roleNeeded ? "No staff for this role" : "Select a role first"}</MenuItem>
                      ) : (
                        filteredMembers.map(member => {
                          const displayName = (member.userDetails?.firstName || member.userDetails?.lastName) ? `${member.userDetails?.firstName || ''} ${member.userDetails?.lastName || ''}`.trim() : member.invitedName;
                          const employmentLabel = member.employmentType || 'N/A';
                          return (<MenuItem key={member.id} value={member.user}>{displayName} ({employmentLabel})</MenuItem>);
                        })
                      )}
                    </Select>
                  </FormControl>
              </Box>}
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setIsEditDialogOpen(false)} disabled={isActionLoading}>Cancel</Button>
              <Button onClick={handleSaveChanges} variant="contained" disabled={isActionLoading}>
                {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
              </Button>
          </DialogActions>
      </Dialog>
      
      {/* Escalate Dialog */}
      <Dialog
        open={isEscalateDialogOpen}
        onClose={() => {
          setIsEscalateDialogOpen(false);
          setEscalationLevel('');
        }}
        fullWidth
        maxWidth="xs"
      >
          <DialogTitle>Escalate Shift Visibility</DialogTitle>
          <DialogContent>
              <FormControl fullWidth sx={{mt: 1}}>
                  <InputLabel>New Visibility Level</InputLabel>
                  <Select
                    value={escalationLevel}
                    label="New Visibility Level"
                    onChange={e => setEscalationLevel(e.target.value)}
                    disabled={!selectableEscalationLevels.length}
                  >
                      {selectableEscalationLevels.length === 0 ? (
                        <MenuItem value="" disabled>No higher levels available</MenuItem>
                      ) : (
                        selectableEscalationLevels.map(level => (
                          <MenuItem key={level} value={level}>
                            {level.replace(/_/g, ' ')}
                          </MenuItem>
                        ))
                      )}
                  </Select>
              </FormControl>
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setIsEscalateDialogOpen(false)} disabled={isActionLoading}>Cancel</Button>
              <Button onClick={handleConfirmEscalation} variant="contained" disabled={isActionLoading || !escalationLevel}>
                {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Confirm & Unassign'}
              </Button>
          </DialogActions>
      </Dialog>

            <Snackbar
              open={snackbarOpen}
              onClose={closeSnackbar}
              message={snackbarMsg}
              autoHideDuration={4000}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              action={
                <IconButton size="small" color="inherit" onClick={closeSnackbar}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            />
      
    </Container>
  );
}













