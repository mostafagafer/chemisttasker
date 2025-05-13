import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  Typography,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Button,
  Alert,
} from '@mui/material';
import apiClient from '../../utils/apiClient';
import { API_ENDPOINTS } from '../../constants/api';

interface FormData {
  username: string;
  phone_number: string;
  government_id: File | null;
  role_type: string;
  interests: string[];
  referee1_email: string;
  referee2_email: string;
  short_bio: string;
  resume: File | null;
}

const ROLE_CHOICES = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'CAREER_SWITCHER', label: 'Career Switcher' },
];
const INTERESTS = ['Shadowing','Volunteering','Placement','Junior Assistant Role'];

export default function ExplorerOnboarding() {
  const detailUrl = API_ENDPOINTS.onboardingDetail('explorer');
  const createUrl = API_ENDPOINTS.onboardingCreate('explorer');

  const [data, setData] = useState<FormData>({
    username: '',
    phone_number: '',
    government_id: null,
    role_type: '',
    interests: [],
    referee1_email: '',
    referee2_email: '',
    short_bio: '',
    resume: null,
  });
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    apiClient.get(detailUrl)
      .then(res => { setData(res.data); setProfileExists(true); })
      .catch(err => { if(err.response?.status!==404) setError(err.response?.data?.detail||err.message); })
      .finally(() => setLoading(false));
  }, [detailUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };
  const handleFile = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null; setData(prev=>({ ...prev, [field]: file }));
  };
  const handleInterest = (val: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setData(prev=>({
      ...prev,
      interests: e.target.checked ? [...prev.interests,val] : prev.interests.filter(x=>x!==val)
    }));
  };
  const handleTabChange = (_: any, idx: number) => setTabIndex(idx);
  const handleSubmit = async(e:React.FormEvent)=>{
    e.preventDefault(); setLoading(true); setError(''); setSuccess(false);
    try{ const form=new FormData(); Object.entries(data).forEach(([k,v])=>{ if(v==null)return; if(v instanceof File) form.append(k,v); else form.append(k,typeof v==='object'?JSON.stringify(v):String(v)); }); await apiClient.request({ method:profileExists?'put':'post', url:profileExists?detailUrl:createUrl,data:form,headers:{'Content-Type':'multipart/form-data'} }); setSuccess(true); setProfileExists(true);}catch(err:any){ setError(err.response?.data?.detail||err.message);}finally{ setLoading(false);}  };
  if(loading) return <Typography>Loading…</Typography>;
  const panels=[
    <Box sx={{p:2}} key="basic">
      <Typography variant="h6">Basic Info</Typography>
            {/* Username */}
            <TextField
              fullWidth
              margin="normal"
              label="Username"
              name="username"
              value={data.username}
              onChange={handleChange}
              required
            />
      <TextField fullWidth margin="normal" label="Phone Number" name="phone_number" value={data.phone_number} onChange={handleChange} required />
      <Button variant="outlined" component="label">Upload ID<input hidden type="file" accept="image/*,.pdf" onChange={handleFile('government_id')} /></Button>
      <TextField select fullWidth margin="normal" label="Role" name="role_type" value={data.role_type} onChange={handleChange} required>
        {ROLE_CHOICES.map(c=><MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
      </TextField>
    </Box>,
    <Box sx={{p:2}} key="interests">
      <Typography variant="h6">Interests</Typography>
      <FormGroup>
        {INTERESTS.map(i=><FormControlLabel key={i} control={<Checkbox checked={data.interests.includes(i)} onChange={handleInterest(i)} />} label={i}/>)}
      </FormGroup>
    </Box>,
    <Box sx={{p:2}} key="refs">
      <Typography variant="h6">References</Typography>
      <TextField fullWidth margin="normal" label="Referee 1 Email" name="referee1_email" value={data.referee1_email} onChange={handleChange} required />
      <TextField fullWidth margin="normal" label="Referee 2 Email" name="referee2_email" value={data.referee2_email} onChange={handleChange} required />
    </Box>,
    <Box sx={{p:2}} key="profile">
      <Typography variant="h6">Profile</Typography>
      <TextField fullWidth multiline rows={4} margin="normal" label="Short Bio" name="short_bio" value={data.short_bio} onChange={handleChange} />
      <Button variant="outlined" component="label">Upload Resume<input hidden type="file" accept="image/*,.pdf" onChange={handleFile('resume')} /></Button>
    </Box>
  ];
  const labels=['Basic Info','Interests','References','Profile'];
  return (
    <Container maxWidth="md">
      <Paper sx={{p:3,mt:4}} elevation={3}>
        {error&&<Alert severity="error">{error}</Alert>}
        {success&&<Alert severity="success">Saved!</Alert>}
        <Box sx={{display:'flex',justifyContent:'center',borderBottom:1,borderColor:'divider',mb:3}}>
          <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile textColor="secondary" indicatorColor="secondary" sx={{width:'auto'}}>
            {labels.map((l,i)=><Tab key={i} label={l}/>)}
          </Tabs>
        </Box>
        <Box component="form" onSubmit={handleSubmit}>
          {panels[tabIndex]}
          <Box sx={{display:'flex',justifyContent:'space-between',mt:2}}>
            <Button disabled={tabIndex===0} onClick={()=>setTabIndex(i=>i-1)}>Back</Button>
            {tabIndex<labels.length-1 ? <Button onClick={()=>setTabIndex(i=>i+1)}>Next</Button> : <Button type="submit">Submit</Button>}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}