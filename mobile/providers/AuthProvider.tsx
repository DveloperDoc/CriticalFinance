import React, { createContext, useContext, useMemo, useState } from 'react';
import { router } from 'expo-router';

type AuthContextType = {
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    // TODO: integrar tu endpoint real /auth/login (Nest) y guardar JWT:
    // const res = await api.post('/auth/login', { email, password });
    // setToken(res.data.token);
    // Por ahora, mock:
    if (email && password) {
      setToken('mock-token');
      router.replace('/(tabs)'); // al loguear, redirige a tabs
    } else {
      throw new Error('Credenciales inválidas');
    }
  };

  const signOut = () => {
    setToken(null);
    router.replace('/(auth)/login');
  };

  const value = useMemo(() => ({ token, signIn, signOut }), [token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}