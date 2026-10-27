import { router } from 'expo-router';

import { addDays, dailyPriorities, hhmm, type PriorityItem } from '@/core/agenda';
import { goalPriorities } from '@/core/goals';
import { classesOn } from '@/core/studies';
import { useAgenda } from '@/data/agenda';
import { useEntries } from '@/data/entries';
import { useFamily, useHabits, useStudies } from '@/data/modules';

// Las prioridades de un día, armadas con la agenda, los hábitos, las pruebas de Estudios y los
// cumpleaños de Familia. Marcar una registra en su módulo: la tarea queda hecha, el evento o la
// prueba quedan marcados ese día; los hábitos se marcan en su pantalla.

export function usePriorities(day: string) {
  const agenda = useAgenda(addDays(day, -1), addDays(day, 1));
  const habits = useHabits(day);
  const studies = useStudies();
  const family = useFamily();
  // Las clases del día y su asistencia: la misma marca que en Tu día («clase:<bloque>»).
  const store = useEntries(['hoy', 'estudios', 'metas']);
  // El próximo paso de cada meta entra a Prioridades y sigue ahí hasta hacerlo (27-10-2026).
  const goalRows = store.entries.filter((e) => e.module === 'metas');
  const goals = goalPriorities(day, goalRows.filter((e) => e.kind === 'meta'), goalRows.filter((e) => e.kind === 'paso'), goalRows.filter((e) => e.kind === 'hito'));
  const marks = store.entries.filter((e) => e.module === 'hoy' && e.day === day);
  const classes = classesOn(day, studies.blocks, studies.courses, store.entries.filter((e) => e.kind === 'programa')).map(({ block, course }) => ({
    id: block.id,
    title: course.name,
    time: hhmm(block.starts_at),
    done: marks.some((m) => m.kind === 'hecho' && m.title === `clase:${block.id}`),
    hidden: marks.some((m) => m.kind === 'oculto' && m.title === `clase:${block.id}`),
  }));

  const good = habits.habits.filter((h) => h.direction !== 'reduce');
  const courses = new Map(studies.courses.map((c) => [c.id, c.name]));
  const items = dailyPriorities({
    day,
    events: agenda.events,
    tasks: agenda.tasks,
    states: agenda.states,
    habits: { done: good.filter((h) => habits.countFor(h.id) >= (Number(h.daily_target) || 1)).length, total: good.length },
    assessments: studies.assessments.map((a) => ({ id: a.id, title: a.title, course: courses.get(a.course_id) ?? null, due_on: a.due_on, grade: a.grade === null ? null : Number(a.grade) })),
    birthdays: family.people.map((p) => ({ id: p.id, name: p.name, birth_date: p.birth_date })),
    classes,
    goals,
  });

  async function toggle(item: PriorityItem) {
    if (item.origin === 'task') return agenda.completeTask(item.originId, !item.done, day);
    if (item.origin === 'class') {
      const row = marks.find((m) => m.kind === 'hecho' && m.title === `clase:${item.originId}`);
      return row ? store.remove(row.id) : store.add({ module: 'hoy', kind: 'hecho', day, title: `clase:${item.originId}` });
    }
    if (item.origin === 'habits') return router.push('/habitos');
    if (item.origin === 'goal') {
      const step = goalRows.find((e) => e.id === item.originId);
      return step ? store.update(step.id, { done: !item.done, data: { ...step.data, hecho: item.done ? null : day } }) : undefined;
    }
    return agenda.setState(day, item.origin, item.originId, item.done ? null : 'done');
  }

  /** Sacarla de la lista: la tarea pasa a mañana; lo demás se descarta solo por hoy. */
  async function later(item: PriorityItem) {
    if (item.origin === 'class') return store.add({ module: 'hoy', kind: 'oculto', day, title: `clase:${item.originId}` });
    if (item.origin === 'goal') return store.update(item.originId, { day: addDays(day, 1) });
    if (item.origin === 'task') {
      const t = agenda.tasks.find((x) => x.id === item.originId);
      return t ? agenda.postponeTask(t, day) : undefined;
    }
    return agenda.setState(day, item.origin, item.originId, 'dismissed');
  }

  return { agenda, items, toggle, later };
}
