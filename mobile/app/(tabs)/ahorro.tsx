// mobile/app/(tabs)/ahorro.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { fmtCLP } from '@/utils/format';

type BudgetOverview = {
  id: string;
  category: { id: string; name: string; color?: string | null };
  amountCents: number;
  spentCents: number;
  remainingCents: number;
  progress: number; // 0..1
  isOver: boolean;
  period: 'monthly' | 'weekly' | 'yearly';
};

type Category = {
  id: string;
  name: string;
  color?: string | null;
};

export default function AhorroScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Estado formulario
  const [showForm, setShowForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<BudgetOverview | null>(null);

  // Budgets overview
  const {
    data: budgets = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<BudgetOverview[]>({
    queryKey: ['budgets', 'overview'],
    queryFn: async () => {
      const { data } = await api.get('/budgets/overview');
      return data as BudgetOverview[];
    },
    enabled: !!token,
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  // Categorías para el formulario (solo se usan al crear)
  const categoriesQuery = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data as Category[];
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const resetForm = () => {
    setShowForm(false);
    setSelectedCategoryId(null);
    setAmount('');
    setSaveError(null);
    setEditingBudget(null);
  };

  // Mutación crear / actualizar presupuesto
  const createBudgetMutation = useMutation({
    mutationFn: async (vars: { categoryId: string; amountCents: number }) => {
      setSaveError(null);

      const body = {
        categoryId: vars.categoryId,
        amountCents: vars.amountCents,
        period: 'monthly' as const,
      };
      const { data } = await api.post('/budgets', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', 'overview'] });
      resetForm();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al guardar el presupuesto';
      const full = status ? `${status} · ${msg}` : msg;
      setSaveError(full);
      console.error('Error creando/actualizando presupuesto:', err);
    },
  });

  // Mutación eliminar presupuesto
  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: string) => {
      setSaveError(null);
      await api.delete(`/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', 'overview'] });
      resetForm();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al eliminar el presupuesto';
      const full = status ? `${status} · ${msg}` : msg;
      setSaveError(full);
      console.error('Error eliminando presupuesto:', err);
    },
  });

  const handleSubmitBudget = () => {
    if (!selectedCategoryId || !amount.trim()) return;

    const raw = amount.replace(/\D/g, '');
    const amountNumber = Number(raw);
    if (!amountNumber || Number.isNaN(amountNumber)) {
      setSaveError('Monto inválido. Escribe solo números, por ejemplo 150000.');
      return;
    }

    createBudgetMutation.mutate({
      categoryId: selectedCategoryId,
      amountCents: amountNumber,
    });
  };

  const handleDeleteBudget = () => {
    if (!editingBudget) return;
    deleteBudgetMutation.mutate(editingBudget.id);
  };

  if (!token) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>Inicia sesión para ver tus presupuestos.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.textMuted}>Cargando presupuestos…</Text>
      </View>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error al cargar presupuestos';
    return (
      <View style={s.center}>
        <Text style={s.err}>
          {status ? `${status} · ` : ''}
          {msg}
        </Text>
      </View>
    );
  }

  // resumen de alertas de presupuesto
  const overCount = budgets.filter((b) => b.isOver).length;
  const nearCount = budgets.filter((b) => !b.isOver && b.progress >= 0.8).length;

  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.text}
          />
        }
      >
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Presupuestos del mes</Text>
            <Text style={s.subtitle}>
              Revisa cuánto has gastado por categoría y qué tan cerca estás de tu límite.
            </Text>
          </View>

          <Pressable
            style={s.addButton}
            onPress={() => {
              setEditingBudget(null);
              setSelectedCategoryId(null);
              setAmount('');
              setSaveError(null);
              setShowForm(true);
            }}
          >
            <Text style={s.addButtonText}>+ Agregar</Text>
          </Pressable>
        </View>

        {(overCount > 0 || nearCount > 0) && (
          <View style={s.alertBox}>
            <Text style={s.alertTitle}>Alertas de presupuesto</Text>

            {overCount > 0 && (
              <Text style={s.alertText}>
                {overCount === 1
                  ? '1 categoría ya se pasó de su presupuesto.'
                  : `${overCount} categorías ya se pasaron de su presupuesto.`}
              </Text>
            )}

            {nearCount > 0 && (
              <Text style={s.alertText}>
                {nearCount === 1
                  ? '1 categoría está cerca de su límite (80%+).'
                  : `${nearCount} categorías están cerca de su límite (80%+).`}
              </Text>
            )}
          </View>
        )}

        {budgets.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.textMuted}>
              Aún no tienes presupuestos configurados. Puedes crearlos desde aquí para
              controlar mejor tus gastos.
            </Text>
          </View>
        ) : (
          budgets.map((b) => {
            const pct = Math.min(1, Math.max(0, b.progress));
            const pctLabel = (pct * 100).toFixed(1) + '%';

            const barColor = b.isOver
              ? colors.danger ?? '#ef4444'
              : pct >= 0.8
              ? colors.warning ?? '#facc15'
              : colors.success ?? '#22c55e';

            return (
              <Pressable
                key={b.id}
                style={s.budgetCard}
                onPress={() => {
                  setEditingBudget(b);
                  setSelectedCategoryId(b.category.id);
                  setAmount(String(b.amountCents));
                  setSaveError(null);
                  setShowForm(true);
                }}
              >
                <View style={s.budgetHeader}>
                  <Text style={s.budgetName}>{b.category.name}</Text>
                  <Text style={s.budgetPct}>{pctLabel}</Text>
                </View>

                <View style={s.barBg}>
                  <View
                    style={[
                      s.barFill,
                      { width: `${pct * 100}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>

                <View style={s.budgetAmountsRow}>
                  <View>
                    <Text style={s.amountLabel}>Gastado</Text>
                    <Text style={s.amountValue}>{fmtCLP(b.spentCents)}</Text>
                  </View>
                  <View>
                    <Text style={s.amountLabel}>Límite</Text>
                    <Text style={s.amountValue}>{fmtCLP(b.amountCents)}</Text>
                  </View>
                  <View>
                    <Text style={s.amountLabel}>Disponible</Text>
                    <Text style={s.amountValue}>
                      {b.isOver ? '0' : fmtCLP(b.remainingCents)}
                    </Text>
                  </View>
                </View>

                {b.isOver && (
                  <Text style={s.overText}>
                    Superaste tu presupuesto en esta categoría este mes.
                  </Text>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Modal para crear/editar presupuesto */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={resetForm}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>
              {editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto mensual'}
            </Text>

            {/* Categoría */}
            <View style={s.modalSection}>
              <Text style={s.label}>Categoría</Text>

              {editingBudget ? (
                <Text style={s.textMuted}>
                  {editingBudget.category.name} (no editable)
                </Text>
              ) : (
                <>
                  {categoriesQuery.isLoading && (
                    <View style={{ marginTop: 8 }}>
                      <ActivityIndicator />
                      <Text style={s.textMuted}>Cargando categorías…</Text>
                    </View>
                  )}

                  {categoriesQuery.data && (
                    <View style={s.chipsRow}>
                      {categoriesQuery.data.map((cat) => {
                        const selected = cat.id === selectedCategoryId;
                        return (
                          <Pressable
                            key={cat.id}
                            style={[s.chip, selected && s.chipSelected]}
                            onPress={() => setSelectedCategoryId(cat.id)}
                          >
                            <Text
                              style={[s.chipLabel, selected && s.chipLabelSelected]}
                              numberOfLines={1}
                            >
                              {cat.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Monto */}
            <View style={s.modalSection}>
              <Text style={s.label}>Monto mensual (CLP)</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Ej: 150000"
                placeholderTextColor={colors.textMuted}
                style={s.input}
              />
            </View>

            {saveError && <Text style={[s.err, { marginBottom: 6 }]}>{saveError}</Text>}

            {/* Botones */}
            <View style={s.modalButtonsRow}>
              {editingBudget && (
                <Pressable
                  style={[s.modalButton, s.modalButtonDanger]}
                  onPress={handleDeleteBudget}
                  disabled={deleteBudgetMutation.isPending}
                >
                  <Text style={s.modalButtonDangerText}>
                    {deleteBudgetMutation.isPending ? 'Eliminando…' : 'Eliminar'}
                  </Text>
                </Pressable>
              )}

              <View style={{ flex: 1 }} />

              <Pressable
                style={[s.modalButton, s.modalButtonSecondary]}
                onPress={resetForm}
                disabled={createBudgetMutation.isPending || deleteBudgetMutation.isPending}
              >
                <Text style={s.modalButtonSecondaryText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[
                  s.modalButton,
                  (!selectedCategoryId && !editingBudget) || !amount.trim()
                    ? { opacity: 0.5 }
                    : null,
                ]}
                onPress={handleSubmitBudget}
                disabled={
                  (!selectedCategoryId && !editingBudget) ||
                  !amount.trim() ||
                  createBudgetMutation.isPending ||
                  deleteBudgetMutation.isPending
                }
              >
                <Text style={s.modalButtonText}>
                  {createBudgetMutation.isPending ? 'Guardando…' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },

  addButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  alertBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warning ?? '#facc15',
  },
  alertTitle: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
  },
  alertText: {
    color: colors.textMuted,
    fontSize: 12,
  },

  emptyBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  textMuted: {
    color: colors.textMuted,
    fontSize: 13,
  },

  budgetCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetName: {
    color: colors.text,
    fontWeight: '600',
  },
  budgetPct: {
    color: colors.textMuted,
    fontSize: 12,
  },

  barBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.background ?? '#111827',
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: 8,
    borderRadius: 999,
  },

  budgetAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  amountValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },

  overText: {
    marginTop: 6,
    fontSize: 11,
    color: colors.danger ?? '#ef4444',
  },

  err: {
    color: colors.danger ?? '#ef4444',
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalSection: {
    marginBottom: 12,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: colors.bg,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    maxWidth: '48%',
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
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalButtonSecondaryText: {
    color: colors.text,
    fontSize: 13,
  },
  modalButtonDanger: {
    backgroundColor: colors.danger ?? '#ef4444',
  },
  modalButtonDangerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
