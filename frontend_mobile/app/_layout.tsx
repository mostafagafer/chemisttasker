import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { PaperProvider } from 'react-native-paper';
import crashlytics from '@react-native-firebase/crashlytics';
import { AuthProvider, useAuth } from '../context/AuthContext';
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled error', error, info);
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      const stack = (info as { componentStack?: string })?.componentStack;
      crashlytics().recordError(err);
      if (stack) {
        crashlytics().setAttribute('componentStack', stack);
      }
    } catch {
      // ignore crash reporting errors
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
            <StatusBar translucent={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
            <PaperProvider theme={theme}>
              <Stack screenOptions={{ headerShown: false }} />
            </PaperProvider>
          </SafeAreaView>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const top = segments[0];
    const publicRoutes = new Set(['login', 'register', 'welcome', 'verify-otp', 'index']);
    const isPublic = publicRoutes.has(top ?? '');

    if (!user && !isPublic) {
      router.replace('/login');
    }
  }, [isLoading, segments, router, user]);

  return null;
}

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
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
          <StatusBar translucent={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
          <PaperProvider theme={theme}>
            <AuthProvider>
              <WorkspaceProvider>
                <AuthGate />
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
    </ErrorBoundary>
  );
}
