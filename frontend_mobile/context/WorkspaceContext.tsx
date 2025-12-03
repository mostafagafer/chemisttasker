import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WorkspaceType = 'internal' | 'platform';

interface WorkspaceContextType {
    workspace: WorkspaceType;
    setWorkspace: (workspace: WorkspaceType) => void;
    isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = '@chemisttasker_workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [workspace, setWorkspaceState] = useState<WorkspaceType>('platform');
    const [isLoading, setIsLoading] = useState(true);

    // Load workspace from storage on mount
    useEffect(() => {
        loadWorkspace();
    }, []);

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
        try {
            await AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, newWorkspace);
            setWorkspaceState(newWorkspace);
        } catch (error) {
            console.error('Failed to save workspace:', error);
            // Still update the state even if storage fails
            setWorkspaceState(newWorkspace);
        }
    };

    return (
        <WorkspaceContext.Provider value={{ workspace, setWorkspace, isLoading }}>
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
