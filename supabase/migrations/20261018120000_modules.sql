-- Módulos de la entrega 1 (pedido del usuario, 18-10-2026: «vamos con todo», con la primera
-- versión web como referencia): Finanzas, Estudios, CV y Hábitos. Familia usa la tabla people.
-- Diseño: docs/04 Arquitectura/Modelo de datos (MD3 Finanzas, MD5 Bienestar, MD6 Vida y memoria).
-- Los informes (estado de resultados, balance general y flujo de caja) se calculan en la app
-- desde los movimientos; no se guardan.
-- Todo vive en un espacio (personal o compartido) y sigue las mismas reglas que el núcleo.

-- ─── Finanzas ────────────────────────────────────────────────────────────────
create table public.fin_accounts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null default 'debit' check (kind in ('cash', 'debit', 'checking', 'savings', 'investment', 'credit_card', 'business')),
  opening_balance numeric(14, 2) not null default 0,
  opening_date date not null default current_date,
  credit_limit numeric(14, 2),
  archived boolean not null default false,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index fin_accounts_space_idx on public.fin_accounts (space_id);

-- Las categorías de fábrica no tienen espacio (catálogo); las propias, sí.
create table public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  code text unique,
  name text not null check (length(trim(name)) between 1 and 40),
  kind text not null check (kind in ('expense', 'income')),
  icon text,
  for_work boolean not null default false,
  sort_order integer not null default 100,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index fin_categories_space_idx on public.fin_categories (space_id);

create table public.fin_debts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null default 'consumer' check (kind in ('consumer', 'mortgage', 'installments', 'credit_card', 'person')),
  creditor text not null check (length(trim(creditor)) between 1 and 60),
  original_amount numeric(14, 2) not null check (original_amount > 0),
  installments_total integer not null default 1 check (installments_total between 1 and 600),
  installment_amount numeric(14, 2) not null check (installment_amount > 0),
  rate numeric(7, 4),
  start_date date not null default current_date,
  account_id uuid references public.fin_accounts (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paid')),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index fin_debts_space_idx on public.fin_debts (space_id);
create index fin_debts_account_idx on public.fin_debts (account_id);

-- La entidad central: gasto, ingreso, transferencia, pago de deuda o ajuste.
create table public.fin_movements (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'transfer', 'debt_payment', 'adjustment')),
  occurred_on date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid references public.fin_accounts (id) on delete set null,
  to_account_id uuid references public.fin_accounts (id) on delete set null,
  category_id uuid references public.fin_categories (id) on delete set null,
  is_salary boolean not null default false,
  payment_method text check (payment_method in ('cash', 'debit', 'credit', 'transfer', 'other')),
  description text check (length(description) <= 200),
  person_id uuid references public.people (id) on delete set null,
  debt_id uuid references public.fin_debts (id) on delete set null,
  interest numeric(14, 2) check (interest >= 0),
  origin_type text,
  origin_id uuid,
  detail jsonb,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  check (kind <> 'transfer' or to_account_id is not null)
);
create index fin_movements_space_date_idx on public.fin_movements (space_id, occurred_on desc);
create index fin_movements_account_idx on public.fin_movements (account_id);
create index fin_movements_to_account_idx on public.fin_movements (to_account_id);
create index fin_movements_category_idx on public.fin_movements (category_id);
create index fin_movements_person_idx on public.fin_movements (person_id);
create index fin_movements_debt_idx on public.fin_movements (debt_id);

-- Bienes para el balance general (auto, casa, inversiones fuera de una cuenta).
create table public.fin_assets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null default 'other' check (kind in ('vehicle', 'property', 'investment', 'other')),
  name text not null check (length(trim(name)) between 1 and 60),
  value numeric(14, 2) not null check (value >= 0),
  valued_on date not null default current_date,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index fin_assets_space_idx on public.fin_assets (space_id);

-- ─── Estudios ────────────────────────────────────────────────────────────────
create table public.study_courses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 80),
  institution text,
  term text,
  teacher text,
  color text,
  pass_grade numeric(3, 1) not null default 4.0,
  archived boolean not null default false,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index study_courses_space_idx on public.study_courses (space_id);
create index study_courses_person_idx on public.study_courses (person_id);

create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),
  room text,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index study_blocks_space_idx on public.study_blocks (space_id);
create index study_blocks_course_idx on public.study_blocks (course_id);

-- Pruebas y trabajos: con fecha antes, con nota después (escala chilena de 1,0 a 7,0).
create table public.study_assessments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  due_on date,
  weight numeric(5, 2) check (weight > 0 and weight <= 100),
  grade numeric(3, 1) check (grade between 1.0 and 7.0),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index study_assessments_space_idx on public.study_assessments (space_id);
create index study_assessments_course_idx on public.study_assessments (course_id);

