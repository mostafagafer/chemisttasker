import { FC, useRef, useEffect, useState, useMemo, Fragment, UIEvent } from 'react';
import { Box, IconButton, InputBase, Tooltip, Typography, CircularProgress, Divider, Chip } from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
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
  onSendAttachment: (file: File, body?: string) => void;
  isLoadingMessages: boolean;
  onStartDm: (partnerMembershipId: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
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
  // FIX: Destructure new props
  hasMore,
  isLoadingMore,
  onLoadMore,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // FIX: State to help preserve scroll position during message loading
  const [scrollContext, setScrollContext] = useState({ loading: false, prevHeight: 0 });


  const headerTitle = useMemo(() => {
    if (activeRoom.type === 'GROUP') {
      const pharmacy = pharmacies.find(p => p.id === activeRoom.pharmacy);
      return activeRoom.title || pharmacy?.name || 'Group Chat';
    }
    if (activeRoom.title && activeRoom.title !== 'Direct Message' && !activeRoom.title.startsWith('DM between')) {
        return activeRoom.title;
    }
    const myMembershipInRoom = myMemberships.find(myMem => activeRoom.participant_ids?.includes(myMem.id));
    if (!myMembershipInRoom) { return activeRoom.title || 'Direct Message'; }
    const partnerMembershipId = activeRoom.participant_ids?.find(pId => pId !== myMembershipInRoom.id);
    if (partnerMembershipId && memberCache[activeRoom.pharmacy]) {
        const partnerUser = memberCache[activeRoom.pharmacy][partnerMembershipId];
        if (partnerUser) {
            const fullName = `${partnerUser.first_name || ''} ${partnerUser.last_name || ''}`.trim();
            return fullName || partnerUser.email || 'Direct Message';
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
  
  // FIX: This effect now smartly handles scrolling for both new and old messages.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    if (scrollContext.loading) {
      // Just loaded older messages, restore scroll position
      scroller.scrollTop = scroller.scrollHeight - scrollContext.prevHeight;
      setScrollContext({ loading: false, prevHeight: 0 });
    } else {
      // New message arrived or room changed, scroll to bottom
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages, activeRoom.id, scrollContext]);


  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSendText(body);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleAttach = () => fileRef.current?.click();
  
  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || sending) return;
    setSending(true);
    try {
      await onSendAttachment(file, text.trim() || undefined);
      setText('');
      if (e.target) e.target.value = '';
    } finally {
      setSending(false);
    }
  };

  // FIX: New handler for the onScroll event
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isLoadingMore) {
      // Before loading more, save the current scroll height
      if (scrollRef.current) {
        setScrollContext({ loading: true, prevHeight: scrollRef.current.scrollHeight });
      }
      onLoadMore();
    }
  };


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }} className="chatpage-main">
      <Box sx={{ p: 2, borderBottom: '1px solid #e6e8ee', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap title={headerTitle}>
            {headerTitle}
          </Typography>
          {isLoadingMessages ? (
            <Typography variant="caption" color="text.secondary">Loading…</Typography>
          ) : null}
        </Box>
      </Box>

      {/* FIX: Added onScroll handler */}
      <Box ref={scrollRef} className="conversation-scroll" onScroll={handleScroll}>
        {/* FIX: Show a loading spinner at the top when fetching older messages */}
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
              isMe={Boolean(myMembershipId && m.sender?.id === myMembershipId)} 
              onStartDm={onStartDm}
              roomType={activeRoom.type}
            />
          </Fragment>
        ))}
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid #e6e8ee', bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Attach">
          <span>
            <IconButton onClick={handleAttach} size="small" disabled={sending}>
              <AttachFileOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <input ref={fileRef} type="file" hidden onChange={handleFileChange} />
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
        <IconButton color="primary" onClick={handleSend} disabled={sending || !text.trim()}>
          {sending ? <CircularProgress size={20} /> : <SendOutlinedIcon />}
        </IconButton>
      </Box>
    </Box>
  );
};