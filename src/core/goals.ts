// Metas y caminos fuera de su pantalla (usuario, 27-10-2026: «meta: vender auto; pasos: lavar auto,
// tomar fotos, publicar, vender, transferir, comprar otro auto. La primera tarea irá a prioridades,
// y esta tarea se debería hacer, pero si no se realiza pasa como prioridad al siguiente día»).
// Lógica pura: el orden del camino, el próximo paso y lo que entra a Prioridades cada día.

export type GoalRow = { id: string; title: string | null; done: boolean; parent_id: string | null; day: string | null; data: Record<string, unknown>; created_at?: string | null };

const ord = (e: GoalRow) => Number(e.data.orden ?? 0);
const byOrder = (a: GoalRow, b: GoalRow) => ord(a) - ord(b) || (a.created_at ?? '').localeCompare(b.created_at ?? '');

/** Las etapas en su orden. */
export const stagesOrder = <T extends GoalRow>(hitos: T[]): T[] => [...hitos].sort(byOrder);

/** Los pasos en el orden del camino: por etapa (los sueltos al final) y, dentro, por su orden. */
export function pathOrder<T extends GoalRow>(steps: T[], hitos: GoalRow[]): T[] {
  const stages = stagesOrder(hitos).map((h) => h.id);
  const idx = (s: GoalRow) => {
    const i = stages.indexOf(String(s.data.hito ?? ''));
    return i < 0 ? stages.length : i;
  };
  return [...steps].sort((a, b) => idx(a) - idx(b) || byOrder(a, b));
}

/** El próximo paso: el primero sin hacer del camino. Si tiene fecha futura, todavía no toca. */
export function nextStep<T extends GoalRow>(steps: T[], hitos: GoalRow[], day: string): T | null {
  const first = pathOrder(steps, hitos).find((s) => !s.done) ?? null;
  return first && (!first.day || first.day <= day) ? first : null;
}

export type GoalPriority = { id: string; title: string; goal: string; pos: number; total: number; done: boolean; overdue: string | null };

/** Lo de las metas que entra a Prioridades ese día: el próximo paso de cada meta activa (sigue ahí
 *  hasta que se haga), los pasos con fecha de ese día o atrasados, y lo hecho ese mismo día. */
export function goalPriorities(day: string, goals: GoalRow[], steps: GoalRow[], hitos: GoalRow[]): GoalPriority[] {
  const out: GoalPriority[] = [];
  for (const g of goals) {
    if (g.done) continue;
    const list = pathOrder(
      steps.filter((s) => s.parent_id === g.id),
      hitos.filter((h) => h.parent_id === g.id),
    );
    const first = list.findIndex((s) => !s.done);
    list.forEach((s, i) => {
      const item = { id: s.id, title: s.title ?? 'Paso', goal: g.title ?? 'Meta', pos: i + 1, total: list.length };
      if (s.done) {
        if (s.data.hecho === day) out.push({ ...item, done: true, overdue: null });
        return;
      }
      const dated = !!s.day && s.day <= day;
      if (dated || (i === first && !s.day)) out.push({ ...item, done: false, overdue: s.day && s.day < day ? s.day : null });
    });
  }
  return out;
}
