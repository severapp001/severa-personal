import { describe, expect, it } from '@jest/globals';

import type { Refs } from '../assistant';
import { correctionRules, findAmount, findDate, findTime, HELP, lessonHints, parseMessage, type IntentData } from '../intent';

const refs: Refs = {
  c1: { kind: 'category', id: 'food', name: 'Alimentación', sub: 'expense' },
  c2: { kind: 'category', id: 'fuel', name: 'Bencina', sub: 'expense' },
  c3: { kind: 'category', id: 'transport', name: 'Transporte', sub: 'expense' },
  c4: { kind: 'category', id: 'salary', name: 'Sueldo', sub: 'income' },
  a1: { kind: 'account', id: 'debit', name: 'Débito' },
  a2: { kind: 'account', id: 'credit', name: 'Tarjeta CMR' },
  h1: { kind: 'habit', id: 'water', name: 'Tomar agua', sub: 'good' },
  h2: { kind: 'habit', id: 'smoke', name: 'Cigarros', sub: 'reduce' },
  r1: { kind: 'course', id: 'english', name: 'Inglés' },
};
const today = '2026-10-25'; // domingo
const ctx = { today, refs, lessons: [] };
const data: IntentData = {
  movements: [
    { date: '2026-10-25', kind: 'expense', amount: 6000, category: 'Alimentación' },
    { date: '2026-10-20', kind: 'expense', amount: 20000, category: 'Bencina' },
    { date: '2026-09-30', kind: 'expense', amount: 99999, category: 'Alimentación' },
  ],
  agenda: [{ date: '2026-10-26', time: '10:00', title: 'Dentista', kind: 'evento' }],
  habits: [{ name: 'Tomar agua', count: 3, target: 8, reduce: false }],
  paydayDays: 5,
};
const one = (text: string) => parseMessage(text, ctx, data).calls;

describe('montos, fechas y horas', () => {
  it('lee montos a la chilena', () => {
    expect(findAmount('gasté 5 lucas')?.amount).toBe(5000);
    expect(findAmount('una luca')?.amount).toBe(1000);
    expect(findAmount('2,5 lucas')?.amount).toBe(2500);
    expect(findAmount('$5.000')?.amount).toBe(5000);
    expect(findAmount('me pagaron 800 mil')?.amount).toBe(800000);
    expect(findAmount('un palo')?.amount).toBe(1000000);
    expect(findAmount('almuerzo 8000')?.amount).toBe(8000);
    expect(findAmount('a las 10')).toBeNull();
    expect(findAmount('tomé 3 vasos')).toBeNull();
  });
  it('lee fechas hacia atrás y hacia adelante', () => {
    expect(findDate('ayer', today, false)?.date).toBe('2026-10-24');
    expect(findDate('mañana', today, true)?.date).toBe('2026-10-26');
    expect(findDate('el viernes', today, true)?.date).toBe('2026-10-30');
    expect(findDate('el viernes', today, false)?.date).toBe('2026-10-23');
    expect(findDate('el 15 de noviembre', today, true)?.date).toBe('2026-11-15');
    expect(findDate('el 3', today, true)?.date).toBe('2026-11-03');
    expect(findDate('a las 10 de la mañana', today, true)).toBeNull();
  });
  it('lee horas', () => {
    expect(findTime('a las 10')?.time).toBe('10:00');
    expect(findTime('a las 3 de la tarde')?.time).toBe('15:00');
    expect(findTime('18:30')?.time).toBe('18:30');
    expect(findTime('7pm')?.time).toBe('19:00');
    expect(findTime('gasté $5.000')).toBeNull();
  });
});

