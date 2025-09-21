// client_profile/components/Chat/ChatPage.tsx

import { useEffect, useMemo, useRef, useState, FC } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import apiClient from '../../../../utils/apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../../../../constants/api';
import { useAuth } from '../../../../contexts/AuthContext';

import { ChatRoom, ChatMessage, UserLite, MemberCache } from './types';
import { ChatSidebar } from './ChatSidebar';
import { ConversationPanel } from './ConversationPanel';
import './chat.css';

type Pharmacy = { id: number; name: string };

// Define a type for the state of each room's message data
type RoomMessagesState = {
  messages: ChatMessage[];
  nextUrl: string | null;
  hasMore: boolean;
};

const FULL_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const BACKEND_MEDIA_URL = FULL_API_URL.endsWith('/api') ? FULL_API_URL.slice(0, -4) : FULL_API_URL;

const makeWsUrl = (path: string, token?: string | null) => {
  const base = API_BASE_URL || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol.replace('http', 'ws');
  if (token) url.searchParams.set('token', token);
  return url.toString();
};

const EP_ANY = API_ENDPOINTS as any;
const EP = {
  rooms: API_ENDPOINTS?.rooms ?? '/client-profile/rooms/',
  myMemberships: API_ENDPOINTS?.myMemberships ?? '/client-profile/my-memberships/',
  memberships: API_ENDPOINTS?.memberships ?? '/client-profile/memberships/',
  roomMessages: (roomId: number) =>
    (EP_ANY?.roomMessages?.(roomId)) ?? `/client-profile/rooms/${roomId}/messages/`,
  roomMarkRead: (roomId: number) =>
    (EP_ANY?.roomMarkRead?.(roomId)) ?? `/client-profile/rooms/${roomId}/read/`,
  getOrCreateDM: '/client-profile/rooms/get-or-create-dm/',
  getOrCreateGroup:
    EP_ANY['getOrCreateGroup'] ??
    EP_ANY['getOrCreategroup'] ??
    '/client-profile/rooms/get-or-create-group/',
};

