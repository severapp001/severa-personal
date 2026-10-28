// Asistente (decisión del 25-10-2026): el usuario escribe con sus palabras, Claude propone acciones
// (herramientas) y la app las ejecuta solo si el usuario confirma. Si el usuario corrige una
// propuesta, la corrección queda como lección y viaja en las conversaciones siguientes: así Severa
// aprende sin reentrenar la IA.
// Dominio puro: arma el contexto, lee las propuestas y redacta lo aprendido. Sin React ni base.

import type { EventLayer, Repeat } from './agenda';
import { formatCLP } from './money';

// ─── Mensajes (formato de la API de Claude, guardados tal cual) ─────────────
// Los bloques de la IA (también los de razonamiento) se devuelven sin cambios en cada pedido:
// la API rechaza un historial editado.
export type Block = { type: string; [key: string]: unknown };
export type ChatMessage = { role: 'user' | 'assistant'; content: Block[] };
export type ToolUse = { type: 'tool_use'; id: string; name: string; input: unknown };

export const isText = (b: Block): b is { type: 'text'; text: string } => b.type === 'text' && typeof b.text === 'string';
export const isToolUse = (b: Block): b is ToolUse => b.type === 'tool_use' && typeof b.id === 'string';
const isToolResult = (b: Block): b is { type: 'tool_result'; tool_use_id: string; content: string } =>
  b.type === 'tool_result' && typeof b.tool_use_id === 'string';

/** Lo que el usuario respondió a una propuesta. Va al inicio del texto del resultado. */
export const RESULT = {
  done: 'Hecho',
  corrected: 'Corregido por la persona',
  cancelled: 'Cancelado por la persona',
  skipped: 'Sin respuesta (la persona escribió otra cosa); no se hizo',
  failed: 'Error al guardar',
} as const;
export type ResultStatus = keyof typeof RESULT;

export function toolResult(toolUseId: string, status: ResultStatus, detail?: string): Block {
  return { type: 'tool_result', tool_use_id: toolUseId, content: detail ? `${RESULT[status]}: ${detail}` : RESULT[status] };
}

/** Estado de una propuesta: null mientras el usuario no responde. */
export function resultOf(messages: ChatMessage[], toolUseId: string): ResultStatus | null {
  for (const m of messages) {
    if (m.role !== 'user') continue;
    for (const b of m.content) {
      if (!isToolResult(b) || b.tool_use_id !== toolUseId) continue;
      const found = (Object.keys(RESULT) as ResultStatus[]).find((k) => b.content.startsWith(RESULT[k]));
      return found ?? 'done';
    }
  }
  return null;
}

/** Propuestas del último mensaje de la IA que siguen esperando respuesta. */
export function pendingToolUses(messages: ChatMessage[]): ToolUse[] {
  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!last) return [];
  return last.content.filter(isToolUse).filter((t) => resultOf(messages, t.id) === null);
}

/** El texto que escribió el usuario antes del mensaje `index` (para guardar la lección). */
export function userTextBefore(messages: ChatMessage[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const texts = messages[i].role === 'user' ? messages[i].content.filter(isText).map((b) => b.text) : [];
    if (texts.length) return texts.join(' ');
  }
  return '';
}

/** Una conversación se cierra tras 6 horas sin mensajes o al llegar a 40: la siguiente parte limpia
 *  y con el contexto al día (montos, hábitos, lecciones nuevas). */
export function isStale(lastAt: string | null, messageCount: number, now: Date): boolean {
  if (!lastAt) return false;
  return messageCount >= 40 || now.getTime() - new Date(lastAt).getTime() > 6 * 3600_000;
}

// ─── Contexto ────────────────────────────────────────────────────────────────
// Referencias cortas (c1, a1, h1) en vez de ids largos: ahorran texto y la IA no puede inventar
// un id que no existe.
export type Ref = { kind: 'category' | 'account' | 'habit' | 'course'; id: string; name: string; sub?: string };
export type Refs = Record<string, Ref>;

export type Lesson = { kind: 'correction' | 'rule'; phrase: string; meaning: string };

