import { plusDays } from '@/core/modules';
import { isoWeekday } from '@/core/studies';
import { DEMO_BOOKS, DEMO_VERSES } from './demoVerses';

// Los datos de ejemplo de la vitrina (src/app/vitrina.tsx, solo en desarrollo, 29-10-2026): una
// persona inventada con un mes de uso, para fotografiar las tarjetas reales de Inicio para la landing.
// Cada consulta se reconoce por la primera parte de su clave (data/live.ts y data/records.ts).

type Row = Record<string, unknown>;
const SPACE = 'demo';
let seq = 0;
const id = (p: string) => `${p}-${(seq += 1)}`;

// Los módulos encendidos (los nombres solo se usan para mostrarlos).
const ON: [string, string, string, number][] = [
  ['tu_rutina', 'Tu rutina', 'bridge', 2], ['perfil_personal', 'Perfil personal', 'personal', 0], ['calendario', 'Calendario', 'personal', 1], ['finanzas', 'Finanzas', 'personal', 1],
  ['habitos', 'Hábitos', 'personal', 1], ['prioridades', 'Prioridades', 'personal', 1], ['resumen', 'Resumen', 'personal', 1], ['alimentacion', 'Alimentación', 'personal', 2],
  ['documentos', 'Documentos', 'personal', 2], ['ejercicio', 'Ejercicio', 'personal', 2], ['estudios', 'Estudios', 'personal', 2], ['biblia', 'Biblia', 'personal', 3],
  ['diario', 'Diario', 'personal', 3], ['gratitud', 'Gratitud', 'personal', 3], ['salud', 'Salud', 'personal', 4], ['metas', 'Metas y desafíos', 'personal', 2],
  ['zen', 'Zen', 'personal', 3], ['meditacion', 'Meditación', 'personal', 3], ['respiracion', 'Respiración', 'personal', 3],
];

