// src/navigation.tsx
import  { Navigation } from '@toolpad/core'
import DashboardIcon           from '@mui/icons-material/Dashboard'
import MedicationLiquidIcon    from '@mui/icons-material/MedicationLiquid'
import CorporateFareIcon       from '@mui/icons-material/CorporateFare'
import PostAddIcon             from '@mui/icons-material/PostAdd'
import AccessTimeIcon          from '@mui/icons-material/AccessTime'
import EventAvailableIcon      from '@mui/icons-material/EventAvailable'
import FavoriteIcon            from '@mui/icons-material/Favorite'
import SchoolIcon              from '@mui/icons-material/School'
import LogoutIcon              from '@mui/icons-material/Logout'
import ManageAccountsSharpIcon from '@mui/icons-material/ManageAccountsSharp'
import StoreIcon               from '@mui/icons-material/Store'
import PublicIcon              from '@mui/icons-material/Public'
import GroupsIcon              from '@mui/icons-material/Groups'
import ForumIcon               from '@mui/icons-material/Forum'
import PlayArrowIcon    from '@mui/icons-material/PlayArrow';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import HistoryIcon      from '@mui/icons-material/History';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Chip from "@mui/material/Chip";

// Helper component for the "NEW" badge
const NewMessagesChip = () => (
  <Chip
    size="small"
    label="NEW"
    color="success"
    sx={{ ml: 0.5, fontWeight: 700, height: '18px', fontSize: '10px' }}
  />
);

