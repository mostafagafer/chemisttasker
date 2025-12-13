import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Modal, Portal, Text, TextInput, IconButton, HelperText } from 'react-native-paper';
import { createHubPoll, updateHubPoll } from './api';
import type { HubPollPayload, HubPoll } from './types';

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
  editing?: HubPoll | null;
};

export function PollComposer({ visible, onDismiss, scope, onSaved, editing }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stableScope = useMemo(() => {
    if (!scope || scope.id == null) return null;
    const idNum = typeof scope.id === 'string' ? Number(scope.id) : scope.id;
    if (!Number.isFinite(idNum)) return null;
    const normalizedType = scope.type === 'orgGroup' ? 'group' : scope.type;
    return { type: normalizedType as 'pharmacy' | 'organization' | 'group', id: idNum };
  }, [scope]);

  const resetForm = () => {
    if (editing?.options?.length) {
      setQuestion(editing.question || '');
      setOptions(
        editing.options
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((opt) => opt.label),
      );
    } else {
      setQuestion('');
      setOptions(['', '']);
    }
    setError(null);
    setSaving(false);
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, editing]);

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === idx ? value : opt)));
  };

  const addOption = () => {
    if (options.length < 5) setOptions((prev) => [...prev, '']);
  };

  const handleSave = async () => {
    if (!stableScope) return;
    const labels = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || labels.length < 2) {
      setError('Provide a question and at least two options');
      return;
    }
    if (labels.length > 5) {
      setError('You can specify up to five options.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: HubPollPayload = {
        question: question.trim(),
        options: labels,
      };
      if (editing?.id) {
        await updateHubPoll(editing.id, payload as any);
      } else {
        await createHubPoll(stableScope as any, payload as any);
      }
      onSaved();
      onDismiss();
      setQuestion('');
      setOptions(['', '']);
    } catch (err: any) {
      setError(err?.message || 'Save poll failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => {
          resetForm();
          onDismiss();
        }}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <Text variant="titleMedium">{editing ? 'Edit poll' : 'New poll'}</Text>
          <IconButton icon="close" onPress={onDismiss} />
        </View>
        <TextInput
          label="Question"
          value={question}
          onChangeText={setQuestion}
          mode="outlined"
          style={{ marginBottom: 8 }}
        />
        <Text variant="titleSmall" style={{ marginBottom: 4 }}>
          Options
        </Text>
        {options.map((opt, idx) => (
          <TextInput
            key={idx}
            label={`Option ${idx + 1}`}
            value={opt}
            onChangeText={(text) => updateOption(idx, text)}
            mode="outlined"
            style={{ marginBottom: 6 }}
          />
        ))}
        {options.length < 5 ? (
          <Button compact mode="text" onPress={addOption}>
            Add option
          </Button>
        ) : null}
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <Button
          mode="contained"
          onPress={handleSave}
          disabled={!question.trim() || saving || !stableScope}
          loading={saving}
          style={{ marginTop: 8 }}
        >
          {saving ? (editing ? 'Updating...' : 'Creating...') : editing ? 'Update poll' : 'Create poll'}
        </Button>
      </Modal>
    </Portal>
  );
}

export default PollComposer;

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
