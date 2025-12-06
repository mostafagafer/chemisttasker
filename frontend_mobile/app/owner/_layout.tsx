import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Avatar, IconButton, Portal, Modal, List, Divider, Button, Text } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { getNotifications } from '@chemisttasker/shared-core';
import { useFocusEffect } from '@react-navigation/native';

const tabTitles: Record<string, string> = {
  dashboard: 'Home',
  'shifts/index': 'Shifts',
  'post-shift': 'Post Shift',
  'pharmacies/index': 'Pharmacies',
  hub: 'Hub',
  messages: 'Messages',
  notifications: 'Notifications',
};

const sidebarItems = [
  { label: 'Dashboard', icon: 'home', route: '/owner/dashboard' },
  { label: 'Pharmacies', icon: 'store', route: '/owner/pharmacies' },
  { label: 'Staff', icon: 'account-group', route: '/owner/staff' },
  { label: 'Locums', icon: 'account-heart', route: '/owner/locums' },
  { label: 'Shifts', icon: 'calendar-month', route: '/owner/shifts' },
  { label: 'Messages', icon: 'message', route: '/owner/messages' },
  { label: 'Profile', icon: 'account-circle', route: '/owner/profile' },
  { label: 'Settings', icon: 'cog', route: '/owner/profile/settings' },
];

function OwnerSidebar({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();

  const handleNav = (route: string) => {
    onDismiss();
    router.push(route as any);
  };

  const handleLogout = async () => {
    onDismiss();
    await logout();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.sidebar}>
        <Text variant="titleMedium" style={styles.sidebarTitle}>Owner menu</Text>
        <Divider />
        {sidebarItems.map((item) => (
          <List.Item
            key={`${item.route}-${item.label}`}
            title={item.label}
            left={(props) => <List.Icon {...props} icon={item.icon} />}
            onPress={() => handleNav(item.route)}
          />
        ))}
        <Divider />
        <Button icon="logout" textColor="#DC2626" onPress={handleLogout}>
          Logout
        </Button>
      </Modal>
    </Portal>
  );
}

export default function OwnerLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const res: any = await getNotifications();
      const list = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      const unread = list.filter((n: any) => !n.read_at).length;
      setUnreadCount(unread);
    } catch (err) {
      // ignore errors for badge
    }
  }, []);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);

  useFocusEffect(
    useCallback(() => {
      void loadUnread();
    }, [loadUnread])
  );

  const { isDashboard, backTarget } = useMemo(() => {
    if (!pathname) return { isTabRoot: true, backTarget: null };
    const segments = pathname.split('/').filter(Boolean);
    const isDash = segments[0] === 'owner' && (segments[1] ?? 'dashboard') === 'dashboard';

    // Build parent path for nested routes: /owner/pharmacies/123/staff -> /owner/pharmacies/123
    let parent: string | null = null;
    if (segments.length > 2) {
      parent = `/${segments.slice(0, -1).join('/')}`;
    }

    return { isDashboard: isDash, backTarget: parent };
  }, [pathname]);

  return (
    <>
      <OwnerSidebar visible={sidebarVisible} onDismiss={() => setSidebarVisible(false)} />
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: 65,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          headerShown: true,
          headerTitle: tabTitles[route.name] || 'Owner',
          headerLeft: () => (
            <IconButton icon="menu" onPress={() => setSidebarVisible(true)} />
          ),
          headerRight: () => {
            const canGoBack = typeof router.canGoBack === 'function' ? router.canGoBack() : false;
            const showBack = !isDashboard;
            const photo =
              (user as any)?.profile_photo ||
              (user as any)?.profile_photo_url ||
              (user as any)?.profilePhoto ||
              null;
            return (
              <>
                {showBack ? (
                  <IconButton
                    icon="arrow-left"
                    onPress={() => {
                      if (canGoBack) {
                        router.back();
                      } else if (backTarget) {
                        router.push(backTarget as any);
                      } else {
                        router.push('/owner/dashboard');
                      }
                    }}
                  />
                ) : null}
                <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={{ marginHorizontal: 4 }}>
                  <IconButton icon="bell-outline" />
                  {unreadCount > 0 && (
                    <Text style={styles.badgeDot}>•</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/owner/profile' as any)}>
                  {photo ? (
                    <Avatar.Image size={32} source={{ uri: photo as string }} />
                  ) : (
                    <Avatar.Text
                      size={32}
                      label={(user?.username || user?.email || 'U').charAt(0).toUpperCase()}
                      style={styles.avatar}
                      labelStyle={styles.avatarLabel}
                    />
                  )}
                </TouchableOpacity>
              </>
            );
          },
        })}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <IconButton icon="home" iconColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="shifts/index"
          options={{
            title: 'Shifts',
            tabBarIcon: ({ color, size }) => (
              <IconButton icon="calendar" iconColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="post-shift"
          options={{
            title: 'Post',
            tabBarIcon: ({ color }) => (
              <IconButton
                icon="plus-circle"
                iconColor="#FFFFFF"
                size={32}
                style={{
                  backgroundColor: '#6366F1',
                  borderRadius: 24,
                  marginTop: -20,
                }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <IconButton icon="message" iconColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="hub"
          options={{
            title: 'Hub',
            tabBarIcon: ({ color, size }) => (
              <IconButton icon="account-group" iconColor={color} size={size} />
            ),
          }}
        />
        {/* Hidden but routable screens */}
        <Tabs.Screen
          name="pharmacies/index"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="pharmacies/[id]" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/edit" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/staff" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/locums" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/add" options={{ href: null }} />
        <Tabs.Screen name="pharmacy" options={{ href: null }} />
        <Tabs.Screen name="shifts/create" options={{ href: null }} />
        <Tabs.Screen name="shifts/[id]" options={{ href: null }} />
        <Tabs.Screen name="shifts/[id]/applications" options={{ href: null }} />
        <Tabs.Screen name="staff/index" options={{ href: null }} />
        <Tabs.Screen name="locums/index" options={{ href: null }} />
        <Tabs.Screen name="messages/[id]" options={{ href: null }} />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 8,
    borderRadius: 12,
  },
  sidebarTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  avatar: { backgroundColor: '#6366F1' },
  avatarLabel: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 16,
  },
});
