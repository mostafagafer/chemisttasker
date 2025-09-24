import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Skeleton,
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
  Button,
  CircularProgress,
  SelectChangeEvent,
  ListItemText,
  List,
  ListItem,
  Tabs,
  Tab,
  Checkbox,
  OutlinedInput
} from '@mui/material';

// Calendar Imports
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext'; // Using the corrected path

const localizer = momentLocalizer(moment);

// --- Interfaces ---
interface Pharmacy {
  id: number;
  name: string;
}
interface UserDetail { id: number; first_name: string; last_name: string; email: string; }
interface SlotDetail { id: number; date: string; start_time: string; end_time: string; }
interface ShiftDetail { id: number; pharmacy_name: string; role_needed: string; visibility: string; }
interface LeaveRequest {
  id: number;
  leave_type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
}
interface Assignment {
  id: number;
  slot_date: string;
  user: number;
  slot: number;
  shift: number;
  user_detail: UserDetail;
  slot_detail: SlotDetail;
  shift_detail: ShiftDetail;
  leave_request: LeaveRequest | null;
}
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// --- Constants ---
const ROLES = ['PHARMACIST', 'ASSISTANT', 'INTERN', 'TECHNICIAN'];
const ALL_STAFF = 'ALL';

const ROLE_COLORS: { [key: string]: string } = {
  PHARMACIST: '#3174ad', // Blue
  ASSISTANT: '#4caf50',  // Green
  INTERN: '#ff9800',     // Orange
  TECHNICIAN: '#9c27b0', // Purple
  LEAVE_PENDING: '#757575', // Grey for pending leave
  LEAVE_APPROVED: '#f44336', // Red for approved leave (as it's a blocked day)
  DEFAULT: '#757575',
};

const LEAVE_TYPES = [
    { value: 'SICK', label: 'Sick Leave' },
    { value: 'ANNUAL', label: 'Annual Leave' },
    { value: 'COMPASSIONATE', label: 'Compassionate Leave' },
    { value: 'STUDY', label: 'Study Leave' },
    { value: 'CARER', label: 'Carer\'s Leave' },
    { value: 'UNPAID', label: 'Unpaid Leave' },
    { value: 'OTHER', label: 'Other' },
];


// --- Skeleton Component for Unified Loading ---
const RosterPageSkeleton = () => (
    <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom><Skeleton width="30%" /></Typography>
        <Skeleton variant="rectangular" height={48} sx={{ mb: 3 }} />
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
            <Typography variant="h5"><Skeleton width="200px" /></Typography>
            <Skeleton variant="rectangular" width={300} height={56} />
        </Box>
        <Typography variant="body2"><Skeleton width="80%" /></Typography>
        <Skeleton variant="rectangular" height={600} sx={{ mt: 2 }} />
    </Container>
);

