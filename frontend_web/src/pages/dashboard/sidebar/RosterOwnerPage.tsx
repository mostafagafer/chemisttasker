import { useState, useEffect, useMemo } from 'react';
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

import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { ROSTER_COLORS } from '../../../constants/rosterColors';

const localizer = momentLocalizer(moment);

// --- Interfaces (Updated) ---
interface LeaveRequest {
  id: number;
  leave_type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface Pharmacy { id: number; name: string; }
interface UserDetail { id: number; first_name: string; last_name: string; email: string; role: string; }
interface SlotDetail { id: number; date: string; start_time: string; end_time: string; }
interface ShiftDetail { id: number; pharmacy_name: string; role_needed: string; visibility: string; allowed_escalation_levels: string[]; }
interface Assignment {
  id: number;
  slot_date: string;
  user: number;
  slot: number;
  shift: number;
  user_detail: UserDetail;
  slot_detail: SlotDetail;
  shift_detail: ShiftDetail;
  leave_request: LeaveRequest | null; // Added leave_request
}

// NEW: Interface for an open shift (unassigned, community-visible)
interface OpenShift {
  id: number;
  pharmacy: number;
  role_needed: string;
  slots: SlotDetail[]; // An open shift can have slots
  description: string;
  // Add other relevant fields from ShiftSerializer if needed
  // For calendar rendering, we mainly need role, and slot details.
}


// NEW: Interface for worker shift requests
interface WorkerShiftRequest {
  id: number;
  pharmacy: number;
  requester_name: string;
  role: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  note: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_PUBLISHED';
}
interface PharmacyMember { id: number; user: number; user_details: UserDetail; invited_name?: string; role: string; employment_type: string; }
interface ShiftForEdit { id: number; role_needed: string; slots: SlotDetail[]; }


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
  // --- Component State ---
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]); // NEW: State for open shifts
  const [workerRequests, setWorkerRequests] = useState<WorkerShiftRequest[]>([]); // NEW: State for cover requests
  const [pharmacyMembers, setPharmacyMembers] = useState<PharmacyMember[]>([]);
  
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
  
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<number | null>(null);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEscalateDialogOpen, setIsEscalateDialogOpen] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<ShiftForEdit | null>(null);
  const [filteredMembers, setFilteredMembers] = useState<PharmacyMember[]>([]);
  const [escalationLevel, setEscalationLevel] = useState<string>('');
  const [isLeaveManageDialogOpen, setIsLeaveManageDialogOpen] = useState(false); // New dialog state
  const currentShiftDetail = selectedAssignment?.shift_detail;
  const selectableEscalationLevels = useMemo(() => {
    if (!currentShiftDetail) return [];
    const allowed = currentShiftDetail.allowed_escalation_levels || [];
    if (!allowed.length) return [];

    const canonicalOrder = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'];
    const allowedSet = new Set(allowed);
    const ordered = canonicalOrder.filter(level => allowedSet.has(level));
    const extras = allowed.filter(level => !canonicalOrder.includes(level));
    const sequence = [...ordered, ...extras];

    const currentIndex = sequence.indexOf(currentShiftDetail.visibility);
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
        const pharmacyRes = await apiClient.get<PaginatedResponse<Pharmacy>>(API_ENDPOINTS.pharmacies);

        const loadedPharmacies = pharmacyRes.data.results || [];

        setPharmacies(loadedPharmacies);
        
        if (loadedPharmacies.length > 0) {
          const firstPharmacyId = loadedPharmacies[0].id;
          setSelectedPharmacyId(firstPharmacyId);
          const { start, end } = getDateRangeForView(calendarDate, calendarView);
          const startDate = start.format('YYYY-MM-DD');
          const endDate = end.format('YYYY-MM-DD');
          // Fetch assignments
          const assignmentsRes = await apiClient.get<PaginatedResponse<Assignment>>(`${API_ENDPOINTS.getRosterOwner}?pharmacy=${firstPharmacyId}&start_date=${startDate}&end_date=${endDate}`);
          setAssignments(assignmentsRes.data.results || []);
          // NEW: Fetch worker shift requests
          const requestsRes = await apiClient.get<PaginatedResponse<WorkerShiftRequest>>(`${API_ENDPOINTS.workerShiftRequests}?pharmacy=${firstPharmacyId}&start_date=${startDate}&end_date=${endDate}`);
          setWorkerRequests(requestsRes.data.results || []);
          // FIX: Use the correct endpoint for owner's open shifts
          const openShiftsRes = await apiClient.get<PaginatedResponse<OpenShift>>(`${API_ENDPOINTS.ownerOpenShifts}?pharmacy=${firstPharmacyId}&start_date=${startDate}&end_date=${endDate}`);
          const openShiftData = Array.isArray(openShiftsRes.data) ? openShiftsRes.data : openShiftsRes.data?.results ?? [];
          setOpenShifts(openShiftData as OpenShift[]);

        }
      } catch (err) { 
        console.error("Failed to load initial page data", err); 
      } finally {
        setIsPageLoading(false);
      }
    };
    loadInitialData();
  }, []); // Note: empty dependency array ensures this runs only once on mount.

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
    const role = isEditDialogOpen ? shiftToEdit?.role_needed : newShiftRoleNeeded;
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
      const [assignmentsRes, requestsRes, openShiftsRes] = await Promise.all([
        apiClient.get<PaginatedResponse<Assignment>>(`${API_ENDPOINTS.getRosterOwner}?pharmacy=${pharmacyId}&start_date=${startDate}&end_date=${endDate}`),
        apiClient.get<PaginatedResponse<WorkerShiftRequest>>(`${API_ENDPOINTS.workerShiftRequests}?pharmacy=${pharmacyId}&start_date=${startDate}&end_date=${endDate}`),
        // FIX: Use the correct endpoint for owner's open shifts
        apiClient.get<PaginatedResponse<OpenShift>>(`${API_ENDPOINTS.ownerOpenShifts}?pharmacy=${pharmacyId}&start_date=${startDate}&end_date=${endDate}`)
      ]);
      setAssignments(assignmentsRes.data.results || []);
      setWorkerRequests(requestsRes.data.results || []);
      const openShiftData = Array.isArray(openShiftsRes.data) ? openShiftsRes.data : openShiftsRes.data?.results ?? [];
      setOpenShifts(openShiftData as OpenShift[]);
    } catch (err) { console.error("Failed to load roster assignments", err); }
    finally { setIsAssignmentsLoading(false); }
  };

  const loadMembersForRoster = async (pharmacyId: number) => {
    setIsDialogDataLoading(true);
    try {
      const res = await apiClient.get<PharmacyMember[]>(`${API_ENDPOINTS.getRosterOwner}members-for-roster/?pharmacy_id=${pharmacyId}`);
      setPharmacyMembers(res.data);
    } catch (err) { console.error("Failed to load pharmacy members", err); }
    finally { setIsDialogDataLoading(false); }
  };

  const handleCreateShiftAndAssign = async () => {
    if (!selectedPharmacyId || !newShiftRoleNeeded || !dialogShiftDate || !dialogShiftStartTime || !dialogShiftEndTime || !selectedUserForAssignment) {
      showSnackbar("Please ensure all fields are selected."); return;
    }
    setIsCreatingShift(true);
    try {
      await apiClient.post(API_ENDPOINTS.createShiftAndAssign, {
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
      await apiClient.delete(API_ENDPOINTS.rosterDeleteAssignment(selectedAssignment.id));
      setAssignments(prev => prev.filter(a => a.id !== selectedAssignment.id));
      showSnackbar("Assignment removed successfully.");
      setIsOptionsDialogOpen(false);
    } catch (err: any) { showSnackbar(`Error: ${err.response?.data?.detail || err.message}`); }
    finally { setIsActionLoading(false); }
  };

  const handleSaveChanges = async () => {
    if (!shiftToEdit) return;
    setIsActionLoading(true);
    const payload: any = {
      role_needed: shiftToEdit.role_needed,
      slots: shiftToEdit.slots.map(({ id, date, start_time, end_time }) => ({ id, date, start_time, end_time }))
    };
    if (selectedUserForAssignment) {
      payload.user_id = selectedUserForAssignment;
    }
    try {
      await apiClient.patch(API_ENDPOINTS.rosterManageShift(shiftToEdit.id), payload);
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
    setIsActionLoading(true);
    try {
      const res = await apiClient.post(
        API_ENDPOINTS.rosterEscalateShift(selectedAssignment.shift),
        { target_visibility: escalationLevel }
      );
      const detail =
        res?.data?.detail ||
        `Shift escalated to ${escalationLevel.replace(/_/g, ' ')}.`;
      showSnackbar(detail);
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
    if (!selectedAssignment?.leave_request) return;
    setIsActionLoading(true);
    try {
        await apiClient.post(API_ENDPOINTS.approveLeaveRequest(selectedAssignment.leave_request.id));
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
      if (!selectedAssignment?.leave_request) return;
      setIsActionLoading(true);
      try {
          await apiClient.post(API_ENDPOINTS.rejectLeaveRequest(selectedAssignment.leave_request.id));
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
      await apiClient.post(API_ENDPOINTS.createOpenShift, {
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
      await apiClient.post(`${API_ENDPOINTS.workerShiftRequests}${selectedCoverRequest.id}/approve/`); // This will now create an open shift
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
      await apiClient.post(`${API_ENDPOINTS.workerShiftRequests}${selectedCoverRequest.id}/reject/`);
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
      const tempAssignment = {
        ...item.originalShift,
        id: `open-${item.originalShift.id}`, // A unique ID for the event
        shift: item.originalShift.id,
        slot: item.originalShift.slots[0].id,
        slot_date: item.originalShift.slots[0].date,
        slot_detail: item.originalShift.slots[0],
        shift_detail: { // This was missing
          ...item.shift_detail,
          allowed_escalation_levels: [], // Provide a default empty array
        },
        user_detail: { first_name: 'Open', last_name: 'Shift' } };
      setSelectedAssignment(tempAssignment as any);
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
    if (item.leave_request && item.leave_request.status === 'PENDING') {
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
    // Map regular assignments
    const assignmentEvents = assignments
      .filter(a => {
        if (roleFilters.includes(ALL_STAFF)) {
            return true;
        }
        return roleFilters.includes(a.shift_detail.role_needed);
      })
      .map(a => {
        let title = `${a.user_detail.first_name} (${a.shift_detail.role_needed.substring(0,3)})`;
        // Add leave status to title
        if (a.leave_request) {
            title = `${title} (Leave: ${a.leave_request.status})`;
        }
        return ({
            id: a.id,
            title: title,
            start: moment(`${a.slot_date} ${a.slot_detail.start_time}`).toDate(),
            end: moment(`${a.slot_date} ${a.slot_detail.end_time}`).toDate(),
            allDay: false,
            resource: a
        });
    });

    // NEW: Map worker cover requests
    const requestEvents = workerRequests
      .filter(req => req.status === 'PENDING') // Only show pending requests
      .map(req => ({
        id: `cover-${req.id}`,
        title: `${req.requester_name} (Cover Request)`,
        start: moment(`${req.slot_date} ${req.start_time}`).toDate(),
        end: moment(`${req.slot_date} ${req.end_time}`).toDate(),
        allDay: false,
        resource: {
          isCoverRequest: true,
          originalRequest: req,
          shift_detail: { role_needed: req.role } // For filtering
        }
      }));

    // NEW: Map owner-created open shifts
    const openShiftEvents = openShifts
      .filter(shift => {
        if (roleFilters.includes(ALL_STAFF)) return true;
        return roleFilters.includes(shift.role_needed);
      })
      .flatMap(shift =>
        shift.slots.map(slot => ({
            id: `open-${shift.id}-${slot.id}`,
            title: `OPEN: ${shift.role_needed}`,
            start: moment(`${slot.date} ${slot.start_time}`).toDate(),
            end: moment(`${slot.date} ${slot.end_time}`).toDate(),
            allDay: false,
            resource: {
              isOpenShift: true,
              originalShift: shift, // Keep original data for context
              shift_detail: { role_needed: shift.role_needed } // For filtering and styling
            }
          }))
    );

    return [...assignmentEvents, ...requestEvents, ...openShiftEvents];
  }, [assignments, workerRequests, openShifts, roleFilters]);

  const eventStyleGetter = (event: any) => {
    const assignment = event.resource;
    const role = assignment?.shift_detail?.role_needed;

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
    if (assignment?.leave_request) {
        if (assignment.leave_request.status === 'PENDING') {
            backgroundColor = ROSTER_COLORS.LEAVE_PENDING;
        } else if (assignment.leave_request.status === 'APPROVED') {
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

      <Tabs value={selectedPharmacyId} onChange={(_, val) => setSelectedPharmacyId(val as number)} sx={{ mb: 3 }} textColor="primary" indicatorColor="primary">
        {pharmacies.map(p => <Tab key={p.id} label={p.name} value={p.id} />)}
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
                      const displayName = (member.user_details.first_name || member.user_details.last_name) ? `${member.user_details.first_name || ''} ${member.user_details.last_name || ''}`.trim() : member.invited_name;
                      return (<MenuItem key={member.id} value={member.user}>{displayName} ({member.employment_type})</MenuItem>);
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
                <ListItem><ListItemText primary="Staff" secondary={`${selectedAssignment.user_detail.first_name} ${selectedAssignment.user_detail.last_name}`} /></ListItem>
                <ListItem><ListItemText primary="Date & Time" secondary={`${selectedAssignment.slot_date} @ ${moment(selectedAssignment.slot_detail.start_time, "HH:mm:ss").format("h:mm A")}`} /></ListItem>
                {selectedAssignment.leave_request?.status === 'APPROVED' &&
                  <ListItem><Chip label="LEAVE APPROVED" color="error" size="small" /></ListItem>
                }
            </List>}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', p: 2, gap: 1}}>
            <Button variant="outlined" disabled={isActionLoading} onClick={() => { setIsOptionsDialogOpen(false); setIsEditDialogOpen(true); setShiftToEdit({ id: selectedAssignment!.shift, role_needed: selectedAssignment!.shift_detail.role_needed, slots: [selectedAssignment!.slot_detail] }); setSelectedUserForAssignment(selectedAssignment!.user); }}>Edit Shift / Re-Assign</Button>
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
            {selectedAssignment && selectedAssignment.leave_request ? (
                <Box sx={{pt: 1}}>
                    <List dense>
                        <ListItem><ListItemText primary="Staff Member" secondary={`${selectedAssignment.user_detail.first_name} ${selectedAssignment.user_detail.last_name}`} /></ListItem>
                        <ListItem><ListItemText primary="Shift Date" secondary={moment(selectedAssignment.slot_date).format('dddd, MMMM Do YYYY')} /></ListItem>
                        <ListItem><ListItemText primary="Leave Type" secondary={LEAVE_TYPES_MAP[selectedAssignment.leave_request.leave_type] || selectedAssignment.leave_request.leave_type} /></ListItem>
                    </List>
                    <Typography variant="subtitle2" sx={{ mt: 2, color: 'text.secondary' }}>Worker's Note:</Typography>
                    <Paper variant="outlined" sx={{ p: 2, mt: 1, minHeight: '60px', bgcolor: 'grey.100' }}>
                        <Typography variant="body2" sx={{ fontStyle: selectedAssignment.leave_request.note ? 'normal' : 'italic', color: selectedAssignment.leave_request.note ? 'text.primary' : 'text.secondary' }}>
                            {selectedAssignment.leave_request.note || "No note provided."}
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
                        <ListItem><ListItemText primary="Staff Member" secondary={selectedCoverRequest.requester_name} /></ListItem>
                        <ListItem><ListItemText primary="Shift Date" secondary={moment(selectedCoverRequest.slot_date).format('dddd, MMMM Do YYYY')} /></ListItem>
                        <ListItem><ListItemText primary="Time" secondary={`${moment(selectedCoverRequest.start_time, "HH:mm:ss").format("h:mm A")} - ${moment(selectedCoverRequest.end_time, "HH:mm:ss").format("h:mm A")}`} /></ListItem>
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
                    <TextField label="Start Time" type="time" value={shiftToEdit.slots[0].start_time.substring(0,5)} onChange={e => setShiftToEdit(s => s && ({ ...s, slots: [{ ...s.slots[0], start_time: e.target.value }] }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField label="End Time" type="time" value={shiftToEdit.slots[0].end_time.substring(0,5)} onChange={e => setShiftToEdit(s => s && ({ ...s, slots: [{ ...s.slots[0], end_time: e.target.value }] }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Box>
                  <FormControl fullWidth>
                      <InputLabel>Role Needed</InputLabel>
                      <Select value={shiftToEdit.role_needed} label="Role Needed" onChange={e => setShiftToEdit(s => s && ({...s, role_needed: e.target.value}))}>
                          <MenuItem value="PHARMACIST">Pharmacist</MenuItem>
                          <MenuItem value="INTERN">Intern</MenuItem>
                          <MenuItem value="TECHNICIAN">Technician</MenuItem>
                          <MenuItem value="ASSISTANT">Assistant</MenuItem>
                      </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Assign Staff Member</InputLabel>
                    <Select value={selectedUserForAssignment || ''} onChange={(e) => setSelectedUserForAssignment(e.target.value as number)} label="Assign Staff Member" disabled={!shiftToEdit.role_needed}>
                      {filteredMembers.length === 0 ? (
                        <MenuItem disabled value="">{shiftToEdit.role_needed ? "No staff for this role" : "Select a role first"}</MenuItem>
                      ) : (
                        filteredMembers.map(member => {
                          const displayName = (member.user_details.first_name || member.user_details.last_name) ? `${member.user_details.first_name || ''} ${member.user_details.last_name || ''}`.trim() : member.invited_name;
                          return (<MenuItem key={member.id} value={member.user}>{displayName} ({member.employment_type})</MenuItem>);
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
