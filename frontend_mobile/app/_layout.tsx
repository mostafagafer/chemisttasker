import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import { PaperProvider } from 'react-native-paper';
import Constants from 'expo-constants';
import crashlytics from '@react-native-firebase/crashlytics';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { theme } from '../constants/theme';
import OfflineBanner from '../components/OfflineBanner';
import '../config/api'; // Configure shared-core on app load

const showNav = async () => {
  try {
    const edgeToEdgeEnabled =
      (Constants.expoConfig as any)?.android?.navigationBar?.edgeToEdgeEnabled ??
      (Constants.manifest as any)?.android?.navigationBar?.edgeToEdgeEnabled ??
      false;
    await NavigationBar.setVisibilityAsync('visible');
    if (!edgeToEdgeEnabled) {
      await NavigationBar.setBehaviorAsync('inset-swipe');
      await NavigationBar.setPositionAsync('relative');
      await NavigationBar.setBackgroundColorAsync('#000000');
    }
    await NavigationBar.setButtonStyleAsync('light');
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
          <SafeAreaView
            style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}
            edges={['top', 'left', 'right']}
          >
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
    showNav();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        showNav();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
          <StatusBar translucent={false} backgroundColor="#FFFFFF" barStyle="dark-content" />
          <PaperProvider theme={theme}>
            <AuthProvider>
              <WorkspaceProvider>
              <AuthGate />
              <OfflineBanner />
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
