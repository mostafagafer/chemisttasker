import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, IconButton, Modal, Portal, List, Divider, Button, Text, Menu } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

const tabTitles: Record<string, string> = {
  dashboard: 'Home',
  'shifts/index': 'Shifts',
  chat: 'Chat',
  profile: 'Profile',
};

const sidebarItems = [
  { label: 'Dashboard', icon: 'view-dashboard', route: '/pharmacist/dashboard' },
  { label: 'Onboarding', icon: 'account-box', route: '/pharmacist/onboarding' },
  { label: 'Availability', icon: 'calendar-clock', route: '/pharmacist/availability' },
  { label: 'Shifts', icon: 'calendar-range', route: '/pharmacist/shifts' },
  { label: 'Invoices', icon: 'file-document-multiple', route: '/pharmacist/invoice' },
  { label: 'Interests', icon: 'heart-outline', route: '/pharmacist/interests' },
  { label: 'Learning', icon: 'school-outline', route: '/pharmacist/learning' },
  // notifications available via top bell; hidden from tab bar
  { label: 'Notifications', icon: 'bell-outline', route: '/notifications', hidden: true },
];

function PharmacistSidebar({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
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
        <Text variant="titleMedium" style={styles.sidebarTitle}>Pharmacist menu</Text>
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

export default function PharmacistTabs() {
  const { user, isLoading } = useAuth();
  const { workspace, setWorkspace } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeAdminId, setActiveAdminId] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'PHARMACIST') {
      switch (user.role) {
        case 'OWNER':
          router.replace('/owner' as any);
          break;
        case 'OTHER_STAFF':
          router.replace('/otherstaff' as any);
          break;
        case 'EXPLORER':
          router.replace('/explorer' as any);
          break;
        case 'ORGANIZATION':
          router.replace('/organization' as any);
          break;
        default:
          router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  const { isDashboard, backTarget } = useMemo(() => {
    if (!pathname) return { isDashboard: true, backTarget: null };
    const segments = pathname.split('/').filter(Boolean);
    const isDash = segments[0] === 'pharmacist' && (segments[1] ?? 'dashboard') === 'dashboard';
    let parent: string | null = null;
    if (segments.length > 2) {
      parent = `/${segments.slice(0, -1).join('/')}`;
    }
    return { isDashboard: isDash, backTarget: parent };
  }, [pathname]);

  if (isLoading || !user || user.role !== 'PHARMACIST') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <>
      <PharmacistSidebar visible={sidebarVisible} onDismiss={() => setSidebarVisible(false)} />
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
          headerTitle: tabTitles[route.name] || 'Pharmacist',
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
            const adminAssignments = Array.isArray((user as any)?.admin_assignments)
              ? (user as any).admin_assignments
              : [];
            const activeAdmin = adminAssignments.find((a: any) => a.id === activeAdminId) || null;
            const adminLabel = activeAdmin
              ? activeAdmin.pharmacy_name || `Pharmacy ${activeAdmin.pharmacy_id ?? ''}`
              : 'Staff';

            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {showBack ? (
                  <IconButton
                    icon="arrow-left"
                    onPress={() => {
                      if (canGoBack) {
                        router.back();
                      } else if (backTarget) {
                        router.push(backTarget as any);
                      } else {
                        router.push('/pharmacist/dashboard' as any);
                      }
                    }}
                  />
                ) : null}

                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={styles.workspacePill}
                      onPress={() => setMenuVisible(true)}
                    >
                      <Text style={styles.workspaceLabel}>Workspace</Text>
                      <Text style={styles.workspaceValue}>{workspace === 'platform' ? 'Platform' : 'Internal'}</Text>
                      <Text style={styles.workspaceSub}>{adminLabel}</Text>
                    </TouchableOpacity>
                  }
                >
                  <Text style={styles.menuHeader}>Workspace</Text>
                  <Menu.Item
                    onPress={() => {
                      setWorkspace('platform');
                      setMenuVisible(false);
                    }}
                    title="Platform"
                    leadingIcon={workspace === 'platform' ? 'check' : undefined}
                  />
                  <Menu.Item
                    onPress={() => {
                      setWorkspace('internal');
                      setMenuVisible(false);
                    }}
                    title="Internal"
                    leadingIcon={workspace === 'internal' ? 'check' : undefined}
                  />
                  <Divider />
                  <Text style={styles.menuHeader}>Persona</Text>
                  {adminAssignments.length === 0 ? (
                    <Menu.Item title="No admin scopes" disabled />
                  ) : (
                    adminAssignments.map((assignment: any) => (
                      <Menu.Item
                        key={assignment.id}
                        onPress={() => {
                          setActiveAdminId(assignment.id);
                          setMenuVisible(false);
                        }}
                        title={assignment.pharmacy_name || `Pharmacy ${assignment.pharmacy_id ?? ''}`}
                        leadingIcon={activeAdminId === assignment.id ? 'check' : undefined}
                      />
                    ))
                  )}
                  <Divider />
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/pharmacist/profile' as any);
                    }}
                    title="Profile"
                    leadingIcon="account"
                  />
                </Menu>

                <IconButton icon="bell-outline" onPress={() => router.push('/notifications')} />
                <TouchableOpacity onPress={() => router.push('/pharmacist/profile' as any)}>
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
              </View>
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
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <IconButton icon="message" iconColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <IconButton icon="account" iconColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen name="messages/[id]" options={{ href: null }} />
        {/* Hidden but routable screens */}
        <Tabs.Screen name="availability" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
        <Tabs.Screen name="invoice" options={{ href: null }} />
        <Tabs.Screen name="interests" options={{ href: null }} />
        <Tabs.Screen name="learning" options={{ href: null }} />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="shifts/[id]" options={{ href: null }} />
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
  workspacePill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  workspaceLabel: { color: '#6B7280', fontSize: 11 },
  workspaceValue: { color: '#111827', fontWeight: '700', fontSize: 12 },
  workspaceSub: { color: '#6B7280', fontSize: 11 },
  avatar: { backgroundColor: '#6366F1' },
  avatarLabel: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  menuHeader: { paddingHorizontal: 12, paddingVertical: 6, color: '#6B7280', fontSize: 12 },
});
