import { describe, expect, it } from '@jest/globals';

import { findInsights, missingFor, type DayFacts } from '../insights';

const day = (i: number) => `2026-10-${String(i + 1).padStart(2, '0')}`;

describe('el cerebro que analiza', () => {
  it('ve que los días con ejercicio el ánimo está mejor', () => {
    const days: DayFacts[] = Array.from({ length: 12 }, (_, i) => ({ day: day(i), exercise: i % 2 ? 30 : 0, mood: i % 2 ? 4 : 2 }));
    const list = findInsights(days);
    expect(list[0]).toMatchObject({ id: 'exercise-mood', modules: ['ejercicio', 'diario'] });
    expect(list[0].title).toBe('Los días que haces ejercicio, tu ánimo está mejor');
  });

  it('no dice nada con pocos días ni con diferencias chicas', () => {
    expect(findInsights([{ day: day(0), exercise: 30, mood: 4 }, { day: day(1), exercise: 0, mood: 2 }])).toEqual([]);
    const flat: DayFacts[] = Array.from({ length: 12 }, (_, i) => ({ day: day(i), exercise: i % 2 ? 30 : 0, mood: 3 }));
    expect(findInsights(flat)).toEqual([]);
  });

  it('un dato que nunca se registra no cuenta como «no»', () => {
    const days: DayFacts[] = Array.from({ length: 12 }, (_, i) => ({ day: day(i), mood: i % 2 ? 4 : 2 }));
    expect(findInsights(days)).toEqual([]);
  });

  it('encuentra el día de la semana en que más se gasta', () => {
    // 2026-10-02 es viernes: los viernes se gasta 30.000 y los demás días 10.000.
    const days: DayFacts[] = Array.from({ length: 28 }, (_, i) => ({ day: day(i), spent: new Date(`${day(i)}T12:00:00`).getDay() === 5 ? 30000 : 10000 }));
    expect(findInsights(days).find((x) => x.id === 'spend-weekday')?.title).toBe('Los viernes gastas más');
  });

  it('dice qué le falta saber', () => {
    expect(missingFor([{ day: day(0) }]).length).toBeGreaterThan(0);
  });
});
