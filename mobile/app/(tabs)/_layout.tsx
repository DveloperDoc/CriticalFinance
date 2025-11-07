import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';
import { colors } from '@/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function TabsLayout() {
  const { user, loading } = useAuth();

  // Redirección automática si no hay sesión
  useEffect(() => {
    if (!loading && !user) router.replace('/(auth)/login');
  }, [user, loading]);

  if (loading) return null; // evita parpadeos mientras carga sesión

  return (
    <Tabs
      screenOptions={{
        header: () => <AppHeader />,
        tabBarStyle: { backgroundColor: colors.card },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="cuenta"
        options={{
          title: 'Cuenta',
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen name="ahorro" options={{ href: null, title: 'Ahorro' }} />
      <Tabs.Screen name="movimientos" options={{ href: null, title: 'Movimientos' }} />
      <Tabs.Screen name="movimiento/[id]" options={{ href: null, title: 'Detalle' }} />
    </Tabs>
  );
}
