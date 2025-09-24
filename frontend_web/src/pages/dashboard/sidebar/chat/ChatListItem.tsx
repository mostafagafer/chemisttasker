import { FC, useState } from 'react';
import { Box, Typography, Tooltip, Menu, MenuItem, IconButton } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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
  displayName: string;
  isCollapsed: boolean;
  onEdit: (room: ChatRoom) => void;
  onDelete: (roomId: number, roomName: string) => void;
}

export const ChatListItem: FC<ChatListItemProps> = ({
  room,
  isActive,
  onSelect,
  previewOverride,
  displayName,
  isCollapsed,
  onEdit,
  onDelete,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  // A custom group is one that is NOT linked to a pharmacy, or a DM
  const isCustomGroup = room.type === 'GROUP' && !room.pharmacy;
  const isDeletable = isCustomGroup || room.type === 'DM';

  const lastMessage = room.last_message;
  const preview =
    (previewOverride && previewOverride.trim()) ||
    (lastMessage?.body?.trim()) ||
    (lastMessage ? '📎 Attachment' : 'No messages yet.');

  const listItemContent = (
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
        width: isCollapsed ? 'fit-content' : '100%',
        margin: isCollapsed ? '0 auto' : '0',
        '&:hover .options-button': { opacity: 1 },
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
          position: 'relative',
        }}
        className="avatar"
      >
        {initials(displayName)}
        {isCollapsed && (room.unread_count || 0) > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '999px',
              bgcolor: '#d32f2f',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white'
            }}
          >
            {room.unread_count}
          </Box>
        )}
      </Box>

      {!isCollapsed && (
        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center' }} className="meta">
          <Box sx={{ minWidth: 0, flex: 1 }}>
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
              {(room.unread_count || 0) > 0 ? (
                <Box
                  sx={{
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 6px',
                    borderRadius: '999px',
                    bgcolor: '#2f6fec',
                    color: '#fff',
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
          
          {(isCustomGroup || room.type === 'DM') && (
            <IconButton
                size="small"
                className="options-button"
                onClick={handleOpenMenu}
                sx={{ opacity: 0, transition: 'opacity 0.2s', ml: 1 }}
            >
                <MoreHorizIcon />
            </IconButton>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <>
      {isCollapsed ? (
        <Tooltip title={displayName} placement="right" arrow>
          {listItemContent}
        </Tooltip>
      ) : (
        listItemContent
      )}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>
        {isCustomGroup && (
          <MenuItem onClick={() => { onEdit(room); handleCloseMenu(); }}>
            <EditIcon sx={{ mr: 1 }} fontSize="small" /> Edit Group
          </MenuItem>
        )}
        {isDeletable && (
          <MenuItem onClick={() => { onDelete(room.id, displayName); handleCloseMenu(); }} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1 }} fontSize="small" /> Delete Chat
          </MenuItem>
        )}
      </Menu>
    </>
  );
};