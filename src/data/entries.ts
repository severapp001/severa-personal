import { useAuth } from './auth';
import { bool, json } from './live';
import { deleteRecord, insertRecord, updateRecord, usePersonalSpace, useRecords } from './records';

// Motor común de los módulos (migración 20261026120000_module_entries.sql, 26-10-2026). Cada
// registro dice de qué módulo es y qué es; lo propio de cada uno va en `data` (texto JSON).

export type Entry = {
  id: string;
  module: string;
  kind: string;
  parent_id: string | null;
  person_id: string | null;
  title: string | null;
  body: string | null;
  day: string | null;
  until: string | null;
  amount: number | null;
  value: number | null;
  done: boolean;
  data: Record<string, unknown>;
  created_at: string | null;
};

type Row = Omit<Entry, 'done' | 'data' | 'amount' | 'value'> & { done: unknown; data: unknown; amount: unknown; value: unknown };

export type EntryInput = Partial<Omit<Entry, 'id' | 'module' | 'created_at'>> & { kind: string };

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

function toEntry(r: Row): Entry {
  return {
    ...r,
    day: r.day ? String(r.day).slice(0, 10) : null,
    until: r.until ? String(r.until).slice(0, 10) : null,
    amount: num(r.amount),
    value: num(r.value),
    done: bool(r.done),
    data: json(r.data),
  };
}

function toValues(v: Partial<EntryInput>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined) continue;
    if (k === 'data') out.data = JSON.stringify(val ?? {}).slice(0, 8000);
    else if (k === 'title') out.title = typeof val === 'string' ? val.trim().slice(0, 200) || null : null;
    else if (k === 'body') out.body = typeof val === 'string' ? val.trim().slice(0, 5000) || null : null;
    else out[k] = val as string | number | boolean | null;
  }
  return out;
}

/** Los registros de uno o varios módulos, del más nuevo al más viejo. */
export function useEntries(modules: string | string[]) {
  const { session } = useAuth();
  const space = usePersonalSpace();
  const list = Array.isArray(modules) ? modules : [modules];
  const rows = useRecords<Row>('module_entries', space, 'day DESC, created_at DESC', `module IN (${list.map(() => '?').join(', ')})`, list);
  // Sin base local (web) la consulta remota trae todo el espacio: se filtra aquí también.
  const entries = rows.filter((r) => list.includes(r.module)).map(toEntry);

  const add = (module: string, v: EntryInput) => {
    if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
    return insertRecord('module_entries', space, session?.user.id, {
      module,
      parent_id: null,
      person_id: null,
      title: null,
      body: null,
      day: null,
      until: null,
      amount: null,
      value: null,
      done: false,
      ...toValues({ data: {}, ...v }),
    });
  };

  return {
    space,
    entries,
    of: (kind: string, parentId?: string | null) => entries.filter((e) => e.kind === kind && (parentId === undefined || e.parent_id === parentId)),
    children: (parentId: string) => entries.filter((e) => e.parent_id === parentId),
    add: (v: EntryInput & { module?: string }) => add(v.module ?? list[0], v),
    update: (id: string, v: Partial<EntryInput>) => updateRecord('module_entries', id, toValues(v)),
    remove: (id: string) => deleteRecord('module_entries', id),
  };
}

export type Entries = ReturnType<typeof useEntries>;
