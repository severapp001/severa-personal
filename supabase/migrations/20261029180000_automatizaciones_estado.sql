-- El estado del script del banco (29-10-2026, usuario: «ya lo hice… ¿cómo optimizo los correos?»).
-- La función `correo` anota cuándo el script se conectó por última vez y cuándo mandó correos, para
-- que Ajustes muestre «Funcionando · revisó tus correos hace 6 min».

alter table public.automation_keys
  add column last_seen_at timestamptz,
  add column last_mail_at timestamptz;

create function public.automation_status() returns table (created_at timestamptz, last_seen_at timestamptz, last_mail_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select k.created_at, k.last_seen_at, k.last_mail_at from public.automation_keys k where k.account_id = (select auth.uid());
$$;
revoke all on function public.automation_status() from public, anon;
grant execute on function public.automation_status() to authenticated;
