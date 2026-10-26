import { describe, expect, it } from '@jest/globals';

import { addDays, dailyPriorities, eventsOn, eventTime, monthGrid, occursOn, parseTime, upcomingReminders, type CalendarEvent, type PriorityInput, type Task } from '../agenda';

const ev = (id: string, event_date: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: id,
  event_date,
  starts_at: null,
  ends_at: null,
  layer: 'personal',
  repeat: 'none',
  remind_minutes: null,
  location: null,
  notes: null,
  ...extra,
});
const task = (id: string, due_on: string | null, extra: Partial<Task> = {}): Task => ({ id, title: id, notes: null, due_on, due_at: null, status: 'pending', urgent: 0, done_on: null, ...extra });

describe('repeticiones', () => {
  it('semanal, mensual y anual desde su fecha', () => {
    expect(occursOn({ event_date: '2026-10-26', repeat: 'weekly' }, '2026-11-02')).toBe(true);
    expect(occursOn({ event_date: '2026-10-26', repeat: 'weekly' }, '2026-11-03')).toBe(false);
    expect(occursOn({ event_date: '2026-10-26', repeat: 'weekly' }, '2026-10-19')).toBe(false);
    expect(occursOn({ event_date: '2026-10-05', repeat: 'monthly' }, '2027-01-05')).toBe(true);
    expect(occursOn({ event_date: '1990-03-14', repeat: 'yearly' }, '2027-03-14')).toBe(true);
    expect(occursOn({ event_date: '2026-10-25', repeat: 'none' }, '2026-10-26')).toBe(false);
  });
  it('ordena: todo el día primero, después por hora', () => {
    const list = eventsOn([ev('b', '2026-10-25', { starts_at: '15:00:00' }), ev('a', '2026-10-25', { starts_at: '09:30:00', ends_at: '10:00:00' }), ev('z', '2026-10-25')], '2026-10-25');
    expect(list.map((e) => e.id)).toEqual(['z', 'a', 'b']);
    expect(eventTime(list[1])).toBe('09:30 a 10:00');
    expect(eventTime(list[0])).toBe('Todo el día');
  });
});

describe('monthGrid', () => {
  it('octubre de 2026 parte el lunes 28 de septiembre y tiene semanas completas', () => {
    const weeks = monthGrid(2026, 9);
    expect(weeks[0][0]).toEqual({ day: '2026-09-28', inMonth: false });
    expect(weeks[0][3]).toEqual({ day: '2026-10-01', inMonth: true });
    expect(weeks.at(-1)!.at(-1)!.day).toBe('2026-11-01');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it('lee horas escritas a mano', () => {
    expect(parseTime('930')).toBe('09:30');
    expect(parseTime('09:30')).toBe('09:30');
    expect(parseTime('18')).toBe('18:00');
    expect(parseTime('2575')).toBeNull();
    expect(parseTime('')).toBeNull();
  });
  it('suma días cruzando el mes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('upcomingReminders', () => {
  it('programa un aviso por cada vez que ocurre, sin los pasados, con texto neutro en Salud', () => {
    const now = new Date(2026, 9, 25, 12, 0);
    const list = upcomingReminders(
      [
        ev('dentista', '2026-10-26', { starts_at: '10:00:00', remind_minutes: 60, layer: 'salud' }),
        ev('reunion', '2026-10-19', { starts_at: '11:00:00', repeat: 'weekly', remind_minutes: 15, location: 'Oficina' }),
        ev('cumple', '2026-10-25', { remind_minutes: 0 }),
        ev('sin aviso', '2026-10-26', { starts_at: '08:00:00' }),
      ],
      now,
      7,
    );
    // El cumpleaños de hoy avisaba a las 9:00 (ya pasó) y la reunión del 2 de noviembre queda fuera de los 7 días.
    expect(list.map((r) => [r.id, r.at.getHours(), r.at.getMinutes()])).toEqual([
      ['dentista:2026-10-26', 9, 0],
      ['reunion:2026-10-26', 10, 45],
    ]);
    expect(list[0].title).toBe('Recordatorio de Salud');
    expect(list[0].body).toBe('A las 10:00');
    expect(list[1].body).toBe('A las 11:00 · Oficina');
  });
});

describe('dailyPriorities', () => {
  const base: PriorityInput = { day: '2026-10-25', events: [], tasks: [], states: [], habits: { done: 0, total: 0 }, assessments: [], birthdays: [] };

  it('junta tareas, eventos, pruebas, cumpleaños y hábitos en orden', () => {
    const list = dailyPriorities({
      ...base,
      tasks: [task('luz', '2026-10-25', { urgent: 1 }), task('vieja', '2026-10-20'), task('otra', '2026-10-26'), task('sin fecha', null)],
      events: [ev('dentista', '2026-10-25', { starts_at: '10:00:00' })],
      assessments: [{ id: 'p1', title: 'Prueba de cálculo', course: 'Cálculo', due_on: '2026-10-26', grade: null }],
      birthdays: [{ id: 'k', name: 'Cami', birth_date: '2018-10-25' }],
      habits: { done: 1, total: 3 },
    });
    // Lo urgente va antes que lo que tiene hora (26-10-2026).
    expect(list.map((i) => i.key)).toEqual(['task:vieja', 'task:luz', 'event:dentista', 'assessment:p1', 'birthday:k', 'habits']);
    expect(list[0].sub).toBe('Atrasada · era para el 20-10');
    expect(list[3].title).toBe('Estudiar para: Prueba de cálculo');
    expect(list[4].sub).toBe('Cumple 8');
    expect(list[5].sub).toBe('1 de 3 hechos');
  });

  it('pone primero el evento marcado como prioridad del día y lo señala', () => {
    const list = dailyPriorities({
      ...base,
      events: [ev('reunion', '2026-10-25', { starts_at: '09:00:00' }), ev('clase', '2026-10-25', { starts_at: '20:30:00', importance: 1 } as never)],
    });
    expect(list.map((i) => i.key)).toEqual(['event:clase', 'event:reunion']);
    expect(list[0].title.startsWith('★')).toBe(true);
  });

  it('lo marcado va al final y lo descartado no aparece', () => {
    const list = dailyPriorities({
      ...base,
      tasks: [task('hecha', '2026-10-25', { status: 'done', done_on: '2026-10-25' }), task('pendiente', '2026-10-25')],
      events: [ev('reunion', '2026-10-18', { repeat: 'weekly' }), ev('cine', '2026-10-25')],
      states: [
        { id: 's1', day: '2026-10-25', origin_type: 'event', origin_id: 'reunion', status: 'done' },
        { id: 's2', day: '2026-10-25', origin_type: 'event', origin_id: 'cine', status: 'dismissed' },
      ],
    });
    expect(list.map((i) => [i.key, i.done])).toEqual([
      ['task:pendiente', false],
      ['task:hecha', true],
      ['event:reunion', true],
    ]);
  });
});
