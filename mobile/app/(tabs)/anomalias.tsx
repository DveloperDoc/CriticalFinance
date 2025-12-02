// mobile/app/(tabs)/anomalias.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { fmtCLP, fmtFecha } from '@/utils/format';

type Category =
  | {
      id: string;
      name: string;
      color?: string | null;
    }
  | null;

type Anomaly = {
  id: string;
  merchant: string | null;
  description: string | null;
  valueCents: number;
  absValueCents: number;
  bookedAt: string;
  category: Category;
  anomalyScore: number | null;
  anomalyResolved?: boolean;
};

export default function AnomaliasScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: anomalies = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Anomaly[]>({
    queryKey: ['transactions', 'anomalies'],
    queryFn: async () => {
      const { data } = await api.get('/transactions/anomalies');
      return data as Anomaly[];
    },
    enabled: !!token,
    refetchOnMount: 'always',
    staleTime: 30_000,
    retry: 0,
  });

  // Mutación para marcar anomalía como resuelta
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/transactions/${id}/anomaly-resolved`, {
        resolved: true,
      });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', 'anomalies'] });
      const previous =
        queryClient.getQueryData<Anomaly[]>(['transactions', 'anomalies']);

      if (previous) {
        queryClient.setQueryData<Anomaly[]>(
          ['transactions', 'anomalies'],
          previous.filter((a) => a.id !== id),
        );
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['transactions', 'anomalies'],
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', 'anomalies'] });
    },
  });

  const handleResolve = (id: string) => {
    if (resolveMutation.isPending) return;
    resolveMutation.mutate(id);
  };

  if (!token) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>
          Inicia sesión para ver movimientos inusuales.
        </Text>
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
              No encontramos movimientos inusuales por ahora. ¡Buen manejo de tus
              gastos!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const rawScore = item.anomalyScore ?? 0;

          // Normalizamos a 0..1 para evitar porcentajes raros cuando viene z-score
          const normScore = Math.max(
            0,
            Math.min(1, rawScore > 1 ? rawScore / 4 : rawScore),
          );

          let severityLabel: string = 'Moderado';
          let severityColor: string = colors.warning;

          if (normScore >= 0.85) {
            severityLabel = 'Alto';
            severityColor = colors.danger;
          } else if (normScore < 0.6) {
            severityLabel = 'Bajo';
            severityColor = colors.success;
          }

          const raw = item.valueCents ?? 0;
          const isDebit = raw < 0;
          const abs = Math.abs(raw);

          const title = item.merchant || item.description || 'Movimiento inusual';
          const date = fmtFecha(item.bookedAt);
          const categoryName = item.category?.name ?? 'Sin categoría';
          const amountFmt = fmtCLP(abs);

          return (
            <View style={s.card}>
              <Pressable onPress={() => router.push(`/movimiento/${item.id}`)}>
                <View style={s.rowHeader}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <View
                    style={[s.severityChip, { borderColor: severityColor }]}
                  >
                    <Text
                      style={[s.severityText, { color: severityColor }]}
                    >
                      {severityLabel}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    s.amount,
                    isDebit ? s.amountDebit : s.amountCredit,
                  ]}
                >
                  {isDebit ? '-' : '+'}
                  {amountFmt}
                </Text>

                <View style={s.rowMeta}>
                  <Text style={s.metaText}>{date}</Text>
                  <Text style={s.metaText}>{categoryName}</Text>
                </View>

                {item.anomalyScore !== null && (
                  <Text style={s.scoreText}>
                    Score de anomalía: {(normScore * 100).toFixed(1)}%
                  </Text>
                )}
              </Pressable>

              <View style={s.rowActions}>
                <Pressable
                  style={[
                    s.resolveBtn,
                    resolveMutation.isPending && s.resolveBtnDisabled,
                  ]}
                  onPress={() => handleResolve(item.id)}
                  disabled={resolveMutation.isPending}
                >
                  <Text style={s.resolveBtnText}>Marcar como revisado</Text>
                </Pressable>
              </View>
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
  },
  amountDebit: {
    color: colors.danger ?? '#ef4444',
  },
  amountCredit: {
    color: colors.success ?? '#22c55e',
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
  rowActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  resolveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  resolveBtnDisabled: {
    opacity: 0.6,
  },
  resolveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
