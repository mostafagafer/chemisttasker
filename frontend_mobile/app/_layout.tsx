import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import crashlytics from '@react-native-firebase/crashlytics';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { theme } from '../constants/theme';
import OfflineBanner from '../components/OfflineBanner';
import '../config/api'; // Configure shared-core on app load
import { getOwnerSetupStatus, ownerSetupPaths } from '../utils/ownerSetup';

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
            <StatusBar barStyle="dark-content" />
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

  const getRoleHome = (role?: string | null) => {
    const normalized = String(role || '').toUpperCase();
    switch (normalized) {
      case 'OWNER':
        return '/owner/dashboard';
      case 'PHARMACIST':
        return '/pharmacist/dashboard';
      case 'OTHER_STAFF':
        return '/otherstaff/dashboard';
      case 'EXPLORER':
        return '/explorer/dashboard';
      case 'ORGANIZATION':
        return '/organization';
      default:
        return '/login';
    }
  };

  useEffect(() => {
    if (isLoading) return;
    const top = segments[0];
    const second = segments[1];
    const publicRoutes = new Set(['login', 'register', 'welcome', 'verify-otp', 'forgot-password', 'reset-password', 'mobile-verify', 'index', 'contact']);
    const isPublic = publicRoutes.has(top ?? '');
    const isOwnerSetupRoute = top === 'setup' && second === 'owner';
    const expectedTopByRole: Record<string, string> = {
      OWNER: 'owner',
      PHARMACIST: 'pharmacist',
      OTHER_STAFF: 'otherstaff',
      EXPLORER: 'explorer',
      ORGANIZATION: 'organization',
    };

    let active = true;
    const runGate = async () => {
      if (user && isPublic) {
        if (String(user.role || '').toUpperCase() === 'OWNER') {
          const status = await getOwnerSetupStatus();
          if (active) {
            router.replace((status.nextPath || ownerSetupPaths.dashboard) as any);
          }
          return;
        }

        router.replace(getRoleHome(user.role) as any);
        return;
      }

      if (user && top) {
        const normalizedRole = String(user.role || '').toUpperCase();

        if (normalizedRole === 'OWNER') {
          const status = await getOwnerSetupStatus();
          if (!active) return;

          if (isOwnerSetupRoute) {
            if (status.nextPath && status.nextPath !== `/${segments.join('/')}`) {
              router.replace(status.nextPath as any);
              return;
            }
            if (!status.nextPath) {
              router.replace(ownerSetupPaths.dashboard as any);
            }
            return;
          }

          if (top !== 'owner') {
            router.replace((status.nextPath || ownerSetupPaths.dashboard) as any);
            return;
          }

          if (status.nextPath) {
            router.replace(status.nextPath as any);
            return;
          }

          return;
        }

        if (top === 'setup') {
          router.replace(getRoleHome(user.role) as any);
          return;
        }

        const expectedTop = expectedTopByRole[normalizedRole];
        if (expectedTop && top !== expectedTop) {
          router.replace(getRoleHome(user.role) as any);
          return;
        }
      }

      if (!user && !isPublic) {
        router.replace('/login');
      }
    };

    void runGate();
    return () => {
      active = false;
    };
  }, [isLoading, segments, router, user]);

  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" />
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
