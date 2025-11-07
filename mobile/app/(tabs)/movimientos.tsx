import React, { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { fmtCLP } from '@/utils/format';

type Category = { id: string; name: string; color?: string | null } | null;
type Tx = {
  id: string;
  merchant?: string | null;
  description?: string | null;
  valueCents: number;
  category?: Category;
  bookedAt: string;
};

const normalize = (raw: any): Tx[] => {
  // Devuelve SIEMPRE un array
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.transactions)) return raw.transactions;
  return [];
};

export default function Movimientos() {
  const { token } = useAuth();
  const enabled = !!token;

  const { data: list = [], isLoading, isError, error, refetch, isRefetching } = useQuery<Tx[]>({
    queryKey: ['transactions', { take: 100 }],
    queryFn: async () => {
      const r = await api.get('/transactions', { params: { take: 100 } });
      return normalize(r.data);               // ← aquí se normaliza
    },
    enabled,
    staleTime: 60_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  const items = useMemo(
    () =>
      list.map((tx) => ({
        id: String(tx.id),
        title: tx.merchant || tx.description || 'Sin descripción',
        subtitle: tx.category?.name || 'Sin categoría',
        date: tx.bookedAt?.slice(0, 10) || '',
        amount: fmtCLP(Math.round((tx.valueCents ?? 0) / 100)),
      })),
    [list]
  );

  if (!enabled) return <View style={s.center}><ActivityIndicator /></View>;
  if (isLoading) return <View style={s.center}><ActivityIndicator /></View>;

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error cargando movimientos';
    return (
      <View style={s.center}>
        <Text style={s.err}>{status ? `${status} · ` : ''}{msg}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.left}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.subtitle}>{item.subtitle} · {item.date}</Text>
            </View>
            <Text style={s.amount}>{item.amount}</Text>
          </View>
        )}
        ListEmptyComponent={<View style={s.center}><Text>No hay movimientos</Text></View>}
        contentContainerStyle={items.length === 0 ? s.flex1 : undefined}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  left: { flexShrink: 1, paddingRight: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#e5e7eb' },
  err: { color: '#ef4444' },
  flex1: { flex: 1, justifyContent: 'center' },
});