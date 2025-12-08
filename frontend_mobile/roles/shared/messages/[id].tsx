import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, IconButton, Surface, ActivityIndicator, Menu, Divider, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {
    getRoomMessages,
    sendRoomMessageService,
    markRoomAsRead,
    reactToMessageService,
    updateMessageService,
    deleteMessageService,
    toggleRoomPinService,
    type ChatMessage,
} from '@chemisttasker/shared-core';
import { useAuth } from '../../../context/AuthContext';
import { useLiveMessages } from './useLiveMessages';
import debounce from 'lodash.debounce';
import { useFocusEffect } from '@react-navigation/native';
import { triggerUnreadBump } from '@/utils/pushNotifications';
import { setActiveRoomId } from '../chat/activeRoomState';

type MessageDisplay = ChatMessage & { is_me: boolean };
const dedupeById = (list: MessageDisplay[]) => {
    const seen = new Set<string | number>();
    const result: MessageDisplay[] = [];
    for (const item of list) {
        const key = item.id ?? `${item.created_at}-${item.body}`;
        if (seen.has(key as any)) continue;
        seen.add(key as any);
        result.push(item);
    }
    return result;
};

export default function SharedMessageDetailScreen() {
    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const { user, access } = useAuth();

    const [messages, setMessages] = useState<MessageDisplay[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [menuFor, setMenuFor] = useState<number | null>(null);
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const [roomPinned, setRoomPinned] = useState<boolean>(false);
    const [typingUsernames, setTypingUsernames] = useState<string[]>([]);
    const typingSentRef = useRef(0);
    const [lastReadAt, setLastReadAt] = useState<string | null>(null);
    const flatListRef = useRef<FlatList<MessageDisplay>>(null);
    const pollRef = useRef<number | null>(null);

    const parseRoomId = useCallback(() => {
        if (Array.isArray(id)) return parseInt(id[0], 10);
        if (typeof id === 'string') return parseInt(id, 10);
        return typeof id === 'number' ? id : NaN;
    }, [id]);

    const fetchMessages = useCallback(async () => {
        const roomId = parseRoomId();
        if (!roomId) return;
        try {
            const data = await getRoomMessages(roomId);
            const list = Array.isArray((data as any)?.results)
                ? (data as any).results
                : Array.isArray(data)
                    ? (data as any)
                    : [];

            if ((data as any)?.my_last_read_at) {
                setLastReadAt((data as any).my_last_read_at);
            }

            const mapped: MessageDisplay[] = list.map((msg: any, idx: number) => {
                const senderUserId =
                    msg.sender?.user_details?.id ??
                    msg.sender?.user?.id ??
                    msg.sender?.id ??
                    msg.sender;
                return {
                    id: msg.id ?? `${msg.created_at ?? ''}-${idx}`,
                    sender: msg.sender,
                    conversation: msg.conversation ?? roomId,
                    body: msg.body ?? msg.content ?? '',
                    created_at: msg.created_at ?? new Date().toISOString(),
                    attachment_url: msg.attachment_url ?? null,
                    attachment_filename: msg.attachment_filename ?? null,
                    is_deleted: msg.is_deleted,
                    is_edited: msg.is_edited,
                    reactions: msg.reactions ?? [],
                    is_pinned: msg.is_pinned,
                    is_me: user?.id != null ? senderUserId === user.id : false,
                };
            });
            const sorted = dedupeById(mapped).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            setMessages(sorted);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
            const res = await markRoomAsRead(roomId);
            if ((res as any)?.last_read_at) {
                setLastReadAt((res as any).last_read_at);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, parseRoomId]);

    useEffect(() => {
        void fetchMessages();
        // The polling via setInterval has been removed. It was causing a race condition
        // with WebSocket updates, making new messages disappear. The initial fetch on
        // mount and the live WebSocket connection are the correct pattern.
        return () => {
            // Cleanup ref just in case
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchMessages]);

    useFocusEffect(
        useCallback(() => {
            const roomId = parseRoomId();
            if (roomId) {
                setActiveRoomId(roomId);
            }
        }, [parseRoomId])
    );

    const wsRef = useLiveMessages(
      user ? (parseRoomId() || null) : null,
      access || null,
      (payload) => {
        if (!payload?.type) return;
        const roomId = parseRoomId();
        if (payload.type === 'chat.message' || payload.type === 'message.created') {
            const msg = payload.message || payload;
            const senderUserId =
                msg.sender?.user_details?.id ??
                msg.sender?.user?.id ??
                msg.sender?.id ??
                msg.sender;
            const mapped: MessageDisplay = {
                id: msg.id ?? `${Date.now()}`,
                sender: msg.sender,
                conversation: msg.conversation ?? roomId,
                body: msg.body ?? msg.content ?? '',
                created_at: msg.created_at ?? new Date().toISOString(),
                attachment_url: msg.attachment_url ?? null,
                attachment_filename: msg.attachment_filename ?? null,
                is_deleted: msg.is_deleted,
                is_edited: msg.is_edited,
                reactions: msg.reactions ?? [],
                is_pinned: msg.is_pinned,
                is_me: user?.id != null ? senderUserId === user.id : false,
            };
            setMessages((prev) =>
                dedupeById([...prev, mapped]).sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
            );
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        } else if (payload.type === 'message.updated') {
            const msg = payload.message || payload;
            setMessages((prev) =>
                dedupeById(
                    prev.map((m) =>
                        m.id === msg.id
                            ? {
                                ...m,
                                body: msg.body ?? m.body,
                                is_edited: true,
                            }
                            : m
                    )
                ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            );
        } else if (payload.type === 'message.deleted') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.message_id));
        } else if (payload.type === 'reaction.updated') {
            const messageId = payload.message_id;
            setMessages((prev) =>
                dedupeById(prev.map((m) => (m.id === messageId ? { ...m, reactions: payload.reactions ?? [] } : m)))
            );
        } else if (payload.type === 'typing') {
            const who = payload.user_name || payload.username || payload.user || '';
            if (!who) return;
            setTypingUsernames((prev) => {
                const set = new Set(prev);
                set.add(who);
                return Array.from(set);
            });
            setTimeout(() => {
                setTypingUsernames((prev) => prev.filter((n) => n !== who));
            }, 2000);
        }
      },
      (payload) => {
        triggerUnreadBump(payload);
      }
    );

    const sendMessage = async () => {
        const body = newMessage.trim();
        if (!body) return;
        const roomId = parseRoomId();
        if (!roomId) return;

        setSending(true);
        try {
            if (editingId) {
                const updated = await updateMessageService(editingId, body);
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, body: updated.body, is_edited: true } : m)));
                setEditingId(null);
                setNewMessage('');
                return;
            }

            const payload = { body, content: body };
            const sentMessage = await sendRoomMessageService(roomId, payload) as any;
            const newMsg: MessageDisplay = {
                id: sentMessage.id ?? `${Date.now()}`,
                sender: sentMessage.sender,
                conversation: roomId,
                body: sentMessage.body ?? sentMessage.content ?? body,
                created_at: sentMessage.created_at ?? new Date().toISOString(),
                attachment_url: sentMessage.attachment_url ?? null,
                attachment_filename: sentMessage.attachment_filename ?? null,
                reactions: sentMessage.reactions ?? [],
                is_me: true,
            };
            setMessages((prev) =>
                dedupeById([...prev, newMsg]).sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
            );
            setNewMessage('');
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const pickAttachment = async () => {
        const res = await DocumentPicker.getDocumentAsync({ multiple: false });
        if (res.canceled || !res.assets?.length) return;
        const file = res.assets[0];
        const roomId = parseRoomId();
        if (!roomId) return;

        setSending(true);
        try {
            const form = new FormData();
            const body = newMessage.trim() || file.name || 'Attachment';
            form.append('body', body);
            form.append('content', body);
            form.append('attachment', {
                uri: file.uri,
                name: file.name || 'upload',
                type: file.mimeType || 'application/octet-stream',
            } as any);
            const sent = await sendRoomMessageService(roomId, form as any);
            if (!sent?.id) throw new Error('Attachment not saved');
            const mapped: MessageDisplay = {
                id: sent.id,
                sender: sent.sender,
                conversation: roomId,
                body: sent.body ?? body,
                created_at: sent.created_at ?? new Date().toISOString(),
                attachment_url: sent.attachment_url ?? null,
                attachment_filename: sent.attachment_filename ?? null,
                reactions: sent.reactions ?? [],
                is_me: true,
            };
            setMessages((prev) =>
                dedupeById([...prev, mapped]).sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
            );
            setNewMessage('');
        } catch (err: any) {
            console.error('Attachment send failed', err);
            setSnackbar(err?.message || 'Failed to send attachment');
        } finally {
            setSending(false);
        }
    };

    const sendTyping = useCallback(async () => {
        const roomId = parseRoomId();
        if (!roomId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const now = Date.now();
        if (now - typingSentRef.current < 2000) return; // throttle
        typingSentRef.current = now;
        try {
            wsRef.current.send(JSON.stringify({ type: 'typing', room: roomId }));
        } catch {
            // ignore
        }
    }, [parseRoomId]);

    const debouncedTyping = useMemo(() => debounce(sendTyping, 300), [sendTyping]);

    const onReact = async (messageId: number, reaction: string) => {
        try {
            const updated = await reactToMessageService(messageId, reaction);
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, reactions: updated.reactions ?? [] } : m)));
        } catch (err: any) {
            setSnackbar(err?.response?.data?.detail || 'Reaction failed');
        }
    };

    const onDelete = async (messageId: number) => {
        try {
            await deleteMessageService(messageId);
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
        } catch (err: any) {
            setSnackbar(err?.response?.data?.detail || 'Delete failed');
        }
    };

    const onEditStart = (message: MessageDisplay) => {
        setEditingId(message.id as number);
        setNewMessage(message.body || '');
    };

    const onPinMessage = async (messageId: number) => {
        const roomId = parseRoomId();
        if (!roomId) return;
        try {
            await toggleRoomPinService(roomId, { target: 'message', messageId });
            setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, is_pinned: !m.is_pinned } : m))
            );
        } catch (err) {
            console.error('Pin failed', err);
        }
    };

    const onPinRoom = async () => {
        const roomId = parseRoomId();
        if (!roomId) return;
        try {
            const updated = await toggleRoomPinService(roomId, { target: 'conversation' });
            setRoomPinned(!!updated?.is_pinned);
        } catch (err) {
            console.error('Room pin failed', err);
        }
    };

    const viewerReaction = useCallback(
        (item: MessageDisplay) => {
            if (!user?.id || !item.reactions) return null;
            return item.reactions.find((r) => r.user_id === user.id)?.reaction || null;
        },
        [user?.id],
    );

    // Backend payloads -> display emoji
    const REACTION_PAYLOADS = ['dY`?', '??\u000f?,?', 'dY\"?', "dY'c"];
    const REACTION_DISPLAY: Record<string, string> = {
        'dY`?': '\U0001f44d',
        '??\u000f?,?': '\u2764\ufe0f',
        'dY\"?': '\U0001f525',
        "dY'c": '\U0001f4a9',
    };

    const renderReactions = (item: MessageDisplay) => {
        if (!item.reactions || item.reactions.length === 0) return null;
        const grouped = item.reactions.reduce<Record<string, number>>((acc, r) => {
            acc[r.reaction] = (acc[r.reaction] || 0) + 1;
            return acc;
        }, {});
        const mine = viewerReaction(item);
        return (
            <View style={styles.reactionsRow}>
                {Object.entries(grouped).map(([payload, count]) => {
                    const emoji = REACTION_DISPLAY[payload] ?? payload;
                    return (
                        <View key={payload} style={[styles.reactionChip, mine === payload ? styles.myReactionChip : null]}>
                            <Text style={{ fontSize: 12 }}>{emoji} {count}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderMessage = ({ item }: { item: MessageDisplay }) => {
        const isMe = item.is_me;
        return (
            <View style={[
                styles.messageContainer,
                isMe ? styles.myMessageContainer : styles.theirMessageContainer
            ]}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={() => setMenuFor(item.id as number)}
                >
                    <Surface
                        style={[
                            styles.messageBubble,
                            isMe ? styles.myMessageBubble : styles.theirMessageBubble,
                            item.is_pinned ? styles.pinned : null,
                        ]}
                        elevation={1}
                    >
                        <View style={styles.bubbleHeader}>
                            <Text style={[
                                styles.messageText,
                                isMe ? styles.myMessageText : styles.theirMessageText
                            ]}>
                            {item.body}
                            {item.is_edited ? ' (edited)' : ''}
                            </Text>
                        </View>
                    {item.attachment_url ? (
                        <Text style={styles.attachment}>{item.attachment_filename || 'Attachment'}</Text>
                    ) : null}
                    {renderReactions(item)}
                        <Text style={[
                            styles.timestamp,
                            isMe ? styles.myTimestamp : styles.theirTimestamp
                        ]}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </Surface>
                </TouchableOpacity>
                <Menu
                    visible={menuFor === item.id}
                    onDismiss={() => setMenuFor(null)}
                    anchor={<View style={{ width: 1, height: 1 }} />}
                >
                    {isMe ? <Menu.Item leadingIcon="pencil" onPress={() => onEditStart(item)} title="Edit" /> : null}
                    {isMe ? <Menu.Item leadingIcon="delete" onPress={() => onDelete(item.id as number)} title="Delete" /> : null}
                    <Divider />
                    {REACTION_PAYLOADS.map((payload) => (
                        <Menu.Item key={payload} onPress={() => onReact(item.id as number, payload)} title={`React ${REACTION_DISPLAY[payload] ?? payload}`} />
                    ))}
                    {viewerReaction(item) ? (
                        <Menu.Item leadingIcon="close" onPress={() => onReact(item.id as number, viewerReaction(item) as string)} title="Remove reaction" />
                    ) : null}
                    <Divider />
                    <Menu.Item leadingIcon={item.is_pinned ? 'pin-off' : 'pin'} onPress={() => onPinMessage(item.id as number)} title={item.is_pinned ? 'Unpin' : 'Pin'} />
                </Menu>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{
                headerShown: true,
                title: (name as string) || 'Chat',
                headerBackTitle: 'Messages',
                headerRight: () => (
                    <IconButton icon={roomPinned ? 'pin' : 'pin-outline'} onPress={onPinRoom} />
                ),
            }} />

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => `${item.id ?? 'msg'}-${item.created_at ?? index}`}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                />
            )}

            {lastReadAt ? (
                <Text style={styles.readReceipt}>
                    Seen up to {new Date(lastReadAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            ) : null}

            {typingUsernames.length > 0 ? (
                <Text style={styles.typing}>{typingUsernames.join(', ')} typing...</Text>
            ) : null}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <Surface style={styles.inputContainer} elevation={4}>
                    <TextInput
                        mode="outlined"
                        placeholder={editingId ? 'Edit message...' : 'Type a message...'}
                        value={newMessage}
                        onChangeText={(text) => {
                            setNewMessage(text);
                            debouncedTyping();
                        }}
                        style={styles.input}
                        outlineStyle={styles.inputOutline}
                        right={
                            <TextInput.Icon
                                icon="attachment"
                                onPress={pickAttachment}
                                disabled={sending}
                            />
                        }
                        left={
                            <TextInput.Icon
                                icon={editingId ? 'check' : 'send'}
                                onPress={sendMessage}
                                disabled={sending || !newMessage.trim()}
                                color={newMessage.trim() ? '#6366F1' : '#9CA3AF'}
                            />
                        }
                    />
                </Surface>
            </KeyboardAvoidingView>

            <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
                {snackbar}
            </Snackbar>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 12,
        paddingBottom: 24,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '88%',
        minWidth: '55%',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    bubbleHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    menuButton: {
        margin: 0,
        padding: 0,
        alignSelf: 'flex-start',
    },
    myMessageBubble: {
        marginLeft: 'auto',
        backgroundColor: '#C7F9CC',
        borderColor: '#34D399',
        borderWidth: 1,
    },
    theirMessageBubble: {
        marginRight: 'auto',
        backgroundColor: '#E5E7EB',
        borderColor: '#D1D5DB',
        borderWidth: 1,
    },
    messageText: {
        fontSize: 14,
    },
    myMessageText: {
        color: '#111827',
    },
    theirMessageText: {
        color: '#111827',
    },
    timestamp: {
        fontSize: 11,
        marginTop: 4,
    },
    myTimestamp: {
        color: '#4B5563',
        textAlign: 'right',
    },
    theirTimestamp: {
        color: '#9CA3AF',
        textAlign: 'left',
    },
    attachment: {
        marginTop: 4,
        color: '#2563EB',
        textDecorationLine: 'underline',
    },
    reactionsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
    },
    reactionChip: {
        backgroundColor: '#E0E7FF',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    myReactionChip: {
        backgroundColor: '#C7D2FE',
    },
    pinned: {
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    typing: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        color: '#6B7280',
        fontSize: 12,
    },
    readReceipt: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        color: '#9CA3AF',
        fontSize: 11,
        textAlign: 'right',
    },
    inputContainer: {
        padding: 8,
        backgroundColor: '#FFFFFF',
    },
    input: {
        backgroundColor: '#FFFFFF',
    },
    inputOutline: {
        borderRadius: 12,
    },
});
