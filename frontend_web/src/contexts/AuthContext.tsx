// src/contexts/AuthContext.tsx

import { createContext, useContext, ReactNode, useEffect, useState, Dispatch, SetStateAction, useCallback } from 'react';
import apiClient from '../utils/apiClient'; // FIX: Add apiClient import
import { API_ENDPOINTS } from '../constants/api'; // FIX: Add API_ENDPOINTS import

export interface OrgMembership {
  organization_id: number;
  organization_name: string;
  role: string;
  region: string;
}

export interface PharmacyMembership {
  pharmacy_id: number;
  pharmacy_name?: string | null;
  role: string;
}

export type User = {
  id?: number;
  username: string;
  email?: string;
  role: string;
  is_pharmacy_admin?: boolean;
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
  // FIX: Add state and function for unread message count
  unreadCount: number;
  refreshUnreadCount: () => void;
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
  // FIX: Provide default values for the new context properties
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [access, setAccess] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // FIX: Add state to hold the unread message count
  const [unreadCount, setUnreadCount] = useState(0);

  // bootstrap from localStorage (no changes here)
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
          localStorage.removeItem('user');
          setUser(null);
          setAccess(null);
          setRefresh(null);
        }
      }
    } catch {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      setAccess(null);
      setRefresh(null);
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  // Save user to localStorage when it changes (no changes here)
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, [user]);

  // FIX: Create a function to fetch and update the unread count
  const refreshUnreadCount = useCallback(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    apiClient.get(API_ENDPOINTS.rooms)
      .then((res) => {
        const rooms: any[] = Array.isArray(res.data.results) ? res.data.results : res.data;
        const totalUnread = rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
        setUnreadCount(totalUnread);
      })
      .catch(() => setUnreadCount(0));
  }, [user]);

  // FIX: Fetch the initial unread count when the user logs in or is loaded
  useEffect(() => {
    refreshUnreadCount();
  }, [user, refreshUnreadCount]);


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
        // FIX: Provide the new state and function to the rest of the app
        unreadCount,
        refreshUnreadCount,
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