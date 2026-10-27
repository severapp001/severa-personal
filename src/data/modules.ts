import { useEffect } from 'react';

import type { Assessment, Block } from '@/core/studies';
import { useAuth } from './auth';
import { useRows } from './live';
import { db } from './powersync/database';
import { deleteRecord, insertRecord, updateRecord, usePersonalSpace, useRecords } from './records';
import { supabase } from './supabase';

// Estudios, CV, Familia y Hábitos (migración 20261018120000_modules.sql).

type V = Record<string, string | number | boolean | null>;

function useWriter() {
  const { session } = useAuth();
  const space = usePersonalSpace();
  const add = (table: string, values: V) => {
    if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
    return insertRecord(table, space, session?.user.id, values);
  };
  return { space, add };
}

// ─── Estudios ────────────────────────────────────────────────────────────────
export type Course = { id: string; name: string; institution: string | null; term: string | null; teacher: string | null; pass_grade: number; archived: number | boolean | null; person_id: string | null; program_id?: string | null };

export function useStudies() {
  const { space, add } = useWriter();
  return {
    space,
    courses: useRecords<Course>('study_courses', space, 'archived, name'),
    blocks: useRecords<Block>('study_blocks', space, 'weekday, starts_at'),
    assessments: useRecords<Assessment>('study_assessments', space, 'due_on'),
    addCourse: (v: { name: string; institution?: string | null; teacher?: string | null; term?: string | null; person_id?: string | null; program_id?: string | null }) =>
      add('study_courses', { name: v.name, institution: v.institution ?? null, teacher: v.teacher ?? null, term: v.term ?? null, person_id: v.person_id ?? null, program_id: v.program_id ?? null, pass_grade: 4.0, archived: false }),
    addBlock: (v: { course_id: string; weekday: number; starts_at: string; ends_at: string; room?: string | null }) => add('study_blocks', { ...v, room: v.room ?? null }),
    addAssessment: (v: { course_id: string; title: string; due_on: string | null; weight: number | null; grade: number | null }) => add('study_assessments', v),
    setGrade: (id: string, grade: number | null) => updateRecord('study_assessments', id, { grade }),
    remove: (table: 'study_courses' | 'study_blocks' | 'study_assessments', id: string) => deleteRecord(table, id),
  };
}

// ─── CV ──────────────────────────────────────────────────────────────────────
export type CvKind = 'job' | 'education' | 'course' | 'skill' | 'language' | 'achievement';
export type CvEntry = { id: string; kind: CvKind; title: string; organization: string | null; started_on: string | null; ended_on: string | null; current: number | boolean | null; description: string | null };

export function useCv() {
  const { space, add } = useWriter();
  return {
    space,
    entries: useRecords<CvEntry>('cv_entries', space, 'kind, current DESC, started_on DESC'),
    addEntry: (v: Omit<CvEntry, 'id'>) => add('cv_entries', { ...v, current: !!v.current, sort_order: 0 }),
    remove: (id: string) => deleteRecord('cv_entries', id),
  };
}

// ─── Familia (people del núcleo) ─────────────────────────────────────────────
export type Person = { id: string; type: 'self' | 'child' | 'pet' | 'other'; name: string; birth_date: string | null; relationship: string | null; species: string | null; breed: string | null; notes: string | null };

export function useFamily() {
  const { space, add } = useWriter();
  const { data } = useRows<Person>(
    "SELECT * FROM people WHERE space_id = ? AND deleted_at IS NULL AND type <> 'self' ORDER BY type, name",
    [space ?? ''],
    () => supabase.from('people').select('*').eq('space_id', space ?? '').neq('type', 'self').is('deleted_at', null),
    `family:${space}`,
  );
  return {
    space,
    people: data,
    addPerson: (v: { type: 'child' | 'pet' | 'other'; name: string; birth_date: string | null; relationship: string | null; species: string | null; notes: string | null }) =>
      add('people', { ...v, origin: 'app' }),
    updatePerson: (id: string, v: V) => updateRecord('people', id, v),
    remove: (id: string) => deleteRecord('people', id),
  };
}

