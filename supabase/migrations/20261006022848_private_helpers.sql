-- La comprobación de membresía la usan las reglas de acceso, no la app:
-- sale del esquema público para que no quede expuesta como /rest/v1/rpc.
-- Las políticas guardan la referencia a la función, así que siguen funcionando.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_space_member(uuid, public.member_role[]) set schema private;
revoke execute on function private.is_space_member(uuid, public.member_role[]) from public, anon;
grant execute on function private.is_space_member(uuid, public.member_role[]) to authenticated;

-- Las funciones de disparador tampoco tienen por qué estar en el esquema público.
alter function public.write_audit() set schema private;
alter function public.touch_row() set schema private;
