import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, Surface, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRoomMessages, sendRoomMessage } from '@chemisttasker/shared-core';
import { useAuth } from '../../../context/AuthContext';

interface MessageDisplay {
    id: number;
    sender: number | string;
    content: string;
    created_at: string;
    is_me: boolean;
}

export default function MessageDetailScreen() {
    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [messages, setMessages] = useState<MessageDisplay[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList<MessageDisplay>>(null);

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

            const mapped = list.map((msg: any, idx: number) => ({
                id: msg.id ?? `${msg.created_at ?? ''}-${idx}`,
                sender: msg.sender?.id ?? msg.sender,
                content: msg.body ?? msg.content ?? '',
                created_at: msg.created_at ?? new Date().toISOString(),
                is_me: user?.id != null ? (msg.sender?.id ?? msg.sender) === user.id : false,
            }));
            setMessages(mapped);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, parseRoomId]);

    useEffect(() => {
        void fetchMessages();
    }, [fetchMessages]);

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        const roomId = parseRoomId();
        if (!roomId) return;

        setSending(true);
        try {
            const payload = { content: newMessage };
            const sentMessage = await sendRoomMessage(roomId, payload) as any;
            const newMsg: MessageDisplay = {
                id: sentMessage.id ?? `${Date.now()}`,
                sender: sentMessage.sender?.id ?? sentMessage.sender,
                content: sentMessage.body ?? sentMessage.content ?? newMessage,
                created_at: sentMessage.created_at ?? new Date().toISOString(),
                is_me: true,
            };
            setMessages((prev) => [...prev, newMsg]);
            setNewMessage('');
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: MessageDisplay }) => {
        const isMe = item.is_me;
        return (
            <View style={[
                styles.messageContainer,
                isMe ? styles.myMessageContainer : styles.theirMessageContainer
            ]}>
                <Surface style={[
                    styles.messageBubble,
                    isMe ? styles.myMessageBubble : styles.theirMessageBubble
                ]} elevation={1}>
                    <Text style={[
                        styles.messageText,
                        isMe ? styles.myMessageText : styles.theirMessageText
                    ]}>
                        {item.content}
                    </Text>
                    <Text style={[
                        styles.timestamp,
                        isMe ? styles.myTimestamp : styles.theirTimestamp
                    ]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </Surface>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <Stack.Screen options={{
                headerShown: true,
                title: (name as string) || 'Chat',
                headerBackTitle: 'Messages',
            }} />

            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Surface style={styles.titleRow} elevation={0}>
                    <Text variant="titleMedium" style={styles.headerTitle}>{name || 'Chat'}</Text>
                </Surface>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => (item.id ?? index).toString()}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                />
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <Surface style={styles.inputContainer} elevation={4}>
                    <TextInput
                        mode="outlined"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChangeText={setNewMessage}
                        style={styles.input}
                        outlineStyle={styles.inputOutline}
                        right={
                            <TextInput.Icon
                                icon="send"
                                onPress={sendMessage}
                                disabled={sending || !newMessage.trim()}
                                color={newMessage.trim() ? '#6366F1' : '#9CA3AF'}
                            />
                        }
                    />
                </Surface>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    titleRow: {
        flex: 1,
        paddingHorizontal: 8,
        backgroundColor: 'transparent',
        elevation: 0,
    },
    headerTitle: {
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 20,
    },
    messageContainer: {
        marginBottom: 12,
        flexDirection: 'row',
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
    },
    myMessageBubble: {
        backgroundColor: '#6366F1',
        borderBottomRightRadius: 4,
    },
    theirMessageBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    myMessageText: {
        color: '#FFFFFF',
    },
    theirMessageText: {
        color: '#1F2937',
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    myTimestamp: {
        color: '#E0E7FF',
    },
    theirTimestamp: {
        color: '#9CA3AF',
    },
    inputContainer: {
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    input: {
        backgroundColor: '#F9FAFB',
        maxHeight: 100,
    },
    inputOutline: {
        borderRadius: 24,
        borderColor: '#E5E7EB',
    },
});
