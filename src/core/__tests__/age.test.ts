import { describe, expect, it } from '@jest/globals';
import { ageOn, ageRules, parseChileanDate, toIsoDate } from '../age';

describe('ageOn', () => {
  const today = new Date(2026, 9, 5); // 05-10-2026

  it('cuenta los años cumplidos', () => {
    expect(ageOn(new Date(1990, 4, 10), today)).toBe(36);
  });

  it('no suma el año antes del cumpleaños', () => {
    expect(ageOn(new Date(2012, 9, 6), today)).toBe(13);
    expect(ageOn(new Date(2012, 9, 5), today)).toBe(14);
  });
});

describe('ageRules', () => {
  it('bajo 14 no crea cuenta', () => {
    expect(ageRules(13).canCreateAccount).toBe(false);
  });

  it('14 y 15: sin Salud ni Íntimo', () => {
    expect(ageRules(15)).toEqual({ canCreateAccount: true, health: false, intimate: false, adultHabitTemplates: false });
  });

  it('16 y 17: Salud sí, Íntimo y plantillas de adultos no', () => {
    expect(ageRules(17)).toEqual({ canCreateAccount: true, health: true, intimate: false, adultHabitTemplates: false });
  });

  it('18 o más: todo', () => {
    expect(ageRules(18)).toEqual({ canCreateAccount: true, health: true, intimate: true, adultHabitTemplates: true });
  });
});

describe('parseChileanDate', () => {
  it('lee dd-mm-aaaa', () => {
    expect(toIsoDate(parseChileanDate('10-05-1990')!)).toBe('1990-05-10');
    expect(toIsoDate(parseChileanDate('1/2/2000')!)).toBe('2000-02-01');
  });

  it('rechaza fechas que no existen', () => {
    expect(parseChileanDate('31-02-2000')).toBeNull();
    expect(parseChileanDate('2000-02-01')).toBeNull();
    expect(parseChileanDate('hola')).toBeNull();
  });
});
