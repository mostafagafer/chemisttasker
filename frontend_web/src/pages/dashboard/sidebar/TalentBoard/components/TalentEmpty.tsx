import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { PersonOutline as PersonOutlineIcon } from '@mui/icons-material';

const TalentEmpty: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <Box sx={{ textAlign: 'center', py: 10, border: '1px dashed', borderColor: 'grey.300', borderRadius: 3, bgcolor: 'background.paper' }}>
    <PersonOutlineIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
    <Typography variant="h6" sx={{ mb: 1 }}>No talent found</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Try adjusting your filters.
    </Typography>
    <Button variant="outlined" onClick={onReset}>Reset Filters</Button>
  </Box>
);

export default TalentEmpty;
