import { Tabs } from 'expo-router';

export default function ExplorerTabs() {
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
    </Tabs>
  );
}
