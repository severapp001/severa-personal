import { describe, expect, it } from '@jest/globals';

import { convOf, filterConvs, firstState, withResult } from '../conversations';

describe('conversaciones', () => {
  it('sabe si propuso, respondió o no entendió', () => {
    expect(firstState(2, null, 'AYUDA')).toBe('propuesto');
    expect(firstState(0, 'Este mes gastaste $120.000', 'AYUDA')).toBe('respondido');
    expect(firstState(0, 'AYUDA', 'AYUDA')).toBe('no_entendido');
    expect(firstState(0, null, 'AYUDA')).toBe('no_entendido');
  });

  it('queda guardada si se guardó alguna tarjeta', () => {
    const d = convOf({ canal: 'app', estado: 'propuesto', lineas: ['a', 'b'] });
    const one = withResult(d, '0', 'cancelado');
    expect(one.estado).toBe('propuesto');
    expect(withResult(one, '1', 'guardado').estado).toBe('guardado');
    expect(withResult(one, '1', 'cancelado').estado).toBe('cancelado');
    expect(withResult(withResult(d, '0', 'guardado'), '1', 'corregido').estado).toBe('corregido');
  });

  it('aguanta datos incompletos y filtra', () => {
    expect(convOf({}).canal).toBe('app');
    expect(convOf({ estado: 'raro' }).estado).toBe('respondido');
    const rows = [{ data: { canal: 'telegram', estado: 'guardado' } }, { data: { canal: 'correo', estado: 'no_entendido' } }, { data: { canal: 'app', estado: 'no_entendido' } }];
    expect(filterConvs(rows, 'telegram')).toHaveLength(2);
    expect(filterConvs(rows, 'app')).toHaveLength(1);
    expect(filterConvs(rows, 'no_entendido')).toHaveLength(2);
    expect(filterConvs(rows, 'todo')).toHaveLength(3);
  });
});