export type ContextInput = {
  now: Date;
  mode: 'personal' | 'work';
  categories: { id: string; name: string; kind: 'expense' | 'income'; for_work?: number | boolean | null }[];
  accounts: { id: string; name: string; kind: string; archived?: number | boolean | null }[];
  habits: { id: string; name: string; direction: 'good' | 'reduce'; daily_target: number; unit: string | null }[];
  /** Conteo de hoy por hábito. */
  habitCounts: Record<string, number>;
  /** Gasto del mes por categoría, de mayor a menor. */
  monthSpent: { name: string; amount: number }[];
  monthIncome: number;
  recent: { occurred_on: string; kind: string; amount: number; category: string | null; description: string | null }[];
  /** Agenda de hoy y los próximos días (eventos y tareas con fecha), en orden. */
  upcoming?: { date: string; time: string | null; title: string; kind: 'evento' | 'tarea' }[];
  /** Tareas pendientes sin fecha. */
  undated?: string[];
  /** Diario de los últimos 7 días (ánimo de 1 a 4 y actividades). */
  journal?: { date: string; mood: number | null; activities: string[] }[];
  /** Lecciones activas, de la más reciente a la más antigua. */
  lessons: Lesson[];
};

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const ACCOUNT_KIND: Record<string, string> = {
  cash: 'efectivo',
  debit: 'débito',
  checking: 'cuenta corriente',
  savings: 'ahorro',
  investment: 'inversión',
  credit_card: 'tarjeta de crédito',
  business: 'cuenta del negocio',
};
const MOVEMENT_KIND: Record<string, string> = { expense: 'gasto', income: 'ingreso', transfer: 'transferencia', debt_payment: 'pago de deuda', adjustment: 'ajuste' };

/** Referencias para el modo sin IA: la llave lleva el id, así no cambian aunque aparezcan
 *  categorías o hábitos nuevos a mitad de una conversación. La primera cuenta es la de siempre. */
export function buildRefs(input: Pick<ContextInput, 'categories' | 'accounts' | 'habits'> & { courses?: { id: string; name: string; archived?: number | boolean | null }[] }): Refs {
  const refs: Refs = {};
  // Los ramos de Estudios (27-10-2026): «prueba de inglés el 3» va al ramo, no al calendario suelto.
  for (const c of (input.courses ?? []).filter((x) => !x.archived)) refs[`r:${c.id}`] = { kind: 'course', id: c.id, name: c.name };
  for (const a of input.accounts.filter((x) => !x.archived)) refs[`a:${a.id}`] = { kind: 'account', id: a.id, name: a.name };
  for (const c of input.categories) refs[`c:${c.id}`] = { kind: 'category', id: c.id, name: c.name, sub: c.kind };
  for (const h of input.habits) refs[`h:${h.id}`] = { kind: 'habit', id: h.id, name: h.name, sub: h.direction };
  return refs;
}

/** Máximo de lecciones por conversación: las más recientes mandan. */
export const LESSON_LIMIT = 40;

/** El contexto de una conversación: se arma una vez al empezarla y no cambia (la API exige el
 *  mismo comienzo en cada pedido). */
