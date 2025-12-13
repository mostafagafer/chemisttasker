import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Button, Modal, Portal, Text, TextInput, IconButton, HelperText, Chip, Checkbox } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  fetchPharmacyGroupMembers,
  fetchOrganizationMembers,
  fetchHubGroupMembers,
  createHubPost,
  updateHubPost,
} from './api';
import type { HubPost, HubPostPayload } from './types';

type Scope =
  | { type: 'pharmacy'; id: number }
  | { type: 'organization'; id: number }
  | { type: 'group'; id: number }
  | { type: 'orgGroup'; id: number }
  | null;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  scope: Scope;
  onSaved: () => void;
  editing?: HubPost | null;
};

export function PostComposer({ visible, onDismiss, scope, onSaved, editing }: Props) {
  const [body, setBody] = useState(editing?.body || '');
  const [attachments, setAttachments] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [taggedMemberIds, setTaggedMemberIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const stableScope = useMemo(() => {
    if (!scope || scope.id == null) return null;
    const idNum = typeof scope.id === 'string' ? Number(scope.id) : scope.id;
    if (!Number.isFinite(idNum)) return null;
    const normalizedType = scope.type === 'orgGroup' ? 'group' : scope.type;
    return { type: normalizedType as 'pharmacy' | 'organization' | 'group', id: idNum };
  }, [scope]);

  const loadMembers = async () => {
    if (!stableScope) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setMemberError(null);
    try {
      let resp: any = [];
      if (stableScope.type === 'pharmacy') {
        resp = await fetchPharmacyGroupMembers(stableScope.id as any);
      } else if (stableScope.type === 'organization') {
        resp = await fetchOrganizationMembers(stableScope.id as any);
      } else {
        resp = await fetchHubGroupMembers(stableScope.id as any);
      }
      const normalized = Array.isArray(resp?.results) ? resp.results : Array.isArray(resp) ? resp : [];
      setMembers(normalized);
    } catch (err: any) {
      setMemberError(err?.message || 'Failed to load members');
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadMembers();
    } else {
      setMembers([]);
      setTaggedMemberIds([]);
      setMemberError(null);
      setAttachments([]);
      setBody(editing?.body || '');
    }
  }, [visible, stableScope, editing]);

  const pickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      setAttachments((prev) => [...prev, ...res.assets]);
    } catch (err: any) {
      setError(err?.message || 'File pick failed');
    }
  };

  const normalizeAttachments = async () => {
    const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || null;
    return Promise.all(
      attachments.map(async (file, idx) => {
        const name = file.name || `attachment-${idx}`;
        const type = file.mimeType || 'application/octet-stream';
        let uri = file.uri;

        if (Platform.OS === 'web') {
          // On web, fetch the blob and build a File so FormData sends bytes.
          const resp = await fetch(uri);
          const blob = await resp.blob();
          return new File([blob], name, { type: blob.type || type }) as any;
        }

        if (uri && Platform.OS === 'android' && uri.startsWith('content://') && cacheDir) {
          try {
            const ext = (file.name && file.name.split('.').pop()) || 'bin';
            const target = `${cacheDir}hub-attach-${Date.now()}-${idx}.${ext}`;
            await FileSystem.copyAsync({ from: uri, to: target });
            uri = target;
          } catch {
            // fallback to original URI
          }
        }

        return {
          uri,
          name,
          type,
        };
      }),
    );
  };

  const handleSave = async () => {
    if (!stableScope) {
      setError('Select a space first.');
      return;
    }
    if (!body.trim()) {
      setError('Body is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const files = await normalizeAttachments();

      const payload: HubPostPayload = {
        body: body.trim(),
        visibility: 'NORMAL' as any,
        allowComments: true,
      };
      if (taggedMemberIds.length) {
        payload.taggedMemberIds = Array.from(new Set(taggedMemberIds));
      }
      if (files.length) {
        payload.attachments = files as any;
      }
      if (editing?.id) {
        await updateHubPost(editing.id, payload as any);
      } else {
        await createHubPost(stableScope as any, payload as any);
      }
      onSaved();
      onDismiss();
      setBody('');
      setAttachments([]);
      setTaggedMemberIds([]);
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <View style={styles.header}>
          <Text variant="titleMedium">{editing ? 'Edit post' : 'New post'}</Text>
          <IconButton icon="close" onPress={onDismiss} />
        </View>
        <TextInput
          label="Share an update"
          value={body}
          onChangeText={setBody}
          multiline
          mode="outlined"
          numberOfLines={4}
          style={{ marginBottom: 8 }}
        />
        <View style={styles.attachmentRow}>
          <Button compact mode="text" icon="paperclip" onPress={pickFiles}>
            Attach
          </Button>
          <Text style={styles.muted}>{attachments.length ? `${attachments.length} file(s)` : 'No attachments'}</Text>
        </View>
        {attachments.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8 }}>
            {attachments.map((file, index) => (
              <Chip
                key={`${file.name}-${index}`}
                icon="file"
                onClose={() => {
                  setAttachments((prev) => prev.filter((_, i) => i !== index));
                }}
              >
                {file.name}
              </Chip>
            ))}
          </View>
        )}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>Tag members</Text>
          {membersLoading ? (
            <Text style={styles.muted}>Loading members...</Text>
          ) : memberError ? (
            <HelperText type="error">{memberError}</HelperText>
          ) : members.length ? (
            <View style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8, maxHeight: 180 }}>
              {members.map((m) => {
                const id = m.membershipId || m.membership_id || m.id;
                const name = m.fullName || m.full_name || m.email || 'Member';
                const checked = taggedMemberIds.includes(id);
                return (
                  <View key={id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 }}>
                    <Checkbox
                      status={checked ? 'checked' : 'unchecked'}
                      onPress={() =>
                        setTaggedMemberIds((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                        )
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text>{name}</Text>
                      {m.role || m.pharmacyName ? (
                        <Text style={styles.muted}>
                          {[m.role, m.pharmacyName || m.pharmacy_name].filter(Boolean).join(' | ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.muted}>No members available to tag.</Text>
          )}
          {taggedMemberIds.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {taggedMemberIds.map((id) => {
                const member = members.find((m) => (m.membershipId || m.membership_id || m.id) === id);
                const label = member
                  ? `${member.fullName || member.full_name || member.email || 'Member'}${
                      member.pharmacyName || member.pharmacy_name ? ' @ ' + (member.pharmacyName || member.pharmacy_name) : ''
                    }`
                  : `Member #${id}`;
                return (
                  <Chip key={id} onClose={() => setTaggedMemberIds((prev) => prev.filter((x) => x !== id))} compact>
                    {label}
                  </Chip>
                );
              })}
            </View>
          ) : null}
        </View>
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <Button
          mode="contained"
          onPress={handleSave}
          disabled={!body.trim() || saving || !stableScope}
          loading={saving}
          style={{ marginTop: 8 }}
        >
          {editing ? 'Save changes' : 'Post'}
        </Button>
      </Modal>
    </Portal>
  );
}

export default PostComposer;

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: '#6B7280' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
});
