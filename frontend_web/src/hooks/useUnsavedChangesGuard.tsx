import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

const DEFAULT_MESSAGE =
  'You have unsaved changes. If you leave now, your edits will be discarded.';
const DEFAULT_TITLE = 'Discard changes?';

type BoundaryGuard = {
  isDirty: boolean;
  message: string;
  title: string;
};

type BoundaryContextValue = {
  setGuard: (guard: BoundaryGuard | null) => void;
  confirmIfNeeded: () => Promise<boolean>;
  requestConfirmation: (options?: { message?: string; title?: string }) => Promise<boolean>;
};

const UnsavedChangesBoundaryContext = React.createContext<BoundaryContextValue | null>(null);

function normalizeForDirtyCheck(value: unknown): unknown {
  if (value instanceof File) {
    return {
      lastModified: value.lastModified,
      name: value.name,
      size: value.size,
      type: value.type,
    };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForDirtyCheck);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const normalized = normalizeForDirtyCheck((value as Record<string, unknown>)[key]);
        if (normalized !== undefined) {
          result[key] = normalized;
        }
        return result;
      }, {});
  }

  return value;
}

function serializeForDirtyCheck(value: unknown): string {
  return JSON.stringify(normalizeForDirtyCheck(value));
}

export function UnsavedChangesBoundary({
  children,
}: {
  children: (tools: { confirmIfNeeded: () => Promise<boolean> }) => React.ReactNode;
}) {
  const guardRef = React.useRef<BoundaryGuard | null>(null);
  const resolverRef = React.useRef<((confirmed: boolean) => void) | null>(null);
  const [dialogState, setDialogState] = React.useState<{
    message: string;
    open: boolean;
    title: string;
  }>({
    message: DEFAULT_MESSAGE,
    open: false,
    title: DEFAULT_TITLE,
  });

  const setGuard = React.useCallback((guard: BoundaryGuard | null) => {
    guardRef.current = guard;
  }, []);

  const closeDialog = React.useCallback((confirmed: boolean) => {
    setDialogState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
  }, []);

  const requestConfirmation = React.useCallback(
    ({ message = DEFAULT_MESSAGE, title = DEFAULT_TITLE }: { message?: string; title?: string } = {}) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setDialogState({
          message,
          open: true,
          title,
        });
      }),
    []
  );

  const confirmIfNeeded = React.useCallback(async () => {
    const guard = guardRef.current;
    if (!guard?.isDirty) {
      return true;
    }
    return requestConfirmation({ message: guard.message, title: guard.title });
  }, [requestConfirmation]);

  const contextValue = React.useMemo(
    () => ({
      confirmIfNeeded,
      requestConfirmation,
      setGuard,
    }),
    [confirmIfNeeded, requestConfirmation, setGuard]
  );

  return (
    <UnsavedChangesBoundaryContext.Provider value={contextValue}>
      {children({ confirmIfNeeded })}
      <Dialog
        open={dialogState.open}
        onClose={() => closeDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>{dialogState.title}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {dialogState.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Save your changes first if you want to keep them.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => closeDialog(false)} variant="outlined">
            Keep Editing
          </Button>
          <Button color="error" onClick={() => closeDialog(true)} variant="contained">
            Discard Changes
          </Button>
        </DialogActions>
      </Dialog>
    </UnsavedChangesBoundaryContext.Provider>
  );
}

export function useUnsavedChangesGuard<T>({
  disabled = false,
  message = DEFAULT_MESSAGE,
  title = DEFAULT_TITLE,
  value,
}: {
  disabled?: boolean;
  message?: string;
  title?: string;
  value: T;
}) {
  const boundary = React.useContext(UnsavedChangesBoundaryContext);
  const baselineRef = React.useRef(serializeForDirtyCheck(value));
  const currentSerialized = React.useMemo(() => serializeForDirtyCheck(value), [value]);
  const isDirty = !disabled && currentSerialized !== baselineRef.current;

  const blocker = useBlocker(isDirty);

  React.useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }

    let active = true;

    void (async () => {
      const confirmed = boundary
        ? await boundary.requestConfirmation({ message, title })
        : window.confirm(message);

      if (!active) {
        return;
      }

      if (confirmed) {
        blocker.proceed();
        return;
      }

      blocker.reset();
    })();

    return () => {
      active = false;
    };
  }, [blocker, boundary, message, title]);

  useBeforeUnload(
    React.useCallback(
      (event) => {
        if (!isDirty) {
          return;
        }
        event.preventDefault();
        event.returnValue = '';
      },
      [isDirty]
    ),
    { capture: true }
  );

  React.useEffect(() => {
    if (!boundary) {
      return;
    }

    boundary.setGuard({ isDirty, message, title });
    return () => {
      boundary.setGuard(null);
    };
  }, [boundary, isDirty, message, title]);

  const markClean = React.useCallback((nextValue: T) => {
    baselineRef.current = serializeForDirtyCheck(nextValue);
  }, []);

  const confirmDiscard = React.useCallback(
    async (onDiscard?: () => void) => {
      const confirmed = isDirty
        ? boundary
          ? await boundary.requestConfirmation({ message, title })
          : window.confirm(message)
        : true;

      if (!confirmed) {
        return false;
      }

      baselineRef.current = currentSerialized;
      onDiscard?.();
      return true;
    },
    [boundary, currentSerialized, isDirty, message, title]
  );

  return {
    confirmDiscard,
    isDirty,
    markClean,
  };
}