export function buildContext(input: ContextInput): { text: string; refs: Refs } {
  const refs: Refs = {};
  const lines: string[] = [];
  const d = input.now;
  lines.push(
    `Inicio de esta conversación: ${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()} (${isoDay(d)}), ${pad(d.getHours())}:${pad(d.getMinutes())}, hora de Chile.`,
    `Espacio abierto en la app: ${input.mode === 'work' ? 'Trabajo' : 'Personal'}.`,
    '',
  );

  let n = 0;
  for (const kind of ['expense', 'income'] as const) {
    lines.push(kind === 'expense' ? 'Categorías de gasto:' : 'Categorías de ingreso:');
    for (const c of input.categories.filter((x) => x.kind === kind)) {
      const key = `c${++n}`;
      refs[key] = { kind: 'category', id: c.id, name: c.name, sub: kind };
      lines.push(`${key} ${c.name}${c.for_work ? ' (Trabajo)' : ''}`);
    }
  }

  const accounts = input.accounts.filter((a) => !a.archived);
  lines.push('', 'Cuentas:');
  if (!accounts.length) lines.push('(ninguna todavía: usa null)');
  accounts.forEach((a, i) => {
    const key = `a${i + 1}`;
    refs[key] = { kind: 'account', id: a.id, name: a.name };
    lines.push(`${key} ${a.name} (${ACCOUNT_KIND[a.kind] ?? a.kind})${i === 0 ? ' · la de siempre' : ''}`);
  });

  lines.push('', 'Hábitos que cuenta:');
  if (!input.habits.length) lines.push('(ninguno todavía)');
  input.habits.forEach((h, i) => {
    const key = `h${i + 1}`;
    refs[key] = { kind: 'habit', id: h.id, name: h.name, sub: h.direction };
    const today = input.habitCounts[h.id] ?? 0;
    const goal = h.direction === 'reduce' ? 'por bajar' : `bueno, meta ${h.daily_target}${h.unit ? ` ${h.unit}` : ''} al día`;
    lines.push(`${key} ${h.name} (${goal}; hoy lleva ${today})`);
  });

  lines.push('', `Mes de ${MONTHS[d.getMonth()]}: ingresos ${formatCLP(input.monthIncome)}.`);
  lines.push(
    input.monthSpent.length
      ? `Gastos del mes: ${input.monthSpent.map((s) => `${s.name} ${formatCLP(s.amount)}`).join('; ')}.`
      : 'Gastos del mes: ninguno registrado.',
  );
  if (input.recent.length) {
    lines.push('', 'Últimos movimientos:');
    for (const m of input.recent) {
      const label = [m.category, m.description ? `«${m.description}»` : null].filter(Boolean).join(' ');
      lines.push(`${m.occurred_on} ${MOVEMENT_KIND[m.kind] ?? m.kind} ${formatCLP(m.amount)}${label ? ` ${label}` : ''}`);
    }
  }

  lines.push('', 'Agenda (hoy y los próximos 7 días):');
  if (!input.upcoming?.length) lines.push('(nada agendado)');
  for (const u of input.upcoming ?? []) lines.push(`${u.date}${u.time ? ` ${u.time}` : ''} ${u.kind}: ${u.title}`);
  if (input.undated?.length) lines.push(`Tareas sin fecha: ${input.undated.join('; ')}.`);
  if (input.journal?.length) {
    lines.push('', 'Diario (últimos 7 días; ánimo 1 difícil, 2 regular, 3 bien, 4 muy bien):');
    for (const j of input.journal) lines.push(`${j.date} ánimo ${j.mood ?? '—'}${j.activities.length ? ` · ${j.activities.join(', ')}` : ''}`);
  }

  const lessons = input.lessons.slice(0, LESSON_LIMIT);
  lines.push('', 'Lecciones (lo que la persona te enseñó o te corrigió; síguelas siempre):');
  if (!lessons.length) lines.push('(todavía ninguna)');
  for (const l of lessons) {
    lines.push(l.kind === 'rule' ? `- Regla: «${l.phrase}» → ${l.meaning}` : `- Cuando escribió «${l.phrase}»: ${l.meaning}`);
  }
  return { text: lines.join('\n'), refs };
}

// ─── Propuestas ──────────────────────────────────────────────────────────────
export type MovementProposal = {
  tool: 'registrar_movimiento';
  kind: 'expense' | 'income';
  amount: number;
  date: string;
  category: string | null;
  account: string | null;
  description: string | null;
};
export type HabitLogProposal = { tool: 'marcar_habito'; habit: string; times: number; date: string };
export type NewHabitProposal = { tool: 'crear_habito'; name: string; direction: 'good' | 'reduce'; target: number };
export type RuleProposal = { tool: 'recordar'; phrase: string; meaning: string };
export type EventProposal = {
  tool: 'crear_evento';
  title: string;
  date: string;
  start: string | null;
  end: string | null;
  layer: EventLayer;
  repeat: Repeat;
  remind: number | null;
  place: string | null;
};
export type TaskProposal = { tool: 'crear_tarea'; title: string; date: string | null; time: string | null; urgent: boolean };
export type JournalProposal = { tool: 'escribir_diario'; date: string; mood: number | null; text: string | null; activities: string[] };
export type GratitudeProposal = { tool: 'agradecer'; date: string; text: string };
/** Un ramo con su clase semanal (26-10-2026): «tengo Ingeniería económica los jueves a las 10:00». */
export type CourseProposal = { tool: 'crear_ramo'; name: string; weekday: number | null; start: string | null; end: string | null; until: string | null; teacher: string | null; group: boolean | null; evaluations: string | null };
/** Una prueba, control, entrega o unidad de un ramo de Estudios (27-10-2026). */
export type AssessmentProposal = { tool: 'crear_evaluacion'; course: string; title: string; date: string; weight: number | null };
export type Proposal = MovementProposal | HabitLogProposal | NewHabitProposal | RuleProposal | EventProposal | TaskProposal | JournalProposal | GratitudeProposal | CourseProposal | AssessmentProposal;

