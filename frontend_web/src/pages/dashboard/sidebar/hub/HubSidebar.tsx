import {
  Box,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import TagIcon from '@mui/icons-material/Tag';

import type {
  HubChemistTaskerHub,
  HubGroup,
  HubOrganization,
  HubPharmacy,
} from '../../../../types/hub';
interface InternalSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  chemisttaskerHubs: HubChemistTaskerHub[];
  pharmacies: HubPharmacy[];
  selectedPharmacyId: number | null;
  onPharmacyChange: (id: number) => void;
  communityGroups: HubGroup[];
  organizationGroups: HubGroup[];
  organizations: HubOrganization[];
  selectedViewId: number | string;
  onSelectView: (view: { type: 'home' | 'orgHome' | 'group' | 'orgGroup' | 'platformHome'; id: number | string }) => void;
  canCreateCommunityGroup: boolean;
  canCreateOrganizationGroup: boolean;
  onRequestCreateCommunityGroup: () => void;
  onRequestCreateOrganizationGroup: () => void;
  activeOrganizationId: number | null;
}

export function InternalSidebar({
  isOpen,
  toggleSidebar,
  chemisttaskerHubs,
  pharmacies,
  selectedPharmacyId,
  onPharmacyChange,
  communityGroups,
  organizationGroups,
  organizations,
  selectedViewId,
  onSelectView,
  canCreateCommunityGroup,
  canCreateOrganizationGroup,
  onRequestCreateCommunityGroup,
  onRequestCreateOrganizationGroup,
  activeOrganizationId,
}: InternalSidebarProps) {
  const drawerWidth = isOpen ? 380 : 80; // Match chat sidebar sizing
  const primaryOrganizationId = activeOrganizationId ?? (organizations[0]?.id ?? null);
  const sidebarHeight = {
    xs: 'calc(100vh - 48px)',
    md: 'calc(100vh - 64px)',
  } as const;

  return (
    <Drawer
      variant="permanent"
      open={isOpen}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        alignSelf: 'stretch',
        height: sidebarHeight,
        maxHeight: sidebarHeight,
        minHeight: sidebarHeight,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          position: 'relative',
          transition: (theme) => theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
          overflowX: 'hidden',
          overflowY: 'hidden',
          boxShadow: 3,
          borderRadius: 3,
          height: '100%',
          maxHeight: '100%',
          margin: 0,
          border: '1px solid',
          borderColor: 'grey.200',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%', // keep scroll area bounded by parent
          width: '100%',
        }}
      >
        {/* --- Top Section: Switcher and Collapse Button --- */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            pl: isOpen ? 1.5 : 0.75,
            gap: 1,
            width: '100%',
            flexShrink: 0,
          }}
        >
          {isOpen ? (
            <PharmacySwitcher
              pharmacies={pharmacies}
              selectedId={selectedPharmacyId}
              onChange={onPharmacyChange}
            />
          ) : null}
          <Tooltip title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <IconButton
              onClick={toggleSidebar}
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              size="small"
              sx={{ ml: isOpen ? 'auto' : 0, mr: isOpen ? 0 : 'auto' }}
            >
              {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* --- Scrollable Middle Section --- */}
        <Box sx={{ flexGrow: 1, width: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          {/* --- Home Button (Pharmacy) --- */}
          <ListItemButton
            onClick={() => onSelectView({ type: 'home', id: selectedPharmacyId || 'home' })}
            selected={selectedViewId === (selectedPharmacyId || 'home')}
            sx={{
              borderRadius: 1,
              mb: 1,
              justifyContent: isOpen ? 'flex-start' : 'center',
              '&.Mui-selected': {
                bgcolor: 'primary.light',
                color: 'primary.dark',
                '&:hover': { bgcolor: 'primary.light' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: isOpen ? 36 : 'auto', color: 'inherit' }}> {/* minWidth for icon alignment */}
              <HomeIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            {isOpen && <ListItemText primary="Pharmacy Home" primaryTypographyProps={{ fontWeight: 'medium' }} />}
          </ListItemButton>

          <Divider sx={{ my: 2, width: '100%' }} />

          {/* --- Community Groups --- */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            {isOpen && (
              <Typography variant="overline" color="text.secondary" sx={{ pl: 1 }}>
                Community Groups
              </Typography>
            )}
            <Tooltip
              title={
                canCreateCommunityGroup
                  ? 'Create community group'
                  : 'Only pharmacy admins can create groups'
              }
            >
              <span>
                <IconButton
                  onClick={onRequestCreateCommunityGroup}
                  size="small"
                  disabled={!canCreateCommunityGroup}
                  sx={{
                    color: 'grey.500',
                    '&:hover': { bgcolor: 'grey.100', color: 'grey.900' },
                    width: isOpen ? 'auto' : '100%',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                  }}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                  {!isOpen && <Typography variant="caption" sx={{ ml: 1, display: 'none' }}>Add</Typography>}
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <List dense disablePadding>
            {communityGroups.map((group) => (
              <ListItemButton
                key={group.id}
                onClick={() => onSelectView({ type: 'group', id: group.id })}
                selected={selectedViewId === group.id}
                title={group.name}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  '&.Mui-selected': {
                    bgcolor: 'grey.200',
                    fontWeight: 'medium',
                    color: 'grey.900',
                    '&:hover': { bgcolor: 'grey.200' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: isOpen ? 36 : 'auto', color: 'grey.400' }}>
                  <TagIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                {isOpen && (
                  <ListItemText primary={group.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
                )}
              </ListItemButton>
            ))}
          </List>

          <Divider sx={{ my: 2, width: '100%' }} />

          {/* --- Organization Home Button --- */}
          {organizations.length > 0 && primaryOrganizationId && (
            <ListItemButton
              onClick={() => onSelectView({ type: 'orgHome', id: primaryOrganizationId })}
              selected={selectedViewId === primaryOrganizationId}
              sx={{
                borderRadius: 1,
                mb: 1,
                justifyContent: isOpen ? 'flex-start' : 'center',
                '&.Mui-selected': {
                  bgcolor: 'info.light',
                  color: 'info.dark',
                  '&:hover': { bgcolor: 'info.light' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: isOpen ? 36 : 'auto', color: 'inherit' }}> {/* minWidth for icon alignment */}
                <BusinessCenterIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              {isOpen && <ListItemText primary="Organization Home" primaryTypographyProps={{ fontWeight: 'medium' }} />}
            </ListItemButton>
          )}

          {/* --- Organization Hub Groups --- */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: 2 }}>
            {isOpen && (
              <Typography variant="overline" color="text.secondary" sx={{ pl: 1 }}>
                Organization Hub
              </Typography>
            )}
            <Tooltip
              title={
                canCreateOrganizationGroup
                  ? 'Create organization group'
                  : 'Only organization admins can create groups'
              }
            >
              <span>
                <IconButton
                  onClick={onRequestCreateOrganizationGroup}
                  size="small"
                  disabled={!canCreateOrganizationGroup}
                  sx={{
                    color: 'grey.500',
                    '&:hover': { bgcolor: 'grey.100', color: 'grey.900' },
                    width: isOpen ? 'auto' : '100%',
                    justifyContent: isOpen ? 'flex-start' : 'center',
                  }}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                  {!isOpen && <Typography variant="caption" sx={{ ml: 1, display: 'none' }}>Add</Typography>}
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <List dense disablePadding>
            {organizationGroups.map((group) => (
              <ListItemButton
                key={group.id}
                onClick={() => onSelectView({ type: 'orgGroup', id: group.id })}
                selected={selectedViewId === group.id}
                title={group.name}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  '&.Mui-selected': {
                    bgcolor: 'grey.200',
                    fontWeight: 'medium',
                    color: 'grey.900',
                    '&:hover': { bgcolor: 'grey.200' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: isOpen ? 36 : 'auto', color: 'grey.400' }}>
                  <TagIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                {isOpen && (
                  <ListItemText primary={group.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
                )}
              </ListItemButton>
            ))}
          </List>

          {!!chemisttaskerHubs.length && (
            <>
              <Divider sx={{ my: 2, width: '100%' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                {isOpen && (
                  <Typography variant="overline" color="text.secondary" sx={{ pl: 1 }}>
                    ChemistTasker Hub
                  </Typography>
                )}
              </Box>

              <List dense disablePadding>
                {chemisttaskerHubs.map((hub) => (
                  <ListItemButton
                    key={hub.key}
                    onClick={() => onSelectView({ type: 'platformHome', id: hub.key })}
                    selected={selectedViewId === hub.key}
                    title={hub.label}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      justifyContent: isOpen ? 'flex-start' : 'center',
                      '&.Mui-selected': {
                        bgcolor: 'warning.light',
                        color: 'warning.dark',
                        '&:hover': { bgcolor: 'warning.light' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: isOpen ? 36 : 'auto', color: 'inherit' }}>
                      <GroupIcon sx={{ fontSize: 20 }} />
                    </ListItemIcon>
                    {isOpen && (
                      <ListItemText
                        primary={hub.label}
                        secondary={hub.audienceType.replace(/_/g, ' ')}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                      />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

// --- Pharmacy Switcher Dropdown ---
interface PharmacySwitcherProps {
  pharmacies: HubPharmacy[];
  selectedId: number | null;
  onChange: (id: number) => void;
}

function PharmacySwitcher({ pharmacies, selectedId, onChange }: PharmacySwitcherProps) {
  const selected = pharmacies.find((p) => p.id === selectedId);

  return (
    <FormControl fullWidth size="small">
      <InputLabel id="pharmacy-select-label">Pharmacy</InputLabel>
      <Select
        labelId="pharmacy-select-label"
        value={selectedId || ''}
        label="Pharmacy" // Ensure label prop matches InputLabel
        onChange={(e) => onChange(e.target.value as number)}
        renderValue={(_value) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', height: 24, width: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 1, bgcolor: 'primary.main', color: 'white', fontSize: '0.8rem' }}>
              {selected?.name.charAt(0)}
            </Box>
            <Typography variant="body2" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selected?.name}
            </Typography>
          </Box>
        )} // Renamed 'value' to '_value' to suppress unused variable warning
      >
        {pharmacies.map((pharmacy) => (
          <MenuItem key={pharmacy.id} value={pharmacy.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', height: 24, width: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 1, bgcolor: 'grey.200', fontSize: '0.8rem' }}>
                {pharmacy.name.charAt(0)}
              </Box>
              <Typography variant="body2">{pharmacy.name}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}



