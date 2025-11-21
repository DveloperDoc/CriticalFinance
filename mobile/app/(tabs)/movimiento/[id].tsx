import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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

const normalizeOne = (raw: any): Tx | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] ?? null) as Tx | null;
  if (Array.isArray(raw?.data)) return (raw.data[0] ?? null) as Tx | null;
  if (raw?.data) return raw.data as Tx;
  if (raw?.item) return raw.item as Tx;
  return raw as Tx;
};

export default function MovimientoDetalle() {
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const enabled = !!token && !!id;

  const {
    data: tx,
    isLoading,
    isError,
    error,
  } = useQuery<Tx | null>({
    queryKey: ['transaction', id],
    enabled,
    queryFn: async () => {
      const r = await api.get(`/transactions/${id}`);
      return normalizeOne(r.data);
    },
    staleTime: 60_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  if (!token) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!id) {
    return (
      <View style={s.center}>
        <Text style={s.err}>Falta el id del movimiento.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !tx) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'No se pudo cargar el movimiento';
    return (
      <View style={s.center}>
        <Text style={s.err}>
          {status ? `${status} · ` : ''}
          {msg}
        </Text>
      </View>
    );
  }

  const raw = tx.valueCents ?? 0;
  const isDebit = raw < 0;
  const abs = Math.abs(raw);
  const fecha = new Date(tx.bookedAt).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  return (
    <View style={s.container}>
      <Text style={s.label}>Comercio / descripción</Text>
      <Text style={s.value}>
        {tx.merchant || tx.description || 'Sin descripción'}
      </Text>

      <Text style={s.label}>Monto</Text>
      <Text style={[s.value, isDebit ? s.debit : s.credit]}>
        {isDebit ? '-' : '+'}
        {fmtCLP(abs)}
      </Text>

      <Text style={s.label}>Fecha</Text>
      <Text style={s.value}>{fecha}</Text>

      <Text style={s.label}>Categoría</Text>
      <Text style={s.value}>{tx.category?.name ?? 'Sin categoría'}</Text>

      <Text style={s.label}>ID</Text>
      <Text style={s.valueMono}>{tx.id}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  label: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 2,
  },
  value: { fontSize: 16, color: '#f9fafb' },
  valueMono: { fontSize: 14, color: '#f9fafb', fontFamily: 'monospace' },
  debit: { color: '#ef4444' },
  credit: { color: '#22c55e' },
  err: { color: '#ef4444', textAlign: 'center' },
});
