import { useQuery } from '@powersync/react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import type { Block, ChatMessage, Lesson, Proposal, Refs } from '@/core/assistant';
import { activitiesOf, dayEntry } from '@/core/journal';
import { useAgenda } from './agenda';
import { useJournal } from './journal';
import { useAuth } from './auth';
import { useFinance } from './finance';
import { bool } from './live';
import { useHabits, useStudies } from './modules';
import { db } from './powersync/database';
import { deleteRecord, insertRecord, usePersonalSpace, useRecords } from './records';
import { supabase } from './supabase';

// Asistente (25-10-2026). La conversación queda solo en este teléfono (tablas locales
// assistant_conversations y assistant_messages); lo aprendido se sincroniza (assistant_lessons).
// Sin base local (web) la conversación vive en memoria mientras dura la sesión.

export type Conversation = { id: string; context: string; refs: Refs; startedAt: string };
export type StoredMessage = ChatMessage & { rowId: string; createdAt: string };

type ConversationRow = { id: string; context: string; refs: string; started_at: string };
type MessageRow = { id: string; conversation_id: string; seq: number; role: 'user' | 'assistant'; content: string; created_at: string };

function parse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
const toConversation = (r: ConversationRow): Conversation => ({ id: r.id, context: r.context, refs: parse<Refs>(r.refs, {}), startedAt: r.started_at });
const toMessage = (r: MessageRow): StoredMessage => ({ rowId: r.id, role: r.role, content: parse<Block[]>(r.content, []), createdAt: r.created_at });

function useLocalChat(): { conversation: Conversation | null; messages: StoredMessage[] } {
  const conversation = useQuery<ConversationRow>('SELECT * FROM assistant_conversations ORDER BY started_at DESC LIMIT 1').data[0];
  const rows = useQuery<MessageRow>('SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY seq', [conversation?.id ?? '']).data;
  return { conversation: conversation ? toConversation(conversation) : null, messages: rows.map(toMessage) };
}

// En memoria (web o sin base local).
let memoryConversation: ConversationRow | null = null;
let memoryMessages: MessageRow[] = [];
const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version += 1;
  listeners.forEach((l) => l());
};
function useMemoryChat(): { conversation: Conversation | null; messages: StoredMessage[] } {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return { conversation: memoryConversation ? toConversation(memoryConversation) : null, messages: memoryMessages.map(toMessage) };
}

/** La conversación actual (la más reciente) con sus mensajes en orden. */
export const useChat: () => { conversation: Conversation | null; messages: StoredMessage[] } = db ? useLocalChat : useMemoryChat;

const memoryId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

/** Empieza una conversación con su contexto, que no cambia mientras dure. */
export async function startConversation(context: string, refs: Refs): Promise<Conversation> {
  const row: ConversationRow = { id: db ? (await db.get<{ id: string }>('SELECT uuid() AS id')).id : memoryId(), context, refs: JSON.stringify(refs), started_at: now() };
  if (!db) {
    memoryConversation = row;
    memoryMessages = [];
    changed();
  } else {
    await db.execute('INSERT INTO assistant_conversations (id, context, refs, started_at) VALUES (?, ?, ?, ?)', [row.id, row.context, row.refs, row.started_at]);
  }
  return toConversation(row);
}

/** En el modo sin IA las referencias crecen con lo nuevo (categorías, cuentas, hábitos). */
export async function updateConversationRefs(id: string, refs: Refs): Promise<void> {
  if (!db) {
    if (memoryConversation?.id === id) memoryConversation = { ...memoryConversation, refs: JSON.stringify(refs) };
    changed();
    return;
  }
  await db.execute('UPDATE assistant_conversations SET refs = ? WHERE id = ?', [JSON.stringify(refs), id]);
}

/** Agrega un mensaje al final. Lo ya enviado a la IA no se vuelve a tocar. */
export async function appendMessage(conversationId: string, role: 'user' | 'assistant', content: Block[]): Promise<void> {
  if (!db) {
    memoryMessages = [...memoryMessages, { id: memoryId(), conversation_id: conversationId, seq: memoryMessages.length, role, content: JSON.stringify(content), created_at: now() }];
    changed();
    return;
  }
  await db.writeTransaction(async (tx) => {
    const last = await tx.get<{ seq: number | null }>('SELECT MAX(seq) AS seq FROM assistant_messages WHERE conversation_id = ?', [conversationId]);
    await tx.execute('INSERT INTO assistant_messages (id, conversation_id, seq, role, content, created_at) VALUES (uuid(), ?, ?, ?, ?, ?)', [
      conversationId,
      (last.seq ?? -1) + 1,
      role,
      JSON.stringify(content),
      now(),
    ]);
  });
}

/** Cambia el último mensaje del usuario mientras todavía no se envía (respuestas a tarjetas). */
export async function replaceMessage(rowId: string, content: Block[]): Promise<void> {
  if (!db) {
    memoryMessages = memoryMessages.map((m) => (m.id === rowId ? { ...m, content: JSON.stringify(content) } : m));
    changed();
    return;
  }
  await db.execute('UPDATE assistant_messages SET content = ? WHERE id = ?', [JSON.stringify(content), rowId]);
}

