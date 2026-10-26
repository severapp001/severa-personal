-- Motor común de los módulos (revisión del usuario, 26-10-2026: «revisé los módulos y aún no
-- sirven»). Una sola tabla guarda los registros de los módulos que todavía no tienen tablas
-- propias: Salud, Ejercicio, Alimentación, Documentos, Gastos compartidos, Viajes, Biografía,
-- FODA, Íntimo y ciclo, Juegos, Mis trabajos y la jornada por tramos, entre otros.
-- Cada fila dice de qué módulo es (`module`) y qué es (`kind`); lo propio de cada uno va en
-- `data`, como texto JSON (así viaja igual por el teléfono, como las actividades del Diario).
-- `parent_id` arma lo que vive dentro de otra cosa: los gastos de un grupo, los recuerdos de un
-- viaje, los tramos de un trabajo. Cuando un módulo crezca, se le hace su tabla y se migra.

create table public.module_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  module text not null check (module ~ '^[a-z_]{2,40}$'),
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  parent_id uuid references public.module_entries (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  title text check (length(title) <= 200),
  body text check (length(body) <= 5000),
  day date,
  until date,
  amount numeric(14, 2),
  value numeric(12, 3),
  done boolean not null default false,
  data text not null default '{}' check (length(data) <= 8000),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  check (until is null or day is null or until >= day)
);
create index module_entries_space_module_idx on public.module_entries (space_id, module, kind);
create index module_entries_parent_idx on public.module_entries (parent_id);
create index module_entries_person_idx on public.module_entries (person_id);

create trigger module_entries_touch before update on public.module_entries for each row execute function private.touch_row();
create trigger module_entries_audit after insert or update or delete on public.module_entries for each row execute function private.write_audit();
alter table public.module_entries enable row level security;
revoke all on public.module_entries from anon;
create policy "ver si soy miembro" on public.module_entries for select to authenticated
  using ((select private.is_space_member(space_id)));
create policy "crear si edito el espacio" on public.module_entries for insert to authenticated
  with check ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));
create policy "editar si edito el espacio" on public.module_entries for update to authenticated
  using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))
  with check ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));
create policy "borrar si edito el espacio" on public.module_entries for delete to authenticated
  using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));

grant select on public.module_entries to powersync_role;
alter publication powersync add table public.module_entries;

-- Calendario: qué tan importante es un evento (0 normal · 1 prioridad del día · 2 urgente) y hasta
-- cuándo se repite («todos los jueves hasta que termine el trimestre»).
alter table public.calendar_events
  add column importance smallint not null default 0 check (importance between 0 and 2),
  add column repeat_until date,
  add constraint calendar_events_repeat_until_check check (repeat_until is null or repeat_until >= event_date);

-- Estudios: el ramo pertenece a un programa (universidad, instituto, curso, diplomado…), que vive
-- en module_entries con su régimen (semestral, trimestral…) y sus fechas.
alter table public.study_courses
  add column program_id uuid references public.module_entries (id) on delete set null;
create index study_courses_program_idx on public.study_courses (program_id);
