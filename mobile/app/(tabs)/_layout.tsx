import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';   // ⬅️ header reusable
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // Usamos nuestro header en todas las tabs
        header: () => <AppHeader />,
        tabBarStyle: { backgroundColor: colors.card },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      {/* visibles en la barra */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: 'Cuenta',
          tabBarIcon: ({ color, size }) => <Feather name="menu" color={color} size={size} />,
        }}
      />

      {/* rutas de chips, ocultas en la barra pero navegables */}
      <Tabs.Screen name="ahorro" options={{ href: null, title: 'Ahorro' }} />
      <Tabs.Screen name="movimientos" options={{ href: null, title: 'Movimientos' }} />

      {/* detalle oculto */}
      <Tabs.Screen name="movimiento/[id]" options={{ href: null, title: 'Detalle' }} />
    </Tabs>
  );
}