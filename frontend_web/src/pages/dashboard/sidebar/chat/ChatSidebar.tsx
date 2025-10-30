import { FC, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, Divider, IconButton, Tooltip, TextField, InputAdornment } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { ChatListItem } from './ChatListItem';
import type { ChatRoom, PharmacyRef, CachedMember, ChatMessage, MemberCache } from './types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

type Membership = {
  id: number;
  pharmacy: number;
  user: { id: number };
  role?: string; 
};

type SidebarFilter = 'all' | 'group' | 'dm' | 'shift';

interface ChatSidebarProps {
  rooms: ChatRoom[];
  pharmacies: PharmacyRef[];
  myMemberships: Membership[];
  activeRoomId: number | null;
  onSelectRoom: (details: { type: 'dm' | 'group'; id: number } | { type: 'pharmacy'; id: number }) => void;
  participantCache: Record<number, CachedMember & { is_admin?: boolean }>;
  memberCache: MemberCache;
  getLatestMessage: (roomId: number) => ChatMessage | undefined;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onEdit: (room: ChatRoom) => void;
  onDelete: (roomId: number, roomName: string) => void;
  canCreateChat: boolean;
  currentUserId?: number;   // current user id for admin checks
  initialFilter?: SidebarFilter;

}

export const ChatSidebar: FC<ChatSidebarProps> = ({
  rooms,
  pharmacies,
  myMemberships,
  activeRoomId,
  onSelectRoom,
  participantCache,
  memberCache,
  getLatestMessage,
  isCollapsed,
  onToggleCollapse,
  onNewChat,
  onEdit,
  onDelete,
  canCreateChat,
  currentUserId,
  initialFilter,
}) => {
  const [filter, setFilter] = useState<SidebarFilter>(initialFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

    // Only group admins can edit/delete.
  // Custom group (no pharmacy): admin iff my participant row has is_admin === true
  const isRoomAdmin = useCallback((room: ChatRoom): boolean => {
    if (room.type !== 'GROUP') return true; // DMs unaffected

    // --- Custom group: if I created it, I'm admin (no membership lookup needed) ---
    if (!room.pharmacy) {
      const creatorUserId =
        (room as any).created_by_user_id ??
        (room as any).created_by_id ??
        (typeof (room as any).created_by === 'number' ? (room as any).created_by : undefined);
      if (currentUserId && creatorUserId && Number(creatorUserId) === Number(currentUserId)) {
        return true; // creator can edit/delete
      }
    }

    // --- derive my membership id robustly ---
    let myMemId = room.my_membership_id || null;
    if (!myMemId && Array.isArray(room.participant_ids) && room.participant_ids.length) {
      const mine = myMemberships.find(m => room.participant_ids.includes(m.id));
      myMemId = mine?.id ?? null;
    }
    if (!myMemId) return false;

    // Community (pharmacy) groups: role-based admin (Owner or Admin)
    if (room.pharmacy) {
      const myMem = myMemberships.find(m => m.id === myMemId);
      const role = (myMem?.role || '').toUpperCase();
      return ['PHARMACY_ADMIN', 'OWNER'].includes(role);
    }

    // --- Custom groups: prefer per-participant admin flag; creator handled above ---
    const entry = participantCache[myMemId];
    if (entry && typeof entry.is_admin === 'boolean') {
      return entry.is_admin;
    }
    return false;
  }, [myMemberships, participantCache, currentUserId]);

  const getDisplayName = useCallback((room: ChatRoom): string => {
    if (room.type === 'GROUP') {
        if (room.pharmacy) {
            const pharmacy = pharmacies.find(p => p.id === room.pharmacy);
            return pharmacy?.name || room.title || 'Group Chat';
        }
        return room.title || 'Group Chat';
    }
const myMembershipInRoom = myMemberships.find(myMem => room.participant_ids?.includes(myMem.id));
if (!myMembershipInRoom) {
  const t = (room.title || '').trim();
  return !t || /^group\s*chat$/i.test(t) ? 'Direct Message' : t;
}

// Primary: via participants
const partnerMembershipId = room.participant_ids?.find(pId => pId !== myMembershipInRoom.id);
if (partnerMembershipId) {
  // 1) participantCache (fast path)
  const pc = participantCache[partnerMembershipId]?.details;
  if (pc) {
    const full = `${pc.first_name || ''} ${pc.last_name || ''}`.trim();
    return full || pc.email || 'Direct Message';
  }
  // 2) memberCache (covers cases where your participant row was deleted)
  for (const pid in memberCache) {
    const rec = memberCache[Number(pid)]?.[partnerMembershipId];
    if (rec?.details) {
      const u = rec.details;
      const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      return full || u.email || 'Direct Message';
    }
  }
}

// 3) Fallback from latest message sender (has user_details once messages were fetched)
const last = getLatestMessage(room.id);
if (last && last.sender?.user_details && last.sender.id !== myMembershipInRoom.id) {
  const u = last.sender.user_details;
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return full || u.email || 'Direct Message';
}

// Final fallback
return 'Direct Message';
  }, [pharmacies, myMemberships, participantCache]);

  const roomCategory = useCallback((room: ChatRoom): SidebarFilter => {
    if (room.type === 'DM') return 'dm';
    const rawKind =
      ((room as any)?.kind as string | undefined) ??
      ((room as any)?.category as string | undefined) ??
      ((room as any)?.chat_type as string | undefined);
    if (rawKind && rawKind.toLowerCase().includes('shift')) return 'shift';
    if ((room as any)?.shift || (room as any)?.shift_id) return 'shift';
    const inferredTitle = (room.title || '').toLowerCase();
    if (!room.pharmacy && inferredTitle.includes('shift')) return 'shift';
    return 'group';
  }, []);

  const filteredRooms = useMemo(() => {
    if (!debouncedQuery) return rooms;
    return rooms.filter(room => {
      const name = getDisplayName(room).toLowerCase();
      if (name.includes(debouncedQuery)) return true;
      const preview = (getLatestMessage(room.id)?.body || room.last_message?.body || '').toLowerCase();
      return preview.includes(debouncedQuery);
    });
  }, [rooms, debouncedQuery, getDisplayName, getLatestMessage]);

  const sortedRooms = useMemo(
    () =>
      [...filteredRooms].sort(
        (a, b) => dayjs.utc(b.updated_at || 0).valueOf() - dayjs.utc(a.updated_at || 0).valueOf()
      ),
    [filteredRooms]
  );

  const matchesFilter = useCallback(
    (room: ChatRoom) => {
      if (filter === 'all') return true;
      return roomCategory(room) === filter;
    },
    [filter, roomCategory]
  );

  const { pinnedChats, groupChats, shiftChats, dmChats } = useMemo(() => {
    const finalPinned: ChatRoom[] = [];
    const finalGroupChats: ChatRoom[] = [];
    const finalShiftChats: ChatRoom[] = [];
    const finalDmChats: ChatRoom[] = [];

    for (const room of sortedRooms) {
      if (!matchesFilter(room)) continue;

      if (room.is_pinned) {
        finalPinned.push(room);
        continue;
      }

      const category = roomCategory(room);
      if (category === 'group') {
        finalGroupChats.push(room);
      } else if (category === 'shift') {
        finalShiftChats.push(room);
      } else {
        finalDmChats.push(room);
      }
    }

    return { pinnedChats: finalPinned, groupChats: finalGroupChats, shiftChats: finalShiftChats, dmChats: finalDmChats };
  }, [sortedRooms, matchesFilter, roomCategory]);

  const unreadRooms = useMemo(
    () => sortedRooms.filter(room => (room.unread_count || 0) > 0),
    [sortedRooms]
  );

  const chatsToDisplay = useMemo(() => {
    if (filter === 'group') return { pinnedChats, groupChats, shiftChats: [], dmChats: [] };
    if (filter === 'dm') return { pinnedChats, groupChats: [], shiftChats: [], dmChats };
    if (filter === 'shift') return { pinnedChats, groupChats: [], shiftChats, dmChats: [] };
    return { pinnedChats, groupChats, shiftChats, dmChats };
  }, [filter, pinnedChats, groupChats, shiftChats, dmChats]);

  const renderUnreadAvatar = useCallback(
    (room: ChatRoom) => {
      const preview = getLatestMessage(room.id)?.body || room.last_message?.body || 'No messages yet.';
      const initials =
        getDisplayName(room)
          .split(/\s+/)
          .map(part => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?';

      return (
        <Tooltip
          key={`collapsed-unread-${room.id}`}
          title={
            <Box sx={{ maxWidth: 260 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {getDisplayName(room)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {preview}
              </Typography>
            </Box>
          }
          arrow
          placement="right"
        >
          <IconButton
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              position: 'relative',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
            onClick={() =>
              onSelectRoom({ type: room.type === 'DM' ? 'dm' : 'group', id: room.id })
            }
            aria-label={`Open ${getDisplayName(room)}`}
          >
            <Typography variant="button" sx={{ fontWeight: 700 }}>
              {initials}
            </Typography>
            {(room.unread_count || 0) > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: '50%',
                  bgcolor: 'error.main',
                  color: 'common.white',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 0.5,
                  border: theme => `2px solid ${theme.palette.background.paper}`,
                }}
              >
                {room.unread_count}
              </Box>
            )}
          </IconButton>
        </Tooltip>
      );
    },
    [getDisplayName, getLatestMessage, onSelectRoom]
  );

  return (
    <Box className={`chatpage-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <Box className="sidebar-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexShrink: 1 }}>
            <Tooltip title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"} placement="right">
                <IconButton onClick={onToggleCollapse} className="sidebar-toggle-button" size="small">
                    <ChevronLeftIcon />
                </IconButton>
            </Tooltip>
            {!isCollapsed && <Typography variant="h6" fontWeight={700} noWrap>Messages</Typography>}
        </Box>
        {!isCollapsed && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                    size="small"
                    placeholder="Search (Ctrl+K)"
                    variant="outlined"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    inputRef={searchInputRef}
                    InputProps={{
                        startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                        ),
                    }}
                    sx={{ width: '150px' }}
                />
                {canCreateChat && (
                  <IconButton
                    color="primary"
                    onClick={onNewChat}
                    sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                  >
                      <AddIcon />
                  </IconButton>
                )}
            </Box>
        )}
      </Box>
      {isCollapsed && unreadRooms.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            py: 2,
          }}
          aria-label="Unread conversations"
        >
          {unreadRooms.map(renderUnreadAvatar)}
        </Box>
      )}
      {!isCollapsed && (
        <Box className="sidebar-filter" sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant={filter === 'all' ? 'contained' : 'outlined'} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>
              All
            </Button>
            <Button size="small" variant={filter === 'group' ? 'contained' : 'outlined'} onClick={() => setFilter('group')} aria-pressed={filter === 'group'}>
              Group
            </Button>
            <Button size="small" variant={filter === 'dm' ? 'contained' : 'outlined'} onClick={() => setFilter('dm')} aria-pressed={filter === 'dm'}>
              DM
            </Button>
            <Button size="small" variant={filter === 'shift' ? 'contained' : 'outlined'} onClick={() => setFilter('shift')} aria-pressed={filter === 'shift'}>
              Shift
            </Button>
        </Box>
      )}
      <Box className="sidebar-list">
        {chatsToDisplay.pinnedChats.length > 0 && (
          <>
            {!isCollapsed && <Box className="sidebar-section-label">PINNED</Box>}
            {chatsToDisplay.pinnedChats.map(room => (
              <ChatListItem
                key={`pinned-${room.id}`}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={(roomId) => onSelectRoom({ type: room.type.toLowerCase() as 'group' | 'dm', id: roomId })}
                previewOverride={getLatestMessage(room.id)?.body}
                displayName={getDisplayName(room)}
                isCollapsed={isCollapsed}
                onEdit={onEdit}
                onDelete={onDelete}
                canEditDelete={isRoomAdmin(room)}
              />
            ))}
            {!isCollapsed && <Divider sx={{ my: 1 }} />}
          </>
        )}
        {chatsToDisplay.shiftChats.length > 0 && (
          <>
            {!isCollapsed && <Box className="sidebar-section-label">SHIFTS</Box>}
            {chatsToDisplay.shiftChats.map(room => (
              <ChatListItem
                key={`shift-${room.id}`}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={(roomId) => onSelectRoom({ type: 'group', id: roomId })}
                previewOverride={getLatestMessage(room.id)?.body}
                displayName={getDisplayName(room)}
                isCollapsed={isCollapsed}
                onEdit={onEdit}
                onDelete={onDelete}
                canEditDelete={isRoomAdmin(room)}
              />
            ))}
            {!isCollapsed && <Divider sx={{ my: 1 }} />}
          </>
        )}
        {chatsToDisplay.groupChats.length > 0 && (
          <>
            {!isCollapsed && <Box className="sidebar-section-label">MY COMMUNITY</Box>}
            {chatsToDisplay.groupChats.map(room => (
              <ChatListItem
                key={`group-${room.id}`}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={(roomId) => onSelectRoom({ type: 'group', id: roomId })}
                previewOverride={getLatestMessage(room.id)?.body}
                displayName={getDisplayName(room)}
                isCollapsed={isCollapsed}
                onEdit={onEdit}
                onDelete={onDelete}
                canEditDelete={isRoomAdmin(room)}

              />
            ))}
          </>
        )}
        {chatsToDisplay.dmChats.length > 0 && (
          <>
            {filter === 'all' && (chatsToDisplay.groupChats.length > 0 || chatsToDisplay.pinnedChats.length > 0) && !isCollapsed && <Divider sx={{ my: 1 }} />}
            {!isCollapsed && <Box className="sidebar-section-label">DIRECT MESSAGES</Box>}
            {chatsToDisplay.dmChats.map(room => (
              <ChatListItem
                key={`dm-${room.id}`}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={(roomId) => onSelectRoom({ type: 'dm', id: roomId })}
                previewOverride={getLatestMessage(room.id)?.body}
                displayName={getDisplayName(room)}
                isCollapsed={isCollapsed}
                onEdit={onEdit}
                onDelete={onDelete}
                canEditDelete={isRoomAdmin(room)}
              />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};
