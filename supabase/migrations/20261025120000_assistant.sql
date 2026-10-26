-- Asistente (chatbot con aprendizaje humano, decisión del 25-10-2026): el usuario escribe con sus
-- palabras, Claude propone acciones y la app las ejecuta solo si el usuario las confirma.
-- Aquí se guarda lo que Severa aprendió: las correcciones a sus propuestas y las reglas que el
-- usuario le enseñó («cuando digo lucas son miles»). El historial del chat vive solo en el teléfono.
-- Diseño: docs/02 Producto/Módulos/Asistente.md

create table public.assistant_lessons (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null default 'correction' check (kind in ('correction', 'rule')),
  phrase text not null check (length(trim(phrase)) between 1 and 300),
  meaning text not null check (length(trim(meaning)) between 1 and 400),
  active boolean not null default true,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index assistant_lessons_space_idx on public.assistant_lessons (space_id);

create trigger assistant_lessons_touch before update on public.assistant_lessons
  for each row execute function private.touch_row();
create trigger assistant_lessons_audit after insert or update or delete on public.assistant_lessons
  for each row execute function private.write_audit();

-- ─── Reglas de acceso (las mismas de los módulos) ───────────────────────────
alter table public.assistant_lessons enable row level security;
revoke all on public.assistant_lessons from anon;
create policy "ver si soy miembro" on public.assistant_lessons for select to authenticated
  using ((select private.is_space_member(space_id)));
create policy "crear si edito el espacio" on public.assistant_lessons for insert to authenticated
  with check ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));
create policy "editar si edito el espacio" on public.assistant_lessons for update to authenticated
  using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))
  with check ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));
create policy "borrar si edito el espacio" on public.assistant_lessons for delete to authenticated
  using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));

-- ─── PowerSync ───────────────────────────────────────────────────────────────
grant select on public.assistant_lessons to powersync_role;
alter publication powersync add table public.assistant_lessons;
