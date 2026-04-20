import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useIsFocused, useNavigation, usePreventRemove } from '@react-navigation/native';
import { useUnsavedChangesDialog } from './UnsavedChangesDialogProvider';
import { useUnsavedChangesRegistry } from './UnsavedChangesRegistryProvider';

type Options = {
  enabled?: boolean;
  saving?: boolean;
  title?: string;
  message?: string;
  onDiscard?: () => void | Promise<void>;
};

const defaultTitle = 'Discard changes?';
const defaultMessage = 'You have unsaved changes. If you leave now, your edits will be discarded.';

const normalizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, normalizeValue(nested)]);
    return Object.fromEntries(sortedEntries);
  }
  return value;
};

const serializeValue = (value: unknown) => JSON.stringify(normalizeValue(value));

export function useUnsavedChangesGuard<T>(value: T, options: Options = {}) {
  const {
    enabled = true,
    saving = false,
    title = defaultTitle,
    message = defaultMessage,
    onDiscard,
  } = options;
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const dialog = useUnsavedChangesDialog();
  const registry = useUnsavedChangesRegistry();
  const [baseline, setBaseline] = useState<string | null>(null);

  const serializedValue = useMemo(() => serializeValue(value), [value]);
  const isDirty = enabled && baseline !== null && baseline !== serializedValue;

  const markClean = useCallback((nextValue?: T) => {
    setBaseline(serializeValue(nextValue === undefined ? value : nextValue));
  }, [value]);

  const requestConfirmation = useCallback(async () => {
    if (dialog) {
      return dialog.confirm({ title, message });
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        {
          text: 'Keep editing',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, [dialog, message, title]);

  const discardChanges = useCallback(async () => {
    if (!isDirty || saving) {
      if (onDiscard) {
        await onDiscard();
      }
      return true;
    }

    const confirmed = await requestConfirmation();
    if (!confirmed) {
      return false;
    }

    if (onDiscard) {
      await onDiscard();
    }
    return true;
  }, [isDirty, onDiscard, requestConfirmation, saving]);

  const confirmDiscard = useCallback((onDiscardAction: () => void) => {
    if (!isDirty || saving) {
      onDiscardAction();
      return;
    }

    void (async () => {
      const confirmed = await discardChanges();
      if (confirmed) {
        onDiscardAction();
      }
    })();
  }, [discardChanges, isDirty, saving]);

  usePreventRemove(Platform.OS !== 'web' && isDirty && !saving, ({ data }) => {
    void (async () => {
      const confirmed = await requestConfirmation();
      if (confirmed) {
        navigation.dispatch(data.action);
      }
    })();
  });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (!isDirty || saving) {
        return;
      }

      event.preventDefault();
      void (async () => {
        const confirmed = await requestConfirmation();
        if (confirmed) {
          navigation.dispatch(event.data.action);
        }
      })();
    });

    return unsubscribe;
  }, [isDirty, navigation, requestConfirmation, saving]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDirty || saving || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saving]);

  useEffect(() => {
    if (!registry || !isFocused) {
      return;
    }

    registry.setActiveGuard({
      discardChanges,
      isDirty,
    });

    return () => {
      registry.setActiveGuard(null);
    };
  }, [discardChanges, isDirty, isFocused, registry]);

  return {
    discardChanges,
    isDirty,
    markClean,
    confirmDiscard,
  };
}
