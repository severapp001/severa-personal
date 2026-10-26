import { dayEntry, type Gratitude, type JournalDay } from '@/core/journal';
import { useAuth } from './auth';
import { deleteRecord, insertRecord, updateRecord, usePersonalSpace, useRecords } from './records';

// Diario y Gratitud (migración 20261025180000_journal.sql): una entrada de diario por día y lo
// que se agradece, en el espacio personal.

export type DayPatch = { mood?: number | null; body?: string | null; activities?: string[]; closed?: boolean };

export function useJournal() {
  const { session } = useAuth();
  const space = usePersonalSpace();
  const days = useRecords<JournalDay>('journal_days', space, 'day, updated_at');
  const gratitude = useRecords<Gratitude>('gratitude_entries', space, 'day DESC, created_at DESC');

  const add = (table: string, values: Record<string, string | number | boolean | null>) => {
    if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
    return insertRecord(table, space, session?.user.id, values);
  };

  /** Guarda lo del día: si ya hay entrada la cambia, si no la crea. */
  async function saveDay(day: string, patch: DayPatch) {
    const values: Record<string, string | number | boolean | null> = {};
    if (patch.mood !== undefined) values.mood = patch.mood;
    if (patch.body !== undefined) values.body = patch.body?.trim() ? patch.body.trim().slice(0, 5000) : null;
    if (patch.activities !== undefined) values.activities = JSON.stringify(patch.activities.slice(0, 30));
    if (patch.closed !== undefined) values.closed = patch.closed;
    const existing = dayEntry(days, day);
    if (existing) return updateRecord('journal_days', existing.id, values);
    return add('journal_days', { day, mood: null, body: null, activities: '[]', closed: false, ...values });
  }

  return {
    space,
    days,
    gratitude,
    saveDay,
    addGratitude: (day: string, body: string) => add('gratitude_entries', { day, body: body.trim().slice(0, 500) }),
    removeGratitude: (id: string) => deleteRecord('gratitude_entries', id),
  };
}

export type Journal = ReturnType<typeof useJournal>;
