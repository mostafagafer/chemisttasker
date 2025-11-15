﻿import React, { useState, useMemo, useEffect, useCallback, useRef, ChangeEvent } from 'react';

// MUI Components
import {
  Box,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListSubheader,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  FormHelperText,
  Select,
  MenuItem,
  Card,
  CardMedia,
  CardContent,
  CircularProgress,
  Alert,
  Avatar,
  Stack,
  Chip,
  Menu,
  Tooltip,
  Paper,
  InputBase,
  Checkbox,
  Autocomplete,
  LinearProgress,
} from '@mui/material';

// MUI Icons
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeIcon from '@mui/icons-material/Home';
import TagIcon from '@mui/icons-material/Tag'; // Using TagIcon for Hash
import CloseIcon from '@mui/icons-material/Close'; // For X
import GroupIcon from '@mui/icons-material/Group'; // For Users

// Unused MUI imports (removed to clean up warnings)
// import AccordionSummary from '@mui/material/AccordionSummary';
// import AccordionDetails from '@mui/material/AccordionDetails';

// API and Types
import {
  fetchHubContext,
  createHubGroup,
  fetchHubPosts,
  createHubPost,
  updateHubPost,
  deleteHubPost,
  fetchHubPolls,
  createHubPoll,
  voteHubPoll,
  reactToHubPost,
  updateHubGroup,
  deleteHubGroup,
  updatePharmacyHubProfile,
  updateOrganizationHubProfile,
  fetchPharmacyGroupMembers,
  fetchOrganizationGroupMembers,
  fetchHubGroup,
} from '../../../../api/hub';
import {
  HubContext,
  HubPharmacy,
  HubGroup,
  HubOrganization,
  HubScopeSelection,
  HubPost,
  HubPostPayload,
  HubAttachment,
  HubPoll,
  HubReactionType,
  HubGroupMemberOption,
  HubGroupPayload,
} from '../../../../types/hub';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import BarChartIcon from '@mui/icons-material/BarChart';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CancelIcon from '@mui/icons-material/Cancel';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

type GroupModalScope =
  | { type: 'pharmacy'; pharmacyId: number }
  | { type: 'organization'; organizationId: number };

type GroupModalMode = 'create' | 'edit';

type ActiveGroupModal = {
  title: string;
  scope: GroupModalScope;
  mode: GroupModalMode;
  group?: HubGroup;
};

