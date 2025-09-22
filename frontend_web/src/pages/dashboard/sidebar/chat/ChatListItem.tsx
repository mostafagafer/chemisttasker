import { FC } from 'react';
import { Box, Typography} from '@mui/material';
import { ChatRoom } from './types';

const initials = (text: string) => {
  const parts = (text || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

interface ChatListItemProps {
  room: ChatRoom;
  isActive: boolean;
  onSelect: (roomId: number) => void;
  previewOverride?: string;
  // FIX: Add a prop to receive the final, calculated display name.
  displayName: string;
}

export const ChatListItem: FC<ChatListItemProps> = ({
  room,
  isActive,
  onSelect,
  previewOverride,
  displayName, // FIX: Use the new prop
}) => {
  const lastMessage = room.last_message;
  const preview =
    (previewOverride && previewOverride.trim()) ||
    (lastMessage?.body?.trim()) ||
    (lastMessage ? '📎 Attachment' : 'No messages yet.'); // Show 'Attachment' if there's a last message with no body


  return (
    <Box
      onClick={() => onSelect(room.id)}
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
        px: 1.25,
        py: 1.0,
        borderRadius: 2,
        cursor: 'pointer',
        bgcolor: isActive ? 'action.hover' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      className="sidebar-item"
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: '#fff',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        className="avatar"
      >
        {/* FIX: Generate initials from the final display name */}
        {initials(displayName)}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }} className="meta">
        {/* FIX: Render the final display name */}
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }} className="name">
          {displayName}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            noWrap 
            className="preview"
            sx={{ flexGrow: 1, marginRight: 1 }} 
          >
            {preview}
          </Typography>
          {room.unread_count && room.unread_count > 0 ? (
            // FIX: Replace the Badge component with this one
            <Box
              sx={{
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                borderRadius: '999px',
                bgcolor: '#2f6fec', // from your chat.css
                color: '#fff',       // from your chat.css
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                ml: 1
              }}
            >
              {room.unread_count}
            </Box>
          ) : null}
        </Box>

      </Box>
    </Box>
  );
};