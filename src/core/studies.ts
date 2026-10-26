// Estudios (F20, con la primera versión como referencia): ramos, horario por bloques, pruebas con
// su ponderación y notas en escala chilena (1,0 a 7,0). Dominio puro.

export type Assessment = { id: string; course_id: string; title: string; due_on: string | null; weight: number | null; grade: number | null };
export type Block = { id: string; course_id: string; weekday: number; starts_at: string; ends_at: string; room: string | null };

/** Promedio del ramo: ponderado si las notas tienen porcentaje; si no, simple. Redondeado a una décima. */
export function courseAverage(assessments: Assessment[]): number | null {
  const graded = assessments.filter((a) => a.grade !== null && a.grade !== undefined);
  if (!graded.length) return null;
  const weighted = graded.every((a) => a.weight);
  const avg = weighted
    ? graded.reduce((s, a) => s + Number(a.grade) * Number(a.weight), 0) / graded.reduce((s, a) => s + Number(a.weight), 0)
    : graded.reduce((s, a) => s + Number(a.grade), 0) / graded.length;
  return Math.round(avg * 10) / 10;
}

export type Needed = { grade: number; possible: boolean } | null;

/**
 * La nota que necesita en lo que queda para llegar a la nota de aprobación. Solo se calcula si
 * todas las pruebas tienen porcentaje y queda alguna sin nota.
 */
export function neededGrade(assessments: Assessment[], pass = 4.0): Needed {
  if (!assessments.length || !assessments.every((a) => a.weight)) return null;
  const pending = assessments.filter((a) => a.grade === null || a.grade === undefined);
  if (!pending.length) return null;
  const total = assessments.reduce((s, a) => s + Number(a.weight), 0);
  const done = assessments.filter((a) => a.grade !== null && a.grade !== undefined).reduce((s, a) => s + Number(a.grade) * Number(a.weight), 0);
  const rest = pending.reduce((s, a) => s + Number(a.weight), 0);
  const grade = Math.max(1, Math.ceil(((pass * total - done) / rest) * 10) / 10);
  return { grade, possible: grade <= 7 };
}

/** Pruebas que vienen, desde hoy, ordenadas por fecha. */
export function upcoming(assessments: Assessment[], todayIso: string): Assessment[] {
  return assessments.filter((a) => a.due_on && a.due_on >= todayIso && (a.grade === null || a.grade === undefined)).sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''));
}

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Los bloques de la semana agrupados por día (1 = lunes), en orden de hora. */
export function weekPlan(blocks: Block[]): { weekday: number; blocks: Block[] }[] {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((weekday) => ({ weekday, blocks: blocks.filter((b) => Number(b.weekday) === weekday).sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }))
    .filter((d) => d.blocks.length);
}

/** Días que faltan para una fecha «AAAA-MM-DD» (0 = hoy). */
export function daysUntil(dateIso: string, todayIso: string): number {
  const [y1, m1, d1] = todayIso.split('-').map(Number);
  const [y2, m2, d2] = dateIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
