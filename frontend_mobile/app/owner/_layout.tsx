import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function OwnerTabs() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'OWNER') {
        // Redirect to correct tab group
        switch (user.role) {
          case 'PHARMACIST':
            router.replace('/pharmacist' as any);

            break;
          case 'OTHER_STAFF':
            router.replace('/otherstaff' as any);
            break;
          case 'EXPLORER':
            router.replace('/explorer' as any);
            router.replace('/');
            break;
          case 'ORGANIZATION':
            router.replace('/organization' as any);
            break;
          default:
            router.replace('/login');
        }
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'OWNER') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Tabs>
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="shifts" options={{ title: 'Shifts' }} />
      <Tabs.Screen name="pharmacy" options={{ title: 'pharmacy' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Tabs>
  );
}
