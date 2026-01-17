import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import AuthLayout from '../components/AuthLayout';

export default function HomeScreen() {
  const router = useRouter();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3600, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3600, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(tiltAnim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(tiltAnim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
  }, [floatAnim, tiltAnim]);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const rotate = tiltAnim.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <AuthLayout title="Welcome" showTitle={false}>
      <View style={styles.hero}>
        <Animated.Image
          source={require('../assets/images/Chemisttasker.png')}
          style={[styles.heroImage, { transform: [{ translateY }, { rotate }] }]}
          resizeMode="contain"
        />
        <Text variant="headlineSmall" style={styles.title}>
          Pharmacy staffing, simplified.
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Manage shifts, teams, and chats in one place.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button mode="contained" onPress={() => router.push('/login')} style={styles.primaryButton}>
          Go to Login
        </Button>
        <Button mode="text" onPress={() => router.push('/register')}>
          Create an account
        </Button>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  heroImage: {
    width: 220,
    height: 220,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a',
  },
  subtitle: {
    textAlign: 'center',
    color: '#4b5563',
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  primaryButton: {
    borderRadius: 10,
  },
});
