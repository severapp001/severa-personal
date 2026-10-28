-- Salud mental (usuario, 27-10-2026: «terapia debería ser una pestaña dentro de un módulo Salud
-- mental, que ayude a hacer test… soy TDAH y necesito una app que me ayude a entender»). Tests
-- validados de uso libre (ASRS, PHQ-9, GAD-7, WHO-5, PSS-10, AUDIT-C), los ejercicios de Terapia y
-- «Mi forma de funcionar». Sus registros viven en el motor común (module_entries).

insert into public.neurons (code, name, hemisphere, level, summary, minimum, sensitive, min_age, sort_order) values
  ('salud_mental', 'Salud mental', 'personal', 2, 'Tests validados (TDAH en adultos, ánimo, ansiedad, bienestar, estrés y alcohol), los ejercicios de Terapia y «Mi forma de funcionar». Orienta; no diagnostica.', 'Un test o un ejercicio', true, 14, 30)
on conflict (code) do nothing;

insert into public.synapses (neuron_a, neuron_b, confirmed)
select least(a, b), greatest(a, b), true from (values
  ('salud_mental', 'terapia'), ('salud_mental', 'cuerpo_mente_alma'), ('salud_mental', 'diario'),
  ('salud_mental', 'respiracion'), ('salud_mental', 'meditacion'), ('salud_mental', 'salud'),
  ('salud_mental', 'prioridades'), ('salud_mental', 'metas')
) as s(a, b)
on conflict do nothing;

-- Lo pidió el usuario: queda encendido para las cuentas que ya existen.
insert into public.user_neurons (account_id, neuron_code, state, how, discovered_at)
select a.id, 'salud_mental', 'discovered', 'own', now() from public.accounts a
on conflict (account_id, neuron_code) do nothing;