describe('acciones', () => {
  it('un gasto con categoría, cuenta y descripción', () => {
    expect(one('gasté 5 lucas en el almuerzo')).toEqual([
      { name: 'registrar_movimiento', input: { tipo: 'gasto', monto: 5000, fecha: today, categoria: 'c1', cuenta: 'a1', descripcion: 'almuerzo' } },
    ]);
    expect(one('eché 20 lucas de bencina en la Copec con la tarjeta CMR ayer')[0].input).toMatchObject({ monto: 20000, categoria: 'c2', cuenta: 'a2', fecha: '2026-10-24', descripcion: 'bencina en la Copec con la CMR' });
  });
  it('un ingreso', () => {
    expect(one('me pagaron el sueldo 850 mil')[0].input).toMatchObject({ tipo: 'ingreso', monto: 850000, categoria: 'c4' });
  });
  it('hábitos con número', () => {
    expect(one('+1 agua')).toEqual([{ name: 'marcar_habito', input: { habito: 'h1', veces: 1, fecha: today } }]);
    expect(one('tomé 3 vasos de agua')[0].input).toMatchObject({ habito: 'h1', veces: 3 });
    expect(one('fumé 2')[0].input).toMatchObject({ habito: 'h2', veces: 2 });
  });
  it('varias acciones en un mensaje', () => {
    expect(one('almorcé 6 lucas y tomé 2 vasos de agua').map((c) => c.name)).toEqual(['registrar_movimiento', 'marcar_habito']);
  });
  it('un evento con aviso y tipo', () => {
    expect(one('dentista mañana a las 10, avísame una hora antes')).toEqual([
      { name: 'crear_evento', input: { titulo: 'Dentista', fecha: '2026-10-26', hora_inicio: '10:00', hora_fin: null, tipo: 'salud', repetir: 'no', aviso_minutos: 60, lugar: null } },
    ]);
    expect(one('cumpleaños de mi mamá el 14 de marzo')[0].input).toMatchObject({ titulo: 'Cumpleaños de mi mamá', fecha: '2027-03-14', tipo: 'familia', repetir: 'anual', hora_inicio: null });
    expect(one('reunión el lunes a las 3 de la tarde')[0].input).toMatchObject({ titulo: 'Reunión', fecha: '2026-10-26', hora_inicio: '15:00', tipo: 'trabajo' });
  });
  it('tareas', () => {
    expect(one('tarea pagar la luz el viernes')).toEqual([{ name: 'crear_tarea', input: { titulo: 'Pagar la luz', fecha: '2026-10-30', hora: null, urgente: false } }]);
    expect(one('tengo que llamar al banco urgente')[0].input).toMatchObject({ titulo: 'Llamar al banco', fecha: null, urgente: true });
  });
  it('diario y gratitud', () => {
    expect(one('hoy fue un buen día, salí con mi familia y fui al gym')).toEqual([
      { name: 'escribir_diario', input: { fecha: today, animo: 3, texto: 'hoy fue un buen día, salí con mi familia y fui al gym', actividades: ['Ejercicio', 'Familia', 'Salir'] } },
    ]);
    expect(one('fue un 9')[0].input).toMatchObject({ animo: 4 });
    expect(one('agradezco el almuerzo con mi mamá')).toEqual([{ name: 'agradecer', input: { fecha: today, texto: 'El almuerzo con mi mamá' } }]);
  });
  it('reglas y lo que no entiende', () => {
    expect(one('cuando digo la copec es bencina')).toEqual([{ name: 'recordar', input: { frase: 'la copec', significado: 'bencina' } }]);
    expect(parseMessage('hola qué tal', ctx, data)).toEqual({ reply: HELP, calls: [] });
  });
});

describe('preguntas con tus datos', () => {
  const ask = (q: string) => parseMessage(q, ctx, data).reply;
  it('gastos, agenda, hábitos y pago', () => {
    expect(ask('¿cuánto gasté este mes?')).toBe('Este mes llevas $26.000 en gastos (2 movimientos).');
    expect(ask('¿cuánto gasté hoy en comida?')).toBe('Hoy llevas $6.000 en gastos de Alimentación (1 movimiento).');
    expect(ask('¿qué tengo mañana?')).toBe('Mañana:\n• 10:00 Dentista');
    expect(ask('¿cómo voy con mis hábitos?')).toBe('Hoy:\n• Tomar agua: 3 de 8');
    expect(ask('¿cuánto falta para el pago?')).toBe('Faltan 5 días para tu pago.');
  });
});

