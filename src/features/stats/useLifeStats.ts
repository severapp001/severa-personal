import { progress } from '@/core/bible';
import { incomeStatement, lastMonths, monthKey } from '@/core/finance';
import { plusDays, streak, weekMinutes } from '@/core/modules';
import { useAgenda } from '@/data/agenda';
import { useBibleNotes } from '@/data/bible';
import { useEntries } from '@/data/entries';
import { useFinance } from '@/data/finance';
import { useJournal } from '@/data/journal';
import { useHabits, type HabitLog } from '@/data/modules';
import { usePersonalSpace, useRecords } from '@/data/records';
import { MODULES } from '@/features/modules/catalog';

// Lo que necesitan el Resumen, el Perfil y los Logros (26-10-2026): rachas, la semana, el mes de
// plata, el ánimo y cuánto se ha registrado en cada módulo. Todo sale de lo que ya registras.

const YEAR_DAYS = 371;

export function useLifeStats(today: string) {
  const space = usePersonalSpace();
  const from = plusDays(today, -YEAR_DAYS);
  const habits = useHabits(today);
  const logs = useRecords<HabitLog>('habit_logs', space, 'day', 'day >= ?', [from]).filter((l) => l.day >= from);
  const journal = useJournal();
  const finance = useFinance();
  const bible = useBibleNotes();
  const agenda = useAgenda(plusDays(today, -6), today);
  const entries = useEntries([...Object.keys(MODULES), 'diario', 'biblia', 'juegos', 'trabajo']);

  // Hábitos: días en que se cumplió al menos uno de los buenos, y cumplimiento de los últimos 7.
  const goodIds = new Set(habits.good.map((h) => h.id));
  const habitDays = new Set(logs.filter((l) => goodIds.has(l.habit_id)).map((l) => l.day));
  const week = Array.from({ length: 7 }, (_, i) => plusDays(today, i - 6));
  const target = (id: string) => Number(habits.good.find((h) => h.id === id)?.daily_target) || 1;
  const doneOn = (day: string) =>
    habits.good.filter((h) => logs.filter((l) => l.habit_id === h.id && l.day === day).reduce((s, l) => s + Number(l.count), 0) >= target(h.id)).length;
  const habitWeek = week.map((day) => ({ day, done: doneOn(day), total: habits.good.length }));
  const habitRate = habits.good.length ? Math.round((habitWeek.reduce((s, d) => s + d.done, 0) / (habits.good.length * 7)) * 100) : null;

  // Ánimo: los días con diario, y su color por día para el año.
  const moodByDay = new Map(journal.days.filter((d) => d.mood).map((d) => [d.day, Number(d.mood)]));
  const journalStreak = streak(journal.days.map((d) => d.day), today);

  // Plata: este mes y el anterior.
  const [prevMonth, thisMonth] = lastMonths(new Date(`${today}T12:00:00`), 2);
  const month = incomeStatement(finance.movements, finance.categories, thisMonth ?? monthKey(new Date()));
  const previous = incomeStatement(finance.movements, finance.categories, prevMonth);

  // Ejercicio y Biblia.
  const exercise = weekMinutes(entries.of('sesion'), today);
  const bibleProgress = progress(bible.reads);
  const bibleDays = new Set([...bible.reads.map((r) => String(r.read_on).slice(0, 10)), ...entries.of('pan').map((p) => p.day ?? ''), ...entries.of('lectura').map((p) => p.day ?? '')]);
  const bibleStreak = streak(bibleDays, today);

  // Agenda: tareas hechas en la semana.
  const tasksDone = agenda.tasks.filter((t) => t.status === 'done' && t.done_on && t.done_on >= week[0]).length;

  // Actividad por día (para el calendario del año): hábitos, diario, movimientos y registros.
  const activity = new Map<string, number>();
  const bump = (day: string | null | undefined) => day && activity.set(day.slice(0, 10), (activity.get(day.slice(0, 10)) ?? 0) + 1);
  logs.forEach((l) => bump(l.day));
  journal.days.forEach((d) => bump(d.day));
  finance.movements.forEach((m) => m.occurred_on >= from && bump(m.occurred_on));
  entries.entries.forEach((e) => bump(e.day));

  const counts: Record<string, number> = {};
  for (const e of entries.entries) counts[e.module] = (counts[e.module] ?? 0) + 1;

  return {
    habits,
    habitDays,
    habitStreak: streak(habitDays, today),
    habitWeek,
    habitRate,
    journal,
    moodByDay,
    journalStreak,
    finance,
    month,
    previous,
    exercise,
    bibleProgress,
    bibleStreak,
    tasksDone,
    activity,
    counts,
    entries,
    games: entries.entries.filter((e) => e.module === 'juegos' && e.kind === 'puntaje'),
  };
}

export type LifeStats = ReturnType<typeof useLifeStats>;
