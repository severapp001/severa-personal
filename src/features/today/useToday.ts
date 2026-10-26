import { useEffect, useMemo, useState } from 'react';

import { ageOn } from '@/core/age';
import { eventsOn, eventTime, hhmm } from '@/core/agenda';
import { planModules, suggest, works as hasWork, type NeuronState } from '@/core/discovery';
import { dayKey, minutesNow, personalDay, toMinutes, type DayItem } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useAuth } from '@/data/auth';
import { useDayMarks, setMark } from '@/data/day';
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

export function useToday() {
  const { session } = useAuth();
  const accountId = session?.user.id;
  const now = useNow();
  const day = dayKey(now);
  const marks = useDayMarks(day);

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
  ];
  const agendaKey = agendaItems.map((i) => `${i.id}@${i.t}-${i.end ?? ''}:${i.title}`).join('|');
  const items: DayItem[] = useMemo(
    () => [...personalDay({ wake: horario.despierta, sleep: horario.duerme, on, routine, works, habits: chosenHabits }), ...agendaItems].sort((a, b) => a.t - b.t),
    // agendaItems cambia en cada render; su contenido lo identifica agendaKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [horario.despierta, horario.duerme, on, routine, works, chosenHabits, agendaKey],
  );
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

  return {
    now,
    nowMin: minutesNow(now),
    day,
    marks,
    /** Marca o desmarca algo del día (hecho = 1). */
    toggle: (item: string) => setMark(day, item, { value: marks[item]?.value ? 0 : 1 }),
    setMark: (item: string, mark: { value?: number; text?: string | null } | null) => setMark(day, item, mark),
    done: (id: string) => (isAgenda(id) ? agendaDone(id) : !!marks[`done:${id}`]?.value),
    toggleDone: (id: string) => {
      if (id.startsWith('ev:')) return agenda.setState(day, 'event', id.slice(3), agendaDone(id) ? null : 'done');
      if (id.startsWith('task:')) return agenda.completeTask(id.slice(5), !agendaDone(id), day);
      return setMark(day, `done:${id}`, { value: marks[`done:${id}`]?.value ? 0 : 1 });
    },
    name: person?.name ?? null,
    onboarding,
    answers,
    on,
    states,
    neurons,
    synapses,
    items,
    habits,
    works,
    trade,
    suggestion,
    skipSuggestion: () => setSkip((s) => s + 1),
  };
}

export type Today = ReturnType<typeof useToday>;
