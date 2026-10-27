-- Cuerpo, mente y alma (usuario, 26-10-2026, inspirado en «Deja de ser tú» de Joe Dispenza): una
-- neurona propia en el centro del cerebro, entre los dos hemisferios, que crece a medida que Severa
-- conoce a la persona. Respuestas del cuestionario: el alma es fe y espiritualidad en sentido amplio;
-- se ve en el cerebro, en Perfil, en Resumen y en Hoy; después vienen las metas y desafíos.

insert into public.neurons (code, name, hemisphere, level, summary, minimum, sensitive, min_age, sort_order) values
  ('cuerpo_mente_alma', 'Cuerpo, mente y alma', 'bridge', 0,
   'Tus tres partes vistas con lo que registras: el cuerpo (ejercicio, comida, sueño, remedios), la mente (diario, ánimo, estudio, descanso) y el alma (fe, oración o meditación, gratitud, relaciones y propósito). Desde aquí nacen tus metas y desafíos.',
   'Nada: se arma solo con lo que registras', false, 14, 0)
on conflict (code) do nothing;

insert into public.synapses (neuron_a, neuron_b, confirmed) values
  ('cuerpo_mente_alma', 'salud', true),
  ('cuerpo_mente_alma', 'ejercicio', true),
  ('alimentacion', 'cuerpo_mente_alma', true),
  ('cuerpo_mente_alma', 'habitos', true),
  ('cuerpo_mente_alma', 'diario', true),
  ('cuerpo_mente_alma', 'estudios', true),
  ('cuerpo_mente_alma', 'juegos', true),
  ('biblia', 'cuerpo_mente_alma', true),
  ('cuerpo_mente_alma', 'gratitud', true),
  ('cuerpo_mente_alma', 'foda_personal', true),
  ('cuerpo_mente_alma', 'perfil_personal', true),
  ('cuerpo_mente_alma', 'resumen', true)
on conflict do nothing;

-- Es básica: queda encendida para todas las cuentas que ya existen (las nuevas, desde Conocerte).
insert into public.user_neurons (account_id, neuron_code, state, how, discovered_at)
select a.id, 'cuerpo_mente_alma', 'discovered', 'own', now() from public.accounts a
on conflict (account_id, neuron_code) do nothing;