export function demoSource(today: string): (key: string) => unknown[] | undefined {
  const d = (n: number) => plusDays(today, n);
  const month = today.slice(0, 7);

  const habits: Row[] = [
    { id: 'h-agua', template_code: 'agua', name: 'Tomar agua', direction: 'good', daily_target: 8, unit: 'vasos', active: true, sort_order: 1 },
    { id: 'h-caminar', template_code: 'caminar', name: 'Caminar 30 minutos', direction: 'good', daily_target: 1, unit: null, active: true, sort_order: 2 },
    { id: 'h-leer', template_code: 'leer', name: 'Leer 10 minutos', direction: 'good', daily_target: 1, unit: null, active: true, sort_order: 3 },
    { id: 'h-orar', template_code: 'orar_meditar', name: 'Orar o meditar', direction: 'good', daily_target: 1, unit: null, active: true, sort_order: 4 },
    { id: 'h-entrenar', template_code: 'entrenar', name: 'Entrenar', direction: 'good', daily_target: 1, unit: null, active: true, sort_order: 5 },
    { id: 'h-redes', template_code: 'redes', name: 'Redes sociales', direction: 'reduce', daily_target: 2, unit: 'horas', active: true, sort_order: 6 },
  ];
  const logs: Row[] = [];
  for (let i = 0; i < 14; i++) {
    const day = d(-i);
    const add = (habit_id: string, count: number) => logs.push({ id: id('log'), habit_id, day, count });
    add('h-agua', i === 0 ? 5 : 6 + (i % 3));
    if (i % 4 !== 3) add('h-caminar', 1);
    if (i !== 0 && i % 2 === 0) add('h-entrenar', 1);
    if (i % 3 !== 2) add('h-leer', 1);
    if (i !== 0) add('h-orar', 1);
    add('h-redes', 1 + (i % 3));
  }

  const correr = id('meta');
  const entries: Row[] = [
    // Metas: correr 10K, con su ruta de pasos.
    { id: correr, module: 'metas', kind: 'meta', title: 'Correr 10K', until: d(40), data: { parte: 'Cuerpo', tipo: 'Meta' } },
    ...['Comprar zapatillas', 'Trotar 3 km sin parar', 'Trotar 5 km', 'Inscribirme en la carrera', 'Correr los 10K'].map((title, i) => ({ id: id('paso'), module: 'metas', kind: 'paso', parent_id: correr, title, done: i < 2, data: { orden: i } })),
    // Salud: los remedios de hoy.
    { id: 'r-1', module: 'salud', kind: 'remedio', title: 'Losartán', data: { dosis: '50 mg', veces: 1, hora: '08:00' } },
    { id: 'r-2', module: 'salud', kind: 'remedio', title: 'Vitamina D', data: { dosis: '1 cápsula', veces: 1 } },
    { id: id('toma'), module: 'salud', kind: 'toma', parent_id: 'r-1', day: today, done: true },
    // Ejercicio, meditación y respiración: sesiones de la semana.
    ...[0, -2, -4].map((n, i) => ({ id: id('ses'), module: 'ejercicio', kind: 'sesion', title: ['Trote', 'Bicicleta', 'Caminata'][i], day: d(n), value: [30, 45, 35][i] })),
    ...[0, -1, -2, -3, -4].map((n) => ({ id: id('med'), module: 'meditacion', kind: 'sesion', day: d(n), value: 10 })),
    ...[-1, -3].map((n) => ({ id: id('resp'), module: 'respiracion', kind: 'sesion', day: d(n), value: 3 })),
    // Pan de vida leído los días anteriores (la racha).
    ...[-1, -2, -3, -4, -5, -6].map((n) => ({ id: id('pan'), module: 'biblia', kind: 'pan', day: d(n) })),
    // El chequeo diario de cuerpo, mente y alma (de 1 a 5).
    ...[0, -1, -2, -3, -4, -5, -6].map((n, i) => ({ id: id('chk'), module: 'cuerpo_mente_alma', kind: 'chequeo', day: d(n), data: { cuerpo: 4, mente: i % 2 ? 3 : 4, alma: 3 } })),
    // Tu rutina, documentos y alimentación.
    { id: id('b'), module: 'tu_rutina', kind: 'bloque', title: 'Gimnasio', data: { dias: ['Lun', 'Mié', 'Vie'], desde: '07:00', hasta: '08:00' } },
    { id: id('b'), module: 'tu_rutina', kind: 'bloque', title: 'Trabajo', data: { dias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], desde: '09:00', hasta: '18:00' } },
    { id: id('doc'), module: 'documentos', kind: 'documento', title: 'Licencia de conducir', until: d(9), data: { tipo: 'Licencia' } },
    { id: id('doc'), module: 'documentos', kind: 'documento', title: 'Permiso de circulación', until: d(21), data: { tipo: 'Vehículo' } },
    { id: id('med'), module: 'alimentacion', kind: 'medida', day: d(-2), value: 64.5, data: { estatura: 165, sexo: 'Mujer', actividad: 'Moderada' } },
  ].map((e) => ({ parent_id: null, person_id: null, title: null, body: null, day: null, until: null, amount: null, value: null, done: false, data: {}, created_at: null, ...e }));

  const course = { id: 'c-ingles', name: 'Inglés II', institution: 'Instituto', term: null, teacher: 'Prof. Soto', pass_grade: 4, archived: false, person_id: null, program_id: null };
  const tables: Record<string, Row[]> = {
    habits,
    habit_logs: logs,
    module_entries: entries,
    calendar_events: [
      { id: id('ev'), title: 'Reunión de equipo', event_date: today, starts_at: '10:00:00', ends_at: '11:00:00', layer: 'trabajo', repeat: 'none', remind_minutes: null, location: null, notes: null },
      { id: id('ev'), title: 'Dentista', event_date: today, starts_at: '17:30:00', ends_at: '18:15:00', layer: 'salud', repeat: 'none', remind_minutes: 60, location: null, notes: null },
    ],
    tasks: [
      { id: id('t'), title: 'Pagar la cuenta de la luz', notes: null, due_on: today, due_at: null, status: 'pending', urgent: true, done_on: null },
      { id: id('t'), title: 'Llamar a mamá', notes: null, due_on: today, due_at: null, status: 'pending', urgent: false, done_on: null },
      { id: id('t'), title: 'Comprar el regalo de Ana', notes: null, due_on: d(2), due_at: null, status: 'pending', urgent: false, done_on: null },
    ],
    daily_priorities: [],
    study_courses: [course],
    study_blocks: [{ id: id('bl'), course_id: course.id, weekday: isoWeekday(today), starts_at: '19:00:00', ends_at: '20:30:00', room: 'Online' }],
    study_assessments: [],
    journal_days: [-1, -2, -3, -4, -5, -6].map((n, i) => ({ id: id('j'), day: d(n), mood: [4, 3, 4, 4, 3, 4][i], body: null, activities: 'Familia', closed: true })),
    gratitude_entries: [-1, -2, -3].map((n, i) => ({ id: id('g'), day: d(n), body: ['Un café con mi hermana', 'Terminé el informe a tiempo', 'Caminar al atardecer'][i] })),
    fin_accounts: [{ id: 'a-1', name: 'Cuenta corriente', kind: 'checking', opening_balance: 250000, archived: false }],
    fin_movements: [
      { id: id('m'), kind: 'income', occurred_on: `${month}-01`, amount: 980000, account_id: 'a-1', to_account_id: null, category_id: 'c-sueldo', debt_id: null, interest: null, is_salary: true, description: 'Sueldo' },
      ...[
        ['c-comida', 4500, 0, 'Almuerzo'],
        ['c-comida', 38900, -2, 'Supermercado'],
        ['c-comida', 52300, -9, 'Supermercado'],
        ['c-transporte', 25000, -5, 'Carga Bip!'],
        ['c-casa', 189000, -12, 'Arriendo (mi parte)'],
        ['c-casa', 32400, -6, 'Luz y agua'],
        ['c-salidas', 18900, -3, 'Cine'],
        ['c-salud', 12990, -7, 'Farmacia'],
      ]
        .filter(([, , n]) => d(n as number).slice(0, 7) === month)
        .map(([category_id, amount, n, description]) => ({ id: id('m'), kind: 'expense', occurred_on: d(n as number), amount, account_id: 'a-1', to_account_id: null, category_id, debt_id: null, interest: null, description })),
    ],
    fin_debts: [],
    fin_assets: [],
    bible_reads: [-1, -2, -3].map((n, i) => ({ id: id('br'), book: 'JHN', chapter: i + 1, read_on: d(n), created_at: d(n) })),
    bible_marks: [],
    cv_entries: [],
    assistant_lessons: [],
  };

  const named: Record<string, Row[]> = {
    'personal-space': [{ id: SPACE }],
    self: [{ name: '', birth_date: '1994-03-14' }],
    onboarding: [],
    not_interested: [],
    user_neurons: ON.map(([neuron_code]) => ({ neuron_code, state: 'discovered' })),
    neurons: ON.map(([code, name, hemisphere, level], i) => ({ code, name, hemisphere, level, minimum: null, summary: null, sensitive: false, min_age: 14, sort_order: i + 1 })),
    synapses: [],
    trades: [],
    holidays: [],
    family: [],
    habit_templates: habits.map((h, i) => ({ code: h.template_code, name: h.name, direction: h.direction, min_age: 0, suggested_target: h.daily_target, unit: h.unit, sort_order: i })),
    fin_categories: [
      { id: 'c-comida', name: 'Comida', kind: 'expense', sort_order: 1 },
      { id: 'c-casa', name: 'Casa', kind: 'expense', sort_order: 2 },
      { id: 'c-transporte', name: 'Transporte', kind: 'expense', sort_order: 3 },
      { id: 'c-salidas', name: 'Salidas', kind: 'expense', sort_order: 4 },
      { id: 'c-salud', name: 'Salud', kind: 'expense', sort_order: 5 },
      { id: 'c-sueldo', name: 'Sueldo', kind: 'income', sort_order: 6 },
    ],
    bible_books: Object.entries(DEMO_BOOKS).map(([code, name], i) => ({ code, ord: i + 1, name, testament: 'AT', chapters: 150 })),
  };

  return (key: string) => {
    const [name, , where = '', params = ''] = key.split(':');
    if (name === 'bible_verses') {
      const [, book, chapter] = key.split(':');
      return Object.entries(DEMO_VERSES)
        .filter(([ref]) => ref.startsWith(`${book}:${chapter}:`))
        .map(([ref, body]) => ({ verse: Number(ref.split(':')[2]), body }));
    }
    if (named[name]) return named[name];
    const rows = tables[name];
    if (!rows) return undefined;
    // Los registros de hábitos se piden por día o desde un día: se filtran igual que en el teléfono.
    if (name === 'habit_logs') {
      const p = params.split(',');
      if (where === 'day = ?') return rows.filter((r) => r.day === p[0]);
      if (where === 'day >= ?') return rows.filter((r) => String(r.day) >= p[0]);
      if (where.startsWith('habit_id = ?')) return rows.filter((r) => r.habit_id === p[0] && String(r.day) >= p[1]);
    }
    return rows;
  };
}
