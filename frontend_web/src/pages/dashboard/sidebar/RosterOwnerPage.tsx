import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Tabs,
  Tab,
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
  Paper,
  Chip
} from '@mui/material';

// Calendar Imports
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

const localizer = momentLocalizer(moment);

// --- Interfaces (Updated) ---
interface LeaveRequest {
  id: number;
  leave_type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
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
interface PharmacyMember { id: number; user: number; user_details: UserDetail; invited_name?: string; role: string; employment_type: string; }
interface ShiftForEdit { id: number; role_needed: string; slots: SlotDetail[]; }


// --- Constants for Roles, Colors, and Leave (Updated) ---
const ROLES = ['PHARMACIST', 'ASSISTANT', 'INTERN', 'TECHNICIAN'];
const ALL_STAFF = 'ALL';
const ROLE_COLORS: { [key: string]: string } = {
  PHARMACIST: '#3174ad',   // Blue
  ASSISTANT: '#4caf50',    // Green
  INTERN: '#ff9800',       // Orange
  TECHNICIAN: '#9c27b0',   // Purple
  LEAVE_PENDING: '#757575',// Grey for pending leave
  LEAVE_APPROVED: '#f44336',// Red for approved leave
  DEFAULT: '#757575',      // Grey
};
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
  const [pharmacyMembers, setPharmacyMembers] = useState<PharmacyMember[]>([]);
  
