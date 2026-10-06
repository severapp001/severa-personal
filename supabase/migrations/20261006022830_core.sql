-- Entrega 0 · Núcleo (MD1): cuenta, espacios, personas, perfil, preferencias,
-- consentimientos, dispositivos, auditoría y eventos.
-- Diseño: docs/04 Arquitectura/Modelo de datos/MD1 Núcleo y espacios.md
-- Reglas: docs/04 Arquitectura/Reglas de acceso y cifrado.md
-- Nombres técnicos en inglés (docs/04 Arquitectura/Diccionario técnico.md).

-- ─── Tipos ───────────────────────────────────────────────────────────────────
create type public.account_status as enum ('active', 'disabled', 'pending_deletion');
create type public.space_type as enum ('personal', 'family', 'expense_group', 'couple', 'shared_list', 'shared_note');
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.member_status as enum ('invited', 'active', 'left', 'removed');
create type public.person_type as enum ('self', 'child', 'pet', 'other');
create type public.consent_type as enum (
  'terms', 'privacy', 'health_data', 'intimate', 'guardian_of_minor',
  'telegram_sensitive', 'ai_sensitive', 'client_contact'
);
create type public.record_origin as enum ('app', 'widget', 'telegram', 'imported', 'automatic');

-- ─── Funciones comunes ───────────────────────────────────────────────────────
-- Cada cambio sube la versión (conflictos al sincronizar) y la fecha de actualización.
create function public.touch_row() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

-- ─── Tablas ──────────────────────────────────────────────────────────────────
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  provider text not null default 'email' check (provider in ('email', 'google', 'apple')),
  status public.account_status not null default 'active',
  delete_at timestamptz,
  time_zone text not null default 'America/Santiago',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  type public.space_type not null,
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references public.accounts (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'active',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (space_id, account_id)
);
create index space_members_account_idx on public.space_members (account_id) where status = 'active';

create table public.people (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  type public.person_type not null,
  name text not null check (length(trim(name)) between 1 and 80),
  birth_date date,
  relationship text,
  species text,
  breed text,
  account_id uuid references public.accounts (id) on delete set null,
  guardian_declared_at timestamptz,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  origin public.record_origin not null default 'app',
  check (type <> 'self' or account_id is not null)
);
create unique index people_one_self_per_account on public.people (account_id) where type = 'self';
create index people_space_idx on public.people (space_id);

-- El RUT (cifrado) se agrega cuando se implemente el cifrado de campos (MD-D4).
create table public.personal_profiles (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  person_id uuid not null unique references public.people (id) on delete cascade,
  nickname text,
  gender text,
  phone text,
  commune text,
  region text,
  country text not null default 'CL',
  occupation text,
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 30 and 260),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  origin public.record_origin not null default 'app'
);
create index personal_profiles_space_idx on public.personal_profiles (space_id);

create table public.user_preferences (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  theme text not null default 'gold' check (theme in ('light', 'dark', 'pink', 'blue', 'gold', 'auto')),
  work_theme text not null default 'pair' check (work_theme in ('pair', 'same')),
  protection text not null default 'sensitive' check (protection in ('all', 'sensitive', 'none')),
  start_mode text not null default 'routine' check (start_mode in ('routine', 'personal', 'work')),
  morning_summary boolean not null default true,
  -- Los montos se muestran ocultos (•••) hasta tocar el ojo (usuario, 05-10-2026).
  hide_amounts boolean not null default true,
  notifications jsonb not null default '{}'::jsonb,
  upload_wifi_only boolean not null default false,
  telegram jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  type public.consent_type not null,
  text_version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index consents_account_idx on public.consents (account_id);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  name text,
  push_token text,
  last_sync_at timestamptz,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index devices_account_idx on public.devices (account_id);

-- Auditoría: solo se agregan filas; nadie las edita ni las borra.
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  account_id uuid,
  space_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  changes jsonb
);
create index audit_log_space_idx on public.audit_log (space_id, occurred_at desc);

-- Eventos: lo que les importa a otros (avisos, automatizaciones). Separados de la auditoría.
create table public.business_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  type text not null,
  account_id uuid,
  space_id uuid,
  record_id uuid,
  payload jsonb not null default '{}'::jsonb
);
create index business_events_space_idx on public.business_events (space_id, occurred_at desc);

