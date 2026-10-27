// Bot de Telegram de Severa (usuario, 27-10-2026: «un bot propio de Severa, con BotFather»; ver
// docs/02 Producto/Bot de Telegram de Severa.md). Recibe los mensajes del bot, los entiende con el
// mismo intérprete del Asistente (copiado de src/core con `npm run bot:core`), propone qué anotar y
// guarda solo cuando la persona toca «Guardar». También muestra el día (/hoy) y cierra el día con
// botones (/cerrar). Sin IA: gratis. Lo anotado cae en el espacio personal y llega al teléfono por
// la sincronización de siempre.
// Desde la app (Ajustes → Conectar Telegram) se llama con la sesión: registra el webhook y entrega
// un código de un solo uso para conectar el chat. Telegram llama con la cabecera secreta, que sale
// del token del bot (secreto TELEGRAM_BOT_TOKEN): no hay otro secreto que guardar.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { addDays, dailyPriorities, eventsOn, hhmm, type CalendarEvent, type PriorityState, type Task } from '../_shared/core/agenda.ts';
import { buildRefs, proposalLine, readProposal, type Lesson, type Proposal, type Refs } from '../_shared/core/assistant.ts';
import { goalPriorities, type GoalRow } from '../_shared/core/goals.ts';
import { HELP, parseMessage, type IntentData, type ToolCall } from '../_shared/core/intent.ts';
import { activitiesOf, MOODS } from '../_shared/core/journal.ts';
import { classesOn, type Block } from '../_shared/core/studies.ts';
import { daysToPayday, type PaydayAnswer } from '../_shared/core/today.ts';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const BASE = Deno.env.get('SUPABASE_URL') ?? '';
const admin = createClient(BASE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const allowed = (Deno.env.get('ASSISTANT_ALLOWED_USERS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const COMMANDS = [
  { command: 'hoy', description: 'Tu día y tus prioridades' },
  { command: 'cerrar', description: 'Cerrar el día' },
  { command: 'idea', description: 'Guardar una idea' },
  { command: 'tarea', description: 'Anotar una tarea' },
  { command: 'gasto', description: 'Anotar un gasto' },
  { command: 'ayuda', description: 'Qué puedo anotar' },
  { command: 'desconectar', description: 'Desconectar este chat' },
];

const HELP_BOT = [
  'Escríbeme como hablas y te propongo qué anotar; tú lo guardas con un toque:',
  '• «gasté 5 lucas en el almuerzo» o «me pagaron 800 mil»',
  '• «+1 agua» o «fumé 2»',
  '• «dentista mañana a las 10, avísame una hora antes»',
  '• «tarea pagar la luz el viernes»',
  '• «idea: vender el auto y comprar uno más chico»',
  '• «hoy fue un buen día, salí con mi familia» o «agradezco …»',
  '• «¿cuánto gasté este mes?» o «¿qué tengo mañana?»',
  '',
  'Comandos: /hoy · /cerrar · /idea · /tarea · /gasto · /desconectar',
  'Por privacidad, lo de Salud, Íntimo y ciclo y Terapia se anota solo en la app.',
].join('\n');
const NOT_LINKED = 'Hola, soy Severa. Para conectar este chat con tu cuenta, abre la app → Ajustes → Conectar Telegram.';
const PARTS = [
  { key: 'cuerpo', label: 'Cuerpo · energía y descanso' },
  { key: 'mente', label: 'Mente · calma y claridad' },
  { key: 'alma', label: 'Alma · conexión y propósito' },
] as const;
const WEEK = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ─── Telegram ────────────────────────────────────────────────────────────────
type Button = { text: string; callback_data: string };
type Message = { message_id: number; chat: { id: number; type: string }; from?: { username?: string }; text?: string };
type Update = { message?: Message; callback_query?: { id: string; data?: string; message?: Message } };

async function tg(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: Record<string, unknown>; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}
const send = (chat: number, text: string, buttons?: Button[][]) => tg('sendMessage', { chat_id: chat, text, ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) });
const edit = (m: Message, text: string) => tg('editMessageText', { chat_id: m.chat.id, message_id: m.message_id, text });

async function webhookSecret(): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${TOKEN}:severa-webhook`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}
const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');

/** El día en Chile (la función corre en UTC). */
const chileToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const longDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEK[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
};
const parseData = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === 'object') return v as Record<string, unknown>;
  try {
    const o = JSON.parse(String(v ?? '{}'));
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
};

// ─── La cuenta conectada y su contexto ───────────────────────────────────────
type Flow = { kind: 'cierre'; step: 'animo' | 'cuerpo' | 'mente' | 'alma' | 'bueno' | 'manana'; day: string };
type State = { pending?: { nonce: string; calls: ToolCall[]; today: string }; flow?: Flow };
type Link = { account_id: string; chat_id: number; state: State };
type Row = Record<string, unknown>;

const linkOf = async (chat: number): Promise<Link | null> => {
  const { data } = await admin.from('telegram_links').select('account_id, chat_id, state').eq('chat_id', chat).maybeSingle();
  return data ? { ...(data as Link), state: ((data as Link).state ?? {}) as State } : null;
};
const setState = (link: Link, state: State) => admin.from('telegram_links').update({ state, updated_at: new Date().toISOString() }).eq('account_id', link.account_id);

async function personalSpace(account: string): Promise<string | null> {
  const { data: members } = await admin.from('space_members').select('space_id').eq('account_id', account).eq('status', 'active');
  const ids = (members ?? []).map((m: Row) => String(m.space_id));
  if (!ids.length) return null;
  const { data } = await admin.from('spaces').select('id').in('id', ids).eq('type', 'personal').limit(1);
  return data?.[0] ? String((data[0] as Row).id) : null;
}

const live = (table: string, space: string) => admin.from(table).select('*').eq('space_id', space).is('deleted_at', null);

type Ctx = {
  link: Link;
  chat: number;
  space: string;
  today: string;
  refs: Refs;
  lessons: Lesson[];
  accounts: Row[];
  data: IntentData;
  events: CalendarEvent[];
  tasks: Task[];
  habits: { id: string; good: boolean; target: number; count: number }[];
};

async function load(link: Link): Promise<Ctx | null> {
  const space = await personalSpace(link.account_id);
  if (!space) return null;
  const today = chileToday();
  const since = addDays(today, -62);
  const [cats, accounts, habits, logs, lessons, movements, events, tasks, onboarding] = await Promise.all([
    admin.from('fin_categories').select('*').or(`space_id.eq.${space},space_id.is.null`).is('deleted_at', null),
    live('fin_accounts', space),
    live('habits', space).eq('active', true),
    live('habit_logs', space).eq('day', today),
    live('assistant_lessons', space).eq('active', true),
    live('fin_movements', space).gte('occurred_on', since),
    live('calendar_events', space),
    live('tasks', space),
    admin.from('onboarding_answers').select('answers').eq('account_id', link.account_id).maybeSingle(),
  ]);
  const catRows = (cats.data ?? []) as Row[];
  const accountRows = ((accounts.data ?? []) as Row[]).filter((a) => !a.archived);
  const habitRows = (habits.data ?? []) as Row[];
  const count = (id: string) => ((logs.data ?? []) as Row[]).filter((l) => l.habit_id === id).reduce((s, l) => s + Number(l.count), 0);
  const refs = buildRefs({
    categories: catRows.map((c) => ({ id: String(c.id), name: String(c.name), kind: c.kind as 'expense' | 'income', for_work: c.for_work as boolean })),
    accounts: accountRows.map((a) => ({ id: String(a.id), name: String(a.name), kind: String(a.kind) })),
    habits: habitRows.map((h) => ({ id: String(h.id), name: String(h.name), direction: h.direction as 'good' | 'reduce', daily_target: Number(h.daily_target) || 1, unit: (h.unit as string) ?? null })),
  });
  const names = new Map(catRows.map((c) => [String(c.id), String(c.name)]));
  const evs = (events.data ?? []) as CalendarEvent[];
  const tks = (tasks.data ?? []) as Task[];
  const answers = parseData((onboarding.data as Row | null)?.answers);
  const pay = daysToPayday(answers.finanzas as PaydayAnswer, new Date(`${today}T12:00:00Z`));
  return {
    link,
    chat: link.chat_id,
    space,
    today,
    refs,
    lessons: ((lessons.data ?? []) as Row[]).map((l) => ({ kind: l.kind as Lesson['kind'], phrase: String(l.phrase), meaning: String(l.meaning) })),
    accounts: accountRows,
    events: evs,
    tasks: tks,
    habits: habitRows.map((h) => ({ id: String(h.id), good: h.direction !== 'reduce', target: Number(h.daily_target) || 1, count: count(String(h.id)) })),
    data: {
      movements: ((movements.data ?? []) as Row[]).map((m) => ({ date: String(m.occurred_on), kind: String(m.kind), amount: Number(m.amount), category: m.category_id ? (names.get(String(m.category_id)) ?? null) : null })),
      agenda: Array.from({ length: 8 }, (_, i) => addDays(today, i)).flatMap((d) => [
        ...eventsOn(evs, d).map((e) => ({ date: d, time: hhmm(e.starts_at), title: e.title, kind: 'evento' as const })),
        ...tks.filter((x) => x.due_on === d && x.status === 'pending').map((x) => ({ date: d, time: hhmm(x.due_at), title: x.title, kind: 'tarea' as const })),
      ]),
      habits: habitRows.map((h) => ({ name: String(h.name), count: count(String(h.id)), target: Number(h.daily_target) || 1, reduce: h.direction === 'reduce' })),
      paydayDays: pay?.days ?? null,
    },
  };
}

// ─── Guardar lo propuesto (lo mismo que hace la app al confirmar una tarjeta) ─
async function insert(ctx: Ctx, table: string, values: Row): Promise<string> {
  const { data, error } = await admin
    .from(table)
    .insert({ ...values, space_id: ctx.space, created_by: ctx.link.account_id })
    .select('id')
    .single();
  if (error) throw error;
  return String((data as Row).id);
}

async function journalDay(ctx: Ctx, day: string, patch: Row) {
  const { data } = await live('journal_days', ctx.space).eq('day', day).maybeSingle();
  if (data) {
    const { error } = await admin.from('journal_days').update(patch).eq('id', (data as Row).id);
    if (error) throw error;
    return data as Row;
  }
  await insert(ctx, 'journal_days', { day, mood: null, body: null, activities: '[]', closed: false, ...patch });
  return null;
}

async function execute(ctx: Ctx, p: Proposal) {
  switch (p.tool) {
    case 'registrar_movimiento':
      await insert(ctx, 'fin_movements', {
        kind: p.kind,
        amount: p.amount,
        occurred_on: p.date,
        account_id: p.account ? ctx.refs[p.account].id : ((ctx.accounts[0]?.id as string | undefined) ?? null),
        to_account_id: null,
        category_id: p.category ? ctx.refs[p.category].id : null,
        debt_id: null,
        interest: null,
        description: p.description,
        is_salary: false,
      });
      return;
    case 'marcar_habito':
      await insert(ctx, 'habit_logs', { habit_id: ctx.refs[p.habit].id, day: p.date, count: p.times });
      return;
    case 'crear_habito':
      await insert(ctx, 'habits', { name: p.name, direction: p.direction, template_code: null, daily_target: p.direction === 'reduce' ? 1 : p.target, unit: null, active: true, sort_order: 0 });
      return;
    case 'recordar':
      await insert(ctx, 'assistant_lessons', { kind: 'rule', phrase: p.phrase, meaning: p.meaning, active: true });
      return;
    case 'crear_evento':
      await insert(ctx, 'calendar_events', { title: p.title, event_date: p.date, starts_at: p.start, ends_at: p.start ? p.end : null, layer: p.layer, repeat: p.repeat, remind_minutes: p.remind, location: p.place, notes: null, importance: 0, repeat_until: null });
      return;
    case 'crear_tarea':
      await insert(ctx, 'tasks', { title: p.title, due_on: p.date, due_at: p.date ? p.time : null, urgent: p.urgent, notes: null, status: 'pending', done_on: null, moved_from: null });
      return;
    case 'escribir_diario': {
      // Suma a lo que ya había ese día: no borra el texto ni las actividades anteriores.
      const { data } = await live('journal_days', ctx.space).eq('day', p.date).maybeSingle();
      const before = activitiesOf((data as Row | null)?.activities as string | null);
      const body = (data as Row | null)?.body as string | null;
      await journalDay(ctx, p.date, {
        ...(p.mood ? { mood: p.mood } : {}),
        activities: JSON.stringify([...new Set([...before, ...p.activities])].slice(0, 30)),
        ...(p.text ? { body: (body ? `${body}\n\n${p.text}` : p.text).slice(0, 5000) } : {}),
      });
      return;
    }
    case 'agradecer':
      await insert(ctx, 'gratitude_entries', { day: p.date, body: p.text.slice(0, 500) });
      return;
    case 'crear_ramo': {
      const notes = [p.until ? `hasta ${p.until}` : null, p.group === null ? null : p.group ? 'trabajos en grupo' : 'individual', p.evaluations].filter(Boolean).join(' · ');
      const course = await insert(ctx, 'study_courses', { name: p.name, institution: null, teacher: p.teacher, term: notes || null, person_id: null, program_id: null, pass_grade: 4.0, archived: false });
      if (p.weekday && p.start) {
        const [h, m] = p.start.split(':').map(Number);
        const endMin = h * 60 + m + 90;
        const end = p.end ?? `${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, '0')}:${String(endMin >= 1440 ? 59 : endMin % 60).padStart(2, '0')}`;
        await insert(ctx, 'study_blocks', { course_id: course, weekday: p.weekday, starts_at: p.start, ends_at: end, room: null });
      }
      return;
    }
  }
}

const saveIdea = async (ctx: Ctx, text: string) => {
  await insert(ctx, 'module_entries', { module: 'ideas', kind: 'idea', title: text.slice(0, 200), day: ctx.today, data: '{}', done: false });
  return send(ctx.chat, `💡 Idea guardada en «Tus ideas»: ${text}\nEn la app la vuelves meta o tarea (Asistente → ✨).`);
};
const ideaText = (raw: string) => /^\s*(?:💡\s*)?idea\s*[:,.-]?\s+(.+)$/is.exec(raw)?.[1].trim() ?? null;

/** Entender un mensaje y proponer qué anotar, con «Guardar» y «Cancelar». */
async function interpret(ctx: Ctx, text: string) {
  const r = parseMessage(text, { today: ctx.today, refs: ctx.refs, lessons: ctx.lessons }, ctx.data);
  const found = r.calls.map((c) => ({ c, p: readProposal(c.name, c.input, ctx.refs, ctx.today) })).filter((x): x is { c: ToolCall; p: Proposal } => !!x.p);
  if (!found.length) {
    const reply = r.reply === HELP ? HELP.replace('Toca «Anotarlo con opciones» y te pregunto paso a paso, o escribe', 'Escribe') : (r.reply ?? HELP_BOT);
    return send(ctx.chat, reply);
  }
  const id = nonce();
  await setState(ctx.link, { ...ctx.link.state, pending: { nonce: id, calls: found.map((x) => x.c), today: ctx.today } });
  const lines = found.map((x) => `• ${proposalLine(x.p, ctx.refs)}`);
  return send(ctx.chat, [r.reply, found.length > 1 ? '¿Guardo esto?' : '¿Lo guardo?', ...lines].filter(Boolean).join('\n'), [
    [
      { text: '✅ Guardar', callback_data: `ok:${id}` },
      { text: '✖️ Cancelar', callback_data: `no:${id}` },
    ],
  ]);
}

// ─── /hoy: el día y sus prioridades, como en la app ──────────────────────────
async function today(ctx: Ctx) {
  const day = ctx.today;
  const [states, blocks, courses, entries] = await Promise.all([
    live('daily_priorities', ctx.space).eq('day', day),
    live('study_blocks', ctx.space),
    live('study_courses', ctx.space),
    live('module_entries', ctx.space).in('module', ['hoy', 'estudios', 'metas']),
  ]);
  const rows = ((entries.data ?? []) as Row[]).map((e) => ({ ...e, data: parseData(e.data) })) as unknown as (GoalRow & { module: string; kind: string })[];
  const marks = rows.filter((e) => e.module === 'hoy' && e.day === day);
  const programs = rows.filter((e) => e.kind === 'programa').map((e) => ({ id: e.id, day: e.day, until: (e as unknown as Row).until as string | null }));
  const classes = classesOn(day, (blocks.data ?? []) as Block[], ((courses.data ?? []) as Row[]).map((c) => ({ id: String(c.id), name: String(c.name), teacher: (c.teacher as string) ?? null, archived: c.archived as boolean, program_id: (c.program_id as string) ?? null })), programs).map(({ block, course }) => ({
    id: block.id,
    title: course.name,
    time: hhmm(block.starts_at),
    done: marks.some((m) => m.kind === 'hecho' && m.title === `clase:${block.id}`),
    hidden: marks.some((m) => m.kind === 'oculto' && m.title === `clase:${block.id}`),
  }));
  const metas = rows.filter((e) => e.module === 'metas');
  const good = ctx.habits.filter((h) => h.good);
  const items = dailyPriorities({
    day,
    events: ctx.events,
    tasks: ctx.tasks,
    states: (states.data ?? []) as PriorityState[],
    habits: { done: good.filter((h) => h.count >= h.target).length, total: good.length },
    assessments: [],
    birthdays: [],
    classes,
    goals: goalPriorities(day, metas.filter((e) => e.kind === 'meta'), metas.filter((e) => e.kind === 'paso'), metas.filter((e) => e.kind === 'hito')),
  });
  const lines = items.map((i) => `${i.done ? '✅' : '☐'} ${i.time ? `${i.time} ` : ''}${i.title}${i.sub && i.origin !== 'event' ? ` · ${i.sub}` : ''}`);
  return send(ctx.chat, [`📋 Hoy, ${longDay(day)}`, '', ...(lines.length ? lines : ['Nada pendiente por hoy. 🙌']), '', 'Para cerrar el día: /cerrar'].join('\n'));
}

// ─── /cerrar: el cierre del día con botones ──────────────────────────────────
const scale = (prefix: string): Button[][] => [[1, 2, 3, 4, 5].map((n) => ({ text: String(n), callback_data: `${prefix}:${n}` }))];
const skip: Button[][] = [[{ text: 'Saltar', callback_data: 'cs' }]];

async function ask(ctx: Ctx, flow: Flow) {
  await setState(ctx.link, { ...ctx.link.state, flow });
  ctx.link.state = { ...ctx.link.state, flow };
  switch (flow.step) {
    case 'animo':
      return send(ctx.chat, '🌙 Cerremos el día. ¿Cómo estuvo?', [MOODS.map((m) => ({ text: m.label, callback_data: `cm:${m.value}` }))]);
    case 'cuerpo':
    case 'mente':
    case 'alma':
      return send(ctx.chat, `${PARTS.find((p) => p.key === flow.step)!.label} (1 muy bajo · 5 muy bien)`, scale(`cp:${flow.step}`));
    case 'bueno':
      return send(ctx.chat, 'Algo bueno de hoy (escríbelo; va a Gratitud):', skip);
    case 'manana':
      return send(ctx.chat, '¿Qué es lo primero que harás mañana? (queda como tarea):', skip);
  }
}

async function nextStep(ctx: Ctx, flow: Flow) {
  const order: Flow['step'][] = ['animo', 'cuerpo', 'mente', 'alma', 'bueno', 'manana'];
  const i = order.indexOf(flow.step);
  if (i < order.length - 1) return ask(ctx, { ...flow, step: order[i + 1] });
  await journalDay(ctx, flow.day, { closed: true });
  await setState(ctx.link, { ...ctx.link.state, flow: undefined });
  return send(ctx.chat, '✅ Día cerrado. Lo que contaste quedó en tu Diario y en Cuerpo, mente y alma. Descansa. 🌙');
}

async function flowText(ctx: Ctx, flow: Flow, text: string) {
  if (flow.step === 'bueno') {
    await insert(ctx, 'gratitude_entries', { day: flow.day, body: text.slice(0, 500) });
    return nextStep(ctx, flow);
  }
  if (flow.step === 'manana') {
    await insert(ctx, 'tasks', { title: text.slice(0, 120), due_on: addDays(flow.day, 1), due_at: null, urgent: false, notes: 'Desde el cierre del día (Telegram)', status: 'pending', done_on: null, moved_from: null });
    return nextStep(ctx, flow);
  }
  return send(ctx.chat, 'Toca una de las opciones de arriba, o /cerrar para empezar de nuevo.');
}

async function check(ctx: Ctx, day: string, part: string, n: number) {
  const { data } = await live('module_entries', ctx.space).eq('module', 'cuerpo_mente_alma').eq('kind', 'chequeo').eq('day', day).maybeSingle();
  const merged = JSON.stringify({ ...parseData((data as Row | null)?.data), [part]: n });
  if (data) await admin.from('module_entries').update({ data: merged }).eq('id', (data as Row).id);
  else await insert(ctx, 'module_entries', { module: 'cuerpo_mente_alma', kind: 'chequeo', day, data: merged, done: false });
}

// ─── Conectar el chat ────────────────────────────────────────────────────────
async function connectChat(chat: number, code: string | null, username: string | null) {
  if (!code) return send(chat, (await linkOf(chat)) ? HELP_BOT : NOT_LINKED);
  const { data } = await admin.from('telegram_link_codes').select('account_id').eq('code', code).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!data) return send(chat, 'Ese código venció o no existe. Pide uno nuevo en la app: Ajustes → Conectar Telegram.');
  const account = String((data as Row).account_id);
  await admin.from('telegram_links').delete().eq('chat_id', chat);
  const { error } = await admin.from('telegram_links').upsert({ account_id: account, chat_id: chat, username, state: {}, linked_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (error) return send(chat, 'No pude conectar este chat. Intenta otra vez con un código nuevo.');
  await admin.from('telegram_link_codes').delete().eq('account_id', account);
  return send(chat, `✅ Listo: este chat quedó conectado con tu Severa.\n\n${HELP_BOT}`);
}

// ─── Mensajes y botones ──────────────────────────────────────────────────────
async function onMessage(m: Message) {
  const chat = m.chat.id;
  const text = (m.text ?? '').trim();
  if (!text) return;
  if (m.chat.type !== 'private') return send(chat, 'Severa solo responde en chats privados.');
  const start = /^\/start(?:\s+([A-Fa-f0-9]{8}))?/.exec(text);
  if (start) return connectChat(chat, start[1]?.toUpperCase() ?? null, m.from?.username ?? null);
  const link = await linkOf(chat);
  if (!link) return send(chat, NOT_LINKED);
  const ctx = await load(link);
  if (!ctx) return send(chat, 'No encontré tu espacio personal. Abre la app una vez y vuelve a intentar.');

  const [command, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ').trim();
  switch (command.toLowerCase().replace(/@.*$/, '')) {
    case '/hoy':
      return today(ctx);
    case '/cerrar':
      return ask(ctx, { kind: 'cierre', step: 'animo', day: ctx.today });
    case '/idea':
      return arg ? saveIdea(ctx, arg) : send(chat, 'Escribe la idea después del comando: /idea vender el auto');
    case '/tarea':
      return arg ? interpret(ctx, `tarea ${arg}`) : send(chat, 'Escribe la tarea: /tarea pagar la luz el viernes');
    case '/gasto':
      return arg ? interpret(ctx, `gasté ${arg}`) : send(chat, 'Escribe el gasto: /gasto 5 lucas almuerzo');
    case '/ayuda':
    case '/help':
      return send(chat, HELP_BOT);
    case '/desconectar':
      await admin.from('telegram_links').delete().eq('chat_id', chat);
      return send(chat, 'Listo, desconecté este chat de tu Severa. Para volver: Ajustes → Conectar Telegram.');
  }
  // El cierre del día a medias espera lo que se escriba.
  const flow = link.state.flow;
  if (flow && (flow.step === 'bueno' || flow.step === 'manana') && !text.startsWith('/')) return flowText(ctx, flow, text);
  const idea = ideaText(text);
  if (idea) return saveIdea(ctx, idea);
  return interpret(ctx, text);
}

async function onButton(q: NonNullable<Update['callback_query']>) {
  const m = q.message;
  const data = q.data ?? '';
  const done = (text?: string) => tg('answerCallbackQuery', { callback_query_id: q.id, ...(text ? { text } : {}) });
  if (!m) return done();
  const link = await linkOf(m.chat.id);
  if (!link) return done('Este chat no está conectado.');
  const ctx = await load(link);
  if (!ctx) return done('No encontré tu espacio personal.');

  const [kind, a, b] = data.split(':');
  if (kind === 'ok' || kind === 'no') {
    const pending = link.state.pending;
    if (!pending || pending.nonce !== a) {
      await edit(m, `${m.text ?? ''}\n\n(Ya no está pendiente.)`);
      return done();
    }
    await setState(link, { ...link.state, pending: undefined });
    if (kind === 'no') {
      await edit(m, `${m.text ?? ''}\n\n✖️ Cancelado.`);
      return done('Cancelado');
    }
    const saved: string[] = [];
    try {
      for (const c of pending.calls) {
        const p = readProposal(c.name, c.input, ctx.refs, pending.today);
        if (!p) continue;
        await execute(ctx, p);
        saved.push(`• ${proposalLine(p, ctx.refs)}`);
      }
    } catch (e) {
      console.error('guardar', e);
      await edit(m, `${m.text ?? ''}\n\n⚠️ No se pudo guardar todo. Inténtalo en la app.`);
      return done('No se pudo guardar');
    }
    await edit(m, ['✅ Guardado:', ...saved].join('\n'));
    return done('Guardado');
  }

  const flow = link.state.flow;
  if (!flow) {
    await edit(m, `${m.text ?? ''}\n\n(Este cierre ya terminó. Escribe /cerrar para empezar otro.)`);
    return done();
  }
  if (kind === 'cm') {
    const mood = Number(a);
    await journalDay(ctx, flow.day, { mood });
    await edit(m, `${m.text ?? ''} → ${MOODS.find((x) => x.value === mood)?.label ?? ''}`);
    await done();
    return nextStep(ctx, { ...flow, step: 'animo' });
  }
  if (kind === 'cp' && (a === 'cuerpo' || a === 'mente' || a === 'alma')) {
    await check(ctx, flow.day, a, Number(b));
    await edit(m, `${m.text ?? ''} → ${b}`);
    await done();
    return nextStep(ctx, { ...flow, step: a });
  }
  if (kind === 'cs') {
    await edit(m, `${m.text ?? ''} → (saltado)`);
    await done();
    return nextStep(ctx, flow);
  }
  return done();
}

// ─── Desde la app: registrar el webhook y dar un código para conectar ───────
async function connectFromApp(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!auth.user) return json({ error: 'Inicia sesión en Severa para conectar Telegram.' }, 401);
  if (allowed.length && !allowed.includes(auth.user.id)) return json({ error: 'El bot no está habilitado para esta cuenta.' }, 403);
  if (!TOKEN) return json({ error: 'Falta el token del bot: guárdalo en Supabase → Edge Functions → Secrets como TELEGRAM_BOT_TOKEN.' }, 503);
  const hook = await tg('setWebhook', { url: `${BASE}/functions/v1/telegram`, secret_token: await webhookSecret(), allowed_updates: ['message', 'callback_query'] });
  if (!hook.ok) return json({ error: `Telegram no aceptó el bot: ${hook.description ?? 'revisa el token'}.` }, 502);
  await tg('setMyCommands', { commands: COMMANDS });
  const me = await tg('getMe', {});
  const user = createClient(BASE, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  const { data: code, error } = await user.rpc('telegram_link_code');
  if (error || !code) return json({ error: 'No se pudo crear el código para conectar.' }, 500);
  return json({ bot: (me.result?.username as string | undefined) ?? null, code });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret === null) return connectFromApp(req);
  if (!TOKEN || secret !== (await webhookSecret())) return new Response('no', { status: 401 });
  try {
    const update = (await req.json()) as Update;
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (e) {
    console.error('telegram', e);
  }
  // Siempre 200: si no, Telegram reintenta el mismo mensaje.
  return new Response('ok');
});
