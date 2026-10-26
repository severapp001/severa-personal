-- Biblia Reina-Valera 1909 (frente P4, 25-10-2026): dominio público, de eBible.org
-- (spaRV1909_vpl, «Public Domain»). La primera versión traía la RVR 1960, que tiene derechos.
-- El texto es un catálogo de solo lectura que se consulta en línea (31.102 versículos: no baja
-- entero al teléfono); el avance, los favoritos y las reflexiones son del usuario y se sincronizan.
-- El texto se carga en la migración siguiente (20261025190100_bible_text.sql).

create extension if not exists unaccent with schema extensions;

-- Búsqueda sin tildes: «jehova» encuentra «Jehová». unaccent no es inmutable; este envoltorio sí,
-- para poder usarlo en una columna calculada.
create or replace function private.unaccent_es(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;
revoke execute on function private.unaccent_es(text) from public, anon;
grant execute on function private.unaccent_es(text) to authenticated;

create table public.bible_books (
  code text primary key,
  ord smallint not null unique,
  name text not null,
  testament text not null check (testament in ('AT', 'NT')),
  chapters smallint not null check (chapters > 0)
);

create table public.bible_verses (
  book text not null references public.bible_books (code),
  chapter smallint not null,
  verse smallint not null,
  body text not null,
  search tsvector generated always as (to_tsvector('spanish'::regconfig, private.unaccent_es(body))) stored,
  primary key (book, chapter, verse)
);
create index bible_verses_search_idx on public.bible_verses using gin (search);

alter table public.bible_books enable row level security;
alter table public.bible_verses enable row level security;
revoke all on public.bible_books, public.bible_verses from anon;
grant select on public.bible_books, public.bible_verses to authenticated;
create policy "biblia: leer" on public.bible_books for select to authenticated using (true);
create policy "biblia: leer" on public.bible_verses for select to authenticated using (true);

/** Busca palabras en toda la Biblia (sin importar tildes), en el orden de los libros. */
create or replace function public.search_bible(q text, max_rows integer default 60)
returns table (book text, name text, chapter smallint, verse smallint, body text)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.book, b.name, v.chapter, v.verse, v.body
  from public.bible_verses v
  join public.bible_books b on b.code = v.book
  where v.search @@ websearch_to_tsquery('spanish'::regconfig, private.unaccent_es(q))
  order by b.ord, v.chapter, v.verse
  limit least(greatest(max_rows, 1), 200)
$$;
revoke execute on function public.search_bible(text, integer) from public, anon;
grant execute on function public.search_bible(text, integer) to authenticated;

-- ─── Lo del usuario: capítulos leídos, favoritos y reflexiones ──────────────
create table public.bible_reads (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  book text not null references public.bible_books (code),
  chapter smallint not null,
  read_on date not null default current_date,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index bible_reads_space_idx on public.bible_reads (space_id, book, chapter);

create table public.bible_marks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  book text not null references public.bible_books (code),
  chapter smallint not null,
  verse smallint not null,
  kind text not null check (kind in ('favorite', 'note')),
  body text check (length(body) <= 2000),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index bible_marks_space_idx on public.bible_marks (space_id, book, chapter);

do $$
declare
  t text;
begin
  foreach t in array array['bible_reads', 'bible_marks'] loop
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

grant select on public.bible_reads, public.bible_marks, public.bible_books to powersync_role;
alter publication powersync add table public.bible_reads, public.bible_marks, public.bible_books;

-- Los 66 libros (nombres de la RV 1909; códigos del archivo de eBible.org).
insert into public.bible_books (code, ord, name, testament, chapters) values
  ('GEN', 1, 'Génesis', 'AT', 50), ('EXO', 2, 'Éxodo', 'AT', 40), ('LEV', 3, 'Levítico', 'AT', 27),
  ('NUM', 4, 'Números', 'AT', 36), ('DEU', 5, 'Deuteronomio', 'AT', 34), ('JOS', 6, 'Josué', 'AT', 24),
  ('JDG', 7, 'Jueces', 'AT', 21), ('RUT', 8, 'Rut', 'AT', 4), ('1SA', 9, '1 Samuel', 'AT', 31),
  ('2SA', 10, '2 Samuel', 'AT', 24), ('1KI', 11, '1 Reyes', 'AT', 22), ('2KI', 12, '2 Reyes', 'AT', 25),
  ('1CH', 13, '1 Crónicas', 'AT', 29), ('2CH', 14, '2 Crónicas', 'AT', 36), ('EZR', 15, 'Esdras', 'AT', 10),
  ('NEH', 16, 'Nehemías', 'AT', 13), ('EST', 17, 'Ester', 'AT', 10), ('JOB', 18, 'Job', 'AT', 42),
  ('PSA', 19, 'Salmos', 'AT', 150), ('PRO', 20, 'Proverbios', 'AT', 31), ('ECC', 21, 'Eclesiastés', 'AT', 12),
  ('SOL', 22, 'Cantares', 'AT', 8), ('ISA', 23, 'Isaías', 'AT', 66), ('JER', 24, 'Jeremías', 'AT', 52),
  ('LAM', 25, 'Lamentaciones', 'AT', 5), ('EZE', 26, 'Ezequiel', 'AT', 48), ('DAN', 27, 'Daniel', 'AT', 12),
  ('HOS', 28, 'Oseas', 'AT', 14), ('JOE', 29, 'Joel', 'AT', 3), ('AMO', 30, 'Amós', 'AT', 9),
  ('OBA', 31, 'Abdías', 'AT', 1), ('JON', 32, 'Jonás', 'AT', 4), ('MIC', 33, 'Miqueas', 'AT', 7),
  ('NAH', 34, 'Nahúm', 'AT', 3), ('HAB', 35, 'Habacuc', 'AT', 3), ('ZEP', 36, 'Sofonías', 'AT', 3),
  ('HAG', 37, 'Hageo', 'AT', 2), ('ZEC', 38, 'Zacarías', 'AT', 14), ('MAL', 39, 'Malaquías', 'AT', 4),
  ('MAT', 40, 'Mateo', 'NT', 28), ('MAR', 41, 'Marcos', 'NT', 16), ('LUK', 42, 'Lucas', 'NT', 24),
  ('JOH', 43, 'Juan', 'NT', 21), ('ACT', 44, 'Hechos', 'NT', 28), ('ROM', 45, 'Romanos', 'NT', 16),
  ('1CO', 46, '1 Corintios', 'NT', 16), ('2CO', 47, '2 Corintios', 'NT', 13), ('GAL', 48, 'Gálatas', 'NT', 6),
  ('EPH', 49, 'Efesios', 'NT', 6), ('PHI', 50, 'Filipenses', 'NT', 4), ('COL', 51, 'Colosenses', 'NT', 4),
  ('1TH', 52, '1 Tesalonicenses', 'NT', 5), ('2TH', 53, '2 Tesalonicenses', 'NT', 3), ('1TI', 54, '1 Timoteo', 'NT', 6),
  ('2TI', 55, '2 Timoteo', 'NT', 4), ('TIT', 56, 'Tito', 'NT', 3), ('PHM', 57, 'Filemón', 'NT', 1),
  ('HEB', 58, 'Hebreos', 'NT', 13), ('JAM', 59, 'Santiago', 'NT', 5), ('1PE', 60, '1 Pedro', 'NT', 5),
  ('2PE', 61, '2 Pedro', 'NT', 3), ('1JO', 62, '1 Juan', 'NT', 5), ('2JO', 63, '2 Juan', 'NT', 1),
  ('3JO', 64, '3 Juan', 'NT', 1), ('JUD', 65, 'Judas', 'NT', 1), ('REV', 66, 'Apocalipsis', 'NT', 22);
