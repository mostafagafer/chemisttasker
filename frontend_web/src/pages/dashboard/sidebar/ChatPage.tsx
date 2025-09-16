// src/pages/ChatPage.tsx

import { useEffect, useMemo, useRef, useState, FC } from 'react';
import {
  Box,
  Stack,
  Typography,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  IconButton,
  TextField,
  Paper,
  CircularProgress,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS, API_BASE_URL } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';

// --- Types ---
type Pharmacy = { id: number; name: string; address?: string };
type UserLite = { id: number; first_name?: string; last_name?: string; email?: string; avatar?: string | null };
type ChatMessageUI = { id: number; membershipId: number; body: string; createdAt: string };
type LastMessageAPI = { id: number; body: string; created_at: string; sender: number };
type ChatRoom = {
  id: number;
  type: 'GROUP' | 'DM';
  pharmacy: { id: number; name: string };
  title?: string;
  updated_at?: string;
  last_message?: LastMessageAPI | null;
  unread_count?: number;
  participant_ids: number[];
};
type Selection = { kind: 'room'; room: ChatRoom } | null;

// --- Utilities ---
const initials = (u?: UserLite) => {
  if (!u) return '?';
  const a = (u.first_name || '').charAt(0);
  const b = (u.last_name || '').charAt(0);
  return (a || b) ? `${a}${b}`.toUpperCase() : (u.email || '?').charAt(0).toUpperCase();
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: 'numeric' });
  } catch {
    return iso;
  }
};

const makeWsUrl = (path: string, token?: string | null) => {
  const base = API_BASE_URL || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (token) url.searchParams.set('token', token);
  return url.toString();
};

// --- Sub-components ---
const MessageBubble: FC<{ me: boolean; msg: ChatMessageUI, sender?: UserLite }> = ({ me, msg, sender }) => (
  <Stack direction={me ? 'row-reverse' : 'row'} spacing={1} alignItems="flex-start">
    <Avatar sx={{ width: 32, height: 32 }}>{initials(sender)}</Avatar>
    <Paper
      sx={{
        px: 1.5, py: 1,
        bgcolor: me ? 'primary.main' : 'background.paper',
        color: me ? 'primary.contrastText' : 'text.primary',
        borderRadius: 2,
        borderTopLeftRadius: me ? 2 : 0,
        borderTopRightRadius: me ? 0 : 2
      }}
      elevation={1}
    >
      {!me && <Typography variant="caption" fontWeight="bold">{`${sender?.first_name || ''} ${sender?.last_name || ''}`.trim() || sender?.email}</Typography>}
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.body}</Typography>
      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', textAlign: 'right', mt: 0.5 }}>{formatTime(msg.createdAt)}</Typography>
    </Paper>
  </Stack>
);

