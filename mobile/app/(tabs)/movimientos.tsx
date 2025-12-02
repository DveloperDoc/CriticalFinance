import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { fmtCLP } from '@/utils/format';
import { colors } from '@/theme';

type Category = { id: string; name: string; color?: string | null } | null;

// Category “real” (no null) para el endpoint /categories
type CategoryRef = {
  id: string;
  name: string;
  color?: string | null;
};

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

  // NUEVO: flag de gasto hormiga
  isGastoHormiga?: boolean;
};

type MonthFilterKey = 'all' | 'this-month' | 'last-month' | 'last-3-months';
type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const normalize = (raw: any): Tx[] => {
  if (Array.isArray(raw)) return raw as Tx[];
  if (Array.isArray(raw?.data)) return raw.data as Tx[];
  if (Array.isArray(raw?.items)) return raw.items as Tx[];
  if (Array.isArray(raw?.transactions)) return raw.transactions as Tx[];
  return [];
};

const toDate = (iso: string) => new Date(iso);

const matchesMonthFilter = (tx: Tx, filter: MonthFilterKey): boolean => {
  if (filter === 'all') return true;

  const d = toDate(tx.bookedAt);
  const now = new Date();

  const year = d.getFullYear();
  const month = d.getMonth();

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  if (filter === 'this-month') {
    return year === nowYear && month === nowMonth;
  }

  if (filter === 'last-month') {
    const lastMonthDate = new Date(nowYear, nowMonth - 1, 1);
    return (
      year === lastMonthDate.getFullYear() &&
      month === lastMonthDate.getMonth()
    );
  }

  if (filter === 'last-3-months') {
    const diffMonths = (nowYear - year) * 12 + (nowMonth - month);
    return diffMonths >= 0 && diffMonths <= 2;
  }

  return true;
};

