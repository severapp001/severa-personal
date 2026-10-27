import { describe, expect, it } from '@jest/globals';

import { classesOn, courseAverage, daysUntil, isoWeekday, neededGrade, upcoming, weekPlan, type Assessment } from '../studies';

const a = (id: string, grade: number | null, weight: number | null, due_on: string | null = null): Assessment => ({ id, course_id: 'c', title: id, due_on, weight, grade });

describe('courseAverage', () => {
  it('ponderado cuando todas tienen porcentaje', () => {
    expect(courseAverage([a('p1', 5.0, 30), a('p2', 6.0, 30), a('ex', null, 40)])).toBe(5.5);
  });
  it('simple cuando falta algún porcentaje', () => {
    expect(courseAverage([a('p1', 4.0, null), a('p2', 6.5, 50)])).toBe(5.3);
  });
  it('sin notas, sin promedio', () => {
    expect(courseAverage([a('p1', null, 50)])).toBeNull();
  });
});

describe('neededGrade', () => {
  it('la nota que falta para el 4,0', () => {
    // 3,0·30 + 3,5·30 = 195; para 4,0 se necesitan 400 → 205 / 40 = 5,2 (redondeado hacia arriba)
    expect(neededGrade([a('p1', 3.0, 30), a('p2', 3.5, 30), a('ex', null, 40)])).toEqual({ grade: 5.2, possible: true });
  });
  it('avisa cuando ya no alcanza', () => {
    expect(neededGrade([a('p1', 1.0, 50), a('p2', 1.5, 30), a('ex', null, 20)])).toEqual({ grade: 15.3, possible: false });
  });
  it('nunca pide menos de 1,0 y no calcula sin porcentajes', () => {
    expect(neededGrade([a('p1', 7.0, 80), a('ex', null, 20)])?.grade).toBe(1);
    expect(neededGrade([a('p1', 5.0, null), a('ex', null, 20)])).toBeNull();
  });
});

describe('agenda', () => {
  it('pruebas que vienen, ordenadas', () => {
    const list = [a('b', null, 10, '2026-10-30'), a('x', 6, 10, '2026-10-20'), a('c', null, 10, '2026-10-19'), a('old', null, 10, '2026-10-01')];
    expect(upcoming(list, '2026-10-18').map((x) => x.id)).toEqual(['c', 'b']);
  });
  it('semana por día y hora, y días que faltan', () => {
    const plan = weekPlan([
      { id: '1', course_id: 'c', weekday: 3, starts_at: '10:00', ends_at: '11:30', room: null },
      { id: '2', course_id: 'c', weekday: 1, starts_at: '08:30', ends_at: '10:00', room: 'A1' },
      { id: '3', course_id: 'c', weekday: 1, starts_at: '08:00', ends_at: '08:30', room: null },
    ]);
    expect(plan.map((d) => [d.weekday, d.blocks.map((b) => b.id)])).toEqual([
      [1, ['3', '2']],
      [3, ['1']],
    ]);
    expect(daysUntil('2026-11-01', '2026-10-18')).toBe(14);
  });
});

describe('clases del día (26-10-2026)', () => {
  const blocks = [
    { id: 'b1', course_id: 'c1', weekday: 4, starts_at: '20:30:00', ends_at: '22:00:00', room: null },
    { id: 'b2', course_id: 'c2', weekday: 4, starts_at: '10:00:00', ends_at: '11:30:00', room: null },
    { id: 'b3', course_id: 'c1', weekday: 2, starts_at: '09:00:00', ends_at: '10:00:00', room: null },
  ];
  const courses = [
    { id: 'c1', name: 'Ingeniería económica', program_id: 'p1' },
    { id: 'c2', name: 'Cálculo', archived: 1 },
  ];
  const programs = [{ id: 'p1', day: '2026-09-01', until: '2026-12-15' }];

  it('trae las de ese día de la semana, vigentes y dentro del período', () => {
    expect(isoWeekday('2026-10-29')).toBe(4);
    expect(classesOn('2026-10-29', blocks, courses, programs).map((c) => c.block.id)).toEqual(['b1']);
    expect(classesOn('2026-12-17', blocks, courses, programs)).toEqual([]);
  });
});
