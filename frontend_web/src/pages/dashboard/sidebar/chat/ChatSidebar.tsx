import { FC, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, Divider, IconButton, Tooltip, TextField, InputAdornment } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { ChatListItem } from './ChatListItem';
import type { ChatRoom, PharmacyRef, CachedMember } from './types';

type Membership = {
  id: number;
  pharmacy: number;
  user: { id: number };
};

interface ChatSidebarProps {
  rooms: ChatRoom[];
  pharmacies: PharmacyRef[];
  myMemberships: Membership[];
  activeRoomId: number | null;
  onSelectRoom: (details: { type: 'dm' | 'group'; id: number } | { type: 'pharmacy'; id: number }) => void;
  participantCache: Record<number, CachedMember>;
  getLatestMessage: (roomId: number) => { body: string } | undefined;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onEdit: (room: ChatRoom) => void;
  onDelete: (roomId: number, roomName: string) => void;
  canCreateChat: boolean;
}

export const ChatSidebar: FC<ChatSidebarProps> = ({
  rooms,
  pharmacies,
  myMemberships,
  activeRoomId,
  onSelectRoom,
  participantCache,
  getLatestMessage,
  isCollapsed,
  onToggleCollapse,
  onNewChat,
  onEdit,
  onDelete,
  canCreateChat,
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

  // This function is now stable and uses the correct cache.
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
        return room.title || 'Direct Message';
    }
    const partnerMembershipId = room.participant_ids?.find(pId => pId !== myMembershipInRoom.id);
    if (partnerMembershipId) {
        // --- THIS IS THE KEY CHANGE ---
        // It now looks in the persistent participantCache to find the user's name.
        const partnerDetails = participantCache[partnerMembershipId];
        if (partnerDetails?.details) {
            const fullName = `${partnerDetails.details.first_name || ''} ${partnerDetails.details.last_name || ''}`.trim();
            // It uses the invited_name as a reliable fallback.
            return fullName || partnerDetails.invited_name || partnerDetails.details.email || 'Direct Message';
        }
    }
    return room.title || 'Direct Message';
  }, [pharmacies, myMemberships, participantCache]);
    
  // This logic correctly de-duplicates rooms.
  const { groupChats, dmChats } = useMemo(() => {
    const sortedRooms = [...rooms].sort((a, b) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    const filteredBySearch = searchQuery
      ? sortedRooms.filter(room => getDisplayName(room).toLowerCase().includes(searchQuery.toLowerCase()))
      : sortedRooms;
    
    const finalGroupChats: ChatRoom[] = [];
    const finalDmChats: ChatRoom[] = [];
    const seenPharmacyIds = new Set<number>();
    const seenBrokenGroupTitles = new Set<string>();

    for (const room of filteredBySearch) {
      if (room.type === 'GROUP') {
        if (room.pharmacy != null) {
          if (!seenPharmacyIds.has(room.pharmacy)) {
            finalGroupChats.push(room);
            seenPharmacyIds.add(room.pharmacy);
          }
        } else {
          if (!seenBrokenGroupTitles.has(room.title)) {
            finalGroupChats.push(room);
            seenBrokenGroupTitles.add(room.title);
          }
        }
      } else if (room.type === 'DM') {
        finalDmChats.push(room);
      }
    }
    return {
      groupChats: finalGroupChats,
      dmChats: finalDmChats,
    };
  }, [rooms, searchQuery, getDisplayName]);

  const chatsToDisplay = useMemo(() => {
    if (filter === 'group') return { groupChats, dmChats: [] };
    if (filter === 'dm') return { groupChats: [], dmChats };
    return { groupChats, dmChats };
  }, [filter, groupChats, dmChats]);

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
              />
            ))}
          </>
        )}
        {chatsToDisplay.dmChats.length > 0 && (
          <>
            {filter === 'all' && chatsToDisplay.groupChats.length > 0 && !isCollapsed && <Divider sx={{ my: 1 }} />}
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
              />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};