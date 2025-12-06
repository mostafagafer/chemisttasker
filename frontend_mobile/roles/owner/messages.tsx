import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Card, Searchbar, Surface, Avatar, Badge } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRooms } from '@chemisttasker/shared-core';

type RawChatRoom = {
    id: number;
    title?: string | null;
    unread_count?: number;
    updated_at?: string;
    last_message?: {
        body?: string;
        created_at?: string;
    } | null;
};

interface ConversationDisplay {
    id: number;
    participant_name: string;
    participant_initials: string;
    last_message: string;
    timestamp: string;
    unread_count: number;
    is_online: boolean;
}

export default function MessagesScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [conversations, setConversations] = useState<ConversationDisplay[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchConversations = useCallback(async () => {
        try {
            const data = await getRooms();
            const rooms: RawChatRoom[] = Array.isArray((data as any)?.results)
                ? (data as any).results
                : Array.isArray(data)
                    ? (data as any)
                    : [];

            const transformed = rooms.map((room) => ({
                id: room.id,
                participant_name: room.title || 'Conversation',
                participant_initials: getInitials(room.title || 'C'),
                last_message: room.last_message?.body || 'No messages yet',
                timestamp: formatTimestamp(room.last_message?.created_at),
                unread_count: room.unread_count || 0,
                is_online: false, // Not provided by backend
            }));
            setConversations(transformed);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchConversations();
    }, [fetchConversations]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchConversations();
        setRefreshing(false);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .join('')
            .toUpperCase();
    };

    const formatTimestamp = (timestamp?: string) => {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-GB');
    };

    const filteredConversations = useMemo(
        () =>
            conversations.filter((conv) =>
                conv.participant_name.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [conversations, searchQuery]
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text variant="headlineSmall" style={styles.title}>Messages</Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Chat with your locums
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Search conversations..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                />
            </View>

            {/* New Feature Banner */}
            <Surface style={styles.banner}>
                <Badge style={styles.newBadge}>NEW</Badge>
                <Text variant="bodyMedium" style={styles.bannerText}>
                    Chat feature is now live! Start messaging your locums directly.
                </Text>
            </Surface>

            {/* Conversations List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.loadingText}>Loading conversations...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {filteredConversations.map((conversation) => (
                        <Card
                            key={conversation.id}
                            style={styles.conversationCard}
                            onPress={() => router.push({
                                pathname: '/owner/messages/[id]',
                                params: { id: conversation.id, name: conversation.participant_name }
                            })}
                        >
                            <Card.Content style={styles.cardContent}>
                                <View style={styles.avatarContainer}>
                                    <Avatar.Text
                                        size={48}
                                        label={conversation.participant_initials}
                                        style={styles.avatar}
                                        labelStyle={styles.avatarLabel}
                                    />
                                    {conversation.is_online && <View style={styles.onlineIndicator} />}
                                </View>

                                <View style={styles.messageContent}>
                                    <View style={styles.messageHeader}>
                                        <Text variant="titleMedium" style={styles.participantName}>
                                            {conversation.participant_name}
                                        </Text>
                                        <Text variant="bodySmall" style={styles.timestamp}>
                                            {conversation.timestamp}
                                        </Text>
                                    </View>

                                    <View style={styles.messagePreview}>
                                        <Text
                                            variant="bodyMedium"
                                            style={[
                                                styles.lastMessage,
                                                conversation.unread_count > 0 && styles.unreadMessage
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {conversation.last_message}
                                        </Text>
                                        {conversation.unread_count > 0 && (
                                            <Badge style={styles.unreadBadge} size={20}>
                                                {conversation.unread_count}
                                            </Badge>
                                        )}
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    ))}

                    {filteredConversations.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text variant="titleMedium" style={styles.emptyTitle}>
                                No conversations yet
                            </Text>
                            <Text variant="bodyMedium" style={styles.emptyText}>
                                Your conversations will appear here
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        marginBottom: 12,
    },
    title: {
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        color: '#6B7280',
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        elevation: 0,
    },
    banner: {
        backgroundColor: '#EEF2FF',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    newBadge: {
        backgroundColor: '#6366F1',
    },
    bannerText: {
        color: '#6366F1',
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#6B7280',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    conversationCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    cardContent: {
        flexDirection: 'row',
        padding: 12,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    avatar: {
        backgroundColor: '#6366F1',
    },
    avatarLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    messageContent: {
        flex: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    participantName: {
        fontWeight: '600',
        color: '#111827',
    },
    timestamp: {
        color: '#9CA3AF',
    },
    messagePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        color: '#6B7280',
        flex: 1,
    },
    unreadMessage: {
        fontWeight: '600',
        color: '#111827',
    },
    unreadBadge: {
        backgroundColor: '#6366F1',
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontWeight: '600',
        marginBottom: 8,
        color: '#111827',
    },
    emptyText: {
        color: '#6B7280',
        textAlign: 'center',
    },
});