describe('aprende de las correcciones', () => {
  it('la corrección queda como regla y se usa la próxima vez', () => {
    const before = { tool: 'registrar_movimiento', category: 'c1', account: 'a1', description: 'copec' };
    const after = { ...before, category: 'c2' };
    const rules = correctionRules('gasté 20 lucas en la copec', before, after, refs);
    expect(rules).toEqual([{ kind: 'rule', phrase: 'copec', meaning: 'Categoría: Bencina' }]);
    expect(lessonHints('pagué 15 lucas en la COPEC', rules, refs)).toEqual({ category: 'c2' });
    const next = parseMessage('pagué 15 lucas en la copec del centro', { ...ctx, lessons: rules }, data).calls[0];
    expect(next.input.categoria).toBe('c2');
  });
});

describe('ramos (26-10-2026)', () => {
  it('entiende el ramo del usuario y pregunta lo que falta', () => {
    const r = parseMessage('Tengo un ramo de universidad llamado Ingenieria economica todos los jueves a las 10:00 hasta que termine el trimestre en diciembre', ctx, data);
    expect(r.calls).toEqual([
      {
        name: 'crear_ramo',
        input: { nombre: 'Ingenieria economica', dia_semana: 4, hora_inicio: '10:00', hora_fin: null, hasta: '2026-12-31', profesor: null, en_grupo: null, evaluaciones: null },
      },
    ]);
    expect(r.reply).toContain('¿Hasta qué hora dura la clase de las 10:00?');
    expect(r.reply).toContain('profesor');
    expect(r.reply).toContain('grupo');
  });

  it('lee el rango de horas, el profesor y si es en grupo', () => {
    const [c] = one('tengo el ramo Cálculo los martes de 20:30 a 22:00 con el profesor Pérez, trabajos en grupo');
    expect(c.input).toMatchObject({ nombre: 'Cálculo', dia_semana: 2, hora_inicio: '20:30', hora_fin: '22:00', profesor: 'Pérez', en_grupo: true, evaluaciones: 'Trabajos' });
  });
});

describe('frases de la prueba en Telegram (27-10-2026)', () => {
  it('una prueba de un ramo va a Estudios', () => {
    expect(one('3 de noviembre prueba de inglés')).toEqual([{ name: 'crear_evaluacion', input: { ramo: 'r1', titulo: 'Prueba', fecha: '2026-11-03', porcentaje: null } }]);
  });
  it('el cierre de una unidad también, aunque venga en una frase larga', () => {
    expect(one('10 de noviembre deben estar cerrada hasta la unidad 5 de inglés')[0].input).toMatchObject({ ramo: 'r1', titulo: 'Cierre unidad 5', fecha: '2026-11-10' });
    expect(one('Dentro de mi app tengo el ramo de inglés, y el 10 de noviembre se cierra la unidad 5, es como una prueba')[0]).toMatchObject({ name: 'crear_evaluacion', input: { titulo: 'Cierre unidad 5' } });
  });
  it('sin el ramo en Estudios, queda como evento de Estudios', () => {
    expect(one('3 de noviembre prueba de historia')[0]).toMatchObject({ name: 'crear_evento', input: { tipo: 'estudios' } });
  });
  it('los títulos no llevan la orden y conservan los números', () => {
    expect(one('Agrega evento trotar 5 km hoy')[0].input).toMatchObject({ titulo: 'Trotar 5 km', fecha: today });
    expect(one('Agregar evento para el 30 de octubre, enviar correo a fiscal por suspensión')[0].input).toMatchObject({ titulo: 'Enviar correo a fiscal por suspensión', fecha: '2026-10-30' });
  });
  it('algo con fecha y sin otra pista es una tarea de ese día', () => {
    expect(one('Trotar 5km hoy')).toEqual([{ name: 'crear_tarea', input: { titulo: 'Trotar 5km', fecha: today, hora: null, urgente: false } }]);
  });
});
