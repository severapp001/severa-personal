import { nextStep as nextStepOf, pathOrder, stagesOrder } from '@/core/goals';
import { useEntries, type Entry } from '@/data/entries';

// Metas y caminos (usuario, 26-10-2026: «controlar mi TDAH, organizar mis ideas, cumplir mis metas…
// el camino que debería hacer para irlas cumpliendo»). En el motor común (módulo «metas»):
// - meta: lo que se quiere lograr, con su parte (cuerpo, mente o alma), tipo, fechas y «para qué»;
// - hito: las etapas del camino, en orden;
// - paso: acciones chicas (de una etapa o sueltas), que se marcan;
// - pagina: ideas tipo Notion (bloques de título, texto, lista y tarea);
// - avance: la bitácora (los días cumplidos de un desafío).

export type Block = { id: string; type: 'h' | 'p' | 'li' | 'todo'; text: string; done?: boolean };

export function useGoals(day: string) {
  const store = useEntries('metas');
  const goals = store.of('meta');
  const hitos = (goalId: string) => stagesOrder(store.of('hito', goalId));
  const steps = (goalId: string) => pathOrder(store.of('paso', goalId), store.of('hito', goalId));
  const progress = (goalId: string) => {
    const list = steps(goalId);
    return list.length ? list.filter((s) => s.done).length / list.length : 0;
  };

  /** El próximo paso de una meta: el primero sin hacer del camino (si tiene fecha futura, aún no). */
  const nextOf = (goalId: string): Entry | null => nextStepOf(store.of('paso', goalId), store.of('hito', goalId), day);

  /** Marcar o desmarcar un paso; `hecho` guarda el día, para que Prioridades lo muestre hecho ese día. */
  const toggleStep = (step: Entry) => store.update(step.id, { done: !step.done, data: { ...step.data, hecho: step.done ? null : day } });

  return {
    store,
    goals,
    active: goals.filter((g) => !g.done),
    hitos,
    steps,
    progress,
    nextOf,
    toggleStep,
    pages: (goalId: string) => store.of('pagina', goalId),
    logs: (goalId: string) => store.of('avance', goalId),
    /** El paso a mostrar en Hoy: el próximo de la meta que vence antes (o la más reciente). */
    nextStep: (): { goal: Entry; step: Entry } | null => {
      const list = goals
        .filter((g) => !g.done)
        .map((g) => ({ goal: g, step: nextOf(g.id) }))
        .filter((x): x is { goal: Entry; step: Entry } => !!x.step)
        .sort((a, b) => (a.goal.until ?? '9').localeCompare(b.goal.until ?? '9'));
      return list[0] ?? null;
    },
  };
}

export type Goals = ReturnType<typeof useGoals>;
