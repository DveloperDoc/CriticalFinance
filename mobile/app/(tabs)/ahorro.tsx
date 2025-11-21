// app/(tabs)/ahorro.tsx
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { colors } from '@/theme';
import { fmtCLP } from '@/utils/format';

type SavingsRule = {
  id: string;
  userId: string;
  accountId: string;
  thresholdCents: number;
  notifyMarginCents?: number | null;
  active: boolean;
  createdAt: string;
  account?: {
    id: string;
    bank: string;
    accountType: string;
    accountNumber: string;
    alias?: string | null;
    balanceCents: number;
    currency: string;
  };
};

type Alert = {
  id: string;
  userId: string;
  transactionId?: string | null;
  type: 'budget_over' | 'anomaly' | 'recurring_due';
  payload: any;
  createdAt: string;
  readAt?: string | null;
};

export default function SavingsScreen() {
  // 1) Reglas de ahorro
  const rulesQ = useQuery<SavingsRule[]>({
    queryKey: ['savings', 'rules'],
    queryFn: async () => {
      const { data } = await api.get('/savings/rules');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  // 2) Alertas
  const alertsQ = useQuery<Alert[]>({
    queryKey: ['savings', 'alerts'],
    queryFn: async () => {
      const { data } = await api.get('/savings/alerts');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const loading = rulesQ.isLoading || alertsQ.isLoading;
  const error = (rulesQ.error as any) ?? (alertsQ.error as any) ?? null;

  const mainRule = useMemo(() => {
    const list = rulesQ.data ?? [];
    return list[0] ?? null;
  }, [rulesQ.data]);

  const kpi = useMemo(() => {
    if (!mainRule || !mainRule.account) {
      return {
        balance: 0,
        threshold: 0,
        margin: 0,
        belowThreshold: false,
      };
    }
    const balance = mainRule.account.balanceCents;
    const threshold = mainRule.thresholdCents;
    const marginLimit =
      threshold + (mainRule.notifyMarginCents ?? 0);
    const belowThreshold = balance <= marginLimit;
    const margin = Math.max(0, balance - threshold);

    return { balance, threshold, margin, belowThreshold };
  }, [mainRule]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.muted}>Cargando ahorro…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message || error?.message || 'Error';
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.error}>
            {status ? `${status} · ` : ''}
            {msg}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Resumen principal de la regla */}
      <View style={s.card}>
        <Text style={s.title}>Ahorro y umbral</Text>

        {mainRule && mainRule.account ? (
          <>
            <Text style={s.label}>
              Cuenta:{' '}
              <Text style={s.value}>
                {mainRule.account.alias || mainRule.account.bank}{' '}
                · {mainRule.account.accountType}
              </Text>
            </Text>

            <Text style={s.label}>
              Saldo actual:{' '}
              <Text
                style={[
                  s.valueStrong,
                  kpi.belowThreshold && { color: colors.danger },
                ]}
              >
                {fmtCLP(kpi.balance)}
              </Text>
            </Text>

            <Text style={s.label}>
              Umbral definido:{' '}
              <Text style={s.value}>{fmtCLP(kpi.threshold)}</Text>
            </Text>

            {mainRule.notifyMarginCents != null && (
              <Text style={s.label}>
                Margen de aviso:{' '}
                <Text style={s.value}>
                  {fmtCLP(mainRule.notifyMarginCents)}
                </Text>
              </Text>
            )}

            <Text style={s.label}>
              Margen sobre umbral:{' '}
              <Text style={s.value}>
                {kpi.margin > 0 ? fmtCLP(kpi.margin) : 'En zona de riesgo'}
              </Text>
            </Text>

            {kpi.belowThreshold && (
              <Text style={[s.muted, { marginTop: 6, color: colors.danger }]}>
                Tu saldo está por debajo del umbral + margen definido. Es buen
                momento para revisar tus gastos.
              </Text>
            )}
          </>
        ) : (
          <Text style={s.muted}>
            Aún no tienes reglas de ahorro configuradas para tus cuentas.
          </Text>
        )}
      </View>

      {/* Lista de reglas (si en el futuro hay más de una) */}
      <View style={s.card}>
        <Text style={s.subtitle}>Reglas configuradas</Text>
        {rulesQ.data && rulesQ.data.length > 0 ? (
          <FlatList
            data={rulesQ.data}
            keyExtractor={(r) => r.id}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item }) => (
              <View style={s.ruleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ruleTitle}>
                    {item.account?.alias || item.account?.bank || 'Cuenta'}
                  </Text>
                  <Text style={s.ruleLine}>
                    Umbral: {fmtCLP(item.thresholdCents)}
                  </Text>
                  {item.notifyMarginCents != null && (
                    <Text style={s.ruleLine}>
                      Aviso a:{' '}
                      {fmtCLP(
                        item.thresholdCents + item.notifyMarginCents,
                      )}
                    </Text>
                  )}
                </View>
                <View style={s.ruleBadge}>
                  <Text style={s.ruleBadgeText}>
                    {item.active ? 'Activa' : 'Inactiva'}
                  </Text>
                </View>
              </View>
            )}
          />
        ) : (
          <Text style={s.muted}>
            No hay reglas creadas todavía. Puedes crear una desde la API por ahora.
          </Text>
        )}
      </View>

      {/* Alertas */}
      <View style={s.cardLast}>
        <Text style={s.subtitle}>Alertas recientes</Text>
        {alertsQ.data && alertsQ.data.length > 0 ? (
          <FlatList
            data={alertsQ.data}
            keyExtractor={(a) => a.id}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item }) => (
              <View style={s.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>
                    {humanAlertTitle(item)}
                  </Text>
                  <Text style={s.alertText}>
                    {humanAlertBody(item)}
                  </Text>
                  <Text style={s.alertDate}>
                    {new Date(item.createdAt).toLocaleString('es-CL')}
                  </Text>
                </View>
              </View>
            )}
          />
        ) : (
          <Text style={s.muted}>
            No se han generado alertas todavía.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function humanAlertTitle(a: Alert): string {
  switch (a.type) {
    case 'budget_over':
      return 'Alerta de umbral de saldo';
    case 'anomaly':
      return 'Gasto inusual detectado';
    case 'recurring_due':
      return 'Cargo recurrente próximo';
    default:
      return 'Alerta';
  }
}

function humanAlertBody(a: Alert): string {
  const p = a.payload ?? {};
  if (a.type === 'budget_over') {
    const bal = typeof p.balanceCents === 'number' ? p.balanceCents : 0;
    const thr = typeof p.thresholdCents === 'number' ? p.thresholdCents : 0;
    return `Tu saldo (${fmtCLP(bal)}) está en zona de alerta respecto al umbral (${fmtCLP(
      thr,
    )}).`;
  }
  if (a.type === 'anomaly') {
    const amt = typeof p.amountCents === 'number' ? p.amountCents : 0;
    const merch = p.merchant ?? 'Transacción';
    return `${merch} por ${fmtCLP(
      amt,
    )} parece inusual respecto a tu historial.`;
  }
  if (a.type === 'recurring_due') {
    const merch = p.merchant ?? 'Cargo recurrente';
    return `${merch} se aproxima según tu patrón de pagos.`;
  }
  return 'Revisa los detalles de esta alerta en tu historial de movimientos.';
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardLast: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  value: {
    color: colors.text,
    fontWeight: '600',
  },
  valueStrong: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  muted: {
    fontSize: 12,
    color: colors.textMuted,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ruleTitle: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  ruleLine: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ruleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ruleBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  alertRow: {
    paddingVertical: 4,
  },
  alertTitle: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  alertText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  alertDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
