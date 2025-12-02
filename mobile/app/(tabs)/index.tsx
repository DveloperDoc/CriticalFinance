// app/(tabs)/index.tsx
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';

import { colors } from '@/theme';
import { fmtCLP } from '@/utils/format';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { MlSummaryCard } from '@/components/MlSummaryCard';

type Category = { id: string; name: string; color?: string | null } | null;

type Tx = {
  id: string;
  merchant?: string | null;
  description?: string | null;
  valueCents: number;
  category?: Category;
  bookedAt: string; // ISO
};

type MeAccount = {
  id: string;
  alias: string | null;
  bank: string | null;
  accountNumber: string | null;
  currency: string;
  balanceCents: number;
};

type Me = { id: string; email: string; accounts: MeAccount[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

const normalizeMe = (raw: any): Me => {
  if (!raw) return { id: '', email: '', accounts: [] };

  const base = raw?.data ?? raw;

  return {
    id: base?.id ?? '',
    email: base?.email ?? '',
    accounts: Array.isArray(base?.accounts) ? (base.accounts as MeAccount[]) : [],
  };
};

const normalizeTx = (raw: any): Tx[] => {
  if (Array.isArray(raw)) return raw as Tx[];
  if (Array.isArray(raw?.items)) return raw.items as Tx[];
  if (Array.isArray(raw?.data)) return raw.data as Tx[];
  if (Array.isArray(raw?.transactions)) return raw.transactions as Tx[];
  return [];
};

export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();

  // /me
  const meQ = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => normalizeMe((await api.get('/me')).data),
    enabled: !!token,
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  const accId = meQ.data?.accounts?.[0]?.id ?? null;

  // cuenta principal (si existe)
  const currentAccount: MeAccount | null =
    accId && meQ.data?.accounts
      ? meQ.data.accounts.find((a) => a.id === accId) ?? null
      : null;

  const accountLabel =
    currentAccount?.alias ||
    currentAccount?.bank ||
    (currentAccount?.accountNumber
      ? `Cuenta ${currentAccount.accountNumber}`
      : accId
      ? `Cuenta ${accId.slice(0, 6)}…`
      : 'Cuenta principal');

  // rango últimos 6 meses
  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const txQ = useQuery<Tx[]>({
    queryKey: ['transactions', accId, from, to],
    queryFn: async () => {
      const { data } = await api.get('/transactions', {
        params: { accountId: accId, from, to },
      });
      return normalizeTx(data);
    },
    enabled: !!token && !!accId,
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  // anomalías para mostrar contador en Home
  const {
    data: anomalies = [],
    isLoading: anomaliesLoading,
    isError: anomaliesError,
    isRefetching: anomaliesRefetching,
    refetch: anomaliesRefetch,
  } = useQuery<{ id: string }[]>({
    queryKey: ['transactions', 'anomalies', 'home', accId],
    queryFn: async () => {
      const { data } = await api.get('/transactions/anomalies', {
        params: accId ? { accountId: accId } : undefined,
      });
      return data as { id: string }[];
    },
    enabled: !!token && !!accId,
    staleTime: 60_000,
    refetchOnMount: 'always',
  });

  const anomaliesCount = anomalies.length;

  const {
    balance,
    gasto30d,
    serieMensual,
    catShare30d,
    savingsRate,
    spendThisMonth,
    spendPrevMonth,
    trendDelta,
    trendPct,
    trendDirection,
  } = useMemo(() => {
    const list = txQ.data ?? [];
    const ahora = new Date();
    const last30 = new Date(ahora);
    last30.setDate(last30.getDate() - 30);

    let bal = 0;
    let gasto = 0;
    let ingresos30d = 0;

    // buckets por mes (6 meses)
    const bucketsMes = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const k = d.toLocaleDateString('es-CL', {
        month: 'short',
        year: '2-digit',
      });
      bucketsMes.set(k, 0);
    }

    // gasto por categoría últimos 30 días
    const bucketsCat30d = new Map<string, number>();

    for (const t of list) {
      const when = new Date(t.bookedAt);
      const cents = Number(t.valueCents) || 0;

      // saldo neto (puede quedar negativo)
      bal += cents;

      // línea de gasto por mes (solo débitos)
      const kMes = new Date(
        when.getFullYear(),
        when.getMonth(),
        1,
      ).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });

      if (bucketsMes.has(kMes) && cents < 0) {
        bucketsMes.set(kMes, (bucketsMes.get(kMes) || 0) + Math.abs(cents));
      }

      // últimos 30 días: gastos e ingresos
      if (when >= last30) {
        if (cents < 0) {
          gasto += Math.abs(cents);
          const catName = t.category?.name ?? 'Sin categoría';
          bucketsCat30d.set(
            catName,
            (bucketsCat30d.get(catName) || 0) + Math.abs(cents),
          );
        } else if (cents > 0) {
          ingresos30d += cents;
        }
      }
    }

    const serie = Array.from(bucketsMes.entries()).map(([label, cents]) => ({
      label,
      value: cents,
    }));

    const catSerie = Array.from(bucketsCat30d.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const catShare =
      gasto > 0
        ? catSerie.map((c) => ({
            label: c.label,
            value: c.value,
            pct: c.value / gasto,
          }))
        : [];

    const savings = ingresos30d > 0 ? Math.max(0, ingresos30d - gasto) : 0;
    const savingsRate = ingresos30d > 0 ? savings / ingresos30d : null;

    const spendThisMonth = serie.length ? serie[serie.length - 1].value : 0;
    const spendPrevMonth = serie.length > 1 ? serie[serie.length - 2].value : 0;

    const trendDelta = spendThisMonth - spendPrevMonth;
    const trendPct = spendPrevMonth > 0 ? trendDelta / spendPrevMonth : null;

    let trendDirection: 'up' | 'down' | 'flat' = 'flat';
    if (trendPct !== null && Math.abs(trendPct) > 0.02) {
      trendDirection = trendPct > 0 ? 'up' : 'down';
    }

    return {
      balance: bal,
      gasto30d: gasto,
      serieMensual: serie,
      catShare30d: catShare,
      savingsRate,
      spendThisMonth,
      spendPrevMonth,
      trendDelta,
      trendPct,
      trendDirection,
    };
  }, [txQ.data]);

  // saldo real de la cuenta (desde backend) con fallback al neto calculado
  const accountBalance = currentAccount?.balanceCents ?? balance ?? 0;

  // estados globales
  if (!token) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.cardSub}>No autenticado</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (meQ.isLoading || txQ.isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.cardSub}>Cargando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (meQ.isError || txQ.isError) {
    const err = (meQ.error as any) ?? (txQ.error as any);
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.message || 'Error';
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.err}>
            {status ? `${status} · ` : ''}
            {msg}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accId) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.cardSub}>Tu usuario aún no tiene cuentas asociadas.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const refreshing = meQ.isRefetching || txQ.isRefetching || anomaliesRefetching;

  // textos para la tendencia
  let trendLabel = 'Sin datos suficientes';
  if (trendPct !== null) {
    const pctAbs = Math.abs(trendPct * 100).toFixed(1);
    if (trendDirection === 'down') {
      trendLabel = `Gastaste ${pctAbs}% MENOS que el mes pasado`;
    } else if (trendDirection === 'up') {
      trendLabel = `Gastaste ${pctAbs}% MÁS que el mes pasado`;
    } else {
      trendLabel = 'Gasto muy similar al mes pasado';
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              meQ.refetch();
              txQ.refetch();
              anomaliesRefetch();
            }}
            tintColor={colors.text}
          />
        }
      >
        {/* Header usuario */}
        <View style={s.headerBlock}>
          <Text style={s.hello}>Hola,</Text>
          <Text style={s.user}>{meQ.data?.email ?? 'Usuario'}</Text>
          <Text style={s.account}>Cuenta principal: {accountLabel}</Text>
        </View>

        {/* IA Summary */}
        <MlSummaryCard />

        {/* Bloque de anomalías */}
        <View style={[s.card, { marginHorizontal: 16, marginTop: 8 }]}>
          <View style={s.iaRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.iaLabel}>Movimientos inusuales</Text>
              {anomaliesLoading ? (
                <Text style={s.iaSubText}>Cargando…</Text>
              ) : anomaliesError ? (
                <Text style={s.iaSubText}>No se pudieron cargar</Text>
              ) : (
                <Text style={s.iaValue}>
                  {anomaliesCount === 0
                    ? 'Sin anomalías detectadas'
                    : `${anomaliesCount} detectado${
                        anomaliesCount > 1 ? 's' : ''
                      } por la IA`}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                s.iaButton,
                (anomaliesLoading || anomaliesCount === 0) && { opacity: 0.6 },
              ]}
              disabled={anomaliesLoading || anomaliesCount === 0}
              onPress={() => router.navigate('/(tabs)/anomalias')}
              activeOpacity={0.85}
            >
              <Text style={s.iaButtonText}>Ver inusuales</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIs principales */}
        <View style={s.cardsRow}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Saldo cuenta</Text>
            <Text
              style={[
                s.cardValueBig,
                accountBalance < 0 && { color: colors.danger },
              ]}
            >
              {fmtCLP(accountBalance)}
            </Text>
            <Text style={s.cardSub}>Saldo reportado por tu banco.</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Gasto 30 días</Text>
            <Text style={[s.cardValueBig, { color: colors.danger }]}>
              {fmtCLP(gasto30d ?? 0)}
            </Text>
            <Text style={s.cardSub}>Solo débitos de los últimos 30 días.</Text>
          </View>
        </View>

        {/* KPI tasa de ahorro */}
        <View style={[s.card, { marginHorizontal: 16, marginTop: 8 }]}>
          <Text style={s.cardTitle}>Tasa de ahorro (30 días)</Text>
          <Text
            style={[
              s.cardValue,
              (savingsRate ?? 0) > 0 && { color: colors.success },
            ]}
          >
            {savingsRate === null
              ? 'Sin datos de ingresos'
              : `${(savingsRate * 100).toFixed(1)} %`}
          </Text>
          <Text style={s.cardSub}>
            Calculado como (ingresos − gastos) / ingresos de los últimos 30 días.
          </Text>
        </View>

        {/* Gasto por mes: gráfico lineal estilo app financiera */}
        <View style={s.chartCard}>
          <View style={s.chartHeaderRow}>
            <View>
              <Text style={s.sectionTitle}>Tendencia de gasto (6 meses)</Text>
              <Text style={s.chartFoot}>
                Se muestra el gasto total por mes. Tramo verde = bajaste gasto, rojo =
                subiste.
              </Text>
            </View>
            <View
              style={[
                s.trendChip,
                trendDirection === 'down' && { borderColor: colors.success },
                trendDirection === 'up' && { borderColor: colors.danger },
              ]}
            >
              <Text
                style={[
                  s.trendChipText,
                  trendDirection === 'down' && { color: colors.success },
                  trendDirection === 'up' && { color: colors.danger },
                ]}
              >
                {trendLabel}
              </Text>
            </View>
          </View>

          <LineChartSpending serie={serieMensual ?? []} />
          <View style={s.chartInlineKpis}>
            <View>
              <Text style={s.chartMiniLabel}>Este mes</Text>
              <Text style={s.chartMiniValue}>{fmtCLP(spendThisMonth ?? 0)}</Text>
            </View>
            <View>
              <Text style={s.chartMiniLabel}>Mes anterior</Text>
              <Text style={s.chartMiniValue}>{fmtCLP(spendPrevMonth ?? 0)}</Text>
            </View>
          </View>
        </View>

        {/* Distribución de gasto por categoría */}
        <View style={s.chartCard}>
          <Text style={s.sectionTitle}>¿En qué se va tu sueldo? (30 días)</Text>
          {catShare30d.length === 0 ? (
            <Text style={s.cardSub}>No hay gastos en los últimos 30 días.</Text>
          ) : (
            <View style={s.shareList}>
              {catShare30d.map((c) => (
                <View key={c.label} style={s.shareRow}>
                  <View style={s.shareHeader}>
                    <Text style={s.shareLabel}>{c.label}</Text>
                    <Text style={s.sharePct}>{(c.pct * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={s.shareBarBg}>
                    <View
                      style={[
                        s.shareBarFill,
                        { width: `${Math.max(5, c.pct * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={s.shareAmount}>{fmtCLP(c.value)}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={s.chartFoot}>
            Porcentaje calculado sobre el total gastado (débitos) de los últimos 30
            días.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Gráfico lineal PRO con tramos verdes y rojos */
function LineChartSpending({
  serie,
}: {
  serie: { label: string; value: number }[];
}) {
  const [width, setWidth] = React.useState(0);
  const height = 140;
  const paddingX = 16;
  const paddingY = 20;

  if (!serie || serie.length === 0) {
    return (
      <View
        style={[
          s.lineChartContainer,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Text style={s.cardSub}>Sin datos</Text>
      </View>
    );
  }

  const max = Math.max(1, ...serie.map((d) => Number(d.value) || 0));

  return (
    <View
      style={s.lineChartContainer}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
      }}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {(() => {
            const usableWidth = width - paddingX * 2;
            const usableHeight = height - paddingY * 2;

            const points = serie.map((d, idx) => {
              const v = Number(d.value) || 0;
              const x =
                paddingX +
                (serie.length === 1
                  ? usableWidth / 2
                  : (usableWidth * idx) / (serie.length - 1));
              const y =
                paddingY +
                (max === 0
                  ? usableHeight / 2
                  : usableHeight - (v / max) * usableHeight);
              return { x, y, value: v };
            });

            const segments = [];
            for (let i = 0; i < points.length - 1; i++) {
              const p1 = points[i];
              const p2 = points[i + 1];

              const trendingUp = p2.value > p1.value;
              const trendingDown = p2.value < p1.value;

              const segColor = trendingUp
                ? colors.danger ?? '#ef4444'
                : trendingDown
                ? colors.success ?? '#22c55e'
                : colors.textMuted;

              segments.push({
                x1: p1.x,
                y1: p1.y,
                x2: p2.x,
                y2: p2.y,
                segColor,
              });
            }

            return (
              <>
                {segments.map((seg, idx) => (
                  <Polyline
                    key={idx}
                    points={`${seg.x1},${seg.y1} ${seg.x2},${seg.y2}`}
                    fill="none"
                    stroke={seg.segColor}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                ))}

                {points.map((p, idx) => (
                  <Circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill={colors.bg}
                    stroke={colors.primary}
                    strokeWidth={1.5}
                  />
                ))}
              </>
            );
          })()}
        </Svg>
      )}

      {/* etiquetas inferiores */}
      <View style={s.lineChartLabelsRow}>
        {serie.map((d) => (
          <Text key={d.label} style={s.lineChartLabel}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.bg,
  },

  // header usuario
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  hello: {
    color: colors.textMuted,
    fontSize: 12,
  },
  user: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  account: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // KPIs
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  cardValueBig: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  cardValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  cardSub: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 12,
  },

  // tarjeta anomalías / IA
  iaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iaLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  iaSubText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  iaValue: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  iaButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  iaButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // tarjetas de gráficos
  chartCard: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  chartFoot: {
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 11,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  trendChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.textMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '55%',
    flexShrink: 1,
  },
  trendChipText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  chartInlineKpis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  chartMiniLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  chartMiniValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // line chart
  lineChartContainer: {
    marginTop: 8,
    paddingTop: 4,
  },
  lineChartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  lineChartLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // “torta” → barras horizontales por categoría
  shareList: {
    gap: 10,
  },
  shareRow: {
    marginBottom: 2,
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  sharePct: {
    color: colors.textMuted,
    fontSize: 12,
  },
  shareBarBg: {
    marginTop: 4,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  shareBarFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  shareAmount: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },

  err: {
    color: colors.danger,
    textAlign: 'center',
  },
});
