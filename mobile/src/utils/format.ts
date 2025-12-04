// utils/format.ts

// Recibe SIEMPRE montos en centavos (valueCents, balanceCents, amountCents, etc.)
export const fmtCLP = (amountCents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format((amountCents ?? 0) / 100);

// Fecha estándar para todos los movimientos, alertas, etc.
export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });