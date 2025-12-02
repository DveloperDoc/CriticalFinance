// mobile/app/(tabs)/movimiento/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { fmtCLP, fmtFecha } from '@/utils/format';

// categoría asociada a una tx (puede ser null)
type Category = { id: string; name: string; color?: string | null } | null;

// categoría completa para selector
type CategoryOption = { id: string; name: string; color?: string | null };

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
  mlLabelSource?: 'model' | 'manual' | 'imported' | null;
  mlPredictedCategory?: Category;
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
  const qc = useQueryClient();

  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);

  const enabled = !!token && !!id;

  // Detalle de la transacción
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

  // Categorías para selector manual
  const categoriesQ = useQuery<CategoryOption[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data as CategoryOption[];
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  // Cuando cambia la tx, precargamos la categoría actual (o sugerida)
  useEffect(() => {
    if (!tx) return;
    if (tx.categoryId) {
      setPendingCategoryId(tx.categoryId);
    } else if (tx.mlPredictedCategoryId) {
      setPendingCategoryId(tx.mlPredictedCategoryId);
    } else {
      setPendingCategoryId(null);
    }
  }, [tx?.id, tx?.categoryId, tx?.mlPredictedCategoryId]);

  // Mutación genérica para actualizar categoría
  const updateCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { data } = await api.patch(`/transactions/${id}/category`, {
        categoryId,
      });
      return data as Tx;
    },
    onSuccess: (data) => {
      // 1) dejar el estado local alineado con la tx devuelta
      setPendingCategoryId(data.categoryId ?? null);

      // 2) actualizar detalle en cache
      qc.setQueryData(['transaction', id], data);

      // 3) refrescar lista general de movimientos
      qc.invalidateQueries({ queryKey: ['transactions'] });

      // 4) refrescar lista de anomalías (si la usas con este queryKey)
      qc.invalidateQueries({ queryKey: ['transactions', 'anomalies'] });

      // 5) refrescar presupuestos / ahorro
      qc.invalidateQueries({ queryKey: ['budgets', 'overview'] });

      // 6) refrescar alertas (por si alguna dependía de esta transacción)
      qc.invalidateQueries({ queryKey: ['alerts'] });

      Alert.alert('Listo', 'Categoría actualizada.');
    },
    onError: () => {
      Alert.alert('Error', 'No se pudo actualizar la categoría.');
    },
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

  // Lógica de monto: signo por valueCents, valor absoluto para formatear
  const raw = tx.valueCents ?? 0;
  const isDebit = raw < 0;
  const abs = Math.abs(raw);

  const fecha = fmtFecha(tx.bookedAt);
  const title = tx.merchant || tx.description || 'Movimiento';

  const tieneSugerenciaIA =
    !!tx.mlPredictedCategory &&
    !!tx.mlPredictedCategoryId &&
    tx.mlLabelSource === 'model';

  const puedeAceptarSugerencia =
    tieneSugerenciaIA &&
    (!tx.categoryId || tx.categoryId !== tx.mlPredictedCategoryId);

  const handleAceptarSugerencia = () => {
    if (!tx.mlPredictedCategoryId) return;
    updateCategoryMutation.mutate(tx.mlPredictedCategoryId);
  };

  const handleGuardarManual = () => {
    if (!pendingCategoryId || pendingCategoryId === tx.categoryId) return;
    updateCategoryMutation.mutate(pendingCategoryId);
  };

  const saving = updateCategoryMutation.isPending;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* Tarjeta principal: título + monto */}
      <View style={s.cardMain}>
        <Text style={s.title}>{title}</Text>

        <View style={s.chipsRow}>
          <View style={s.chipPrimary}>
            <Text style={s.chipPrimaryText}>{isDebit ? 'Gasto' : 'Ingreso'}</Text>
          </View>
          <View style={s.chipSoft}>
            <Text style={s.chipSoftText}>{fecha}</Text>
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
          <View style={s.currencyPill}>
            <Text style={s.currencyPillText}>CLP</Text>
          </View>
        </View>
      </View>

      {/* Tarjeta de categorías + IA */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Categoría</Text>

        <View style={s.catsRow}>
          <View style={s.flex1}>
            <Text style={s.sectionLabel}>Actual</Text>
            <View style={s.catPillCurrent}>
              <Text style={s.catPillCurrentText}>
                {tx.category?.name ?? 'Sin categoría asignada'}
              </Text>
            </View>
          </View>

          <View style={s.flex1}>
            <Text style={s.sectionLabel}>Sugerida por IA</Text>
            {tx.mlPredictedCategory ? (
              <View style={s.catIaRow}>
                <View style={s.catPillIA}>
                  <Text style={s.catPillIAText}>
                    {tx.mlPredictedCategory.name}
                  </Text>
                </View>
                <View style={s.iaBadge}>
                  <Text style={s.iaBadgeText}>IA</Text>
                </View>
              </View>
            ) : (
              <View style={s.catPillMuted}>
                <Text style={s.catPillMutedText}>Sin sugerencia</Text>
              </View>
            )}
          </View>
        </View>

        {puedeAceptarSugerencia && (
          <Pressable
            onPress={handleAceptarSugerencia}
            disabled={saving}
            style={({ pressed }) => [
              s.buttonIA,
              pressed && { opacity: 0.85 },
              saving && { opacity: 0.6 },
            ]}
          >
            <Text style={s.buttonIAText}>
              {saving ? 'Guardando…' : 'Aceptar sugerencia de IA'}
            </Text>
          </Pressable>
        )}

        {!puedeAceptarSugerencia && tx.mlLabelSource === 'manual' && (
          <Text style={s.helperText}>
            Categoría ajustada manualmente por el usuario.
          </Text>
        )}

        {/* Selector manual de categoría */}
        <View style={s.manualSection}>
          <Text style={s.sectionLabel}>Elegir manualmente</Text>

          {categoriesQ.isLoading && (
            <Text style={s.helperText}>Cargando categorías…</Text>
          )}

          {categoriesQ.data && categoriesQ.data.length > 0 && (
            <View style={s.catList}>
              {categoriesQ.data.map((cat) => {
                const selected = pendingCategoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      s.catChip,
                      selected && s.catChipSelected,
                    ]}
                    onPress={() => setPendingCategoryId(cat.id)}
                  >
                    <Text
                      style={[
                        s.catChipText,
                        selected && s.catChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={handleGuardarManual}
            disabled={
              saving ||
              !pendingCategoryId ||
              pendingCategoryId === tx.categoryId
            }
            style={({ pressed }) => [
              s.buttonManual,
              (pressed || saving) && { opacity: 0.85 },
              (!pendingCategoryId ||
                pendingCategoryId === tx.categoryId) && { opacity: 0.5 },
            ]}
          >
            <Text style={s.buttonManualText}>
              {saving ? 'Guardando…' : 'Guardar categoría'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Detalles adicionales */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Detalles</Text>

        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Descripción</Text>
          <Text style={s.detailValueMulti}>
            {tx.description || tx.merchant || 'Sin descripción'}
          </Text>
        </View>

        <View style={s.detailRow}>
          <Text style={s.detailLabel}>ID transacción</Text>
          <Text style={s.detailValueMono}>{tx.id}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040405ff',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    backgroundColor: '#040405ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  // Cards
  cardMain: {
    backgroundColor: '#050816',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#272323ff',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#050816',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#272323ff',
    marginBottom: 16,
  },

  // Header
  title: {
    fontSize: 18,
    color: '#f9fafb',
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  chipPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1d4ed8',
  },
  chipPrimaryText: {
    fontSize: 11,
    color: '#f9fafb',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  chipSoft: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  chipSoftText: {
    fontSize: 11,
    color: '#e5e7eb',
  },

  // Amount
  amountBox: {
    marginTop: 8,
    backgroundColor: '#020617',
    borderRadius: 14,
    paddingVertical: 14,
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
    fontSize: 26,
    fontWeight: '700',
  },
  debit: {
    color: '#f97373',
  },
  credit: {
    color: '#4ade80',
  },
  currencyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  currencyPillText: {
    fontSize: 11,
    color: '#bfdbfe',
    fontWeight: '600',
  },

  // Categorías
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  catsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  flex1: {
    flex: 1,
  },
  catPillCurrent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  catPillCurrentText: {
    fontSize: 13,
    color: '#e5e7eb',
  },
  catIaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catPillIA: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#082f49',
  },
  catPillIAText: {
    fontSize: 13,
    color: '#e0f2fe',
  },
  iaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#4F8EF7',
  },
  iaBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  catPillMuted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1f2933',
  },
  catPillMutedText: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // Botones IA / manual
  buttonIA: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#4F8EF7',
  },
  buttonIAText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
  },

  manualSection: {
    marginTop: 16,
  },
  catList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#020617',
  },
  catChipSelected: {
    backgroundColor: '#4F8EF7',
    borderColor: '#4F8EF7',
  },
  catChipText: {
    fontSize: 12,
    color: '#e5e7eb',
  },
  catChipTextSelected: {
    fontWeight: '600',
    color: '#fff',
  },
  buttonManual: {
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4F8EF7',
  },
  buttonManualText: {
    color: '#e5e7eb',
    fontWeight: '600',
    fontSize: 13,
  },

  // Detalles
  detailRow: {
    marginTop: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValueMulti: {
    fontSize: 15,
    color: '#e5e7eb',
    lineHeight: 20,
  },
  detailValueMono: {
    fontSize: 13,
    color: '#e5e7eb',
    fontFamily: 'monospace',
  },

  // Errores
  err: {
    color: '#f97373',
    textAlign: 'center',
    fontSize: 14,
  },
});
