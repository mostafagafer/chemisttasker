import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types (copied from your web code) ---
export interface OrgMembership {
  organization_id: number;
  organization_name: string;
  role: string;
  region: string;
}

export type User = {
  id?: number;
  username: string;
  email?: string;
  role: string;
  memberships?: OrgMembership[];
};

type AuthContextType = {
  access: string | null;
  token: string | null;
  refresh: string | null;
  user: User | null;
  login: (access: string, refresh: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  access: null,
  token: null,
  refresh: null,
  user: null,
  login: async () => {},
  logout: async () => {},
  isLoading: true,
});

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [access, setAccess] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load tokens and user from AsyncStorage at app startup
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedAccess = await AsyncStorage.getItem('access');
        const storedRefresh = await AsyncStorage.getItem('refresh');
        const storedUser = await AsyncStorage.getItem('user');

        if (!storedAccess || !storedRefresh || !storedUser) {
          await AsyncStorage.multiRemove(['access', 'refresh', 'user']);
          setAccess(null);
          setRefresh(null);
          setUser(null);
        } else {
          try {
            setUser(JSON.parse(storedUser));
            setAccess(storedAccess);
            setRefresh(storedRefresh);
          } catch {
            await AsyncStorage.removeItem('user');
            setUser(null);
            setAccess(null);
            setRefresh(null);
          }
        }
      } catch {
        // If anything explodes, clear everything
        await AsyncStorage.multiRemove(['access', 'refresh', 'user']);
        setAccess(null);
        setRefresh(null);
        setUser(null);
      }
      setIsLoading(false);
    };
    loadStoredAuth();
  }, []);

  const login = async (newAccess: string, newRefresh: string, userInfo: User) => {
    setAccess(newAccess);
    setRefresh(newRefresh);
    setUser(userInfo);
    await AsyncStorage.setItem('access', newAccess);
    await AsyncStorage.setItem('refresh', newRefresh);
    await AsyncStorage.setItem('user', JSON.stringify(userInfo));
    console.log('Auth data saved successfully');
  };

  const logout = async () => {
    setAccess(null);
    setRefresh(null);
    setUser(null);
    await AsyncStorage.multiRemove(['access', 'refresh', 'user']);
    console.log('Auth data removed successfully');
  };

  return (
    <AuthContext.Provider
      value={{
        access,
        token: access,
        refresh,
        user,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
