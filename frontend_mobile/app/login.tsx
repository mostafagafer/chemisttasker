import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Text, TextInput, Button, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithCredentials } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const userData = await loginWithCredentials(email, password);

      // Navigate directly to appropriate dashboard based on role
      if (userData.role === 'OWNER') {
        router.replace('/owner/dashboard');
      } else if (userData.role === 'PHARMACIST') {
        router.replace('/pharmacist/dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#f7f9fb', '#eef1f7']} style={styles.gradient} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={styles.card} elevation={2}>
            <View style={styles.logoRow}>
              <Image
                source={require('../assets/images/chemisttasker-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View style={styles.titleBlock}>
                <Text variant="bodySmall" style={styles.subtitle}>
                  Pharmacy workforce, organized.
                </Text>
              </View>
            </View>

            <Text variant="headlineMedium" style={styles.formTitle}>
              Welcome back
            </Text>
            <Text variant="bodyMedium" style={styles.formSubtitle}>
              Sign in to access your hub.
            </Text>

            {error ? (
              <Surface style={styles.errorContainer} elevation={1}>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            ) : null}

            <View style={styles.form}>
              <TextInput
                label="Work email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showPassword}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />

              <Button
                mode="text"
                onPress={() => {}}
                style={styles.forgotButton}
                labelStyle={styles.linkLabel}
              >
                Forgot password?
              </Button>

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                Sign in
              </Button>

              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Don&apos;t have an account?</Text>
                <Button
                  mode="text"
                  onPress={() => router.push('/register')}
                  labelStyle={styles.linkLabel}
                  compact
                >
                  Create account
                </Button>
              </View>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    position: 'relative',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  logoImage: {
    width: 140,
    height: 48,
  },
  titleBlock: {
    flex: 1,
  },
  formTitle: {
    marginTop: 8,
    fontWeight: '700',
    color: '#111827',
  },
  formSubtitle: {
    color: '#4b5563',
    marginBottom: 12,
  },
  header: {
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  linkLabel: {
    textTransform: 'none',
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  signupText: {
    color: '#4b5563',
  },
});
