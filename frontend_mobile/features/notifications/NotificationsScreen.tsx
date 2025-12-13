import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Surface, IconButton, Badge, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNotifications, markNotificationsAsRead } from '@chemisttasker/shared-core';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

type Notification = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  read_at?: string | null;
  type: string;
  related_id?: number;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Refresh when screen gains focus and mark any unread as read.
  useFocusEffect(
    useCallback(() => {
      fetchNotifications(true); // mark all as read when opening
    }, [])
  );

  const fetchNotifications = async (markAllRead = false) => {
    try {
      const response = await getNotifications();
      const list = Array.isArray((response as any)?.results)
        ? (response as any).results
        : Array.isArray(response)
          ? (response as any)
          : [];
      setNotifications(list);
      if (markAllRead) {
        const unreadIds = list.filter((n) => !n.read_at).map((n) => n.id);
        if (unreadIds.length) {
          setNotifications((prev) =>
            prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
          );
          void markNotificationsAsRead(unreadIds);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (id: number) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      await markNotificationsAsRead([id]);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'shift_application':
        return 'briefcase-check';
      case 'message':
        return 'message-text';
      case 'system':
        return 'information';
      default:
        return 'bell';
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <Surface
      style={[styles.notificationItem, !item.read_at && styles.unreadItem]}
      elevation={1}
    >
      <View style={styles.iconContainer}>
        <Surface style={styles.iconSurface} elevation={0}>
          <IconButton icon={getIconForType(item.type)} size={24} iconColor="#6366F1" />
        </Surface>
        {!item.read_at && <Badge size={8} style={styles.unreadDot} />}
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text variant="titleSmall" style={styles.title}>
            {item.title}
          </Text>
          <Text variant="bodySmall" style={styles.time}>
            {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
          </Text>
        </View>
        <Text variant="bodyMedium" style={styles.message} numberOfLines={2}>
          {item.body}
        </Text>
      </View>

      {!item.read_at && (
        <IconButton icon="check" size={20} onPress={() => markAsRead(item.id)} iconColor="#6B7280" />
      )}
    </Surface>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Notifications
        </Text>
        {notifications.filter((n) => !n.read_at).length > 0 && (
          <Badge style={styles.headerBadge}>
            {`${notifications.filter((n) => !n.read_at).length} new`}
          </Badge>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No notifications
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                You&apos;re all caught up!
              </Text>
            </View>
          }
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#111827',
  },
  headerBadge: {
    backgroundColor: '#6366F1',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: '#F5F7FF',
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  iconSurface: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  time: {
    color: '#9CA3AF',
  },
  message: {
    color: '#6B7280',
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
  },
});
