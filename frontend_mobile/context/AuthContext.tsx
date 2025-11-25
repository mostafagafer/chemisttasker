import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  login as sharedLogin,
  register as sharedRegister,
  getCurrentUser,
} from '@chemisttasker/shared-core';
import apiClient from '../utils/apiClient';

// --- Types ---
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

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  accepted_terms: boolean;
}

type AuthContextType = {
  access: string | null;
  token: string | null;
  refresh: string | null;
  user: User | null;
  login: (access: string, refresh: string, user: User) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  access: null,
  token: null,
  refresh: null,
  user: null,
  login: async () => { },
  loginWithCredentials: async () => ({ id: 0, username: '', role: '' }),
  register: async () => { },
  logout: async () => { },
  verifyOTP: async () => { },
  resendOTP: async () => { },
  refreshUser: async () => { },
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
        const storedAccess = await AsyncStorage.getItem('ACCESS_KEY');
        const storedRefresh = await AsyncStorage.getItem('REFRESH_KEY');
        const storedUser = await AsyncStorage.getItem('user');

        if (!storedAccess || !storedRefresh || !storedUser) {
          await AsyncStorage.multiRemove(['ACCESS_KEY', 'REFRESH_KEY', 'user']);
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
        await AsyncStorage.multiRemove(['ACCESS_KEY', 'REFRESH_KEY', 'user']);
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
    await AsyncStorage.setItem('ACCESS_KEY', newAccess);
    await AsyncStorage.setItem('REFRESH_KEY', newRefresh);
    await AsyncStorage.setItem('user', JSON.stringify(userInfo));
  };

  const loginWithCredentials = async (email: string, password: string) => {
    try {
      const response: any = await sharedLogin({ email, password });
      const tokens = response.tokens || {};
      const newAccess = tokens.access || response.access;
      const newRefresh = tokens.refresh || response.refresh;
      const userData = response.user || response.userData || response.profile;
      if (!newAccess || !newRefresh || !userData) {
        throw new Error('Unexpected login response');
      }
      await login(newAccess, newRefresh, userData);
      return userData;
    } catch (error: any) {
      throw new Error(error?.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response: any = await sharedRegister(data);
      const tokens = response.tokens || {};
      const newAccess = tokens.access || response.access;
      const newRefresh = tokens.refresh || response.refresh;
      const userData = response.user || response.userData || response.profile;
      if (!newAccess || !newRefresh || !userData) {
        throw new Error('Unexpected registration response');
      }
      await login(newAccess, newRefresh, userData);
    } catch (error: any) {
      const errorMsg =
        error?.message ||
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.detail ||
        'Registration failed';
      throw new Error(errorMsg);
    }
  };

  const verifyOTP = async (code: string) => {
    try {
      const response = await apiClient.post('/users/verify-otp/', { otp: code });
      const updatedUser = response.data.user;
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'OTP verification failed');
    }
  };

  const resendOTP = async () => {
    try {
      await apiClient.post('/users/resend-otp/');
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to resend OTP');
    }
  };

  const refreshUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data as User);
      await AsyncStorage.setItem('user', JSON.stringify(data));
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const logout = async () => {
    setAccess(null);
    setRefresh(null);
    setUser(null);
    await AsyncStorage.multiRemove(['ACCESS_KEY', 'REFRESH_KEY', 'user']);
  };

  return (
    <AuthContext.Provider
      value={{
        access,
        token: access,
        refresh,
        user,
        login,
        loginWithCredentials,
        register,
        logout,
        verifyOTP,
        resendOTP,
        refreshUser,
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
