import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from '../context/AuthContext';
import { theme } from '../constants/theme';
import '../config/api'; // Configure shared-core on app load

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </PaperProvider>
  );
}
