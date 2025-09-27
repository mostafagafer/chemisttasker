import { FC, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, Divider, IconButton, Tooltip, TextField, InputAdornment } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { ChatListItem } from './ChatListItem';
import type { ChatRoom, PharmacyRef, CachedMember, ChatMessage, MemberCache } from './types';

type Membership = {
  id: number;
  pharmacy: number;
  user: { id: number };
  role?: string; 
};

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
  currentUserId?: number;   // ← add this

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
}) => {
  const [filter, setFilter] = useState<'all' | 'group' | 'dm'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      return ['PHARMACY_ADMIN', 'PHARMACY_OWNER'].includes(role);
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
    
  const { pinnedChats, groupChats, dmChats } = useMemo(() => {
    const sortedRooms = [...rooms].sort((a, b) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    const filteredBySearch = searchQuery
      ? sortedRooms.filter(room => getDisplayName(room).toLowerCase().includes(searchQuery.toLowerCase()))
      : sortedRooms;
    
    const finalPinned: ChatRoom[] = [];
    const finalGroupChats: ChatRoom[] = [];
    const finalDmChats: ChatRoom[] = [];
    const seenPharmacyIds = new Set<number>();
    
    for (const room of filteredBySearch) {
      if (room.is_pinned) {
        finalPinned.push(room);
        continue;
      }

      if (room.type === 'GROUP') {
        if (room.pharmacy != null) {
          if (!seenPharmacyIds.has(room.pharmacy)) {
            finalGroupChats.push(room);
            seenPharmacyIds.add(room.pharmacy);
          }
        } else {
          finalGroupChats.push(room);
        }
      } else if (room.type === 'DM') {
        finalDmChats.push(room);
      }
    }
    return { pinnedChats: finalPinned, groupChats: finalGroupChats, dmChats: finalDmChats, };
  }, [rooms, searchQuery, getDisplayName]);

  const chatsToDisplay = useMemo(() => {
    if (filter === 'group') return { pinnedChats, groupChats, dmChats: [] };
    if (filter === 'dm') return { pinnedChats, groupChats: [], dmChats };
    return { pinnedChats, groupChats, dmChats };
  }, [filter, pinnedChats, groupChats, dmChats]);

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
      {!isCollapsed && (
        <Box className="sidebar-filter" sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant={filter === 'all' ? 'contained' : 'outlined'} onClick={() => setFilter('all')}>All</Button>
            <Button size="small" variant={filter === 'group' ? 'contained' : 'outlined'} onClick={() => setFilter('group')}>Group</Button>
            <Button size="small" variant={filter === 'dm' ? 'contained' : 'outlined'} onClick={() => setFilter('dm')}>DM</Button>
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