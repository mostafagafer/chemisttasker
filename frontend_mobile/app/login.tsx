import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api';
import { ORG_ROLES } from '../constants/roles';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || 'Login failed');
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      const { access, refresh, user: userInfo } = data;
      await login(access, refresh, userInfo);

      // Org member check (same logic as web)
      const isOrgMember =
        Array.isArray(userInfo?.memberships) &&
        userInfo.memberships.some((m: any) => m?.role && ORG_ROLES.includes(m.role));

      if (isOrgMember) {
        router.replace('/organization' as any);

      } else {
        switch (userInfo.role) {
          case 'OWNER':
            router.replace('/owner' as any);

            break;
          case 'PHARMACIST':
            router.replace('/pharmacist' as any);
            break;
          case 'OTHER_STAFF':
            router.replace('/otherstaff' as any);
            break;
          case 'EXPLORER':
            router.replace('/explorer' as any);
            break;
          default:
            router.replace('/');
        }
      }
    } catch (e) {
      setError('Network or server error.');
    }
    setIsLoading(false);
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Login</Text>
      {error ? <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text> : null}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{
          width: '100%',
          maxWidth: 300,
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 5,
          padding: 10,
          marginBottom: 12,
        }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          width: '100%',
          maxWidth: 300,
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 5,
          padding: 10,
          marginBottom: 20,
        }}
      />
      <Button title={isLoading ? "Logging in..." : "Login"} onPress={handleLogin} disabled={isLoading} />
      {isLoading && <ActivityIndicator style={{ marginTop: 10 }} />}
    </View>
  );
}
