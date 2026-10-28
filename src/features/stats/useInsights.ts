import { findInsights, missingFor, type DayFacts } from '@/core/insights';
import { plusDays } from '@/core/modules';

import { useLifeStats } from './useLifeStats';

// Los días de las últimas 8 semanas con lo que se registró en cada módulo, para que el cerebro
// busque lo que se repite (27-10-2026). Lo que nunca se registra queda sin dato, no como «no».

const DAYS = 56;

export function useInsights(today: string) {
  const s = useLifeStats(today);
  const e = s.entries.entries;
  const sum = (list: { day: string | null; value: number | null }[], day: string) => list.filter((x) => x.day === day).reduce((n, x) => n + (Number(x.value) || 0), 0);
  const exercise = e.filter((x) => x.module === 'ejercicio' && x.kind === 'sesion');
  const calm = e.filter((x) => (x.module === 'meditacion' || x.module === 'respiracion') && x.kind === 'sesion');
  const checks = new Map(e.filter((x) => x.module === 'cuerpo_mente_alma' && x.kind === 'chequeo').map((x) => [x.day, x.data]));
  const steps = e.filter((x) => x.module === 'metas' && x.kind === 'paso' && x.done && x.data.hecho);
  const tramos = e.filter((x) => x.module === 'trabajo' && x.kind === 'tramo');
  const bible = new Set(e.filter((x) => x.kind === 'pan' || x.kind === 'lectura').map((x) => x.day));
  const gratitude = new Set(s.journal.gratitude.map((g) => g.day));
  const moods = new Map(s.journal.days.map((d) => [d.day, d.mood === null ? null : Number(d.mood)]));
  const expenses = s.finance.movements.filter((m) => m.kind === 'expense');
  const goodIds = new Set(s.habits.good.map((h) => h.id));
  const target = (id: string) => Number(s.habits.good.find((h) => h.id === id)?.daily_target) || 1;

  const days: DayFacts[] = Array.from({ length: DAYS }, (_, i) => {
    const day = plusDays(today, i - DAYS + 1);
    const check = checks.get(day);
    const done = s.habits.good.filter((h) => s.logs.filter((l) => l.habit_id === h.id && l.day === day).reduce((n, l) => n + Number(l.count), 0) >= target(h.id)).length;
    return {
      day,
      mood: moods.get(day) ?? null,
      body: check ? Number(check.cuerpo) || null : null,
      mind: check ? Number(check.mente) || null : null,
      soul: check ? Number(check.alma) || null : null,
      exercise: exercise.length ? sum(exercise, day) : undefined,
      calm: calm.length ? sum(calm, day) : undefined,
      habitsDone: goodIds.size ? done : undefined,
      habitsTotal: goodIds.size || undefined,
      gratitude: gratitude.size ? gratitude.has(day) : undefined,
      bible: bible.size ? bible.has(day) : undefined,
      goalSteps: steps.length ? steps.filter((x) => x.data.hecho === day).length : undefined,
      workHours: tramos.length ? sum(tramos, day) : undefined,
      spent: expenses.length ? expenses.filter((m) => m.occurred_on === day).reduce((n, m) => n + Number(m.amount), 0) : undefined,
    };
  });
  return { insights: findInsights(days), missing: missingFor(days) };
}
