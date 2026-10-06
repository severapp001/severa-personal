-- Pruebas de permisos del núcleo, para correr en un proyecto en la nube (sin Docker).
-- Todo ocurre dentro de un bloque que termina con un error a propósito:
-- Postgres deshace todo y el mensaje del error trae los resultados. No queda nada guardado.
-- Se corre con la herramienta execute_sql del conector de Supabase, o con psql.
do $$
declare
  ana constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  beto constant uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  out text := '';
  fails int := 0;
  n int;
  t text;
  r jsonb;
begin
  insert into auth.users (id, email, aud, role)
  values (ana, 'ana@prueba.test', 'authenticated', 'authenticated'),
         (beto, 'beto@prueba.test', 'authenticated', 'authenticated');

  -- ── Ana ──
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  r := public.bootstrap_account('Ana', '1990-05-10', 'prueba');
  out := out || case when r->>'already' = 'false' then 'ok' else 'FALLA' end || ' · bootstrap crea la cuenta' || E'\n';
  r := public.bootstrap_account('Ana', '1990-05-10', 'prueba');
  out := out || case when r->>'already' = 'true' then 'ok' else 'FALLA' end || ' · bootstrap es idempotente' || E'\n';

  select count(*) into n from public.spaces;
  out := out || case when n = 1 then 'ok' else 'FALLA' end || ' · Ana ve 1 espacio (' || n || ')' || E'\n';
  select count(*) into n from public.consents;
  out := out || case when n = 2 then 'ok' else 'FALLA' end || ' · 2 consentimientos (' || n || ')' || E'\n';
  select count(*) into n from public.audit_log;
  out := out || case when n > 0 then 'ok' else 'FALLA' end || ' · auditoría automática (' || n || ')' || E'\n';
  select count(*) into n from public.user_preferences where hide_amounts;
  out := out || case when n = 1 then 'ok' else 'FALLA' end || ' · montos ocultos por defecto' || E'\n';

  begin
    insert into public.people (space_id, type, name, account_id) select id, 'self', 'Otra', ana from public.spaces;
    out := out || 'FALLA · se pudo crear otra persona «yo»' || E'\n';
  exception when insufficient_privilege then
    out := out || 'ok · no se crea otra persona «yo» desde la app' || E'\n';
  end;

  insert into public.people (space_id, type, name, created_by) select id, 'child', 'Sofía', ana from public.spaces;
  out := out || 'ok · Ana agrega un perfil a cargo' || E'\n';

  update public.personal_profiles set nickname = 'Anita';
  select version into n from public.personal_profiles;
  out := out || case when n = 2 then 'ok' else 'FALLA' end || ' · la versión sube con cada cambio (' || n || ')' || E'\n';

  begin
    insert into public.audit_log (table_name, action) values ('x', 'insert');
    out := out || 'FALLA · la app pudo escribir la auditoría' || E'\n';
  exception when insufficient_privilege then
    out := out || 'ok · la auditoría no se escribe desde la app' || E'\n';
  end;

  begin
    perform private.is_space_member(gen_random_uuid());
    out := out || 'ok · las reglas pueden usar private.is_space_member' || E'\n';
  exception when others then
    out := out || 'FALLA · ' || sqlerrm || E'\n';
  end;

  -- ── Beto ──
  perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
  select count(*) into n from public.spaces;
  out := out || case when n = 0 then 'ok' else 'FALLA' end || ' · Beto sin cuenta no ve espacios ajenos' || E'\n';

  begin
    perform public.bootstrap_account('Beto', (current_date - interval '12 years')::date, 'prueba');
    out := out || 'FALLA · un menor de 14 creó cuenta' || E'\n';
  exception when others then
    out := out || case when sqlerrm = 'ERR_EDAD' then 'ok' else 'FALLA' end || ' · menores de 14 no crean cuenta (' || sqlerrm || ')' || E'\n';
  end;

  r := public.bootstrap_account('Beto', '1988-01-20', 'prueba');
  select count(*) into n from public.spaces;
  out := out || case when n = 1 then 'ok' else 'FALLA' end || ' · Beto ve solo su espacio' || E'\n';
  select count(*) into n from public.people;
  out := out || case when n = 1 then 'ok' else 'FALLA' end || ' · Beto no ve a las personas de Ana (' || n || ')' || E'\n';

  update public.personal_profiles set nickname = 'hackeado' where person_id in (select id from public.people where name = 'Ana');
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  select nickname into t from public.personal_profiles;
  out := out || case when t = 'Anita' then 'ok' else 'FALLA' end || ' · Beto no edita el perfil de Ana' || E'\n';

  -- ── Sin sesión ──
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  begin
    perform 1 from public.accounts;
    out := out || 'FALLA · sin sesión se lee el núcleo' || E'\n';
  exception when insufficient_privilege then
    out := out || 'ok · sin sesión no se lee nada' || E'\n';
  end;
  begin
    perform public.bootstrap_account('X', '1990-01-01', 'prueba');
    out := out || 'FALLA · sin sesión se llama a bootstrap' || E'\n';
  exception when insufficient_privilege then
    out := out || 'ok · sin sesión no se llama a bootstrap' || E'\n';
  end;

  fails := (length(out) - length(replace(out, 'FALLA', ''))) / 5;
  raise exception E'RESULTADOS (se deshace todo) · fallas: %\n%', fails, out;
end;
$$;
