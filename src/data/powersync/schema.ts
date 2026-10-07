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

export const AppSchema = new Schema({
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