-- ─── Versión y fecha en cada cambio ──────────────────────────────────────────
create trigger accounts_touch before update on public.accounts for each row execute function public.touch_row();
create trigger spaces_touch before update on public.spaces for each row execute function public.touch_row();
create trigger space_members_touch before update on public.space_members for each row execute function public.touch_row();
create trigger people_touch before update on public.people for each row execute function public.touch_row();
create trigger personal_profiles_touch before update on public.personal_profiles for each row execute function public.touch_row();
create trigger user_preferences_touch before update on public.user_preferences for each row execute function public.touch_row();
create trigger devices_touch before update on public.devices for each row execute function public.touch_row();

-- ─── Auditoría automática ────────────────────────────────────────────────────
-- Privilegio elevado porque escribe en audit_log, que no admite escrituras de los usuarios.
create function public.write_audit() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into v_changes
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key)
      and n.key not in ('updated_at', 'version');
  else
    v_changes := v_row;
  end if;

  insert into public.audit_log (account_id, space_id, table_name, record_id, action, changes)
  values (
    (select auth.uid()),
    case when tg_table_name = 'spaces' then (v_row ->> 'id')::uuid else (v_row ->> 'space_id')::uuid end,
    tg_table_name,
    case when v_row ? 'id' then (v_row ->> 'id')::uuid else (v_row ->> 'account_id')::uuid end,
    lower(tg_op),
    v_changes
  );
  return null;
end;
$$;

create trigger spaces_audit after insert or update or delete on public.spaces for each row execute function public.write_audit();
create trigger space_members_audit after insert or update or delete on public.space_members for each row execute function public.write_audit();
create trigger people_audit after insert or update or delete on public.people for each row execute function public.write_audit();
create trigger personal_profiles_audit after insert or update or delete on public.personal_profiles for each row execute function public.write_audit();
create trigger user_preferences_audit after insert or update on public.user_preferences for each row execute function public.write_audit();
create trigger consents_audit after insert or update on public.consents for each row execute function public.write_audit();

