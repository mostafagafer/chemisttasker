import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Divider,
  List,
  Portal,
  Dialog,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount } from '@chemisttasker/shared-core';

export default function ExplorerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const webBaseUrl = 'https://www.chemisttasker.com.au';

  const canDelete = deleteText.trim().toUpperCase() === 'DELETE';

  const handleDeleteAccount = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      await logout();
      setDeleteDialogOpen(false);
      setDeleteText('');
      Alert.alert('Account deletion requested/completed.');
      router.replace('/login' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Avatar.Text
            size={64}
            label={(user?.username || user?.email || 'U').substring(0, 2).toUpperCase()}
            style={styles.avatar}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {user?.username || 'Explorer'}
          </Text>
          <Text variant="bodySmall" style={styles.email}>
            {user?.email || ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Support
          </Text>
          <Surface style={styles.listSurface} elevation={0}>
            <List.Item
              title="Terms of Service"
              left={(props) => <List.Icon {...props} icon="file-document" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => Linking.openURL(`${webBaseUrl}/terms-of-service`)}
            />
            <Divider />
            <List.Item
              title="Privacy Policy"
              left={(props) => <List.Icon {...props} icon="shield-check" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => Linking.openURL(`${webBaseUrl}/privacy-policy`)}
            />
          </Surface>
        </View>

        <View style={styles.deleteContainer}>
          <Text variant="bodySmall" style={styles.deleteDescription}>
            Deleting your account is permanent. You will be signed out immediately, and verification
            documents are removed within 7 days.
          </Text>
          <Button
            mode="outlined"
            textColor="#EF4444"
            style={styles.deleteButton}
            icon="delete"
            onPress={() => setDeleteDialogOpen(true)}
          >
            Delete My Account
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={deleteDialogOpen}
          onDismiss={() => {
            if (deleting) return;
            setDeleteDialogOpen(false);
            setDeleteText('');
          }}
        >
          <Dialog.Title>Delete account</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ marginBottom: 12 }}>
              This action cannot be undone. Type DELETE to confirm.
            </Text>
            <TextInput
              label="Type DELETE to confirm"
              value={deleteText}
              onChangeText={setDeleteText}
              autoCapitalize="characters"
              disabled={deleting}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                if (deleting) return;
                setDeleteDialogOpen(false);
                setDeleteText('');
              }}
            >
              Cancel
            </Button>
            <Button
              textColor="#DC2626"
              onPress={handleDeleteAccount}
              disabled={!canDelete || deleting}
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  avatar: {
    backgroundColor: '#6366F1',
    marginBottom: 12,
  },
  name: { fontWeight: '700', color: '#111827' },
  email: { color: '#6B7280', marginTop: 4 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: '600',
  },
  listSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  deleteButton: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  deleteDescription: {
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
  },
});
