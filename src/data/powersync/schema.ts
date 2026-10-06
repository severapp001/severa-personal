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

export const AppSchema = new Schema({
  accounts,
  spaces,
  space_members,
  people,
  personal_profiles,
  user_preferences,
  consents,
  devices,
});

export type LocalDatabase = (typeof AppSchema)['types'];
