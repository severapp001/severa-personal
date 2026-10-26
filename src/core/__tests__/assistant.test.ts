import { describe, expect, it } from '@jest/globals';

import {
  buildContext,
  correctionLesson,
  dayLabel,
  describeProposal,
  isStale,
  pendingToolUses,
  readProposal,
  resultOf,
  toolResult,
  userTextBefore,
  type ChatMessage,
  type ContextInput,
} from '../assistant';

const input: ContextInput = {
  now: new Date(2026, 9, 25, 14, 5),
  mode: 'personal',
  categories: [
    { id: 'uuid-food', name: 'Alimentación', kind: 'expense' },
    { id: 'uuid-fuel', name: 'Bencina', kind: 'expense', for_work: 1 },
    { id: 'uuid-salary', name: 'Sueldo', kind: 'income' },
  ],
  accounts: [
    { id: 'uuid-debit', name: 'Débito', kind: 'debit' },
    { id: 'uuid-old', name: 'Vieja', kind: 'cash', archived: 1 },
  ],
  habits: [{ id: 'uuid-water', name: 'Tomar agua', direction: 'good', daily_target: 8, unit: 'vasos' }],
  habitCounts: { 'uuid-water': 3 },
  monthSpent: [{ name: 'Alimentación', amount: 45000 }],
  monthIncome: 800000,
  recent: [{ occurred_on: '2026-10-24', kind: 'expense', amount: 5000, category: 'Alimentación', description: 'almuerzo' }],
  lessons: [{ kind: 'rule', phrase: 'lucas', meaning: 'miles de pesos' }],
};

describe('buildContext', () => {
  const { text, refs } = buildContext(input);
  it('usa referencias cortas en vez de ids', () => {
    expect(refs.c1).toEqual({ kind: 'category', id: 'uuid-food', name: 'Alimentación', sub: 'expense' });
    expect(refs.c3.sub).toBe('income');
    expect(refs.a1.id).toBe('uuid-debit');
    expect(refs.h1.id).toBe('uuid-water');
    expect(text).not.toContain('uuid-');
  });
  it('deja fuera las cuentas archivadas', () => {
    expect(refs.a2).toBeUndefined();
    expect(text).not.toContain('Vieja');
  });
  it('trae la fecha, el mes, los hábitos de hoy y las lecciones', () => {
    expect(text).toContain('domingo 25 de octubre de 2026 (2026-10-25), 14:05');
    expect(text).toContain('c2 Bencina (Trabajo)');
    expect(text).toContain('h1 Tomar agua (bueno, meta 8 vasos al día; hoy lleva 3)');
    expect(text).toContain('Gastos del mes: Alimentación $45.000.');
    expect(text).toContain('- Regla: «lucas» → miles de pesos');
  });
  it('es igual cada vez con los mismos datos (la API pide el mismo comienzo)', () => {
    expect(buildContext(input).text).toBe(text);
  });
});

