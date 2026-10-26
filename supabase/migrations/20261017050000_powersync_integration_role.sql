-- PowerSync se conecta con el usuario que creó la integración de Supabase (powersync_<id>),
-- no con powersync_role. Ese usuario no recibió los permisos de las tablas de Conocerte
-- (onboarding_answers, user_neurons, neuron_suggestions) y PowerSync no podía leerlas.
-- Desde aquí hereda todo lo que se le conceda a powersync_role, también en tablas futuras.
do $$
declare
  r record;
begin
  for r in select rolname from pg_roles where rolname like 'powersync\_%' and rolname <> 'powersync_role' loop
    execute format('grant powersync_role to %I', r.rolname);
  end loop;
end $$;
