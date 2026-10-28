// Tarjetas de repaso con repetición espaciada (27-10-2026; inspirado en el sistema Leitner que usan
// Anki y Quizlet). Cada tarjeta está en una caja del 1 al 5: si la sabías sube de caja y se repasa
// más tarde; si no, vuelve a la caja 1 y se repasa mañana. Repasar justo antes de olvidar es lo que
// más ayuda a recordar.

/** Días hasta el próximo repaso según la caja. */
export const INTERVALS = [1, 2, 4, 8, 16];

const addDays = (day: string, n: number) => {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + n, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** La caja y el día del próximo repaso después de responder. */
export function review(box: number, knew: boolean, today: string): { box: number; day: string } {
  const next = knew ? Math.min(5, Math.max(1, box) + 1) : 1;
  return { box: next, day: addDays(today, INTERVALS[next - 1]) };
}

/** ¿Toca repasarla hoy? (sin fecha, o con la fecha ya llegada). */
export const isDue = (card: { day: string | null }, today: string) => !card.day || card.day <= today;
