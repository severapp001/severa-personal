import { useEffect, useMemo, useState } from 'react';

import { ageOn } from '@/core/age';
import { eventsOn, eventTime, hhmm } from '@/core/agenda';
import { planModules, suggest, works as hasWork, type NeuronState } from '@/core/discovery';
import { classesOn } from '@/core/studies';
import { dayKey, minutesNow, personalDay, toMinutes, type DayItem } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useAuth } from '@/data/auth';
import { useDayMarks, setMark } from '@/data/day';
import { useEntries } from '@/data/entries';
import { useStudies } from '@/data/modules';
import { useHabitTemplates, useNeurons, useNotInterested, useOnboarding, useSelfPerson, useSynapses, useTrades, useUserNeurons } from '@/data/discovery';

// Todo lo que necesita Hoy, armado con lo que la persona contó en Conocerte y lo que marca en el día.

/** La hora actual, que se actualiza cada minuto. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const isOn = (s?: NeuronState) => s === 'discovered' || s === 'suggested';

/**
 * `viewDay` (26-10-2026, como en la v1): ver Hoy de otro día, hacia atrás o hacia adelante. Lo hecho
 * del día se guarda sincronizado (motor común, módulo «hoy»): antes quedaba solo en el teléfono y se
 * perdía al actualizar la app.
 */
