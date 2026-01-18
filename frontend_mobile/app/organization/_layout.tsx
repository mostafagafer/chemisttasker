import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';
import { resolveShiftNotificationRoute } from '@/utils/notificationNavigation';

export default function OrganizationTabs() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response?.notification?.request?.content?.data || {};
      const route = resolveShiftNotificationRoute({
        actionUrl: data.action_url ?? data.actionUrl ?? null,
        payload: data,
        userRole: user?.role ?? null,
      });
      if (route) {
        router.push(route as any);
      }
    });
    return () => sub.remove();
  }, [router, user?.role]);

  return (
    <Tabs>
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarAccessibilityLabel: 'Profile tab' }}
      />
      <Tabs.Screen
        name="shifts"
        options={{ title: 'Shifts', tabBarAccessibilityLabel: 'Shifts tab' }}
      />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            href: null,
          }}
        />
        <Tabs.Screen name="pharmacies/[id]/staff" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/locums" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/add" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/edit" options={{ href: null }} />
    </Tabs>
  );
}