// --- Main HubPage Component ---
export default function HubPage() {
  const [hubContext, setHubContext] = useState<HubContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<{ type: 'home' | 'orgHome' | 'group' | 'orgGroup'; id: number | string }>({ type: 'home', id: 'home' });
  const [isInternalSidebarOpen, setIsInternalSidebarOpen] = useState(true);
  const [groupModal, setGroupModal] = useState<ActiveGroupModal | null>(null);
  const [pharmacyProfileModalOpen, setPharmacyProfileModalOpen] = useState(false);
  const [organizationProfileModalOpen, setOrganizationProfileModalOpen] = useState(false);

  // Fetch Hub Context on component mount
  useEffect(() => {
    const getHubContext = async () => {
      try {
        setLoading(true);
        const data = await fetchHubContext();
        setHubContext(data);
        if (data.defaultPharmacyId) {
          setSelectedPharmacyId(data.defaultPharmacyId);
          setSelectedView({ type: 'home', id: data.defaultPharmacyId });
        } else if (data.pharmacies.length > 0) {
          setSelectedPharmacyId(data.pharmacies[0].id);
          setSelectedView({ type: 'home', id: data.pharmacies[0].id });
        } else if (data.defaultOrganizationId) {
          setSelectedView({ type: 'orgHome', id: data.defaultOrganizationId });
        } else if (data.organizations.length > 0) {
          setSelectedView({ type: 'orgHome', id: data.organizations[0].id });
        }
      } catch (err) {
        console.error('Failed to fetch hub context:', err);
        setError('Failed to load hub data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    getHubContext();
  }, []);

  const pharmacies = useMemo(() => hubContext?.pharmacies || [], [hubContext]);
  const communityGroups = useMemo(() => hubContext?.communityGroups || [], [hubContext]);
  const organizationGroups = useMemo(() => hubContext?.organizationGroups || [], [hubContext]);
  const organizations = useMemo(() => hubContext?.organizations || [], [hubContext]);

  const selectedPharmacy = useMemo(
    () => pharmacies.find((p) => p.id === selectedPharmacyId),
    [selectedPharmacyId, pharmacies]
  );

  const selectedOrganization = useMemo(() => {
    if (!organizations.length) {
      return null;
    }
    if (selectedView.type === 'orgHome' || selectedView.type === 'orgGroup') {
      const targetId =
        typeof selectedView.id === 'number'
          ? selectedView.id
          : Number(selectedView.id);
      const match = organizations.find((org) => org.id === targetId);
      if (match) {
        return match;
      }
    }
    return organizations[0] ?? null;
  }, [organizations, selectedView]);

  const filteredOrganizationGroups = useMemo(() => {
    if (!selectedOrganization) return organizationGroups;
    return organizationGroups.filter((group) => group.organizationId === selectedOrganization.id);
  }, [organizationGroups, selectedOrganization]);

  const currentPharmacyDetails = useMemo(() => {
    if (selectedView.type === 'home' && selectedPharmacy) {
      return {
        id: selectedPharmacy.id,
        coverImage: selectedPharmacy.coverImageUrl || 'https://placehold.co/1200x300/6D28D9/FFFFFF?text=Pharmacy+Cover',
        about: selectedPharmacy.about || 'No description available.',
        name: selectedPharmacy.name,
        canManageProfile: selectedPharmacy.canManageProfile,
        canCreatePost: selectedPharmacy.canCreatePost,
      };
    }
    return null;
  }, [selectedView, selectedPharmacy]);

  const currentOrganizationDetails = useMemo(() => {
    if (selectedView.type === 'orgHome' && organizations.length > 0) {
      const org = organizations.find(o => o.id === selectedView.id) || organizations[0];
      return {
        name: org.name,
        coverImage: org.coverImageUrl || 'https://placehold.co/1200x300/16a34a/FFFFFF?text=Organization+Cover',
        about: org.about || 'No description available.',
        id: org.id,
        canManageProfile: org.canManageProfile,
        canCreatePost: true,
      };
    }
    return null;
  }, [selectedView, organizations]);

  const canCreateCommunityGroup = Boolean(selectedPharmacy?.canCreateGroup);
  const canCreateOrganizationGroup = Boolean(selectedOrganization?.canManageProfile);
  const canManagePharmacyProfile = Boolean(selectedPharmacy?.canManageProfile);
  const canManageOrganizationProfile = Boolean(selectedOrganization?.canManageProfile);
  const canPharmacyPost = Boolean(selectedPharmacy?.canCreatePost);

  const openPharmacyProfileModal = useCallback(() => {
    if (selectedPharmacy) {
      setPharmacyProfileModalOpen(true);
    }
  }, [selectedPharmacy]);

  const openOrganizationProfileModal = useCallback(() => {
    if (selectedOrganization) {
      setOrganizationProfileModalOpen(true);
    }
  }, [selectedOrganization]);

  const closePharmacyProfileModal = useCallback(() => setPharmacyProfileModalOpen(false), []);
  const closeOrganizationProfileModal = useCallback(() => setOrganizationProfileModalOpen(false), []);
  const handlePharmacyChange = useCallback((id: number) => {
    setSelectedPharmacyId(id);
    setSelectedView({ type: 'home', id });
  }, []);
  const pharmacyMembersLoader = useCallback(() => {
    if (!selectedPharmacyId) {
      return Promise.resolve<HubGroupMemberOption[]>([]);
    }
    return fetchPharmacyGroupMembers(selectedPharmacyId);
  }, [selectedPharmacyId]);

  const organizationMembersLoader = useCallback(() => {
    if (!selectedOrganization?.id) {
      return Promise.resolve<HubGroupMemberOption[]>([]);
    }
    return fetchOrganizationGroupMembers(selectedOrganization.id);
  }, [selectedOrganization?.id]);

  const openCommunityGroupModal = useCallback(() => {
    if (!selectedPharmacyId || !canCreateCommunityGroup) {
      return;
    }
    setGroupModal({
      title: 'Create New Community Group',
      scope: { type: 'pharmacy', pharmacyId: selectedPharmacyId },
      mode: 'create',
    });
  }, [canCreateCommunityGroup, selectedPharmacyId]);

  const openOrganizationGroupModal = useCallback(() => {
    if (!selectedOrganization || !canCreateOrganizationGroup) {
      return;
    }
    setGroupModal({
      title: 'Create New Organization Group',
      scope: { type: 'organization', organizationId: selectedOrganization.id },
      mode: 'create',
    });
  }, [canCreateOrganizationGroup, selectedOrganization]);

  const closeGroupModal = useCallback(() => setGroupModal(null), []);

  const handleCreateGroupSubmit = useCallback(
    async (values: GroupModalFormValues, scope: GroupModalScope) => {
      const trimmedName = values.name.trim();
      if (!trimmedName) return;
      try {
        const payload: HubGroupPayload = {
          pharmacyId:
            scope.type === 'pharmacy'
              ? scope.pharmacyId
              : (() => {
                  const host = pharmacies.find(
                    (pharmacy) => pharmacy.organizationId === scope.organizationId,
                  );
                  if (!host) {
                    throw new Error('No pharmacy is linked to this organization yet.');
                  }
                  return host.id;
                })(),
          name: trimmedName,
        };
        if (scope.type === 'organization') {
          payload.organizationId = scope.organizationId;
        }
        const descriptionValue = values.description.trim();
        if (descriptionValue) {
          payload.description = descriptionValue;
        }
        if (values.memberIds.length) {
          payload.memberIds = values.memberIds;
        }
        const newGroup = await createHubGroup(payload);
        setHubContext((prev) => {
          if (!prev) return prev;
          if (scope.type === 'organization') {
            return {
              ...prev,
              organizationGroups: [...prev.organizationGroups, newGroup],
            };
          }
          return {
            ...prev,
            communityGroups: [...prev.communityGroups, newGroup],
          };
        });
        closeGroupModal();
        setSelectedView(
          scope.type === 'organization'
            ? { type: 'orgGroup', id: newGroup.id }
            : { type: 'group', id: newGroup.id },
        );
      } catch (err) {
        console.error('Failed to create hub group:', err);
        setError(
          scope.type === 'organization'
            ? 'Failed to create organization group.'
            : 'Failed to create community group.',
        );
      }
    },
    [pharmacies, closeGroupModal, setHubContext, setSelectedView, setError],
  );

  const handleRequestEditGroup = useCallback(
    async (group: HubGroup) => {
      try {
        const detailed = await fetchHubGroup(group.id, { includeMembers: true });
        const scope: GroupModalScope = detailed.organizationId
          ? { type: 'organization', organizationId: detailed.organizationId }
          : { type: 'pharmacy', pharmacyId: detailed.pharmacyId };
        setGroupModal({
          title: `Edit ${detailed.name}`,
          scope,
          mode: 'edit',
          group: detailed,
        });
      } catch (err) {
        console.error('Failed to load group details:', err);
        setError('Failed to load group details. Please try again.');
      }
    },
    [setError],
  );

  const handleEditGroupSubmit = useCallback(
    async (group: HubGroup, values: GroupModalFormValues) => {
      try {
        const payload: Partial<HubGroupPayload> = {
          name: values.name.trim(),
          description: values.description.trim() ? values.description.trim() : null,
          memberIds: values.memberIds,
        };
        const updatedGroup = await updateHubGroup(group.id, payload, { includeMembers: true });
        setHubContext((prev) =>
          prev
            ? {
                ...prev,
                communityGroups: prev.communityGroups.map((item) =>
                  item.id === updatedGroup.id ? updatedGroup : item,
                ),
                organizationGroups: prev.organizationGroups.map((item) =>
                  item.id === updatedGroup.id ? updatedGroup : item,
                ),
              }
            : prev,
        );
        closeGroupModal();
      } catch (err) {
        console.error('Failed to update group:', err);
        setError('Failed to update group. Please try again.');
      }
    },
    [closeGroupModal, setError, setHubContext],
  );

  const handleDeleteGroup = useCallback(
    async (group: HubGroup) => {
      const confirmed = window.confirm(`Delete the "${group.name}" group? This cannot be undone.`);
      if (!confirmed) return;
      try {
        await deleteHubGroup(group.id);
        setHubContext((prev) =>
          prev
            ? {
                ...prev,
                communityGroups: prev.communityGroups.filter((item) => item.id !== group.id),
                organizationGroups: prev.organizationGroups.filter((item) => item.id !== group.id),
              }
            : prev,
        );
        if (groupModal?.group?.id === group.id) {
          closeGroupModal();
        }
        if (selectedView.type === 'group' && selectedView.id === group.id) {
          setSelectedView({ type: 'home', id: group.pharmacyId });
        } else if (selectedView.type === 'orgGroup' && selectedView.id === group.id) {
          setSelectedView({
            type: 'orgHome',
            id: group.organizationId ?? (organizations[0]?.id ?? 'orgHome'),
          });
        }
      } catch (err) {
        console.error('Failed to delete group:', err);
        setError('Failed to delete group. Please try again.');
      }
    },
    [organizations, selectedView, groupModal, closeGroupModal],
  );

  const handlePharmacyProfileSaved = useCallback((updatedPharmacy: HubPharmacy) => {
    setHubContext(prev =>
      prev
        ? {
            ...prev,
            pharmacies: prev.pharmacies.map((pharmacy) =>
              pharmacy.id === updatedPharmacy.id ? updatedPharmacy : pharmacy,
            ),
          }
        : prev,
    );
  }, []);

  const handleOrganizationProfileSaved = useCallback((updatedOrg: HubOrganization) => {
    setHubContext(prev =>
      prev
        ? {
            ...prev,
            organizations: prev.organizations.map((org) =>
              org.id === updatedOrg.id ? updatedOrg : org,
            ),
          }
        : prev,
    );
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Hub...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        minHeight: '100%',
        bgcolor: 'grey.50',
        fontFamily: 'Inter',
        gap: { xs: 2, lg: 3 },
        alignItems: 'stretch',
      }}
    >
      {/* --- Internal Collapsible Sidebar --- */}
      <InternalSidebar
        isOpen={isInternalSidebarOpen}
        toggleSidebar={() => setIsInternalSidebarOpen(!isInternalSidebarOpen)}
        pharmacies={pharmacies}
        selectedPharmacyId={selectedPharmacyId}
        onPharmacyChange={handlePharmacyChange}
        communityGroups={communityGroups}
        organizationGroups={filteredOrganizationGroups}
        selectedViewId={selectedView.id}
        onSelectView={setSelectedView}
        canCreateCommunityGroup={canCreateCommunityGroup}
        canCreateOrganizationGroup={canCreateOrganizationGroup}
        onRequestCreateCommunityGroup={openCommunityGroupModal}
        onRequestCreateOrganizationGroup={openOrganizationGroupModal}
        organizations={organizations}
        activeOrganizationId={selectedOrganization?.id ?? null}
      />

      {/* --- Content Area --- */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          overflowY: 'auto',
          px: { xs: 1.5, md: 3 },
          py: { xs: 1.5, md: 3 },
          transition: 'all 300ms ease-in-out',
          bgcolor: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {selectedView.type === 'home' && currentPharmacyDetails ? (
          <HomePageContent
            details={currentPharmacyDetails}
            onOpenSettings={canManagePharmacyProfile ? openPharmacyProfileModal : undefined}
            canCreatePost={canPharmacyPost}
            scope={{ type: 'pharmacy', id: currentPharmacyDetails.id }}
            membersLoader={pharmacyMembersLoader}
          />
        ) : selectedView.type === 'orgHome' && currentOrganizationDetails ? (
          <OrgHomePageContent
            details={currentOrganizationDetails}
            onOpenSettings={canManageOrganizationProfile ? openOrganizationProfileModal : undefined}
            canCreatePost={currentOrganizationDetails.canCreatePost}
            scope={{ type: 'organization', id: currentOrganizationDetails.id }}
            membersLoader={organizationMembersLoader}
          />
        ) : selectedView.type === 'group' ? (
          <GroupContent
            pharmacy={selectedPharmacy}
            group={communityGroups.find((g) => g.id === selectedView.id)}
            scope={{ type: 'group', id: selectedView.id as number }}
            onEditGroup={handleRequestEditGroup}
            onDeleteGroup={handleDeleteGroup}
          />
        ) : selectedView.type === 'orgGroup' ? (
          <OrgGroupContent
            group={organizationGroups.find((g) => g.id === selectedView.id)}
            scope={{ type: 'group', id: selectedView.id as number }}
            onEditGroup={handleRequestEditGroup}
            onDeleteGroup={handleDeleteGroup}
          />
        ) : (
          <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            Please select a pharmacy, organization, or group from the sidebar.
          </Typography>
        )}
      </Box>

      {/* --- Create/Edit Group Modal --- */}
      {groupModal && (
        <CreateGroupModal
          title={groupModal.title}
          scope={groupModal.scope}
          mode={groupModal.mode}
          onClose={closeGroupModal}
          onSubmit={(values) => {
            if (groupModal.mode === 'edit' && groupModal.group) {
              handleEditGroupSubmit(groupModal.group, values);
            } else {
              handleCreateGroupSubmit(values, groupModal.scope);
            }
          }}
          pharmacies={pharmacies}
          initialGroup={groupModal.group}
        />
      )}

      {pharmacyProfileModalOpen && selectedPharmacy && (
        <PharmacyProfileModal
          open={pharmacyProfileModalOpen}
          pharmacy={selectedPharmacy}
          onClose={closePharmacyProfileModal}
          onSaved={handlePharmacyProfileSaved}
        />
      )}
      {organizationProfileModalOpen && selectedOrganization && (
        <OrganizationProfileModal
          open={organizationProfileModalOpen}
          organization={selectedOrganization}
          onClose={closeOrganizationProfileModal}
          onSaved={handleOrganizationProfileSaved}
        />
      )}
    </Box>
  );
}

// --- Internal Sidebar Component ---
interface InternalSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  pharmacies: HubPharmacy[];
  selectedPharmacyId: number | null;
  onPharmacyChange: (id: number) => void;
  communityGroups: HubGroup[];
  organizationGroups: HubGroup[];
  organizations: HubOrganization[];
  selectedViewId: number | string;
  onSelectView: (view: { type: 'home' | 'orgHome' | 'group' | 'orgGroup'; id: number | string }) => void;
  canCreateCommunityGroup: boolean;
  canCreateOrganizationGroup: boolean;
  onRequestCreateCommunityGroup: () => void;
  onRequestCreateOrganizationGroup: () => void;
  activeOrganizationId: number | null;
}

function InternalSidebar({
  isOpen,
  toggleSidebar,
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

// --- Home Page Content ---
interface HomePageContentProps {
  details: {
    id: number;
    coverImage: string;
    about: string;
    name: string;
    canManageProfile: boolean;
    canCreatePost: boolean;
  };
  onOpenSettings?: () => void;
  canCreatePost: boolean;
  scope: HubScopeSelection;
  membersLoader: () => Promise<HubGroupMemberOption[]>;
}

function HomePageContent({
  details,
  onOpenSettings,
  canCreatePost,
  scope,
  membersLoader,
}: HomePageContentProps) {
  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <Card sx={{ borderRadius: 2, boxShadow: 3, width: '100%', position: 'relative' }}>
        {details.canManageProfile && onOpenSettings && (
          <Tooltip title="Edit pharmacy profile">
            <IconButton
              onClick={onOpenSettings}
              size="small"
              sx={{ position: 'absolute', top: 16, right: 16, bgcolor: 'white', boxShadow: 2 }}
            >
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <CardMedia
          component="img"
          height="240"
          image={details.coverImage}
          alt="Pharmacy cover"
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            {details.name}
          </Typography>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'semibold', color: 'text.secondary' }}>
            About Us
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.75, color: 'text.secondary' }}>
            {details.about}
          </Typography>
          {canCreatePost && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Share updates with your entire pharmacy team using the composer below.
            </Alert>
          )}
        </CardContent>
      </Card>
      <Box sx={{ mt: 3 }}>
        <ScopeFeed
          scope={scope}
          canCreatePost={canCreatePost}
          membersLoader={membersLoader}
          emptyTitle="No updates yet."
          emptyDescription="Share the first update with your pharmacy."
        />
      </Box>
    </Box>
  );
}

