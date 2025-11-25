// LogoutPage.tsx

import React from 'react'; import { Typography } from '@mui/material';

import { useNavigate } from 'react-router-dom';
export default function LogoutPage() {
  const nav = useNavigate();
  React.useEffect(() => { /* clear auth here */ nav('/login'); }, []);
  return <Typography>Logging out…</Typography>;
}
