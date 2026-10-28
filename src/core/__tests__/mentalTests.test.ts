import { describe, expect, it } from '@jest/globals';

import { choicesOf, scoreTest, TEST_ORDER, TESTS } from '../mentalTests';

describe('tests de salud mental', () => {
  it('cada test tiene preguntas y opciones', () => {
    for (const code of TEST_ORDER) {
      const t = TESTS[code];
      expect(t.questions.length).toBeGreaterThan(0);
      t.questions.forEach((_, i) => expect(choicesOf(t, i).length).toBeGreaterThan(1));
    }
    expect(TESTS.asrs.questions).toHaveLength(18);
    expect(TESTS.phq9.questions).toHaveLength(9);
    expect(TESTS.gad7.questions).toHaveLength(7);
  });

  it('ASRS: 4 o más en la zona marcada de la parte A', () => {
    // 1–3 desde «A veces» (2); 4–6 desde «A menudo» (3).
    expect(scoreTest('asrs', [2, 2, 2, 3, 0, 0, ...Array(12).fill(0)]).score).toBe(4);
    expect(scoreTest('asrs', [2, 2, 2, 3, 0, 0, ...Array(12).fill(0)]).band.tone).toBe('bad');
    expect(scoreTest('asrs', [1, 1, 1, 2, 2, 2, ...Array(12).fill(0)]).score).toBe(0);
  });

  it('PHQ-9: cortes 5, 10, 15 y 20, y la pregunta 9 avisa', () => {
    expect(scoreTest('phq9', [1, 1, 1, 1, 1, 0, 0, 0, 0]).band.label).toBe('Leve');
    expect(scoreTest('phq9', [3, 3, 3, 3, 3, 3, 2, 0, 0]).band.label).toBe('Severo');
    expect(scoreTest('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1]).crisis).toBe(true);
    expect(scoreTest('phq9', Array(9).fill(0)).crisis).toBe(false);
  });

  it('WHO-5 se lleva a 0–100 y PSS-10 invierte las preguntas positivas', () => {
    expect(scoreTest('who5', [5, 5, 5, 5, 5]).score).toBe(100);
    expect(scoreTest('who5', [2, 2, 2, 2, 2]).band.tone).toBe('mid');
    expect(scoreTest('who5', [1, 1, 1, 1, 1]).band.tone).toBe('bad');
    // Todo «Nunca»: las 6 negativas suman 0 y las 4 positivas invertidas suman 16.
    expect(scoreTest('pss10', Array(10).fill(0)).score).toBe(16);
  });

  it('AUDIT-C: 4 o más es consumo de riesgo', () => {
    expect(scoreTest('auditc', [2, 1, 1]).band.label).toBe('Consumo de riesgo');
    expect(scoreTest('auditc', [1, 0, 0]).band.label).toBe('Bajo riesgo');
  });
});
