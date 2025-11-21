// app/(tabs)/cuenta.tsx  (o src/screens/AccountScreen.tsx)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/theme';
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';
import { fmtCLP } from '@/utils/format';

type AccountType =
  | 'CUENTA_CORRIENTE'
  | 'CUENTA_VISTA'
  | 'CUENTA_AHORRO'
  | 'TARJETA_CREDITO';

type Currency = 'CLP' | 'USD' | 'EUR';

type Account = {
  id: string;
  bank: string;
  accountType: AccountType;
  accountNumber: string;
  holderName: string;
  alias?: string | null;
  balanceCents: number;
  currency: Currency;
};

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CUENTA_CORRIENTE: 'Cuenta corriente',
  CUENTA_VISTA: 'Cuenta vista',
  CUENTA_AHORRO: 'Cuenta de ahorro',
  TARJETA_CREDITO: 'Tarjeta de crédito',
};

const CURRENCY_LABEL: Record<Currency, string> = {
  CLP: 'CLP',
  USD: 'USD',
  EUR: 'EUR',
};

export default function AccountScreen() {
  const { token } = useAuth();

  const [bank, setBank] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('CUENTA_CORRIENTE');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [alias, setAlias] = useState('');
  const [currency, setCurrency] = useState<Currency>('CLP');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const enabled = !!token;

  const {
    data: accounts = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Account[]>({
    queryKey: ['accounts'],
    enabled,
    queryFn: async () => {
      const r = await api.get('/accounts');
      // normalizamos por si el backend envía { data: [...] }
      const raw = r.data;
      if (Array.isArray(raw)) return raw as Account[];
      if (Array.isArray(raw?.data)) return raw.data as Account[];
      return [];
    },
    staleTime: 60_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  const validate = () => {
    if (!bank.trim()) return 'Ingresa el banco';
    if (!holderName.trim()) return 'Ingresa el nombre del titular';
    if (!accountNumber.trim()) return 'Ingresa el número de cuenta';
    return null;
  };

  const onSubmit = async () => {
    setFormError(null);
    setSuccessMsg(null);

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        bank: bank.trim(),
        accountType,
        accountNumber: accountNumber.trim(),
        holderName: holderName.trim(),
        alias: alias.trim() || undefined,
        currency,
      };

      await api.post('/accounts', payload);

      setSuccessMsg('Cuenta vinculada correctamente');
      setBank('');
      setAccountNumber('');
      setHolderName('');
      setAlias('');
      // refrescar lista
      await refetch();
    } catch (e: any) {
      const status = e?.response?.status;
      const backendMsg = e?.response?.data?.message;

      if (status === 409) {
        setFormError(
          'Ya existe una cuenta con ese banco, tipo y número para este usuario',
        );
      } else if (backendMsg) {
        setFormError(String(backendMsg));
      } else if (e?.message?.includes('Network')) {
        setFormError('No se pudo conectar con el servidor');
      } else {
        setFormError('Error al vincular la cuenta');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) {
    return (
      <View style={s.center}>
        <Text style={s.title}>Cuenta</Text>
        <Text style={s.muted}>Inicia sesión para gestionar tus cuentas bancarias.</Text>
      </View>
    );
  }

  if (isLoading && !isRefetching) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    const msg =
      (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'Error cargando cuentas';
    return (
      <View style={s.center}>
        <Text style={s.title}>Cuenta</Text>
        <Text style={s.err}>{msg}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Cuenta</Text>

      {/* Sección: Cuentas vinculadas */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Cuentas vinculadas</Text>
          {isRefetching && <ActivityIndicator size="small" />}
        </View>

        {accounts.length === 0 ? (
          <Text style={s.muted}>
            Aún no tienes cuentas vinculadas. Agrega una abajo para comenzar.
          </Text>
        ) : (
          accounts.map((acc) => {
            const saldo = fmtCLP(acc.balanceCents ?? 0);
            return (
              <View key={acc.id} style={s.accountRow}>
                <View style={s.accountLeft}>
                  <Text style={s.accountBank}>{acc.bank}</Text>
                  <Text style={s.accountMeta}>
                    {ACCOUNT_TYPE_LABEL[acc.accountType]} · {acc.accountNumber}
                  </Text>
                  {acc.alias ? (
                    <Text style={s.accountAlias}>Alias: {acc.alias}</Text>
                  ) : null}
                </View>
                <View style={s.accountRight}>
                  <Text style={s.accountBalance}>{saldo}</Text>
                  <Text style={s.accountCurrency}>
                    {CURRENCY_LABEL[acc.currency]}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Sección: Vincular nueva cuenta */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Vincular nueva cuenta</Text>

        <Text style={s.label}>Banco</Text>
        <TextInput
          style={s.input}
          value={bank}
          onChangeText={(t) => {
            setBank(t);
            if (formError) setFormError(null);
          }}
          placeholder="Ej: Banco Estado"
          placeholderTextColor={colors.mutedText ?? '#6b7280'}
        />

        <Text style={s.label}>Nombre titular</Text>
        <TextInput
          style={s.input}
          value={holderName}
          onChangeText={(t) => {
            setHolderName(t);
            if (formError) setFormError(null);
          }}
          placeholder="Nombre como aparece en el banco"
          placeholderTextColor={colors.mutedText ?? '#6b7280'}
        />

        <Text style={s.label}>Número de cuenta</Text>
        <TextInput
          style={s.input}
          value={accountNumber}
          onChangeText={(t) => {
            setAccountNumber(t);
            if (formError) setFormError(null);
          }}
          placeholder="Ej: 123456789"
          keyboardType="numeric"
          placeholderTextColor={colors.mutedText ?? '#6b7280'}
        />

        <Text style={s.label}>Alias (opcional)</Text>
        <TextInput
          style={s.input}
          value={alias}
          onChangeText={(t) => {
            setAlias(t);
            if (formError) setFormError(null);
          }}
          placeholder="Ej: Cuenta sueldo"
          placeholderTextColor={colors.mutedText ?? '#6b7280'}
        />

        <Text style={s.label}>Tipo de cuenta</Text>
        <View style={s.chipsRow}>
          {(
            [
              'CUENTA_CORRIENTE',
              'CUENTA_VISTA',
              'CUENTA_AHORRO',
            ] as AccountType[]
          ).map((type) => (
            <Pressable
              key={type}
              style={[
                s.chip,
                accountType === type && s.chipActive,
              ]}
              onPress={() => setAccountType(type)}
            >
              <Text
                style={[
                  s.chipText,
                  accountType === type && s.chipTextActive,
                ]}
              >
                {ACCOUNT_TYPE_LABEL[type]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Moneda</Text>
        <View style={s.chipsRow}>
          {(['CLP', 'USD', 'EUR'] as Currency[]).map((cur) => (
            <Pressable
              key={cur}
              style={[
                s.chipSmall,
                currency === cur && s.chipActive,
              ]}
              onPress={() => setCurrency(cur)}
            >
              <Text
                style={[
                  s.chipText,
                  currency === cur && s.chipTextActive,
                ]}
              >
                {CURRENCY_LABEL[cur]}
              </Text>
            </Pressable>
          ))}
        </View>

        {formError ? <Text style={s.err}>{formError}</Text> : null}
        {successMsg ? <Text style={s.success}>{successMsg}</Text> : null}

        <Pressable
          style={[s.btn, submitting && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={s.btnText}>
            {submitting ? 'Vinculando…' : 'Vincular cuenta'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  muted: {
    color: colors.mutedText ?? '#6b7280',
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  accountLeft: {
    flexShrink: 1,
    paddingRight: 12,
  },
  accountBank: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  accountMeta: {
    color: colors.mutedText ?? '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  accountAlias: {
    color: colors.mutedText ?? '#9ca3af',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  accountRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  accountBalance: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  accountCurrency: {
    color: colors.mutedText ?? '#9ca3af',
    fontSize: 12,
  },
  label: {
    color: colors.mutedText ?? '#9ca3af',
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primary ?? '#0ea5e9',
    borderColor: colors.primary ?? '#0ea5e9',
  },
  chipText: {
    fontSize: 12,
    color: colors.mutedText ?? '#9ca3af',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  btn: {
    marginTop: 16,
    backgroundColor: colors.primary ?? '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  err: {
    color: colors.danger ?? '#ef4444',
    marginTop: 8,
    fontSize: 13,
  },
  success: {
    color: '#22c55e',
    marginTop: 8,
    fontSize: 13,
  },
});
