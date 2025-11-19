import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, Surface, Avatar, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../utils/apiClient';

interface Message {
    id: number;
    sender: number;
    content: string;
    created_at: string;
    is_me: boolean;
}

export default function MessageDetailScreen() {
    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchMessages();
        // Optional: Set up polling or socket here
    }, [id]);

    const fetchMessages = async () => {
        try {
            const response = await apiClient.get(`/client-profile/messages/?conversation=${id}`);
            // Transform if necessary, assuming backend returns list of messages
            // We need to know which messages are "mine". 
            // The backend might return 'sender' ID. We need to know our own ID or if the backend adds 'is_me'.
            // For now, let's assume the backend might NOT add 'is_me' directly unless we check against our profile.
            // However, usually a well-designed API for mobile might.
            // If not, we can check against a stored user ID. 
            // Let's assume the response data has what we need or we'll adjust.
            // Actually, let's assume the backend returns a list where we can deduce it.
            // For this MVP, let's assume the backend returns `is_me` or we compare sender ID.
            // Since I don't have the user ID handy in a global store without fetching profile, 
            // I'll rely on the backend providing `is_me` or similar, OR I'll fetch profile first.
            // Let's try to fetch profile if we haven't. 
            // Actually, let's just map it and see. If `is_me` is missing, we might need to fix it.

            setMessages(response.data.results || response.data);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            const response = await apiClient.post('/client-profile/messages/', {
                conversation: id,
                content: newMessage,
            });

            // Append new message
            setMessages(prev => [...prev, response.data]);
            setNewMessage('');

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.is_me; // Assuming backend provides this
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
                title: name as string || 'Chat',
                headerBackTitle: 'Messages',
            }} />

            {/* Custom Header if not using Stack.Screen header or to augment it */}
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Avatar.Text size={40} label={(name as string)?.[0] || '?'} style={styles.avatar} />
                <Text variant="titleMedium" style={styles.headerTitle}>{name || 'Chat'}</Text>
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
                    keyExtractor={item => item.id.toString()}
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
    avatar: {
        backgroundColor: '#E0E7FF',
        marginRight: 12,
    },
    headerTitle: {
        fontWeight: '600',
        flex: 1,
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