// --- Org Home Page Content ---
interface OrgHomePageContentProps {
  details: {
    id: number;
    name: string;
    coverImage: string;
    about: string;
    canManageProfile: boolean;
    canCreatePost: boolean;
  };
  onOpenSettings?: () => void;
  canCreatePost?: boolean;
  scope: HubScopeSelection;
  membersLoader: () => Promise<HubGroupMemberOption[]>;
}

function OrgHomePageContent({
  details,
  onOpenSettings,
  canCreatePost = false,
  scope,
  membersLoader,
}: OrgHomePageContentProps) {
  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <Card sx={{ borderRadius: 2, boxShadow: 3, width: '100%', position: 'relative' }}>
        {details.canManageProfile && onOpenSettings && (
          <Tooltip title="Edit organization profile">
            <IconButton
              onClick={onOpenSettings}
              size="small"
              sx={{ position: 'absolute', top: 16, right: 16, bgcolor: 'white', boxShadow: 2 }}
            >
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <CardMedia
          component="img"
          height="240"
          image={details.coverImage}
          alt="Organization cover"
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            {details.name}
          </Typography>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'semibold', color: 'text.secondary' }}>
            About Our Organization
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.75, color: 'text.secondary' }}>
            {details.about}
          </Typography>
          {canCreatePost && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Organization posts are visible to everyone linked to this organization.
            </Alert>
          )}
        </CardContent>
      </Card>
      <Box sx={{ mt: 3 }}>
        <ScopeFeed
          scope={scope}
          canCreatePost={canCreatePost}
          membersLoader={membersLoader}
          emptyTitle="No updates yet."
          emptyDescription="Share the first announcement with your organization."
        />
      </Box>
    </Box>
  );
}

