import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

type WorkspaceType = 'internal' | 'platform';

interface WorkspaceContextType {
    workspace: WorkspaceType;
    setWorkspace: (workspace: WorkspaceType) => void;
    isLoading: boolean;
    canUseInternal: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = '@chemisttasker_workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user, isLoading: authLoading } = useAuth();
    const [workspace, setWorkspaceState] = useState<WorkspaceType>('platform');
    const [isLoading, setIsLoading] = useState(true);
    const [canUseInternal, setCanUseInternal] = useState(false);

    // Load workspace from storage on mount
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
        setCanUseInternal(hasPharmacyMembership || hasAdminAssignment);
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!canUseInternal) {
            if (workspace !== 'platform') {
                setWorkspaceState('platform');
            }
            AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, 'platform').catch(() => null);
        }
    }, [authLoading, canUseInternal, workspace]);

    const loadWorkspace = async () => {
        try {
            const stored = await AsyncStorage.getItem(WORKSPACE_STORAGE_KEY);
            if (stored === 'internal' || stored === 'platform') {
                setWorkspaceState(stored);
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
        } catch (error) {
            console.error('Failed to save workspace:', error);
            // Still update the state even if storage fails
            setWorkspaceState(targetWorkspace);
        }
    };

    return (
        <WorkspaceContext.Provider value={{ workspace, setWorkspace, isLoading, canUseInternal }}>
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
