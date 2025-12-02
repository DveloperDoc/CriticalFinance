// mobile/app/(tabs)/ahorro.tsx
import React, { useEffect, useState } from 'react';
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

// Ahorro mensual
type SavingsMonth = {
  month: string; // "YYYY-MM"
  incomeCents: number;
  expenseCents: number;
  savingsCents: number;
  savingsRate: number | null;
};

type SavingsOverview = {
  months: SavingsMonth[];
  averageSavingsRate: number | null;
  averageSavingsCents: number;
};

// Reglas de ahorro
type SavingsRule = {
  id: string;
  thresholdCents: number;
  notifyMarginCents: number | null;
  createdAt: string;
  account: {
    id: string;
    bank: string | null;
    accountType: string | null;
    accountNumber: string | null;
    alias: string | null;
    balanceCents: number;
    currency: string;
  };
  alerts?: {
    id: string;
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string | null;
    isActive: boolean;
    createdAt: string;
  }[];
};

// /me para listar cuentas
type Me = {
  id: string;
  accounts: {
    id: string;
    alias: string | null;
    bank: string | null;
    accountNumber: string | null;
    currency: string;
    balanceCents: number;
  }[];
};

export default function AhorroScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const enabled = !!token;

  // Cuenta sobre la que se calcula ahorro / reglas (presupuestos siguen siendo globales)
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);

  // Estado formulario presupuestos
  const [showForm, setShowForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<BudgetOverview | null>(null);

  // Estado formulario reglas de ahorro
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleAccountId, setRuleAccountId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState('');
  const [margin, setMargin] = useState('');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<SavingsRule | null>(null);

  // /me para listar cuentas (también usado para el selector superior)
  const { data: meData, isLoading: meLoading } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/me');
      return data as Me;
    },
    enabled,
    staleTime: 30_000,
  });

  // cuando llegan las cuentas, elegimos una por defecto si no hay
  useEffect(() => {
    if (!meData || currentAccountId) return;
    if (meData.accounts.length > 0) {
      setCurrentAccountId(meData.accounts[0].id);
    }
  }, [meData, currentAccountId]);

  // Budgets overview (global por usuario, no por cuenta)
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
    enabled,
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
    enabled,
    staleTime: 60_000,
  });

  // Ahorro mensual (últimos 6 meses) por cuenta
  const {
    data: savingsOverview,
    isLoading: savingsLoading,
    isError: savingsError,
  } = useQuery<SavingsOverview>({
    queryKey: ['savings', 'overview', currentAccountId],
    queryFn: async () => {
      const { data } = await api.get('/savings/overview', {
        params: { accountId: currentAccountId },
      });
      return data as SavingsOverview;
    },
    enabled: enabled && !!currentAccountId,
    staleTime: 60_000,
  });

  // Reglas de ahorro (umbral por cuenta) → traemos todas y filtramos por cuenta visible
  const {
    data: allSavingsRules = [],
    isLoading: rulesLoading,
    isError: rulesError,
  } = useQuery<SavingsRule[]>({
    queryKey: ['savings', 'rules'],
    queryFn: async () => {
      const { data } = await api.get('/savings/rules');
      return data as SavingsRule[];
    },
    enabled,
    staleTime: 60_000,
  });

  const savingsRules = allSavingsRules.filter(
    (r) => !currentAccountId || r.account.id === currentAccountId,
  );

  const resetForm = () => {
    setShowForm(false);
    setSelectedCategoryId(null);
    setAmount('');
    setSaveError(null);
    setEditingBudget(null);
  };

  const resetRuleForm = () => {
    setShowRuleForm(false);
    setRuleAccountId(null);
    setThreshold('');
    setMargin('');
    setRuleError(null);
    setEditingRule(null);
  };

  // Mutación crear / actualizar presupuesto (upsert) – GLOBAL (sin accountId)
  const createBudgetMutation = useMutation({
    mutationFn: async (vars: {
      categoryId: string;
      amountCents: number;
      period: 'monthly' | 'weekly' | 'yearly';
    }) => {
      setSaveError(null);

      const body = {
        categoryId: vars.categoryId,
        amountCents: vars.amountCents,
        period: vars.period,
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

  // Mutación crear regla de ahorro
  const createRuleMutation = useMutation({
    mutationFn: async (vars: {
      accountId: string;
      thresholdCents: number;
      notifyMarginCents?: number | null;
    }) => {
      setRuleError(null);

      const body: any = {
        accountId: vars.accountId,
        thresholdCents: vars.thresholdCents,
      };
      if (vars.notifyMarginCents != null) {
        body.notifyMarginCents = vars.notifyMarginCents;
      }

      const { data } = await api.post('/savings/rules', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings', 'rules'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      resetRuleForm();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al guardar la regla de ahorro';
      const full = status ? `${status} · ${msg}` : msg;
      setRuleError(full);
      console.error('Error creando regla de ahorro:', err);
    },
  });

  // Mutación actualizar regla de ahorro
  const updateRuleMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      thresholdCents: number;
      notifyMarginCents?: number | null;
    }) => {
      setRuleError(null);

      const body: any = {
        thresholdCents: vars.thresholdCents,
      };
      if (vars.notifyMarginCents != null) {
        body.notifyMarginCents = vars.notifyMarginCents;
      }

      const { data } = await api.patch(`/savings/rules/${vars.id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings', 'rules'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      resetRuleForm();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al actualizar la regla de ahorro';
      const full = status ? `${status} · ${msg}` : msg;
      setRuleError(full);
      console.error('Error actualizando regla de ahorro:', err);
    },
  });

  // Mutación eliminar regla de ahorro
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      setRuleError(null);
      await api.delete(`/savings/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings', 'rules'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      resetRuleForm();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Error al eliminar la regla de ahorro';
      const full = status ? `${status} · ${msg}` : msg;
      setRuleError(full);
      console.error('Error eliminando regla de ahorro:', err);
    },
  });

  const handleSubmitBudget = () => {
    if (!selectedCategoryId && !editingBudget) return;
    if (!amount.trim()) return;

    const raw = amount.replace(/\D/g, '');
    const amountNumber = Number(raw);
    if (!amountNumber || Number.isNaN(amountNumber)) {
      setSaveError('Monto inválido. Escribe solo números, por ejemplo 150000.');
      return;
    }

    const period: 'monthly' | 'weekly' | 'yearly' =
      editingBudget?.period ?? 'monthly';

    const categoryId = (selectedCategoryId ?? editingBudget?.category.id)!;

    createBudgetMutation.mutate({
      categoryId,
      amountCents: amountNumber,
      period,
    });
  };

  const handleDeleteBudget = () => {
    if (!editingBudget) return;
    deleteBudgetMutation.mutate(editingBudget.id);
  };

  const handleSubmitRule = () => {
    if (!ruleAccountId && !editingRule) {
      setRuleError('Debes seleccionar una cuenta.');
      return;
    }
    if (!threshold.trim()) {
      setRuleError('Debes ingresar un saldo mínimo.');
      return;
    }

    const thRaw = threshold.replace(/\D/g, '');
    const thNumber = Number(thRaw);
    if (!thNumber || Number.isNaN(thNumber)) {
      setRuleError(
        'Saldo mínimo inválido. Escribe solo números, por ejemplo 100000.',
      );
      return;
    }

    let marginNumber: number | null = null;
    if (margin.trim()) {
      const mRaw = margin.replace(/\D/g, '');
      const mNum = Number(mRaw);
      if (!mNum || Number.isNaN(mNum)) {
        setRuleError(
          'Aviso anticipado inválido. Escribe solo números, por ejemplo 20000.',
        );
        return;
      }
      marginNumber = mNum;
    }

    if (editingRule) {
      updateRuleMutation.mutate({
        id: editingRule.id,
        thresholdCents: thNumber,
        notifyMarginCents: marginNumber,
      });
    } else {
      createRuleMutation.mutate({
        accountId: ruleAccountId!, // ya validado arriba
        thresholdCents: thNumber,
        notifyMarginCents: marginNumber,
      });
    }
  };

  const handleDeleteRule = () => {
    if (!editingRule) return;
    deleteRuleMutation.mutate(editingRule.id);
  };

  if (!token) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>Inicia sesión para ver tus presupuestos.</Text>
      </View>
    );
  }

  if (meLoading && !meData) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.textMuted}>Cargando tus cuentas…</Text>
      </View>
    );
  }

  if (!meData || meData.accounts.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>
          Aún no tienes cuentas configuradas. Vincula una desde la pestaña Cuenta.
        </Text>
      </View>
    );
  }

  if (!currentAccountId) {
    return (
      <View style={s.center}>
        <Text style={s.textMuted}>Selecciona una cuenta para ver tu ahorro.</Text>
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

  // cuántas reglas tienen al menos una alerta activa (solo de cuenta actual)
  const rulesAlertCount = savingsRules.filter(
    (r) => r.alerts && r.alerts.some((a) => a.isActive),
  ).length;

  // valores para el resumen de regla de ahorro (en el modal)
  const thDisplay = Number(threshold.replace(/\D/g, '')) || 0;
  const marginDisplay = Number(margin.replace(/\D/g, '')) || 0;
  const triggerDisplay = thDisplay + (margin.trim() ? marginDisplay : 0);

  const accountForHeader = meData.accounts.find((a) => a.id === currentAccountId);

  const accountLabel =
    accountForHeader?.alias ||
    accountForHeader?.bank ||
    (accountForHeader?.accountNumber
      ? `Cuenta ${accountForHeader.accountNumber}`
      : `Cuenta ${currentAccountId.slice(0, 6)}…`);

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
        {/* Selector de cuenta */}
        <View style={s.accountHeader}>
          <Text style={s.title}>Ahorro por cuenta</Text>
          <Text style={s.subtitle}>
            Estás viendo el ahorro de la siguiente cuenta:
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.accountChipsRow}
          >
            {meData.accounts.map((acc) => {
              const selected = acc.id === currentAccountId;
              const label =
                acc.alias ||
                acc.bank ||
                (acc.accountNumber
                  ? `Cuenta ${acc.accountNumber}`
                  : acc.id.slice(0, 6) + '…');
              return (
                <Pressable
                  key={acc.id}
                  style={[s.accountChip, selected && s.accountChipSelected]}
                  onPress={() => setCurrentAccountId(acc.id)}
                >
                  <Text
                    style={[
                      s.accountChipText,
                      selected && s.accountChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={s.subtitleSmall}>Cuenta actual: {accountLabel}</Text>
        </View>

        {/* PRESUPUESTOS (globales) */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Presupuestos del mes</Text>
            <Text style={s.subtitle}>
              Revisa cuánto has gastado por categoría y qué tan cerca estás de tu
              límite.
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
              Aún no tienes presupuestos configurados. Puedes crearlos desde aquí
              para controlar mejor tus gastos.
            </Text>
          </View>
        ) : (
          budgets.map((b) => {
            const pct = Math.min(1, Math.max(0, b.progress));
            const pctLabel = (pct * 100).toFixed(1) + '%';

            const barColor =
              b.isOver
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

        {/* Sección de ahorro mensual */}
        <View style={{ marginTop: 20 }}>
          <Text style={s.title}>Ahorro mensual (cuenta actual)</Text>
          <Text style={s.subtitle}>
            Resumen de tus últimos meses en esta cuenta: ingresos, gastos y cuánto
            lograste ahorrar.
          </Text>

          {savingsLoading && (
            <View style={{ marginTop: 8 }}>
              <ActivityIndicator />
              <Text style={s.textMuted}>Calculando tu ahorro…</Text>
            </View>
          )}

          {!savingsLoading && savingsError && (
            <Text style={[s.err, { marginTop: 8 }]}>
              No se pudo cargar el resumen de ahorro.
            </Text>
          )}

          {!savingsLoading && !savingsError && savingsOverview && (
            <View style={s.savingsCard}>
              {savingsOverview.averageSavingsRate !== null && (
                <Text style={s.savingsHighlight}>
                  Ahorro promedio:{' '}
                  {(savingsOverview.averageSavingsRate * 100).toFixed(1)}%
                </Text>
              )}

              <Text style={s.savingsSub}>
                Ahorro promedio mensual: {fmtCLP(savingsOverview.averageSavingsCents)}
              </Text>

              {savingsOverview.months.map((m) => {
                const isNegative = m.savingsCents < 0;
                return (
                  <View key={m.month} style={s.savingsRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={s.savingsMonth}>{m.month}</Text>
                    </View>
                    <View style={{ flex: 3 }}>
                      <Text style={s.savingsLabel}>Ingresos</Text>
                      <Text style={s.savingsValue}>{fmtCLP(m.incomeCents)}</Text>
                    </View>
                    <View style={{ flex: 3 }}>
                      <Text style={s.savingsLabel}>Gastos</Text>
                      <Text style={s.savingsValue}>{fmtCLP(m.expenseCents)}</Text>
                    </View>
                    <View style={{ flex: 3 }}>
                      <Text style={s.savingsLabel}>Ahorro</Text>
                      <Text
                        style={[
                          s.savingsValue,
                          isNegative && { color: colors.danger ?? '#ef4444' },
                        ]}
                      >
                        {fmtCLP(m.savingsCents)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Sección reglas de ahorro */}
        <View style={{ marginTop: 24, marginBottom: 8 }}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Reglas de ahorro</Text>
              <Text style={s.subtitle}>
                Reglas para avisarte cuando el saldo de esta cuenta baja de cierto
                nivel.
              </Text>
            </View>

            <Pressable
              style={s.addButton}
              onPress={() => {
                setEditingRule(null);
                setRuleAccountId(currentAccountId); // por defecto la cuenta visible
                setThreshold('');
                setMargin('');
                setRuleError(null);
                setShowRuleForm(true);
              }}
            >
              <Text style={s.addButtonText}>+ Regla</Text>
            </Pressable>
          </View>

          {rulesLoading && (
            <View style={{ marginTop: 8 }}>
              <ActivityIndicator />
              <Text style={s.textMuted}>Cargando reglas de ahorro…</Text>
            </View>
          )}

          {!rulesLoading && rulesError && (
            <Text style={[s.err, { marginTop: 8 }]}>
              No se pudieron cargar las reglas de ahorro.
            </Text>
          )}

          {!rulesLoading && !rulesError && savingsRules.length === 0 && (
            <View style={s.emptyBox}>
              <Text style={s.textMuted}>
                Aún no tienes reglas de ahorro configuradas para esta cuenta. Crea
                una para recibir alertas cuando se acerque a tu saldo mínimo.
              </Text>
            </View>
          )}

          {!rulesLoading && !rulesError && savingsRules.length > 0 && (
            <View style={s.rulesCard}>
              {rulesAlertCount > 0 && (
                <Text style={s.rulesSummary}>
                  {rulesAlertCount === 1
                    ? '1 regla tiene una alerta activa.'
                    : `${rulesAlertCount} reglas tienen alertas activas.`}
                </Text>
              )}

              {savingsRules.map((rule) => {
                const acc = rule.account;
                const accountLabelRule =
                  acc.alias ||
                  acc.bank ||
                  `Cuenta ${acc.accountNumber ?? acc.id.slice(0, 6) + '…'}`;

                const avisoDesdeCents = rule.notifyMarginCents
                  ? rule.thresholdCents + rule.notifyMarginCents
                  : rule.thresholdCents;

                const activeAlert = rule.alerts?.find((a) => a.isActive);
                const level = activeAlert?.level;
                const isCritical = level === 'CRITICAL';
                const isWarning = level === 'WARNING';

                let statusLabel = 'En rango sano';
                if (isCritical) statusLabel = 'Por debajo del mínimo';
                else if (isWarning) statusLabel = 'Cerca del mínimo';

                return (
                  <Pressable
                    key={rule.id}
                    style={s.ruleRow}
                    onPress={() => {
                      setEditingRule(rule);
                      setRuleAccountId(rule.account.id);
                      setThreshold(String(rule.thresholdCents));
                      setMargin(
                        rule.notifyMarginCents
                          ? String(rule.notifyMarginCents)
                          : '',
                      );
                      setRuleError(null);
                      setShowRuleForm(true);
                    }}
                  >
                    <View style={{ flex: 3 }}>
                      <Text style={s.ruleAccount}>{accountLabelRule}</Text>
                      <Text style={s.ruleSub}>
                        Saldo actual: {fmtCLP(acc.balanceCents)} {acc.currency}
                      </Text>

                      {activeAlert ? (
                        <View style={s.ruleStatusBadge}>
                          <Text
                            style={[
                              s.ruleStatusText,
                              isCritical && s.ruleStatusCritical,
                              isWarning && s.ruleStatusWarning,
                            ]}
                            numberOfLines={2}
                          >
                            {activeAlert.message ?? statusLabel}
                          </Text>
                        </View>
                      ) : (
                        <Text style={s.ruleOkText}>{statusLabel}</Text>
                      )}
                    </View>

                    <View style={{ flex: 2 }}>
                      <Text style={s.ruleLabel}>Saldo mínimo</Text>
                      <Text style={s.ruleValue}>
                        {fmtCLP(rule.thresholdCents)}
                      </Text>
                    </View>

                    <View style={{ flex: 2 }}>
                      <Text style={s.ruleLabel}>Aviso desde</Text>
                      <Text style={s.ruleValue}>
                        {rule.notifyMarginCents
                          ? fmtCLP(avisoDesdeCents)
                          : 'Igual al saldo mínimo'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
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
                              style={[
                                s.chipLabel,
                                selected && s.chipLabelSelected,
                              ]}
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

            {saveError && (
              <Text style={[s.err, { marginBottom: 6 }]}>{saveError}</Text>
            )}

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
                disabled={
                  createBudgetMutation.isPending ||
                  deleteBudgetMutation.isPending
                }
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

      {/* Modal para crear/editar regla de ahorro */}
      <Modal
        visible={showRuleForm}
        animationType="slide"
        transparent
        onRequestClose={resetRuleForm}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>
              {editingRule ? 'Editar regla de ahorro' : 'Nueva regla de ahorro'}
            </Text>

            {/* Cuenta */}
            <View style={s.modalSection}>
              <Text style={s.label}>Cuenta</Text>

              {editingRule ? (
                <Text style={s.textMuted}>
                  {editingRule.account.alias ||
                    editingRule.account.bank ||
                    `Cuenta ${
                      editingRule.account.accountNumber ??
                      editingRule.account.id.slice(0, 6) + '…'
                    }`}{' '}
                  (no editable)
                </Text>
              ) : (
                <>
                  {!meData && (
                    <Text style={s.textMuted}>
                      Cargando cuentas… o aún no se han podido obtener.
                    </Text>
                  )}

                  {meData && meData.accounts.length === 0 && (
                    <Text style={s.textMuted}>
                      No tienes cuentas configuradas en tu perfil.
                    </Text>
                  )}

                  {meData && meData.accounts.length > 0 && (
                    <View style={s.chipsRow}>
                      {meData.accounts.map((acc) => {
                        const selected = acc.id === ruleAccountId;
                        const label =
                          acc.alias ||
                          acc.bank ||
                          `Cuenta ${
                            acc.accountNumber ?? acc.id.slice(0, 6) + '…'
                          }`;
                        return (
                          <Pressable
                            key={acc.id}
                            style={[s.chip, selected && s.chipSelected]}
                            onPress={() => setRuleAccountId(acc.id)}
                          >
                            <Text
                              style={[
                                s.chipLabel,
                                selected && s.chipLabelSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Saldo mínimo */}
            <View style={s.modalSection}>
              <Text style={s.label}>Saldo mínimo que quieres mantener (CLP)</Text>
              <Text style={s.fieldHelp}>
                Es el saldo mínimo que quieres mantener en esta cuenta. Cuando el saldo
                baja de este monto, se activa la alerta.
              </Text>
              <TextInput
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="numeric"
                placeholder="Ej: 100000"
                placeholderTextColor={colors.textMuted}
                style={s.input}
              />
            </View>

            {/* Aviso anticipado */}
            <View style={s.modalSection}>
              <Text style={s.label}>Avisarme un poco antes (CLP, opcional)</Text>
              <Text style={s.fieldHelp}>
                Es el “colchón” sobre el saldo mínimo. Si pones 20000 y tu saldo mínimo
                es 100000, te avisamos cuando el saldo llegue a 120000.
              </Text>
              <TextInput
                value={margin}
                onChangeText={setMargin}
                keyboardType="numeric"
                placeholder="Ej: 20000"
                placeholderTextColor={colors.textMuted}
                style={s.input}
              />
              <Text style={s.textMuted}>
                Si lo dejas vacío, te avisamos directamente cuando el saldo cruce tu
                saldo mínimo.
              </Text>

              {thDisplay > 0 && (
                <Text style={s.summaryText}>
                  Te avisaremos cuando el saldo de esta cuenta baje de{' '}
                  {fmtCLP(margin.trim() ? triggerDisplay : thDisplay)}.
                </Text>
              )}
            </View>

            {ruleError && (
              <Text style={[s.err, { marginBottom: 6 }]}>{ruleError}</Text>
            )}

            {/* Botones regla */}
            <View style={s.modalButtonsRow}>
              {editingRule && (
                <Pressable
                  style={[s.modalButton, s.modalButtonDanger]}
                  onPress={handleDeleteRule}
                  disabled={deleteRuleMutation.isPending}
                >
                  <Text style={s.modalButtonDangerText}>
                    {deleteRuleMutation.isPending ? 'Eliminando…' : 'Eliminar'}
                  </Text>
                </Pressable>
              )}

              <View style={{ flex: 1 }} />

              <Pressable
                style={[s.modalButton, s.modalButtonSecondary]}
                onPress={resetRuleForm}
                disabled={
                  createRuleMutation.isPending ||
                  updateRuleMutation.isPending ||
                  deleteRuleMutation.isPending
                }
              >
                <Text style={s.modalButtonSecondaryText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[
                  s.modalButton,
                  (!ruleAccountId && !editingRule) || !threshold.trim()
                    ? { opacity: 0.5 }
                    : null,
                ]}
                onPress={handleSubmitRule}
                disabled={
                  (!ruleAccountId && !editingRule) ||
                  !threshold.trim() ||
                  createRuleMutation.isPending ||
                  updateRuleMutation.isPending ||
                  deleteRuleMutation.isPending
                }
              >
                <Text style={s.modalButtonText}>
                  {createRuleMutation.isPending || updateRuleMutation.isPending
                    ? 'Guardando…'
                    : editingRule
                    ? 'Guardar cambios'
                    : 'Guardar regla'}
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

  accountHeader: {
    marginBottom: 12,
  },
  accountChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingRight: 8,
  },
  accountChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: 200,
  },
  accountChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  accountChipText: {
    fontSize: 12,
    color: colors.text,
  },
  accountChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  subtitleSmall: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
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

  // Sección ahorro
  savingsCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  savingsHighlight: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  savingsSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    gap: 8,
  },
  savingsMonth: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  savingsLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  savingsValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },

  // Reglas de ahorro
  rulesCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  rulesSummary: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ruleAccount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  ruleSub: {
    color: colors.textMuted,
    fontSize: 11,
  },
  ruleLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  ruleValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  ruleStatusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  ruleStatusText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  ruleStatusCritical: {
    color: colors.danger ?? '#ef4444',
    fontWeight: '700',
  },
  ruleStatusWarning: {
    color: colors.warning ?? '#facc15',
    fontWeight: '600',
  },
  ruleOkText: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textMuted,
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
  fieldHelp: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  summaryText: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textMuted,
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
