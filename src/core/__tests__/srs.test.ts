import { describe, expect, it } from '@jest/globals';

import { isDue, review } from '../srs';

describe('tarjetas de repaso', () => {
  it('si la sabías sube de caja y se repasa más tarde', () => {
    expect(review(1, true, '2026-10-27')).toEqual({ box: 2, day: '2026-10-29' });
    expect(review(4, true, '2026-10-27')).toEqual({ box: 5, day: '2026-11-12' });
    expect(review(5, true, '2026-10-27').box).toBe(5);
  });
  it('si no, vuelve a la caja 1 y se repasa mañana', () => {
    expect(review(4, false, '2026-10-31')).toEqual({ box: 1, day: '2026-11-01' });
  });
  it('toca repasar lo nuevo y lo vencido', () => {
    expect(isDue({ day: null }, '2026-10-27')).toBe(true);
    expect(isDue({ day: '2026-10-27' }, '2026-10-27')).toBe(true);
    expect(isDue({ day: '2026-10-28' }, '2026-10-27')).toBe(false);
  });
});
