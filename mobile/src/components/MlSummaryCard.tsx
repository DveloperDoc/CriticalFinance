// src/components/MlSummaryCard.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

type MlSummary = {
  total: number;
  withCategory: number;
  withSuggestion: number;
  pendingIa: number;
  confirmedManual: number;
  noCategory: number;
};

type Props = {
  accountId?: string | null;
};

export function MlSummaryCard({ accountId }: Props) {
  const { token } = useAuth();
  const enabled = !!token && !!accountId;

  const { data, isLoading, isError } = useQuery<MlSummary>({
    queryKey: ['ml-summary', accountId],
    enabled,
    queryFn: async () => {
      const r = await api.get('/transactions/ml-summary', {
        params: { accountId },
      });
      return r.data as MlSummary;
    },
    staleTime: 60_000,
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <View style={s.card}>
        <ActivityIndicator />
        <Text style={s.helper}>Analizando tus movimientos…</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={s.card}>
        <Text style={s.title}>Asistente IA</Text>
        <Text style={s.error}>No se pudo cargar el resumen.</Text>
      </View>
    );
  }

  const { total, withCategory, pendingIa, confirmedManual } = data;

  return (
    <View style={s.card}>
      <Text style={s.title}>Asistente IA</Text>
      <Text style={s.subtitle}>Resumen de categorización automática</Text>

      <View style={s.row}>
        <View style={s.col}>
          <Text style={s.label}>Movimientos</Text>
          <Text style={s.value}>{total}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>Con categoría</Text>
          <Text style={s.value}>{withCategory}</Text>
        </View>
      </View>

      <View style={s.row}>
        <View style={s.col}>
          <Text style={s.label}>Pendientes IA</Text>
          <Text style={s.valueDanger}>{pendingIa}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>Confirmados por ti</Text>
          <Text style={s.value}>{confirmedManual}</Text>
        </View>
      </View>

      <Text style={s.helper}>
        La IA sugiere categorías y tú las puedes confirmar desde los movimientos.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: (colors as any).surface || colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted ?? '#9ca3af',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  col: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted ?? '#9ca3af',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  valueDanger: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger ?? '#f97373',
    marginTop: 2,
  },
  helper: {
    fontSize: 11,
    color: colors.textMuted ?? '#9ca3af',
    marginTop: 10,
  },
  error: {
    fontSize: 12,
    color: colors.danger ?? '#f97373',
    marginTop: 6,
  },
});
