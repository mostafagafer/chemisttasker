// src/navigation.tsx
import type { Navigation } from '@toolpad/core'
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
import PlayArrowIcon    from '@mui/icons-material/PlayArrow';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import HistoryIcon      from '@mui/icons-material/History';
import ReceiptIcon from '@mui/icons-material/Receipt';



export const ORGANIZATION_NAV: Navigation = [
  { kind: 'header', title: 'Organization Management' },
  { segment: 'dashboard/organization/overview', title: 'Overview',        icon: <GroupsIcon /> },
  { segment: 'dashboard/organization/invite',   title: 'Invite Staff',    icon: <ManageAccountsSharpIcon /> },
  { segment: 'dashboard/organization/claim',    title: 'Claim Pharmacies',icon: <StoreIcon /> },
  { kind: 'divider' },
  { kind: 'header', title: 'Manage Pharmacies and Shifts' },
  { segment: 'dashboard/organization/manage-pharmacies',
    title: 'Manage Pharmacies',
    icon: <MedicationLiquidIcon />,
    children: [
      { segment: 'my-pharmacies', title: 'My Pharmacies', icon: <StoreIcon /> },
      { segment: 'my-chain',      title: 'My Chain',      icon: <CorporateFareIcon /> },
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
  { kind: 'divider' },
  { kind: 'header', title: 'Learning & Explorer Hub' },
  { segment: 'dashboard/organization/interests',     title: 'Explore Interests', icon: <FavoriteIcon /> },
  { segment: 'dashboard/organization/learning',      title: 'Learning Materials',icon: <SchoolIcon /> },
  { kind: 'divider' },
  { segment: 'dashboard/organization/logout',        title: 'Logout',            icon: <LogoutIcon /> },
]

export const OWNER_NAV: Navigation = [
  { kind: 'header', title: 'Profile Settings' },
  { segment: 'dashboard/owner/overview',      title: 'Overview',           icon: <DashboardIcon /> },
  { segment: 'dashboard/owner/onboarding',    title: 'Profile',            icon: <ManageAccountsSharpIcon /> },
  { kind: 'divider' },
  { kind: 'header', title: 'Manage Pharmacies and Shifts' },
  { segment: 'dashboard/owner/manage-pharmacies',
    title: 'Manage Pharmacies',
    icon: <MedicationLiquidIcon />,
    children: [
      { segment: 'my-pharmacies', title: 'My Pharmacies', icon: <StoreIcon /> },
      { segment: 'my-chain',      title: 'My Chain',      icon: <CorporateFareIcon /> },
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
  { kind: 'divider' },
  { kind: 'header', title: 'Learning & Explorer Hub' },
  { segment: 'dashboard/owner/interests',     title: 'Explore Interests', icon: <FavoriteIcon /> },
  { segment: 'dashboard/owner/learning',      title: 'Learning Materials',icon: <SchoolIcon /> },
  { kind: 'divider' },
  { segment: 'dashboard/owner/logout',        title: 'Logout',            icon: <LogoutIcon /> },
]

export const PHARMACIST_NAV: Navigation = [
  { kind: 'header', title: 'Profile and Availability' },
  { segment: 'dashboard/pharmacist/overview',     title: 'Overview',           icon: <DashboardIcon /> },
  { segment: 'dashboard/pharmacist/onboarding',   title: 'Profile',            icon: <ManageAccountsSharpIcon /> },
  { segment: 'dashboard/pharmacist/availability', title: 'Set Availability', icon: <EventAvailableIcon /> },
  { kind: 'divider' },
  { kind: 'header', title: 'Shifts & Invoices' },
  { segment: 'dashboard/pharmacist/shifts',
    title: 'Shifts',
    icon: <AccessTimeIcon />,
    children: [
      { segment: 'public',    title: 'Public Shifts',    icon: <PublicIcon /> },
      { segment: 'community', title: 'Community Shifts', icon: <GroupsIcon /> },
      { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
      { segment: 'history',   title: 'Shifts History',   icon: <HistoryIcon /> },
    ],
  },
  { segment: 'dashboard/pharmacist/invoice', title: 'Manage Invoices', icon: <ReceiptIcon /> },


  { kind: 'divider' },
  { kind: 'header', title: 'Learning & Explorer Hub' },
  { segment: 'dashboard/pharmacist/interests',    title: 'Explore Interests', icon: <FavoriteIcon /> },
  { segment: 'dashboard/pharmacist/learning',     title: 'Learning Materials',icon: <SchoolIcon /> },
  { kind: 'divider' },
  { segment: 'dashboard/pharmacist/logout',       title: 'Logout',            icon: <LogoutIcon /> },
]

export const OTHERSTAFF_NAV: Navigation = [
  { kind: 'header', title: 'Profile and Availability' },
  { segment: 'dashboard/otherstaff/overview',     title: 'Overview',   icon: <DashboardIcon /> },
  { segment: 'dashboard/otherstaff/onboarding',   title: 'Profile',    icon: <ManageAccountsSharpIcon /> },
  { segment: 'dashboard/otherstaff/availability', title: 'Set Availability', icon: <EventAvailableIcon /> },
  { kind: 'divider' },
  { kind: 'header', title: 'Shifts & Invoices' },
  { segment: 'dashboard/otherstaff/shifts',
    title: 'Shifts',
    icon: <AccessTimeIcon />,
    children: [
      { segment: 'public',    title: 'Public Shifts',    icon: <PublicIcon /> },
      { segment: 'community', title: 'Community Shifts', icon: <GroupsIcon /> },
      { segment: 'confirmed', title: 'Confirmed Shifts', icon: <CheckCircleIcon /> },
      { segment: 'history',   title: 'Shifts History',   icon: <HistoryIcon /> },
    ],
  },
  { segment: 'dashboard/otherstaff/invoice', title: 'Manage Invoices', icon: <ReceiptIcon /> },
  { kind: 'divider' },
  { kind: 'header', title: 'Learning & Explorer Hub' },
  { segment: 'dashboard/otherstaff/interests',    title: 'Explore Interests', icon: <FavoriteIcon /> },
  { segment: 'dashboard/otherstaff/learning',     title: 'Learning Materials',icon: <SchoolIcon /> },
  { kind: 'divider' },
  { segment: 'dashboard/otherstaff/logout',       title: 'Logout',            icon: <LogoutIcon /> },
]

export const EXPLORER_NAV: Navigation = [
  { kind: 'header', title: 'Profile settings' },
  { segment: 'dashboard/explorer/overview',   title: 'Overview', icon: <DashboardIcon /> },
  { segment: 'dashboard/explorer/onboarding', title: 'Profile',  icon: <ManageAccountsSharpIcon /> },
  { kind: 'divider' },
  { segment: 'dashboard/explorer/logout',     title: 'Logout',   icon: <LogoutIcon /> },
]