export function useToday(viewDay?: string) {
  const { session } = useAuth();
  const accountId = session?.user.id;
  const now = useNow();
  const realToday = dayKey(now);
  const day = viewDay ?? realToday;
  const isToday = day === realToday;
  const nowMin = isToday ? minutesNow(now) : day < realToday ? 1440 : -1;
  const marks = useDayMarks(day);
  const hoy = useEntries(['hoy', 'severa']);
  const doneRows = hoy.entries.filter((e) => e.module === 'hoy' && e.kind === 'hecho' && e.day === day);
  const variable = !!hoy.entries.find((e) => e.module === 'severa' && e.kind === 'ajuste' && e.title === 'horario')?.data.variable;

  const person = useSelfPerson(accountId);
  const onboarding = useOnboarding(accountId);
  const states = useUserNeurons(accountId);
  const { neurons } = useNeurons();
  const synapses = useSynapses();
  const { trades } = useTrades();
  const habitTemplates = useHabitTemplates();
  const notInterested = useNotInterested(accountId);
  const [skip, setSkip] = useState(0);

  const answers = onboarding?.answers ?? {};
  const horario = (answers.horario ?? {}) as { despierta?: string | null; duerme?: string | null };
  const habitAnswer = answers.habitos as { habits?: string[] } | undefined;
  const habitsKey = (habitAnswer?.habits ?? []).join(',');
  const chosenHabits = useMemo(() => (habitsKey ? habitsKey.split(',') : []), [habitsKey]);
  const routine = (answers.tu_rutina as { option?: string } | undefined)?.option ?? null;
  const tradeCodes = onboarding?.trades ?? [];
  const works = hasWork(tradeCodes);
  const trade = trades.find((t) => tradeCodes.includes(t.code)) ?? null;
  const on = useMemo(() => new Set(Object.entries(states).filter(([, s]) => isOn(s)).map(([c]) => c)), [states]);

  // Los eventos y tareas con hora de hoy entran a la línea del día (25-10-2026); se marcan en la
  // agenda, no en las marcas del teléfono.
  const agenda = useAgenda(day, day);
  const agendaItems: DayItem[] = [
    ...eventsOn(agenda.events, day)
      .filter((e) => hhmm(e.starts_at))
      .map((e) => ({ id: `ev:${e.id}`, t: toMinutes(hhmm(e.starts_at))!, end: toMinutes(hhmm(e.ends_at)) ?? undefined, title: e.title, sub: `Agenda · ${eventTime(e)}`, icon: 'flag' as const })),
    ...agenda.tasks
      .filter((x) => x.due_on === day && hhmm(x.due_at) && x.status !== 'dismissed')
      .map((x) => ({ id: `task:${x.id}`, t: toMinutes(hhmm(x.due_at))!, title: x.title, sub: 'Tarea', icon: 'flag' as const })),
    // Lo de todo el día y las tareas sin hora van a «durante el día» (27-10-2026: la prueba del 3
    // salía en Prioridades y no en Tu día).
    ...eventsOn(agenda.events, day)
      .filter((e) => !hhmm(e.starts_at))
      .map((e) => ({ id: `ev:${e.id}`, t: 0, title: e.title, sub: 'Todo el día', icon: 'flag' as const, flexible: true })),
    ...agenda.tasks
      .filter((x) => x.due_on === day && !hhmm(x.due_at) && x.status !== 'dismissed')
      .map((x) => ({ id: `task:${x.id}`, t: 0, title: x.title, sub: 'Tarea', icon: 'flag' as const, flexible: true })),
  ];
  // Las clases de hoy (Estudios) y los bloques de Tu rutina también entran a la línea (26-10-2026).
  const studies = useStudies();
  const routineBlocks = useEntries(['estudios', 'tu_rutina']);
  const weekdayIdx = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12).getDay();
  const weekday = weekdayIdx === 0 ? 7 : weekdayIdx;
  const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const programs = routineBlocks.of('programa');
  for (const { block: b, course } of classesOn(day, studies.blocks, studies.courses, programs)) {
    agendaItems.push({ id: `clase:${b.id}`, t: toMinutes(b.starts_at.slice(0, 5))!, end: toMinutes(b.ends_at.slice(0, 5)) ?? undefined, title: `Clase: ${course.name}`, sub: `Estudios${b.room ? ` · sala ${b.room}` : ''}`, icon: 'book' });
  }
  for (const r of routineBlocks.of('bloque').filter((x) => Array.isArray(x.data.dias) && (x.data.dias as string[]).includes(DOW[weekday - 1]) && x.data.desde)) {
    agendaItems.push({ id: `rutina:${r.id}`, t: toMinutes(String(r.data.desde))!, end: toMinutes(String(r.data.hasta ?? '')) ?? undefined, title: r.title ?? 'Rutina', sub: 'Tu rutina', icon: 'flag' });
  }
  const agendaKey = agendaItems.map((i) => `${i.id}@${i.t}-${i.end ?? ''}:${i.title}`).join('|');
  const all: DayItem[] = useMemo(
    () => [...personalDay({ wake: horario.despierta, sleep: horario.duerme, on, routine, works, habits: chosenHabits, variable }), ...agendaItems].sort((a, b) => a.t - b.t),
    // agendaItems cambia en cada render; su contenido lo identifica agendaKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [horario.despierta, horario.duerme, on, routine, works, chosenHabits, agendaKey, variable],
  );
  // Con hora (la línea del día) y sin hora («durante el día»).
  const items = all.filter((i) => !i.flexible);
  const flexible = all.filter((i) => i.flexible);
  const agendaDone = (id: string) =>
    id.startsWith('ev:')
      ? agenda.states.some((s) => s.origin_type === 'event' && s.origin_id === id.slice(3) && s.status === 'done')
      : agenda.tasks.find((x) => x.id === id.slice(5))?.status === 'done';
  const isAgenda = (id: string) => id.startsWith('ev:') || id.startsWith('task:');

  const habits = habitTemplates.filter((h) => chosenHabits.includes(h.code));
  const age = person?.birthDate ? ageOn(new Date(`${person.birthDate}T12:00:00`)) : undefined;
  const suggestion = useMemo(() => {
    if (!neurons.length) return null;
    const modules = onboarding ? planModules(onboarding.goals, onboarding.trades, trades).modules : [];
    return suggest(neurons, synapses, states, { interests: onboarding?.interests ?? [], planModules: modules, notInterested, skip, age });
  }, [neurons, synapses, states, onboarding, trades, notInterested, skip, age]);

  const doneLocal = (id: string) => doneRows.some((r) => r.title === id) || !!marks[`done:${id}`]?.value;

  return {
    now,
    nowMin,
    day,
    isToday,
    realToday,
    variable,
    /** Cambia entre un día con horario fijo y uno que cambia cada día. */
    setVariable: async (v: boolean) => {
      const row = hoy.entries.find((e) => e.module === 'severa' && e.kind === 'ajuste' && e.title === 'horario');
      if (row) await hoy.update(row.id, { data: { ...row.data, variable: v } });
      else await hoy.add({ module: 'severa', kind: 'ajuste', title: 'horario', data: { variable: v } });
    },
    marks,
    /** Marca o desmarca algo del día (hecho = 1). */
    toggle: (item: string) => setMark(day, item, { value: marks[item]?.value ? 0 : 1 }),
    setMark: (item: string, mark: { value?: number; text?: string | null } | null) => setMark(day, item, mark),
    done: (id: string) => (isAgenda(id) ? agendaDone(id) : doneLocal(id)),
    toggleDone: async (id: string) => {
      if (id.startsWith('ev:')) return agenda.setState(day, 'event', id.slice(3), agendaDone(id) ? null : 'done');
      if (id.startsWith('task:')) return agenda.completeTask(id.slice(5), !agendaDone(id), day);
      if (doneLocal(id)) {
        for (const r of doneRows.filter((x) => x.title === id)) await hoy.remove(r.id);
        if (marks[`done:${id}`]?.value) await setMark(day, `done:${id}`, null);
        return;
      }
      await hoy.add({ module: 'hoy', kind: 'hecho', day, title: id });
    },
    name: person?.name ?? null,
    onboarding,
    answers,
    on,
    states,
    neurons,
    synapses,
    items,
    flexible,
    habits,
    works,
    trade,
    suggestion,
    skipSuggestion: () => setSkip((s) => s + 1),
  };
}

export type Today = ReturnType<typeof useToday>;
