import { useQuery } from '@powersync/react';

import { useAuth } from './auth';
import { invalidateRemote, useRows } from './live';
import { db } from './powersync/database';
import { syncEnabled } from './powersync/PowerSyncProvider';
import { supabase } from './supabase';

// Escrituras de los módulos (Finanzas, Estudios, CV, Hábitos, Familia). Con base local se escribe
// en el teléfono y PowerSync sube el cambio cuando hay conexión (funciona sin Internet); sin ella
// (web) se escribe directo en Supabase. Las mismas reglas de acceso (RLS) deciden en el servidor.

type Values = Record<string, string | number | boolean | null | undefined>;

const now = () => new Date().toISOString();
const toSql = (v: Values[string]) => (typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null));

/** El espacio personal de la cuenta: ahí viven los registros propios. */
export function usePersonalSpace(): string | null {
  const { session } = useAuth();
  const accountId = session?.user.id ?? '';
  const { data } = useRows<{ id: string }>(
    "SELECT s.id FROM spaces s JOIN space_members m ON m.space_id = s.id WHERE s.type = 'personal' AND m.account_id = ? AND m.status = 'active' LIMIT 1",
    [accountId],
    () => supabase.from('spaces').select('id').eq('type', 'personal').limit(1),
    `personal-space:${accountId}`,
  );
  return data[0]?.id ?? null;
}

/** Crea un registro y devuelve su id. */
export async function insertRecord(table: string, spaceId: string, accountId: string | undefined, values: Values): Promise<string> {
  if (!db) {
    const { data, error } = await supabase
      .from(table)
      .insert({ ...values, space_id: spaceId, created_by: accountId ?? null })
      .select('id')
      .single();
    if (error) throw error;
    invalidateRemote();
    return (data as { id: string }).id;
  }
  const row = await db.get<{ id: string }>('SELECT uuid() AS id');
  const cols = { ...values, id: row.id, space_id: spaceId, created_by: accountId ?? null, created_at: now(), updated_at: now(), version: 1 };
  const keys = Object.keys(cols);
  await db.execute(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => toSql(cols[k as keyof typeof cols])),
  );
  return row.id;
}

/** Cambia algunos campos de un registro. */
export async function updateRecord(table: string, id: string, values: Values): Promise<void> {
  if (!db) {
    const { error } = await supabase.from(table).update(values).eq('id', id);
    if (error) throw error;
    invalidateRemote();
    return;
  }
  const keys = Object.keys(values);
  if (!keys.length) return;
  await db.execute(
    `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...keys.map((k) => toSql(values[k])), now(), id],
  );
}

/** Borra un registro (queda marcado como borrado; la auditoría guarda el cambio). */
export function deleteRecord(table: string, id: string): Promise<void> {
  return updateRecord(table, id, { deleted_at: now() });
}

const sqlFor = (table: string, where: string, order: string) =>
  `SELECT * FROM ${table} WHERE space_id = ? AND deleted_at IS NULL ${where ? `AND ${where}` : ''} ORDER BY ${order}`;

// Con base local se lee solo del teléfono: estas tablas nacen ahí, y mezclar con el servidor
// mostraría filas de otro filtro mientras la consulta local está vacía.
function useLocalRecords<T>(table: string, spaceId: string | null, order: string, where = '', params: unknown[] = []): T[] {
  return useQuery<T>(sqlFor(table, where, order), [spaceId ?? '', ...params]).data;
}

// Sin base local (web, solo para revisar pantallas): del servidor, con el filtro del espacio.
function useRemoteRecords<T>(table: string, spaceId: string | null, order: string, where = '', params: unknown[] = []): T[] {
  const { data } = useRows<T>(
    sqlFor(table, where, order),
    [spaceId ?? '', ...params],
    () => supabase.from(table).select('*').eq('space_id', spaceId ?? '').is('deleted_at', null),
    `${table}:${spaceId}:${where}:${params.join(',')}`,
  );
  return data;
}

/** Filas vivas (sin borrar) de una tabla del espacio. */
export const useRecords: <T>(table: string, spaceId: string | null, order: string, where?: string, params?: unknown[]) => T[] = syncEnabled
  ? useLocalRecords
  : useRemoteRecords;

/** Consulta libre en la base del teléfono (informes, sumas). Sin base local devuelve vacío. */
function useLocalSql<T>(sql: string, params: unknown[]): T[] {
  return useQuery<T>(sql, params).data;
}
export const useSql: <T>(sql: string, params: unknown[]) => T[] = syncEnabled ? useLocalSql : () => [];
