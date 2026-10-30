import type { Part } from './modules';

// Severa v3 (29-10-2026): la persona completa. Decidido por el usuario en C64–C70 (docs/02 Producto/
// Severa v3.md): al centro el **Ser** (la persona entera: Hoy, su plata, sus hábitos, sus logros) y
// alrededor sus tres partes. **Cuerpo** es lo que haces y lo físico; **mente**, lo que piensas,
// organizas y aprendes; **alma**, lo que crees, sientes, creas y con quién compartes.
// Si cambia dónde va un módulo, se cambia aquí y se acomodan solos Hoy, «Tu cuerpo» y cada parte.

/** El Ser y sus tres partes: lo que elige el selector de Hoy en la v3. */
export type Capa = 'ser' | Part;

export const CAPAS: Capa[] = ['ser', 'cuerpo', 'mente', 'alma'];
export const PART_ORDER: Part[] = ['cuerpo', 'mente', 'alma'];

export const PART_INFO: Record<Capa, { name: string; verb: string; about: string }> = {
  ser: { name: 'Ser', verb: 'tú, entero', about: 'Tu día, tu plata, tus hábitos y lo que reúne a tus tres partes.' },
  cuerpo: { name: 'Cuerpo', verb: 'hacer', about: 'Lo que haces y lo físico: tu trabajo, tu salud, moverte y comer.' },
  mente: { name: 'Mente', verb: 'pensar y ordenar', about: 'Lo que piensas, organizas y aprendes: tus prioridades, tus metas y tus estudios.' },
  alma: { name: 'Alma', verb: 'sentir y creer', about: 'Lo que crees, sientes y compartes: tu fe, tu calma, tu gratitud y tu gente.' },
};

const SER = ['finanzas', 'gastos_compartidos', 'habitos', 'logros', 'documentos', 'perfil_personal', 'resumen', 'cuerpo_mente_alma'];
const CUERPO = [
  'trabajo', 'jornada', 'recorridos', 'agenda_y_citas', 'tareas_del_trabajo', 'cobros_y_boletas', 'clientes_y_pacientes', 'ficha_al_terminar', 'pedidos_y_costeo', 'turnos_y_faenas',
  'ventas_y_productos', 'gastos_del_trabajo', 'documentos_laborales', 'habitos_rapidos_en_trabajo', 'cv', 'ejercicio', 'alimentacion', 'salud', 'intimo_y_ciclo',
];
const MENTE = ['calendario', 'prioridades', 'tu_rutina', 'metas', 'estudios', 'salud_mental', 'terapia', 'diario', 'foda_personal', 'juegos'];
const ALMA = ['biblia', 'zen', 'meditacion', 'respiracion', 'gratitud', 'familia_y_mascotas', 'biografia', 'viajes'];

export const PART_OF_MODULE: Record<string, Capa> = Object.fromEntries([
  ...SER.map((c) => [c, 'ser']),
  ...CUERPO.map((c) => [c, 'cuerpo']),
  ...MENTE.map((c) => [c, 'mente']),
  ...ALMA.map((c) => [c, 'alma']),
]);

// Las tarjetas propias de Hoy (las de los módulos van por su módulo). «yo» (Cuerpo, mente y alma) no
// va en ninguna: en la v3 la reemplaza «Tu cuerpo». Las de Trabajo (jornada, línea y tareas) van al cuerpo.
const PART_OF_CARD: Record<string, Capa> = {
  dia: 'ser',
  plata: 'ser',
  hab: 'ser',
  paso: 'mente',
  prio: 'mente',
  sug: 'mente',
  trab: 'cuerpo',
  jornada: 'cuerpo',
  wline: 'cuerpo',
  wtasks: 'cuerpo',
  pan: 'alma',
  diario: 'alma',
  zen: 'alma',
  resp: 'alma',
  medit: 'alma',
};

/** La capa de una tarjeta de Hoy (`dia`, `hab`, `mod:salud`…), o null si no va en ninguna. */
export function partOfCard(key: string): Capa | null {
  if (key === 'yo') return null;
  if (key.startsWith('mod:')) return PART_OF_MODULE[key.slice(4)] ?? 'mente';
  return PART_OF_CARD[key] ?? 'mente';
}

/** Las tarjetas propias de Hoy, en el orden en que se ofrecen. */
export const OWN_CARDS = ['dia', 'prio', 'paso', 'hab', 'plata', 'trab', 'jornada', 'wline', 'wtasks', 'pan', 'diario', 'zen', 'medit', 'resp', 'sug'];

/** Equilibrio entre las partes que se conocen: 1 si están parejas, 0 si una está llena y otra vacía. */
export function balance(scores: (number | null)[]): number | null {
  const known = scores.filter((s): s is number => s !== null);
  if (known.length < 2) return null;
  return Math.round((1 - (Math.max(...known) - Math.min(...known)) / 100) * 100) / 100;
}

// ─── El nivel (C68): sube con los logros, en la secuencia de Fibonacci ───────
/** Logros necesarios para cada nivel: 1, 2, 3, 5, 8 y 13 (el 13 es el máximo, como el M13). */
export const LEVELS = [1, 2, 3, 5, 8, 13];

/** El nivel (0 a 6) según los logros ganados, y cuántos faltan para el siguiente. */
export function levelOf(earned: number): { level: number; next: number | null } {
  const level = LEVELS.filter((n) => earned >= n).length;
  return { level, next: level < LEVELS.length ? LEVELS[level] - earned : null };
}

// ─── El paso entre capas (C68): una transición distinta por cada par ────────
export type Transition = 'baja' | 'sube' | 'latido' | 'espiral' | 'acerca' | 'aleja';

/** Cómo se pasa de una capa a otra: por el cuerpo (mente↔cuerpo), un latido (cuerpo↔alma), un giro de
 *  espiral (mente↔alma), o acercándose y alejándose del centro (el Ser). */
export function transitionOf(from: Capa, to: Capa): Transition {
  if (to === 'ser') return 'aleja';
  if (from === 'ser') return 'acerca';
  const pair = [from, to].sort().join('-');
  if (pair === 'cuerpo-mente') return from === 'mente' ? 'baja' : 'sube';
  if (pair === 'alma-cuerpo') return 'latido';
  return 'espiral';
}
