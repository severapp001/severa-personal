import { useQuery } from '@powersync/react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { syncEnabled } from './powersync/PowerSyncProvider';

// Lecturas «vivas»: con sincronización, de la base del teléfono (se actualizan solas y
// funcionan sin conexión); sin ella (web), del servidor. Si la base local todavía no tiene
// filas (por ejemplo, reglas recién desplegadas), se muestra lo del servidor mientras tanto.

let generation = 0;
const listeners = new Set<() => void>();

/** Después de escribir en el servidor: las lecturas remotas se vuelven a pedir. */
export function invalidateRemote() {
  generation += 1;
  listeners.forEach((l) => l());
}

function useGeneration() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => generation,
  );
}

type Remote<T> = () => PromiseLike<{ data: T[] | null; error: unknown }>;

function useRemoteRows<T>(remote: Remote<T>, key: string): { data: T[]; loading: boolean } {
  const gen = useGeneration();
  const [state, setState] = useState<{ data: T[]; loading: boolean }>({ data: [], loading: true });
  useEffect(() => {
    let alive = true;
    remote().then(({ data }) => {
      if (alive) setState({ data: data ?? [], loading: false });
    });
    return () => {
      alive = false;
    };
    // `remote` cambia en cada render; la consulta la identifica `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gen]);
  return state;
}

function useLocalFirstRows<T>(sql: string, params: unknown[], remote: Remote<T>, key: string) {
  const local = useQuery<T>(sql, params);
  const fallback = useRemoteRows(remote, key);
  if (local.data.length > 0) return { data: local.data, loading: false };
  return { data: fallback.data, loading: local.isLoading && fallback.loading };
}

function useRemoteOnly<T>(_sql: string, _params: unknown[], remote: Remote<T>, key: string) {
  return useRemoteRows(remote, key);
}

/** Filas de una tabla sincronizada, con la consulta local (SQLite) y la remota (Supabase). */
export const useRows: <T>(sql: string, params: unknown[], remote: Remote<T>, key: string) => { data: T[]; loading: boolean } =
  syncEnabled ? useLocalFirstRows : useRemoteOnly;

/** Los booleanos llegan como 0/1 desde SQLite y como true/false desde Supabase. */
export const bool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';

/** Los jsonb llegan como texto desde SQLite y como objeto desde Supabase. */
export function json(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v.startsWith('{')) {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/** Las listas (text[]) llegan como texto JSON desde SQLite y como arreglo desde Supabase. */
export function list(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string' && v.startsWith('[')) {
    try {
      return JSON.parse(v) as string[];
    } catch {
      return [];
    }
  }
  return [];
}
