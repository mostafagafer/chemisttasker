import { Tabs } from 'expo-router';

export default function OtherstaffTabs() {
  return (
    <Tabs>
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="shifts" options={{ title: 'Shifts' }} />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            href: null,
          }}
        />
    </Tabs>
  );
}
