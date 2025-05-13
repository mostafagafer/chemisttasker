// src/contexts/AuthContext.tsx

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

//
// 1. Define the shape of an organization membership.
//    This matches what your backend returns on login.
//
export interface OrgMembership {
  organization_id: number;
  organization_name: string;
  role: string;
  region: string;
}

//
// 2. Extend your User type to include memberships.
//
export type User = {
  id?: number;
  username: string;
  email?: string;
  role: string;
  memberships?: OrgMembership[];
};

type AuthContextType = {
  access: string | null;   // Primary access token
  token: string | null;    // Alias for access
  refresh: string | null;  // Refresh token
  user: User | null;       // Now includes memberships
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
  const [access, setAccess]       = useState<string | null>(null);
  const [refresh, setRefresh]     = useState<string | null>(null);
  const [user, setUser]           = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, pull any saved auth state from localStorage
  useEffect(() => {
    const storedAccess  = localStorage.getItem('access');
    const storedRefresh = localStorage.getItem('refresh');
    const storedUser    = localStorage.getItem('user');

    if (storedAccess) setAccess(storedAccess);
    if (storedRefresh) setRefresh(storedRefresh);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  // Called after successful login API call, passing in full User object including memberships
  const login = (newAccess: string, newRefresh: string, userInfo: User) => {
    setAccess(newAccess);
    setRefresh(newRefresh);
    setUser(userInfo);

    localStorage.setItem('access', newAccess);
    localStorage.setItem('refresh', newRefresh);
    localStorage.setItem('user', JSON.stringify(userInfo));

    console.log('Auth data saved successfully');
  };

  // Clears all auth state
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

// Hook to consume auth state
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