// --- Main Component ---
export default function RosterWorkerPage() {
  const { user } = useAuth();
  const currentUserId = user?.id;

  // --- Component State ---
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  
  // --- Loading States ---
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Calendar State ---
  const [calendarView, setCalendarView] = useState<string>('week'); // FIX: Changed to string to match Owner page and fix type errors
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // --- Dialogs and Forms State ---
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [leaveType, setLeaveType] = useState('');
  const [leaveNote, setLeaveNote] = useState('');
  
  // --- Filter State ---
  const [roleFilters, setRoleFilters] = useState<string[]>([ALL_STAFF]);

  // --- DATA LOADING ---
  useEffect(() => {
    const loadInitialData = async () => {
      if (!currentUserId) return;
      setIsPageLoading(true);
      try {
  const pharmacyRes = await apiClient.get<Pharmacy[]>(`${API_ENDPOINTS.getRosterWorker}pharmacies/`);
  const loadedPharmacies = pharmacyRes.data || [];
  setPharmacies(loadedPharmacies);
  
  if (loadedPharmacies.length > 0) {
    setSelectedPharmacyId(loadedPharmacies[0].id);
  }



      } catch (err) { 
        console.error("Failed to load initial page data", err); 
      } finally {
        setIsPageLoading(false);
      }
    };
    
    loadInitialData();
  }, [currentUserId, calendarDate, calendarView]);


  useEffect(() => {
    if (!isPageLoading && selectedPharmacyId) {
      reloadAssignments();
    }
  }, [selectedPharmacyId, calendarDate, calendarView]);

  const reloadAssignments = async () => {
    if (!selectedPharmacyId) return;
    setIsAssignmentsLoading(true);
    const start = moment(calendarDate).startOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
    const end = moment(calendarDate).endOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
    
    try {
      const res = await apiClient.get<PaginatedResponse<Assignment>>(`${API_ENDPOINTS.getRosterWorker}?pharmacy=${selectedPharmacyId}&start_date=${start}&end_date=${end}`);
      setAllAssignments(res.data.results || []);
    } catch (err) { 
      console.error("Failed to load roster assignments", err); 
    } finally {
      setIsAssignmentsLoading(false);
    }
  };

  // --- UI HANDLERS ---
  const handleSelectEvent = (event: { resource: Assignment }) => {
    const assignment = event.resource;
    
    if (assignment.user !== currentUserId) {
      return; 
    }

    setSelectedAssignment(assignment);
    
    if (assignment.leave_request?.status !== 'APPROVED') {
        setIsLeaveDialogOpen(true);
        setLeaveType(assignment.leave_request?.leave_type || '');
        setLeaveNote(assignment.leave_request?.note || '');
    } else {
        alert("A leave request for this shift has already been approved.");
    }
  };

  const handleSubmitLeaveRequest = async () => {
    if (!selectedAssignment || !leaveType) {
        alert("Please select a leave type.");
        return;
    }
    if (selectedAssignment.user !== currentUserId) {
        alert("You can only request leave for your own assigned slots.");
        return;
    }
    setIsSubmitting(true);
    try {
        await apiClient.post(API_ENDPOINTS.createLeaveRequest, {
            slot_assignment: selectedAssignment.id,
            leave_type: leaveType,
            note: leaveNote,
        });
        alert("Leave request submitted successfully.");
        setIsLeaveDialogOpen(false);
        reloadAssignments();
    } catch (err: any) {
        alert(`Failed to submit leave request: ${err.response?.data?.detail || err.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRoleFilterChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    // FIX: Logic now exactly matches RosterOwnerPage
    if (value[value.length - 1] === ALL_STAFF || value.length === 0) {
        setRoleFilters([ALL_STAFF]);
    } else {
        setRoleFilters(value.filter(v => v !== ALL_STAFF));
    }
  };
  
  // --- MEMOIZED CALENDAR EVENTS ---
  const calendarEvents = useMemo(() => {
    // This now filters based on the `allAssignments` fetched for the selected pharmacy
    return allAssignments
      .filter(a => {
        // FIX: Filtering logic now exactly matches RosterOwnerPage
        if (roleFilters.includes(ALL_STAFF)) {
            return true;
        }
        return roleFilters.includes(a.shift_detail.role_needed);
      })
      .map(a => {
        let title = `${a.user_detail.first_name} ${a.user_detail.last_name}`;
        if (a.leave_request) {
            title = `${title} (Leave: ${a.leave_request.status})`;
        }
        return {
            id: a.id,
            title: title,
            start: moment(`${a.slot_date} ${a.slot_detail.start_time}`).toDate(),
            end: moment(`${a.slot_date} ${a.slot_detail.end_time}`).toDate(),
            allDay: false,
            resource: a
        };
    });
  }, [allAssignments, roleFilters]);

  // --- DYNAMIC EVENT STYLING ---
  const eventStyleGetter = (event: { resource: Assignment }) => {
    const assignment = event.resource;
    let backgroundColor = ROLE_COLORS[assignment.shift_detail.role_needed] || ROLE_COLORS.DEFAULT;

    if (assignment.leave_request) {
        if(assignment.leave_request.status === 'PENDING') {
            backgroundColor = ROLE_COLORS.LEAVE_PENDING;
        } else if (assignment.leave_request.status === 'APPROVED') {
            backgroundColor = ROLE_COLORS.LEAVE_APPROVED;
        }
    }
    
    const isMyShift = assignment.user === currentUserId;

    const style = {
        backgroundColor,
        borderRadius: '5px',
        opacity: isMyShift ? 0.8 : 0.5,
        color: 'white',
        border: '0px',
        display: 'block',
        cursor: isMyShift ? 'pointer' : 'not-allowed',
    };
    return { style };
  };

  // --- RENDER LOGIC ---
  if (isPageLoading) {
    return <RosterPageSkeleton />;
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>My Roster</Typography>

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

      <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>This calendar shows all shifts at the selected pharmacy. You can only interact with your own shifts to request leave.</Typography>

      <Box sx={{ position: 'relative', '.rbc-calendar': { height: 'auto', minHeight: '800px' } }}>
        {isAssignmentsLoading && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                <CircularProgress />
            </Box>
        )}

        <Calendar
          localizer={localizer}
          events={calendarEvents}
          defaultView={calendarView as any} // FIX: Cast to any to match Owner page
          view={calendarView as any}
          date={calendarDate}
          onNavigate={setCalendarDate}
          onView={setCalendarView} // FIX: Pass setter directly
          selectable={false} // Workers cannot create new shifts from the calendar
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
        />
      </Box>

      {/* Leave Request Dialog */}
      <Dialog open={isLeaveDialogOpen} onClose={() => setIsLeaveDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Request Leave</DialogTitle>
        <DialogContent dividers>
          {selectedAssignment ? (
            <>
                <List dense>
                    <ListItem><ListItemText primary="Pharmacy" secondary={selectedAssignment.shift_detail.pharmacy_name} /></ListItem>
                    <ListItem><ListItemText primary="Date" secondary={moment(selectedAssignment.slot_date).format('dddd, MMMM Do YYYY')} /></ListItem>
                    <ListItem><ListItemText primary="Time" secondary={`${moment(selectedAssignment.slot_detail.start_time, "HH:mm:ss").format("h:mm A")} - ${moment(selectedAssignment.slot_detail.end_time, "HH:mm:ss").format("h:mm A")}`} /></ListItem>
                </List>
                 {selectedAssignment.leave_request && (
                    <Typography variant="h6" color="primary" sx={{ my: 2, p: 1, borderRadius: 1, bgcolor: 'primary.lighter' }}>
                        Existing Request Status: {selectedAssignment.leave_request.status}
                    </Typography>
                )}
                <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <FormControl fullWidth required>
                        <InputLabel>Leave Type</InputLabel>
                        <Select value={leaveType} onChange={(e: SelectChangeEvent) => setLeaveType(e.target.value)} label="Leave Type">
                            {LEAVE_TYPES.map(lt => (
                                <MenuItem key={lt.value} value={lt.value}>{lt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Note (Optional)"
                        multiline
                        rows={3}
                        value={leaveNote}
                        onChange={(e) => setLeaveNote(e.target.value)}
                        fullWidth
                    />
                </Box>
            </>
          ) : <Skeleton variant="rectangular" height={200}/>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsLeaveDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmitLeaveRequest} variant="contained" color="primary" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
