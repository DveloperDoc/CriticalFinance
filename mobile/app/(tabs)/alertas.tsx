// mobile/app/(tabs)/alertas.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  GestureHandlerRootView,
  Swipeable,
} from 'react-native-gesture-handler';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { fmtCLP, fmtFecha } from '@/utils/format';

type AlertPayload = {
  message?: string;
  categoryId?: string;
  categoryName?: string;
  isOver?: boolean;
  transactionId?: string;

  // extras posibles para reglas de ahorro
  accountId?: string;
  savingsRuleId?: string;
  saldoActual?: number;
  thresholdCents?: number;
  notifyMarginCents?: number;
};

type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL' | null;

type AlertType =
  | 'budget_over'
  | 'anomaly'
  | 'recurring_due'
  | 'savings_rule_threshold'
  | string;

type Alert = {
  id: string;
  type: AlertType;
  source: string;
  level?: AlertLevel;
  message?: string | null;
  payload: AlertPayload | null;
  createdAt: string;
  readAt: string | null;
  isActive?: boolean;

  // viene directo del backend (columna accountId del modelo Alert)
  accountId?: string | null;
};

// Mapeo de tipo técnico → título amigable
const TYPE_LABELS: Record<string, string> = {
  budget_over: 'Presupuesto sobrepasado',
  anomaly: 'Movimiento inusual',
  recurring_due: 'Pago recurrente próximo',
  savings_rule_threshold: 'Saldo bajo en tu cuenta',
};

type FilterType =
  | 'ALL'
  | 'budget_over'
  | 'savings_rule_threshold'
  | 'anomaly'
  | 'recurring_due';

