import { createContext, useContext, useMemo, useCallback, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

type WorkspaceType = 'internal' | 'platform';

interface WorkspaceContextType {
  workspace: WorkspaceType;
  setWorkspace: (workspace: WorkspaceType) => void;
  canUseInternal: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceType>('platform');

  const canUseInternal = useMemo(() => {
    const memberships = Array.isArray((user as any)?.memberships) ? (user as any).memberships : [];
    const hasPharmacyMembership = memberships.some((membership: any) => {
      const rawPharmacyId = membership?.pharmacy_id ?? membership?.pharmacyId ?? membership?.pharmacy?.id;
      return Number.isFinite(Number(rawPharmacyId));
    });
    const adminAssignments = Array.isArray((user as any)?.admin_assignments) ? (user as any).admin_assignments : [];
    const hasAdminAssignment = adminAssignments.some((assignment: any) => {
      const rawPharmacyId = assignment?.pharmacy_id ?? assignment?.pharmacyId ?? assignment?.pharmacy;
      return Number.isFinite(Number(rawPharmacyId));
    });
    return hasPharmacyMembership || hasAdminAssignment;
  }, [user]);

  useEffect(() => {
    if (!canUseInternal && workspace !== 'platform') {
      setWorkspace('platform');
    }
  }, [canUseInternal, workspace]);

  const guardedSetWorkspace = useCallback(
    (nextWorkspace: WorkspaceType) => {
      if (!canUseInternal) {
        setWorkspace('platform');
        return;
      }
      setWorkspace(nextWorkspace);
    },
    [canUseInternal]
  );

  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace: guardedSetWorkspace, canUseInternal }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
