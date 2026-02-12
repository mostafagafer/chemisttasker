import React, { useEffect, useState } from 'react';
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
  IconButton,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount, updateOnboardingForm } from '@chemisttasker/shared-core';
import * as ImagePicker from 'expo-image-picker';

export default function OtherStaffProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const webBaseUrl = 'https://www.chemisttasker.com.au';
  const imageMediaTypes = (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;

  useEffect(() => {
    const photo =
      (user as any)?.profile_photo ||
      (user as any)?.profile_photo_url ||
      (user as any)?.profilePhoto ||
      null;
    if (photo && !profilePhoto) {
      setProfilePhoto(photo);
    }
  }, [user, profilePhoto]);

  const uploadProfilePhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset?.uri) return;
    const filename = asset.fileName || `profile-photo-${Date.now()}.jpg`;
    const type = asset.mimeType || 'image/jpeg';
    const formData = new FormData();
    formData.append('profile_photo', {
      uri: asset.uri,
      name: filename,
      type,
    } as any);

    setUploading(true);
    try {
      const updated: any = await updateOnboardingForm('other_staff', formData);
      const newUrl = updated?.profile_photo_url || updated?.profile_photo || null;
      if (newUrl) {
        setProfilePhoto(newUrl);
      }
      await refreshUser();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Failed to upload profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    Alert.alert(
      'Update Profile Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Camera access is required');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: imageMediaTypes,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setProfilePhoto(result.assets[0].uri);
              await uploadProfilePhoto(result.assets[0]);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Photo library access is required');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: imageMediaTypes,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setProfilePhoto(result.assets[0].uri);
              await uploadProfilePhoto(result.assets[0]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          {profilePhoto ? (
            <Avatar.Image size={72} source={{ uri: profilePhoto }} />
          ) : (
            <Avatar.Text
              size={72}
              label={(user?.username || user?.email || 'U').substring(0, 2).toUpperCase()}
              style={styles.avatar}
            />
          )}
          <IconButton
            icon="camera"
            size={18}
            style={styles.cameraButton}
            onPress={pickImage}
            disabled={uploading}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {user?.username || 'Other Staff'}
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
              title="Contact Us"
              left={(props) => <List.Icon {...props} icon="message-text-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/contact' as any)}
            />
            <Divider />
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
  cameraButton: {
    marginTop: -8,
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
