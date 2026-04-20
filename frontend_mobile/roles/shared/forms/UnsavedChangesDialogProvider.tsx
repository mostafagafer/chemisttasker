import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

type ConfirmOptions = {
  message: string;
  title: string;
};

type ContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UnsavedChangesDialogContext = createContext<ContextValue | null>(null);

export function UnsavedChangesDialogProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [dialogState, setDialogState] = useState<ConfirmOptions & { open: boolean }>({
    message: '',
    open: false,
    title: '',
  });

  const closeDialog = useCallback((confirmed: boolean) => {
    setDialogState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        ...options,
        open: true,
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <UnsavedChangesDialogContext.Provider value={value}>
      {children}
      <Portal>
        <Dialog visible={dialogState.open} dismissable={false}>
          <Dialog.Title>{dialogState.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{dialogState.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => closeDialog(false)}>Keep Editing</Button>
            <Button onPress={() => closeDialog(true)}>Discard Changes</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </UnsavedChangesDialogContext.Provider>
  );
}

export function useUnsavedChangesDialog() {
  return useContext(UnsavedChangesDialogContext);
}
