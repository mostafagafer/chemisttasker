// src/contexts/AuthContext.tsx

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

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
  login: (access: string, refresh: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  access: null,
  token: null,
  refresh: null,
  user: null,
  login: () => {},
  logout: () => {},
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

  // Bulletproof localStorage/session bootstrap
  useEffect(() => {
    try {
      const storedAccess = localStorage.getItem('access');
      const storedRefresh = localStorage.getItem('refresh');
      const storedUser = localStorage.getItem('user');

      // If any are missing, or user fails to parse, log out completely
      if (!storedAccess || !storedRefresh || !storedUser) {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        setAccess(null);
        setRefresh(null);
        setUser(null);
      } else {
        try {
          setUser(JSON.parse(storedUser));
          setAccess(storedAccess);
          setRefresh(storedRefresh);
        } catch {
          // Malformed user in storage, clear all
          localStorage.removeItem('user');
          setUser(null);
          setAccess(null);
          setRefresh(null);
        }
      }
    } catch {
      // Catch-all: if anything explodes, clear everything
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      setAccess(null);
      setRefresh(null);
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  const login = (newAccess: string, newRefresh: string, userInfo: User) => {
    setAccess(newAccess);
    setRefresh(newRefresh);
    setUser(userInfo);
    localStorage.setItem('access', newAccess);
    localStorage.setItem('refresh', newRefresh);
    localStorage.setItem('user', JSON.stringify(userInfo));
    console.log('Auth data saved successfully');
  };

  const logout = () => {
    setAccess(null);
    setRefresh(null);
    setUser(null);
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
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
