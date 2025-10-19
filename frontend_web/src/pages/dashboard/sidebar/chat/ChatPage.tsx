import { useEffect, useMemo, useRef, useState, FC, useCallback, SyntheticEvent } from 'react';
import { Box, CircularProgress, Typography, Snackbar, Button } from '@mui/material';
import Alert, { AlertColor } from '@mui/material/Alert';
import ChatIcon from '@mui/icons-material/Chat';
import apiClient from '../../../../utils/apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../../../../constants/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

import { ChatRoom, ChatMessage, MemberCache, CachedMember } from './types';
import { ChatSidebar } from './ChatSidebar';
import { ConversationPanel } from './ConversationPanel';
import { NewChatModal } from './NewChatModal';
import './chat.css';

type Pharmacy = { id: number; name: string };

type RoomMessagesState = {
  messages: ChatMessage[];
  nextUrl: string | null;
  hasMore: boolean;
};

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  return isMobile;
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
  getOrCreateDmByUser: '/client-profile/rooms/get-or-create-dm-by-user/', // Ensure this exists in your constants
  getOrCreateGroup:
    EP_ANY['getOrCreateGroup'] ??
    EP_ANY['getOrCreategroup'] ??
    '/client-profile/rooms/get-or-create-group/',
};

const ChatPage: FC = () => {
  const { user, refreshUnreadCount } = useAuth(); 
  const [isLoading, setIsLoading] = useState(true);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [myMemberships, setMyMemberships] = useState<any[]>([]);
  const [memberCache, setMemberCache] = useState<MemberCache>({});
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<number, RoomMessagesState>>({});
  const [myMembershipIdInActiveRoom, setMyMembershipIdInActiveRoom] = useState<number | null>(null);
  
  // --- FIX: Explicit loading states ---
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const accessToken = useMemo(() => localStorage.getItem('access'), []);
  const isMobile = useIsMobile();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [participantCache, setParticipantCache] = useState<Record<number, CachedMember>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ChatRoom | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: AlertColor; roomId?: number } | null>(null);
  const [typingState, setTypingState] = useState<Record<number, string[]>>({});

  const handleToastClose = useCallback(
    (_event?: SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') return;
      setToast(null);
    },
    []
  );

  const pushToast = useCallback(
    (message: string, severity: AlertColor, roomId?: number) => {
      setToast({ message, severity, roomId });
    },
    []
  );

  const resolveRoomName = useCallback(
    (room?: ChatRoom | null): string => {
      if (!room) return 'Chat';
      if (room.type === 'GROUP') {
        if (room.pharmacy) {
          const pharmacy = pharmacies.find(p => p.id === room.pharmacy);
          if (pharmacy?.name) {
            return pharmacy.name;
          }
        }
        return room.title || 'Group Chat';
      }
      const myMembershipInRoom = myMemberships.find(m => room.participant_ids?.includes(m.id));
      if (!myMembershipInRoom) {
        return room.title || 'Direct Message';
      }
      const partnerMembershipId = room.participant_ids?.find(id => id !== myMembershipInRoom.id);
      if (partnerMembershipId) {
        const cachedParticipant = participantCache[partnerMembershipId]?.details;
        if (cachedParticipant) {
          const fullName = `${cachedParticipant.first_name || ''} ${cachedParticipant.last_name || ''}`.trim();
          return fullName || cachedParticipant.email || 'Direct Message';
        }
        for (const pharmacyId in memberCache) {
          const member = memberCache[Number(pharmacyId)]?.[partnerMembershipId];
          if (member?.details) {
            const details = member.details;
            const fullName = `${details.first_name || ''} ${details.last_name || ''}`.trim();
            return fullName || details.email || 'Direct Message';
          }
        }
      }
      return room.title || 'Direct Message';
    },
    [pharmacies, myMemberships, participantCache, memberCache]
  );

  const lastTypingSentRef = useRef(false);

  const sendTypingUpdate = useCallback(
    (isTyping: boolean) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (lastTypingSentRef.current === isTyping) return;
      try {
        socket.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
        lastTypingSentRef.current = isTyping;
      } catch (error) {
        console.error('Failed to send typing event', error);
      }
    },
    []
  );

  const canCreateChat = useMemo(() => {
    if (!user) return false;
    const isGlobalAdmin = ['OWNER', 'ORG_ADMIN'].includes(user.role);
    const isPharmacyAdmin = myMemberships.some(m => m.role === 'PHARMACY_ADMIN');
    return isGlobalAdmin || isPharmacyAdmin;
  }, [user, myMemberships]);

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const [membershipsRes, roomsRes, participantsRes] = await Promise.all([
          apiClient.get(EP.myMemberships),
          apiClient.get(EP.rooms),
          apiClient.get(API_ENDPOINTS.chatParticipants) 
        ]);

        const allParticipants: any[] = participantsRes.data?.results ?? participantsRes.data ?? [];
        const pCache = allParticipants.reduce((acc: Record<number, any>, m: any) => {
            if (m.user_details) {
                acc[m.id] = {
                    details: m.user_details,
                    role: m.role,
                    employment_type: m.employment_type,
                    invited_name: m.invited_name,
                    is_admin: m.is_admin === true, // <-- keep per-participant admin flag
                };
            }
            return acc;
        }, {});
        setParticipantCache(pCache);

        const allMyMemberships: any[] = membershipsRes.data?.results ?? membershipsRes.data ?? [];
        setMyMemberships(allMyMemberships);

        const uniquePharmacies = new Map<number, Pharmacy>();
        allMyMemberships.forEach(m => {
          if (m.pharmacy_detail) uniquePharmacies.set(m.pharmacy_detail.id, m.pharmacy_detail);
        });
        const pharms = Array.from(uniquePharmacies.values());
        setPharmacies(pharms);

        const cachePromises = pharms.map(pharmacy =>
          apiClient
            .get(`${EP.memberships}?pharmacy_id=${pharmacy.id}`)
            .then(res => {
              const items = res.data?.results ?? res.data ?? [];
              const map = items.reduce((acc: Record<number, CachedMember>, m: any) => {
                if (m.user_details) {
                    acc[m.id] = { 
                        details: m.user_details, 
                        role: m.role, 
                        employment_type: m.employment_type,
                        invited_name: m.invited_name,
                    };
                }
                return acc;
              }, {});
              return { pid: pharmacy.id, map };
            })
        );
        const cacheParts = await Promise.all(cachePromises);
        setMemberCache(Object.fromEntries(cacheParts.map(({ pid, map }) => [pid, map])));
        
        const initialRooms: ChatRoom[] = roomsRes.data?.results ?? roomsRes.data ?? [];
        initialRooms.sort(
          (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
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
    return () => {
      if (lastTypingSentRef.current) {
        sendTypingUpdate(false);
        lastTypingSentRef.current = false;
      }
    };
  }, [activeRoomId, sendTypingUpdate]);

  useEffect(() => {
    if (!activeRoomId) return;

    setTypingState(prev => {
      if (prev[activeRoomId]) {
        return { ...prev, [activeRoomId]: [] };
      }
      return prev;
    });

    if (messagesMap[activeRoomId]) {
      apiClient.post(EP.roomMarkRead(activeRoomId)).catch(() => {});
      return;
    };
    
    const run = async () => {
      setIsLoadingMessages(true); // <-- FIX: Set loading ON
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
      } catch (e) { 
        console.error('fetch messages error', e);
      } finally {
        setIsLoadingMessages(false); // <-- FIX: Set loading OFF
      }
    };

    run();
  }, [activeRoomId]);

  useEffect(() => {
    if (wsRef.current) wsRef.current.close();
    
    const activeRoom = rooms.find(r => r.id === activeRoomId);
    if (activeRoom) {
      setMyMembershipIdInActiveRoom(activeRoom.my_membership_id || null);
    } else {
      setMyMembershipIdInActiveRoom(null);
    }
    
    if (!activeRoomId || !accessToken) return;

    const ws = new WebSocket(makeWsUrl(`/ws/chat/rooms/${activeRoomId}/`, accessToken));
    wsRef.current = ws;

    ws.onopen = () => {
      apiClient.post(EP.roomMarkRead(activeRoomId)).then(res => {
          const newLastRead = res.data?.last_read_at;
          setRooms(prev => prev.map(r => 
              (r.id === activeRoomId ? { ...r, unread_count: 0, my_last_read_at: newLastRead } : r)
          ));
          refreshUnreadCount(); 
      }).catch(() => {});
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === 'ready' && payload.membership) {
          if (!myMembershipIdInActiveRoom) {
             setMyMembershipIdInActiveRoom(payload.membership);
          }
          return;
        }
        if (payload.type === 'message.created') {
          const newMsg: ChatMessage = payload.message;
          if (newMsg.attachment_url && newMsg.attachment_url.startsWith('/')) {
            newMsg.attachment_url = `${BACKEND_MEDIA_URL}${newMsg.attachment_url}`;
          }
          let toastRoomName: string | null = null;
          setMessagesMap(prevMap => {
            const current = prevMap[newMsg.conversation]?.messages || [];
            if (current.some(m => m.id === newMsg.id)) return prevMap;
            const currentRoomState = prevMap[newMsg.conversation] || { messages: [], hasMore: false, nextUrl: null };
            return {
              ...prevMap,
              [newMsg.conversation]: { ...currentRoomState, messages: [...current, newMsg] },
            };
          });
          setRooms(prevRooms => {
            if (!prevRooms.some(r => r.id === newMsg.conversation)) {
              return prevRooms;
            }
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
            const sorted = [...updatedRooms].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
            if (newMsg.conversation !== activeRoomId) {
              const targetRoom = sorted.find(r => r.id === newMsg.conversation);
              toastRoomName = resolveRoomName(targetRoom);
            }
            return sorted;
          });
          if (newMsg.conversation !== activeRoomId) {
            refreshUnreadCount();
            if (toastRoomName) {
              pushToast(`New message in ${toastRoomName}`, 'info', newMsg.conversation);
            }
          }
          return;
        }
        if (payload.type === 'message.updated') {
          const updatedMsg: ChatMessage = payload.message;
          setMessagesMap(prevMap => {
            const roomState = prevMap[updatedMsg.conversation];
            if (!roomState) return prevMap;
            const updatedMessages = roomState.messages.map(m => m.id === updatedMsg.id ? updatedMsg : m);
            return { ...prevMap, [updatedMsg.conversation]: { ...roomState, messages: updatedMessages } };
          });
          return;
        }
        if (payload.type === 'message.deleted') {
          const { message_id } = payload;
          setMessagesMap(prevMap => {
            let targetRoomId: number | null = null;
            for (const roomId in prevMap) {
              if (prevMap[roomId].messages.some(m => m.id === message_id)) {
                targetRoomId = parseInt(roomId);
                break;
              }
            }
            if (!targetRoomId) return prevMap;
            const roomState = prevMap[targetRoomId];
            const updatedMessages = roomState.messages.map(m => 
              m.id === message_id ? { ...m, is_deleted: true } : m
            );
            return { ...prevMap, [targetRoomId]: { ...roomState, messages: updatedMessages } };
          });
          return;
        }
        if (payload.type === 'reaction.updated') {
          const { message_id, reactions } = payload;
          setMessagesMap(prevMap => {
            let targetRoomId: number | null = null;
            for (const roomId in prevMap) {
              if (prevMap[roomId].messages.some(m => m.id === message_id)) {
                targetRoomId = parseInt(roomId);
                break;
              }
            }
            if (!targetRoomId) return prevMap;
            const roomState = prevMap[targetRoomId];
            const updatedMessages = roomState.messages.map(m =>
              m.id === message_id ? { ...m, reactions: reactions } : m
            );
            return {
              ...prevMap,
              [targetRoomId]: { ...roomState, messages: updatedMessages }
            };
          });
          return;
        }
        if (payload.type === 'typing') {
          const roomId =
            payload.conversation_id ??
            payload.conversation ??
            payload.room_id ??
            null;
          if (typeof roomId === 'number') {
            if (payload.user_id && user?.id && Number(payload.user_id) === Number(user.id)) {
              return;
            }
            const name = (payload.name || '').trim();
            setTypingState(prev => {
              const existing = prev[roomId] ?? [];
              const nextSet = new Set(existing);
              if (payload.is_typing) {
                if (name) nextSet.add(name);
              } else {
                if (name) {
                  nextSet.delete(name);
                } else {
                  nextSet.clear();
                }
              }
              const nextNames = Array.from(nextSet);
              if (nextNames.length === 0) {
                const { [roomId]: _omit, ...rest } = prev;
                return rest;
              }
              return { ...prev, [roomId]: nextNames };
            });
          }
          return;
        }
      } catch (e) { console.error('ws onmessage error', e); }
    };
    ws.onclose = () => {
      lastTypingSentRef.current = false;
    };
    return () => ws.close();
  }, [activeRoomId, accessToken, refreshUnreadCount, resolveRoomName, pushToast, myMembershipIdInActiveRoom, user?.id]);


  useEffect(() => {
    const startDmWithUser = searchParams.get('startDmWithUser');

    if (startDmWithUser) {
      const partnerUserId = Number(startDmWithUser);

      apiClient.post(EP.getOrCreateDmByUser, { partner_user_id: partnerUserId })
        .then(res => {
          const newOrExistingRoom: ChatRoom = res.data;
          
          setRooms(prevRooms => {
            if (prevRooms.some(r => r.id === newOrExistingRoom.id)) {
              return prevRooms;
            }
            return [newOrExistingRoom, ...prevRooms];
          });
          
          setActiveRoomId(newOrExistingRoom.id);
          
          searchParams.delete('startDmWithUser');
          setSearchParams(searchParams);
        })
        .catch(err => {
          console.error("Failed to start DM from URL", err);
          pushToast(err.response?.data?.detail || "Could not start the chat.", 'error');
          
          searchParams.delete('startDmWithUser');
          setSearchParams(searchParams);
        });
    }
  }, [searchParams, setSearchParams]);

  const handleSendText = async (body: string) => {
    if (!activeRoomId) return;
    try { await apiClient.post(EP.roomMessages(activeRoomId), { body }); } catch (e) { console.error('send text error', e); }
  };

  const handleSendAttachment = async (files: File[], body?: string) => {
    if (!activeRoomId) return;
    try {
      const form = new FormData();
      if (body) form.append('body', body);
      files.forEach(file => {
        form.append('attachment', file);
      });
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

  const handleStartDm = async (partnerMembershipId: number, partnerPharmacyId: number) => {
    const partnerDetails = memberCache[partnerPharmacyId]?.[partnerMembershipId]?.details;
    if (!partnerDetails || !user) {
        pushToast('Could not find user details to start chat.', 'error');
        return;
    }
    const partnerUserId = partnerDetails.id;

      setParticipantCache(prev => {
    if (prev[partnerMembershipId]) return prev;
    const entry = memberCache[partnerPharmacyId]?.[partnerMembershipId];
    if (!entry) return prev;
    return { ...prev, [partnerMembershipId]: { ...entry } };
  });

    const findExistingDm = (targetUserId: number) => {
        for (const room of rooms) {
            if (room.type === 'DM' && room.participant_ids.length === 2) {
                const myMem = myMemberships.find(m => room.participant_ids.includes(m.id));
                const partnerMemId = room.participant_ids.find(id => id !== myMem?.id);

                if (partnerMemId && participantCache[partnerMemId]) {
                    const partnerInRoom = participantCache[partnerMemId].details;
                    if (partnerInRoom.id === targetUserId) {
                        return room;
                    }
                }
            }
        }
        return null;
    };

    const existingRoom = findExistingDm(partnerUserId);

    if (existingRoom) {
        setActiveRoomId(existingRoom.id);
    } else {
    try {
        const res = await apiClient.post(EP.getOrCreateDM, {
            partner_membership_id: partnerMembershipId
        });
        handleSaveRoom(res.data);
        pushToast(`Direct message with ${resolveRoomName(res.data)} ready`, 'success', res.data.id);
    } catch (e: any) {
        console.error('Failed to get or create DM', e);
        pushToast(e.response?.data?.detail || 'Could not start the chat.', 'error');
    }
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

  const handleEditMessage = async (messageId: number, newBody: string) => {
    try {
      await apiClient.patch(`/client-profile/messages/${messageId}/`, { body: newBody });
    } catch (e) {
      console.error('Failed to edit message', e);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (window.confirm('Are you sure you want to delete this message? This cannot be undone.')) {
      try {
        await apiClient.delete(`/client-profile/messages/${messageId}/`);
      } catch (e) {
        console.error('Failed to delete message', e);
      }
    }
  };

  const handleReact = async (messageId: number, reaction: string) => {
    try {
      await apiClient.post(`/client-profile/messages/${messageId}/react/`, { reaction });
    } catch (e) {
      console.error('Failed to send reaction', e);
    }
  };
  
  const handleTogglePin = async (roomId: number, target: 'conversation' | 'message', messageId?: number) => {
    try {
      const payload: { target: string, message_id?: number } = { target };
      if (messageId) {
        payload.message_id = messageId;
      }
      const res = await apiClient.post(`${EP.rooms}${roomId}/toggle-pin/`, payload);

      // Optimistically update the UI
      setRooms(prevRooms => {
        return prevRooms.map(room => {
          if (room.id === roomId) {
            if (target === 'conversation') {
              return { ...room, is_pinned: res.data.is_pinned };
            }
            // For message pinning, the response contains the updated room object
            return res.data;
          }
          return room;
        });
      });
    } catch (e) {
      console.error('Failed to toggle pin', e);
      pushToast('Unable to update pin state. Please try again.', 'error');
    }
  };

  const handleOpenEditModal = (room: ChatRoom) => {
    setEditingRoom(room);
    setIsModalOpen(true);
  };

const handleDeleteChat = async (roomId: number, roomName: string) => {
  const target = rooms.find(r => r.id === roomId);
  if (!target) return;

  const isDm = target.type === 'DM';
  const question = isDm
    ? `Delete this direct message with "${roomName}" for you? The other person will keep the conversation.`
    : `Are you sure you want to delete the chat "${roomName}" for everyone? This cannot be undone.`;

  if (!window.confirm(question)) return;

  try {
    // Backend perform_destroy now handles:
    // - DM: delete-for-me (remove my participant)
    // - GROUP: hard delete (subject to your permission checks)
    await apiClient.delete(`${EP.rooms}${roomId}/`);

    setRooms(prevRooms => prevRooms.filter(r => r.id !== roomId));
    if (activeRoomId === roomId) {
      setActiveRoomId(null);
    }
    pushToast(`${roomName} deleted`, 'success');
  } catch (e) {
    console.error('Failed to delete chat', e);
    pushToast('Failed to delete chat.', 'error');
  }
};


  const handleSaveRoom = (savedRoom: ChatRoom) => {
    setRooms(prevRooms => {
        const roomExists = prevRooms.some(room => room.id === savedRoom.id);
        if (roomExists) {
            const updatedRooms = prevRooms.map(r => (r.id === savedRoom.id ? savedRoom : r));
            return [...updatedRooms].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
        }
        const newRooms = [savedRoom, ...prevRooms];
        return newRooms.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
    });
    setActiveRoomId(savedRoom.id);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setEditingRoom(null), 300);
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;
  const activeTypingMembers = activeRoomId ? typingState[activeRoomId] ?? [] : [];
  const activeRoomMessagesState = activeRoom ? (messagesMap[activeRoom.id] || { messages: [], hasMore: false, nextUrl: null }) : { messages: [], hasMore: false, nextUrl: null };

  const showConversation = isMobile ? !!activeRoomId : true;
  const rootClassName = `chatpage-root ${isMobile && activeRoomId ? 'mobile-conversation-active' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed-view' : ''}`;

  if (isLoading) { return ( <Box className="chatpage-loading"><CircularProgress /></Box> ); }

  return (
    <Box className={rootClassName}>
      <ChatSidebar
        rooms={rooms}
        pharmacies={pharmacies}
        myMemberships={myMemberships}
        activeRoomId={activeRoomId}
        onSelectRoom={handleSelectRoom}
        participantCache={participantCache}
        memberCache={memberCache}              
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        onNewChat={() => setIsModalOpen(true)}
        onEdit={handleOpenEditModal}
        onDelete={handleDeleteChat}
        canCreateChat={canCreateChat}
        currentUserId={user?.id}
        getLatestMessage={(roomId) => {
          const roomState = messagesMap[roomId];
          const arr = roomState?.messages;
          return arr && arr.length ? arr[arr.length - 1] : undefined;
        }}
      />
      
      {showConversation ? (
        activeRoom ? (
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
            isLoadingMessages={isLoadingMessages} // <-- FIX: Use explicit loading state
            onStartDm={(partnerMembershipId) => {
                for (const pharmId in memberCache) {
                    if (memberCache[pharmId][partnerMembershipId]) {
                        handleStartDm(partnerMembershipId, Number(pharmId));
                        return;
                    }
                }
            }}
            hasMore={activeRoomMessagesState.hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onReact={handleReact}
            onTogglePin={(target, messageId) => handleTogglePin(activeRoom.id, target, messageId)}
            isMobile={isMobile}
            onBack={() => setActiveRoomId(null)}
            onTyping={sendTypingUpdate}
            onNotify={(severity, message) => pushToast(message, severity)}
            typingMembers={activeTypingMembers}
          />
        ) : (
          !isMobile && (
            <Box className="chatpage-empty">
              <ChatIcon sx={{ fontSize: 64, mb: 1, color: 'grey.400' }} />
              <Box>
                <Typography variant="h5" fontWeight={700} color="text.secondary">Welcome to Chemist Tasker Chat</Typography>
                <Typography color="text.secondary" sx={{ mt: .5 }}>Select a conversation to start chatting.</Typography>
              </Box>
            </Box>
          )
        )
      ) : null}

      <NewChatModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveRoom}
        pharmacies={pharmacies}
        memberCache={memberCache}
        currentUserId={user?.id}
        editingRoom={editingRoom}
        onDmSelect={handleStartDm}
        onNotify={(severity, message) => pushToast(message, severity)}
      />
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert
            onClose={handleToastClose}
            severity={toast.severity}
            sx={{ width: '100%' }}
            action={
              toast.roomId ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setActiveRoomId(toast.roomId!);
                    setToast(null);
                  }}
                >
                  Open
                </Button>
              ) : undefined
            }
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};

export { ChatPage };
export default ChatPage;
