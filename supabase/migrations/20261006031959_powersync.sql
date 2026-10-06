-- PowerSync (docs/04 Arquitectura/Sincronización.md): lee los cambios de Postgres y baja a cada
-- teléfono solo lo que permiten sus reglas (powersync/sync-config.yaml), que replican la RLS.
--
-- El usuario se crea SIN contraseña: el dueño del proyecto se la pone desde el editor SQL
-- (alter role powersync_role with password '…') y la escribe solo en el panel de PowerSync.
-- Solo lectura de las tablas que se sincronizan; cada migración nueva que agregue una tabla
-- sincronizada debe darle SELECT y sumarla a la publicación.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role with replication bypassrls login;
  end if;
end;
$$;

grant usage on schema public to powersync_role;
grant select on
  public.accounts, public.spaces, public.space_members, public.people,
  public.personal_profiles, public.user_preferences, public.consents, public.devices
to powersync_role;

create publication powersync for table
  public.accounts, public.spaces, public.space_members, public.people,
  public.personal_profiles, public.user_preferences, public.consents, public.devices;
