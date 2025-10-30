import React, { useMemo } from 'react';
import {
  View, Text, ActivityIndicator, RefreshControl,
  FlatList, StyleSheet, Pressable
} from 'react-native';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { colors } from '@/theme';
import { fmtCLP, fmtFecha } from '@/utils/format';
import AppHeader from '@/components/AppHeader';

const API_URL = 'http://10.0.2.2:3000/transactions';

type Category = { id: string; name: string; color?: string | null } | null;
type Tx = {
  id: string;
  merchant?: string | null;
  description?: string | null;
  valueCents: number;
  category?: Category;
  bookedAt: string;
  anomalyScore?: number | null;
};

function useKpis(data?: Tx[]) {
  return useMemo(() => {
    if (!data?.length) return { saldo: 0, gastado: 0 };
    let saldo = 0, gastado = 0;
    for (const t of data) {
      saldo += t.valueCents;
      if (t.valueCents < 0) gastado += Math.abs(t.valueCents);
    }
    return { saldo, gastado };
  }, [data]);
}

export default function Movimientos() {
  const router = useRouter();

  const { data, isLoading, isRefetching, error, refetch } = useQuery<Tx[]>({
    queryKey: ['transactions', { take: 50 }],
    queryFn: async () => (await axios.get(API_URL, { params: { take: 50 } })).data as Tx[],
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const kpis = useKpis(data);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.error}>Error al cargar movimientos</Text>
      </View>
    );
  }
  if (!data?.length) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Sin movimientos</Text>
        <Text style={s.mutedSmall}>Intenta actualizar o cambia el rango de fechas</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={data}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      }
      ListHeaderComponent={
        <>
          {/* ✅ ÚNICO header */}
          <AppHeader title="CriticalFinance" showChips />

          {/* KPIs */}
          <View style={s.header}>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Monto Actual</Text>
              <Text style={[s.kpiValue, kpis.saldo < 0 && { color: colors.danger }]}>
                {fmtCLP(kpis.saldo)}
              </Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Monto Gastado</Text>
              <Text style={[s.kpiValue, { color: colors.danger }]}>{fmtCLP(kpis.gastado)}</Text>
            </View>

            <Text style={s.sectionTitle}>Últimos gastos</Text>
          </View>
        </>
      }
      ItemSeparatorComponent={() => <View style={s.sep} />}
      renderItem={({ item }) => (
        <TxRow
          tx={item}
          onPress={() => router.push(`/(tabs)/movimiento/${item.id}`)}
        />
      )}
      contentContainerStyle={{ paddingBottom: 32 }}
    />
  );
}

function TxRow({ tx, onPress }: { tx: Tx; onPress: () => void }) {
  const isDebit = tx.valueCents < 0;
  const colorMonto = isDebit ? colors.danger : colors.success;
  const catColor = tx.category?.color ?? colors.textMuted;
  const showAlert = (tx.anomalyScore ?? 0) >= 0.8;

  return (
    <Pressable onPress={onPress} style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.merchant}>{tx.merchant ?? '—'}</Text>

        <Text style={s.meta} numberOfLines={2}>
          {tx.category?.name ? (
            <>
              <Text style={[s.cat, { color: catColor }]}>{tx.category.name}</Text>
              <Text style={s.meta}> · </Text>
            </>
          ) : null}
          <Text style={s.meta}>{tx.description ?? '—'}</Text>
        </Text>

        <Text style={s.date}>{fmtFecha(tx.bookedAt)}</Text>
        <Text style={s.detalleLink}>Detalles</Text>
      </View>

      <View style={s.amountCol}>
        {showAlert && <Text style={s.badge}>ALERTA</Text>}
        <Text style={[s.amount, { color: colorMonto }]}>{fmtCLP(tx.valueCents)}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger },
  muted: { color: colors.textMuted, fontSize: 15 },
  mutedSmall: { color: colors.textMuted, fontSize: 12, marginTop: 6 },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  kpi: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  kpiLabel: { color: colors.textMuted, marginBottom: 6 },
  kpiValue: { color: colors.text, fontSize: 22, fontWeight: 'bold' },
  sectionTitle: { color: colors.text, fontWeight: 'bold', marginTop: 6, marginBottom: 6 },

  sep: { height: 1, backgroundColor: colors.line, marginLeft: 16 },

  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    marginHorizontal: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  merchant: { color: colors.text, fontWeight: '600', marginBottom: 2 },
  meta: { color: colors.textMuted },
  cat: { fontWeight: '600' },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  detalleLink: { color: colors.primary, marginTop: 4, fontSize: 12 },

  amountCol: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 90, marginLeft: 10 },
  amount: { fontWeight: 'bold', fontSize: 16 },

  badge: {
    backgroundColor: colors.chipBg,
    color: colors.chip,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    marginBottom: 6,
  },
});