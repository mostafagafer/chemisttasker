import { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from '../context/AuthContext';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { theme } from '../constants/theme';
import '../config/api'; // Configure shared-core on app load

const hideNav = async () => {
  try {
    // Some devices with edge-to-edge enabled warn on setBehaviorAsync; rely on visibility only.
    await NavigationBar.setVisibilityAsync('hidden'); // hidden by default; swipe to reveal
  } catch {
    // ignore on platforms that don't support it
  }
};

export default function RootLayout() {
  useEffect(() => {
    hideNav();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        hideNav();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
        <StatusBar translucent={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
