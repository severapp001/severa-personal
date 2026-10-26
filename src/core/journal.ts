// Diario y Gratitud (MD6, frente P3, 25-10-2026), con la primera versión como referencia: el
// ánimo del día por colores, las actividades y la mirada de días buenos y malos.
// Dominio puro: sin React ni base de datos.

export type Mood = 1 | 2 | 3 | 4;
export type JournalDay = { id: string; day: string; mood: number | null; body: string | null; activities: string | null; closed: number | boolean | null };
export type Gratitude = { id: string; day: string; body: string };

export const MOODS: { value: Mood; label: string; tone: 'bad' | 'mid' | 'ok' | 'great' }[] = [
  { value: 1, label: 'Difícil', tone: 'bad' },
  { value: 2, label: 'Regular', tone: 'mid' },
  { value: 3, label: 'Bien', tone: 'ok' },
  { value: 4, label: 'Muy bien', tone: 'great' },
];
export const moodOf = (n: number | null | undefined) => MOODS.find((m) => m.value === n) ?? null;

export const SUGGESTED_ACTIVITIES = ['Ejercicio', 'Familia', 'Amigos', 'Trabajo', 'Estudio', 'Lectura', 'Descanso', 'Salir', 'Naturaleza', 'Oración', 'Pantallas', 'Comida rica'];

/** Las actividades se guardan como texto JSON; si viene algo raro, lista vacía. */
export function activitiesOf(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];
  } catch {
    return [];
  }
}

/** La entrada de un día (si hubiera dos, manda la última). */
export const dayEntry = <T extends { day: string }>(days: T[], day: string): T | null => days.filter((d) => d.day === day).at(-1) ?? null;

const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

/** Cuántos días hubo de cada ánimo en el rango. */
export function moodDistribution(days: JournalDay[], from: string, to: string): { mood: Mood; label: string; count: number }[] {
  const list = days.filter((d) => inRange(d.day, from, to) && d.mood);
  return MOODS.map((m) => ({ mood: m.value, label: m.label, count: list.filter((d) => Number(d.mood) === m.value).length }));
}

/** Las actividades más repetidas en los días buenos (Bien, Muy bien) y en los difíciles. */
export function activityInsights(days: JournalDay[], from: string, to: string): { good: { name: string; count: number }[]; bad: { name: string; count: number }[] } {
  const count = (filter: (m: number) => boolean) => {
    const totals = new Map<string, number>();
    for (const d of days) {
      if (!inRange(d.day, from, to) || !d.mood || !filter(Number(d.mood))) continue;
      for (const a of activitiesOf(d.activities)) totals.set(a, (totals.get(a) ?? 0) + 1);
    }
    return [...totals.entries()].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
  };
  return { good: count((m) => m >= 3), bad: count((m) => m === 1) };
}

/** Días seguidos con diario, contando hacia atrás desde hoy (o desde ayer si hoy todavía no). */
export function journalStreak(days: { day: string }[], today: string, addDays: (day: string, n: number) => string): number {
  const set = new Set(days.map((d) => d.day));
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}