  // --- Loading States ---
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isDialogDataLoading, setIsDialogDataLoading] = useState(false);
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false); // General purpose for dialog actions

  // --- Calendar State ---
  const [calendarView, setCalendarView] = useState<string>('week');
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
  
  const [roleFilters, setRoleFilters] = useState<string[]>([ALL_STAFF]);

  // --- DATA LOADING ---
  useEffect(() => {
    const loadInitialData = async () => {
      setIsPageLoading(true);
      try {
        const pharmacyRes = await apiClient.get<Pharmacy[]>(API_ENDPOINTS.pharmacies);
        const loadedPharmacies = pharmacyRes.data;
        setPharmacies(loadedPharmacies);
        
        if (loadedPharmacies.length > 0) {
          const firstPharmacyId = loadedPharmacies[0].id;
          setSelectedPharmacyId(firstPharmacyId);
          const start = moment(calendarDate).startOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
          const end = moment(calendarDate).endOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
          // The RosterOwner endpoint now returns leave_request data automatically
          const assignmentsRes = await apiClient.get<Assignment[]>(`${API_ENDPOINTS.getRosterOwner}?pharmacy=${firstPharmacyId}&start_date=${start}&end_date=${end}`);
          setAssignments(assignmentsRes.data);
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
      const start = moment(calendarDate).startOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
      const end = moment(calendarDate).endOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
      loadAssignments(selectedPharmacyId, start, end);
  }

  const loadAssignments = async (pharmacyId: number, startDate?: string, endDate?: string) => {
    setIsAssignmentsLoading(true);
    try {
      const res = await apiClient.get<Assignment[]>(`${API_ENDPOINTS.getRosterOwner}?pharmacy=${pharmacyId}&start_date=${startDate}&end_date=${endDate}`);
      setAssignments(res.data);
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
      alert("Please ensure all fields are selected."); return;
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
      alert("Shift created and assigned successfully!");
      setIsAddAssignmentDialogOpen(false);
      reloadAssignments();
    } catch (err: any) { 
        alert(`Failed to create shift: ${err.response?.data?.detail || err.message}`); 
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
      alert("Assignment removed successfully.");
      setIsOptionsDialogOpen(false);
    } catch (err: any) { alert(`Error: ${err.response?.data?.detail || err.message}`); }
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
      alert("Shift updated successfully!");
      setIsEditDialogOpen(false);
      reloadAssignments();
    } catch (err: any) { alert(`Error updating shift: ${err.response?.data?.detail || err.message}`); }
    finally { setIsActionLoading(false); }
  };

  const handleConfirmEscalation = async () => {
    if (!selectedAssignment || !escalationLevel) {
        alert("Please select an escalation level.");
        return;
    };
    setIsActionLoading(true);
    try {
      await apiClient.patch(API_ENDPOINTS.rosterManageShift(selectedAssignment.shift), {
        visibility: escalationLevel
      });
      alert(`Shift escalated to ${escalationLevel.replace(/_/g, ' ')} and unassigned.`);
      setIsEscalateDialogOpen(false);
      reloadAssignments(); 
    } catch (err: any) { alert(`Error escalating shift: ${err.response?.data?.detail || err.message}`); }
    finally { setIsActionLoading(false); }
  };

  // --- NEW: Leave Request Handlers ---
  const handleApproveLeave = async () => {
    if (!selectedAssignment?.leave_request) return;
    setIsActionLoading(true);
    try {
        await apiClient.post(API_ENDPOINTS.approveLeaveRequest(selectedAssignment.leave_request.id));
        alert("Leave request has been approved.");
        setIsLeaveManageDialogOpen(false);
        reloadAssignments();
    } catch (err: any) {
        alert(`Failed to approve leave: ${err.response?.data?.detail || err.message}`);
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleRejectLeave = async () => {
      if (!selectedAssignment?.leave_request) return;
      setIsActionLoading(true);
      try {
          await apiClient.post(API_ENDPOINTS.rejectLeaveRequest(selectedAssignment.leave_request.id));
          alert("Leave request has been rejected.");
          setIsLeaveManageDialogOpen(false);
          reloadAssignments();
      } catch (err: any) {
          alert(`Failed to reject leave: ${err.response?.data?.detail || err.message}`);
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
    setSelectedUserForAssignment(null);
  };

  const handleSelectEvent = (event: { resource: Assignment }) => {
    const assignment = event.resource;
    setSelectedAssignment(assignment);

    // ** NEW LOGIC **
    // If there's a PENDING leave request, show the management dialog.
    // Otherwise, show the normal options dialog.
    if (assignment.leave_request && assignment.leave_request.status === 'PENDING') {
        setIsLeaveManageDialogOpen(true);
        setIsOptionsDialogOpen(false); // Ensure other dialog is closed
    } else {
        setIsOptionsDialogOpen(true);
        setIsLeaveManageDialogOpen(false); // Ensure other dialog is closed
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
    return assignments
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
  }, [assignments, roleFilters]);

  const eventStyleGetter = (event: any) => {
    const assignment = event.resource as Assignment;
    const role = assignment?.shift_detail?.role_needed;
    let backgroundColor = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || ROLE_COLORS.DEFAULT;

    // Override color for leave requests
    if (assignment?.leave_request) {
        if (assignment.leave_request.status === 'PENDING') {
            backgroundColor = ROLE_COLORS.LEAVE_PENDING;
        } else if (assignment.leave_request.status === 'APPROVED') {
            backgroundColor = ROLE_COLORS.LEAVE_APPROVED;
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
          <Typography variant="h5">Roster Calendar</Typography>
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
          onView={setCalendarView}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
        />
      </Box>

      {/* DIALOGS */}
      {/* Add Assignment Dialog (Unchanged) */}
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
              <FormControl fullWidth required>
                <InputLabel>Assign Staff Member</InputLabel>
                <Select value={selectedUserForAssignment || ''} onChange={(e) => setSelectedUserForAssignment(e.target.value as number)} label="Assign Staff Member" disabled={!newShiftRoleNeeded}>
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
            onClick={handleCreateShiftAndAssign} 
            variant="contained" 
            color="primary"
            disabled={isCreatingShift}
          >
            {isCreatingShift ? <CircularProgress size={24} color="inherit" /> : 'Create & Assign'}
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
            <Button variant="outlined" disabled={isActionLoading} color="secondary" onClick={() => { setIsOptionsDialogOpen(false); setEscalationLevel(selectedAssignment?.shift_detail.visibility || ''); setIsEscalateDialogOpen(true); }}>Escalate Shift</Button>
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
      
      {/* Escalate Dialog (Unchanged) */}
      <Dialog open={isEscalateDialogOpen} onClose={() => setIsEscalateDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Escalate Shift Visibility</DialogTitle>
          <DialogContent>
              <FormControl fullWidth sx={{mt: 1}}>
                  <InputLabel>New Visibility Level</InputLabel>
                  <Select value={escalationLevel} label="New Visibility Level" onChange={e => setEscalationLevel(e.target.value)}>
                      {(selectedAssignment?.shift_detail.allowed_escalation_levels || []).map(level => <MenuItem key={level} value={level}>{level.replace(/_/g, ' ')}</MenuItem>)}
                  </Select>
              </FormControl>
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setIsEscalateDialogOpen(false)} disabled={isActionLoading}>Cancel</Button>
              <Button onClick={handleConfirmEscalation} variant="contained" disabled={isActionLoading}>
                {isActionLoading ? <CircularProgress size={24} color="inherit" /> : 'Confirm & Unassign'}
              </Button>
          </DialogActions>
      </Dialog>
    </Container>
  );
}