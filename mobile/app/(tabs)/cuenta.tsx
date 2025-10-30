import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme';

export default function CuentaScreen() {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Cuenta</Text>
      <Text style={s.text}>Aquí pondremos perfil, ajustes, cerrar sesión, etc.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  text: { color: colors.textMuted },
});