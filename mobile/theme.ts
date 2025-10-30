export const colors = {
  // Fondo y contenedores
  bg: '#0B0B0E',
  card: '#15151A',
  border: '#23232A',

  // Texto
  text: '#EDEDED',
  textMuted: '#A5A7AF',
  muted: '#A5A7AF',      // alias útil

  // Acentos
  primary: '#4F8EF7',
  success: '#2ECC71',
  danger: '#FF6B6B',

  // Chips / Tabs
  chip: '#1D1E24',
  chipBg: '#1D1E24',
  tabInactive: '#8A8D96',

  // 👉 Aliases para código existente
  accent: '#4F8EF7',     // igual que primary
  line: '#23232A',       // igual que border
} as const;

export type Colors = typeof colors;