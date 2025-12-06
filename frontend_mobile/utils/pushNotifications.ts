import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import apiClient from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


const getProjectId = () => {
  // Expo EAS projectId is required for getExpoPushTokenAsync on SDK48+
  // Try to read from app config; fallback to slug if present.
  // @ts-ignore
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  return projectId;
};

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = getProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenResponse.data;
}

export async function registerDeviceTokenWithBackend(token: string, platform: 'ios' | 'android' | 'web' = 'web') {
  try {
    await apiClient.post('/client-profile/device-tokens/', {
      token,
      platform,
    });
  } catch (err) {
    // Do not crash the app on token registration failure
    console.error('Failed to register device token', err);
  }
}

export function addNotificationResponseListener(onNavigate: () => void) {
  return Notifications.addNotificationResponseReceivedListener(() => {
    onNavigate();
  });
}
