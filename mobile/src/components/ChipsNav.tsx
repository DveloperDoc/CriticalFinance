import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { colors } from '@/theme';

type ActiveTab = 'inicio' | 'ahorro' | 'movimientos';

export default function ChipsNav({ active }: { active?: ActiveTab }) {
  const pathname = usePathname();
  const router = useRouter();

  // Si no viene prop "active", deducimos desde la ruta actual
  const isInicio =
    active === 'inicio' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/index';
  const isAhorro =
    active === 'ahorro' || pathname === '/(tabs)/ahorro';
  const isMovs =
    active === 'movimientos' || pathname === '/(tabs)/movimientos';

  return (
    <View style={s.row}>
      <Pressable
        onPress={() => router.navigate('/(tabs)')}
        style={[s.chip, isInicio ? s.chipActive : s.chipInactive]}
      >
        <Text style={[s.textBase, isInicio ? s.textActive : s.textInactive]}>
          Dinero
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.navigate('/(tabs)/ahorro')}
        style={[s.chip, isAhorro ? s.chipActive : s.chipInactive]}
      >
        <Text style={[s.textBase, isAhorro ? s.textActive : s.textInactive]}>
          Ahorro
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.navigate('/(tabs)/movimientos')}
        style={[s.chip, isMovs ? s.chipActive : s.chipInactive]}
      >
        <Text style={[s.textBase, isMovs ? s.textActive : s.textInactive]}>
          Movimientos
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  chipInactive: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textBase: {
    fontWeight: '600',
    fontSize: 14,
  },
  textActive: {
    color: '#fff',
  },
  textInactive: {
    color: colors.text,
    opacity: 0.8,
  },
});