export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const MOOD_LABEL = ['', 'Difícil', 'Regular', 'Bien', 'Muy bien'];

const LAYER_VALUES: EventLayer[] = ['personal', 'trabajo', 'salud', 'estudios', 'familia', 'pagos', 'otro'];
const REPEAT_BY_WORD: Record<string, Repeat> = { no: 'none', semanal: 'weekly', mensual: 'monthly', anual: 'yearly' };
const time = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) && Number(v.slice(0, 2)) < 24 && Number(v.slice(3)) < 60 ? v : null);

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : Number(String(v ?? '').replace(/\D/g, '')) || 0);
const day = (v: unknown, today: string) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today);
const ref = (v: unknown, refs: Refs, kind: Ref['kind']) => {
  const key = str(v);
  return key && refs[key]?.kind === kind ? key : null;
};

/** Lee lo que propuso la IA. Devuelve null si no se puede ejecutar (falta un dato o una
 *  referencia no existe): la tarjeta lo dice y no se guarda nada. */
export function readProposal(name: string, raw: unknown, refs: Refs, today: string): Proposal | null {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  switch (name) {
    case 'registrar_movimiento': {
      const amount = int(input.monto);
      if (amount <= 0 || amount > 10_000_000_000) return null;
      const kind = input.tipo === 'ingreso' ? 'income' : 'expense';
      const category = ref(input.categoria, refs, 'category');
      return {
        tool: name,
        kind,
        amount,
        date: day(input.fecha, today),
        category: category && refs[category].sub === kind ? category : null,
        account: ref(input.cuenta, refs, 'account'),
        description: str(input.descripcion)?.slice(0, 200) ?? null,
      };
    }
    case 'marcar_habito': {
      const habit = ref(input.habito, refs, 'habit');
      if (!habit) return null;
      return { tool: name, habit, times: Math.min(100, Math.max(1, int(input.veces) || 1)), date: day(input.fecha, today) };
    }
    case 'crear_habito': {
      const habitName = str(input.nombre)?.slice(0, 60);
      if (!habitName) return null;
      return { tool: name, name: habitName, direction: input.tipo === 'reducir' ? 'reduce' : 'good', target: Math.min(100, Math.max(1, int(input.meta_diaria) || 1)) };
    }
    case 'recordar': {
      const phrase = str(input.frase)?.slice(0, 300);
      const meaning = str(input.significado)?.slice(0, 400);
      return phrase && meaning ? { tool: name, phrase, meaning } : null;
    }
    case 'crear_evento': {
      const title = str(input.titulo)?.slice(0, 120);
      if (!title) return null;
      const start = time(input.hora_inicio);
      const end = start ? time(input.hora_fin) : null;
      const remind = typeof input.aviso_minutos === 'number' && input.aviso_minutos >= 0 ? Math.min(20160, Math.round(input.aviso_minutos)) : null;
      return {
        tool: name,
        title,
        date: day(input.fecha, today),
        start,
        end: end && end > start! ? end : null,
        layer: LAYER_VALUES.includes(input.tipo as EventLayer) ? (input.tipo as EventLayer) : 'personal',
        repeat: REPEAT_BY_WORD[String(input.repetir)] ?? 'none',
        remind,
        place: str(input.lugar)?.slice(0, 120) ?? null,
      };
    }
    case 'crear_ramo': {
      const courseName = str(input.nombre)?.slice(0, 80);
      if (!courseName) return null;
      const wd = int(input.dia_semana);
      const start = time(input.hora_inicio);
      const end = start ? time(input.hora_fin) : null;
      return {
        tool: name,
        name: courseName,
        weekday: wd >= 1 && wd <= 7 ? wd : null,
        start,
        end: end && start && end > start ? end : null,
        until: typeof input.hasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.hasta) ? input.hasta : null,
        teacher: str(input.profesor)?.slice(0, 80) ?? null,
        group: typeof input.en_grupo === 'boolean' ? input.en_grupo : null,
        evaluations: str(input.evaluaciones)?.slice(0, 200) ?? null,
      };
    }
    case 'crear_tarea': {
      const title = str(input.titulo)?.slice(0, 160);
      if (!title) return null;
      const date = typeof input.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : null;
      return { tool: name, title, date, time: date ? time(input.hora) : null, urgent: input.urgente === true };
    }
    case 'escribir_diario': {
      const mood = typeof input.animo === 'number' && input.animo >= 1 && input.animo <= 4 ? Math.round(input.animo) : null;
      const text = str(input.texto)?.slice(0, 5000) ?? null;
      const activities = Array.isArray(input.actividades) ? input.actividades.map(str).filter((a): a is string => !!a).map((a) => a.slice(0, 30)).slice(0, 15) : [];
      if (!mood && !text && !activities.length) return null;
      return { tool: name, date: day(input.fecha, today), mood, text, activities };
    }
    case 'agradecer': {
      const text = str(input.texto)?.slice(0, 500);
      return text ? { tool: name, date: day(input.fecha, today), text } : null;
    }
    case 'crear_evaluacion': {
      const course = ref(input.ramo, refs, 'course');
      if (!course) return null;
      const weight = int(input.porcentaje);
      return { tool: name, course, title: str(input.titulo)?.slice(0, 80) ?? 'Prueba', date: day(input.fecha, today), weight: weight > 0 && weight <= 100 ? weight : null };
    }
    default:
      return null;
  }
}

