// El cerebro que analiza (usuario, 27-10-2026: «que este cerebro comience a entender y analizar cómo
// van funcionando las conexiones»). Mira los días registrados y busca lo que se repite: qué acompaña
// a los días de buen ánimo, a la energía y a la calma, y cuándo se gasta más. Son relaciones de lo
// registrado, no causas: Severa lo dice así. Lógica pura, sin React ni base de datos.

/** Lo que se sabe de un día. `undefined` = ese dato nunca se registra (no cuenta como «no»). */
export type DayFacts = {
  day: string;
  mood?: number | null; // ánimo del Diario, 1 a 4
  body?: number | null; // chequeo del día, 1 a 5
  mind?: number | null;
  soul?: number | null;
  exercise?: number; // minutos
  calm?: number; // minutos de meditación y respiración
  habitsDone?: number;
  habitsTotal?: number;
  gratitude?: boolean;
  bible?: boolean;
  goalSteps?: number;
  workHours?: number;
  spent?: number; // pesos
};

export type Insight = { id: string; title: string; detail: string; modules: [string, string]; strength: number };

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const one = (n: number) => n.toFixed(1).replace('.', ',');
const WEEK = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

type Cause = { key: string; label: string; module: string; has: (d: DayFacts) => boolean | null };
type Outcome = { key: string; label: string; module: string; max: number; threshold: number; value: (d: DayFacts) => number | null | undefined };

const CAUSES: Cause[] = [
  { key: 'exercise', label: 'haces ejercicio', module: 'ejercicio', has: (d) => (d.exercise === undefined ? null : d.exercise > 0) },
  { key: 'calm', label: 'meditas o respiras', module: 'meditacion', has: (d) => (d.calm === undefined ? null : d.calm > 0) },
  { key: 'habits', label: 'cumples tus hábitos', module: 'habitos', has: (d) => (!d.habitsTotal ? null : (d.habitsDone ?? 0) / d.habitsTotal >= 0.7) },
  { key: 'gratitude', label: 'anotas algo bueno', module: 'gratitud', has: (d) => (d.gratitude === undefined ? null : d.gratitude) },
  { key: 'bible', label: 'lees la Biblia', module: 'biblia', has: (d) => (d.bible === undefined ? null : d.bible) },
  { key: 'goals', label: 'avanzas en una meta', module: 'metas', has: (d) => (d.goalSteps === undefined ? null : d.goalSteps > 0) },
  { key: 'work', label: 'trabajas más de 8 horas', module: 'trabajo', has: (d) => (d.workHours === undefined ? null : d.workHours > 8) },
];

const OUTCOMES: Outcome[] = [
  { key: 'mood', label: 'tu ánimo', module: 'diario', max: 4, threshold: 0.4, value: (d) => d.mood },
  { key: 'body', label: 'tu energía', module: 'cuerpo_mente_alma', max: 5, threshold: 0.5, value: (d) => d.body },
  { key: 'mind', label: 'tu calma', module: 'cuerpo_mente_alma', max: 5, threshold: 0.5, value: (d) => d.mind },
];

/** Mínimo de días de cada lado para decir algo. */
const MIN = 3;

function compare(days: DayFacts[], cause: Cause, outcome: Outcome) {
  const yes: number[] = [];
  const no: number[] = [];
  for (const d of days) {
    const v = outcome.value(d);
    const h = cause.has(d);
    if (v === null || v === undefined || h === null) continue;
    (h ? yes : no).push(v);
  }
  if (yes.length < MIN || no.length < MIN) return null;
  return { yes: avg(yes), no: avg(no), n: yes.length + no.length };
}

/** Lo que el cerebro ve, de lo más claro a lo menos claro. */
export function findInsights(days: DayFacts[], max = 8): Insight[] {
  const out: Insight[] = [];
  for (const o of OUTCOMES) {
    for (const c of CAUSES) {
      const r = compare(days, c, o);
      if (!r) continue;
      const diff = r.yes - r.no;
      if (Math.abs(diff) < o.threshold) continue;
      out.push({
        id: `${c.key}-${o.key}`,
        title: `Los días que ${c.label}, ${o.label} ${diff > 0 ? 'está mejor' : 'está más baja'}`.replace('ánimo está más baja', 'ánimo está más bajo'),
        detail: `${one(r.yes)} de ${o.max} esos días y ${one(r.no)} los demás (${r.n} días con datos). Es una relación de lo que registras, no una causa segura.`,
        modules: [c.module, o.module],
        strength: (Math.abs(diff) / (o.max - 1)) * Math.min(1, r.n / 14),
      });
    }
  }

  // Gasto: el día de la semana en que más se gasta, y los días difíciles.
  const spentDays = days.filter((d) => d.spent !== undefined);
  if (spentDays.length >= 14) {
    const total = avg(spentDays.map((d) => d.spent ?? 0));
    const byWeekday = WEEK.map((_, w) => spentDays.filter((d) => new Date(`${d.day}T12:00:00`).getDay() === w).map((d) => d.spent ?? 0));
    let top = -1;
    byWeekday.forEach((list, w) => {
      if (list.length >= 2 && (top < 0 || avg(list) > avg(byWeekday[top]))) top = w;
    });
    if (top >= 0 && total > 0 && avg(byWeekday[top]) >= total * 1.3) {
      const pct = Math.round((avg(byWeekday[top]) / total - 1) * 100);
      out.push({
        id: 'spend-weekday',
        title: `Los ${WEEK[top]} gastas más`,
        detail: `En promedio un ${pct} % más que los demás días. Si quieres, ponle un tope a ese día.`,
        modules: ['finanzas', 'calendario'],
        strength: Math.min(1, pct / 100) * Math.min(1, spentDays.length / 28),
      });
    }
    const hard = spentDays.filter((d) => d.mood !== null && d.mood !== undefined && d.mood <= 2).map((d) => d.spent ?? 0);
    const good = spentDays.filter((d) => d.mood !== null && d.mood !== undefined && d.mood >= 3).map((d) => d.spent ?? 0);
    if (hard.length >= MIN && good.length >= MIN && avg(good) > 0 && avg(hard) >= avg(good) * 1.3) {
      const pct = Math.round((avg(hard) / avg(good) - 1) * 100);
      out.push({
        id: 'spend-mood',
        title: 'Los días difíciles gastas más',
        detail: `Un ${pct} % más que en los días buenos. Antes de comprar en un mal día, prueba esperar 10 minutos o respirar.`,
        modules: ['finanzas', 'diario'],
        strength: Math.min(1, pct / 100) * 0.9,
      });
    }
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, max);
}

/** Lo que le falta saber al cerebro para empezar a ver relaciones. */
export function missingFor(days: DayFacts[]): string[] {
  const out: string[] = [];
  const moods = days.filter((d) => d.mood).length;
  const checks = days.filter((d) => d.body).length;
  if (moods < 6) out.push(`Cierra el día con tu ánimo unos días más (llevas ${moods}).`);
  if (checks < 6) out.push(`Cuenta cómo están tu cuerpo, tu mente y tu alma al cerrar el día (llevas ${checks}).`);
  if (!days.some((d) => d.exercise !== undefined)) out.push('Anota tus sesiones de ejercicio.');
  if (!days.some((d) => d.spent !== undefined)) out.push('Registra tus gastos unas semanas.');
  return out;
}