export function getOrganizationNav(hasUnreadMessages: boolean): Navigation {
  return [
    { kind: 'header' as const, title: 'Organization Management' },
    { segment: 'dashboard/organization/overview', title: 'Overview',        icon: <GroupsIcon /> },
    { segment: 'dashboard/organization/invite',   title: 'Invite Staff',    icon: <ManageAccountsSharpIcon /> },
    { segment: 'dashboard/organization/claim',    title: 'Claim Pharmacies',icon: <StoreIcon /> },
    { 
      segment: 'dashboard/organization/chat', 
      title: 'Chat', 
      icon: <GroupsIcon />,
      action: hasUnreadMessages ? <NewMessagesChip /> : null,
    },
    { segment: 'dashboard/organization/community-groups', title: 'Community Groups', icon: <GroupsIcon /> },
    { segment: 'dashboard/organization/organization-hub', title: 'Organization Hub', icon: <ForumIcon /> },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Manage Pharmacies and Shifts' },
    { segment: 'dashboard/organization/manage-pharmacies',
      title: 'Manage Pharmacies',
      icon: <MedicationLiquidIcon />,
      children: [
        { segment: 'my-pharmacies', title: 'My Pharmacies', icon: <StoreIcon /> },
        { segment: 'my-chain',      title: 'My Chain',      icon: <CorporateFareIcon /> },
        { segment: 'roster', title: 'Internal Roster', icon: <EventAvailableIcon /> },
      ],
    },
    { segment: 'dashboard/organization/post-shift', title: 'Post Shift', icon: <PostAddIcon /> },
    { segment: 'dashboard/organization/shifts',
      title: 'Shifts',
      icon: <AccessTimeIcon />,
      children: [
        { segment: 'active',    title: 'Active Shifts',    icon: <PlayArrowIcon /> },
        { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
        { segment: 'history',   title: 'Shifts History',   icon: <HistoryIcon /> },
      ],
    },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Learning & Explorer Hub' },
    { segment: 'dashboard/organization/interests',     title: 'Explore Interests', icon: <FavoriteIcon /> },
    { segment: 'dashboard/organization/learning',      title: 'Learning Materials',icon: <SchoolIcon /> },
    { kind: 'divider' as const },
    { segment: 'dashboard/organization/logout',        title: 'Logout',            icon: <LogoutIcon /> },
  ]
}

export function getOwnerNav(progress_percent: number, hasUnreadMessages: boolean) {
  return [
    { kind: 'header' as const, title: 'Profile Settings' },
    { segment: 'dashboard/owner/overview', title: 'Overview', icon: <DashboardIcon /> },
    {
      segment: 'dashboard/owner/onboarding',
      title: 'Profile',
      icon: <ManageAccountsSharpIcon />,
      action: (
        <Chip
          size="small"
          label={`${progress_percent}%`}
          color={progress_percent === 100 ? "success" : "default"}
          sx={{ ml: 0.5, fontWeight: 700 }}
        />
      ),
    },
    { 
      segment: 'dashboard/owner/chat', 
      title: 'Chat', 
      icon: <GroupsIcon />,
      action: hasUnreadMessages ? <NewMessagesChip /> : null,
    },
    { segment: 'dashboard/owner/community-groups', title: 'Community Groups', icon: <GroupsIcon /> },
    { segment: 'dashboard/owner/pharmacy-hub', title: 'Pharmacy Hub', icon: <ForumIcon /> },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Manage Pharmacies and Shifts' },
    { segment: 'dashboard/owner/manage-pharmacies',
      title: 'Manage Pharmacies',
      icon: <MedicationLiquidIcon />,
      children: [
        { segment: 'my-pharmacies', title: 'My Pharmacies', icon: <StoreIcon /> },
        { segment: 'my-chain',      title: 'My Chain',      icon: <CorporateFareIcon /> },
        { segment: 'roster', title: 'Internal Roster', icon: <EventAvailableIcon /> },
      ],
    },
    { segment: 'dashboard/owner/post-shift',     title: 'Post Shift',        icon: <PostAddIcon /> },
    { segment: 'dashboard/owner/shifts',
      title: 'Shifts',
      icon: <AccessTimeIcon />,
      children: [
        { segment: 'active',    title: 'Active Shifts',    icon: <PlayArrowIcon /> },
        { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
        { segment: 'history',   title: 'Shifts History',   icon: <HistoryIcon /> },
      ],
    },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Learning & Explorer Hub' },
    { segment: 'dashboard/owner/interests',     title: 'Explore Interests', icon: <FavoriteIcon /> },
    { segment: 'dashboard/owner/learning',      title: 'Learning Materials',icon: <SchoolIcon /> },
    { kind: 'divider' as const },
    { segment: 'dashboard/owner/logout',        title: 'Logout',            icon: <LogoutIcon /> },
  ]
}


export function getOtherStaffNavDynamic(progress_percent: number, workspace: 'internal' | 'platform', hasUnreadMessages: boolean) {
  // 1. Define dynamic children for the "Shifts" section, changing based on workspace
  const shiftsChildren = workspace === 'internal'
    ? [
        { segment: 'roster', title: 'My Roster', icon: <EventAvailableIcon /> },
        { segment: 'community', title: 'Community Shifts', icon: <GroupsIcon /> },
        { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
        { segment: 'history', title: 'Shifts History', icon: <HistoryIcon /> },
      ]
    : [
        { segment: 'public',    title: 'Public Shifts',    icon: <PublicIcon /> },
        { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
        { segment: 'history',   title: 'Shifts History',   icon: <HistoryIcon /> },
      ];

  // 2. Build and return the navigation array, matching the structure of the pharmacist nav
  return [
    // -- Profile Section --
    { kind: 'header' as const, title: 'Profile and Availability' },
    { segment: 'dashboard/otherstaff/overview', title: 'Overview', icon: <DashboardIcon /> },
    // {
    //   segment: 'dashboard/otherstaff/onboarding',
    //   title: 'Profile',
    //   icon: <ManageAccountsSharpIcon />,
    //   action: (
    //     <Chip
    //       size="small"
    //       label={`${progress_percent}%`}
    //       color={progress_percent === 100 ? "success" : "default"}
    //       sx={{ ml: 0.5, fontWeight: 700 }}
    //     />
    //   ),
    // },
      {
      segment: 'dashboard/otherstaff/onboarding-v2',
      title: 'Profile',
      icon: <ManageAccountsSharpIcon />,
      action: (
        <Chip
          size="small"
          label={`${progress_percent}%`}
          color={progress_percent === 100 ? "success" : "default"}
          sx={{ ml: 0.5, fontWeight: 700 }}
        />
      ),
    },
    { 
      segment: 'dashboard/otherstaff/chat', 
      title: 'Chat', 
      icon: <GroupsIcon />,
      action: hasUnreadMessages ? <NewMessagesChip /> : null,
    },
    { segment: 'dashboard/otherstaff/community-groups', title: 'Community Groups', icon: <GroupsIcon /> },
    { segment: 'dashboard/otherstaff/pharmacy-hub', title: 'Pharmacy Hub', icon: <ForumIcon /> },
    { segment: 'dashboard/otherstaff/availability', title: 'Set Availability', icon: <EventAvailableIcon /> },

    // -- Divider & Shifts Section --
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Shifts & Invoices' },
    {
      segment: 'dashboard/otherstaff/shifts',
      title: 'Shifts',
      icon: <AccessTimeIcon />,
      children: shiftsChildren,  // <-- Use the dynamic children defined above
    },
    { segment: 'dashboard/otherstaff/invoice', title: 'Manage Invoices', icon: <ReceiptIcon /> },

    // -- Divider & Learning Section --
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Learning & Explorer Hub' },
    { segment: 'dashboard/otherstaff/interests', title: 'Explore Interests', icon: <FavoriteIcon /> },
    { segment: 'dashboard/otherstaff/learning', title: 'Learning Materials', icon: <SchoolIcon /> },

    // -- Divider & Logout --
    { kind: 'divider' as const },
    { segment: 'dashboard/otherstaff/logout', title: 'Logout', icon: <LogoutIcon /> },
  ];
}


export function getPharmacistNavDynamic(progress_percent: number, workspace: 'internal' | 'platform', hasUnreadMessages: boolean) {
  const shiftsChildren = workspace === 'internal' 
    ? [
        { segment: 'roster', title: 'My Roster', icon: <EventAvailableIcon /> },
        { segment: 'community', title: 'Community Shifts', icon: <GroupsIcon /> },
        { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
        { segment: 'history', title: 'Shifts History', icon: <HistoryIcon /> },

      ]
    : [
        { segment: 'public', title: 'Public Shifts', icon: <PublicIcon /> },
        { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
        { segment: 'history', title: 'Shifts History', icon: <HistoryIcon /> },
      ];

  return [
    { kind: 'header' as const, title: 'Profile and Availability' },
    { segment: 'dashboard/pharmacist/overview', title: 'Overview', icon: <DashboardIcon /> },
    // NEW: V2 onboarding — single sidebar item (tabs live inside the page)
    {
      segment: 'dashboard/pharmacist/onboarding-v2',
      title: 'Profile',
      icon: <ManageAccountsSharpIcon />,
      action: (
        <Chip
          size="small"
          label={`${progress_percent}%`}
          color={progress_percent === 100 ? "success" : "default"}
          sx={{ ml: 0.5, fontWeight: 700 }}
        />
      ),
    },
    { 
      segment: 'dashboard/pharmacist/chat', 
      title: 'Chat', 
      icon: <GroupsIcon />,
      action: hasUnreadMessages ? <NewMessagesChip /> : null,
    },
    ...(workspace === 'internal'
      ? [
          { segment: 'dashboard/pharmacist/community-groups', title: 'Community Groups', icon: <GroupsIcon /> },
          { segment: 'dashboard/pharmacist/pharmacy-hub', title: 'Pharmacy Hub', icon: <ForumIcon /> },
        ]
      : []),

    { segment: 'dashboard/pharmacist/availability', title: 'Set Availability', icon: <EventAvailableIcon /> },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Shifts & Invoices' },
    { 
      segment: 'dashboard/pharmacist/shifts',
      title: 'Shifts',
      icon: <AccessTimeIcon />,
      children: shiftsChildren,
    },
    { segment: 'dashboard/pharmacist/invoice', title: 'Manage Invoices', icon: <ReceiptIcon /> },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Learning & Explorer Hub' },
    { segment: 'dashboard/pharmacist/interests', title: 'Explore Interests', icon: <FavoriteIcon /> },
    { segment: 'dashboard/pharmacist/learning', title: 'Learning Materials', icon: <SchoolIcon /> },
    { kind: 'divider' as const },
    { segment: 'dashboard/pharmacist/logout', title: 'Logout', icon: <LogoutIcon /> },
  ];
}


export function getExplorerNav(progress_percent: number, hasUnreadMessages: boolean) {
  return [
    { kind: 'header' as const, title: 'Profile settings' },
    { segment: 'dashboard/explorer/overview', title: 'Overview', icon: <DashboardIcon /> },
    {
      segment: 'dashboard/explorer/onboarding',
      title: 'Profile',
      icon: <ManageAccountsSharpIcon />,
      action: (
        <Chip
          size="small"
          label={`${progress_percent}%`}
          color={progress_percent === 100 ? "success" : "default"}
          sx={{ ml: 0.5, fontWeight: 700 }}
        />
      ),
    },

          {
      segment: 'dashboard/explorer/onboarding-v2',
      title: 'Profile',
      icon: <ManageAccountsSharpIcon />,
      action: (
        <Chip
          size="small"
          label={`${progress_percent}%`}
          color={progress_percent === 100 ? "success" : "default"}
          sx={{ ml: 0.5, fontWeight: 700 }}
        />
      ),
    },

    { 
      segment: 'dashboard/explorer/chat', 
      title: 'Chat', 
      icon: <GroupsIcon />,
      action: hasUnreadMessages ? <NewMessagesChip /> : null,
    },
    { kind: 'divider' as const },
    { kind: 'header' as const, title: 'Learning & Explorer Hub' },
    { segment: 'dashboard/explorer/interests',     title: 'Explore Interests', icon: <FavoriteIcon /> },
    { segment: 'dashboard/explorer/learning',      title: 'Learning Materials',icon: <SchoolIcon /> },
    { kind: 'divider' as const },
    { segment: 'dashboard/explorer/logout',        title: 'Logout',            icon: <LogoutIcon /> },
  ]
}
