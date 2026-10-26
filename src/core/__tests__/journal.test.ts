import { describe, expect, it } from '@jest/globals';

import { addDays } from '../agenda';
import { activitiesOf, activityInsights, dayEntry, journalStreak, moodDistribution, type JournalDay } from '../journal';

const d = (day: string, mood: number | null, activities: string[] = []): JournalDay => ({ id: day, day, mood, body: null, activities: JSON.stringify(activities), closed: 0 });

describe('diario', () => {
  const days = [
    d('2026-10-20', 4, ['Ejercicio', 'Familia']),
    d('2026-10-21', 1, ['Pantallas', 'Trabajo']),
    d('2026-10-22', 3, ['Ejercicio']),
    d('2026-10-23', 1, ['Pantallas']),
    d('2026-10-24', 2, ['Trabajo']),
    d('2026-10-25', null),
  ];

  it('lee actividades guardadas como texto, aunque vengan mal', () => {
    expect(activitiesOf('["Ejercicio"," Familia "]')).toEqual(['Ejercicio', 'Familia']);
    expect(activitiesOf('no es json')).toEqual([]);
    expect(activitiesOf(null)).toEqual([]);
  });

  it('cuenta los días de cada ánimo en el rango', () => {
    expect(moodDistribution(days, '2026-10-21', '2026-10-25').map((m) => m.count)).toEqual([2, 1, 1, 0]);
  });

  it('muestra qué se repite en los días buenos y en los difíciles', () => {
    const r = activityInsights(days, '2026-10-01', '2026-10-31');
    expect(r.good).toEqual([
      { name: 'Ejercicio', count: 2 },
      { name: 'Familia', count: 1 },
    ]);
    expect(r.bad).toEqual([
      { name: 'Pantallas', count: 2 },
      { name: 'Trabajo', count: 1 },
    ]);
  });

  it('racha de días seguidos y la entrada de un día', () => {
    expect(journalStreak(days, '2026-10-25', addDays)).toBe(6);
    expect(journalStreak(days.slice(0, 5), '2026-10-25', addDays)).toBe(5);
    expect(journalStreak(days.slice(0, 3), '2026-10-25', addDays)).toBe(0);
    expect(dayEntry(days, '2026-10-22')?.mood).toBe(3);
    expect(dayEntry(days, '2026-10-01')).toBeNull();
  });
});
