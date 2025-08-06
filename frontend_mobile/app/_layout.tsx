import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext'; // Adjust path if needed

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
  );
}
