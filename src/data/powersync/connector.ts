import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/common';

import { supabase } from '../supabase';

export const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '';

// Tablas cuya llave en el servidor no se llama «id».
const PRIMARY_KEY: Record<string, string> = { user_preferences: 'account_id', onboarding_answers: 'account_id' };

// Columnas jsonb y listas (text[]): en el teléfono son texto y al subir vuelven a ser objeto o
// lista (si no, quedarían guardadas como un texto JSON dentro de la columna).
const JSON_COLUMNS: Record<string, string[]> = { onboarding_answers: ['answers', 'trades'] };

function withJson(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const cols = JSON_COLUMNS[table];
  if (!cols) return data;
  const out = { ...data };
  for (const c of cols) {
    if (typeof out[c] === 'string') {
      try {
        out[c] = JSON.parse(out[c] as string);
      } catch {
        // se deja tal cual: el servidor dirá si no sirve
      }
    }
  }
  return out;
}

// Errores que no se arreglan reintentando (dato inválido o sin permiso): se descartan
// para que la cola no quede trabada. La auditoría y el aviso de conflicto llegan con las RPC.
const FATAL = [/^22...$/, /^23...$/, /^42501$/];

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !powerSyncUrl) return null;
    return {
      endpoint: powerSyncUrl,
      token: data.session.access_token,
      expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000) : undefined,
    };
  }

  // Sube lo escrito sin conexión. Las mismas reglas de acceso (RLS) del servidor deciden.
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let current: { table: string; id: string } | null = null;
    try {
      for (const op of transaction.crud) {
        current = { table: op.table, id: op.id };
        const key = PRIMARY_KEY[op.table] ?? 'id';
        const table = supabase.from(op.table);
        let result: { error: { code?: string; message: string } | null };
        if (op.op === UpdateType.PUT) {
          result = await table.upsert(withJson(op.table, { ...op.opData, [key]: op.id }));
        } else if (op.op === UpdateType.PATCH) {
          result = await table.update(withJson(op.table, op.opData ?? {})).eq(key, op.id);
        } else {
          result = await table.delete().eq(key, op.id);
        }
        if (result.error) throw result.error;
      }
      await transaction.complete();
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (FATAL.some((re) => re.test(code))) {
        console.warn('Cambio descartado por el servidor', current, code);
        await transaction.complete();
      } else {
        throw e; // sin conexión u otro error pasajero: PowerSync reintenta
      }
    }
  }
}
