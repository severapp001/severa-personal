-- Pruebas de permisos del núcleo (entrega 0). Se corren con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Dos cuentas de prueba
insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'ana@prueba.test', 'authenticated', 'authenticated'),
       ('22222222-2222-2222-2222-222222222222', 'beto@prueba.test', 'authenticated', 'authenticated');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ── Ana crea su cuenta ──
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (public.bootstrap_account('Ana', '1990-05-10', 'v0-2026-10'))->>'already',
  'false',
  'bootstrap crea la cuenta de Ana'
);
select is(
  (public.bootstrap_account('Ana', '1990-05-10', 'v0-2026-10'))->>'already',
  'true',
  'bootstrap es idempotente'
);
select is((select count(*)::int from public.spaces), 1, 'Ana ve su espacio personal');
select is((select count(*)::int from public.people where type = 'self'), 1, 'Ana tiene su persona «yo»');
select is((select count(*)::int from public.consents), 2, 'quedan los consentimientos de términos y privacidad');
select ok((select count(*) from public.audit_log) > 0, 'la auditoría se escribió sola');

select lives_ok(
  $$ insert into public.people (space_id, type, name, created_by)
     select id, 'child', 'Sofía', '11111111-1111-1111-1111-111111111111' from public.spaces $$,
  'Ana agrega un perfil a cargo en su espacio'
);
select throws_ok(
  $$ insert into public.people (space_id, type, name, account_id)
     select id, 'self', 'Otra Ana', '11111111-1111-1111-1111-111111111111' from public.spaces $$,
  '42501', null,
  'no se puede crear otra persona «yo» desde la app'
);

update public.personal_profiles set nickname = 'Anita';
select is((select version from public.personal_profiles), 2, 'cada cambio sube la versión');

select throws_ok(
  $$ insert into public.audit_log (table_name, action) values ('x', 'insert') $$,
  '42501', null,
  'la auditoría no se escribe desde la app'
);

-- ── Beto ──
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');

select is((select count(*)::int from public.spaces), 0, 'Beto sin cuenta no ve espacios ajenos');
select throws_ok(
  $$ select public.bootstrap_account('Beto', (current_date - interval '12 years')::date, 'v0-2026-10') $$,
  'P0001', 'ERR_EDAD',
  'menores de 14 años no pueden crear cuenta'
);
select is(
  (public.bootstrap_account('Beto', '1988-01-20', 'v0-2026-10'))->>'already',
  'false',
  'Beto crea su cuenta'
);
select is((select count(*)::int from public.spaces), 1, 'Beto ve solo su espacio');
select is((select count(*)::int from public.people), 1, 'Beto no ve a las personas de Ana');

update public.personal_profiles set nickname = 'hackeado'
where person_id in (select id from public.people where name = 'Ana');
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select is((select nickname from public.personal_profiles), 'Anita', 'Beto no puede editar el perfil de Ana');

-- ── Sin sesión ──
select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
select throws_ok('select * from public.accounts', '42501', null, 'sin sesión no se lee nada del núcleo');

select * from finish();
rollback;