-- ─── ¿Es miembro activo? ─────────────────────────────────────────────────────
-- Privilegio elevado solo para no entrar en un ciclo con la RLS de space_members.
-- Solo responde sobre la cuenta que llama.
create function public.is_space_member(p_space_id uuid, p_roles public.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members m
    where m.space_id = p_space_id
      and m.account_id = (select auth.uid())
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

-- ─── Reglas de acceso (RLS) ──────────────────────────────────────────────────
alter table public.accounts enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.people enable row level security;
alter table public.personal_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.devices enable row level security;
alter table public.audit_log enable row level security;
alter table public.business_events enable row level security;

-- Nadie anónimo lee ni escribe el núcleo.
revoke all on public.accounts, public.spaces, public.space_members, public.people,
  public.personal_profiles, public.user_preferences, public.consents, public.devices,
  public.audit_log, public.business_events from anon;

-- La auditoría y los eventos no se escriben desde la app.
revoke insert, update, delete on public.audit_log, public.business_events from authenticated;

create policy "cuenta propia: ver" on public.accounts
  for select to authenticated using (id = (select auth.uid()));
create policy "cuenta propia: editar" on public.accounts
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "espacios: ver si soy miembro" on public.spaces
  for select to authenticated using ((select public.is_space_member(id)));
create policy "espacios: editar si soy dueño" on public.spaces
  for update to authenticated
  using ((select public.is_space_member(id, array['owner']::public.member_role[])))
  with check ((select public.is_space_member(id, array['owner']::public.member_role[])));

create policy "miembros: ver los de mis espacios" on public.space_members
  for select to authenticated using ((select public.is_space_member(space_id)));

create policy "personas: ver" on public.people
  for select to authenticated using ((select public.is_space_member(space_id)));
create policy "personas: crear" on public.people
  for insert to authenticated
  with check (
    (select public.is_space_member(space_id, array['owner', 'editor']::public.member_role[]))
    and type <> 'self'
  );
create policy "personas: editar" on public.people
  for update to authenticated
  using ((select public.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))
  with check ((select public.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));

create policy "perfil: ver" on public.personal_profiles
  for select to authenticated using ((select public.is_space_member(space_id)));
create policy "perfil: editar" on public.personal_profiles
  for update to authenticated
  using ((select public.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))
  with check ((select public.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));

create policy "preferencias propias: ver" on public.user_preferences
  for select to authenticated using (account_id = (select auth.uid()));
create policy "preferencias propias: editar" on public.user_preferences
  for update to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

create policy "consentimientos propios: ver" on public.consents
  for select to authenticated using (account_id = (select auth.uid()));
create policy "consentimientos propios: dar" on public.consents
  for insert to authenticated with check (account_id = (select auth.uid()) and revoked_at is null);
create policy "consentimientos propios: revocar" on public.consents
  for update to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

create policy "dispositivos propios" on public.devices
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

create policy "auditoría: ver la de mis espacios" on public.audit_log
  for select to authenticated
  using (account_id = (select auth.uid()) or (space_id is not null and (select public.is_space_member(space_id))));

create policy "eventos: ver los de mis espacios" on public.business_events
  for select to authenticated
  using (account_id = (select auth.uid()) or (space_id is not null and (select public.is_space_member(space_id))));

-- ─── bootstrap_account ───────────────────────────────────────────────────────
-- Al terminar de crear la cuenta: espacio personal, membresía de dueño, persona «yo»,
-- perfil, preferencias y consentimientos de términos y privacidad. Idempotente.
-- Privilegio elevado: crea la primera membresía (nadie es dueño todavía).
-- Solo actúa sobre la cuenta que llama.
create function public.bootstrap_account(
  p_name text,
  p_birth_date date,
  p_terms_version text,
  p_time_zone text default 'America/Santiago'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_space_id uuid;
  v_person_id uuid;
  v_age integer;
begin
  if v_uid is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;

  select s.id into v_space_id
  from public.spaces s
  where s.created_by = v_uid and s.type = 'personal'
  limit 1;
  if v_space_id is not null then
    return jsonb_build_object('ok', true, 'already', true, 'space_id', v_space_id);
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'ERR_DATO_INVALIDO: nombre' using errcode = 'P0001';
  end if;
  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'ERR_DATO_INVALIDO: fecha de nacimiento' using errcode = 'P0001';
  end if;
  v_age := extract(year from age(current_date, p_birth_date));
  if v_age < 14 then
    raise exception 'ERR_EDAD' using errcode = 'P0001';
  end if;
  if p_terms_version is null or length(trim(p_terms_version)) = 0 then
    raise exception 'ERR_DATO_INVALIDO: términos' using errcode = 'P0001';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  insert into public.accounts (id, email, time_zone)
  values (v_uid, coalesce(v_email, ''), coalesce(nullif(trim(p_time_zone), ''), 'America/Santiago'));

  insert into public.spaces (type, name, created_by)
  values ('personal', 'Personal', v_uid)
  returning id into v_space_id;

  insert into public.space_members (space_id, account_id, role, status, joined_at)
  values (v_space_id, v_uid, 'owner', 'active', now());

  insert into public.people (space_id, type, name, birth_date, account_id, created_by)
  values (v_space_id, 'self', trim(p_name), p_birth_date, v_uid, v_uid)
  returning id into v_person_id;

  insert into public.personal_profiles (space_id, person_id, created_by)
  values (v_space_id, v_person_id, v_uid);

  insert into public.user_preferences (account_id) values (v_uid);

  insert into public.consents (account_id, type, text_version)
  values (v_uid, 'terms', trim(p_terms_version)),
         (v_uid, 'privacy', trim(p_terms_version));

  insert into public.business_events (type, account_id, space_id, record_id)
  values ('account_created', v_uid, v_space_id, v_uid);

  return jsonb_build_object('ok', true, 'already', false, 'space_id', v_space_id, 'person_id', v_person_id);
end;
$$;

revoke execute on function public.bootstrap_account(text, date, text, text) from public, anon;
grant execute on function public.bootstrap_account(text, date, text, text) to authenticated;
revoke execute on function public.is_space_member(uuid, public.member_role[]) from public, anon;
grant execute on function public.is_space_member(uuid, public.member_role[]) to authenticated;
revoke execute on function public.write_audit() from public, anon, authenticated;
