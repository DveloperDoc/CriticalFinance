// src/screens/AccountScreen.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '@/auth/logout';
import { colors } from '@/theme';
import { router } from 'expo-router';

export default function AccountScreen() {
  const [open, setOpen] = useState(false);
  const nav = useNavigation<any>();
  const qc = useQueryClient();

  const onLogout = async () => {
    setOpen(false);
    await logout();
    qc.clear();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      {/* Header simple con botón “hamburguesa” */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cuenta</Text>

        <Pressable hitSlop={10} onPress={() => setOpen(v => !v)}>
          {/* icono hamburguesa simple sin libs */}
          <View style={styles.burger}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </Pressable>
      </View>

      {/* Contenido de tu pantalla */}
      <View style={{ flex: 1 }} />

      {/* Menú desplegable */}
      {open && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View pointerEvents="box-none" style={styles.menuWrap}>
            <View style={styles.menu}>
              <Pressable style={styles.menuItem} onPress={() => setOpen(false)}>
                <Text style={styles.menuText}>Cuenta</Text>
              </Pressable>

              <View style={styles.separator} />

              <Pressable style={styles.menuItem} onPress={onLogout}>
                <Text style={[styles.menuText, styles.logoutText]}>Cerrar sesión</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, // tu fondo oscuro
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },

  burger: { padding: 6 },
  burgerLine: {
    width: 22,
    height: 3,
    backgroundColor: colors.primary, // azul de tu app
    borderRadius: 2,
    marginVertical: 2,
  },

  menuWrap: { alignItems: 'flex-end' },
  menu: {
    marginTop: 8,
    marginRight: 12,
    backgroundColor: colors.surface, // tarjeta oscura
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 180,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 14 },
  menuText: { color: colors.text, fontSize: 16 },
  logoutText: { color: colors.danger ?? '#ff6b6b', fontWeight: '700' },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
});