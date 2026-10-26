import { describe, expect, it } from '@jest/globals';

import { bmi, dailyCalories, expiry, predictCycle, settle, sharedBalances, streak, weekMinutes, weekStart } from '../modules';

describe('gastos compartidos', () => {
  it('reparte en partes iguales y descuenta los pagos', () => {
    const b = sharedBalances(['Yo', 'Cata', 'Nico'], [{ amount: 30000, payer: 'Yo', among: [] }], [{ from: 'Cata', to: 'Yo', amount: 10000 }]);
    expect(b).toEqual({ Yo: 10000, Cata: 0, Nico: -10000 });
    expect(settle(b)).toEqual([{ from: 'Nico', to: 'Yo', amount: 10000 }]);
  });

  it('divide solo entre los elegidos', () => {
    const b = sharedBalances(['Yo', 'Cata', 'Nico'], [{ amount: 9000, payer: 'Cata', among: ['Yo', 'Cata'] }], []);
    expect(b).toEqual({ Yo: -4500, Cata: 4500, Nico: 0 });
  });
});

describe('ciclo', () => {
  it('usa el promedio de los ciclos y estima la ventana fértil', () => {
    const p = predictCycle(['2026-08-01', '2026-08-31', '2026-09-30'], '2026-10-10')!;
    expect(p.average).toBe(30);
    expect(p.next).toBe('2026-10-30');
    expect(p.ovulation).toBe('2026-10-16');
    expect(p.fertileFrom).toBe('2026-10-11');
    expect(p.daysToNext).toBe(20);
  });

  it('parte con 28 días si hay un solo registro', () => {
    expect(predictCycle(['2026-10-01'], '2026-10-02')?.next).toBe('2026-10-29');
    expect(predictCycle([], '2026-10-02')).toBeNull();
  });
});

describe('IMC y calorías', () => {
  it('clasifica según la OMS', () => {
    expect(bmi(70, 175)).toEqual({ value: 22.9, label: 'Peso normal', tone: 'ok' });
    expect(bmi(90, 175)?.label).toBe('Sobrepeso');
    expect(bmi(70, 20)).toBeNull();
  });

  it('estima las calorías con Mifflin-St Jeor', () => {
    expect(dailyCalories(70, 175, 30, 'Hombre', 'Poca')).toEqual({ basal: 1649, total: 1980 });
    expect(dailyCalories(70, 175, null, 'Hombre', 'Poca')).toBeNull();
  });
});

describe('ejercicio, vencimientos y rachas', () => {
  it('suma los minutos de la semana desde el lunes', () => {
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    const w = weekMinutes([{ day: '2026-10-26', value: 30 }, { day: '2026-10-28', value: 45 }, { day: '2026-10-20', value: 60 }], '2026-10-29');
    expect(w.total).toBe(75);
    expect(w.days[2].minutes).toBe(45);
  });

  it('avisa lo que vence pronto', () => {
    expect(expiry('2026-11-05', '2026-10-26')?.tone).toBe('mid');
    expect(expiry('2026-10-20', '2026-10-26')?.label).toBe('Venció hace 6 días');
    expect(expiry(null, '2026-10-26')).toBeNull();
  });

  it('cuenta la racha hasta ayer si hoy todavía no', () => {
    expect(streak(['2026-10-24', '2026-10-25'], '2026-10-26')).toBe(2);
    expect(streak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26')).toBe(3);
    expect(streak(['2026-10-23'], '2026-10-26')).toBe(0);
  });
});
