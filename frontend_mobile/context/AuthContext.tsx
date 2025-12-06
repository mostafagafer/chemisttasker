import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  login as sharedLogin,
  register as sharedRegister,
  getOnboarding,
} from '@chemisttasker/shared-core';
import apiClient from '../utils/apiClient';
import { registerForPushNotificationsAsync, registerDeviceTokenWithBackend } from '../utils/pushNotifications';
import * as Device from 'expo-device';

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
  profile_photo?: string;
  profile_photo_url?: string;
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
  hasCapability: (capability: string, pharmacyId?: number | string | null) => boolean;
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
  hasCapability: () => false,
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
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [triedPhotoRefresh, setTriedPhotoRefresh] = useState(false);
  const [registeredPush, setRegisteredPush] = useState(false);

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
            const parsed = JSON.parse(storedUser);
            const normalized = normalizeUser(parsed);
            setUser(normalized);
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

  useEffect(() => {
    const setupPush = async () => {
      if (!access || !user || registeredPush) return;
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          const platform = Device.osName?.toLowerCase().includes('ios') ? 'ios' : 'android';
          await registerDeviceTokenWithBackend(token, platform as 'ios' | 'android');
        }
        setRegisteredPush(true);
      } catch (err) {
        console.error('Push registration failed', err);
      }
    };
    void setupPush();
  }, [access, user, registeredPush]);

  const normalizeUser = (u: any): User => {
    if (!u) return u;
    const photo = u.profile_photo_url || u.profile_photo || u.profilePhoto;
    return { ...u, profile_photo_url: photo, profile_photo: photo };
  };

  const fetchOnboardingProfile = async (role?: string, existing?: any) => {
    const normalizedRole = (role || '').toLowerCase();
    const safeRole = normalizedRole === 'other_staff' ? 'otherstaff' : normalizedRole || 'pharmacist';
    const data = await getOnboarding(safeRole);
    const merged = { ...(existing ?? {}), ...(data as any) };
    return normalizeUser(merged);
  };

  const login = async (newAccess: string, newRefresh: string, userInfo: User) => {
    setAccess(newAccess);
    setRefresh(newRefresh);
    await AsyncStorage.setItem('ACCESS_KEY', newAccess);
    await AsyncStorage.setItem('REFRESH_KEY', newRefresh);

    const baseUser = normalizeUser(userInfo);
    setUser(baseUser);
    await AsyncStorage.setItem('user', JSON.stringify(baseUser));

    // Hydrate with onboarding profile if available (adds photo, phone, etc.)
    try {
      const hydrated = await fetchOnboardingProfile(baseUser.role, baseUser);
      setUser(hydrated);
      await AsyncStorage.setItem('user', JSON.stringify(hydrated));
    } catch (error) {
      const msg = (error as any)?.message || error;
      console.debug('Onboarding profile fetch skipped:', msg);
    }
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
      const updatedUser = normalizeUser(response.data.user);
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
      const hydrated = await fetchOnboardingProfile(user?.role, user);
      setUser(hydrated as User);
      await AsyncStorage.setItem('user', JSON.stringify(hydrated));
    } catch (error) {
      const msg = (error as any)?.message || error;
      console.debug('Error refreshing user (non-fatal):', msg);
    }
  };

  // If we have a token but missing photo, pull a fresh user without forcing users to clear storage
  useEffect(() => {
    if (!access || isRefreshingProfile || triedPhotoRefresh) return;
    const needsPhoto = user && !user.profile_photo_url && !user.profile_photo;
    if (needsPhoto) {
      setIsRefreshingProfile(true);
      setTriedPhotoRefresh(true);
      refreshUser().finally(() => setIsRefreshingProfile(false));
    }
  }, [access, user, isRefreshingProfile, triedPhotoRefresh]);

  const logout = async () => {
    setAccess(null);
    setRefresh(null);
    setUser(null);
    setRegisteredPush(false);
    await AsyncStorage.multiRemove(['ACCESS_KEY', 'REFRESH_KEY', 'user']);
  };

  const hasCapability = (capability: string, pharmacyId?: number | string | null) => {
    if (!user) return false;
    const role = String(user.role || '').toUpperCase();
    if (role === 'OWNER') return true;
    const assignments: any[] = (user as any).admin_assignments || [];
    return assignments.some((a) => {
      const caps: string[] = a?.capabilities || [];
      const pid = a?.pharmacy_id ?? a?.pharmacyId ?? a?.pharmacy;
      const matchesPharmacy = pharmacyId ? String(pid ?? '') === String(pharmacyId) : true;
      return matchesPharmacy && caps.includes(capability);
    });
  };

  return (
    <AuthContext.Provider
      value={{
        access,
        token: access,
        refresh,
        user,
        hasCapability,
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
