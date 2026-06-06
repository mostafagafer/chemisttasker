import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

type WorkspaceType = 'internal' | 'platform';

interface WorkspaceContextType {
  workspace: WorkspaceType;
  setWorkspace: (workspace: WorkspaceType) => void;
  isLoading: boolean;
  canUseInternal: boolean;
  selectedPharmacyId: number | null;
  setSelectedPharmacyId: (pharmacyId: number | null) => void;
  selectedPharmacyName: string | null;
  setSelectedPharmacyName: (pharmacyName: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = '@chemisttasker_workspace';
const PHARMACY_ID_STORAGE_KEY = '@chemisttasker_selected_pharmacy_id';
const PHARMACY_NAME_STORAGE_KEY = '@chemisttasker_selected_pharmacy_name';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [workspace, setWorkspaceState] = useState<WorkspaceType>('platform');
  const [selectedPharmacyId, setSelectedPharmacyIdState] = useState<number | null>(null);
  const [selectedPharmacyName, setSelectedPharmacyNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canUseInternal, setCanUseInternal] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
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
    const ownerPharmacies = [(user as any)?.pharmacies, (user as any)?.owner_pharmacies, (user as any)?.owned_pharmacies].find(Array.isArray) ?? [];
    const hasOwnerPharmacy = ownerPharmacies.some((pharmacy: any) => Number.isFinite(Number(pharmacy?.id)));
    setCanUseInternal(hasPharmacyMembership || hasAdminAssignment || hasOwnerPharmacy);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!canUseInternal) {
      if (workspace !== 'platform') {
        setWorkspaceState('platform');
      }
      setSelectedPharmacyIdState(null);
      setSelectedPharmacyNameState(null);
      AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, 'platform').catch(() => null);
      AsyncStorage.multiRemove([PHARMACY_ID_STORAGE_KEY, PHARMACY_NAME_STORAGE_KEY]).catch(() => null);
    }
  }, [authLoading, canUseInternal, workspace]);

  const loadWorkspace = async () => {
    try {
      const stored = await AsyncStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored === 'internal' || stored === 'platform') {
        setWorkspaceState(stored);
      }
      const rawStoredPharmacyId = await AsyncStorage.getItem(PHARMACY_ID_STORAGE_KEY);
      const storedPharmacyId = Number(rawStoredPharmacyId);
      if (rawStoredPharmacyId != null && Number.isFinite(storedPharmacyId)) {
        setSelectedPharmacyIdState(storedPharmacyId);
      }
      const storedPharmacyName = await AsyncStorage.getItem(PHARMACY_NAME_STORAGE_KEY);
      if (storedPharmacyName) {
        setSelectedPharmacyNameState(storedPharmacyName);
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setWorkspace = async (newWorkspace: WorkspaceType) => {
    const targetWorkspace: WorkspaceType = canUseInternal ? newWorkspace : 'platform';
    try {
      await AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, targetWorkspace);
      setWorkspaceState(targetWorkspace);
      if (targetWorkspace === 'platform') {
        setSelectedPharmacyIdState(null);
        setSelectedPharmacyNameState(null);
        await AsyncStorage.multiRemove([PHARMACY_ID_STORAGE_KEY, PHARMACY_NAME_STORAGE_KEY]);
      }
    } catch (error) {
      console.error('Failed to save workspace:', error);
      setWorkspaceState(targetWorkspace);
      if (targetWorkspace === 'platform') {
        setSelectedPharmacyIdState(null);
        setSelectedPharmacyNameState(null);
      }
    }
  };

  const setSelectedPharmacyId = async (pharmacyId: number | null) => {
    setSelectedPharmacyIdState(pharmacyId);
    try {
      if (pharmacyId == null) {
        await AsyncStorage.removeItem(PHARMACY_ID_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(PHARMACY_ID_STORAGE_KEY, String(pharmacyId));
      }
    } catch (error) {
      console.error('Failed to save selected pharmacy:', error);
    }
  };

  const setSelectedPharmacyName = async (pharmacyName: string | null) => {
    setSelectedPharmacyNameState(pharmacyName);
    try {
      if (!pharmacyName) {
        await AsyncStorage.removeItem(PHARMACY_NAME_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(PHARMACY_NAME_STORAGE_KEY, pharmacyName);
      }
    } catch (error) {
      console.error('Failed to save selected pharmacy name:', error);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        setWorkspace,
        isLoading,
        canUseInternal,
        selectedPharmacyId,
        setSelectedPharmacyId,
        selectedPharmacyName,
        setSelectedPharmacyName,
      }}
    >
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
