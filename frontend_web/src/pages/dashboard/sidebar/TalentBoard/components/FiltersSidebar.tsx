import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { TalentFilterConfig, EngagementType } from '../types';
import { ENGAGEMENT_LABELS } from '../constants';

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ borderBottom: '1px solid', borderColor: 'grey.100', pb: 2.5, mb: 2.5 }}>
    <Typography
      sx={{
        textTransform: 'uppercase',
        color: 'text.secondary',
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 1,
        mb: 1.5,
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

const toggleList = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const toggleListTyped = (list: EngagementType[], value: EngagementType) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const FiltersSidebar: React.FC<{
  filters: TalentFilterConfig;
  onChange: (next: TalentFilterConfig) => void;
  roleOptions: string[];
  stateOptions: string[];
}> = ({ filters, onChange, roleOptions, stateOptions }) => {
  return (
    <Box sx={{ px: 2.5, py: 2 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search role or pitch..."
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <FilterSection title="Role Type">
        <Stack spacing={1}>
          {roleOptions.map((role) => (
            <FormControlLabel
              key={role}
              control={
                <Checkbox
                  checked={filters.roles.includes(role)}
                  onChange={() => onChange({ ...filters, roles: toggleList(filters.roles, role) })}
                />
              }
              label={role}
            />
          ))}
        </Stack>
      </FilterSection>

      <FilterSection title="Engagement Type">
        <Stack spacing={1}>
          {(Object.keys(ENGAGEMENT_LABELS) as EngagementType[]).map((value) => (
            <FormControlLabel
              key={value}
              control={
                <Checkbox
                  checked={filters.engagementTypes.includes(value)}
                  onChange={() =>
                    onChange({ ...filters, engagementTypes: toggleListTyped(filters.engagementTypes, value) })
                  }
                />
              }
              label={ENGAGEMENT_LABELS[value]}
            />
          ))}
        </Stack>
      </FilterSection>

      <FilterSection title="Location (State)">
        <Stack spacing={1}>
          {stateOptions.map((state) => (
            <FormControlLabel
              key={state}
              control={
                <Checkbox
                  checked={filters.states.includes(state)}
                  onChange={() => onChange({ ...filters, states: toggleList(filters.states, state) })}
                />
              }
              label={state}
            />
          ))}
        </Stack>
      </FilterSection>

      <Button
        variant="outlined"
        fullWidth
        onClick={() => onChange({ search: '', roles: [], states: [], engagementTypes: [] })}
      >
        Clear Filters
      </Button>
    </Box>
  );
};

export default FiltersSidebar;
