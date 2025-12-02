// utils/format.ts

// Formatea valores en pesos chilenos tal como vienen del backend (sin dividir por 100)
export const fmtCLP = (amount: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);

// Fecha estándar para todos los movimientos, alertas, etc.
export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });