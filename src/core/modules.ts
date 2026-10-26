// Cálculos de los módulos del motor común (26-10-2026): gastos compartidos, ciclo, IMC y
// calorías, semana de ejercicio y vencimientos. Dominio puro: sin React ni base de datos.
// Fechas «AAAA-MM-DD».

const parse = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const plusDays = (day: string, n: number) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);

// ─── Gastos compartidos ──────────────────────────────────────────────────────

export type SharedExpense = { amount: number; payer: string; among: string[] };
export type SharedPayment = { from: string; to: string; amount: number };

/** Saldo de cada persona: positivo = le deben; negativo = debe. Se reparte en partes iguales. */
export function sharedBalances(people: string[], expenses: SharedExpense[], payments: SharedPayment[]): Record<string, number> {
  const net: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));
  for (const e of expenses) {
    const among = e.among.filter((p) => people.includes(p));
    const split = among.length ? among : people;
    if (!split.length || !e.amount) continue;
    net[e.payer] = (net[e.payer] ?? 0) + e.amount;
    for (const p of split) net[p] = (net[p] ?? 0) - e.amount / split.length;
  }
  for (const p of payments) {
    net[p.from] = (net[p.from] ?? 0) + p.amount;
    net[p.to] = (net[p.to] ?? 0) - p.amount;
  }
  return Object.fromEntries(Object.entries(net).map(([k, v]) => [k, Math.round(v)]));
}

/** Quién le paga a quién para quedar a mano, con la menor cantidad de pagos posible (aprox.). */
export function settle(balances: Record<string, number>): SharedPayment[] {
  const debtors = Object.entries(balances).filter(([, v]) => v < 0).map(([p, v]) => ({ p, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(balances).filter(([, v]) => v > 0).map(([p, v]) => ({ p, v })).sort((a, b) => b.v - a.v);
  const out: SharedPayment[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    if (amount >= 1) out.push({ from: debtors[i].p, to: creditors[j].p, amount: Math.round(amount) });
    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v < 1) i++;
    if (creditors[j].v < 1) j++;
  }
  return out;
}

// ─── Ciclo ───────────────────────────────────────────────────────────────────

export type CyclePrediction = { average: number; next: string; ovulation: string; fertileFrom: string; fertileTo: string; daysToNext: number; dayOfCycle: number; known: number };

/**
 * Próximo período con el promedio de tus ciclos (entre 15 y 60 días; 28 si aún no hay dos).
 * La ovulación se estima 14 días antes y la ventana fértil va de 5 días antes a 1 después.
 */
export function predictCycle(starts: string[], today: string): CyclePrediction | null {
  const sorted = [...new Set(starts)].sort();
  if (!sorted.length) return null;
  const gaps = sorted.slice(1).map((d, i) => daysBetween(sorted[i], d)).filter((g) => g >= 15 && g <= 60).slice(-6);
  const average = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : 28;
  const last = sorted.at(-1)!;
  let next = plusDays(last, average);
  while (next < today) next = plusDays(next, average);
  const ovulation = plusDays(next, -14);
  return {
    average,
    next,
    ovulation,
    fertileFrom: plusDays(ovulation, -5),
    fertileTo: plusDays(ovulation, 1),
    daysToNext: daysBetween(today, next),
    dayOfCycle: daysBetween(plusDays(next, -average), today) + 1,
    known: gaps.length,
  };
}

// ─── IMC y calorías ──────────────────────────────────────────────────────────

/** IMC con la clasificación de la OMS para adultos. */
export function bmi(weightKg: number, heightCm: number): { value: number; label: string; tone: 'ok' | 'mid' | 'bad' } | null {
  if (!weightKg || !heightCm || heightCm < 80 || heightCm > 250) return null;
  const value = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
  if (value < 18.5) return { value, label: 'Bajo peso', tone: 'mid' };
  if (value < 25) return { value, label: 'Peso normal', tone: 'ok' };
  if (value < 30) return { value, label: 'Sobrepeso', tone: 'mid' };
  return { value, label: 'Obesidad', tone: 'bad' };
}

const ACTIVITY: Record<string, number> = { Poca: 1.2, Ligera: 1.375, Moderada: 1.55, Alta: 1.725 };

/** Calorías al día con la fórmula de Mifflin-St Jeor (estimación) y el factor de actividad. */
export function dailyCalories(weightKg: number, heightCm: number, age: number | null, sex: string | null, activity: string | null): { basal: number; total: number } | null {
  if (!weightKg || !heightCm || !age || (sex !== 'Mujer' && sex !== 'Hombre')) return null;
  const basal = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'Hombre' ? 5 : -161);
  return { basal: Math.round(basal), total: Math.round((basal * (ACTIVITY[activity ?? 'Ligera'] ?? 1.375)) / 10) * 10 };
}

// ─── Ejercicio ───────────────────────────────────────────────────────────────

/** Lunes de la semana de `day`. */
export function weekStart(day: string): string {
  const wd = parse(day).getDay();
  return plusDays(day, wd === 0 ? -6 : 1 - wd);
}

/** Minutos por día de la semana (lunes a domingo) y el total. */
export function weekMinutes(sessions: { day: string | null; value: number | null }[], today: string): { days: { day: string; minutes: number }[]; total: number } {
  const start = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = plusDays(start, i);
    return { day, minutes: sessions.filter((s) => s.day === day).reduce((sum, s) => sum + (Number(s.value) || 0), 0) };
  });
  return { days, total: days.reduce((s, d) => s + d.minutes, 0) };
}

// ─── Vencimientos ────────────────────────────────────────────────────────────

/** Estado de una fecha de vencimiento. */
export function expiry(until: string | null, today: string): { days: number; label: string; tone: 'ok' | 'mid' | 'bad' } | null {
  if (!until) return null;
  const days = daysBetween(today, until);
  if (days < 0) return { days, label: `Venció hace ${-days} ${days === -1 ? 'día' : 'días'}`, tone: 'bad' };
  if (days === 0) return { days, label: 'Vence hoy', tone: 'bad' };
  if (days <= 30) return { days, label: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'mid' };
  return { days, label: `Vence el ${until.slice(8, 10)}-${until.slice(5, 7)}-${until.slice(0, 4)}`, tone: 'ok' };
}

/** Racha de días seguidos (hasta hoy o ayer) dentro de un conjunto de días. */
export function streak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : plusDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = plusDays(cursor, -1);
  }
  return n;
}
