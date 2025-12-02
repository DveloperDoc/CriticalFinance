// mobile/app/(tabs)/alertas.tsx
import React from 'react';
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
  transactionId?: string; // para anomalías, si aplica

  // extras posibles para reglas de ahorro
  accountId?: string;
  savingsRuleId?: string;
  saldoActual?: number;
  thresholdCents?: number;
  notifyMarginCents?: number;
};

type Alert = {
  id: string;
  type: string;
  source: string;
  level?: 'INFO' | 'WARNING' | 'CRITICAL' | null;
  message?: string | null;
  payload: AlertPayload | null;
  createdAt: string;
  readAt: string | null;
  isActive?: boolean;
};

// Mapeo de tipo técnico → título amigable
const TYPE_LABELS: Record<string, string> = {
  budget_over: 'Presupuesto sobrepasado',
  anomaly: 'Movimiento inusual',
  recurring_due: 'Pago recurrente próximo',
  savings_rule_threshold: 'Saldo bajo en tu cuenta',
};

export default function AlertasScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: alerts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      // ahora usamos el endpoint de savings (solo alertas activas)
      const { data } = await api.get('/savings/alerts/active');
      return data as Alert[];
    },
    enabled: !!token,
    refetchOnMount: 'always',
  });

  // Mutación: marcar alerta como leída/resuelta (tap)
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      // nuevo endpoint: PATCH /savings/alerts/:id/read sin body
      await api.patch(`/savings/alerts/${id}/read`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previous = queryClient.getQueryData<Alert[]>(['alerts']);

      if (previous) {
        const nowIso = new Date().toISOString();
        // la marcamos como leída/inactiva en cache
        const updated = previous.map((a) =>
          a.id === id ? { ...a, readAt: nowIso, isActive: false } : a,
        );
        // como la query trae solo activas, la podemos sacar de inmediato
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
      await api.patch(`/savings/alerts/${id}/read`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previous = queryClient.getQueryData<Alert[]>(['alerts']);

      if (previous) {
        // simplemente la retiramos de la lista de activas
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

  const handlePressAlert = (alert: Alert) => {
    if (!token) return;

    // marcar como leída si aún no lo está
    if (!alert.readAt && !markReadMutation.isPending) {
      markReadMutation.mutate(alert.id);
    }

    // navegación según tipo de alerta
    if (alert.type === 'budget_over') {
      router.push('/(tabs)/ahorro');
      return;
    }

    if (alert.type === 'anomaly') {
      const txId = alert.payload?.transactionId;
      if (txId) {
        router.push(`/movimiento/${txId}`);
      } else {
        router.push('/(tabs)/anomalias');
      }
      return;
    }

    if (alert.type === 'savings_rule_threshold') {
      router.push('/(tabs)/ahorro');
      return;
    }
  };

  const renderLeftActions = () => (
    <View style={s.swipeAction}>
      <Text style={s.swipeActionText}>Resolver</Text>
    </View>
  );

  if (!token) {
    return (
      <GestureHandlerRootView style={s.center}>
        <Text style={s.textMuted}>Inicia sesión para ver tus alertas.</Text>
      </GestureHandlerRootView>
    );
  }

  if (isLoading) {
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

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        refreshing={false}
        onRefresh={refetch}
        renderItem={({ item }) => {
          const friendlyTitle = TYPE_LABELS[item.type] ?? 'Alerta';
          const isUnread = !item.readAt;
          const level = item.level ?? null;

          // Línea extra según tipo de alerta
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
          }

          const createdLabel = fmtFecha(item.createdAt);

          return (
            <Swipeable
              renderLeftActions={renderLeftActions}
              onSwipeableOpen={(direction) => {
                // swipe derecha → lado izquierdo ("left")
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
          <Text style={s.textMuted}>No tienes alertas activas por ahora.</Text>
        }
      />
    </GestureHandlerRootView>
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
    marginBottom: 12,
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
