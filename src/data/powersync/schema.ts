import { column, Schema, Table } from '@powersync/common';

// Copia local de las tablas que baja PowerSync (powersync/sync-config.yaml).
// En SQLite: uuid, fechas y enums son texto; booleanos son 0/1; jsonb es texto JSON.
// PowerSync agrega la columna «id» sola.

const common = {
  created_at: column.text,
  updated_at: column.text,
  version: column.integer,
};

const accounts = new Table({
  email: column.text,
  provider: column.text,
  status: column.text,
  delete_at: column.text,
  time_zone: column.text,
  ...common,
});

const spaces = new Table({
  type: column.text,
  name: column.text,
  created_by: column.text,
  archived_at: column.text,
  deleted_at: column.text,
  ...common,
});

const space_members = new Table(
  {
    space_id: column.text,
    account_id: column.text,
    role: column.text,
    status: column.text,
    joined_at: column.text,
    ...common,
  },
  { indexes: { account: ['account_id'] } },
);

const people = new Table(
  {
    space_id: column.text,
    type: column.text,
    name: column.text,
    birth_date: column.text,
    relationship: column.text,
    species: column.text,
    breed: column.text,
    account_id: column.text,
    guardian_declared_at: column.text,
    notes: column.text,
    created_by: column.text,
    deleted_at: column.text,
    origin: column.text,
    ...common,
  },
  { indexes: { space: ['space_id'] } },
);

const personal_profiles = new Table({
  space_id: column.text,
  person_id: column.text,
  nickname: column.text,
  gender: column.text,
  phone: column.text,
  commune: column.text,
  region: column.text,
  country: column.text,
  occupation: column.text,
  height_cm: column.real,
  created_by: column.text,
  deleted_at: column.text,
  origin: column.text,
  ...common,
});

// En el servidor la llave es account_id; aquí id = account_id.
const user_preferences = new Table({
  account_id: column.text,
  theme: column.text,
  work_theme: column.text,
  protection: column.text,
  start_mode: column.text,
  morning_summary: column.integer,
  hide_amounts: column.integer,
  notifications: column.text,
  upload_wifi_only: column.integer,
  telegram: column.text,
  ...common,
});

const consents = new Table({
  account_id: column.text,
  type: column.text,
  text_version: column.text,
  accepted_at: column.text,
  revoked_at: column.text,
  reference_id: column.text,
  created_at: column.text,
});

const devices = new Table({
  account_id: column.text,
  platform: column.text,
  name: column.text,
  push_token: column.text,
  last_sync_at: column.text,
  app_version: column.text,
  ...common,
});

// Catálogos de Severa (solo lectura). La llave «code» llega también como id.
const neurons = new Table({
  code: column.text,
  name: column.text,
  hemisphere: column.text,
  level: column.integer,
  summary: column.text,
  minimum: column.text,
  sensitive: column.integer,
  min_age: column.integer,
  sort_order: column.integer,
});

const synapses = new Table({
  neuron_a: column.text,
  neuron_b: column.text,
  crosses: column.text,
  confirmed: column.integer,
});

// tools llega como texto JSON (lista de códigos de neuronas de Trabajo).
const trades = new Table({
  code: column.text,
  name: column.text,
  icon: column.text,
  main_action: column.text,
  tools: column.text,
  card_fields: column.text,
  beta_priority: column.integer,
  status: column.text,
  sort_order: column.integer,
});

const holidays = new Table(
  {
    date: column.text,
    name: column.text,
    kind: column.text,
    region: column.text,
  },
  { indexes: { date: ['date'] } },
);

const habit_templates = new Table({
  code: column.text,
  name: column.text,
  kind: column.text,
  unit: column.text,
  direction: column.text,
  period: column.text,
  suggested_target: column.real,
  min_age: column.integer,
  sort_order: column.integer,
});

// Conocerte y el cerebro de la persona (F30). Las listas (text[]) llegan como texto JSON.
const onboarding_answers = new Table({
  account_id: column.text,
  goals: column.text,
  interests: column.text,
  trades: column.text,
  path: column.text,
  plans: column.text,
  answers: column.text,
  completed_at: column.text,
  ...common,
});

