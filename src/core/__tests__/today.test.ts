import { describe, expect, it } from '@jest/globals';

import { daysToPayday, dayKey, duration, fmtTime, greeting, isLive, isPast, nextItem, personalDay } from '../today';

describe('personalDay', () => {
  it('arma el día con la hora de despertar y de dormir, y los módulos encendidos', () => {
    const items = personalDay({ wake: '06:30', sleep: '23:00', on: new Set(['biblia', 'diario']), works: false, habits: ['caminar'] });
    expect(items.map((i) => i.id)).toEqual(['despertar', 'pan', 'caminar', 'cierre', 'dormir']);
    expect(fmtTime(items[0].t)).toBe('06:30');
    expect(items.at(-1)?.sub).toBe('7 h 30 min de sueño');
  });

  it('sin horas conocidas usa las de siempre y lo avisa', () => {
    const items = personalDay({ wake: 'Varía', sleep: null, on: new Set(), works: false, habits: [] });
    expect(items.map((i) => [i.id, fmtTime(i.t), i.sub])).toEqual([
      ['despertar', '07:00', 'Hora aproximada'],
      ['dormir', '23:00', 'Hora aproximada'],
    ]);
  });

  it('con trabajo de día agrega la jornada; con turnos espera a Tu rutina', () => {
    const base = { wake: '07:00', sleep: '23:00', on: new Set<string>(), works: true, habits: [] };
    expect(personalDay({ ...base, routine: 'De día' }).some((i) => i.id === 'jornada')).toBe(true);
    expect(personalDay({ ...base, routine: 'Turnos' }).some((i) => i.id === 'jornada')).toBe(false);
  });

  it('acepta dormir pasada la medianoche', () => {
    const items = personalDay({ wake: '08:00', sleep: '00:30', on: new Set(), works: false, habits: ['leer'] });
    expect(items.map((i) => fmtTime(i.t))).toEqual(['08:00', '23:45', '00:30']);
  });
});

describe('pasado, en curso y lo que sigue', () => {
  const items = personalDay({ wake: '07:00', sleep: '23:00', on: new Set(['tu_rutina']), works: true, habits: [], routine: 'De día' });
  it('la jornada está en curso a las 11:00', () => {
    const jornada = items.find((i) => i.id === 'jornada')!;
    expect(isLive(jornada, 660)).toBe(true);
    expect(isPast(jornada, 660)).toBe(false);
  });
  it('lo siguiente salta lo ya hecho', () => {
    expect(nextItem(items, 600, () => false)?.id).toBe('almuerzo');
    expect(nextItem(items, 600, (id) => id === 'almuerzo')?.id).toBe('dormir');
  });
});

describe('daysToPayday', () => {
  const today = new Date(2026, 9, 18); // sábado 18 de octubre de 2026
  it('cuenta los días hasta el día fijo de este mes o del siguiente', () => {
    expect(daysToPayday({ option: 'Otro día', day: 25 }, today)?.days).toBe(7);
    expect(daysToPayday({ option: 'Día 15' }, today)?.days).toBe(28);
    expect(daysToPayday({ option: 'Día 5' }, today)?.date.getMonth()).toBe(10);
  });
  it('el último día hábil de octubre de 2026 es el viernes 30', () => {
    expect(daysToPayday({ option: 'Último día hábil' }, today)).toEqual({ days: 12, date: new Date(2026, 9, 30) });
  });
  it('sin fecha fija no calcula', () => {
    expect(daysToPayday({ option: 'Cambia según el mes' }, today)).toBeNull();
    expect(daysToPayday('skipped', today)).toBeNull();
  });
});

describe('formatos', () => {
  it('horas, duraciones, saludo y fecha', () => {
    expect(fmtTime(1470)).toBe('00:30');
    expect(duration(90)).toBe('1 h 30 min');
    expect(duration(45)).toBe('45 min');
    expect(greeting(new Date(2026, 9, 18, 9))).toBe('Buenos días');
    expect(greeting(new Date(2026, 9, 18, 15))).toBe('Buenas tardes');
    expect(greeting(new Date(2026, 9, 18, 21))).toBe('Buenas noches');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
