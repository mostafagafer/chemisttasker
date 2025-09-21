import { FC, useState } from 'react';
import { Box, Typography, Link, Chip, IconButton, Menu, MenuItem } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { ChatMessage } from './types';

const initialsOf = (first?: string, last?: string) => {
  const f = (first || '').trim();
  const l = (last || '').trim();
  return ((f[0] || '') + (l[0] || '')).toUpperCase() || '?';
};

const isImage = (url: string) => {
  const extension = url.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
};

type Props = {
  msg: ChatMessage;
  isMe: boolean;
  onStartDm: (partnerMembershipId: number) => void;
  roomType: 'GROUP' | 'DM'; // FIX: Add a prop to know the room type
};

export const MessageBubble: FC<Props> = ({ msg, isMe, onStartDm, roomType }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const user = msg.sender?.user_details;
  const fullName = ((user?.first_name || '') + (user?.last_name ? ' ' + user.last_name : '')).trim();
  const attachmentFilename = msg.attachment_url ? msg.attachment_url.split('/').pop() : 'Download';

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleStartDmClick = () => {
    onStartDm(msg.sender.id);
    handleCloseMenu();
  };

  return (
    <Box 
      className={`msg-row ${isMe ? 'me' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* FIX: Only show the menu in GROUP chats for messages that are not yours */}
      {!isMe && roomType === 'GROUP' && (
        <Box sx={{ width: 36, opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s' }}>
          <IconButton size="small" onClick={handleOpenMenu}>
            <MoreHorizIcon />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>
            <MenuItem onClick={handleStartDmClick}>Send a direct message</MenuItem>
          </Menu>
        </Box>
      )}

      <Box className="initials">{initialsOf(user?.first_name, user?.last_name)}</Box>
      <Box>
        <Box className={`bubble ${isMe ? 'me' : ''}`}>
          {msg.attachment_url && (
            <Box sx={{ mb: msg.body ? 1 : 0, maxWidth: 320 }}>
              {isImage(msg.attachment_url) ? (
                <Link href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img src={msg.attachment_url} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px', display: 'block' }} />
                </Link>
              ) : (
                <Link href={msg.attachment_url} target="_blank" rel="noopener noreferrer" underline="none">
                   <Chip
                    icon={<InsertDriveFileOutlinedIcon />} label={attachmentFilename} clickable
                    sx={{ bgcolor: isMe ? 'primary.dark' : 'action.hover', color: isMe ? 'white' : 'text.primary', '&:hover': { bgcolor: isMe ? '#004c8c' : 'action.disabledBackground' } }}
                  />
                </Link>
              )}
            </Box>
          )}
          {msg.body && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {msg.body}
            </Typography>
          )}
        </Box>
        <Box className="msg-meta">
          {!isMe && fullName ? `${fullName}  •  ` : ''}
          {new Date(msg.created_at).toLocaleString()}
          {msg.edited ? ' · edited' : ''}
        </Box>
      </Box>

      {/* Spacer for messages that are yours to keep alignment consistent */}
      {isMe && <Box sx={{ width: 36 }} />}
    </Box>
  );
};