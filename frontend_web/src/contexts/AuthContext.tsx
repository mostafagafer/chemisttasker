// src/contexts/AuthContext.tsx

import { createContext, useContext, ReactNode, useEffect, useState, Dispatch, SetStateAction } from 'react';


export interface OrgMembership {
  organization_id: number;
  organization_name: string;
  role: string;  // e.g. 'ORG_ADMIN'
  region: string;
}

// NEW: shape for pharmacy-level memberships returned by backend
export interface PharmacyMembership {
  pharmacy_id: number;
  pharmacy_name?: string | null;
  role: string;  // e.g. 'PHARMACY_ADMIN', 'PHARMACIST', etc.
}

export type User = {
  id?: number;
  username: string;
  email?: string;
  role: string; // top-level role (may still be 'EXPLORER' for Pharmacy Admins)
  is_pharmacy_admin?: boolean; // NEW convenience flag from backend
  // memberships now can include BOTH org and pharmacy entries
  memberships?: Array<OrgMembership | PharmacyMembership>;
  is_mobile_verified?: boolean; 
};

type AuthContextType = {
  access: string | null;
  token: string | null;
  refresh: string | null;
  user: User | null;
  login: (access: string, refresh: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  setUser: Dispatch<SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType>({
  access: null,
  token: null,
  refresh: null,
  user: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
  setUser: () => {},
});

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [access, setAccess] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // bootstrap from localStorage
  useEffect(() => {
    try {
      const storedAccess = localStorage.getItem('access');
      const storedRefresh = localStorage.getItem('refresh');
      const storedUser = localStorage.getItem('user');

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
          // malformed user; clear all
          localStorage.removeItem('user');
          setUser(null);
          setAccess(null);
          setRefresh(null);
        }
      }
    } catch {
      // catch-all; clear all
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      setAccess(null);
      setRefresh(null);
      setUser(null);
    }
    setIsLoading(false);
  }, []);


  useEffect(() => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
}, [user]);

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
        setUser,
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
