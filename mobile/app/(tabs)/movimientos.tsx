import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { fmtCLP } from '@/utils/format';
import { colors } from '@/theme';

type Category = { id: string; name: string; color?: string | null } | null;

type Tx = {
  id: string;
  merchant?: string | null;
  description?: string | null;
  valueCents: number;
  category?: Category;
  bookedAt: string;

  // ML
  categoryId?: string | null;
  mlPredictedCategoryId?: string | null;
  mlPredictedCategory?: Category;
  mlLabelSource?: 'model' | 'manual' | 'imported' | null;
};

const normalize = (raw: any): Tx[] => {
  if (Array.isArray(raw)) return raw as Tx[];
  if (Array.isArray(raw?.data)) return raw.data as Tx[];
  if (Array.isArray(raw?.items)) return raw.items as Tx[];
  if (Array.isArray(raw?.transactions)) return raw.transactions as Tx[];
  return [];
};

export default function Movimientos() {
  const { token } = useAuth();
  const router = useRouter();
  const enabled = !!token;

  const {
    data: list = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Tx[]>({
    // clave simple para que invalidateQueries(['transactions']) funcione bien
    queryKey: ['transactions'],
    queryFn: async () => {
      const r = await api.get('/transactions');
      return normalize(r.data);
    },
    enabled,
    staleTime: 60_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  const items = useMemo(
    () =>
      list.map((tx) => {
        const raw = tx.valueCents ?? 0;
        const isDebit = raw < 0;
        const abs = Math.abs(raw);

        const fecha = tx.bookedAt?.slice(0, 10) || '';
        const title = tx.merchant || tx.description || 'Sin descripción';

        const tieneSugerenciaIA =
          !!tx.mlPredictedCategory &&
          !!tx.mlPredictedCategoryId &&
          tx.mlLabelSource === 'model';

        const estaConfirmada =
          !!tx.category && tx.mlLabelSource === 'manual';

        let categoriaTexto = 'Sin categoría';
        let iaBadgeVisible = false;

        if (tx.category?.name) {
          categoriaTexto = tx.category.name;
        } else if (tieneSugerenciaIA) {
          categoriaTexto = tx.mlPredictedCategory?.name ?? 'Sugerencia IA';
          iaBadgeVisible = true;
        }

        return {
          id: String(tx.id),
          title,
          fecha,
          categoriaTexto,
          iaBadgeVisible,
          estaConfirmada,
          isDebit,
          amountFmt: fmtCLP(abs),
        };
      }),
    [list],
  );

  if (!enabled) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
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

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error cargando movimientos';
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
    <View style={s.container}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push(`/movimiento/${item.id}`)}
            activeOpacity={0.85}
          >
            <View style={s.left}>
              <View style={s.iconCircle} />
              <View style={s.textBlock}>
                <Text style={s.title}>{item.title}</Text>
                <View style={s.metaRow}>
                  <Text style={s.date}>{item.fecha}</Text>
                  <Text style={s.categoryText}>{item.categoriaTexto}</Text>
                  {item.iaBadgeVisible && (
                    <View style={s.iaTag}>
                      <Text style={s.iaTagText}>IA</Text>
                    </View>
                  )}
                  {item.estaConfirmada && (
                    <Text style={s.confirmedText}>Confirmado</Text>
                  )}
                </View>
              </View>
            </View>

            <Text
              style={[
                s.amount,
                item.isDebit ? s.amountDebit : s.amountCredit,
              ]}
            >
              {item.isDebit ? '-' : '+'}
              {item.amountFmt}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.empty}>No hay movimientos</Text>
          </View>
        }
        contentContainerStyle={items.length === 0 ? s.flex1 : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.text}
          />
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingRight: 12,
  },

  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card ?? '#111827',
    marginRight: 10,
  },

  textBlock: {
    flexShrink: 1,
  },

  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },

  date: {
    fontSize: 11,
    color: colors.textMuted || '#6b7280',
  },

  categoryText: {
    fontSize: 11,
    color: colors.textMuted || '#9ca3af',
  },

  iaTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primary ?? '#1d4ed8',
  },

  iaTagText: {
    fontSize: 10,
    color: '#f9fafb',
    fontWeight: '600',
  },

  confirmedText: {
    fontSize: 10,
    color: colors.success ?? '#22c55e',
    fontWeight: '600',
  },

  amount: {
    fontSize: 16,
    fontWeight: '700',
  },

  amountDebit: {
    color: colors.danger ?? '#ef4444',
  },

  amountCredit: {
    color: colors.success ?? '#22c55e',
  },

  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 6,
  },

  empty: {
    color: colors.text,
    opacity: 0.6,
  },

  err: {
    color: colors.danger ?? '#ef4444',
    textAlign: 'center',
  },

  flex1: { flex: 1, justifyContent: 'center' },
});
