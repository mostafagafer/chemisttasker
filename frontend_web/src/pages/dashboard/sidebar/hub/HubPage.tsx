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
  reactToHubPost,
  updateHubGroup,
  deleteHubGroup,
  updatePharmacyHubProfile,
  updateOrganizationHubProfile,
  fetchPharmacyGroupMembers,
  fetchOrganizationGroupMembers,
} from '../../../../api/hub';
import {
  HubContext,
  HubPharmacy,
  HubGroup,
  HubOrganization,
  HubScopeSelection,
  HubPost,
  HubPostPayload,
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


// --- Main HubPage Component ---
export default function HubPage() {
  const [hubContext, setHubContext] = useState<HubContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<{ type: 'home' | 'orgHome' | 'group' | 'orgGroup'; id: number | string }>({ type: 'home', id: 'home' });
  const [isInternalSidebarOpen, setIsInternalSidebarOpen] = useState(true);
  const [groupModal, setGroupModal] = useState<{ title: string; scope: GroupModalScope } | null>(null);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pharmacyProfileModalOpen, setPharmacyProfileModalOpen] = useState(false);
  const [organizationProfileModalOpen, setOrganizationProfileModalOpen] = useState(false);
  const [editGroupModal, setEditGroupModal] = useState<HubGroup | null>(null);

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

  const filteredCommunityGroups = useMemo(() => {
    if (!selectedPharmacyId) return communityGroups;
    return communityGroups.filter((group) => group.pharmacyId === selectedPharmacyId);
  }, [communityGroups, selectedPharmacyId]);

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
    });
  }, [canCreateCommunityGroup, selectedPharmacyId]);

  const openOrganizationGroupModal = useCallback(() => {
    if (!selectedOrganization || !canCreateOrganizationGroup) {
      return;
    }
    setGroupModal({
      title: 'Create New Organization Group',
      scope: { type: 'organization', organizationId: selectedOrganization.id },
    });
  }, [canCreateOrganizationGroup, selectedOrganization]);

  const handleGroupModalSubmit = useCallback(
    async (groupName: string, description: string, memberIds: number[], scope: GroupModalScope) => {
      const trimmedName = groupName.trim();
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
        if (description?.trim()) {
          payload.description = description.trim();
        }
        if (memberIds.length) {
          payload.memberIds = memberIds;
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
        setGroupModal(null);
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
    [pharmacies],
  );

  const handleRequestEditGroup = useCallback((group: HubGroup) => {
    setEditGroupModal(group);
  }, []);

  const handleSubmitEditGroup = useCallback(
    async (groupId: number, values: { name: string; description?: string | null }) => {
      try {
        const payload: Partial<HubGroupPayload> = {};
        if (values.name.trim()) {
          payload.name = values.name.trim();
        }
        payload.description = values.description ?? null;
        const updatedGroup = await updateHubGroup(groupId, payload);
        setHubContext((prev) =>
          prev
            ? {
                ...prev,
                communityGroups: prev.communityGroups.map((group) =>
                  group.id === updatedGroup.id ? updatedGroup : group,
                ),
                organizationGroups: prev.organizationGroups.map((group) =>
                  group.id === updatedGroup.id ? updatedGroup : group,
                ),
              }
            : prev,
        );
        setEditGroupModal(null);
      } catch (err) {
        console.error('Failed to update group:', err);
        setError('Failed to update group. Please try again.');
      }
    },
    [],
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
    [organizations, selectedView],
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

  const handleCreatePoll = (pollData: any) => {
    console.log('Poll Created:', pollData); // Placeholder for actual API call
    setIsPollModalOpen(false);
  };

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
        communityGroups={filteredCommunityGroups}
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
            onOpenPollModal={() => setIsPollModalOpen(true)}
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

      {/* --- Create Group Modal --- */}
      {groupModal && (
        <CreateGroupModal
          title={groupModal.title}
          scope={groupModal.scope}
          onClose={() => setGroupModal(null)}
          onCreate={handleGroupModalSubmit}
          pharmacies={pharmacies}
        />
      )}

      {editGroupModal && (
        <EditGroupModal
          group={editGroupModal}
          onClose={() => setEditGroupModal(null)}
          onSave={handleSubmitEditGroup}
        />
      )}

      {/* --- Start Poll Modal --- */}
      {isPollModalOpen && (
        <StartPollModal
          onClose={() => setIsPollModalOpen(false)}
          onCreate={handleCreatePoll}
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

function HomePageContent({ details, onOpenSettings, canCreatePost, scope, membersLoader }: HomePageContentProps) {
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

function OrgHomePageContent({ details, onOpenSettings, canCreatePost = false, scope, membersLoader }: OrgHomePageContentProps) {
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
  onOpenPollModal: () => void;
  scope: HubScopeSelection;
  onEditGroup: (group: HubGroup) => void;
  onDeleteGroup: (group: HubGroup) => void;
}

function GroupContent({ pharmacy, group, onOpenPollModal, scope, onEditGroup, onDeleteGroup }: GroupContentProps) {
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
        onOpenPollModal={onOpenPollModal}
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
// --- Create Group Modal Component ---
type GroupModalScope =
  | { type: 'pharmacy'; pharmacyId: number }
  | { type: 'organization'; organizationId: number };

interface CreateGroupModalProps {
  title: string;
  scope: GroupModalScope;
  onClose: () => void;
  onCreate: (groupName: string, description: string, memberIds: number[], scope: GroupModalScope) => void;
  pharmacies: HubPharmacy[];
}

function CreateGroupModal({ title, scope, onClose, onCreate, pharmacies }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<HubGroupMemberOption[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

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
    if (!groupName.trim()) return;
    onCreate(groupName.trim(), description.trim(), Array.from(selectedMembers), scope);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
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
          onClick={handleSubmit}
          variant="contained"
          disabled={!groupName.trim()}
          sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          Create Group
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
}

function PostCard({ post, onUpdate }: PostCardProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleReactClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectReaction = async (reaction: HubReactionType) => {
    handleClose();
    try {
      const updatedPost = await reactToHubPost(post.id, reaction);
      onUpdate(updatedPost);
    } catch (error) {
      console.error("Failed to react to post:", error);
    }
  };

  const authorName = `${post.author.user.firstName || ''} ${post.author.user.lastName || ''}`.trim() || 'Unknown User';
  const postTimestamp = new Date(post.createdAt).toLocaleString();

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ bgcolor: 'primary.main' }}>{authorName.charAt(0)}</Avatar>
          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" component="div" sx={{ fontWeight: 'bold' }}>
                {authorName}
              </Typography>
              <IconButton size="small"><MoreVertIcon /></IconButton>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {postTimestamp}
            </Typography>
          </Stack>
        </Stack>

        <Typography variant="body1" sx={{ my: 2, whiteSpace: 'pre-wrap' }}>
          {post.body}
        </Typography>

        {post.attachments.length > 0 && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {post.attachments.map(att => (
              <Button
                key={att.id}
                component="a"
                href={att.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<InsertDriveFileIcon />}
                variant="outlined"
                sx={{ justifyContent: 'flex-start', textTransform: 'none', borderColor: 'grey.300', color: 'text.primary' }}
              >
                {att.filename}
              </Button>
            ))}
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
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
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

        {/* Comments Section */}
        <Stack spacing={2} sx={{ mt: 2 }}>
          {post.recentComments.map(comment => (
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
          {/* Add Comment Input */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.500' }}>
              {/* Current user initial */}
              U
            </Avatar>
            <Paper
              component="form"
              sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', flexGrow: 1, borderRadius: 5, border: '1px solid', borderColor: 'grey.300', boxShadow: 'none' }}
            >
              <InputBase
                sx={{ ml: 1, flex: 1 }}
                placeholder="Write a comment..."
              />
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
  onOpenPollModal?: () => void;
}

function ScopeFeed({
  scope,
  canCreatePost,
  membersLoader,
  emptyTitle,
  emptyDescription,
  onOpenPollModal,
}: ScopeFeedProps) {
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postContent, setPostContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [taggedMembers, setTaggedMembers] = useState<HubGroupMemberOption[]>([]);
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

  const updatePost = (updatedPost: HubPost) => {
    setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
  };

  return (
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
              {onOpenPollModal && (
                <Button
                  onClick={onOpenPollModal}
                  variant="outlined"
                  startIcon={<BarChartIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', borderColor: 'grey.300', color: 'text.primary', '&:hover': { bgcolor: 'grey.50' } }}
                >
                  Start Poll
                </Button>
              )}
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
            <PostCard key={post.id} post={post} onUpdate={updatePost} />
          ))}
        </Stack>
      )}
    </Stack>
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

interface EditGroupModalProps {
  group: HubGroup;
  onClose: () => void;
  onSave: (groupId: number, values: { name: string; description?: string | null }) => void;
}

function EditGroupModal({ group, onClose, onSave }: EditGroupModalProps) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');

  useEffect(() => {
    setName(group.name);
    setDescription(group.description ?? '');
  }, [group]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(group.id, {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
    });
  };

  return (
    <Dialog open onClose={onClose} component="form" onSubmit={handleSubmit} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Edit Group</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Group Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="Description"
          fullWidth
          multiline
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={!name.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Start Poll Modal Component ---
interface StartPollModalProps {
  onClose: () => void;
  onCreate: (pollData: { question: string; options: string[] }) => void;
}

function StartPollModal({ onClose, onCreate }: StartPollModalProps) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pollData = {
      question,
      options: options.filter(opt => opt.trim() !== ''),
    };
    if (pollData.question.trim() && pollData.options.length >= 2) {
      onCreate(pollData);
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
            />
          ))}
        </Box>
        {options.length < 5 && (
          <Button
            onClick={addOption}
            startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
            sx={{ mt: 2, textTransform: 'none', color: 'primary.main', '&:hover': { bgcolor: 'primary.light' } }} // Use AddCircleOutlineIcon for PlusCircle
          >
            Add Option
          </Button>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!question.trim() || options.filter(opt => opt.trim() !== '').length < 2}
          sx={{ textTransform: 'none', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          Create Poll
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
