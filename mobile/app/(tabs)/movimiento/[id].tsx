import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '@/theme';
import { fmtCLP, fmtFecha } from '@/utils/format';
import { api } from '@/utils/api';

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

// busca en todas las queries que empiecen con 'transactions'
function findTxInCache(qc: ReturnType<typeof useQueryClient>, id?: string): Tx | undefined {
  if (!id) return undefined;
  const all = qc.getQueriesData<Tx[]>({ queryKey: ['transactions'] });
  for (const [, data] of all) {
    const list = Array.isArray(data) ? data : [];
    const hit = list.find((t) => t.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export default function TxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  // 1) intenta resolver desde cache de cualquier lista de 'transactions'
  const cached = findTxInCache(qc, id);

  // 2) si no está en cache, pide al backend /transactions/:id
  const detailQ = useQuery({
    queryKey: ['transaction', id],
    enabled: !!id && !cached,
    queryFn: async () => {
      const { data } = await api.get(`/transactions/${id}`);
      // soporta {item} o el objeto directo
      return (data?.item ?? data) as Tx;
    },
  });

  const tx: Tx | undefined = cached ?? detailQ.data;

  if (!tx && detailQ.isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>No se encontró el movimiento</Text>
      </View>
    );
  }

  const isDebit = tx.valueCents < 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>Detalle del movimiento</Text>

      <View style={s.card}>
        <Text style={s.label}>Comercio</Text>
        <Text style={s.value}>{tx.merchant ?? '—'}</Text>

        <Text style={[s.label, { marginTop: 12 }]}>Descripción</Text>
        <Text style={s.value}>{tx.description ?? '—'}</Text>

        <Text style={[s.label, { marginTop: 12 }]}>Fecha</Text>
        <Text style={s.value}>{fmtFecha(tx.bookedAt)}</Text>

        <Text style={[s.label, { marginTop: 12 }]}>Categoría</Text>
        <Text style={[s.value, { color: tx.category?.color ?? colors.text }]}>
          {tx.category?.name ?? 'Sin categoría'}
        </Text>

        <Text style={[s.label, { marginTop: 12 }]}>Monto</Text>
        <Text style={[s.amount, { color: isDebit ? colors.danger : colors.success }]}>
          {fmtCLP(tx.valueCents)}
        </Text>

        {typeof tx.anomalyScore === 'number' && (
          <>
            <Text style={[s.label, { marginTop: 12 }]}>Riesgo / Anomalía</Text>
            <Text style={s.value}>{(tx.anomalyScore * 100).toFixed(1)}%</Text>
          </>
        )}
      </View>

      <Text style={s.hint}>
        Próximamente: editar categoría, dividir gasto, reportar, etc.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  label: { color: colors.textMuted, fontSize: 12 },
  value: { color: colors.text, fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  hint: { color: colors.textMuted, marginTop: 16, fontSize: 12 },
});