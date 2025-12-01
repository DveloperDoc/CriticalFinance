import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthToken, api } from '@/api/client';
import { login as loginApi } from '@/api/auth';
import { registerPushToken } from '@/notifications/registerPushToken';

type User = { id: string; email: string } | null;

type Ctx = {
  user: User;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
        setAuthToken(validToken);

        if (u) {
          try {
            setUser(JSON.parse(u));
          } catch {
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Login
  const login = async (email: string, password: string) => {
    const { access_token, user: apiUser } = await loginApi(email, password);

    // Guardar token y configurarlo en axios
    await AsyncStorage.setItem(STORAGE.token, access_token);
    setAuthToken(access_token);
    setToken(access_token);

    let finalUser: User = apiUser ?? null;

    // Si el /auth/login no devuelve user, lo obtenemos desde /me
    if (!finalUser) {
      try {
        const me = await api.get('/me');
        finalUser = { id: me.data.id, email: me.data.email };
      } catch {
        finalUser = null;
      }
    }

    // Persistir usuario
    await AsyncStorage.setItem(
      STORAGE.user,
      finalUser ? JSON.stringify(finalUser) : '',
    );

    setUser(finalUser);

    // Limpiar cache de react-query para evitar datos antiguos
    queryClient.clear();

    // Registrar token de notificaciones (no bloqueante)
    registerPushToken().catch((err) =>
      console.error('Error al registrar push token', err),
    );
  };

  // Logout
  const logout = async () => {
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

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading],
  );

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