const user_neurons = new Table(
  {
    account_id: column.text,
    neuron_code: column.text,
    state: column.text,
    how: column.text,
    discovered_at: column.text,
    off_at: column.text,
    face_id: column.integer,
    config: column.text,
    ...common,
  },
  { indexes: { account: ['account_id'] } },
);

const neuron_suggestions = new Table({
  account_id: column.text,
  neuron_code: column.text,
  reason: column.text,
  shown_at: column.text,
  answer: column.text,
  answered_at: column.text,
  created_at: column.text,
});

// ─── Módulos (18-10-2026): migración 20261018120000_modules.sql ────────────────
const owned = {
  space_id: column.text,
  created_by: column.text,
  deleted_at: column.text,
  ...common,
};

const fin_accounts = new Table(
  { name: column.text, kind: column.text, opening_balance: column.real, opening_date: column.text, credit_limit: column.real, archived: column.integer, ...owned },
  { indexes: { space: ['space_id'] } },
);
const fin_categories = new Table({
  code: column.text,
  name: column.text,
  kind: column.text,
  icon: column.text,
  for_work: column.integer,
  sort_order: column.integer,
  ...owned,
});
const fin_debts = new Table(
  {
    kind: column.text,
    creditor: column.text,
    original_amount: column.real,
    installments_total: column.integer,
    installment_amount: column.real,
    rate: column.real,
    start_date: column.text,
    account_id: column.text,
    status: column.text,
    ...owned,
  },
  { indexes: { space: ['space_id'] } },
);
const fin_movements = new Table(
  {
    kind: column.text,
    occurred_on: column.text,
    amount: column.real,
    account_id: column.text,
    to_account_id: column.text,
    category_id: column.text,
    is_salary: column.integer,
    payment_method: column.text,
    description: column.text,
    person_id: column.text,
    debt_id: column.text,
    interest: column.real,
    origin_type: column.text,
    origin_id: column.text,
    detail: column.text,
    ...owned,
  },
  { indexes: { date: ['space_id', 'occurred_on'], debt: ['debt_id'] } },
);
const fin_assets = new Table({ kind: column.text, name: column.text, value: column.real, valued_on: column.text, ...owned });

const study_courses = new Table({
  person_id: column.text,
  name: column.text,
  institution: column.text,
  term: column.text,
  teacher: column.text,
  color: column.text,
  pass_grade: column.real,
  archived: column.integer,
  program_id: column.text,
  ...owned,
});
const study_blocks = new Table(
  { course_id: column.text, weekday: column.integer, starts_at: column.text, ends_at: column.text, room: column.text, ...owned },
  { indexes: { course: ['course_id'] } },
);
const study_assessments = new Table(
  { course_id: column.text, title: column.text, due_on: column.text, weight: column.real, grade: column.real, ...owned },
  { indexes: { course: ['course_id'] } },
);
const cv_entries = new Table({
  kind: column.text,
  title: column.text,
  organization: column.text,
  started_on: column.text,
  ended_on: column.text,
  current: column.integer,
  description: column.text,
  sort_order: column.integer,
  ...owned,
});
const habits = new Table({
  template_code: column.text,
  name: column.text,
  direction: column.text,
  daily_target: column.integer,
  unit: column.text,
  active: column.integer,
  sort_order: column.integer,
  ...owned,
});
const habit_logs = new Table(
  { habit_id: column.text, day: column.text, count: column.integer, ...owned },
  { indexes: { day: ['day'], habit: ['habit_id'] } },
);

// Agenda (MD4, 25-10-2026): migración 20261025150000_agenda.sql.
const calendar_events = new Table(
  {
    title: column.text,
    event_date: column.text,
    starts_at: column.text,
    ends_at: column.text,
    layer: column.text,
    repeat: column.text,
    remind_minutes: column.integer,
    location: column.text,
    notes: column.text,
    importance: column.integer,
    repeat_until: column.text,
    ...owned,
  },
  { indexes: { date: ['space_id', 'event_date'] } },
);
const tasks = new Table(
  {
    title: column.text,
    notes: column.text,
    due_on: column.text,
    due_at: column.text,
    status: column.text,
    urgent: column.integer,
    done_on: column.text,
    moved_from: column.text,
    ...owned,
  },
  { indexes: { due: ['space_id', 'due_on'] } },
);
const daily_priorities = new Table(
  { day: column.text, origin_type: column.text, origin_id: column.text, status: column.text, sort_order: column.integer, ...owned },
  { indexes: { day: ['space_id', 'day'] } },
);