-- ─── CV ──────────────────────────────────────────────────────────────────────
create table public.cv_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null check (kind in ('job', 'education', 'course', 'skill', 'language', 'achievement')),
  title text not null check (length(trim(title)) between 1 and 100),
  organization text,
  started_on date,
  ended_on date,
  current boolean not null default false,
  description text check (length(description) <= 1000),
  sort_order integer not null default 0,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index cv_entries_space_idx on public.cv_entries (space_id);

-- ─── Hábitos ─────────────────────────────────────────────────────────────────
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  template_code text,
  name text not null check (length(trim(name)) between 1 and 60),
  direction text not null default 'good' check (direction in ('good', 'reduce')),
  daily_target integer not null default 1 check (daily_target between 1 and 100),
  unit text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index habits_space_idx on public.habits (space_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  count integer not null default 1 check (count between 0 and 100),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index habit_logs_space_day_idx on public.habit_logs (space_id, day);
create index habit_logs_habit_idx on public.habit_logs (habit_id);

-- Familia: una nota libre por persona a cargo (alergias, colegio, veterinario).
alter table public.people add column notes text check (length(notes) <= 1000);

-- ─── Categorías de fábrica (como en la primera versión, más las del trabajo) ─
insert into public.fin_categories (code, name, kind, icon, for_work, sort_order) values
  ('food', 'Alimentación', 'expense', 'fork', false, 1),
  ('home', 'Vivienda', 'expense', 'house', false, 2),
  ('bills', 'Cuentas y servicios', 'expense', 'lightning', false, 3),
  ('transport', 'Transporte', 'expense', 'bus', false, 4),
  ('health', 'Salud', 'expense', 'heart', false, 5),
  ('education', 'Educación', 'expense', 'book', false, 6),
  ('fun', 'Entretenimiento', 'expense', 'film', false, 7),
  ('clothes', 'Ropa', 'expense', 'tshirt', false, 8),
  ('family', 'Familia y mascotas', 'expense', 'users', false, 9),
  ('debt_interest', 'Intereses y comisiones', 'expense', 'percent', false, 10),
  ('other_expense', 'Otros gastos', 'expense', 'dots', false, 50),
  ('fuel', 'Bencina', 'expense', 'gas', true, 20),
  ('work_supplies', 'Insumos del trabajo', 'expense', 'briefcase', true, 21),
  ('salary', 'Sueldo', 'income', 'wallet', false, 1),
  ('fees', 'Honorarios', 'income', 'receipt', false, 2),
  ('work_income', 'Ingresos del trabajo', 'income', 'car', true, 3),
  ('sales', 'Ventas', 'income', 'storefront', true, 4),
  ('gifts', 'Regalos y otros ingresos', 'income', 'gift', false, 10);

-- ─── Fecha de actualización, versión y auditoría ────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['fin_accounts', 'fin_categories', 'fin_debts', 'fin_movements', 'fin_assets',
                           'study_courses', 'study_blocks', 'study_assessments', 'cv_entries', 'habits', 'habit_logs'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_row()', t || '_touch', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit()', t || '_audit', t);
  end loop;
end $$;

-- ─── Reglas de acceso ───────────────────────────────────────────────────────
-- Ver: miembros activos del espacio. Crear, editar y borrar: dueños y editores.
do $$
declare
  t text;
begin
  foreach t in array array['fin_accounts', 'fin_debts', 'fin_movements', 'fin_assets',
                           'study_courses', 'study_blocks', 'study_assessments', 'cv_entries', 'habits', 'habit_logs'] loop
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

-- Categorías: las de fábrica las ve cualquiera con sesión; las propias, los miembros.
alter table public.fin_categories enable row level security;
revoke all on public.fin_categories from anon;
create policy "categorías: ver" on public.fin_categories for select to authenticated
  using (space_id is null or (select private.is_space_member(space_id)));
create policy "categorías: crear propias" on public.fin_categories for insert to authenticated
  with check (space_id is not null and (select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));
create policy "categorías: editar propias" on public.fin_categories for update to authenticated
  using (space_id is not null and (select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])))
  with check (space_id is not null and (select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));
create policy "categorías: borrar propias" on public.fin_categories for delete to authenticated
  using (space_id is not null and (select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])));

-- Borrar personas a cargo (Familia): el núcleo solo permitía crear y editar.
create policy "personas: borrar" on public.people for delete to authenticated
  using ((select private.is_space_member(space_id, array['owner', 'editor']::public.member_role[])) and type <> 'self');

-- ─── PowerSync ───────────────────────────────────────────────────────────────
grant select on public.fin_accounts, public.fin_categories, public.fin_debts, public.fin_movements, public.fin_assets,
  public.study_courses, public.study_blocks, public.study_assessments, public.cv_entries, public.habits, public.habit_logs
  to powersync_role;
alter publication powersync add table public.fin_accounts, public.fin_categories, public.fin_debts, public.fin_movements,
  public.fin_assets, public.study_courses, public.study_blocks, public.study_assessments, public.cv_entries,
  public.habits, public.habit_logs;
