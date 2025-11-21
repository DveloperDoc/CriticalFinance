// src/screens/AccountScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme';

export default function AccountScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cuenta</Text>
      {/* aquí después metes los datos de la cuenta */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
});