export default function AlertasScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [filterType, setFilterType] = useState<FilterType>('ALL');

  const {
    data: alerts = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/active');
      return data as Alert[];
    },
    enabled: !!token,
    refetchOnMount: 'always',
  });

  // Mutación: marcar alerta como leída/resuelta (tap)
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/alerts/${id}/read`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previous = queryClient.getQueryData<Alert[]>(['alerts']);

      if (previous) {
        const nowIso = new Date().toISOString();
        const updated = previous.map((a) =>
          a.id === id ? { ...a, readAt: nowIso, isActive: false } : a,
        );
        queryClient.setQueryData<Alert[]>(
          ['alerts'],
          updated.filter((a) => a.isActive !== false),
        );
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['alerts'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Mutación: "eliminar" alerta (swipe) → realmente marcar como leída/resuelta
  const resolveAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/alerts/${id}/read`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previous = queryClient.getQueryData<Alert[]>(['alerts']);

      if (previous) {
        queryClient.setQueryData<Alert[]>(
          ['alerts'],
          previous.filter((a) => a.id !== id),
        );
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['alerts'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const goToMovimientosWithAccount = (accountId?: string | null) => {
    if (accountId) {
      router.push({
        pathname: '/(tabs)/movimientos',
        params: { accountId },
      } as any);
    } else {
      router.push('/(tabs)/movimientos');
    }
  };

  const handlePressAlert = (alert: Alert) => {
    if (!token) return;

    if (!alert.readAt && !markReadMutation.isPending) {
      markReadMutation.mutate(alert.id);
    }

    // Presupuesto / saldo bajo / pago recurrente → lista de movimientos de la cuenta
    if (
      alert.type === 'budget_over' ||
      alert.type === 'savings_rule_threshold' ||
      alert.type === 'recurring_due'
    ) {
      goToMovimientosWithAccount(alert.accountId ?? alert.payload?.accountId);
      return;
    }

    // Anomalía / gasto hormiga → idealmente detalle de movimiento, si tenemos transactionId
    if (alert.type === 'anomaly') {
      const txId = alert.payload?.transactionId;
      if (txId) {
        router.push(`/movimiento/${txId}`);
        return;
      }

      // fallback: ir a movimientos de la cuenta o a pantalla general de anomalías
      if (alert.accountId || alert.payload?.accountId) {
        goToMovimientosWithAccount(alert.accountId ?? alert.payload?.accountId);
      } else {
        router.push('/(tabs)/anomalias');
      }
      return;
    }
  };

  const renderLeftActions = () => (
    <View style={s.swipeAction}>
      <Text style={s.swipeActionText}>Resolver</Text>
    </View>
  );

  // ====== DERIVADOS: resumen + filtros ======

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.isActive !== false),
    [alerts],
  );

  const totals = useMemo(() => {
    const total = activeAlerts.length;
    const unread = activeAlerts.filter((a) => !a.readAt).length;
    const critical = activeAlerts.filter(
      (a) => a.level === 'CRITICAL' && a.isActive !== false,
    ).length;
    const warning = activeAlerts.filter(
      (a) => a.level === 'WARNING' && a.isActive !== false,
    ).length;

    return { total, unread, critical, warning };
  }, [activeAlerts]);

  const hasAny = activeAlerts.length > 0;

  const filteredAlerts = useMemo(() => {
    let list = activeAlerts;

    if (filterType !== 'ALL') {
      list = list.filter((a) => a.type === filterType);
    }

    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeAlerts, filterType]);

  if (!token) {
    return (
      <GestureHandlerRootView style={s.center}>
        <Text style={s.textMuted}>Inicia sesión para ver tus alertas.</Text>
      </GestureHandlerRootView>
    );
  }

  if (isLoading && !alerts.length) {
    return (
      <GestureHandlerRootView style={s.center}>
        <ActivityIndicator />
        <Text style={s.textMuted}>Cargando alertas…</Text>
      </GestureHandlerRootView>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error al cargar alertas';
    return (
      <GestureHandlerRootView style={s.center}>
        <Text style={s.err}>
          {status ? `${status} · ` : ''}
          {msg}
        </Text>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={s.screen}>
      <Text style={s.title}>Alertas</Text>

      {/* Resumen global */}
      {hasAny ? (
        <View style={s.summaryRow}>
          <Text style={s.summaryText}>
            Total: {totals.total} · No leídas: {totals.unread}
          </Text>
          {!!totals.critical && (
            <Text style={[s.summaryText, s.summaryCritical]}>
              Críticas: {totals.critical}
            </Text>
          )}
          {!!totals.warning && (
            <Text style={[s.summaryText, s.summaryWarning]}>
              Avisos: {totals.warning}
            </Text>
          )}
        </View>
      ) : (
        <Text style={[s.textMuted, { marginBottom: 8 }]}>
          No tienes alertas activas por ahora.
        </Text>
      )}

      {/* Filtros por tipo */}
      {hasAny && (
        <View style={s.filtersRow}>
          {renderFilterChip('ALL', 'Todas', filterType, setFilterType)}
          {renderFilterChip(
            'budget_over',
            'Presupuesto',
            filterType,
            setFilterType,
          )}
          {renderFilterChip(
            'savings_rule_threshold',
            'Reglas ahorro',
            filterType,
            setFilterType,
          )}
          {renderFilterChip(
            'recurring_due',
            'Pagos recurrentes',
            filterType,
            setFilterType,
          )}
          {renderFilterChip('anomaly', 'Anomalías', filterType, setFilterType)}
        </View>
      )}

      <FlatList
        data={filteredAlerts}
        keyExtractor={(a) => a.id}
        refreshing={
          isRefetching ||
          markReadMutation.isPending ||
          resolveAlertMutation.isPending
        }
        onRefresh={refetch}
        renderItem={({ item }) => {
          const friendlyTitle = TYPE_LABELS[item.type] ?? 'Alerta';
          const isUnread = !item.readAt;
          const level = item.level ?? null;

          let extraLine = '';
          if (item.type === 'budget_over') {
            const cat = item.payload?.categoryName ?? item.payload?.categoryId;
            if (cat && item.payload?.isOver) {
              extraLine = `La categoría "${cat}" superó su presupuesto.`;
            } else if (cat) {
              extraLine = `Alerta de presupuesto para la categoría "${cat}".`;
            }
          } else if (item.type === 'savings_rule_threshold') {
            const saldo = item.payload?.saldoActual;
            const th = item.payload?.thresholdCents;
            const margin = item.payload?.notifyMarginCents;

            if (typeof saldo === 'number' && typeof th === 'number') {
              const avisoDesde =
                typeof margin === 'number' ? th + margin : null;
              extraLine = `Saldo actual: ${fmtCLP(saldo)} · Mínimo: ${fmtCLP(
                th,
              )}`;
              if (avisoDesde !== null) {
                extraLine += ` · Aviso desde: ${fmtCLP(avisoDesde)}`;
              }
            }
          } else if (item.type === 'anomaly') {
            if (item.payload?.transactionId) {
              extraLine =
                'Se detectó un movimiento inusual en tus transacciones.';
            }
          } else if (item.type === 'recurring_due') {
            extraLine =
              'Tienes un pago recurrente próximo a vencer en los próximos días.';
          }

          const createdLabel = fmtFecha(item.createdAt);

          return (
            <Swipeable
              renderLeftActions={renderLeftActions}
              onSwipeableOpen={(direction) => {
                if (direction === 'left' && !resolveAlertMutation.isPending) {
                  resolveAlertMutation.mutate(item.id);
                }
              }}
            >
              <Pressable
                style={[s.card, !isUnread && s.cardRead]}
                onPress={() => handlePressAlert(item)}
              >
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.type}>{friendlyTitle}</Text>
                    {level && (
                      <Text
                        style={[
                          s.levelText,
                          level === 'CRITICAL' && s.levelCritical,
                          level === 'WARNING' && s.levelWarning,
                        ]}
                      >
                        {level === 'CRITICAL'
                          ? 'Crítica'
                          : level === 'WARNING'
                          ? 'Advertencia'
                          : 'Info'}
                      </Text>
                    )}
                  </View>
                  {isUnread && <View style={s.unreadDot} />}
                </View>

                <Text style={s.message}>
                  {item.message ?? item.payload?.message ?? 'Sin mensaje'}
                </Text>

                {extraLine ? (
                  <Text style={s.extraLine}>{extraLine}</Text>
                ) : null}

                <Text style={s.date}>{createdLabel}</Text>
              </Pressable>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          hasAny ? (
            <Text style={s.textMuted}>
              No hay alertas para este filtro.
            </Text>
          ) : null
        }
      />
    </GestureHandlerRootView>
  );
}

// Helpers UI

function renderFilterChip(
  value: FilterType,
  label: string,
  current: FilterType,
  setFilter: (v: FilterType) => void,
) {
  const selected = current === value;
  return (
    <Pressable
      key={value}
      style={[s.chip, selected && s.chipSelected]}
      onPress={() => setFilter(value)}
    >
      <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },

  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  summaryCritical: {
    color: colors.danger ?? '#ef4444',
    fontWeight: '600',
  },
  summaryWarning: {
    color: colors.warning ?? '#facc15',
    fontWeight: '600',
  },

  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 12,
    color: colors.text,
  },
  chipLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  card: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardRead: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  type: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  levelText: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },
  levelCritical: {
    color: colors.danger ?? '#ef4444',
    fontWeight: '700',
  },
  levelWarning: {
    color: colors.warning ?? '#facc15',
    fontWeight: '600',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 2,
  },
  message: {
    color: colors.text,
    fontSize: 14,
    marginTop: 4,
  },
  extraLine: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  date: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
  },
  textMuted: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  err: {
    color: colors.danger ?? '#ef4444',
    textAlign: 'center',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    backgroundColor: colors.danger ?? '#ef4444',
    marginBottom: 10,
    borderRadius: 12,
  },
  swipeActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
