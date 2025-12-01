// mobile/app/(tabs)/anomalias.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { fmtCLP } from '@/utils/format';

type Category = {
  id: string;
  name: string;
  color?: string | null;
} | null;

type Anomaly = {
  id: string;
  merchant: string | null;
  description: string | null;
  valueCents: number;
  absValueCents: number;
  bookedAt: string;
  category: Category;
  anomalyScore: number | null;
};

export default function AnomaliasScreen() {
  const { token } = useAuth();

  const {
    data: anomalies = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Anomaly[]>({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const { data } = await api.get('/transactions/anomalies');
      return data as Anomaly[];
    },
    enabled: !!token,
    refetchOnMount: 'always',
    staleTime: 30_000,
    retry: 0,
  });

  if (!token) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>Inicia sesión para ver movimientos inusuales.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.textMuted}>Buscando anomalías…</Text>
      </View>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error al cargar anomalías';

    return (
      <View style={s.center}>
        <Text style={s.err}>
          {status ? `${status} · ` : ''}
          {msg}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Text style={s.title}>Movimientos inusuales</Text>
      <Text style={s.subtitle}>
        Te mostramos los gastos más altos o fuera de patrón según tu historial.
      </Text>

      <FlatList
        data={anomalies}
        keyExtractor={(a) => a.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.text}
          />
        }
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.textMuted}>
              No encontramos movimientos inusuales por ahora. ¡Buen manejo de tus gastos!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const score = item.anomalyScore ?? 0;

          // IMPORTANTE: todos los colores salen del theme
          let severityLabel: string = 'Moderado';
          let severityColor: string = colors.warning;

          if (score >= 0.85) {
            severityLabel = 'Alto';
            severityColor = colors.danger;
          } else if (score < 0.6) {
            severityLabel = 'Bajo';
            severityColor = colors.success;
          }

          const title = item.merchant || item.description || 'Movimiento inusual';
          const date = new Date(item.bookedAt).toLocaleString('es-CL');
          const categoryName = item.category?.name ?? 'Sin categoría';
          const amountFmt = fmtCLP(Math.abs(item.valueCents));

          return (
            <View style={s.card}>
              <View style={s.rowHeader}>
                <Text style={s.cardTitle} numberOfLines={1}>
                  {title}
                </Text>
                <View style={[s.severityChip, { borderColor: severityColor }]}>
                  <Text style={[s.severityText, { color: severityColor }]}>
                    {severityLabel}
                  </Text>
                </View>
              </View>

              <Text style={s.amount}>{amountFmt}</Text>

              <View style={s.rowMeta}>
                <Text style={s.metaText}>{date}</Text>
                <Text style={s.metaText}>{categoryName}</Text>
              </View>

              {item.anomalyScore !== null && (
                <Text style={s.scoreText}>
                  Score de anomalía: {(item.anomalyScore * 100).toFixed(1)}%
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  sep: {
    height: 8,
  },
  emptyBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  textMuted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  severityChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  amount: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    color: colors.danger, // SOLO theme, sin '#EF4444'
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  scoreText: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textMuted,
  },
  err: {
    color: colors.danger,
    textAlign: 'center',
  },
});
