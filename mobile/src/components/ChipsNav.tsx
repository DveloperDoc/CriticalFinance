import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { colors } from '@/theme';

type ActiveTab = 'inicio' | 'ahorro' | 'movimientos' | 'anomalias';

export default function ChipsNav({ active }: { active?: ActiveTab }) {
  const pathname = usePathname();
  const router = useRouter();

  const isInicio =
    active === 'inicio' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/index';

  const isAhorro =
    active === 'ahorro' ||
    pathname === '/(tabs)/ahorro';

  const isMovs =
    active === 'movimientos' ||
    pathname === '/(tabs)/movimientos';

  const isAnom =
    active === 'anomalias' ||
    pathname === '/(tabs)/anomalias';

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

      <Pressable
        onPress={() => router.navigate('/(tabs)/anomalias')}
        style={[s.chip, isAnom ? s.chipActive : s.chipInactive]}
      >
        <Text style={[s.textBase, isAnom ? s.textActive : s.textInactive]}>
          Inusuales
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // AppHeader ya tiene paddingHorizontal; aquí solo margen
    marginTop: 10,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 13,
  },
  textActive: {
    color: '#fff',
  },
  textInactive: {
    color: colors.text,
    opacity: 0.85,
  },
});