// --- Main Component ---
export default function ChatPage() {
    const { user } = useAuth();
    const myUserId = user?.id;

    // State management
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [memberCache, setMemberCache] = useState<Record<number, Record<number, UserLite>>>({});
    const [myMembershipIdInRoom, setMyMembershipIdInRoom] = useState<number | null>(null);
    const [selection, setSelection] = useState<Selection>(null);
    const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessageUI[]>>({});
    const [sending, setSending] = useState(false);
    const [composer, setComposer] = useState('');
    const wsRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [dmDialogOpen, setDmDialogOpen] = useState(false);
    const [dmCandidates, setDmCandidates] = useState<UserLite[]>([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [dmPharmacyId, setDmPharmacyId] = useState<number | null>(null);

    const accessToken = useMemo(() => localStorage.getItem('access'), []);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [memRes, roomRes] = await Promise.all([
                    apiClient.get(API_ENDPOINTS.myMemberships),
                    apiClient.get(API_ENDPOINTS.rooms),
                ]);

                const memberships = memRes.data?.results ?? memRes.data ?? [];
                const uniquePharmacies = new Map<number, Pharmacy>();
                memberships.forEach((m: any) => {
                    if (m.pharmacy_detail) uniquePharmacies.set(m.pharmacy_detail.id, m.pharmacy_detail);
                });
                setPharmacies(Array.from(uniquePharmacies.values()));
                setRooms(roomRes.data?.results ?? roomRes.data ?? []);

                const memberCachePromises = Array.from(uniquePharmacies.keys()).map(pid =>
                    apiClient.get(`${API_ENDPOINTS.memberships}?pharmacy=${pid}`).then(res => ({ pid, members: res.data?.results ?? res.data ?? [] }))
                );
                const memberResults = await Promise.all(memberCachePromises);
                setMemberCache(Object.fromEntries(
                    memberResults.map(({ pid, members }) => [
                        pid,
                        Object.fromEntries(members.map((m: any) => [m.id, m.user_details]))
                    ])
                ));
            } catch (error) {
                console.error("Failed to load chat data:", error);
            } finally {
                setLoading(false);
            }
        };
        if (user) loadInitialData();
    }, [user]);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [messagesMap, selection]);

    const activeKey = useMemo(() => (selection ? `room:${selection.room.id}` : null), [selection]);

    useEffect(() => {
        if (!selection) return;
        const key = `room:${selection.room.id}`;
        if (messagesMap[key]) return;

        apiClient.get(API_ENDPOINTS.roomMessages(selection.room.id))
            .then(res => {
                const rows = res.data?.results ?? res.data ?? [];
                setMessagesMap(prev => ({ ...prev, [key]: rows.map((m: any) => ({
                    id: m.id, membershipId: m.sender, body: m.body, createdAt: m.created_at,
                })).reverse() }));
            }).catch(err => console.error("Failed to fetch messages:", err));
    }, [selection, messagesMap]);

    useEffect(() => {
        if (wsRef.current) wsRef.current.close();
        if (!selection) return;

        const url = makeWsUrl(`/ws/chat/rooms/${selection.room.id}/`, accessToken);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => apiClient.post(API_ENDPOINTS.roomMarkRead(selection.room.id)).catch(() => {});
        ws.onerror = e => console.error('WS error', e);
        ws.onclose = () => wsRef.current = null;
        ws.onopen   = () => console.log("WS open", url);
        ws.onclose  = (e) => console.log("WS closed", e.code, e.reason);
        ws.onerror  = (e) => console.log("WS error", e);
        ws.onmessage = e => {
            try {
                const event = JSON.parse(e.data);
                const currentKey = `room:${selection.room.id}`;

                if (event.type === 'ready' && event.membership) {
                    setMyMembershipIdInRoom(event.membership);
                }

                 if (event.type === 'message.created') {
                     const msg = event.message ?? event;
                     const newMessage: ChatMessageUI = {
                         id: msg.id,
                         membershipId: msg.sender,
                         body: msg.body,
                         createdAt: msg.created_at,
                     };
                     setMessagesMap(prev => {

                        const list = prev[currentKey] ? [...prev[currentKey]] : [];
                        if (!list.some(m => m.id === newMessage.id)) list.push(newMessage);
                        return { ...prev, [currentKey]: list };
                    });
                    apiClient.get(API_ENDPOINTS.rooms).then(res => setRooms(res.data?.results ?? res.data ?? []));
                }
            } catch (err) {
                console.error("Error processing WebSocket message:", err);
            }
        };
        return () => ws.close();
    }, [selection, accessToken]);
    
    // ✅ FIX: This function now uses the new, robust backend endpoint
    async function openOrCreatePharmacyRoom(pharmacyId: number) {
        try {
            setSelection(null); // Clear previous selection to show loading/transition
            const res = await apiClient.post(API_ENDPOINTS.getOrCreategroup(), { pharmacy_id: pharmacyId });
            const room: ChatRoom = res.data;
            
            setRooms(prev => prev.some(r => r.id === room.id) ? prev.map(r => r.id === room.id ? room : r) : [room, ...prev]);
            setSelection({ kind: 'room', room });
        } catch (error) {
            console.error("Failed to get or create group chat:", error);
        }
    }
  
    const openDmDialog = (pharmacyId: number) => {
        setDmPharmacyId(pharmacyId);
        setDmDialogOpen(true);
        setLoadingCandidates(true);
        apiClient.get(`${API_ENDPOINTS.memberships}?pharmacy=${pharmacyId}`)
            .then(res => {
                const members = res.data?.results ?? res.data ?? [];
                setDmCandidates(members.map((m: any) => m.user_details).filter(Boolean).filter((u: UserLite) => u.id !== myUserId));
            }).finally(() => setLoadingCandidates(false));
    };

    const startDm = async (partnerUserId: number) => {
        if (!dmPharmacyId) return;
        try {
            const resp = await apiClient.post(API_ENDPOINTS.startDm, { pharmacy: dmPharmacyId, partner_user: partnerUserId });
            const room: ChatRoom = resp.data;
            setRooms(prev => prev.some(r => r.id === room.id) ? prev : [room, ...prev]);
            setDmDialogOpen(false);
            setSelection({ kind: 'room', room });
        } catch(err) {
            console.error("Failed to start DM:", err)
        }
    };

    const handleSend = async () => {
        const text = composer.trim();
        if (!text || !selection) return;
        setSending(true);
        setComposer('');
        
        try {
            // Send via HTTP POST for reliability. The WebSocket will receive the broadcast.
            await apiClient.post(API_ENDPOINTS.roomMessages(selection.room.id), { body: text });
        } catch (error) {
            console.error("Failed to send message:", error);
            // Optional: Handle error UI, e.g., show "message failed to send"
            setComposer(text); // Restore composer text on failure
        } finally {
            setSending(false);
        }
    };

    const activeMessages: ChatMessageUI[] = useMemo(() => (activeKey ? messagesMap[activeKey] || [] : []), [activeKey, messagesMap]);

    const headerTitle = useMemo(() => {
        if (!selection) return 'Select a chat';
        const { room } = selection;
        if (room.type === 'GROUP') return room.pharmacy.name;

        const pharmacyMembers = memberCache[room.pharmacy.id] || {};
        const myMemEntry = Object.entries(pharmacyMembers).find(([, u]) => u.id === myUserId);
        const otherMemId = room.participant_ids.find(id => id !== (myMemEntry ? +myMemEntry[0] : -1));
        const otherUser = otherMemId ? pharmacyMembers[otherMemId] : undefined;

        return `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || otherUser?.email || 'Direct Message';
    }, [selection, myUserId, memberCache]);

    return (
        <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', bgcolor: 'grey.100' }}>
            <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <ChatIcon /><Typography variant="h6" fontWeight={700}>Chat</Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}><GroupIcon /><Typography variant="subtitle2" fontWeight={700}>My Community</Typography>{loading && <CircularProgress size={14} sx={{ ml: 1 }} />}</Box>
                    <List dense disablePadding>
                        {pharmacies.map((p) => {
                            const r = rooms.find((rr) => rr.type === 'GROUP' && rr.pharmacy.id === p.id);
                            const senderUser = r?.last_message && memberCache[p.id] ? memberCache[p.id][r.last_message.sender] : null;
                            const senderName = senderUser?.id === myUserId ? 'You' : senderUser?.first_name || 'Someone';
                            const secondary = r?.last_message ? `${senderName}: ${r.last_message.body.slice(0, 40)}` : 'No messages yet';
                            
                            return (
                                <ListItemButton key={p.id} selected={selection?.room.type === 'GROUP' && selection.room.pharmacy.id === p.id} onClick={() => openOrCreatePharmacyRoom(p.id)}>
                                    <ListItemAvatar><Avatar sx={{ bgcolor: 'primary.light' }}>{p.name.charAt(0)}</Avatar></ListItemAvatar>
                                    <ListItemText primary={p.name} secondary={secondary} secondaryTypographyProps={{ noWrap: true, fontStyle: r?.last_message ? 'normal' : 'italic' }} />
                                    {!!r?.unread_count && <Badge color="error" badgeContent={r.unread_count} sx={{ ml: 1 }} />}
                                    <Tooltip title="Start a DM with a member"><IconButton edge="end" size="small" onClick={(e) => { e.stopPropagation(); openDmDialog(p.id); }}><PersonAddIcon fontSize="small" /></IconButton></Tooltip>
                                </ListItemButton>
                            );
                        })}
                    </List>
                    <Divider sx={{ mt: 1 }} />
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="subtitle2" fontWeight={700}>Direct Messages</Typography></Box>
                    <List dense disablePadding>
                        {rooms.filter(r => r.type === 'DM').map((r) => {
                            const pharmacyMembers = memberCache[r.pharmacy.id] || {};
                            const myMembershipEntry = Object.entries(pharmacyMembers).find(([, u]) => u.id === myUserId);
                            const myMemId = myMembershipEntry ? parseInt(myMembershipEntry[0]) : -1;
                            const otherMemId = r.participant_ids.find(id => id !== myMemId);
                            const otherUser = otherMemId ? pharmacyMembers[otherMemId] : undefined;
                            const primary = `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || otherUser?.email || 'User';
                            const preview = r.last_message ? `${r.last_message.sender === myMemId ? 'You' : (otherUser?.first_name || 'Them')}: ${r.last_message.body.slice(0, 40)}` : 'No messages yet';

                            return (
                                <ListItemButton key={r.id} selected={selection?.room.id === r.id} onClick={() => setSelection({ kind: 'room', room: r })}>
                                    <ListItemAvatar><Avatar src={otherUser?.avatar || undefined}>{initials(otherUser)}</Avatar></ListItemAvatar>
                                    <ListItemText primary={primary} secondary={preview} secondaryTypographyProps={{ noWrap: true, fontStyle: r?.last_message ? 'normal' : 'italic' }} />
                                    {!!r.unread_count && <Badge color="error" badgeContent={r.unread_count} sx={{ ml: 1 }} />}
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Box>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} square elevation={0}>
                    <Typography variant="subtitle1" fontWeight={700}>{headerTitle}</Typography>
                    {selection && <Tooltip title="Close chat"><IconButton onClick={() => setSelection(null)}><CloseIcon /></IconButton></Tooltip>}
                </Paper>
                <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                    {!selection ? (
                        <Stack height="100%" alignItems="center" justifyContent="center" spacing={1}><ChatIcon color="action" sx={{ fontSize: 40 }}/><Typography color="text.secondary">Select a conversation to start chatting</Typography></Stack>
                    ) : (
                        <Stack spacing={2}>
                            {activeMessages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    me={msg.membershipId === myMembershipIdInRoom}
                                    sender={memberCache[selection.room.pharmacy.id]?.[msg.membershipId]}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </Stack>
                    )}
                </Box>
                <Paper sx={{ p: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }} elevation={0} square>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <TextField fullWidth size="small" variant="outlined" placeholder={selection ? "Type a message..." : "Select a chat to begin"} value={composer} onChange={e => setComposer(e.target.value)} disabled={!selection || sending} onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} />
                        <IconButton color="primary" onClick={handleSend} disabled={!selection || sending || !composer.trim()}>
                            {sending ? <CircularProgress size={24} /> : <SendIcon />}
                        </IconButton>
                    </Stack>
                </Paper>
            </Box>
      
            <Dialog open={dmDialogOpen} onClose={() => setDmDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Start a direct message</DialogTitle>
                <DialogContent dividers>
                    {loadingCandidates ? <CircularProgress /> : (
                        <Stack spacing={1}>
                            {dmCandidates.length > 0 ? dmCandidates.map(u => 
                                <Chip 
                                    key={u.id} 
                                    avatar={<Avatar>{initials(u)}</Avatar>} 
                                    label={`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email} 
                                    onClick={() => startDm(u.id)} 
                                    clickable 
                                />
                            ) : <Typography>No other members found in this pharmacy.</Typography>}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions><Button onClick={() => setDmDialogOpen(false)}>Close</Button></DialogActions>
            </Dialog>
        </Box>
    );
}