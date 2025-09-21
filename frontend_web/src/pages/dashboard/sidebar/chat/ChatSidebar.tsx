import { FC, useMemo, useState } from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import { ChatListItem } from './ChatListItem';
// FIX: Changed to a type-only import to resolve the warning
import type { ChatRoom, MemberCache, PharmacyRef } from './types';

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
  onSelectRoom: (details: { type: 'dm' | 'group'; id: number }) => void;
  memberCache: MemberCache;
  getLatestMessage: (roomId: number) => { body: string } | undefined;
}

export const ChatSidebar: FC<ChatSidebarProps> = ({
  rooms,
  pharmacies,
  myMemberships,
  activeRoomId,
  onSelectRoom,
  memberCache,
  getLatestMessage,
}) => {
  const [filter, setFilter] = useState<'all' | 'group' | 'dm'>('all');

  const { groupChats, dmChats } = useMemo(() => {
    const seenPharmacyGroup = new Set<number>();
    const uniqueRooms: ChatRoom[] = [];
    const sortedRooms = [...rooms].sort((a, b) => 
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    for (const room of sortedRooms) {
      if (room.type === 'GROUP') {
        if (!seenPharmacyGroup.has(room.pharmacy)) {
          uniqueRooms.push(room);
          seenPharmacyGroup.add(room.pharmacy);
        }
      } else {
        uniqueRooms.push(room);
      }
    }
    return {
      groupChats: uniqueRooms.filter(r => r.type === 'GROUP'),
      dmChats: uniqueRooms.filter(r => r.type === 'DM'),
    };
  }, [rooms]);

  const chatsToDisplay = useMemo(() => {
    if (filter === 'group') return { groupChats, dmChats: [] };
    if (filter === 'dm') return { groupChats: [], dmChats };
    return { groupChats, dmChats }; // 'all'
  }, [filter, groupChats, dmChats]);

const getDisplayName = (room: ChatRoom): string => {
    if (room.type === 'GROUP') {
      const pharmacy = pharmacies.find(p => p.id === room.pharmacy);
      return room.title || pharmacy?.name || 'Group Chat';
    }
    // For DMs:
    // First, try to use the title from the backend, as it's definitive.
    if (room.title && room.title !== 'Direct Message' && !room.title.startsWith('DM between')) {
        return room.title;
    }

    // If the title is generic, fall back to calculating it on the client side.
    // Find which of my memberships is in this specific room.
    const myMembershipInRoom = myMemberships.find(myMem => room.participant_ids?.includes(myMem.id));

    if (!myMembershipInRoom) {
        return room.title || 'Direct Message'; // Can't identify my role here
    }

    // Find the participant ID that is not mine.
    const partnerMembershipId = room.participant_ids?.find(pId => pId !== myMembershipInRoom.id);

    if (partnerMembershipId && memberCache[room.pharmacy]) {
        const partnerUser = memberCache[room.pharmacy][partnerMembershipId];
        if (partnerUser) {
            const fullName = `${partnerUser.first_name || ''} ${partnerUser.last_name || ''}`.trim();
            // Return full name, or email as a fallback
            return fullName || partnerUser.email || 'Direct Message';
        }
    }

    // Final fallback
    return room.title || 'Direct Message';
  };

  
  return (
    <Box className="chatpage-sidebar">
      <Box className="sidebar-header">
        <Typography variant="h6" fontWeight={700}>Messages</Typography>
      </Box>

      <Box className="sidebar-filter" sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant={filter === 'all' ? 'contained' : 'outlined'} onClick={() => setFilter('all')}>All</Button>
        <Button size="small" variant={filter === 'group' ? 'contained' : 'outlined'} onClick={() => setFilter('group')}>Group</Button>
        <Button size="small" variant={filter === 'dm' ? 'contained' : 'outlined'} onClick={() => setFilter('dm')}>DM</Button>
      </Box>

      <Box className="sidebar-list">
        {chatsToDisplay.groupChats.length > 0 && (
          <>
            <Box className="sidebar-section-label">MY COMMUNITY</Box>
            {chatsToDisplay.groupChats.map(room => (
              <ChatListItem
                key={`group-${room.id}`}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={(roomId) => onSelectRoom({ type: 'group', id: roomId })}
                previewOverride={getLatestMessage(room.id)?.body}
                displayName={getDisplayName(room)}
              />
            ))}
          </>
        )}

        {chatsToDisplay.dmChats.length > 0 && (
          <>
            {filter === 'all' && chatsToDisplay.groupChats.length > 0 && <Divider sx={{ my: 1 }} />}
            <Box className="sidebar-section-label">DIRECT MESSAGES</Box>
            {chatsToDisplay.dmChats.map(room => (
              <ChatListItem
                key={`dm-${room.id}`}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={(roomId) => onSelectRoom({ type: 'dm', id: roomId })}
                previewOverride={getLatestMessage(room.id)?.body}
                displayName={getDisplayName(room)}
              />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};