const LAYER_LABEL: Record<EventLayer, string> = { personal: 'Personal', trabajo: 'Trabajo', salud: 'Salud', estudios: 'Estudios', familia: 'Familia', pagos: 'Pagos', otro: 'Otro' };
const REPEAT_LABEL: Record<Repeat, string> = { none: '', weekly: 'cada semana', monthly: 'cada mes', yearly: 'cada año' };
const hours = (start: string | null, end: string | null) => (start ? (end ? `${start} a ${end}` : start) : 'todo el día');

/** «hoy», «ayer», «mañana» o la fecha corta. */
export function dayLabel(date: string, today: string): string {
  const diff = Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000);
  if (diff === 0) return 'hoy';
  if (diff === -1) return 'ayer';
  if (diff === 1) return 'mañana';
  return `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}`;
}

/** Lo que muestra la tarjeta: un título y el detalle. */
export function describeProposal(p: Proposal, refs: Refs, today: string): { title: string; detail: string } {
  switch (p.tool) {
    case 'registrar_movimiento':
      return {
        title: `${p.kind === 'income' ? 'Ingreso' : 'Gasto'} ${formatCLP(p.amount)}`,
        detail: [
          p.category ? refs[p.category]?.name : 'Sin categoría',
          p.account ? refs[p.account]?.name : null,
          dayLabel(p.date, today),
          p.description ? `«${p.description}»` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'marcar_habito':
      return { title: refs[p.habit]?.name ?? 'Hábito', detail: `${refs[p.habit]?.sub === 'reduce' ? 'Contar' : 'Sumar'} ${p.times} · ${dayLabel(p.date, today)}` };
    case 'crear_habito':
      return { title: `Nuevo hábito: ${p.name}`, detail: p.direction === 'reduce' ? 'Por bajar' : `Bueno · meta ${p.target} al día` };
    case 'recordar':
      return { title: 'Aprender', detail: `«${p.phrase}» → ${p.meaning}` };
    case 'crear_evento':
      return {
        title: p.title,
        detail: [dayLabel(p.date, today), hours(p.start, p.end), LAYER_LABEL[p.layer], REPEAT_LABEL[p.repeat] || null, p.place].filter(Boolean).join(' · '),
      };
    case 'crear_tarea':
      return { title: `Tarea: ${p.title}`, detail: [p.date ? dayLabel(p.date, today) : 'Sin fecha', p.time, p.urgent ? 'urgente' : null].filter(Boolean).join(' · ') };
    case 'escribir_diario':
      return {
        title: `Diario · ${dayLabel(p.date, today)}`,
        detail: [p.mood ? MOOD_LABEL[p.mood] : null, p.activities.length ? p.activities.join(', ') : null, p.text ? `«${p.text.slice(0, 80)}${p.text.length > 80 ? '…' : ''}»` : null].filter(Boolean).join(' · '),
      };
    case 'agradecer':
      return { title: 'Agradezco', detail: `«${p.text}» · ${dayLabel(p.date, today)}` };
    case 'crear_ramo':
      return {
        title: `Ramo: ${p.name}`,
        detail: [
          p.weekday ? `${WEEKDAY_NAMES[p.weekday - 1]}${p.start ? ` ${hours(p.start, p.end)}` : ''}` : 'sin horario',
          p.until ? `hasta el ${p.until.slice(8, 10)}-${p.until.slice(5, 7)}` : null,
          p.teacher ? `prof. ${p.teacher}` : null,
          p.group === null ? null : p.group ? 'en grupo' : 'individual',
          p.evaluations,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'crear_evaluacion':
      return { title: `${p.title} · ${refs[p.course]?.name ?? 'Ramo'}`, detail: [dayLabel(p.date, today), p.weight ? `${p.weight} %` : null, 'Estudios y Calendario'].filter(Boolean).join(' · ') };
  }
}

/** La propuesta en una línea, para el resultado que vuelve a la IA y para las lecciones. */
export function proposalLine(p: Proposal, refs: Refs): string {
  switch (p.tool) {
    case 'registrar_movimiento':
      return [
        `${p.kind === 'income' ? 'ingreso' : 'gasto'} de ${formatCLP(p.amount)}`,
        p.category ? `en ${refs[p.category]?.name}` : 'sin categoría',
        p.account ? `desde ${refs[p.account]?.name}` : null,
        `el ${p.date}`,
        p.description ? `(«${p.description}»)` : null,
      ]
        .filter(Boolean)
        .join(' ');
    case 'marcar_habito':
      return `${refs[p.habit]?.name} ×${p.times} el ${p.date}`;
    case 'crear_habito':
      return `hábito nuevo «${p.name}» (${p.direction === 'reduce' ? 'por bajar' : `meta ${p.target} al día`})`;
    case 'recordar':
      return `regla «${p.phrase}» → ${p.meaning}`;
    case 'crear_evento':
      return `evento «${p.title}» el ${p.date}, ${hours(p.start, p.end)} (${LAYER_LABEL[p.layer]}${p.repeat !== 'none' ? `, ${REPEAT_LABEL[p.repeat]}` : ''})`;
    case 'crear_tarea':
      return `tarea «${p.title}»${p.date ? ` para el ${p.date}${p.time ? ` a las ${p.time}` : ''}` : ' sin fecha'}${p.urgent ? ', urgente' : ''}`;
    case 'escribir_diario':
      return `diario del ${p.date}${p.mood ? `, ánimo ${MOOD_LABEL[p.mood].toLowerCase()}` : ''}${p.activities.length ? `, actividades: ${p.activities.join(', ')}` : ''}${p.text ? ', con texto' : ''}`;
    case 'agradecer':
      return `gratitud del ${p.date}: «${p.text}»`;
    case 'crear_ramo':
      return `ramo «${p.name}»${p.weekday ? ` los ${WEEKDAY_NAMES[p.weekday - 1]}${p.start ? ` ${hours(p.start, p.end)}` : ''}` : ''}${p.until ? ` hasta el ${p.until}` : ''}`;
    case 'crear_evaluacion':
      return `${p.title.toLowerCase()} de ${refs[p.course]?.name ?? 'un ramo'} el ${p.date}${p.weight ? ` (${p.weight} %)` : ''}`;
  }
}

const sameProposal = (a: Proposal, b: Proposal) => JSON.stringify(a) === JSON.stringify(b);

/** Si el usuario corrigió la propuesta, la lección que queda; si no cambió nada, null. */
export function correctionLesson(userText: string, before: Proposal, after: Proposal, refs: Refs): Lesson | null {
  if (sameProposal(before, after) || before.tool === 'recordar') return null;
  const phrase = userText.trim().slice(0, 300) || proposalLine(before, refs);
  return { kind: 'correction', phrase, meaning: `era ${proposalLine(after, refs)}; habías propuesto ${proposalLine(before, refs)}`.slice(0, 400) };
}
