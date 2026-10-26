-- Diario y Gratitud (MD6, frente P3, 25-10-2026), con la primera versión como referencia: un día
-- del diario con su ánimo (los colores de la v1), actividades y texto; y lo que se agradece.
-- Una entrada de diario por día (la app actualiza la del día si ya existe).

create table public.journal_days (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  day date not null,
  mood smallint check (mood between 1 and 4),
  body text check (length(body) <= 5000),
  -- Lista de actividades como texto JSON («["ejercicio","familia"]»): así viaja igual por el teléfono.
  activities text not null default '[]' check (length(activities) <= 2000),
  closed boolean not null default false,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index journal_days_space_day_idx on public.journal_days (space_id, day);

create table public.gratitude_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  day date not null,
  body text not null check (length(trim(body)) between 1 and 500),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index gratitude_entries_space_day_idx on public.gratitude_entries (space_id, day);

do $$
declare
  t text;
begin
  foreach t in array array['journal_days', 'gratitude_entries'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit()', t || '_audit', t);
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

grant select on public.journal_days, public.gratitude_entries to powersync_role;
alter publication powersync add table public.journal_days, public.gratitude_entries;