// Diario y Gratitud (MD6, 25-10-2026): migración 20261025180000_journal.sql.
const journal_days = new Table(
  { day: column.text, mood: column.integer, body: column.text, activities: column.text, closed: column.integer, ...owned },
  { indexes: { day: ['space_id', 'day'] } },
);
const gratitude_entries = new Table({ day: column.text, body: column.text, ...owned }, { indexes: { day: ['space_id', 'day'] } });

// Biblia RV 1909 (25-10-2026): migración 20261025190000_bible.sql. Los libros son catálogo; el texto
// se pide en línea y los capítulos ya leídos quedan guardados en el teléfono (bible_cache).
const bible_books = new Table({ code: column.text, ord: column.integer, name: column.text, testament: column.text, chapters: column.integer });
const bible_reads = new Table({ book: column.text, chapter: column.integer, read_on: column.text, ...owned }, { indexes: { chapter: ['book', 'chapter'] } });
const bible_marks = new Table(
  { book: column.text, chapter: column.integer, verse: column.integer, kind: column.text, body: column.text, ...owned },
  { indexes: { chapter: ['book', 'chapter'] } },
);
const bible_cache = new Table({ book: column.text, chapter: column.integer, verses: column.text }, { localOnly: true, indexes: { chapter: ['book', 'chapter'] } });

// Asistente (25-10-2026): lecciones que se sincronizan; las conversaciones quedan solo en el teléfono.
const assistant_lessons = new Table({ kind: column.text, phrase: column.text, meaning: column.text, active: column.integer, ...owned });
const assistant_conversations = new Table(
  { context: column.text, refs: column.text, started_at: column.text },
  { localOnly: true },
);
const assistant_messages = new Table(
  { conversation_id: column.text, seq: column.integer, role: column.text, content: column.text, created_at: column.text },
  { localOnly: true, indexes: { conversation: ['conversation_id', 'seq'] } },
);

// Solo en este teléfono (no se sincroniza): lo que se marca en Hoy mientras llegan las tablas
// definitivas de hábitos, prioridades y jornada (MD5, MD7). id = «día:ítem».
// Motor común de los módulos (26-10-2026): Salud, Ejercicio, Alimentación, Gastos compartidos,
// Viajes, Mis trabajos y los demás que aún no tienen tabla propia. `data` es texto JSON.
const module_entries = new Table(
  {
    module: column.text,
    kind: column.text,
    parent_id: column.text,
    person_id: column.text,
    title: column.text,
    body: column.text,
    day: column.text,
    until: column.text,
    amount: column.real,
    value: column.real,
    done: column.integer,
    data: column.text,
    ...owned,
  },
  { indexes: { module: ['space_id', 'module', 'kind'], parent: ['parent_id'] } },
);

const day_marks = new Table(
  {
    day: column.text,
    item: column.text,
    value: column.integer,
    text: column.text,
    updated_at: column.text,
  },
  { localOnly: true, indexes: { day: ['day'] } },
);

export const AppSchema = new Schema({
  day_marks,
  module_entries,
  calendar_events,
  tasks,
  daily_priorities,
  journal_days,
  gratitude_entries,
  bible_books,
  bible_reads,
  bible_marks,
  bible_cache,
  assistant_lessons,
  assistant_conversations,
  assistant_messages,
  fin_accounts,
  fin_categories,
  fin_debts,
  fin_movements,
  fin_assets,
  study_courses,
  study_blocks,
  study_assessments,
  cv_entries,
  habits,
  habit_logs,
  accounts,
  spaces,
  space_members,
  people,
  personal_profiles,
  user_preferences,
  consents,
  devices,
  neurons,
  synapses,
  trades,
  holidays,
  habit_templates,
  onboarding_answers,
  user_neurons,
  neuron_suggestions,
});

export type LocalDatabase = (typeof AppSchema)['types'];
