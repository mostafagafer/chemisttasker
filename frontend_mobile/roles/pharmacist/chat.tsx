import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, Searchbar, Surface, Avatar, Badge, IconButton, Portal, Modal, Button, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRooms, fetchChatParticipants, startDirectMessageByUser, startDirectMessageByMembership } from '@chemisttasker/shared-core';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';

type RawChatRoom = {
  id: number;
  title?: string | null;
  unread_count?: number;
  updated_at?: string;
  last_message?: {
    body?: string;
    created_at?: string;
  } | null;
  pinned?: boolean;
  chat_type?: string | null;
};

interface ConversationDisplay {
  id: number;
  participant_name: string;
  participant_initials: string;
  last_message: string;
  timestamp: string;
  unread_count: number;
  is_online: boolean;
  pinned?: boolean;
  chat_type?: string | null;
}

export default function PharmacistChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationDisplay[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [participantQuery, setParticipantQuery] = useState('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [starting, setStarting] = useState(false);

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
        is_online: false,
        pinned: !!room.pinned,
        chat_type: room.chat_type || 'dm',
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

  const filteredConversations = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    const filtered = conversations.filter((conv) =>
      conv.participant_name.toLowerCase().includes(lower)
    );
    const pinned = filtered.filter((c) => c.pinned || c.unread_count > 0);
    const rest = filtered.filter((c) => !pinned.includes(c));
    return { pinned, rest };
  }, [conversations, searchQuery]);

  const loadParticipants = useCallback(async () => {
    try {
      const list = await fetchChatParticipants();
      setParticipants(Array.isArray(list) ? list : []);
    } catch {
      setParticipants([]);
    }
  }, []);

  const startChat = useCallback(async () => {
    const target = participants.find((p) =>
      (p.name || '').toLowerCase().includes(participantQuery.toLowerCase())
    );
    if (!target?.id) return;
    setStarting(true);
    try {
      const room = await startDirectMessageByUser(target.id);
      setNewChatVisible(false);
      setParticipantQuery('');
      await fetchConversations();
      if (room?.id) {
        router.push({ pathname: '/pharmacist/messages/[id]', params: { id: room.id, name: room.title || target.name } } as any);
      }
    } catch (err) {
      console.error('Failed to start chat', err);
    } finally {
      setStarting(false);
    }
  }, [participants, participantQuery, fetchConversations, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>Messages</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>Chat with your contacts</Text>
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search conversations..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor="#6B7280"
        />
      </View>

      <Surface style={styles.banner}>
        <Badge style={styles.newBadge}>NEW</Badge>
        <Text variant="bodyMedium" style={styles.bannerText}>
          Chat is live. Start messaging your contacts directly.
        </Text>
        <Button mode="contained-tonal" compact onPress={() => { setNewChatVisible(true); loadParticipants(); }}>
          New chat
        </Button>
      </Surface>

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
        >
          {filteredConversations.pinned.length > 0 && (
            <Text style={styles.sectionLabel}>Pinned / Unread</Text>
          )}
          {filteredConversations.pinned.map((conversation) => (
            <TouchableOpacity
              key={`p-${conversation.id}`}
              activeOpacity={0.7}
              onPress={() => router.push({
                pathname: '/pharmacist/messages/[id]' as any,
                params: { id: conversation.id, name: conversation.participant_name }
              })}
            >
              <Card style={styles.conversationCard}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.avatarContainer}>
                    <Avatar.Text
                      size={52}
                      label={conversation.participant_initials}
                      style={styles.avatar}
                      labelStyle={styles.avatarLabel}
                      color="#FFFFFF"
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
                          conversation.unread_count > 0 && styles.unreadMessage,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {conversation.last_message}
                      </Text>
                      {conversation.unread_count > 0 && (
                        <Badge style={styles.unreadBadge}>
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}

          {filteredConversations.rest.length > 0 && (
            <Text style={styles.sectionLabel}>All chats</Text>
          )}
          {filteredConversations.rest.map((conversation) => (
            <TouchableOpacity
              key={`r-${conversation.id}`}
              activeOpacity={0.7}
              onPress={() => router.push({
                pathname: '/pharmacist/messages/[id]' as any,
                params: { id: conversation.id, name: conversation.participant_name }
              })}
            >
              <Card style={styles.conversationCard}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.avatarContainer}>
                    <Avatar.Text
                      size={52}
                      label={conversation.participant_initials}
                      style={styles.avatar}
                      labelStyle={styles.avatarLabel}
                      color="#FFFFFF"
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
                          conversation.unread_count > 0 && styles.unreadMessage,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {conversation.last_message}
                      </Text>
                      {conversation.unread_count > 0 && (
                        <Badge style={styles.unreadBadge}>
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}

          {filteredConversations.pinned.length + filteredConversations.rest.length === 0 && (
            <View style={styles.emptyState}>
              <IconButton icon="message-text-outline" size={64} iconColor="#E5E7EB" />
              <Text variant="titleMedium" style={styles.emptyTitle}>No conversations yet</Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Start a new chat from the web to see it here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Portal>
        <Modal visible={newChatVisible} onDismiss={() => setNewChatVisible(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>Start a direct message</Text>
          <TextInput
            label="Search participant"
            value={participantQuery}
            onChangeText={setParticipantQuery}
            mode="outlined"
            style={{ marginBottom: 8 }}
          />
          <ScrollView style={{ maxHeight: 200 }}>
            {participants
              .filter((p) => (p.name || '').toLowerCase().includes(participantQuery.toLowerCase()))
              .map((p) => (
                <TouchableOpacity key={p.id} style={styles.participantRow} onPress={() => setParticipantQuery(p.name || '')}>
                  <Text>{p.name || 'User'}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
          <Button mode="contained" loading={starting} onPress={startChat} disabled={!participantQuery}>
            Start chat
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  searchInput: {
    minHeight: 0,
  },
  banner: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 0,
  },
  newBadge: {
    backgroundColor: '#10B981',
    fontWeight: 'bold',
  },
  bannerText: {
    color: '#374151',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  conversationCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    backgroundColor: '#6366F1',
  },
  avatarLabel: {
    fontSize: 18,
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
    fontSize: 16,
  },
  timestamp: {
    color: '#9CA3AF',
    fontSize: 12,
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
  modal: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  participantRow: {
    paddingVertical: 8,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  sectionLabel: {
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
    paddingHorizontal: 20,
  },
});
