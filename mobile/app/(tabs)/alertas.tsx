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
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

type Alert = {
  id: string;
  type: string;
  source: string;
  payload: { message?: string };
  createdAt: string;
  readAt: string | null;
};

// Mapeo de tipo técnico → título amigable
const TYPE_LABELS: Record<string, string> = {
  budget_over: 'Presupuesto sobrepasado',
  anomaly: 'Movimiento inusual',
  recurring_due: 'Pago recurrente próximo',
};

export default function AlertasScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: alerts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await api.get('/alerts');
      return data as Alert[];
    },
    enabled: !!token,
    refetchOnMount: 'always',
  });

  // Mutación: marcar alerta como leída
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/alerts/${id}/read`);
    },
    onSuccess: () => {
      // refrescamos lista y badge
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const handlePressAlert = (alert: Alert) => {
    if (!alert.readAt && !markReadMutation.isPending) {
      markReadMutation.mutate(alert.id);
    }
    // aquí en futuro podrías navegar a un detalle si quieres
  };

  if (!token) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>Inicia sesión para ver tus alertas.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.textMuted}>Cargando alertas…</Text>
      </View>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error al cargar alertas';
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
      <Text style={s.title}>Alertas</Text>

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        refreshing={false}
        onRefresh={refetch}
        renderItem={({ item }) => {
          const friendlyTitle = TYPE_LABELS[item.type] ?? 'Alerta';
          const isUnread = !item.readAt;

          return (
            <Pressable
              style={[s.card, !isUnread && s.cardRead]}
              onPress={() => handlePressAlert(item)}
            >
              <View style={s.row}>
                <Text style={s.type}>{friendlyTitle}</Text>
                {isUnread && <View style={s.unreadDot} />}
              </View>

              <Text style={s.message}>
                {item.payload?.message ?? 'Sin mensaje'}
              </Text>

              <Text style={s.date}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={s.textMuted}>No tienes alertas por ahora.</Text>
        }
      />
    </View>
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
    alignItems: 'center',
  },
  type: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  message: {
    color: colors.text,
    fontSize: 14,
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
});
