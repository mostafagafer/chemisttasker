import { Tabs } from 'expo-router';

export default function OrganizationTabs() {
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
        <Tabs.Screen name="pharmacies/[id]/staff" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/locums" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/add" options={{ href: null }} />
        <Tabs.Screen name="pharmacies/[id]/edit" options={{ href: null }} />
    </Tabs>
  );
}
