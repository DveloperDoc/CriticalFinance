export const fmtCLP = (cents: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });