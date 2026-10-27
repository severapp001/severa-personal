// Copiado de src/core/agenda.ts por scripts/bot-core.js. No editar aquí.
// Agenda (MD4, 25-10-2026): calendario, tareas y prioridades del día. Calendario y Prioridades
// son sobre todo vistas: juntan lo que ya existe (eventos, tareas, hábitos, pruebas de Estudios,
// cumpleaños de Familia) sin copiarlo. Dominio puro: sin React ni base de datos.
// Fechas «AAAA-MM-DD» y horas «HH:MM» locales.

export type EventLayer = 'personal' | 'trabajo' | 'salud' | 'estudios' | 'familia' | 'pagos' | 'otro';
export type Repeat = 'none' | 'weekly' | 'monthly' | 'yearly';

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  starts_at: string | null;
  ends_at: string | null;
  layer: EventLayer;
  repeat: Repeat;
  remind_minutes: number | null;
  location: string | null;
  notes: string | null;
  importance?: number | null;
  repeat_until?: string | null;
};
export type TaskStatus = 'pending' | 'done' | 'skipped' | 'dismissed';
export type Task = {
  id: string;
  title: string;
  notes: string | null;
  due_on: string | null;
  due_at: string | null;
  status: TaskStatus;
  urgent: number | boolean | null;
  done_on: string | null;
  moved_from?: string | null;
};

/** «930», «9:30» o «0930» → «09:30»; null si no es una hora válida. */
export function parseTime(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (!digits || digits.length > 4) return null;
  const h = Number(digits.length <= 2 ? digits : digits.slice(0, -2));
  const m = digits.length <= 2 ? 0 : Number(digits.slice(-2));
  return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : null;
}
export type PriorityOrigin = 'event' | 'habits' | 'assessment' | 'birthday';
export type PriorityState = { id: string; day: string; origin_type: PriorityOrigin; origin_id: string; status: 'done' | 'dismissed' };

export const LAYERS: { value: EventLayer; label: string }[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'trabajo', label: 'Trabajo' },
  { value: 'salud', label: 'Salud' },
  { value: 'estudios', label: 'Estudios' },
  { value: 'familia', label: 'Familia' },
  { value: 'pagos', label: 'Pagos' },
  { value: 'otro', label: 'Otro' },
];
export const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'No se repite' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'monthly', label: 'Cada mes' },
  { value: 'yearly', label: 'Cada año' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const parse = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (day: string, n: number) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
export const weekday = (day: string) => parse(day).getDay();

/** «HH:MM» desde «HH:MM:SS» (así llegan las horas de la base) o null. */
export const hhmm = (t: string | null | undefined) => (t && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null);

/** ¿El evento ocurre ese día? Un evento que se repite parte en su fecha y sigue para siempre. */
export function occursOn(e: Pick<CalendarEvent, 'event_date' | 'repeat'> & { repeat_until?: string | null }, day: string): boolean {
  if (day === e.event_date) return true;
  if (e.repeat === 'none' || day < e.event_date) return false;
  if (e.repeat_until && day > String(e.repeat_until).slice(0, 10)) return false;
  if (e.repeat === 'weekly') return weekday(day) === weekday(e.event_date);
  if (e.repeat === 'monthly') return day.slice(8) === e.event_date.slice(8);
  return day.slice(5) === e.event_date.slice(5);
}

/** Los eventos del día: primero los de todo el día y después por hora. */
export function eventsOn<T extends Pick<CalendarEvent, 'event_date' | 'repeat' | 'starts_at' | 'title'>>(events: T[], day: string): T[] {
  return events
    .filter((e) => occursOn(e, day))
    .sort((a, b) => (hhmm(a.starts_at) ?? '').localeCompare(hhmm(b.starts_at) ?? '') || a.title.localeCompare(b.title));
}

/** Semanas del mes (lunes a domingo) con los días del mes anterior y siguiente para completar. */
export function monthGrid(year: number, month: number): { day: string; inMonth: boolean }[][] {
  const first = new Date(year, month, 1, 12);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const weeks: { day: string; inMonth: boolean }[][] = [];
  const cursor = new Date(start);
  do {
    const week = Array.from({ length: 7 }, () => {
      const cell = { day: isoDay(cursor), inMonth: cursor.getMonth() === month };
      cursor.setDate(cursor.getDate() + 1);
      return cell;
    });
    weeks.push(week);
  } while (cursor.getMonth() === month);
  return weeks;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const monthLabel = (year: number, month: number) => `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;
export const longDay = (day: string) => {
  const d = parse(day);
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};
export const shortDay = (day: string) => `${day.slice(8, 10)}-${day.slice(5, 7)}`;

/** Texto del horario de un evento. */
export function eventTime(e: Pick<CalendarEvent, 'starts_at' | 'ends_at'>): string {
  const s = hhmm(e.starts_at);
  const f = hhmm(e.ends_at);
  return s ? (f ? `${s} a ${f}` : s) : 'Todo el día';
}

export const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: 'Sin aviso' },
  { value: 0, label: 'A la hora' },
  { value: 15, label: '15 min antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
];

// ─── Avisos en el teléfono (P2) ─────────────────────────────────────────────
export type Reminder = { id: string; at: Date; title: string; body: string; /** Pantalla que abre al tocarlo. */ url?: string };

/** Los avisos de los próximos días: uno por cada vez que ocurre un evento con aviso. Los de todo el
 *  día avisan a las 9:00. Lo de Salud se avisa con un texto neutro (MD4: módulos sensibles). */
export function upcomingReminders(events: CalendarEvent[], now: Date, days = 14, max = 60): Reminder[] {
  const today = isoDay(now);
  const list: Reminder[] = [];
  for (let i = 0; i <= days; i++) {
    const day = addDays(today, i);
    for (const e of eventsOn(events, day)) {
      if (e.remind_minutes === null || e.remind_minutes === undefined) continue;
      const start = hhmm(e.starts_at) ?? '09:00';
      const at = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), Number(start.slice(0, 2)), Number(start.slice(3, 5)));
      at.setMinutes(at.getMinutes() - Number(e.remind_minutes));
      if (at <= now) continue;
      const when = hhmm(e.starts_at) ? `A las ${start}` : 'Hoy, todo el día';
      list.push({
        id: `${e.id}:${day}`,
        at,
        title: e.layer === 'salud' ? 'Recordatorio de Salud' : e.title,
        body: e.layer === 'salud' ? when : `${when}${e.location ? ` · ${e.location}` : ''}`,
      });
    }
  }
  return list.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}

/** El aviso para cerrar el día (usuario, 27-10-2026: «a una hora fija que elijo»): uno por día de
 *  los próximos `days`, salvo los días ya cerrados y si esa hora ya pasó. */
export function closingReminders(hour: string, now: Date, closed: Set<string>, days = 7): Reminder[] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hour);
  if (!m) return [];
  const today = isoDay(now);
  const list: Reminder[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    if (closed.has(day)) continue;
    const at = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), Number(m[1]), Number(m[2]));
    if (at <= now) continue;
    list.push({ id: `cierre:${day}`, at, title: 'Es hora de cerrar tu día', body: 'Un minuto: cómo estuvo, qué quedó pendiente y lo primero de mañana.', url: '/cierre' });
  }
  return list;
}

// ─── Prioridades del día ────────────────────────────────────────────────────
export type PriorityItem = {
  key: string;
  origin: 'task' | 'class' | 'goal' | PriorityOrigin;
  originId: string;
  title: string;
  sub: string;
  time: string | null;
  done: boolean;
  overdue: boolean;
  urgent: boolean;
};

export type PriorityInput = {
  day: string;
  events: CalendarEvent[];
  tasks: Task[];
  states: PriorityState[];
  /** Hábitos buenos de hoy: cuántos están hechos de cuántos. */
  habits: { done: number; total: number };
  /** Pruebas y entregas de Estudios. */
  assessments: { id: string; title: string; course: string | null; due_on: string | null; grade: number | null }[];
  /** Personas a cargo (Familia) con fecha de nacimiento. */
  birthdays: { id: string; name: string; birth_date: string | null }[];
  /** Las clases del día (Estudios), con su asistencia (26-10-2026). */
  classes?: { id: string; title: string; time: string | null; done: boolean; hidden?: boolean }[];
  /** Los pasos de las metas que tocan ese día (27-10-2026, `goalPriorities`). */
  goals?: { id: string; title: string; goal: string; pos: number; total: number; done: boolean; overdue: string | null }[];
};

const stateOf = (states: PriorityState[], day: string, origin: PriorityOrigin, id: string) =>
  states.filter((s) => s.day === day && s.origin_type === origin && s.origin_id === id).at(-1)?.status ?? null;

/** La lista del día: tareas (también las atrasadas), eventos, pruebas, cumpleaños y hábitos.
 *  Primero lo atrasado, después lo que tiene hora, después lo urgente; lo hecho va al final.
 *  Lo descartado no aparece. */
export function dailyPriorities(input: PriorityInput): PriorityItem[] {
  const { day } = input;
  const items: PriorityItem[] = [];
  const base = { overdue: false, urgent: false };

  for (const t of input.tasks) {
    if (t.status === 'dismissed' || t.status === 'skipped' || !t.due_on) continue;
    const overdue = t.status === 'pending' && t.due_on < day;
    const doneToday = t.status === 'done' && (t.done_on ?? t.due_on) === day;
    if (t.due_on !== day && !overdue && !doneToday) continue;
    items.push({
      key: `task:${t.id}`,
      origin: 'task',
      originId: t.id,
      title: t.title,
      sub: overdue ? `Atrasada · era para el ${shortDay(t.due_on)}` : 'Tarea',
      time: hhmm(t.due_at),
      done: t.status === 'done',
      overdue,
      urgent: !!t.urgent && t.urgent !== 0,
    });
  }

  for (const e of eventsOn(input.events, day)) {
    const state = stateOf(input.states, day, 'event', e.id);
    if (state === 'dismissed') continue;
    const imp = Number((e as { importance?: number | null }).importance) || 0;
    items.push({ ...base, urgent: imp > 0, key: `event:${e.id}`, origin: 'event', originId: e.id, title: `${imp === 2 ? '‼ ' : imp === 1 ? '★ ' : ''}${e.title}`, sub: `${eventTime(e)}${e.location ? ` · ${e.location}` : ''}`, time: hhmm(e.starts_at), done: state === 'done' });
  }

  for (const c of input.classes ?? []) {
    if (c.hidden) continue;
    items.push({ ...base, key: `class:${c.id}`, origin: 'class', originId: c.id, title: `Clase: ${c.title}`, sub: c.time ? `Estudios · ${c.time}` : 'Estudios', time: c.time, done: c.done });
  }

  for (const g of input.goals ?? []) {
    items.push({
      ...base,
      overdue: !!g.overdue,
      key: `goal:${g.id}`,
      origin: 'goal',
      originId: g.id,
      title: g.title,
      sub: g.overdue ? `${g.goal} · atrasado, era para el ${shortDay(g.overdue)}` : `${g.goal} · paso ${g.pos} de ${g.total}`,
      time: null,
      done: g.done,
    });
  }

  const tomorrow = addDays(day, 1);
  for (const a of input.assessments) {
    if (a.grade !== null || (a.due_on !== day && a.due_on !== tomorrow)) continue;
    const state = stateOf(input.states, day, 'assessment', a.id);
    if (state === 'dismissed') continue;
    const today = a.due_on === day;
    items.push({
      ...base,
      key: `assessment:${a.id}`,
      origin: 'assessment',
      originId: a.id,
      title: today ? a.title : `Estudiar para: ${a.title}`,
      sub: `${a.course ?? 'Estudios'} · ${today ? 'hoy' : 'mañana'}`,
      time: null,
      done: state === 'done',
    });
  }

  for (const p of input.birthdays) {
    if (!p.birth_date || p.birth_date.slice(5) !== day.slice(5)) continue;
    const state = stateOf(input.states, day, 'birthday', p.id);
    if (state === 'dismissed') continue;
    const years = Number(day.slice(0, 4)) - Number(p.birth_date.slice(0, 4));
    items.push({ ...base, key: `birthday:${p.id}`, origin: 'birthday', originId: p.id, title: `Cumpleaños de ${p.name}`, sub: years > 0 ? `Cumple ${years}` : 'Familia', time: null, done: state === 'done' });
  }

  if (input.habits.total > 0 && stateOf(input.states, day, 'habits', day) !== 'dismissed') {
    items.push({
      ...base,
      key: 'habits',
      origin: 'habits',
      originId: day,
      title: 'Completar tus hábitos',
      sub: `${input.habits.done} de ${input.habits.total} hechos`,
      time: null,
      done: input.habits.done >= input.habits.total,
    });
  }

  // Lo urgente o marcado como prioridad del día va primero (26-10-2026).
  const rank = (i: PriorityItem) => (i.done ? 4 : i.overdue ? 0 : i.urgent ? 1 : i.time ? 2 : 3);
  return items.sort((a, b) => rank(a) - rank(b) || (a.time ?? '').localeCompare(b.time ?? '') || Number(b.urgent) - Number(a.urgent));
}
