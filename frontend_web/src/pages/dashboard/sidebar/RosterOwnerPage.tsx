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
  ListItemText
} from '@mui/material';

// Calendar Imports
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

const localizer = momentLocalizer(moment);

// --- Interfaces ---
interface Pharmacy { id: number; name: string; }
interface UserDetail { id: number; first_name: string; last_name: string; email: string; role: string; }
interface SlotDetail { id: number; date: string; start_time: string; end_time: string; }
interface ShiftDetail { id: number; pharmacy_name: string; role_needed: string; visibility: string; }
interface Assignment { id: number; slot_date: string; user: number; slot: number; shift: number; user_detail: UserDetail; slot_detail: SlotDetail; shift_detail: ShiftDetail; }
interface PharmacyMember { id: number; user: number; user_details: UserDetail; invited_name?: string; role: string; employment_type: string; }
interface ShiftForEdit { id: number; role_needed: string; slots: SlotDetail[]; }

export default function RosterOwnerPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pharmacyMembers, setPharmacyMembers] = useState<PharmacyMember[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingPharmacies, setLoadingPharmacies] = useState(true);
  const [loadingDialogData, setLoadingDialogData] = useState(false);
  const [calendarView, setCalendarView] = useState<string>('week');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // State for Creating new shifts
  const [isAddAssignmentDialogOpen, setIsAddAssignmentDialogOpen] = useState(false);
  const [dialogShiftStartTime, setDialogShiftStartTime] = useState<string | null>(null);
  const [dialogShiftEndTime, setDialogShiftEndTime] = useState<string | null>(null);
  const [dialogShiftDate, setDialogShiftDate] = useState<string | null>(null);
  const [newShiftRoleNeeded, setNewShiftRoleNeeded] = useState<string>('');
  
  // State for Managing existing assignments
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<number | null>(null);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEscalateDialogOpen, setIsEscalateDialogOpen] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<ShiftForEdit | null>(null);
  const [filteredMembers, setFilteredMembers] = useState<PharmacyMember[]>([]);
  const [escalationLevel, setEscalationLevel] = useState<string>('');
  const escalationLevels = ['FULL_PART_TIME', 'LOCUM_CASUAL', 'OWNER_CHAIN', 'ORG_CHAIN', 'PLATFORM'];

  // --- DATA LOADING ---
  useEffect(() => {
    const loadPageData = async () => {
      setLoadingPharmacies(true);
      try {
        const res = await apiClient.get<Pharmacy[]>(API_ENDPOINTS.pharmacies);
        setPharmacies(res.data);
        if (res.data.length > 0 && !selectedPharmacyId) {
          setSelectedPharmacyId(res.data[0].id);
        }
      } catch (err) { console.error("Failed to load pharmacies", err); }
      finally { setLoadingPharmacies(false); }
    };
    loadPageData();
  }, []);

  useEffect(() => {
    if (selectedPharmacyId) { reloadAssignments(); }
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

  // --- API CALLS ---
  const reloadAssignments = () => {
      if (!selectedPharmacyId) return;
      const start = moment(calendarDate).startOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
      const end = moment(calendarDate).endOf(calendarView as moment.unitOfTime.StartOf).format('YYYY-MM-DD');
      loadAssignments(selectedPharmacyId, start, end);
  }

  const loadAssignments = async (pharmacyId: number, startDate?: string, endDate?: string) => {
    setLoadingAssignments(true);
    try {
      const res = await apiClient.get(`${API_ENDPOINTS.getRosterOwner}?pharmacy=${pharmacyId}&start_date=${startDate}&end_date=${endDate}`);
      setAssignments(res.data);
    } catch (err) { console.error("Failed to load roster assignments", err); }
    finally { setLoadingAssignments(false); }
  };

  const loadMembersForRoster = async (pharmacyId: number) => {
    setLoadingDialogData(true);
    try {
      const res = await apiClient.get<PharmacyMember[]>(`${API_ENDPOINTS.getRosterOwner}members-for-roster/?pharmacy_id=${pharmacyId}`);
      setPharmacyMembers(res.data);
    } catch (err) { console.error("Failed to load pharmacy members", err); }
    finally { setLoadingDialogData(false); }
  };

  const handleCreateShiftAndAssign = async () => {
    if (!selectedPharmacyId || !newShiftRoleNeeded || !dialogShiftDate || !dialogShiftStartTime || !dialogShiftEndTime || !selectedUserForAssignment) {
      alert("Please ensure all fields are selected."); return;
    }
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
    } catch (err: any) { alert(`Failed to create shift: ${err.response?.data?.detail || err.message}`); }
  };
  
  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;
    if (!window.confirm("Are you sure you want to remove this assignment?")) return;
    try {
      await apiClient.delete(API_ENDPOINTS.rosterDeleteAssignment(selectedAssignment.id));
      setAssignments(prev => prev.filter(a => a.id !== selectedAssignment.id));
      alert("Assignment removed successfully.");
      setIsOptionsDialogOpen(false);
    } catch (err: any) { alert(`Error: ${err.response?.data?.detail || err.message}`); }
  };

  const handleSaveChanges = async () => {
    if (!shiftToEdit) return;
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
  };

  const handleConfirmEscalation = async () => {
    if (!selectedAssignment || !escalationLevel) {
        alert("Please select an escalation level.");
        return;
    };
    try {
      await apiClient.patch(API_ENDPOINTS.rosterManageShift(selectedAssignment.shift), {
        visibility: escalationLevel
      });
      alert(`Shift escalated to ${escalationLevel.replace(/_/g, ' ')} and unassigned.`);
      setIsEscalateDialogOpen(false);
      reloadAssignments(); 
    } catch (err: any) { alert(`Error escalating shift: ${err.response?.data?.detail || err.message}`); }
  };
  
  // --- UI HANDLERS ---
  const handleSelectSlot = (slotInfo: { start: Date, end: Date }) => {
    setIsAddAssignmentDialogOpen(true);
    setDialogShiftDate(moment(slotInfo.start).format('YYYY-MM-DD'));
    setDialogShiftStartTime(moment(slotInfo.start).format('HH:mm'));
    setDialogShiftEndTime(moment(slotInfo.end).format('HH:mm'));
    setNewShiftRoleNeeded('');
    setSelectedUserForAssignment(null);
  };

  const handleSelectEvent = (event: { resource: Assignment }) => {
    setSelectedAssignment(event.resource);
    setIsOptionsDialogOpen(true);
  };
  
  const handleNewShiftRoleChange = (event: SelectChangeEvent<string>) => {
    setNewShiftRoleNeeded(event.target.value);
  };

  const calendarEvents = useMemo(() => {
    return assignments.map(a => ({
      id: a.id,
      title: `${a.user_detail.first_name} (${a.shift_detail.role_needed})`,
      start: moment(`${a.slot_date} ${a.slot_detail.start_time}`).toDate(),
      end: moment(`${a.slot_date} ${a.slot_detail.end_time}`).toDate(),
      allDay: false,
      resource: a
    }));
  }, [assignments]);


  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Internal Roster</Typography>

      {loadingPharmacies ? <Skeleton variant="rectangular" height={200} /> : (
        <>
          <Tabs value={selectedPharmacyId} onChange={(_, val) => setSelectedPharmacyId(val as number)} sx={{ mb: 3 }} textColor="primary" indicatorColor="primary">
            {pharmacies.map(p => <Tab key={p.id} label={p.name} value={p.id} />)}
          </Tabs>
          
          <Typography variant="h5" sx={{mb: 2}}>Roster Calendar</Typography>
          <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>Click an empty time slot to create a new shift, or click an existing assignment to manage it.</Typography>

          {loadingAssignments ? <Skeleton variant="rectangular" height={500} /> : (
            <Box sx={{ height: 700 }}>
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                defaultView={calendarView as any}
                views={['month', 'week', 'day']}
                date={calendarDate}
                onNavigate={setCalendarDate}
                onView={setCalendarView}
                selectable
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
              />
            </Box>
          )}
        </>
      )}

      {/* DIALOGS */}
      <Dialog open={isAddAssignmentDialogOpen} onClose={() => setIsAddAssignmentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Shift and Assign</DialogTitle>
        <DialogContent dividers>
          {loadingDialogData ? ( <Skeleton variant="rectangular" height={150} /> ) : (
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
          <Button onClick={() => setIsAddAssignmentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateShiftAndAssign} variant="contained" color="primary">Create & Assign</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={isOptionsDialogOpen} onClose={() => setIsOptionsDialogOpen(false)}>
        <DialogTitle>Manage Assignment</DialogTitle>
        <DialogContent>
            {selectedAssignment && <List>
                <ListItem><ListItemText primary="Staff" secondary={`${selectedAssignment.user_detail.first_name} ${selectedAssignment.user_detail.last_name}`} /></ListItem>
                <ListItem><ListItemText primary="Date & Time" secondary={`${selectedAssignment.slot_date} @ ${moment(selectedAssignment.slot_detail.start_time, "HH:mm:ss").format("h:mm A")}`} /></ListItem>
            </List>}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', p: 2, gap: 1}}>
            <Button variant="outlined" onClick={() => { setIsOptionsDialogOpen(false); setIsEditDialogOpen(true); setShiftToEdit({ id: selectedAssignment!.shift, role_needed: selectedAssignment!.shift_detail.role_needed, slots: [selectedAssignment!.slot_detail] }); setSelectedUserForAssignment(selectedAssignment!.user); }}>Edit Shift / Re-Assign</Button>
            <Button variant="outlined" color="secondary" onClick={() => { setIsOptionsDialogOpen(false); setEscalationLevel(selectedAssignment?.shift_detail.visibility || ''); setIsEscalateDialogOpen(true); }}>Escalate Shift</Button>
            <Button variant="contained" color="error" onClick={handleDeleteAssignment}>Delete Assignment</Button>
            <Button onClick={() => setIsOptionsDialogOpen(false)} sx={{mt: 1}}>Cancel</Button>
        </DialogActions>
      </Dialog>

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
              <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveChanges} variant="contained">Save Changes</Button>
          </DialogActions>
      </Dialog>
      
      <Dialog open={isEscalateDialogOpen} onClose={() => setIsEscalateDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Escalate Shift Visibility</DialogTitle>
          <DialogContent>
              <FormControl fullWidth sx={{mt: 1}}>
                  <InputLabel>New Visibility Level</InputLabel>
                  <Select value={escalationLevel} label="New Visibility Level" onChange={e => setEscalationLevel(e.target.value)}>
                      {escalationLevels.map(level => <MenuItem key={level} value={level}>{level.replace(/_/g, ' ')}</MenuItem>)}
                  </Select>
              </FormControl>
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setIsEscalateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleConfirmEscalation} variant="contained">Confirm & Unassign</Button>
          </DialogActions>
      </Dialog>
    </Container>
  );
}