// ─── Hábitos ─────────────────────────────────────────────────────────────────
export type Habit = { id: string; template_code: string | null; name: string; direction: 'good' | 'reduce'; daily_target: number; unit: string | null; active: number | boolean | null };
export type HabitLog = { id: string; habit_id: string; day: string; count: number };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Dos hábitos son el mismo si vienen de la misma plantilla o se llaman igual. */
export const habitKey = (h: Pick<Habit, 'template_code' | 'name'>) => h.template_code ?? `nombre:${norm(h.name)}`;

let merging = false;

/**
 * Repetir Conocerte creaba los mismos hábitos otra vez (usuario, 26-10-2026). Los registros de los
 * repetidos pasan al primero y los repetidos se archivan: no se pierde nada de lo contado.
 */
async function mergeDuplicates(groups: Habit[][]) {
  if (merging) return;
  merging = true;
  try {
    for (const [keep, ...dupes] of groups) {
      for (const d of dupes) {
        if (db) await db.execute('UPDATE habit_logs SET habit_id = ?, updated_at = ? WHERE habit_id = ?', [keep.id, new Date().toISOString(), d.id]);
        else await supabase.from('habit_logs').update({ habit_id: keep.id }).eq('habit_id', d.id);
        await updateRecord('habits', d.id, { active: false });
      }
    }
  } catch {
    // Se vuelve a intentar la próxima vez que se abra Hoy o Hábitos.
  } finally {
    merging = false;
  }
}

export function useHabits(day: string) {
  const { space, add } = useWriter();
  const all = useRecords<Habit>('habits', space, 'sort_order, created_at, name', 'active = 1');
  const logs = useRecords<HabitLog>('habit_logs', space, 'day', 'day = ?', [day]);
  const byKey = new Map<string, Habit[]>();
  for (const h of all) byKey.set(habitKey(h), [...(byKey.get(habitKey(h)) ?? []), h]);
  const groups = [...byKey.values()];
  const habits = groups.map((g) => g[0]);
  const repeated = groups.filter((g) => g.length > 1);
  const repeatedKey = repeated.map((g) => g.map((h) => h.id).join(',')).join('|');
  useEffect(() => {
    if (repeated.length) mergeDuplicates(repeated);
    // repeatedKey identifica los grupos repetidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatedKey]);
  const idsOf = (habitId: string) => byKey.get(habitKey(all.find((h) => h.id === habitId) ?? { template_code: null, name: habitId }))?.map((h) => h.id) ?? [habitId];
  const countFor = (habitId: string) => {
    const ids = idsOf(habitId);
    return logs.filter((l) => ids.includes(l.habit_id)).reduce((s, l) => s + Number(l.count), 0);
  };
  return {
    space,
    habits,
    good: habits.filter((h) => h.direction !== 'reduce'),
    reduce: habits.filter((h) => h.direction === 'reduce'),
    logs,
    countFor,
    /** Crea el hábito, salvo que ya lo estés contando (devuelve el que ya existe). */
    addHabit: async (v: { name: string; direction: 'good' | 'reduce'; template_code?: string | null; daily_target?: number; unit?: string | null }) => {
      const existing = byKey.get(habitKey({ template_code: v.template_code ?? null, name: v.name }));
      if (existing?.length) return existing[0].id;
      return add('habits', { name: v.name, direction: v.direction, template_code: v.template_code ?? null, daily_target: v.daily_target ?? 1, unit: v.unit ?? null, active: true, sort_order: 0 });
    },
    archive: (id: string) => updateRecord('habits', id, { active: false }),
    /** Suma (o resta, con −1) al conteo de hoy: un registro por toque, así dos teléfonos no se pisan. */
    log: (habitId: string, delta: 1 | -1) => {
      if (delta > 0) return add('habit_logs', { habit_id: habitId, day, count: 1 });
      const ids = idsOf(habitId);
      const last = [...logs].reverse().find((l) => ids.includes(l.habit_id) && Number(l.count) > 0);
      return last ? deleteRecord('habit_logs', last.id) : Promise.resolve();
    },
  };
}

/** Lo contado de un hábito desde `from` (para su racha y su mapa del mes). */
export function useHabitHistory(habitId: string | null, from: string) {
  const space = usePersonalSpace();
  const logs = useRecords<HabitLog>('habit_logs', space, 'day', 'habit_id = ? AND day >= ?', [habitId ?? '', from]);
  return logs.filter((l) => l.habit_id === habitId && l.day >= from);
}