/** Le pregunta a la IA (función `asistente` de Supabase) y devuelve su respuesta tal cual. */
export async function askAssistant(context: string, messages: ChatMessage[]): Promise<{ content: Block[]; stopReason: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ content: Block[]; stop_reason: string | null }>('asistente', { body: { context, messages } });
  if (error) {
    let message = 'No pude conectarme con el asistente. Revisa tu conexión.';
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string; detail?: string } | null;
      if (body?.error) message = body.detail ? `${body.error} (${body.detail})` : body.error;
    }
    throw new Error(message);
  }
  return { content: data?.content ?? [], stopReason: data?.stop_reason ?? null };
}

// ─── Lo aprendido ───────────────────────────────────────────────────────────
export type LessonRow = Lesson & { id: string; active: number | boolean | null; created_at: string };

export function useLessons() {
  const { session } = useAuth();
  const space = usePersonalSpace();
  const rows = useRecords<LessonRow>('assistant_lessons', space, 'created_at DESC', 'active = 1');
  return {
    lessons: rows.filter((l) => bool(l.active)),
    addLesson: (l: Lesson) => {
      if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
      return insertRecord('assistant_lessons', space, session?.user.id, { kind: l.kind, phrase: l.phrase, meaning: l.meaning, active: true });
    },
    forget: (id: string) => deleteRecord('assistant_lessons', id),
  };
}

// ─── Ejecutar lo que el usuario confirmó ────────────────────────────────────
/** Las acciones del asistente usan las mismas escrituras que las pantallas de cada módulo. */
export function useAssistantActions(day: string) {
  const { session } = useAuth();
  const finance = useFinance();
  const habits = useHabits(day);
  const lessons = useLessons();
  const agenda = useAgenda(day, day);
  const studies = useStudies();
  const journal = useJournal();

  async function execute(p: Proposal, refs: Refs): Promise<void> {
    switch (p.tool) {
      case 'registrar_movimiento':
        await finance.addMovement({
          kind: p.kind,
          amount: p.amount,
          occurred_on: p.date,
          account_id: p.account ? refs[p.account].id : (finance.accounts.find((a) => !bool(a.archived))?.id ?? null),
          category_id: p.category ? refs[p.category].id : null,
          description: p.description,
        });
        return;
      case 'marcar_habito':
        if (!habits.space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
        await insertRecord('habit_logs', habits.space, session?.user.id, { habit_id: refs[p.habit].id, day: p.date, count: p.times });
        return;
      case 'crear_habito':
        await habits.addHabit({ name: p.name, direction: p.direction, daily_target: p.direction === 'reduce' ? 1 : p.target });
        return;
      case 'recordar':
        await lessons.addLesson({ kind: 'rule', phrase: p.phrase, meaning: p.meaning });
        return;
      case 'crear_evento':
        await agenda.addEvent({
          title: p.title,
          event_date: p.date,
          starts_at: p.start,
          ends_at: p.start ? p.end : null,
          layer: p.layer,
          repeat: p.repeat,
          remind_minutes: p.remind,
          location: p.place,
          notes: null,
        });
        return;
      case 'crear_tarea':
        await agenda.addTask({ title: p.title, due_on: p.date, due_at: p.date ? p.time : null, urgent: p.urgent });
        return;
      case 'escribir_diario': {
        // Suma a lo que ya había ese día: no borra el texto ni las actividades anteriores.
        const entry = dayEntry(journal.days, p.date);
        const before = activitiesOf(entry?.activities);
        await journal.saveDay(p.date, {
          ...(p.mood ? { mood: p.mood } : {}),
          activities: [...new Set([...before, ...p.activities])],
          ...(p.text ? { body: entry?.body ? `${entry.body}\n\n${p.text}` : p.text } : {}),
        });
        return;
      }
      case 'agradecer':
        await journal.addGratitude(p.date, p.text);
        return;
      case 'crear_evaluacion': {
        // Como en Estudios: la prueba queda en el ramo y en el Calendario como prioridad del día.
        await studies.addAssessment({ course_id: refs[p.course].id, title: p.title, due_on: p.date, weight: p.weight, grade: null });
        await agenda.addEvent({ title: `Prueba: ${p.title} · ${refs[p.course].name}`.slice(0, 120), event_date: p.date, starts_at: null, ends_at: null, layer: 'estudios', repeat: 'none', remind_minutes: null, location: null, notes: null, importance: 1, repeat_until: null });
        return;
      }
      case 'crear_ramo': {
        // El ramo queda en Estudios con su clase semanal (y en Tu día ese día de la semana).
        const notes = [p.until ? `hasta ${p.until}` : null, p.group === null ? null : p.group ? 'trabajos en grupo' : 'individual', p.evaluations].filter(Boolean).join(' · ');
        const courseId = await studies.addCourse({ name: p.name, teacher: p.teacher, term: notes || null });
        if (p.weekday && p.start) {
          const [h, m] = p.start.split(':').map(Number);
          const endMin = h * 60 + m + 90;
          const end = p.end ?? `${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, '0')}:${String(endMin >= 1440 ? 59 : endMin % 60).padStart(2, '0')}`;
          await studies.addBlock({ course_id: courseId, weekday: p.weekday, starts_at: p.start, ends_at: end, room: null });
        }
        return;
      }
    }
  }

  return { finance, habits, lessons, agenda, journal, studies, execute };
}
