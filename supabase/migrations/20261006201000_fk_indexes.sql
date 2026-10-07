-- Índices para las llaves foráneas que el revisor de Supabase marcó sin cobertura.
create index if not exists people_created_by_idx on public.people (created_by);
create index if not exists personal_profiles_created_by_idx on public.personal_profiles (created_by);
create index if not exists synapses_neuron_b_idx on public.synapses (neuron_b);
