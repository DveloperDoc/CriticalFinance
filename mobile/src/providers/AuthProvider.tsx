import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthToken } from '@/api/client';
import { login as loginApi } from '@/api/auth';

type User = { id: string; email: string } | null;

type Ctx = {
  user: User;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

const STORAGE = {
  token: 'token',
  user: 'user',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Rehidratación inicial
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([STORAGE.token, STORAGE.user]);
        const t = pairs.find(([k]) => k === STORAGE.token)?.[1] ?? null;
        const u = pairs.find(([k]) => k === STORAGE.user)?.[1] ?? null;

        const validToken = t && t !== 'null' && t !== 'undefined' ? t : null;
        setToken(validToken);
        setAuthToken(validToken); // <-- garantiza header en boot

        if (u) {
          try { setUser(JSON.parse(u)); } catch { setUser(null); }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Login: persiste primero, luego actualiza estado y header
  const signIn = async (email: string, password: string) => {
    const { access_token, user: apiUser } = await loginApi(email, password);

    await AsyncStorage.multiSet([
      [STORAGE.token, access_token],
      [STORAGE.user, apiUser ? JSON.stringify(apiUser) : ''],
    ]);

    setAuthToken(access_token);   // <-- header para axios
    setToken(access_token);
    setUser(apiUser ?? null);

    // Opcional: limpia cache ligada a sesión anterior
    queryClient.clear();
  };

  // Logout: corta dependencias, cancela queries y limpia storage
  const signOut = async () => {
    try {
      setAuthToken(null);
      setToken(null);
      setUser(null);

      await queryClient.cancelQueries();
      queryClient.clear();

      await AsyncStorage.multiRemove([STORAGE.token, STORAGE.user]);
    } catch (e) {
      console.log('Logout error', e);
    }
  };

  const value = useMemo(() => ({ user, token, loading, signIn, signOut }), [user, token, loading]);

  return (
    <AuthCtx.Provider value={value}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando…</Text>
        </View>
      ) : (
        children
      )}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
