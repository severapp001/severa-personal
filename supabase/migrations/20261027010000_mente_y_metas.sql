-- Módulos nuevos pedidos por el usuario (26-10-2026, noche): Metas y caminos (TDAH: cumplir metas
-- con pasos chicos), Terapia (ejercicios de terapia cognitivo-conductual), Respiración (ejercicios
-- guiados y control de la ansiedad), Meditación (temporizador con guía) y Zen (frases que motivan,
-- sin derechos de autor). Sus registros viven en el motor común (module_entries).

insert into public.neurons (code, name, hemisphere, level, summary, minimum, sensitive, min_age, sort_order) values
  ('metas', 'Metas y caminos', 'personal', 1, 'Metas y desafíos para el cuerpo, la mente o el alma, con su camino por etapas, pasos chicos, ideas y bitácora. En Hoy, solo el próximo paso.', 'Una meta con su parte', false, 14, 3),
  ('zen', 'Zen', 'personal', 2, 'Una frase para cada día: ideas de libros y autores que inspiran, en palabras de Severa, y citas clásicas de dominio público.', 'Nada: se abre y listo', false, 14, 26),
  ('respiracion', 'Respiración', 'personal', 2, 'Ejercicios de respiración guiados (caja, 4-7-8, coherente, suspiro) y el 5-4-3-2-1 para bajar la ansiedad.', 'Hacer un ejercicio', false, 14, 27),
  ('meditacion', 'Meditación', 'personal', 2, 'Temporizador de meditación con guía suave y registro de tus minutos.', 'Una sesión', false, 14, 28),
  ('terapia', 'Terapia', 'personal', 3, 'Ejercicios de terapia cognitivo-conductual: pros y contras de una decisión, registro de pensamientos, pensar lo contrario y «¿qué estoy haciendo?». No reemplaza a un profesional.', 'Un ejercicio', true, 14, 29)
on conflict (code) do nothing;

insert into public.synapses (neuron_a, neuron_b, confirmed)
select least(a, b), greatest(a, b), true from (values
  ('metas', 'cuerpo_mente_alma'), ('metas', 'habitos'), ('metas', 'prioridades'), ('metas', 'logros'),
  ('zen', 'cuerpo_mente_alma'), ('zen', 'metas'),
  ('respiracion', 'salud'), ('respiracion', 'meditacion'), ('respiracion', 'cuerpo_mente_alma'),
  ('meditacion', 'cuerpo_mente_alma'), ('meditacion', 'habitos'),
  ('terapia', 'diario'), ('terapia', 'salud'), ('terapia', 'cuerpo_mente_alma'), ('terapia', 'metas')
) as s(a, b)
on conflict do nothing;

-- Los pidió el usuario: quedan encendidos para las cuentas que ya existen.
insert into public.user_neurons (account_id, neuron_code, state, how, discovered_at)
select a.id, n.code, 'discovered', 'own', now()
from public.accounts a cross join (values ('metas'), ('zen'), ('respiracion'), ('meditacion'), ('terapia')) as n(code)
on conflict (account_id, neuron_code) do nothing;
