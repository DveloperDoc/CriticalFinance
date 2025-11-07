// app/(tabs)/index.tsx
import React, { useMemo } from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/theme';
import { fmtCLP } from '@/utils/format';
// Usa el MISMO cliente que usa setAuthToken
import { api } from '@/api/client';
import { useAuth } from '@/providers/AuthProvider';

type Category = { id: string; name: string; color?: string | null } | null;
type Tx = {
  id: string;
  merchant?: string | null;
  description?: string | null;
  valueCents: number;
  category?: Category;
  bookedAt: string; // ISO
};
type Me = { id: string; email: string; accounts: { id: string }[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Normalizadores defensivos
const normalizeMe = (raw: any): Me => {
  if (!raw) return { id: '', email: '', accounts: [] };
  if (raw?.id && Array.isArray(raw?.accounts)) return raw as Me;
  if (raw?.data?.id) return raw.data as Me;
  return { id: raw?.id ?? '', email: raw?.email ?? '', accounts: raw?.accounts ?? [] };
};
const normalizeTx = (raw: any): Tx[] => {
  if (Array.isArray(raw)) return raw as Tx[];
  if (Array.isArray(raw?.items)) return raw.items as Tx[];
  if (Array.isArray(raw?.data)) return raw.data as Tx[];
  if (Array.isArray(raw?.transactions)) return raw.transactions as Tx[];
  return [];
};

export default function HomeScreen() {
  const { token } = useAuth();

  // 1) /me → cuenta
  const meQ = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => normalizeMe((await api.get('/me')).data),
    enabled: !!token,
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  const accId = meQ.data?.accounts?.[0]?.id ?? null;

  // 2) Transacciones últimos 6 meses
  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth() - 5, 1)); // incluye mes actual y 5 previos
  const to = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)); // exclusivo

  const txQ = useQuery<Tx[]>({
    queryKey: ['transactions', accId, from, to],
    queryFn: async () => {
      const { data } = await api.get('/transactions', {
        params: { accountId: accId, from, to, take: 500, includeCategory: true },
      });
      return normalizeTx(data);
    },
    enabled: !!token && !!accId,
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 0,
  });

  // 3) KPIs y serie mensual
  const { balance, gasto30d, serieMensual } = useMemo(() => {
    const list = txQ.data ?? [];
    const now = new Date();
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);

    let bal = 0;
    let gasto = 0;

    // buckets 6 meses
    const buckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
      buckets.set(k, 0);
    }

    for (const t of list) {
      const when = new Date(t.bookedAt);
      const cents = Number(t.valueCents) || 0;
      bal += cents;

      if (when >= last30 && cents < 0) gasto += Math.abs(cents);

      const k = new Date(when.getFullYear(), when.getMonth(), 1)
        .toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });

      if (buckets.has(k) && cents < 0) {
        buckets.set(k, (buckets.get(k) || 0) + Math.abs(cents));
      }
    }

    const serie = Array.from(buckets.entries()).map(([label, cents]) => ({
      label,
      value: cents,
    }));

    return { balance: bal, gasto30d: gasto, serieMensual: serie };
  }, [txQ.data]);

  // Estados
  if (!token) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={s.cardSub}>No autenticado</Text>
      </SafeAreaView>
    );
  }

  if (meQ.isLoading || txQ.isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator /><Text style={s.cardSub}>Cargando…</Text></View>
      </SafeAreaView>
    );
  }

  if (meQ.isError || txQ.isError) {
    const err = (meQ.error as any) ?? (txQ.error as any);
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.message || 'Error';
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><Text style={s.err}>{status ? `${status} · ` : ''}{msg}</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Tarjetas resumen */}
      <View style={s.cardsRow}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Monto Actual</Text>
          <Text style={[s.cardValue, (balance ?? 0) < 0 && { color: colors.danger }]}>
            {fmtCLP(balance ?? 0)}
          </Text>
          <Text style={s.cardSub}>Saldo acumulado</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Gasto 30 días</Text>
          <Text style={[s.cardValue, { color: colors.danger }]}>{fmtCLP(gasto30d ?? 0)}</Text>
          <Text style={s.cardSub}>Solo débitos</Text>
        </View>
      </View>

      {/* Gráfico Meses vs Gasto */}
      <View style={s.chartCard}>
        <Text style={s.sectionTitle}>Gasto por mes (últimos 6)</Text>
        <Bars serie={serieMensual ?? []} />
        <Text style={s.chartFoot}>Se grafica |valor| de débitos</Text>
      </View>

      {/* Lista placeholder */}
      <View style={s.listCard}>
        <Text style={s.sectionTitle}>Contactos</Text>
        <FlatList
          data={[{ id: '1', n: 'Elynn Lee' }, { id: '2', n: 'Oscar Dum' }]}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <View style={s.rowBetween}>
              <View>
                <Text style={s.itemTitle}>{item.n}</Text>
                <Text style={s.itemSub}>correo@dominioficticio.net</Text>
              </View>
              <View style={s.dot} />
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

/** Gráfico simple de barras */
function Bars({ serie }: { serie: { label: string; value: number }[] }) {
  const max = Math.max(1, ...serie.map((d) => Number(d.value) || 0));
  if (serie.length === 0) {
    return <View style={[s.barsWrap, { alignItems: 'center', justifyContent: 'center' }]}><Text style={s.cardSub}>Sin datos</Text></View>;
  }
  return (
    <View style={s.barsWrap}>
      {serie.map((d) => {
        const v = Number(d.value) || 0;
        const h = Math.round((v / max) * 100); // 0..100
        return (
          <View key={d.label} style={s.barCol}>
            <View style={[s.bar, { height: Math.max(4, h), backgroundColor: colors.primary }]} />
            <Text style={s.barLabel}>{d.label}</Text>
            <Text style={s.barValue}>{fmtCLP(v)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  cardsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 8 },

  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  cardValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  cardSub: { color: colors.textMuted, marginTop: 4, fontSize: 12 },

  chartCard: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.text, fontWeight: '600', marginBottom: 8 },

  barsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 140,
    padding: 8,
    backgroundColor: colors.bg,
    borderRadius: 10,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 6, minHeight: 4 },
  barLabel: { color: colors.textMuted, fontSize: 10, marginTop: 6, textTransform: 'capitalize' },
  barValue: { color: colors.textMuted, fontSize: 10 },

  chartFoot: { color: colors.textMuted, marginTop: 6 },

  listCard: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  itemTitle: { color: colors.text, fontWeight: '600' },
  itemSub: { color: colors.textMuted, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  err: { color: colors.danger, textAlign: 'center' }, 
});