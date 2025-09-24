import { FC, useRef, useEffect, useState, useMemo, Fragment, UIEvent } from 'react';
import { Box, IconButton, InputBase, Tooltip, Typography, CircularProgress, Divider, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CancelIcon from '@mui/icons-material/Cancel';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage, ChatRoom, MemberCache, PharmacyRef } from './types';
import './chat.css';

type Membership = {
  id: number;
  pharmacy: number;
  user: { id: number };
};

type Props = {
  activeRoom: ChatRoom;
  pharmacies: PharmacyRef[];
  myMemberships: Membership[];
  messages: ChatMessage[];
  myMembershipId?: number;
  currentUserId?: number;
  memberCache: MemberCache;
  onSendText: (body: string) => void;
  onSendAttachment: (files: File[], body?: string) => void;
  isLoadingMessages: boolean;
  onStartDm: (partnerMembershipId: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onEditMessage: (messageId: number, newBody: string) => void;
  onDeleteMessage: (messageId: number) => void;
  onReact: (messageId: number, reaction: string) => void;
  isMobile: boolean;
  onBack: () => void;
};

export const ConversationPanel: FC<Props> = ({
  activeRoom,
  pharmacies,
  myMemberships,
  messages,
  myMembershipId,
  currentUserId,
  memberCache,
  onSendText,
  onSendAttachment,
  isLoadingMessages,
  onStartDm,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onReact,
  isMobile,
  onBack,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollContext, setScrollContext] = useState({ loading: false, prevHeight: 0 });
  
  const [attachments, setAttachments] = useState<File[]>([]);

  const headerTitle = useMemo(() => {
    if (activeRoom.type === 'GROUP') {
        if (activeRoom.title) return activeRoom.title;
        // Fallback for old groups that are tied to a pharmacy
        const pharmacy = pharmacies.find(p => p.id === activeRoom.pharmacy);
        return pharmacy?.name || 'Group Chat';
    }
    // Logic for DM titles
    if (activeRoom.title && activeRoom.title !== 'Direct Message' && !activeRoom.title.startsWith('DM between')) {
        return activeRoom.title;
    }
    const myMembershipInRoom = myMemberships.find(myMem => activeRoom.participant_ids?.includes(myMem.id));
    if (!myMembershipInRoom) { return activeRoom.title || 'Direct Message'; }
    const partnerMembershipId = activeRoom.participant_ids?.find(pId => pId !== myMembershipInRoom.id);
    // Find partner in cache across all pharmacies
    if (partnerMembershipId) {
        for (const pharmacyId in memberCache) {
            if (memberCache[pharmacyId][partnerMembershipId]) {
                const partnerUser = memberCache[pharmacyId][partnerMembershipId].details;
                const fullName = `${partnerUser.first_name || ''} ${partnerUser.last_name || ''}`.trim();
                return fullName || partnerUser.email || 'Direct Message';
            }
        }
    }
    return activeRoom.title || 'Direct Message';
  }, [activeRoom, pharmacies, myMemberships, memberCache]);

  const firstUnreadIndex = useMemo(() => {
    const lastReadTime = activeRoom?.my_last_read_at ? new Date(activeRoom.my_last_read_at).getTime() : 0;
    if (!lastReadTime) return -1;
    return messages.findIndex(msg =>
      (new Date(msg.created_at).getTime() > lastReadTime) &&
      (msg.sender.user_details.id !== currentUserId)
    );
  }, [activeRoom?.my_last_read_at, messages, currentUserId]);
  
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    if (scrollContext.loading) {
      scroller.scrollTop = scroller.scrollHeight - scrollContext.prevHeight;
      setScrollContext({ loading: false, prevHeight: 0 });
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages, activeRoom.id, scrollContext]);
  
  const handleSend = async () => {
    const body = text.trim();
    if ((!body && attachments.length === 0) || sending) return;

    setSending(true);
    try {
      if (attachments.length > 0) {
        await onSendAttachment(attachments, body || undefined);
      } else {
        await onSendText(body);
      }
      setText('');
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };
  
  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newAttachments: File[] = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { 
        alert(`File "${file.name}" exceeds the 10 MB size limit.`);
        continue;
      }
      newAttachments.push(file);
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (e.target) e.target.value = '';
  };

  const removeAttachment = (fileName: string) => {
    setAttachments(prev => prev.filter(f => f.name !== fileName));
  };
  
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingMore) {
      if (scrollRef.current) {
        setScrollContext({ loading: true, prevHeight: scrollRef.current.scrollHeight });
      }
      onLoadMore();
    }
  };

  return (
    <Box className="chatpage-main">
      <Box className="conversation-header">
        {isMobile && (
          <IconButton onClick={onBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap title={headerTitle}>
            {headerTitle}
          </Typography>
          {isLoadingMessages ? (
            <Typography variant="caption" color="text.secondary">Loading…</Typography>
          ) : null}
        </Box>
      </Box>

      <Box ref={scrollRef} className="conversation-scroll" onScroll={handleScroll}>
        {isLoadingMore && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {messages.map((m, index) => (
          <Fragment key={m.id}>
            {index === firstUnreadIndex && (
              <Divider sx={{ my: 2, '&::before, &::after': { borderColor: 'primary.light' } }}>
                <Chip label="New Messages" size="small" color="primary" variant="outlined" />
              </Divider>
            )}
            <MessageBubble 
              msg={m} 
              prevMsg={index > 0 ? messages[index - 1] : null}
              isMe={Boolean(myMembershipId && m.sender?.id === myMembershipId)} 
              onStartDm={onStartDm}
              roomType={activeRoom.type}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
              onReact={onReact}
            />
          </Fragment>
        ))}
      </Box>
      
      {attachments.length > 0 && (
        <Box sx={{ p: 1, borderTop: '1px solid #e6e8ee', display: 'flex', flexDirection: 'column', gap: 1, bgcolor: 'background.default' }}>
          {attachments.map(file => (
            <Chip
              key={file.name}
              label={file.name}
              size="small"
              onDelete={() => removeAttachment(file.name)}
              deleteIcon={<CancelIcon onMouseDown={(e) => e.stopPropagation()} />}
            />
          ))}
        </Box>
      )}

      <Box className="conversation-footer">
        <Tooltip title="Attach">
          <span>
            <IconButton onClick={() => fileRef.current?.click()} size="small" disabled={sending}>
              <AttachFileOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <input ref={fileRef} type="file" hidden multiple onChange={handleFileChange} />
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          fullWidth
          multiline
          maxRows={4}
          sx={{ px: 1, py: 0.5 }}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <IconButton color="primary" onClick={handleSend} disabled={sending || (!text.trim() && attachments.length === 0)}>
          {sending ? <CircularProgress size={20} /> : <SendOutlinedIcon />}
        </IconButton>
      </Box>
    </Box>
  );
};