export default function Movimientos() {
  const { token } = useAuth();
  const router = useRouter();
  const enabled = !!token;

  // Filtros
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<MonthFilterKey>('this-month');
  const [sortBy, setSortBy] = useState<SortKey>('date-desc');

  const {
    data: txs = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Tx[]>({
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

  // categorías para filtro
  const {
    data: categories = [],
    isLoading: categoriesLoading,
  } = useQuery<CategoryRef[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data as CategoryRef[];
    },
    enabled,
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    let list = txs.slice();

    // filtro por categoría
    if (selectedCategoryId) {
      list = list.filter((tx) => tx.category?.id === selectedCategoryId);
    }

    // filtro por periodo
    list = list.filter((tx) => matchesMonthFilter(tx, monthFilter));

    // orden
    list.sort((a, b) => {
      const dateDiff =
        toDate(b.bookedAt).getTime() - toDate(a.bookedAt).getTime();

      if (sortBy === 'date-desc') {
        // Más nuevos primero (usa fecha + hora)
        return dateDiff;
      }

      if (sortBy === 'date-asc') {
        // Más antiguos primero
        return -dateDiff;
      }

      const absA = Math.abs(a.valueCents ?? 0);
      const absB = Math.abs(b.valueCents ?? 0);

      if (sortBy === 'amount-desc') {
        return absB - absA;
      }

      // amount-asc
      return absA - absB;
    });

    // proyección a item de UI
    return list.map((tx) => {
      const raw = tx.valueCents ?? 0;
      const isDebit = raw < 0; // gasto si es negativo
      const abs = Math.abs(raw);

      // mostramos fecha + hora para que se note bien el orden
      const fecha = tx.bookedAt
        ? new Date(tx.bookedAt).toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      const title = tx.merchant || tx.description || 'Sin descripción';

      const tieneSugerenciaIA =
        !!tx.mlPredictedCategory &&
        !!tx.mlPredictedCategoryId &&
        tx.mlLabelSource === 'model';

      const estaConfirmada = !!tx.category && tx.mlLabelSource === 'manual';

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
        // NUEVO: propagamos el flag al item de UI
        isGastoHormiga: !!tx.isGastoHormiga,
      };
    });
  }, [txs, selectedCategoryId, monthFilter, sortBy]);

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
      {/* Encabezado simple */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Movimientos</Text>
        <Text style={s.headerSubtitle}>
          Filtra por periodo, categoría y ordena por fecha o monto.
        </Text>
      </View>

      {/* Bloque de filtros */}
      <View style={s.filtersBlock}>
        {/* Periodo */}
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Periodo</Text>
          <View style={s.chipsRow}>
            <TouchableOpacity
              style={[s.chip, monthFilter === 'all' && s.chipSelected]}
              onPress={() => setMonthFilter('all')}
            >
              <Text
                style={[
                  s.chipLabel,
                  monthFilter === 'all' && s.chipLabelSelected,
                ]}
              >
                Todo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.chip, monthFilter === 'this-month' && s.chipSelected]}
              onPress={() => setMonthFilter('this-month')}
            >
              <Text
                style={[
                  s.chipLabel,
                  monthFilter === 'this-month' && s.chipLabelSelected,
                ]}
              >
                Este mes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.chip, monthFilter === 'last-month' && s.chipSelected]}
              onPress={() => setMonthFilter('last-month')}
            >
              <Text
                style={[
                  s.chipLabel,
                  monthFilter === 'last-month' && s.chipLabelSelected,
                ]}
              >
                Mes anterior
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.chip,
                monthFilter === 'last-3-months' && s.chipSelected,
              ]}
              onPress={() => setMonthFilter('last-3-months')}
            >
              <Text
                style={[
                  s.chipLabel,
                  monthFilter === 'last-3-months' && s.chipLabelSelected,
                ]}
              >
                Últimos 3 meses
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categoría */}
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Categoría</Text>

          {categoriesLoading && (
            <Text style={s.textMuted}>Cargando categorías…</Text>
          )}

          {!categoriesLoading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRowHorizontal}
            >
              <TouchableOpacity
                style={[s.chip, !selectedCategoryId && s.chipSelected]}
                onPress={() => setSelectedCategoryId(null)}
              >
                <Text
                  style={[
                    s.chipLabel,
                    !selectedCategoryId && s.chipLabelSelected,
                  ]}
                >
                  Todas
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => {
                const selected = cat.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.chip, selected && s.chipSelected]}
                    onPress={() =>
                      setSelectedCategoryId(selected ? null : cat.id)
                    }
                  >
                    <Text
                      style={[
                        s.chipLabel,
                        selected && s.chipLabelSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Orden */}
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Ordenar por</Text>
          <View style={s.chipsRow}>
            <TouchableOpacity
              style={[s.chipSmall, sortBy === 'date-desc' && s.chipSelected]}
              onPress={() => setSortBy('date-desc')}
            >
              <Text
                style={[
                  s.chipLabel,
                  sortBy === 'date-desc' && s.chipLabelSelected,
                ]}
              >
                Fecha ↓
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.chipSmall, sortBy === 'date-asc' && s.chipSelected]}
              onPress={() => setSortBy('date-asc')}
            >
              <Text
                style={[
                  s.chipLabel,
                  sortBy === 'date-asc' && s.chipLabelSelected,
                ]}
              >
                Fecha ↑
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.chipSmall, sortBy === 'amount-desc' && s.chipSelected]}
              onPress={() => setSortBy('amount-desc')}
            >
              <Text
                style={[
                  s.chipLabel,
                  sortBy === 'amount-desc' && s.chipLabelSelected,
                ]}
              >
                Monto ↓
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.chipSmall, sortBy === 'amount-asc' && s.chipSelected]}
              onPress={() => setSortBy('amount-asc')}
            >
              <Text
                style={[
                  s.chipLabel,
                  sortBy === 'amount-asc' && s.chipLabelSelected,
                ]}
              >
                Monto ↑
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Lista de movimientos */}
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

                  {item.isGastoHormiga && (
                    <View style={s.hormigaChip}>
                      <Text style={s.hormigaChipText}>Gasto hormiga</Text>
                    </View>
                  )}

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

  header: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: (colors as any).textMuted || '#6b7280',
    marginTop: 2,
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
    backgroundColor: (colors as any).surface || colors.card,
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
    color: (colors as any).textMuted || '#6b7280',
  },

  categoryText: {
    fontSize: 11,
    color: (colors as any).textMuted || '#9ca3af',
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
    color: (colors as any).success ?? '#22c55e',
    fontWeight: '600',
  },

  // NUEVO: chip de gasto hormiga
  hormigaChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: (colors as any).danger ?? '#ef4444',
  },
  hormigaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f9fafb',
  },

  amount: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Gasto → rojo
  amountDebit: {
    color: (colors as any).danger ?? '#ef4444',
  },

  // Ahorro / ingreso → verde
  amountCredit: {
    color: (colors as any).success ?? '#22c55e',
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
    color: (colors as any).danger ?? '#ef4444',
    textAlign: 'center',
  },

  flex1: { flex: 1, justifyContent: 'center' },

  // filtros
  filtersBlock: {
    marginBottom: 8,
  },
  filterGroup: {
    marginTop: 8,
  },
  filterLabel: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipsRowHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 12,
  },
  chipLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  textMuted: {
    color: (colors as any).textMuted || '#9ca3af',
  },
});