interface GroupContentProps {
  pharmacy: HubPharmacy | undefined | null;
  group: HubGroup | undefined;
  scope: HubScopeSelection;
  onEditGroup: (group: HubGroup) => void;
  onDeleteGroup: (group: HubGroup) => void;
}

function GroupContent({ pharmacy, group, scope, onEditGroup, onDeleteGroup }: GroupContentProps) {
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(null);
  const actionsOpen = Boolean(actionsAnchorEl);

  if (!group) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">Group not found.</Typography>
      </Box>
    );
  }

  const membersLoader = useCallback(() => fetchPharmacyGroupMembers(group.pharmacyId), [group.pharmacyId]);

  return (
    <Stack sx={{ width: '100%' }} spacing={3}>
      <Card sx={{ borderRadius: 2, boxShadow: 3, background: 'linear-gradient(to right, #6D28D9, #4C1D95)', color: 'white', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TagIcon sx={{ fontSize: 32, opacity: 0.8 }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>{group.name}</Typography>
            {group.isCreator && (
              <Chip
                label="Created by you"
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'common.white',
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
          {(group.isAdmin || group.isCreator) && (
            <>
              <IconButton onClick={(event) => setActionsAnchorEl(event.currentTarget)} sx={{ color: 'white' }}>
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={actionsAnchorEl}
                open={actionsOpen}
                onClose={() => setActionsAnchorEl(null)}
              >
                <MenuItem onClick={() => { setActionsAnchorEl(null); onEditGroup(group); }}>Edit group</MenuItem>
                <MenuItem onClick={() => { setActionsAnchorEl(null); onDeleteGroup(group); }}>Delete group</MenuItem>
              </Menu>
            </>
          )}
        </Box>
        {pharmacy && (
          <Typography variant="body2" sx={{ mt: 1, color: 'primary.light' }}>
            This group is part of the <Typography component="span" sx={{ fontWeight: 'semibold' }}>{pharmacy.name}</Typography> hub.
          </Typography>
        )}
      </Card>

      <ScopeFeed
        scope={scope}
        canCreatePost
        membersLoader={membersLoader}
        emptyTitle="No updates yet."
        emptyDescription="Start the conversation with your team above."
      />
    </Stack>
  );
}

interface OrgGroupContentProps {
  group: HubGroup | undefined;
  scope: HubScopeSelection;
  onEditGroup: (group: HubGroup) => void;
  onDeleteGroup: (group: HubGroup) => void;
}

function OrgGroupContent({ group, scope, onEditGroup, onDeleteGroup }: OrgGroupContentProps) {
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(null);
  const actionsOpen = Boolean(actionsAnchorEl);

  if (!group) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">Organization Group not found.</Typography>
      </Box>
    );
  }

  const membersLoader = useCallback(() => {
    if (group.organizationId) {
      return fetchOrganizationGroupMembers(group.organizationId);
    }
    return fetchPharmacyGroupMembers(group.pharmacyId);
  }, [group.organizationId, group.pharmacyId]);

  return (
    <Stack sx={{ width: '100%' }} spacing={3}>
      <Card sx={{ borderRadius: 2, boxShadow: 3, background: 'linear-gradient(to right, #1976D2, #0D47A1)', color: 'white', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TagIcon sx={{ fontSize: 32, opacity: 0.8 }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>{group.name} (Org)</Typography>
            {group.isCreator && (
              <Chip
                label="Created by you"
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'common.white',
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
          {(group.isAdmin || group.isCreator) && (
            <>
              <IconButton onClick={(event) => setActionsAnchorEl(event.currentTarget)} sx={{ color: 'white' }}>
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={actionsAnchorEl}
                open={actionsOpen}
                onClose={() => setActionsAnchorEl(null)}
              >
                <MenuItem onClick={() => { setActionsAnchorEl(null); onEditGroup(group); }}>Edit group</MenuItem>
                <MenuItem onClick={() => { setActionsAnchorEl(null); onDeleteGroup(group); }}>Delete group</MenuItem>
              </Menu>
            </>
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: 'info.light' }}>
          This is an organization-wide group.
        </Typography>
      </Card>

      <ScopeFeed
        scope={scope}
        canCreatePost
        membersLoader={membersLoader}
        emptyTitle="No updates yet."
        emptyDescription="Start the conversation with your team."
      />
    </Stack>
  );
}
interface GroupModalFormValues {
  name: string;
  description: string;
  memberIds: number[];
}

interface CreateGroupModalProps {
  title: string;
  scope: GroupModalScope;
  mode: GroupModalMode;
  onClose: () => void;
  onSubmit: (values: GroupModalFormValues) => void;
  pharmacies: HubPharmacy[];
  initialGroup?: HubGroup;
}

function CreateGroupModal({
  title,
  scope,
  mode,
  onClose,
  onSubmit,
  pharmacies,
  initialGroup,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState(initialGroup?.name ?? '');
  const [description, setDescription] = useState(initialGroup?.description ?? '');
  const [members, setMembers] = useState<HubGroupMemberOption[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    setGroupName(initialGroup?.name ?? '');
    setDescription(initialGroup?.description ?? '');
    if (initialGroup?.members) {
      setSelectedMembers(new Set(initialGroup.members.map((member) => member.membershipId)));
    } else if (mode === 'create') {
      setSelectedMembers(new Set());
    }
  }, [initialGroup, mode]);

  useEffect(() => {
    let isMounted = true;
    const loadMembers = async () => {
      setLoadingMembers(true);
      setMembersError(null);
      try {
        let results: HubGroupMemberOption[] = [];
        if (scope.type === 'pharmacy') {
          const pharmacyIds = (pharmacies.length ? pharmacies : [{ id: scope.pharmacyId }])
            .map((pharmacy) => pharmacy.id)
            .filter((id): id is number => typeof id === 'number');
          const uniqueIds = Array.from(new Set(pharmacyIds));
          const responses = await Promise.all(
            uniqueIds.map((id) => fetchPharmacyGroupMembers(id))
          );
          results = responses.flat();
        } else {
          results = await fetchOrganizationGroupMembers(scope.organizationId);
        }
        if (isMounted) {
          setMembers(results);
        }
      } catch (err) {
        console.error('Failed to load members for group', err);
        if (isMounted) {
          setMembersError('Unable to load members for selection. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    };
    loadMembers();
    return () => {
      isMounted = false;
    };
  }, [scope, pharmacies]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    members.forEach(member => {
      if (member.role) {
        roles.add(member.role);
      }
    });
    return Array.from(roles).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
      const matchesQuery =
        member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      return matchesRole && matchesQuery;
    });
  }, [members, roleFilter, searchQuery]);

  const selectedMemberDetails = useMemo(
    () =>
      members.filter((member) => selectedMembers.has(member.membershipId)),
    [members, selectedMembers],
  );

  const groupedMembers = useMemo(() => {
    const groups: Array<{
      label: string;
      members: HubGroupMemberOption[];
      pharmacyId: number | null;
    }> = [];
    const memberMap = new Map<number | 'unassigned', HubGroupMemberOption[]>();

    filteredMembers.forEach(member => {
      const key = typeof member.pharmacyId === 'number' ? member.pharmacyId : 'unassigned';
      if (!memberMap.has(key)) {
        memberMap.set(key, []);
      }
      memberMap.get(key)!.push(member);
    });

    const orderedKeys: Array<number | 'unassigned'> = [];
    pharmacies.forEach(pharmacy => {
      if (memberMap.has(pharmacy.id)) {
        orderedKeys.push(pharmacy.id);
      }
    });
    memberMap.forEach((_members, key) => {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
    });

    orderedKeys.forEach(key => {
      const list = memberMap.get(key);
      if (!list || !list.length) {
        return;
      }
      const label =
        typeof key === 'number'
          ? pharmacies.find((pharmacy) => pharmacy.id === key)?.name ?? `Pharmacy #${key}`
          : 'Other Members';
      groups.push({
        label,
        members: list,
        pharmacyId: typeof key === 'number' ? key : null,
      });
    });

    return groups;
  }, [filteredMembers, pharmacies]);

  const toggleMember = (membershipId: number) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(membershipId)) {
        next.delete(membershipId);
      } else {
        next.add(membershipId);
      }
      return next;
    });
  };

  const renderMemberRow = (member: HubGroupMemberOption) => {
    const isChecked = selectedMembers.has(member.membershipId);
    return (
      <ListItemButton
        key={member.membershipId}
        onClick={() => toggleMember(member.membershipId)}
        selected={isChecked}
        sx={{ alignItems: 'flex-start' }}
      >
        <Checkbox
          checked={isChecked}
          tabIndex={-1}
          disableRipple
          sx={{ mr: 1 }}
        />
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">{member.fullName}</Typography>
              <Chip label={member.role.replace(/_/g, ' ')} size="small" />
            </Box>
          }
          secondary={
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                {member.email || 'No email provided'}
              </Typography>
              {member.pharmacyName ? (
                <Typography variant="caption" color="text.secondary">
                  {member.pharmacyName}
                </Typography>
              ) : null}
            </Stack>
          }
        />
      </ListItemButton>
    );
  };

  const selectMembersBatch = useCallback((targetMembers: HubGroupMemberOption[]) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      targetMembers.forEach(member => {
        next.add(member.membershipId);
      });
      return next;
    });
  }, []);

  const handleSelectAllVisible = () => {
    selectMembersBatch(filteredMembers);
  };

  const handleClearAll = () => {
    setSelectedMembers(new Set());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = groupName.trim();
    if (!trimmedName) return;
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      memberIds: Array.from(selectedMembers),
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth component="form" onSubmit={handleSubmit}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} size="small" aria-label="Close dialog">
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          autoFocus
          margin="dense"
          label="Group Name"
          type="text"
          fullWidth
          variant="outlined"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g., QCPP Champions"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
              '& fieldset': { borderColor: 'grey.300' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />
        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          variant="outlined"
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of this group"
        />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members by name or email"
            fullWidth
            InputProps={{
              startAdornment: (
                <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="role-filter-label">Filter by role</InputLabel>
            <Select
              labelId="role-filter-label"
              value={roleFilter}
              label="Filter by role"
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="ALL">All roles</MenuItem>
              {uniqueRoles.map(role => (
                <MenuItem key={role} value={role}>
                  {role.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedMembers.size} member{selectedMembers.size === 1 ? '' : 's'} selected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={handleSelectAllVisible}
                disabled={filteredMembers.length === 0}
              >
                Select all visible
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={handleClearAll}
                disabled={selectedMembers.size === 0}
              >
                Clear selection
              </Button>
            </Box>
          </Box>
          {selectedMemberDetails.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                p: 1,
                border: '1px solid',
                borderColor: 'grey.200',
                borderRadius: 1,
                maxHeight: 112,
                overflowY: 'auto',
              }}
            >
              {selectedMemberDetails.map(member => {
                const chipLabel = member.pharmacyName ? `${member.fullName} - ${member.pharmacyName}` : member.fullName;
                return (
                  <Chip
                    key={member.membershipId}
                    label={chipLabel}
                    onDelete={() => toggleMember(member.membershipId)}
                    size="small"
                  />
                );
              })}
            </Box>
          )}
        </Stack>
        {membersError && (
          <Alert severity="error">{membersError}</Alert>
        )}
        <Box sx={{ maxHeight: 360, overflowY: 'auto', border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
          {loadingMembers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredMembers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No members match your filters.
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {groupedMembers.map((group, index) => (
                <React.Fragment key={`${group.label}-${group.pharmacyId ?? 'other'}-${index}`}>
                  <ListSubheader
                    disableSticky
                    sx={{
                      bgcolor: 'grey.50',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {group.label}
                    </Typography>
                </ListSubheader>
                  {group.members.map(renderMemberRow)}
                  {index < groupedMembers.length - 1 && (
                    <Divider component="li" sx={{ borderColor: 'grey.100' }} />
                  )}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
        <FormHelperText sx={{ mx: 1 }}>
          {selectedMembers.size} member{selectedMembers.size === 1 ? '' : 's'} selected
        </FormHelperText>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!groupName.trim()}
          sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          {mode === 'edit' ? 'Save Changes' : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Post Card Component ---
const reactionEmojis: Record<HubReactionType, string> = {
  LIKE: '??',
  CELEBRATE: '??',
  SUPPORT: '??',
  INSIGHTFUL: '??',
  LOVE: '??',
};

interface PostCardProps {
  post: HubPost;
  onUpdate: (updatedPost: HubPost) => void;
  onEdit?: (post: HubPost) => void;
  onDelete?: (post: HubPost) => void;
}

function PostCard({ post, onUpdate, onEdit, onDelete }: PostCardProps) {
  const [reactionAnchorEl, setReactionAnchorEl] = useState<null | HTMLElement>(null);
  const [optionsAnchorEl, setOptionsAnchorEl] = useState<null | HTMLElement>(null);
  const reactionMenuOpen = Boolean(reactionAnchorEl);
  const optionsMenuOpen = Boolean(optionsAnchorEl);

  const handleReactClick = (event: React.MouseEvent<HTMLElement>) => {
    setReactionAnchorEl(event.currentTarget);
  };

  const handleReactionMenuClose = () => {
    setReactionAnchorEl(null);
  };

  const handleSelectReaction = async (reaction: HubReactionType) => {
    handleReactionMenuClose();
    try {
      const updatedPost = await reactToHubPost(post.id, reaction);
      onUpdate(updatedPost);
    } catch (error) {
      console.error('Failed to react to post:', error);
    }
  };

  const authorName = `${post.author.user.firstName || ''} ${post.author.user.lastName || ''}`.trim() || 'Unknown User';
  const postTimestamp = new Date(post.createdAt).toLocaleString();

  const renderAttachment = (attachment: HubAttachment) => {
    const src = attachment.url;
    if (!src) return null;
    const filename = attachment.filename?.toLowerCase() ?? '';
    const isImage = attachment.kind === 'IMAGE' || attachment.kind === 'GIF';
    const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v'];
    const isVideo = attachment.kind !== 'IMAGE' && attachment.kind !== 'GIF' && videoExtensions.some((ext) => filename.endsWith(ext));

    if (isImage) {
      return (
        <Box
          component="img"
          src={src}
          alt={attachment.filename || 'Attachment'}
          sx={{ width: '100%', borderRadius: 2, maxHeight: 450, objectFit: 'cover' }}
        />
      );
    }
    if (isVideo) {
      return (
        <Box component="video" controls src={src} style={{ width: '100%', borderRadius: 8, backgroundColor: '#000' }} />
      );
    }
    return (
      <Button
        component="a"
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<InsertDriveFileIcon />}
        variant="outlined"
        sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'grey.300', color: 'text.primary' }}
      >
        {attachment.filename || 'Download attachment'}
      </Button>
    );
  };

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ bgcolor: 'primary.main' }}>{authorName.charAt(0)}</Avatar>
          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Box>
                <Typography variant="subtitle2" component="div" sx={{ fontWeight: 'bold' }}>
                  {authorName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {postTimestamp}
                </Typography>
              </Box>
              {post.canManage && (
                <>
                  <IconButton size="small" onClick={(event) => setOptionsAnchorEl(event.currentTarget)}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                  <Menu
                    anchorEl={optionsAnchorEl}
                    open={optionsMenuOpen}
                    onClose={() => setOptionsAnchorEl(null)}
                  >
                    <MenuItem
                      onClick={() => {
                        setOptionsAnchorEl(null);
                        onEdit?.(post);
                      }}
                    >
                      Edit post
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setOptionsAnchorEl(null);
                        onDelete?.(post);
                      }}
                    >
                      Delete post
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Stack>
          </Stack>
        </Stack>

        <Typography variant="body1" sx={{ my: 2, whiteSpace: 'pre-wrap' }}>
          {post.body}
        </Typography>

        {post.attachments.length > 0 && (
          <Stack spacing={2} sx={{ mb: 2 }}>
            {post.attachments.map((attachment) => {
              const preview = renderAttachment(attachment);
              if (!preview) {
                return null;
              }
              return (
                <Box key={attachment.id}>
                  {preview}
                </Box>
              );
            })}
          </Stack>
        )}

        {post.taggedMembers && post.taggedMembers.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Tagged:
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
              {post.taggedMembers.map((member) => (
                <Chip
                  key={member.membershipId}
                  label={member.fullName || member.email || 'Member'}
                  size="small"
                />
              ))}
            </Stack>
          </Stack>
        )}

        {(Object.keys(post.reactionSummary).length > 0 || post.commentCount > 0) && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack direction="row" spacing={0.5}>
              {Object.entries(post.reactionSummary).map(([reaction, count]) =>
                count > 0 ? (
                  <Tooltip key={reaction} title={`${count} ${reaction.toLowerCase()}`}>
                    <Chip
                      label={`${reactionEmojis[reaction as HubReactionType]} ${count}`}
                      size="small"
                      sx={{ bgcolor: 'grey.200' }}
                    />
                  </Tooltip>
                ) : null
              )}
            </Stack>
            {post.commentCount > 0 && (
              <Typography variant="body2" color="text.secondary">
                {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
              </Typography>
            )}
          </Stack>
        )}

        <Divider />

        <Stack direction="row" justifyContent="space-around" sx={{ pt: 1 }}>
          <Button
            startIcon={post.viewerReaction ? <ThumbUpAltIcon color="primary" /> : <ThumbUpAltOutlinedIcon />}
            onClick={handleReactClick}
            sx={{ textTransform: 'none', color: post.viewerReaction ? 'primary.main' : 'text.secondary' }}
          >
            {post.viewerReaction ? post.viewerReaction : 'React'}
          </Button>
          <Menu
            anchorEl={reactionAnchorEl}
            open={reactionMenuOpen}
            onClose={handleReactionMenuClose}
          >
            <Stack direction="row" spacing={1} sx={{ p: 1 }}>
              {Object.entries(reactionEmojis).map(([reaction, emoji]) => (
                <IconButton key={reaction} onClick={() => handleSelectReaction(reaction as HubReactionType)}>
                  <Typography variant="h6">{emoji}</Typography>
                </IconButton>
              ))}
            </Stack>
          </Menu>
          <Button startIcon={<ChatBubbleOutlineIcon />} sx={{ textTransform: 'none', color: 'text.secondary' }}>
            Comment
          </Button>
        </Stack>

        <Divider sx={{ mt: 1 }} />

        <Stack spacing={2} sx={{ mt: 2 }}>
          {post.recentComments.map((comment) => (
            <Stack key={comment.id} direction="row" spacing={1.5}>
              <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: 'secondary.main' }}>
                {comment.author.user.firstName?.charAt(0)}
              </Avatar>
              <Paper variant="outlined" sx={{ p: 1.5, flexGrow: 1, bgcolor: 'grey.100', borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {comment.author.user.firstName} {comment.author.user.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {comment.body}
                </Typography>
              </Paper>
            </Stack>
          ))}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.500' }}>U</Avatar>
            <Paper
              component="form"
              sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', flexGrow: 1, borderRadius: 5, border: '1px solid', borderColor: 'grey.300', boxShadow: 'none' }}
            >
              <InputBase sx={{ ml: 1, flex: 1 }} placeholder="Write a comment..." />
              <IconButton type="submit" sx={{ p: '10px' }} aria-label="send">
                <SendIcon />
              </IconButton>
            </Paper>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface ScopeFeedProps {
  scope: HubScopeSelection;
  canCreatePost: boolean;
  membersLoader?: () => Promise<HubGroupMemberOption[]>;
  emptyTitle: string;
  emptyDescription: string;
}

function ScopeFeed({
  scope,
  canCreatePost,
  membersLoader,
  emptyTitle,
  emptyDescription,
}: ScopeFeedProps) {
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postContent, setPostContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [taggedMembers, setTaggedMembers] = useState<HubGroupMemberOption[]>([]);
  const [polls, setPolls] = useState<HubPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [pollsError, setPollsError] = useState<string | null>(null);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isPollModalOpen, setPollModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<HubPost | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadPosts = async () => {
      try {
        setLoadingPosts(true);
        setPostsError(null);
        const fetchedPosts = await fetchHubPosts(scope);
        if (isMounted) {
          setPosts(fetchedPosts.posts);
        }
      } catch (err) {
        console.error('Failed to fetch posts:', err);
        if (isMounted) {
          setPostsError('Failed to load posts. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoadingPosts(false);
        }
      }
    };
    loadPosts();
    return () => {
      isMounted = false;
    };
  }, [scope]);

  useEffect(() => {
    let isMounted = true;
    const loadPolls = async () => {
      try {
        setPollsLoading(true);
        setPollsError(null);
        const fetchedPolls = await fetchHubPolls(scope);
        if (isMounted) {
          setPolls(fetchedPolls);
        }
      } catch (err) {
        console.error('Failed to fetch polls:', err);
        if (isMounted) {
          setPollsError('Failed to load polls. Please try again.');
        }
      } finally {
        if (isMounted) {
          setPollsLoading(false);
        }
      }
    };
    loadPolls();
    return () => {
      isMounted = false;
    };
  }, [scope]);

  const handleCreatePost = async () => {
    if (!canCreatePost) return;
    if (!postContent.trim() && attachments.length === 0) return;
    const payload: HubPostPayload = { body: postContent };
    if (attachments.length > 0) {
      payload.attachments = attachments;
    }
    if (taggedMembers.length > 0) {
      payload.taggedMemberIds = taggedMembers.map((member) => member.membershipId);
    }
    try {
      const newPost = await createHubPost(scope, payload);
      setPosts((prev) => [newPost, ...prev]);
      setPostContent('');
      setAttachments([]);
      setTaggedMembers([]);
    } catch (err) {
      console.error('Failed to create post:', err);
      setPostsError('Failed to create the post. Please try again.');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      return;
    }
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removeAttachment = (fileToRemove: File) => {
    setAttachments((prev) => prev.filter((file) => file !== fileToRemove));
  };

  const openPollModal = () => {
    if (!canCreatePost) return;
    setPollError(null);
    setPollModalOpen(true);
  };

  const closePollModal = () => {
    setPollModalOpen(false);
    setPollError(null);
  };

  const handleCreatePoll = async (pollData: { question: string; options: string[] }) => {
    if (!canCreatePost) return;
    const question = pollData.question.trim();
    const optionLabels = pollData.options.map((opt) => opt.trim()).filter(Boolean);
    if (!question || optionLabels.length < 2) {
      setPollError('Please provide a question and at least two options.');
      return;
    }
    setPollSubmitting(true);
    setPollError(null);
    try {
      const created = await createHubPoll(scope, { question, options: optionLabels });
      setPolls((prev) => [created, ...prev]);
      setPollModalOpen(false);
    } catch (err) {
      console.error('Failed to create poll:', err);
      setPollError('Failed to create poll. Please try again.');
    } finally {
      setPollSubmitting(false);
    }
  };

  const handlePollVote = async (pollId: number, optionId: number) => {
    try {
      const updated = await voteHubPoll(pollId, optionId);
      setPolls((prev) => prev.map((poll) => (poll.id === updated.id ? updated : poll)));
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    }
  };

  const handleStartEditPost = (post: HubPost) => {
    setEditingPost(post);
    setEditingContent(post.body);
    setEditingError(null);
  };

  const handleCloseEditPost = () => {
    if (editingSaving) return;
    setEditingPost(null);
    setEditingContent('');
    setEditingError(null);
  };

  const handleSaveEditPost = async () => {
    if (!editingPost) return;
    const trimmed = editingContent.trim();
    if (!trimmed) {
      setEditingError('Post content cannot be empty.');
      return;
    }
    setEditingSaving(true);
    setEditingError(null);
    try {
      const updated = await updateHubPost(editingPost.id, { body: trimmed });
      updatePost(updated);
      setEditingPost(null);
      setEditingContent('');
    } catch (err) {
      console.error('Failed to update post:', err);
      setEditingError('Failed to update post. Please try again.');
    } finally {
      setEditingSaving(false);
    }
  };

  const handleDeletePost = async (post: HubPost) => {
    const confirmed = window.confirm('Delete this post? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteHubPost(post.id);
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
    } catch (err) {
      console.error('Failed to delete post:', err);
      setPostsError('Failed to delete post. Please try again.');
    }
  };

  const updatePost = (updatedPost: HubPost) => {
    setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
  };

  return (
    <>
      <Stack spacing={3}>
      {canCreatePost && (
        <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'grey.200', boxShadow: 1 }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'grey.200', p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'semibold', color: 'text.primary' }}>
              Share an update with your team
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Announce new roster updates, reminders, or shout-outs..."
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                  '& fieldset': { borderColor: 'grey.300' },
                  '&:hover fieldset': { borderColor: 'primary.main' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                },
              }}
            />
          </Box>
          {attachments.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ p: 2, pt: 0, flexWrap: 'wrap', gap: 1 }}>
              {attachments.map((file, index) => (
                <Chip
                  key={index}
                  icon={<InsertDriveFileIcon />}
                  label={file.name}
                  onDelete={() => removeAttachment(file)}
                  deleteIcon={<CancelIcon />}
                />
              ))}
            </Stack>
          )}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {membersLoader && (
            <Box sx={{ px: 2, pb: 2 }}>
              <TagMembersSelector loadMembers={membersLoader} value={taggedMembers} onChange={setTaggedMembers} />
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              borderTop: '1px solid',
              borderColor: 'grey.200',
              bgcolor: 'grey.50',
              p: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                onClick={() => fileInputRef.current?.click()}
                startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                Add attachments
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                onClick={openPollModal}
                variant="outlined"
                startIcon={<BarChartIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', borderColor: 'grey.300', color: 'text.primary', '&:hover': { bgcolor: 'grey.50' } }}
              >
                Start Poll
              </Button>
              <Button
                onClick={handleCreatePost}
                disabled={!postContent.trim() && attachments.length === 0}
                variant="contained"
                startIcon={<SendIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                Post to Hub
              </Button>
            </Box>
          </Box>
        </Card>
      )}

      {pollsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : pollsError ? (
        <Alert severity="error">{pollsError}</Alert>
      ) : polls.length > 0 ? (
        <Stack spacing={2}>
          {polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} onVote={handlePollVote} />
          ))}
        </Stack>
      ) : null}

      {loadingPosts ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </Box>
      ) : postsError ? (
        <Alert severity="error" sx={{ mt: 3 }}>
          {postsError}
        </Alert>
      ) : posts.length === 0 ? (
        <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'grey.200', bgcolor: 'white', p: 3, textAlign: 'center', boxShadow: 1 }}>
          <GroupIcon sx={{ fontSize: 40, margin: '0 auto', marginBottom: 1.5, color: 'grey.400' }} />
          <Typography variant="h6" sx={{ fontWeight: 'semibold', color: 'text.primary' }}>
            {emptyTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {emptyDescription}
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onUpdate={updatePost}
              onEdit={handleStartEditPost}
              onDelete={handleDeletePost}
            />
          ))}
        </Stack>
      )}
      </Stack>
      {isPollModalOpen && (
        <StartPollModal
          onClose={closePollModal}
          onCreate={handleCreatePoll}
          submitting={pollSubmitting}
          error={pollError}
        />
      )}
      {editingPost && (
        <EditPostDialog
          open={Boolean(editingPost)}
          value={editingContent}
          onChange={setEditingContent}
          onClose={handleCloseEditPost}
          onSave={handleSaveEditPost}
          saving={editingSaving}
          error={editingError}
        />
      )}
    </>
  );
}