describe('readProposal', () => {
  const { refs } = buildContext(input);
  const today = '2026-10-25';
  it('un gasto con sus referencias', () => {
    expect(
      readProposal('registrar_movimiento', { tipo: 'gasto', monto: 5000, fecha: '2026-10-24', categoria: 'c1', cuenta: 'a1', descripcion: 'almuerzo' }, refs, today),
    ).toEqual({ tool: 'registrar_movimiento', kind: 'expense', amount: 5000, date: '2026-10-24', category: 'c1', account: 'a1', description: 'almuerzo' });
  });
  it('descarta referencias que no existen o de otro tipo', () => {
    const p = readProposal('registrar_movimiento', { tipo: 'ingreso', monto: '800.000', fecha: 'ayer', categoria: 'c1', cuenta: 'a9', descripcion: '' }, refs, today);
    expect(p).toEqual({ tool: 'registrar_movimiento', kind: 'income', amount: 800000, date: today, category: null, account: null, description: null });
  });
  it('sin monto o sin hábito no hay propuesta', () => {
    expect(readProposal('registrar_movimiento', { tipo: 'gasto', monto: 0 }, refs, today)).toBeNull();
    expect(readProposal('marcar_habito', { habito: 'h7', veces: 1 }, refs, today)).toBeNull();
    expect(readProposal('otra_cosa', {}, refs, today)).toBeNull();
  });
  it('eventos y tareas de la agenda', () => {
    expect(
      readProposal('crear_evento', { titulo: 'Dentista', fecha: '2026-10-26', hora_inicio: '10:00', hora_fin: '09:00', tipo: 'salud', repetir: 'no', aviso_minutos: 60, lugar: null }, refs, today),
    ).toEqual({ tool: 'crear_evento', title: 'Dentista', date: '2026-10-26', start: '10:00', end: null, layer: 'salud', repeat: 'none', remind: 60, place: null });
    const tarea = readProposal('crear_tarea', { titulo: 'Pagar la luz', fecha: null, hora: '18:00', urgente: true }, refs, today);
    expect(tarea).toEqual({ tool: 'crear_tarea', title: 'Pagar la luz', date: null, time: null, urgent: true });
    expect(describeProposal(tarea!, refs, today)).toEqual({ title: 'Tarea: Pagar la luz', detail: 'Sin fecha · urgente' });
  });
  it('diario y gratitud', () => {
    expect(readProposal('escribir_diario', { fecha: '2026-10-25', animo: 4, texto: 'Salí con mi familia', actividades: ['Familia', ''] }, refs, today)).toEqual({
      tool: 'escribir_diario',
      date: '2026-10-25',
      mood: 4,
      text: 'Salí con mi familia',
      activities: ['Familia'],
    });
    expect(readProposal('escribir_diario', { fecha: '2026-10-25', animo: 9, texto: null, actividades: [] }, refs, today)).toBeNull();
    expect(readProposal('agradecer', { fecha: 'hoy', texto: 'El almuerzo con mi mamá' }, refs, today)).toEqual({ tool: 'agradecer', date: today, text: 'El almuerzo con mi mamá' });
  });
  it('hábitos y reglas', () => {
    expect(readProposal('marcar_habito', { habito: 'h1', veces: 3, fecha: today }, refs, today)).toEqual({ tool: 'marcar_habito', habit: 'h1', times: 3, date: today });
    expect(readProposal('crear_habito', { nombre: 'Fumar', tipo: 'reducir', meta_diaria: 1 }, refs, today)).toEqual({ tool: 'crear_habito', name: 'Fumar', direction: 'reduce', target: 1 });
    expect(readProposal('recordar', { frase: 'lucas', significado: 'miles' }, refs, today)).toEqual({ tool: 'recordar', phrase: 'lucas', meaning: 'miles' });
  });
});

describe('tarjetas y lecciones', () => {
  const { refs } = buildContext(input);
  it('describe la propuesta como la lee el usuario', () => {
    const p = readProposal('registrar_movimiento', { tipo: 'gasto', monto: 5000, fecha: '2026-10-25', categoria: 'c1', cuenta: 'a1', descripcion: 'almuerzo' }, refs, '2026-10-25')!;
    expect(describeProposal(p, refs, '2026-10-25')).toEqual({ title: 'Gasto $5.000', detail: 'Alimentación · Débito · hoy · «almuerzo»' });
    expect(dayLabel('2026-10-24', '2026-10-25')).toBe('ayer');
    expect(dayLabel('2026-10-01', '2026-10-25')).toBe('01-10-2026');
  });
  it('una corrección queda como lección; sin cambios, no', () => {
    const before = readProposal('registrar_movimiento', { tipo: 'gasto', monto: 5000, fecha: '2026-10-25', categoria: 'c1', cuenta: null }, refs, '2026-10-25')!;
    const after = { ...before, category: 'c2' };
    expect(correctionLesson('eché 5 lucas en la copec', before, before, refs)).toBeNull();
    expect(correctionLesson('eché 5 lucas en la copec', before, after, refs)).toEqual({
      kind: 'correction',
      phrase: 'eché 5 lucas en la copec',
      meaning: 'era gasto de $5.000 en Bencina el 2026-10-25; habías propuesto gasto de $5.000 en Alimentación el 2026-10-25',
    });
  });
});

describe('conversación', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'almorcé 6 lucas y tomé 2 vasos' }] },
    {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'tool_use', id: 't1', name: 'registrar_movimiento', input: {} },
        { type: 'tool_use', id: 't2', name: 'marcar_habito', input: {} },
      ],
    },
    { role: 'user', content: [toolResult('t1', 'corrected', 'gasto de $6.000')] },
  ];
  it('sabe qué propuestas siguen esperando y cómo terminó cada una', () => {
    expect(pendingToolUses(messages).map((t) => t.id)).toEqual(['t2']);
    expect(resultOf(messages, 't1')).toBe('corrected');
    expect(resultOf(messages, 't2')).toBeNull();
  });
  it('encuentra lo que escribió el usuario antes de la propuesta', () => {
    expect(userTextBefore(messages, 1)).toBe('almorcé 6 lucas y tomé 2 vasos');
  });
  it('se renueva tras 6 horas o 40 mensajes', () => {
    const now = new Date('2026-10-25T20:00:00Z');
    expect(isStale(null, 0, now)).toBe(false);
    expect(isStale('2026-10-25T15:00:00Z', 3, now)).toBe(false);
    expect(isStale('2026-10-25T13:00:00Z', 3, now)).toBe(true);
    expect(isStale('2026-10-25T19:00:00Z', 40, now)).toBe(true);
  });
});