const ChatPage: FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [myMemberships, setMyMemberships] = useState<any[]>([]);
  const [memberCache, setMemberCache] = useState<MemberCache>({});
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<number, RoomMessagesState>>({});
  const [myMembershipIdInActiveRoom, setMyMembershipIdInActiveRoom] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const accessToken = useMemo(() => localStorage.getItem('access'), []);

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const [membershipsRes, roomsRes] = await Promise.all([
          apiClient.get(EP.myMemberships),
          apiClient.get(EP.rooms),
        ]);
        const allMyMemberships: any[] = membershipsRes.data?.results ?? membershipsRes.data ?? [];
        setMyMemberships(allMyMemberships);
        const uniquePharmacies = new Map<number, Pharmacy>();
        allMyMemberships.forEach(m => {
          if (m.pharmacy_detail) uniquePharmacies.set(m.pharmacy_detail.id, m.pharmacy_detail);
        });
        const pharms = Array.from(uniquePharmacies.values());
        setPharmacies(pharms);
        const cachePromises = Array.from(uniquePharmacies.keys()).map(pid =>
          apiClient
            .get(`${EP.memberships}?pharmacy_id=${pid}`)
            .then(res => {
              const items = res.data?.results ?? res.data ?? [];
              const map = items.reduce((acc: Record<number, UserLite>, m: any) => {
                if (m.user_details) acc[m.id] = m.user_details;
                return acc;
              }, {});
              return { pid, map };
            })
        );
        const cacheParts = await Promise.all(cachePromises);
        setMemberCache(Object.fromEntries(cacheParts.map(({ pid, map }) => [pid, map])));
        const initialRooms: ChatRoom[] = roomsRes.data?.results ?? roomsRes.data ?? [];
        initialRooms.sort(
          (a, b) =>
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
        );
        setRooms(initialRooms);
      } catch (e) {
        console.error('loadInitial error', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitial();
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    if (messagesMap[activeRoomId]) return;
    const run = async () => {
      try {
        const res = await apiClient.get(EP.roomMessages(activeRoomId));
        const newMessages: ChatMessage[] = (res.data?.results ?? res.data ?? []).reverse();
        const mappedMessages = newMessages.map(msg => {
            if (msg.attachment_url && msg.attachment_url.startsWith('/')) {
                return { ...msg, attachment_url: `${BACKEND_MEDIA_URL}${msg.attachment_url}` };
            }
            return msg;
        });
        setMessagesMap(prev => ({ 
          ...prev, 
          [activeRoomId]: {
            messages: mappedMessages,
            nextUrl: res.data?.next || null,
            hasMore: !!res.data?.next,
          }
        }));
      } catch (e) { console.error('fetch messages error', e); }
    };
    run();
  }, [activeRoomId, messagesMap]);

  useEffect(() => {
    if (wsRef.current) wsRef.current.close();
    setMyMembershipIdInActiveRoom(null);
    if (!activeRoomId || !accessToken) return;

    const ws = new WebSocket(makeWsUrl(`/ws/chat/rooms/${activeRoomId}/`, accessToken));
    wsRef.current = ws;

    ws.onopen = () => {
      apiClient.post(EP.roomMarkRead(activeRoomId)).then(res => {
          const newLastRead = res.data?.last_read_at;
          setRooms(prev => prev.map(r => 
              (r.id === activeRoomId ? { ...r, unread_count: 0, my_last_read_at: newLastRead } : r)
          ));
      }).catch(() => {});
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === 'ready' && payload.membership) {
          setMyMembershipIdInActiveRoom(payload.membership);
          return;
        }
        if (payload.type === 'message.created') {
          const newMsg: ChatMessage = payload.message;
          if (newMsg.attachment_url && newMsg.attachment_url.startsWith('/')) {
            newMsg.attachment_url = `${BACKEND_MEDIA_URL}${newMsg.attachment_url}`;
          }
          setMessagesMap(prevMap => {
            const current = prevMap[newMsg.conversation]?.messages || [];
            if (current.some(m => m.id === newMsg.id)) return prevMap;
            const currentRoomState = prevMap[newMsg.conversation] || { messages: [], hasMore: false, nextUrl: null };
            return {
              ...prevMap,
              [newMsg.conversation]: {
                ...currentRoomState,
                messages: [...current, newMsg],
              },
            };
          });
          setRooms(prevRooms => {
            const updatedRooms = prevRooms.map(r => {
              if (r.id === newMsg.conversation) {
                const isUnread = newMsg.conversation !== activeRoomId;
                return {
                  ...r,
                  last_message: { id: newMsg.id, body: newMsg.body, created_at: newMsg.created_at, sender: newMsg.sender?.id ?? 0 },
                  unread_count: isUnread ? (r.unread_count || 0) + 1 : 0,
                  updated_at: newMsg.created_at,
                };
              }
              return r;
            });
            return [...updatedRooms].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
          });
        }
      } catch (e) { console.error('ws onmessage error', e); }
    };
    ws.onclose = () => {};
    return () => ws.close();
  }, [activeRoomId, accessToken]);

  const handleSendText = async (body: string) => {
    if (!activeRoomId) return;
    try { await apiClient.post(EP.roomMessages(activeRoomId), { body }); } catch (e) { console.error('send text error', e); }
  };

  const handleSendAttachment = async (file: File, body?: string) => {
    if (!activeRoomId) return;
    try {
      const form = new FormData();
      if (body) form.append('body', body);
      form.append('attachment', file);
      await apiClient.post(EP.roomMessages(activeRoomId), form, { headers: { 'Content-Type': 'multipart/form-data' }, });
    } catch (e) { console.error('send attachment error', e); }
  };

  const handleLoadMore = async () => {
    if (!activeRoomId || isLoadingMore) return;

    const roomState = messagesMap[activeRoomId];
    if (!roomState || !roomState.hasMore || !roomState.nextUrl) return;

    setIsLoadingMore(true);
    try {
      const res = await apiClient.get(roomState.nextUrl);
      const olderMessages: ChatMessage[] = (res.data?.results ?? []).reverse();
      const mappedMessages = olderMessages.map(msg => {
          if (msg.attachment_url && msg.attachment_url.startsWith('/')) {
              return { ...msg, attachment_url: `${BACKEND_MEDIA_URL}${msg.attachment_url}` };
          }
          return msg;
      });
      
      setMessagesMap(prev => {
          const currentRoom = prev[activeRoomId];
          return {
              ...prev,
              [activeRoomId]: {
                  messages: [...mappedMessages, ...currentRoom.messages],
                  nextUrl: res.data?.next || null,
                  hasMore: !!res.data?.next,
              }
          };
      });

    } catch (e) {
      console.error("Failed to load more messages", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleStartDm = async (partnerMembershipId: number) => {
    const currentRoom = rooms.find(r => r.id === activeRoomId);
    if (!currentRoom) {
      console.error("Cannot start DM, no active room selected.");
      return;
    }
    try {
      const res = await apiClient.post(EP.getOrCreateDM, {
        pharmacy_id: currentRoom.pharmacy,
        partner_membership_id: partnerMembershipId,
      });
      const newRoom: ChatRoom = res.data;
      setRooms(prev => (prev.some(r => r.id === newRoom.id) ? prev : [newRoom, ...prev]));
      setActiveRoomId(newRoom.id);
    } catch (e) {
      console.error('Failed to get or create DM', e);
    }
  };
  
  const handleSelectRoom = async (d: { type: 'dm' | 'group'; id: number } | { type: 'pharmacy'; id: number }) => {
    if ('type' in d && d.type === 'pharmacy') {
      const existing = rooms.find(r => r.type === 'GROUP' && r.pharmacy === d.id);
      if (existing) { setActiveRoomId(existing.id); return; }
      try {
        const res = await apiClient.post(EP.getOrCreateGroup, { pharmacy_id: d.id });
        const room: ChatRoom = res.data;
        setRooms(prev => (prev.some(r => r.id === room.id) ? prev : [room, ...prev]));
        setActiveRoomId(room.id);
      } catch (e) { console.error('get-or-create-group error', e); }
      return;
    }
    setActiveRoomId(d.id);
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;
  const activeRoomMessagesState = activeRoom ? (messagesMap[activeRoom.id] || { messages: [], hasMore: false, nextUrl: null }) : { messages: [], hasMore: false, nextUrl: null };


  if (isLoading) { return ( <Box className="chatpage-loading"><CircularProgress /></Box> ); }

  return (
    <Box className="chatpage-root">
      <ChatSidebar
        rooms={rooms}
        pharmacies={pharmacies}
        myMemberships={myMemberships}
        activeRoomId={activeRoomId}
        onSelectRoom={handleSelectRoom}
        memberCache={memberCache}
        getLatestMessage={(roomId) => {
          const roomState = messagesMap[roomId];
          const arr = roomState?.messages;
          return arr && arr.length ? arr[arr.length - 1] : undefined;
        }}
      />
      <Box className="chatpage-main">
        {activeRoom ? (
          <ConversationPanel
            key={activeRoom.id}
            activeRoom={activeRoom}
            pharmacies={pharmacies}
            messages={activeRoomMessagesState.messages}
            myMemberships={myMemberships}
            myMembershipId={myMembershipIdInActiveRoom ?? undefined}
            currentUserId={user?.id}
            memberCache={memberCache}
            onSendText={handleSendText}
            onSendAttachment={handleSendAttachment}
            isLoadingMessages={activeRoom ? !messagesMap[activeRoom.id] : false}
            onStartDm={handleStartDm}
            hasMore={activeRoomMessagesState.hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />
        ) : (
          <Box className="chatpage-empty">
            <ChatIcon sx={{ fontSize: 64, mb: 1, color: 'grey.400' }} />
            <Box>
              <Typography variant="h5" fontWeight={700} color="text.secondary">Welcome to Chemist Tasker Chat</Typography>
              <Typography color="text.secondary" sx={{ mt: .5 }}>Select a conversation to start chatting.</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export { ChatPage };
export default ChatPage;