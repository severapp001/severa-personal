-- Entrega 1 · Conocerte y el cerebro (MD2): respuestas de Conocerte, estado de cada neurona
-- por persona y sugerencias. Flujo: docs/02 Producto/Flujos/F30 Conocerte y descubrimiento.md

-- Índice que faltaba en el núcleo: bootstrap_account y la RLS buscan espacios por creador.
create index if not exists spaces_created_by_idx on public.spaces (created_by);

-- ─── Conocerte (una fila por cuenta) ─────────────────────────────────────────
create table public.onboarding_answers (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  goals text[] not null default '{}',       -- necesidades: finanzas, dia, salud, fe, recordar, trabajo
  interests text[] not null default '{}',   -- qué hace cuando no trabaja (ordenan las sugerencias)
  trades text[] not null default '{}',      -- códigos de oficio, más 'study' o 'no_work'
  path text check (path in ('quick', 'calm')),
  plans text[] not null default '{}',
  answers jsonb not null default '{}'::jsonb, -- respuestas del plan rápido por neurona
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

-- ─── Neurona del usuario ─────────────────────────────────────────────────────
-- undiscovered = por descubrir · suggested = por completar · discovered = encendida · off = apagada
create table public.user_neurons (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  neuron_code text not null references public.neurons (code),
  state text not null default 'undiscovered' check (state in ('undiscovered', 'suggested', 'discovered', 'off')),
  how text check (how in ('onboarding', 'quick_plan', 'suggestion', 'own', 'on_record')),
  discovered_at timestamptz,
  off_at timestamptz,
  face_id boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (account_id, neuron_code)
);
create index user_neurons_neuron_idx on public.user_neurons (neuron_code);

-- ─── Sugerencias ─────────────────────────────────────────────────────────────
create table public.neuron_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  neuron_code text not null references public.neurons (code),
  reason text,
  shown_at timestamptz not null default now(),
  answer text check (answer in ('accepted', 'later', 'not_interested')),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index neuron_suggestions_account_idx on public.neuron_suggestions (account_id, shown_at desc);
create index neuron_suggestions_neuron_idx on public.neuron_suggestions (neuron_code);

create trigger onboarding_answers_touch before update on public.onboarding_answers
  for each row execute function private.touch_row();
create trigger user_neurons_touch before update on public.user_neurons
  for each row execute function private.touch_row();
create trigger user_neurons_audit after insert or update on public.user_neurons
  for each row execute function private.write_audit();

-- ─── Edad: el servidor no deja encender lo que no corresponde ────────────────
-- Salud e Íntimo y ciclo piden 16 años (neurons.min_age). Se mira la persona «yo» de la cuenta.
create function private.enforce_neuron_age() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_min smallint;
  v_age integer;
begin
  if new.state not in ('suggested', 'discovered') then
    return new;
  end if;
  select n.min_age into v_min from public.neurons n where n.code = new.neuron_code;
  select extract(year from age(current_date, p.birth_date))::integer into v_age
  from public.people p
  where p.account_id = new.account_id and p.type = 'self';
  if v_min is not null and v_age is not null and v_age < v_min then
    raise exception 'ERR_EDAD' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_neurons_age before insert or update on public.user_neurons
  for each row execute function private.enforce_neuron_age();

-- ─── Eventos desde las funciones (business_events no se escribe desde la app) ───
create function private.emit_event(p_type text, p_record_id uuid default null, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;
  if p_type not in ('onboarding_completed', 'neuron_discovered') then
    raise exception 'ERR_DATO_INVALIDO: evento' using errcode = 'P0001';
  end if;
  insert into public.business_events (type, account_id, record_id, payload)
  values (p_type, (select auth.uid()), p_record_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;
revoke execute on function private.emit_event(text, uuid, jsonb) from public, anon;
grant execute on function private.emit_event(text, uuid, jsonb) to authenticated;

-- ─── Reglas de acceso ────────────────────────────────────────────────────────
alter table public.onboarding_answers enable row level security;
alter table public.user_neurons enable row level security;
alter table public.neuron_suggestions enable row level security;
revoke all on public.onboarding_answers, public.user_neurons, public.neuron_suggestions from anon;

create policy "conocerte propio: ver" on public.onboarding_answers
  for select to authenticated using (account_id = (select auth.uid()));
create policy "conocerte propio: crear" on public.onboarding_answers
  for insert to authenticated with check (account_id = (select auth.uid()));
create policy "conocerte propio: editar" on public.onboarding_answers
  for update to authenticated using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

create policy "neuronas propias: ver" on public.user_neurons
  for select to authenticated using (account_id = (select auth.uid()));
create policy "neuronas propias: crear" on public.user_neurons
  for insert to authenticated with check (account_id = (select auth.uid()));
create policy "neuronas propias: editar" on public.user_neurons
  for update to authenticated using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

create policy "sugerencias propias: ver" on public.neuron_suggestions
  for select to authenticated using (account_id = (select auth.uid()));
create policy "sugerencias propias: crear" on public.neuron_suggestions
  for insert to authenticated with check (account_id = (select auth.uid()));
create policy "sugerencias propias: responder" on public.neuron_suggestions
  for update to authenticated using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

-- ─── save_onboarding ─────────────────────────────────────────────────────────
-- Guarda Conocerte completo y enciende las neuronas en una sola transacción.
-- p_neurons: [{ "code": "finanzas", "state": "discovered" | "suggested" }, …]
create function public.save_onboarding(
  p_goals text[],
  p_interests text[],
  p_trades text[],
  p_path text,
  p_plans text[],
  p_answers jsonb,
  p_neurons jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item jsonb;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;
  if p_path not in ('quick', 'calm') then
    raise exception 'ERR_DATO_INVALIDO: camino' using errcode = 'P0001';
  end if;

  insert into public.onboarding_answers (account_id, goals, interests, trades, path, plans, answers, completed_at)
  values (v_uid, coalesce(p_goals, '{}'), coalesce(p_interests, '{}'), coalesce(p_trades, '{}'), p_path,
          coalesce(p_plans, '{}'), coalesce(p_answers, '{}'::jsonb), now())
  on conflict (account_id) do update set
    goals = excluded.goals, interests = excluded.interests, trades = excluded.trades, path = excluded.path,
    plans = excluded.plans, answers = excluded.answers, completed_at = coalesce(public.onboarding_answers.completed_at, now());

  for v_item in select * from jsonb_array_elements(coalesce(p_neurons, '[]'::jsonb)) loop
    insert into public.user_neurons (account_id, neuron_code, state, how, discovered_at)
    values (
      v_uid,
      v_item ->> 'code',
      v_item ->> 'state',
      case when p_path = 'quick' then 'quick_plan' else 'onboarding' end,
      case when v_item ->> 'state' = 'discovered' then now() end
    )
    on conflict (account_id, neuron_code) do update set
      state = excluded.state,
      how = coalesce(public.user_neurons.how, excluded.how),
      discovered_at = coalesce(public.user_neurons.discovered_at, excluded.discovered_at);
    v_count := v_count + 1;
  end loop;

  perform private.emit_event('onboarding_completed', v_uid, jsonb_build_object('path', p_path, 'neurons', v_count));
  return jsonb_build_object('ok', true, 'neurons', v_count);
end;
$$;

-- ─── set_neuron_state y answer_suggestion ────────────────────────────────────
create function public.set_neuron_state(p_code text, p_state text, p_how text default 'own')
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;
  insert into public.user_neurons (account_id, neuron_code, state, how, discovered_at, off_at)
  values (v_uid, p_code, p_state, p_how,
          case when p_state = 'discovered' then now() end,
          case when p_state = 'off' then now() end)
  on conflict (account_id, neuron_code) do update set
    state = excluded.state,
    how = coalesce(public.user_neurons.how, excluded.how),
    discovered_at = coalesce(public.user_neurons.discovered_at, excluded.discovered_at),
    off_at = case when excluded.state = 'off' then now() else null end
  returning id into v_id;
  if p_state = 'discovered' then
    perform private.emit_event('neuron_discovered', v_id, jsonb_build_object('neuron', p_code, 'how', p_how));
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create function public.answer_suggestion(p_code text, p_reason text, p_answer text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'ERR_SIN_SESION' using errcode = 'P0001';
  end if;
  insert into public.neuron_suggestions (account_id, neuron_code, reason, answer, answered_at)
  values (v_uid, p_code, p_reason, p_answer, now());
  if p_answer = 'accepted' then
    perform public.set_neuron_state(p_code, 'discovered', 'suggestion');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.save_onboarding(text[], text[], text[], text, text[], jsonb, jsonb) from public, anon;
grant execute on function public.save_onboarding(text[], text[], text[], text, text[], jsonb, jsonb) to authenticated;
revoke execute on function public.set_neuron_state(text, text, text) from public, anon;
grant execute on function public.set_neuron_state(text, text, text) to authenticated;
revoke execute on function public.answer_suggestion(text, text, text) from public, anon;
grant execute on function public.answer_suggestion(text, text, text) to authenticated;
revoke execute on function private.enforce_neuron_age() from public, anon, authenticated;

-- ─── PowerSync ───────────────────────────────────────────────────────────────
grant select on public.onboarding_answers, public.user_neurons, public.neuron_suggestions to powersync_role;
alter publication powersync add table public.onboarding_answers, public.user_neurons, public.neuron_suggestions;
