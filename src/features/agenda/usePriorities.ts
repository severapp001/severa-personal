import { router } from 'expo-router';

import { addDays, dailyPriorities, type PriorityItem } from '@/core/agenda';
import { useAgenda } from '@/data/agenda';
import { useFamily, useHabits, useStudies } from '@/data/modules';

// Las prioridades de un día, armadas con la agenda, los hábitos, las pruebas de Estudios y los
// cumpleaños de Familia. Marcar una registra en su módulo: la tarea queda hecha, el evento o la
// prueba quedan marcados ese día; los hábitos se marcan en su pantalla.

export function usePriorities(day: string) {
  const agenda = useAgenda(addDays(day, -1), addDays(day, 1));
  const habits = useHabits(day);
  const studies = useStudies();
  const family = useFamily();

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
  });

  async function toggle(item: PriorityItem) {
    if (item.origin === 'task') return agenda.completeTask(item.originId, !item.done, day);
    if (item.origin === 'habits') return router.push('/habitos');
    return agenda.setState(day, item.origin, item.originId, item.done ? null : 'done');
  }

  /** Sacarla de la lista: la tarea pasa a mañana; lo demás se descarta solo por hoy. */
  async function later(item: PriorityItem) {
    if (item.origin === 'task') {
      const t = agenda.tasks.find((x) => x.id === item.originId);
      return t ? agenda.postponeTask(t, day) : undefined;
    }
    return agenda.setState(day, item.origin, item.originId, 'dismissed');
  }

  return { agenda, items, toggle, later };
}
