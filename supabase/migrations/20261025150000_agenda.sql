-- Agenda (MD4): calendario, tareas y prioridades del día (pedido del usuario, 25-10-2026: el
-- calendario es «uno de los más importantes» y las prioridades «se desprenden de calendario,
-- hábitos y otros»). Referencia de funciones: la primera versión web (calendario mensual,
-- eventos con hora y tipo, marcar hecho, prioridades ligadas a eventos).
-- Las prioridades del día son una vista que arma la app: aquí solo se guarda lo que el usuario
-- cambia sobre ellas (hecha, descartada). Los avisos se programarán en el teléfono.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  event_date date not null,
  starts_at time,
  ends_at time,
  layer text not null default 'personal' check (layer in ('personal', 'trabajo', 'salud', 'estudios', 'familia', 'pagos', 'otro')),
  repeat text not null default 'none' check (repeat in ('none', 'weekly', 'monthly', 'yearly')),
  remind_minutes integer check (remind_minutes between 0 and 20160),
  location text check (length(location) <= 120),
  notes text check (length(notes) <= 1000),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  check (ends_at is null or (starts_at is not null and ends_at > starts_at))
);
create index calendar_events_space_date_idx on public.calendar_events (space_id, event_date);

-- El «tengo que…»: con fecha va a las prioridades de ese día; sin fecha, a la lista de tareas.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  notes text check (length(notes) <= 1000),
  due_on date,
  due_at time,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped', 'dismissed')),
  urgent boolean not null default false,
  done_on date,
  moved_from date,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index tasks_space_due_idx on public.tasks (space_id, due_on);

-- Lo que el usuario marcó sobre la lista del día: un evento hecho, un cumpleaños descartado…
create table public.daily_priorities (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  day date not null,
  origin_type text not null check (origin_type in ('event', 'habits', 'assessment', 'birthday')),
  origin_id text not null check (length(origin_id) between 1 and 80),
  status text not null check (status in ('done', 'dismissed')),
  sort_order integer,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index daily_priorities_space_day_idx on public.daily_priorities (space_id, day);

-- ─── Fecha de actualización, versión y auditoría ────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['calendar_events', 'tasks', 'daily_priorities'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit()', t || '_audit', t);
  end loop;
end $$;

-- ─── Reglas de acceso (las mismas de los módulos) ───────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['calendar_events', 'tasks', 'daily_priorities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy "ver si soy miembro" on public.%I for select to authenticated
      using ((select private.is_space_member(space_id)))$p$, t);
    execute format($p$create policy "crear si edito el espacio" on public.%I for insert to authenticated
      with check ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))$p$, t);
    execute format($p$create policy "editar si edito el espacio" on public.%I for update to authenticated
      using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))
      with check ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))$p$, t);
    execute format($p$create policy "borrar si edito el espacio" on public.%I for delete to authenticated
      using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))$p$, t);
  end loop;
end $$;

-- ─── PowerSync ───────────────────────────────────────────────────────────────
grant select on public.calendar_events, public.tasks, public.daily_priorities to powersync_role;
alter publication powersync add table public.calendar_events, public.tasks, public.daily_priorities;
