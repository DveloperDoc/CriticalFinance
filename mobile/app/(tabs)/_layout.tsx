import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';
import { colors } from '@/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function TabsLayout() {
  const { user, token, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Redirección automática si no hay sesión
  useEffect(() => {
    if (!loading && !token) {
      router.replace('/(auth)/login');
    }
  }, [loading, token]);

  if (loading) return null;

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const goToCuenta = () => {
    setMenuOpen(false);
    router.push('/(tabs)/cuenta');
  };

  return (
    <View style={{ flex: 1 }}>
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
          listeners={{
            tabPress: (e) => {
              // evitamos la navegación normal y abrimos el menú
              e.preventDefault();
              setMenuOpen(true);
            },
          }}
        />

        {/* estas siguen ocultas, como ya tenías */}
        <Tabs.Screen name="ahorro" options={{ href: null, title: 'Ahorro' }} />
        <Tabs.Screen name="movimientos" options={{ href: null, title: 'Movimientos' }} />
        <Tabs.Screen name="movimiento/[id]" options={{ href: null, title: 'Detalle' }} />
      </Tabs>

      {/* MENÚ flotante ligado al layout */}
      {menuOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* fondo clickeable para cerrar */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuOpen(false)}
          />

          <View style={styles.menuWrap}>
            <View style={styles.menu}>
              <Pressable style={styles.menuItem} onPress={goToCuenta}>
                <Text style={styles.menuText}>Cuenta</Text>
              </Pressable>

              <View style={styles.separator} />

              <Pressable style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.logoutText}>Cerrar sesión</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menuWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 24,   // distancia al borde derecho
    paddingBottom: 80,  // altura sobre la barra de tabs (ajusta a gusto)
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuText: { color: colors.text, fontSize: 16 },
  logoutText: {
    color: colors.danger ?? '#ff4b4b',
    fontSize: 16,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
});
