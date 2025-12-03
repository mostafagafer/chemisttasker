import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from '../context/AuthContext';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { theme } from '../constants/theme';
import '../config/api'; // Configure shared-core on app load

export default function RootLayout() {
  useEffect(() => {
    // Hide Android navigation bar; allow swipe-to-reveal like Facebook
    void NavigationBar.setVisibilityAsync('hidden');

    // Re-apply on app foreground in case the OS shows it again
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void NavigationBar.setVisibilityAsync('hidden');
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <WorkspaceProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
        </WorkspaceProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