interface TagMembersSelectorProps {
  loadMembers?: () => Promise<HubGroupMemberOption[]>;
  value: HubGroupMemberOption[];
  onChange: (members: HubGroupMemberOption[]) => void;
}

function TagMembersSelector({ loadMembers, value, onChange }: TagMembersSelectorProps) {
  const [options, setOptions] = useState<HubGroupMemberOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!loadMembers) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadMembers()
      .then((members) => {
        if (isMounted) {
          setOptions(members);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOptions([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [loadMembers]);

  if (!loadMembers) {
    return null;
  }

  return (
    <Autocomplete
      multiple
      options={options}
      value={value}
      onChange={(_, newValue) => onChange(newValue as HubGroupMemberOption[])}
      disableCloseOnSelect
      loading={loading}
      isOptionEqualToValue={(option, selected) => option.membershipId === selected.membershipId}
      getOptionLabel={(option) => option.fullName || option.email || 'Member'}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox checked={selected} sx={{ mr: 1 }} />
          <Box>
            <Typography variant="body2">{option.fullName || option.email || 'Member'}</Typography>
            {option.role && (
              <Typography variant="caption" color="text.secondary">
                {option.role.replace(/_/g, ' ')}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip {...getTagProps({ index })} label={option.fullName || option.email || 'Member'} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Tag members"
          placeholder="@mention"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

interface PollCardProps {
  poll: HubPoll;
  onVote: (pollId: number, optionId: number) => void;
}

function PollCard({ poll, onVote }: PollCardProps) {
  const totalVotes = poll.totalVotes;

  const handleVote = (optionId: number) => {
    if (!poll.canVote) return;
    onVote(poll.id, optionId);
  };

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
              Poll
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {poll.question}
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            {poll.options
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((option) => {
                const votes = option.voteCount;
                const percentage = option.percentage ?? (totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0);
                const isSelected = poll.selectedOptionId === option.id;
              return (
                <Box
                  key={option.id}
                  onClick={() => handleVote(option.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && poll.canVote) {
                      event.preventDefault();
                      handleVote(option.id);
                    }
                  }}
                  sx={{
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'grey.200',
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: isSelected ? 'primary.light' : 'grey.50',
                    cursor: poll.canVote ? 'pointer' : 'default',
                    transition: 'all 150ms ease',
                    '&:hover': poll.canVote
                      ? {
                          borderColor: 'primary.main',
                          bgcolor: 'grey.100',
                        }
                      : undefined,
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {option.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {percentage}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: isSelected ? 'primary.main' : 'primary.light',
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {votes} {votes === 1 ? 'vote' : 'votes'}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </Typography>
            {poll.hasVoted && (
              <Chip label="You voted" size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface EditPostDialogProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error?: string | null;
}

function EditPostDialog({ open, value, onChange, onClose, onSave, saving, error }: EditPostDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Edit Post</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          multiline
          minRows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          placeholder="Update your post..."
        />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={saving || !value.trim()}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


// --- Start Poll Modal Component ---
interface StartPollModalProps {
  onClose: () => void;
  onCreate: (pollData: { question: string; options: string[] }) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

function StartPollModal({ onClose, onCreate, submitting = false, error }: StartPollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pollData = {
      question,
      options: options.filter(opt => opt.trim() !== ''),
    };
    if (pollData.question.trim() && pollData.options.length >= 2) {
      await onCreate(pollData);
      setQuestion('');
      setOptions(['', '']);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Start a New Poll</Typography>
          <IconButton onClick={onClose} size="small"> {/* Use CloseIcon for X */}
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          id="pollQuestion"
          label="Poll Question"
          type="text"
          fullWidth
          variant="outlined"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., What's for lunch?"
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
          disabled={submitting}
        />

        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium' }}>Options</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {options.map((option, index) => (
            <TextField
              key={index}
              fullWidth
              variant="outlined"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
              disabled={submitting}
            />
          ))}
        </Box>
        {options.length < 5 && (
          <Button
            onClick={addOption}
            startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 2, textTransform: 'none', color: 'primary.main', '&:hover': { bgcolor: 'primary.light' } }} // Use AddCircleOutlineIcon for PlusCircle
            disabled={submitting}
          >
            Add Option
          </Button>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            submitting ||
            !question.trim() ||
            options.filter(opt => opt.trim() !== '').length < 2
          }
          sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          {submitting ? 'Creating...' : 'Create Poll'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface PharmacyProfileModalProps {
  open: boolean;
  pharmacy: HubPharmacy;
  onClose: () => void;
  onSaved: (pharmacy: HubPharmacy) => void;
}

function PharmacyProfileModal({ open, pharmacy, onClose, onSaved }: PharmacyProfileModalProps) {
  const [about, setAbout] = useState(pharmacy.about ?? '');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAbout(pharmacy.about ?? '');
      setCoverImage(null);
      setError(null);
    }
  }, [open, pharmacy]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCoverImage(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePharmacyHubProfile(pharmacy.id, {
        about,
        coverImage: coverImage ?? undefined,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update pharmacy profile', err);
      setError('Unable to update pharmacy profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth component="form" onSubmit={handleSubmit}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Edit Pharmacy Profile</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="About"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          multiline
          minRows={4}
          fullWidth
        />
        <Button
          variant="outlined"
          component="label"
          startIcon={<PhotoCameraIcon />}
        >
          {coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
          <input type="file" hidden accept="image/*" onChange={handleFileChange} />
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface OrganizationProfileModalProps {
  open: boolean;
  organization: HubOrganization;
  onClose: () => void;
  onSaved: (organization: HubOrganization) => void;
}

function OrganizationProfileModal({ open, organization, onClose, onSaved }: OrganizationProfileModalProps) {
  const [about, setAbout] = useState(organization.about ?? '');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAbout(organization.about ?? '');
      setCoverImage(null);
      setError(null);
    }
  }, [open, organization]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCoverImage(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateOrganizationHubProfile(organization.id, {
        about,
        coverImage: coverImage ?? undefined,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update organization profile', err);
      setError('Unable to update organization profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth component="form" onSubmit={handleSubmit}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Edit Organization Profile</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="About"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          multiline
          minRows={4}
          fullWidth
        />
        <Button
          variant="outlined"
          component="label"
          startIcon={<PhotoCameraIcon />}
        >
          {coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
          <input type="file" hidden accept="image/*" onChange={handleFileChange} />
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
