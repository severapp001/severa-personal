-- Automatizaciones (usuario, 28-10-2026: «tener acceso al correo y así obtener la información del
-- banco, que se envíe al chatbot y este la suba a Severa»; C58: Apps Script ahora, n8n si crece).
-- El script de Google Apps Script de la persona manda los correos de sus bancos a la función
-- `correo` con una clave propia. Aquí se guarda solo el hash de esa clave; la clave se muestra una
-- vez, dentro del script que arma la app. Pedir una nueva invalida la anterior.

create table public.automation_keys (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.automation_keys enable row level security;
revoke all on public.automation_keys from anon, authenticated;
grant all on public.automation_keys to service_role;

create function public.automation_key() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if (select auth.uid()) is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;
  v_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.automation_keys (account_id, key_hash)
  values ((select auth.uid()), encode(sha256(convert_to(v_key, 'UTF8')), 'hex'))
  on conflict (account_id) do update set key_hash = excluded.key_hash, created_at = now();
  return v_key;
end;
$$;
revoke all on function public.automation_key() from public, anon;
grant execute on function public.automation_key() to authenticated;
