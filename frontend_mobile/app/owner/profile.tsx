import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Avatar, List, Button, Surface, Divider, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getCurrentUser } from '@chemisttasker/shared-core';

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  profile_photo?: string;
  role: string;
}

export default function OwnerProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await getCurrentUser();
      setProfile(response as UserProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/welcome');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header Profile Section */}
        <Surface style={styles.header} elevation={1}>
          <View style={styles.profileInfo}>
            {profile?.profile_photo ? (
              <Avatar.Image
                size={80}
                source={{ uri: profile.profile_photo }}
                style={styles.avatar}
              />
            ) : (
              <Avatar.Text
                size={80}
                label={`${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`}
                style={styles.avatar}
              />
            )}
            <Text variant="headlineSmall" style={styles.name}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            <Text variant="bodyMedium" style={styles.email}>
              {profile?.email}
            </Text>
            <View style={styles.roleBadge}>
              <Text variant="labelSmall" style={styles.roleText}>
                {profile?.role?.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Settings Sections */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Account</Text>
          <Surface style={styles.menuSurface} elevation={0}>
            <List.Item
              title="Personal Information"
              left={props => <List.Icon {...props} icon="account" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/owner/onboarding/review')} // Re-using review screen for now as a "view profile"
            />
            <Divider />
            <List.Item
              title="Pharmacies"
              left={props => <List.Icon {...props} icon="store" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/owner/pharmacies')}
            />
          </Surface>
        </View>

        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Preferences</Text>
          <Surface style={styles.menuSurface} elevation={0}>
            <List.Item
              title="Notifications"
              left={props => <List.Icon {...props} icon="bell" />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  color="#6366F1"
                />
              )}
            />
            <Divider />
            <List.Item
              title="App Settings"
              left={props => <List.Icon {...props} icon="cog" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </Surface>
        </View>

        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Support</Text>
          <Surface style={styles.menuSurface} elevation={0}>
            <List.Item
              title="Help Center"
              left={props => <List.Icon {...props} icon="help-circle" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
            <Divider />
            <List.Item
              title="Terms of Service"
              left={props => <List.Icon {...props} icon="file-document" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
            <Divider />
            <List.Item
              title="Privacy Policy"
              left={props => <List.Icon {...props} icon="shield-check" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </Surface>
        </View>

        <View style={styles.logoutContainer}>
          <Button
            mode="outlined"
            onPress={handleLogout}
            textColor="#EF4444"
            style={styles.logoutButton}
            icon="logout"
          >
            Logout
          </Button>
          <Text variant="bodySmall" style={styles.versionText}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#E0E7FF',
    marginBottom: 16,
  },
  name: {
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    color: '#6B7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  roleText: {
    color: '#6366F1',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: '600',
  },
  menuSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutContainer: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoutButton: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    width: '100%',
    marginBottom: 16,
  },
  versionText: {
    color: '#9CA3AF',
  },
});
