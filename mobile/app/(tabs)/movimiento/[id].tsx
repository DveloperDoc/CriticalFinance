// mobile/app/(tabs)/movimiento/[id].tsx
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

  const title = tx.merchant || tx.description || 'Movimiento';

  return (
    <View style={s.screen}>
      <View style={s.card}>

        <Text style={s.title}>{title}</Text>

        <View style={s.chipsRow}>
          <View style={s.chip}>
            <Text style={s.chipText}>
              {isDebit ? 'Débito' : 'Crédito'}
            </Text>
          </View>
          <View style={s.chipSecondary}>
            <Text style={s.chipTextSecondary}>
              {tx.category?.name ?? 'Sin categoría'}
            </Text>
          </View>
        </View>

        <View style={s.amountBox}>
          <View>
            <Text style={s.amountLabel}>Monto</Text>
            <Text style={[s.amountValue, isDebit ? s.debit : s.credit]}>
              {isDebit ? '-' : '+'}
              {fmtCLP(abs)}
            </Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>CLP</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Fecha</Text>
          <Text style={s.sectionValue}>{fecha}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Descripción</Text>
          <Text style={s.sectionValueMulti}>
            {tx.description || tx.merchant || 'Sin descripción'}
          </Text>
        </View>

        <View style={s.sectionLast}>
          <Text style={s.sectionLabel}>ID transacción</Text>
          <Text style={s.sectionValueMono}>{tx.id}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040405ff', // mismo tono oscuro del home
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: '#040405ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#040405ff', // panel oscuro tipo cards del home
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#272323ff',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  title: {
    fontSize: 18,
    color: '#f9fafb',
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1d4ed8', // azul tipo botones/chips
  },
  chipSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 11,
    color: '#f9fafb',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  chipTextSecondary: {
    fontSize: 11,
    color: '#e5e7eb',
    textTransform: 'uppercase',
  },
  amountBox: {
    marginTop: 18,
    backgroundColor: '#0b1220',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  badgeText: {
    fontSize: 11,
    color: '#bfdbfe',
    fontWeight: '600',
  },
  section: {
    marginTop: 18,
  },
  sectionLast: {
    marginTop: 18,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 15,
    color: '#f9fafb',
  },
  sectionValueMulti: {
    fontSize: 15,
    color: '#e5e7eb',
    lineHeight: 20,
  },
  sectionValueMono: {
    fontSize: 13,
    color: '#e5e7eb',
    fontFamily: 'monospace',
  },
  debit: {
    color: '#f97373',
  },
  credit: {
    color: '#4ade80',
  },
  err: {
    color: '#f97373',
    textAlign: 'center',
    fontSize: 14,
  },
});
