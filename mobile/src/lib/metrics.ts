import type { Tx } from "@/hooks/useTransactions";

export function sumCents(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

export function calcBalanceCents(txs: Tx[]) {
  return sumCents(txs.map(t => t.valueCents)); // créditos +, débitos -
}

/** Ahorro del mes actual = créditos - débitos del mes en curso */
export function calcSavingsThisMonthCents(txs: Tx[]) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(); // 0-11
  const monthTxs = txs.filter(t => {
    const d = new Date(t.bookedAt);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const credits = sumCents(monthTxs.filter(t => t.type === "credit").map(t => t.valueCents));
  const debitsAbs = Math.abs(sumCents(monthTxs.filter(t => t.type === "debit").map(t => t.valueCents)));
  return credits - debitsAbs; // si >0, ahorraste
}

/** Serie diaria de gasto (solo débitos, en positivo) para gráfico */
export function dailySpendSeries(txs: Tx[], days = 8) {
  // últimos N días
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  const bucket: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    bucket[key] = 0;
  }

  txs.forEach(t => {
    const key = new Date(t.bookedAt).toISOString().slice(0,10);
    if (bucket[key] !== undefined && t.type === "debit") {
      bucket[key] += Math.abs(t.valueCents) / 100; // a CLP
    }
  });

  const labels = Object.keys(bucket).map(k => k.slice(8,10)); // día
  const data = Object.values(bucket);
  return { labels, data };
}