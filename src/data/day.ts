import { useQuery } from '@powersync/react';
import { useSyncExternalStore } from 'react';

import { db } from './powersync/database';

// Lo que se marca en Hoy (hecho, vasos de agua, prioridades, la jornada), guardado solo en este
// teléfono en la tabla local day_marks. Sin base local (web) queda en memoria mientras dura la sesión.

export type Mark = { value: number; text: string | null };
export type Marks = Record<string, Mark>;

type Row = { item: string; value: number | null; text: string | null };

const toMarks = (rows: Row[]): Marks =>
  Object.fromEntries(rows.map((r) => [r.item, { value: Number(r.value ?? 0), text: r.text ?? null }]));

function useLocalMarks(day: string): Marks {
  const { data } = useQuery<Row>('SELECT item, value, text FROM day_marks WHERE day = ?', [day]);
  return toMarks(data);
}

// En memoria (web o sin base local).
const memory = new Map<string, Marks>();
const listeners = new Set<() => void>();
let version = 0;
function useMemoryMarks(day: string): Marks {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return memory.get(day) ?? {};
}

export const useDayMarks: (day: string) => Marks = db ? useLocalMarks : useMemoryMarks;

/** Guarda (o borra, con null) una marca del día. */
export async function setMark(day: string, item: string, mark: Partial<Mark> | null): Promise<void> {
  if (!db) {
    const current = { ...(memory.get(day) ?? {}) };
    if (mark === null) delete current[item];
    else current[item] = { value: mark.value ?? current[item]?.value ?? 0, text: mark.text ?? current[item]?.text ?? null };
    memory.set(day, current);
    version += 1;
    listeners.forEach((l) => l());
    return;
  }
  const id = `${day}:${item}`;
  await db.writeTransaction(async (tx) => {
    const prev = await tx.getOptional<Row>('SELECT item, value, text FROM day_marks WHERE id = ?', [id]);
    await tx.execute('DELETE FROM day_marks WHERE id = ?', [id]);
    if (mark === null) return;
    await tx.execute('INSERT INTO day_marks (id, day, item, value, text, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      id,
      day,
      item,
      mark.value ?? prev?.value ?? 0,
      mark.text ?? prev?.text ?? null,
      new Date().toISOString(),
    ]);
  });
}
