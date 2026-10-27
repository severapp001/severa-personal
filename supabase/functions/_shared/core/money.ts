// Copiado de src/core/money.ts por scripts/bot-core.js. No editar aquí.
// Montos en pesos chilenos. Sin Intl a propósito: Hermes en Android no siempre trae es-CL.

export const MASKED_AMOUNT = '$ •••••';

export function formatCLP(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const digits = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '−' : ''}$${digits}`;
}

/** Texto que se muestra: el monto, o la máscara si está oculto (preferencia hide_amounts). */
export function displayAmount(amount: number, visible: boolean): string {
  return visible ? formatCLP(amount) : MASKED_AMOUNT;
}
