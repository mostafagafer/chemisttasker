import { FC, useState } from 'react';
import { Avatar, Box, Typography, Tooltip, Menu, MenuItem, IconButton, ListItemIcon, ListItemText } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import { ChatRoom } from './types';

interface ChatListItemProps {
  room: ChatRoom;
  isActive: boolean;
  onSelect: (roomId: number) => void;
  previewOverride?: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarLabel: string;
  isCollapsed: boolean;
  onEdit: (room: ChatRoom) => void;
  onDelete: (roomId: number, roomName: string) => void;
  canEditDelete?: boolean;
}



export const ChatListItem: FC<ChatListItemProps> = ({
  room,
  isActive,
  onSelect,
  previewOverride,
  displayName,
  avatarUrl,
  avatarLabel,
  isCollapsed,
  onEdit,
  onDelete,
  canEditDelete,

}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const isGroup = room.type === 'GROUP';

  // Show Edit for any GROUP when I'm allowed (admin/creator).
  const canShowEdit = isGroup && !!canEditDelete;

  // Show Delete for:
  //   - DMs (always),
  //   - any GROUP when I'm allowed (admin/creator).
  const canShowDelete = isGroup ? !!canEditDelete : room.type === 'DM';




  const isPinnable = true;
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
      <Box sx={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
        <Avatar
          src={avatarUrl || undefined}
          alt={displayName}
          sx={{
            width: 36,
            height: 36,
            fontSize: '0.85rem',
            fontWeight: 700,
            bgcolor: avatarUrl ? 'transparent' : 'primary.main',
            color: avatarUrl ? 'text.primary' : '#fff',
            border: avatarUrl ? '1px solid rgba(15,23,42,0.08)' : undefined,
          }}
        >
          {!avatarUrl ? avatarLabel : null}
        </Avatar>
        {isCollapsed && (room.unread_count || 0) > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              minWidth: '16px',
              height: '16px',
              px: 0.5,
              borderRadius: '999px',
              bgcolor: '#d32f2f',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
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
          
          <IconButton
              size="small"
              className="options-button"
              onClick={handleOpenMenu}
              sx={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.2s', ml: 1 }}
          >
              <MoreHorizIcon />
          </IconButton>
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
        {isPinnable && (
            <MenuItem onClick={() => {
                // This will be handled by a function passed from ChatPage
                // onTogglePin(room.id, 'conversation');
                handleCloseMenu();
            }}>
                <ListItemIcon><PushPinIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{room.is_pinned ? 'Unpin Chat' : 'Pin Chat'}</ListItemText>
            </MenuItem>
        )}
        {canShowEdit && (
          <MenuItem onClick={() => { onEdit(room); handleCloseMenu(); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Group</ListItemText>
          </MenuItem>
        )}
        {canShowDelete && (
          <MenuItem onClick={() => { onDelete(room.id, displayName); handleCloseMenu(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Delete Chat</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
