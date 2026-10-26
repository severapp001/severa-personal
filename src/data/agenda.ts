import type { CalendarEvent, EventLayer, PriorityOrigin, PriorityState, Repeat, Task } from '@/core/agenda';
import { addDays } from '@/core/agenda';
import { useAuth } from './auth';
import { bool, useRows } from './live';
import { deleteRecord, insertRecord, updateRecord, usePersonalSpace, useRecords } from './records';
import { supabase } from './supabase';

/** Feriados de Chile (catálogo). */
export function useHolidays(): Map<string, string> {
  const { data } = useRows<{ date: string; name: string }>('SELECT date, name FROM holidays ORDER BY date', [], () => supabase.from('holidays').select('date, name'), 'holidays');
  return new Map(data.map((h) => [String(h.date).slice(0, 10), h.name]));
}

// Agenda (MD4, migración 20261025150000_agenda.sql): eventos del calendario, tareas y lo que el
// usuario marcó en las prioridades del día.

export type EventInput = {
  title: string;
  event_date: string;
  starts_at: string | null;
  ends_at: string | null;
  layer: EventLayer;
  repeat: Repeat;
  remind_minutes: number | null;
  location: string | null;
  notes: string | null;
  /** 0 normal · 1 prioridad del día · 2 urgente (26-10-2026). */
  importance?: number;
  /** Hasta cuándo se repite (vacío = siempre). */
  repeat_until?: string | null;
};
export type TaskInput = { title: string; due_on: string | null; due_at: string | null; urgent: boolean; notes?: string | null };

/** Todo el calendario y las tareas, más lo marcado entre `from` y `to`. */
export function useAgenda(from: string, to: string) {
  const { session } = useAuth();
  const space = usePersonalSpace();
  const events = useRecords<CalendarEvent>('calendar_events', space, 'event_date, starts_at');
  const tasks = useRecords<Task>('tasks', space, 'due_on, due_at, created_at').map((t) => ({ ...t, urgent: bool(t.urgent) }));
  const states = useRecords<PriorityState>('daily_priorities', space, 'day, updated_at', 'day BETWEEN ? AND ?', [from, to]).filter((s) => s.day >= from && s.day <= to);

  const add = (table: string, values: Record<string, string | number | boolean | null>) => {
    if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
    return insertRecord(table, space, session?.user.id, values);
  };

  /** Marca (o desmarca, con null) algo de la lista del día que no es una tarea. */
  async function setState(day: string, origin: PriorityOrigin, originId: string, status: 'done' | 'dismissed' | null) {
    const existing = states.filter((s) => s.day === day && s.origin_type === origin && s.origin_id === originId);
    for (const s of existing) await deleteRecord('daily_priorities', s.id);
    if (status) await add('daily_priorities', { day, origin_type: origin, origin_id: originId, status, sort_order: null });
  }

  return {
    space,
    events,
    tasks,
    states,
    addEvent: (v: EventInput) => add('calendar_events', { ...v, importance: v.importance ?? 0, repeat_until: v.repeat_until ?? null }),
    updateEvent: (id: string, v: Partial<EventInput>) => updateRecord('calendar_events', id, v),
    removeEvent: (id: string) => deleteRecord('calendar_events', id),
    addTask: (v: TaskInput) => add('tasks', { title: v.title, due_on: v.due_on, due_at: v.due_at, urgent: v.urgent, notes: v.notes ?? null, status: 'pending', done_on: null, moved_from: null }),
    updateTask: (id: string, v: Partial<TaskInput>) => updateRecord('tasks', id, v),
    completeTask: (id: string, done: boolean, day: string) => updateRecord('tasks', id, done ? { status: 'done', done_on: day } : { status: 'pending', done_on: null }),
    /** Pasa la tarea al día siguiente y recuerda de dónde venía. */
    postponeTask: (t: Task, day: string) => updateRecord('tasks', t.id, { due_on: addDays(day, 1), moved_from: t.moved_from ?? t.due_on }),
    removeTask: (id: string) => deleteRecord('tasks', id),
    setState,
  };
}

export type Agenda = ReturnType<typeof useAgenda>;
