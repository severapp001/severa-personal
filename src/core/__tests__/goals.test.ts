import { describe, expect, it } from '@jest/globals';

import { goalPriorities, nextStep, pathOrder, type GoalRow } from '../goals';

const row = (id: string, extra: Partial<GoalRow> = {}): GoalRow => ({ id, title: id, done: false, parent_id: 'auto', day: null, data: {}, ...extra });
const goal = row('auto', { title: 'Vender auto', parent_id: null });
const steps = ['lavar', 'fotos', 'publicar', 'vender', 'transferir', 'comprar'].map((id, i) => row(id, { data: { orden: i } }));

describe('metas en prioridades', () => {
  it('el primer paso sin hacer entra a Prioridades y sigue ahí al día siguiente si no se hizo', () => {
    expect(goalPriorities('2026-10-27', [goal], steps, []).map((p) => p.id)).toEqual(['lavar']);
    expect(goalPriorities('2026-10-28', [goal], steps, []).map((p) => p.id)).toEqual(['lavar']);
  });

  it('al hacerlo queda marcado ese día y el siguiente paso toma su lugar', () => {
    const list = steps.map((s) => (s.id === 'lavar' ? { ...s, done: true, data: { ...s.data, hecho: '2026-10-27' } } : s));
    expect(goalPriorities('2026-10-27', [goal], list, []).map((p) => [p.id, p.done])).toEqual([
      ['lavar', true],
      ['fotos', false],
    ]);
    expect(goalPriorities('2026-10-28', [goal], list, []).map((p) => p.id)).toEqual(['fotos']);
  });

  it('un paso con fecha espera su día y, si pasa, queda atrasado', () => {
    const list = steps.map((s) => (s.id === 'lavar' ? { ...s, day: '2026-10-30' } : s));
    expect(goalPriorities('2026-10-27', [goal], list, [])).toEqual([]);
    expect(nextStep(list, [], '2026-10-27')).toBeNull();
    const late = goalPriorities('2026-11-01', [goal], list, []);
    expect(late[0]).toMatchObject({ id: 'lavar', overdue: '2026-10-30', pos: 1, total: 6 });
  });

  it('las etapas ordenan el camino y los pasos sueltos van al final', () => {
    const hitos = [row('h2', { data: { orden: 1 } }), row('h1', { data: { orden: 0 } })];
    const list = [row('suelto', { data: { orden: 0 } }), row('b', { data: { hito: 'h2', orden: 0 } }), row('a', { data: { hito: 'h1', orden: 5 } })];
    expect(pathOrder(list, hitos).map((s) => s.id)).toEqual(['a', 'b', 'suelto']);
  });

  it('una meta lograda no entra', () => {
    expect(goalPriorities('2026-10-27', [{ ...goal, done: true }], steps, [])).toEqual([]);
  });
});
