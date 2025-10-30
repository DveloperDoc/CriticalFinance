import React, { useMemo } from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet } from 'react-native';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

import { colors } from '@/theme';
import { fmtCLP } from '@/utils/format';

// Emulador Android => 10.0.2.2 | Teléfono físico => IP de tu PC
const API_URL = 'http://10.0.2.2:3000/transactions';

type Category = { id: string; name: string; color?: string | null } | null;
type Tx = {
  id: string;
  merchant?: string | null;
  description?: string | null;
  valueCents: number;
  category?: Category;
  bookedAt: string;
};

export default function HomeScreen() {
  const { data } = useQuery<Tx[]>({
    queryKey: ['transactions', { take: 100 }],
    queryFn: async () => (await axios.get(API_URL, { params: { take: 100 } })).data,
    staleTime: 30_000,
  });

  const { balance, gasto30d } = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);

    let bal = 0;
    let gasto = 0;

    (data ?? []).forEach((t) => {
      bal += t.valueCents;
      const when = new Date(t.bookedAt).getTime();
      if (when >= from.getTime() && t.valueCents < 0) gasto += Math.abs(t.valueCents);
    });

    return { balance: bal, gasto30d: gasto };
  }, [data]);

  return (
    <SafeAreaView style={s.container}>
      {/* Tarjetas resumen */}
      <View style={s.cardsRow}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Monto Actual</Text>
          <Text style={s.cardValue}>{fmtCLP(balance ?? 0)}</Text>
          <Text style={s.cardSub}>+20 % mes anterior</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Ahorro Actual</Text>
          <Text style={s.cardValue}>{fmtCLP(Math.max(0, (balance ?? 0) * 0.35))}</Text>
          <Text style={s.cardSub}>+12 % mes anterior</Text>
        </View>
      </View>

      {/* “Gráfico” placeholder */}
      <View style={s.chartCard}>
        <Text style={s.sectionTitle}>Gasto total (30 días)</Text>
        <View style={s.chartBox}>
          <View style={s.chartLine} />
        </View>
        <Text style={s.chartFoot}>{fmtCLP(gasto30d)} en el período</Text>
      </View>

      {/* Contactos dummy */}
      <View style={s.listCard}>
        <Text style={s.sectionTitle}>Contactos</Text>
        <FlatList
          data={[
            { id: '1', n: 'Elynn Lee' },
            { id: '2', n: 'Oscar Dum' },
          ]}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  chartBox: {
    height: 120,
    borderRadius: 10,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartLine: { height: 2, backgroundColor: colors.primary, marginHorizontal: 8, marginBottom: 8 },
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
});