// Hoy (F02, vista previa del 17-10-2026): la línea del día y los datos de las tarjetas, armados
// con lo que la persona contó en Conocerte. Dominio puro: sin React ni base de datos.

export type DayIcon = 'sun' | 'moon' | 'book' | 'briefcase' | 'fork' | 'walk' | 'pen' | 'dumbbell' | 'pray' | 'play' | 'car' | 'flag' | 'coffee';

export type DayItem = {
  id: string;
  /** Minutos desde la medianoche. */
  t: number;
  end?: number;
  title: string;
  sub: string;
  icon: DayIcon;
  work?: boolean;
  /** Sin hora fija: se hace en algún momento del día (26-10-2026). */
  flexible?: boolean;
};

export const DEFAULT_WAKE = '07:00';
export const DEFAULT_SLEEP = '23:00';

export function toMinutes(time: string | null | undefined): number | null {
  const m = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const fmtTime = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const minutesNow = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Saludo según la hora. */
export function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5 || h >= 20) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  return 'Buenas tardes';
}

export type DayInput = {
  wake?: string | null;
  sleep?: string | null;
  /** Neuronas encendidas o por completar. */
  on: Set<string>;
  /** Tipo de rutina que eligió en el plan rápido («De día», «Turnos»…). */
  routine?: string | null;
  works: boolean;
  /** Hábitos que eligió contar (códigos de habit_templates). */
  habits: string[];
  /** Su día no tiene horario fijo (usuario, 26-10-2026: «no tengo hora de despertar o dormir»):
   *  sin despertar ni dormir, y lo demás queda «durante el día», sin hora. */
  variable?: boolean;
};

/** La línea del día en Personal, en orden. Las horas que no sabemos se toman por defecto. */
export function personalDay(input: DayInput): DayItem[] {
  const wakeKnown = toMinutes(input.wake);
  const sleepKnown = toMinutes(input.sleep);
  const wake = wakeKnown ?? toMinutes(DEFAULT_WAKE)!;
  let sleep = sleepKnown ?? toMinutes(DEFAULT_SLEEP)!;
  if (sleep <= wake) sleep += 1440; // se duerme pasada la medianoche
  const has = (code: string) => input.on.has(code);
  const items: DayItem[] = [];

  items.push({ id: 'despertar', t: wake, title: 'Despertar', sub: wakeKnown === null ? 'Hora aproximada' : 'Empieza tu día', icon: 'sun' });
  if (input.habits.includes('orar_meditar')) items.push({ id: 'orar', t: wake + 10, title: 'Orar o meditar', sub: 'Hábito · 10 min', icon: 'pray' });
  if (has('biblia')) items.push({ id: 'pan', t: wake + 20, title: 'Pan de vida', sub: 'Biblia · 3 min', icon: 'book' });
  if (input.works && (input.routine === 'De día' || !input.routine)) {
    items.push({ id: 'jornada', t: 540, end: 1080, title: 'Jornada', sub: 'Horario aproximado · lo ajustas en Tu rutina', icon: 'briefcase', work: true });
  }
  if (has('alimentacion') || has('tu_rutina')) items.push({ id: 'almuerzo', t: 780, end: 825, title: 'Almuerzo', sub: '45 min', icon: 'fork' });
  if (input.habits.includes('caminar')) items.push({ id: 'caminar', t: 1110, end: 1140, title: 'Caminar 30 minutos', sub: 'Hábito', icon: 'walk' });
  if (input.habits.includes('entrenar') || has('ejercicio')) items.push({ id: 'entrenar', t: 1140, end: 1200, title: 'Entrenar', sub: 'Ejercicio · 1 h', icon: 'dumbbell' });
  if (has('diario') || has('gratitud')) {
    items.push({ id: 'cierre', t: Math.max(sleep - 90, wake + 60), title: 'Cerrar el día', sub: has('gratitud') ? 'Diario y una cosa buena' : 'Diario · 1 min', icon: 'pen' });
  }
  if (input.habits.includes('leer')) items.push({ id: 'leer', t: sleep - 45, title: 'Leer 10 minutos', sub: 'Hábito', icon: 'book' });
  items.push({ id: 'dormir', t: sleep, title: 'Dormir', sub: sleepKnown === null ? 'Hora aproximada' : `${duration(1440 - (sleep - wake))} de sueño`, icon: 'moon' });
  if (input.variable) {
    return items
      .filter((i) => i.id !== 'despertar' && i.id !== 'dormir' && i.id !== 'jornada')
      .map((i) => ({ ...i, flexible: true, sub: i.sub.replace(/ · \d+ (min|h)$/, '') }))
      .sort((a, b) => a.t - b.t);
  }
  return items.sort((a, b) => a.t - b.t);
}

/** Lo que pasó y lo que sigue: un ítem cuenta como pasado cuando ya terminó. */
export const isPast = (item: DayItem, now: number) => (item.end ?? item.t) <= now;
export const isLive = (item: DayItem, now: number) => item.end !== undefined && item.t <= now && now < item.end;

/** El siguiente ítem que no está hecho, para el titular de la tarjeta. */
export function nextItem(items: DayItem[], now: number, done: (id: string) => boolean): DayItem | null {
  return items.find((it) => it.t >= now && !done(it.id)) ?? null;
}

// ─── Día de pago (F09) ──────────────────────────────────────────────────────

export type PaydayAnswer = { option?: string; day?: number } | 'skipped' | null | undefined;

const lastBusinessDay = (y: number, m: number) => {
  const d = new Date(y, m + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.getDate();
};

function paydayIn(y: number, m: number, answer: { option?: string; day?: number }): number | null {
  const last = new Date(y, m + 1, 0).getDate();
  if (answer.option === 'Día 5') return 5;
  if (answer.option === 'Día 15') return 15;
  if (answer.option === 'Último día hábil') return lastBusinessDay(y, m);
  if (answer.option === 'Otro día' && answer.day) return Math.min(answer.day, last);
  return null;
}

/** Días que faltan para el próximo pago (0 = hoy). Null si no tiene fecha fija. */
export function daysToPayday(answer: PaydayAnswer, today: Date): { days: number; date: Date } | null {
  if (!answer || answer === 'skipped') return null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const base = new Date(y, m, today.getDate());
  for (const offset of [0, 1]) {
    const day = paydayIn(y, m + offset, answer);
    if (day === null) return null;
    const date = new Date(y, m + offset, day);
    if (date >= base) return { days: Math.round((date.getTime() - base.getTime()) / 86400000), date };
  }
  return null;
}

/** Fecha local «AAAA-MM-DD» para guardar lo del día. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
