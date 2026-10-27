-- Bot de Telegram de Severa (usuario, 27-10-2026: «me parece buena opción un bot propio de Severa,
-- con BotFather»). Ver docs/02 Producto/Bot de Telegram de Severa.md.
-- telegram_links: qué chat de Telegram es de qué cuenta, y la conversación en curso con el bot
-- (una propuesta por confirmar o el cierre del día a medias). Lo escribe solo la función
-- `telegram` (service role); la persona ve su conexión y puede desconectarla.
-- telegram_link_codes: códigos de un solo uso para conectar el chat (15 minutos).

create table public.telegram_links (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  chat_id bigint not null unique,
  username text check (length(username) <= 64),
  state jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
revoke all on public.telegram_links from anon, authenticated;
grant select (account_id, username, linked_at), delete on public.telegram_links to authenticated;
grant all on public.telegram_links to service_role;
create policy "telegram: ver mi conexión" on public.telegram_links for select to authenticated
  using (account_id = (select auth.uid()));
create policy "telegram: desconectar" on public.telegram_links for delete to authenticated
  using (account_id = (select auth.uid()));

create table public.telegram_link_codes (
  code text primary key check (code ~ '^[A-F0-9]{8}$'),
  account_id uuid not null references public.accounts (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);
alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_link_codes from anon, authenticated;
grant all on public.telegram_link_codes to service_role;

-- Un código nuevo para la cuenta que lo pide (borra los suyos anteriores y los vencidos).
create function public.telegram_link_code() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;
  delete from public.telegram_link_codes where account_id = (select auth.uid()) or expires_at < now();
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.telegram_link_codes (code, account_id) values (v_code, (select auth.uid()));
  return v_code;
end;
$$;
revoke all on function public.telegram_link_code() from public, anon;
grant execute on function public.telegram_link_code() to authenticated;
