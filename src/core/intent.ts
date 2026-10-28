// Asistente sin IA (decisión del usuario, 25-10-2026: «solo sin IA», gratis y privado). Entiende
// frases comunes en español de Chile y las convierte en las mismas propuestas (herramientas) que
// usaba la IA, así las tarjetas, las correcciones y las lecciones funcionan igual. Todo ocurre en
// el teléfono: no se envía nada. Lo que no entiende lo dice y da ejemplos.
// Dominio puro: sin React ni base de datos.

import type { Lesson, Refs } from './assistant';
import { formatCLP } from './money';

export type ToolCall = { name: string; input: Record<string, unknown> };
export type LocalResult = { reply: string | null; calls: ToolCall[] };

/** Datos para responder preguntas («¿cuánto gasté este mes?», «¿qué tengo mañana?»). */
export type IntentData = {
  movements: { date: string; kind: string; amount: number; category: string | null }[];
  agenda: { date: string; time: string | null; title: string; kind: 'evento' | 'tarea' }[];
  habits: { name: string; count: number; target: number; reduce: boolean }[];
  paydayDays: number | null;
};

type Ctx = { today: string; refs: Refs; lessons: Lesson[] };

// ─── Texto ───────────────────────────────────────────────────────────────────
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const noon = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
const shift = (day: string, n: number) => {
  const d = noon(day);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const STOP = new Set(['en', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'por', 'para', 'con', 'y', 'mi', 'mis', 'me', 'al', 'a', 'que', 'se', 'lo', 'le']);

// Los números que son parte de lo dicho, no un monto ni una fecha (27-10-2026, prueba del usuario:
// «trotar 5 km» quedaba en «trotar km»): los que van antes de una unidad o después de «unidad», «capítulo»…
const KEEP_AFTER = /^(km|kms|kilometros?|m|metros?|min|minutos?|hrs?|horas?|veces|paginas?|pags?|capitulos?|kg|kilos?|litros?|lts?|vasos?|series|repeticiones|%)$/;
const KEEP_BEFORE = new Set(['unidad', 'capitulo', 'tema', 'modulo', 'semana', 'parte', 'nivel', 'clase', 'control', 'prueba', 'certamen', 'guia', 'taller', 'laboratorio', 'numero', 'n']);

/** Lo que queda del texto original (con sus tildes) al sacar los trozos ya leídos (monto, fecha,
 *  hora), cada uno en su lugar, y las palabras de `drop`. El relleno se quita solo al comienzo y al
 *  final, para que el título se lea natural («enviar correo a fiscal por suspensión»). */
function rest(text: string, remove: (string | undefined)[], drop: string[] = []): string {
  const words = text
    .replace(/[¿?¡!«»"]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[(]+|[.,;:)]+$/g, ''))
    .filter(Boolean);
  const folded = words.map(fold);
  const gone = words.map(() => false);
  for (const r of remove) {
    if (!r) continue;
    const seq = fold(r).split(' ').filter(Boolean);
    for (let i = 0; i + seq.length <= folded.length; i++) {
      if (seq.every((w, j) => !gone[i + j] && folded[i + j] === w)) {
        seq.forEach((_, j) => (gone[i + j] = true));
        break;
      }
    }
  }
  const dropped = new Set(drop);
  const kept = words.filter((_, i) => {
    const f = folded[i];
    if (!f || gone[i] || dropped.has(f)) return false;
    if (/^\+?\$?[\d.,]+$/.test(f)) return KEEP_AFTER.test(folded[i + 1] ?? '') || KEEP_BEFORE.has(folded[i - 1] ?? '');
    return true;
  });
  while (kept.length && STOP.has(fold(kept[0]))) kept.shift();
  while (kept.length && STOP.has(fold(kept[kept.length - 1]))) kept.pop();
  return kept.join(' ').trim();
}

/** Palabras de orden que no son parte del título («agrega evento…», «anota una tarea…»). */
const COMMAND_WORDS = ['agrega', 'agregar', 'agregue', 'agregame', 'anade', 'anadir', 'anademe', 'crea', 'crear', 'creame', 'pon', 'poner', 'ponme', 'registra', 'registrar', 'evento', 'eventos', 'recordatorio', 'nuevo', 'nueva', 'agendame', 'agenda', 'agendar', 'anota', 'anotar', 'anotame'];

// ─── Montos ──────────────────────────────────────────────────────────────────
const UNIT: Record<string, number> = { luca: 1000, lucas: 1000, luquita: 1000, luquitas: 1000, mil: 1000, k: 1000, gamba: 100, gambas: 100, palo: 1_000_000, palos: 1_000_000, millon: 1_000_000, millones: 1_000_000 };
const WORD_NUM: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, veinte: 20, media: 0.5 };
const UNIT_RE = '(lucas?|luquitas?|mil|k|gambas?|palos?|millon(?:es)?)';

/** Un monto en pesos dentro del texto («5 lucas», «$5.000», «2,5 millones», «una luca», «8000»).
 *  Devuelve el monto y el trozo que lo dijo; null si no hay. Las horas y las fechas no cuentan. */
export function findAmount(text: string): { amount: number; raw: string } | null {
  const t = fold(text);
  const withUnit = new RegExp(`(?:\\$\\s*)?(\\d+(?:,\\d+)?)\\s*${UNIT_RE}\\b`).exec(t);
  if (withUnit) return { amount: Math.round(Number(withUnit[1].replace(',', '.')) * UNIT[withUnit[2]]), raw: withUnit[0] };
  const wordUnit = new RegExp(`\\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|media)\\s+${UNIT_RE}\\b`).exec(t);
  if (wordUnit) return { amount: Math.round(WORD_NUM[wordUnit[1]] * UNIT[wordUnit[2]]), raw: wordUnit[0] };
  const money = /\$\s*(\d{1,3}(?:\.\d{3})+|\d+)/.exec(t);
  if (money) return { amount: Number(money[1].replace(/\./g, '')), raw: money[0] };
  // Un número suelto de 100 o más que no sea hora («a las 1030») ni fecha («el 15/11»).
  for (const m of t.matchAll(/(?<![\d:/.-])(\d{1,3}(?:\.\d{3})+|\d{3,})(?![\d:/])/g)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 7), m.index);
    if (/a las\s*$/.test(before)) continue;
    return { amount: Number(m[1].replace(/\./g, '')), raw: m[0] };
  }
  return null;
}

// ─── Fechas y horas ──────────────────────────────────────────────────────────
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** La fecha que dice el texto. Con `future` se agenda («el lunes» = el próximo); si no, la pasada
 *  («el lunes gasté» = el último lunes). Null si no dice ninguna. */
export function findDate(text: string, today: string, future: boolean): { date: string; raw: string } | null {
  const t = fold(text);
  const simple: [RegExp, number][] = [
    [/\bpasado manana\b/, 2],
    [/\b(?:anteayer|antier)\b/, -2],
    // «a las 10 de la mañana» habla de la hora, no del día siguiente.
    [/(?<!de la |en la |por la |esta )\bmanana\b/, 1],
    [/\bayer\b/, -1],
    [/\bhoy\b/, 0],
  ];
  for (const [re, n] of simple) {
    const m = re.exec(t);
    if (m) return { date: shift(today, n), raw: m[0] };
  }
  const wd = new RegExp(`\\b(?:el |este |esta |el proximo |el otro )?(${WEEKDAYS.join('|')})\\b`).exec(t);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1]);
    const now = noon(today).getDay();
    const diff = future ? (target - now + 7) % 7 || 7 : -((now - target + 7) % 7 || 7);
    return { date: shift(today, diff), raw: wd[0] };
  }
  const dm = new RegExp(`\\b(?:el )?(\\d{1,2})\\s*(?:de\\s+(${MONTHS.join('|')})|[/-](\\d{1,2})(?![\\d]))`).exec(t);
  if (dm) {
    const day = Number(dm[1]);
    const month = dm[2] ? MONTHS.indexOf(dm[2]) : Number(dm[3]) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const y = noon(today).getFullYear();
      let d = iso(new Date(y, month, day, 12));
      if (future && d < today) d = iso(new Date(y + 1, month, day, 12));
      if (!future && d > today) d = iso(new Date(y - 1, month, day, 12));
      return { date: d, raw: dm[0] };
    }
  }
  const dayOnly = /\bel (\d{1,2})\b(?!\s*(?:lucas?|mil|k|:|hrs?|horas?|am|pm|de la))/.exec(t);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const base = noon(today);
      let d = new Date(base.getFullYear(), base.getMonth(), day, 12);
      if (future && iso(d) < today) d = new Date(base.getFullYear(), base.getMonth() + 1, day, 12);
      if (!future && iso(d) > today) d = new Date(base.getFullYear(), base.getMonth() - 1, day, 12);
      return { date: iso(d), raw: dayOnly[0] };
    }
  }
  return null;
}

/** La hora que dice el texto («a las 10», «10:30», «a las 3 de la tarde», «a mediodía»). */
export function findTime(text: string): { time: string; raw: string } | null {
  const t = fold(text);
  if (/\bmediodia\b/.test(t)) return { time: '12:00', raw: 'mediodia' };
  const m =
    /\b(?:a las?|tipo|como a las)\s*(?<h>\d{1,2})(?:[:.h](?<m>\d{2}))?(?!\d)(?:\s*(?<mark>am|pm|hrs?|horas?)\b)?(?:\s+de la (?<part>manana|tarde|noche))?/.exec(t) ??
    /\b(?<h>\d{1,2})[:.](?<m>\d{2})(?!\d)(?:\s*(?<mark>am|pm|hrs?|horas?)\b)?(?:\s+de la (?<part>manana|tarde|noche))?/.exec(t) ??
    /\b(?<h>\d{1,2})\s*(?<mark>am|pm|hrs?)\b/.exec(t);
  if (!m?.groups) return null;
  let h = Number(m.groups.h);
  const min = m.groups.m ? Number(m.groups.m) : 0;
  const mark = m.groups.mark ?? '';
  const part = m.groups.part ?? '';
  if ((mark === 'pm' || part === 'tarde' || part === 'noche') && h < 12) h += 12;
  if (mark === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { time: `${pad(h)}:${pad(min)}`, raw: m[0] };
}

// ─── Referencias (categorías, cuentas, hábitos) ─────────────────────────────
const CATEGORY_WORDS: [RegExp, string[]][] = [
  [/\b(almuerz|almorc|comida|comi\b|desayun|cena|cene|once|super|feria|pan\b|cafe|restaurant|sushi|pizza|completo|empanada|bebida|colacion|delivery|rappi|pedidosya)/, ['alimentacion', 'comida']],
  [/\b(bencina|copec|shell|petrobras|aramco|combustible|diesel|petroleo|gasolina)/, ['bencina', 'combustible']],
  [/\b(micro|metro|bip|uber|didi|cabify|taxi|colectivo|pasaje|bus\b|peaje|tag\b|estacionamiento|transporte)/, ['transporte']],
  [/\b(arriendo|dividendo|gastos comunes|condominio)/, ['vivienda']],
  [/\b(luz|enel|cge|gas\b|internet|telefono|celular|plan\b|netflix|spotify|disney|youtube|agua potable|aguas andinas)/, ['cuentas', 'servicios']],
  [/\b(farmacia|remedio|medicamento|doctor|medico|dentista|consulta|isapre|fonasa|examen|kine|psicolog|clinica)/, ['salud']],
  [/\b(colegio|universidad|matricula|arancel|curso|libro|cuaderno|utiles)/, ['educacion']],
  [/\b(cine|salida|carrete|copete|cerveza|juego|concierto|entrada|bar\b|pub\b)/, ['entretenimiento']],
  [/\b(ropa|zapatilla|zapato|polera|pantalon|chaqueta|vestido)/, ['ropa']],
  [/\b(veterinari|perro|gato|mascota|panal|guarderia)/, ['familia']],
  [/\b(interes|comision)/, ['intereses']],
  [/\b(sueldo|liquidacion|remuneracion)/, ['sueldo']],
  [/\b(boleta|honorario)/, ['honorarios']],
  [/\b(vendi|venta)/, ['ventas']],
  [/\b(regalo|regalaron|aguinaldo|bono)/, ['regalos']],
];

/** Busca una referencia por su nombre (sin tildes) dentro de un texto; gana el nombre más largo. */
function refByName(refs: Refs, kind: 'category' | 'account' | 'habit' | 'course', text: string, sub?: string): string | null {
  const t = fold(text);
  let best: { key: string; len: number } | null = null;
  for (const [key, r] of Object.entries(refs)) {
    if (r.kind !== kind || (sub && r.sub !== sub)) continue;
    const name = fold(r.name);
    if (name.length >= 3 && t.includes(name) && (!best || name.length > best.len)) best = { key, len: name.length };
  }
  return best?.key ?? null;
}

function categoryFromWords(refs: Refs, text: string, sub: 'expense' | 'income'): string | null {
  const t = fold(text);
  for (const [re, names] of CATEGORY_WORDS) {
    if (!re.test(t)) continue;
    for (const n of names) {
      const key = Object.entries(refs).find(([, r]) => r.kind === 'category' && r.sub === sub && fold(r.name).includes(n))?.[0];
      if (key) return key;
    }
  }
  return null;
}

/** Lo que dicen las lecciones para este texto: la más reciente que calce manda. */
export function lessonHints(text: string, lessons: Lesson[], refs: Refs): { category?: string; account?: string; habit?: string; layer?: string } {
  const t = fold(text);
  const hints: { category?: string; account?: string; habit?: string; layer?: string } = {};
  for (const l of lessons) {
    const phrase = fold(l.phrase);
    if (phrase.length < 3 || !t.includes(phrase)) continue;
    const m = /^(categoria|cuenta|habito|tipo):\s*(.+)$/.exec(fold(l.meaning));
    if (m) {
      if (m[1] === 'categoria') hints.category ??= refByName(refs, 'category', m[2]) ?? undefined;
      if (m[1] === 'cuenta') hints.account ??= refByName(refs, 'account', m[2]) ?? undefined;
      if (m[1] === 'habito') hints.habit ??= refByName(refs, 'habit', m[2]) ?? undefined;
      if (m[1] === 'tipo') hints.layer ??= m[2].trim();
    } else {
      // Regla libre («la Copec es bencina del trabajo»): se busca un nombre conocido en el significado.
      hints.category ??= refByName(refs, 'category', l.meaning) ?? undefined;
      hints.account ??= refByName(refs, 'account', l.meaning) ?? undefined;
      hints.habit ??= refByName(refs, 'habit', l.meaning) ?? undefined;
    }
  }
  return hints;
}

// Palabras que identifican a un hábito además de su nombre.
const HABIT_WORDS: [RegExp, string][] = [
  [/agua/, 'agua|vasos?'],
  [/camin/, 'camine|caminata|caminar'],
  [/leer|lectura/, 'lei|leer|lectura'],
  [/entren|ejercicio|gym/, 'entrene|gym|gimnasio|ejercicio|entrenar'],
  [/orar|medit|oracion/, 'ore|medite|meditar|orar|oracion'],
  [/cigarr|fumar|tabaco/, 'fume|cigarros?|puchos?|fumar'],
  [/energetic/, 'energeticas?|redbull|monster'],
  [/alcohol/, 'alcohol|cervezas?|copete|vino|piscolas?'],
  [/redes/, 'redes|instagram|tiktok'],
  [/chatarra/, 'chatarra|comida rapida|papas fritas'],
  [/dorm|sueno/, 'dormi|dormir|siesta'],
];

function habitIn(text: string, refs: Refs): string | null {
  const t = fold(text);
  for (const [key, r] of Object.entries(refs)) {
    if (r.kind !== 'habit') continue;
    const name = fold(r.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const extra = HABIT_WORDS.find(([re]) => re.test(name))?.[1];
    if (new RegExp(`\\b(${[name, extra].filter(Boolean).join('|')})\\b`).test(t)) return key;
  }
  return null;
}

// ─── Diario ─────────────────────────────────────────────────────────────────
const ACTIVITY_WORDS: [RegExp, string][] = [
  [/\b(ejercicio|entrene|gym|gimnasio|corri|trote|camine|bicicleta)/, 'Ejercicio'],
  [/\b(familia|mama|papa|hij[oa]s?|herman[oa]s?|abuel[oa]s?|esposa|esposo|pareja|polola?)\b/, 'Familia'],
  [/\b(amig[oa]s?|junta)\b/, 'Amigos'],
  [/\b(trabaje|trabajo|pega|oficina|turno)\b/, 'Trabajo'],
  [/\b(estudie|estudio|clases?|prueba|universidad)\b/, 'Estudio'],
  [/\b(lei|leer|libro|lectura)\b/, 'Lectura'],
  [/\b(descanse|dormi|siesta|descanso)\b/, 'Descanso'],
  [/\b(sali|salida|paseo|pasee|carrete)\b/, 'Salir'],
  [/\b(iglesia|ore|oracion|culto|misa)\b/, 'Oración'],
  [/\b(celular|redes|tele|series|netflix|pantalla)\b/, 'Pantallas'],
];

function moodOf(t: string): number | null {
  const score = /\bun (\d{1,2})\b/.exec(t);
  if (score && Number(score[1]) <= 10) {
    const n = Number(score[1]);
    return n <= 3 ? 1 : n <= 5 ? 2 : n <= 7 ? 3 : 4;
  }
  if (/\b(excelente|genial|increible|muy bien|muy buen|espectacular|feliz|bacan|la raja)/.test(t)) return 4;
  if (/\b(mal|malo|dificil|pesimo|triste|horrible|terrible|cansad|agotad|angusti|ansios|estresad)/.test(t)) return 1;
  if (/\b(regular|mas o menos|normal|ahi no mas)/.test(t)) return 2;
  if (/\b(bien|buen|bueno|contento|tranquil)/.test(t)) return 3;
  return null;
}

// ─── Un trozo del mensaje ────────────────────────────────────────────────────
const firstAccount = (refs: Refs) => Object.entries(refs).find(([, r]) => r.kind === 'account')?.[0] ?? null;
const MONEY_VERBS = /\b(gaste|gasto|compre|pague|eche|me costo|costo|salio|invite|almorce|comi|tome)\b/;
const INCOME_VERBS = /\b(me pagaron|me pago|cobre|gane|ingreso|me llego|recibi|vendi|me depositaron|me transfirieron|sueldo)\b/;
const MONEY_DROP = ['gaste', 'gasto', 'compre', 'pague', 'eche', 'costo', 'salio', 'pagaron', 'pago', 'cobre', 'gane', 'llego', 'recibi', 'depositaron', 'transfirieron', 'pesos', 'plata', 'debito', 'credito', 'tarjeta', 'efectivo'];

const COURSE_DAY = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/;
const EVAL_WORD = /\b(prueba|examen|control|certamen|solemne|evaluacion|interrogacion|disertacion|entrega|unidad|test|quiz)\b/;
const EVAL_LABEL: Record<string, string> = { evaluacion: 'Evaluación', interrogacion: 'Interrogación', disertacion: 'Disertación', examen: 'Examen', test: 'Test', quiz: 'Quiz' };
const COURSE_DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const MONTH_WORDS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const hm = (h: string, m?: string) => {
  const hh = Number(h);
  const mm = Number(m ?? 0);
  return hh < 24 && mm < 60 ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : null;
};

/** Nombre, día, horas, hasta cuándo, profesor y si es en grupo de un ramo dicho con palabras. */
export function parseCourse(clause: string, t: string, today: string): Record<string, unknown> | null {
  const nameMatch =
    /(?:llamad[oa]|que se llama|de nombre)\s+(.+?)(?=\s+(?:todos|cada|los|el|la|a las|desde|de \d|hasta|con|,|\(|$))/i.exec(clause) ??
    /(?:ramo|asignatura|c[aá]tedra|materia|curso|clases? de)\s+(?:de\s+)?(.+?)(?=\s+(?:todos|cada|los|el|la|a las|desde|de \d|hasta|con|,|\(|$))/i.exec(clause);
  const name = nameMatch?.[1]?.replace(/^(?:llamad[oa]|de)\s+/i, '').trim();
  if (!name || name.length < 2) return null;
  const day = COURSE_DAY.exec(t);
  const range = /\b(?:de|desde|a las)\s+(\d{1,2})(?::(\d{2}))?\s*(?:hrs?|horas)?\s*(?:a|hasta las?|-)\s*(?:las\s+)?(\d{1,2})(?::(\d{2}))?/.exec(t);
  const single = /\ba las\s+(\d{1,2})(?::(\d{2}))?/.exec(t);
  const start = range ? hm(range[1], range[2]) : single ? hm(single[1], single[2]) : null;
  const end = range ? hm(range[3], range[4]) : null;
  const month = new RegExp(`\\b(?:hasta|en|termina(?:\\s+en)?)\\b[^.]*?\\b(${MONTH_WORDS.join('|')})\\b`).exec(t);
  let until: string | null = null;
  if (month) {
    const m = MONTH_WORDS.indexOf(month[1]);
    const y = Number(today.slice(0, 4)) + (m + 1 < Number(today.slice(5, 7)) ? 1 : 0);
    until = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
  }
  const teacher = /\bprofe(?:sor|sora)?\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ.]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/.exec(clause)?.[1] ?? null;
  const group = /\ben grupo\b|\bgrupal\b/.test(t) ? true : /\bindividual\b/.test(t) ? false : null;
  const evals = /\b(pruebas?|examen(?:es)?|controles?|trabajos?|evaluaciones?|solemnes?)\b/.exec(t)?.[1] ?? null;
  return {
    nombre: cap(name),
    dia_semana: day ? COURSE_DAYS.indexOf(day[1]) + 1 : null,
    hora_inicio: start,
    hora_fin: end,
    hasta: until,
    profesor: teacher,
    en_grupo: group,
    evaluaciones: evals ? cap(evals) : null,
  };
}

/** Lo que falta para completar un ramo: el asistente lo pregunta (usuario, 26-10-2026). */
export function courseQuestions(input: Record<string, unknown>): string | null {
  const ask: string[] = [];
  if (!input.dia_semana) ask.push('¿qué día de la semana es la clase?');
  if (!input.hora_inicio) ask.push('¿a qué hora empieza?');
  else if (!input.hora_fin) ask.push(`¿hasta qué hora dura la clase de las ${input.hora_inicio}?`);
  if (!input.profesor) ask.push('¿quién es el profesor o la profesora?');
  if (!input.evaluaciones) ask.push('¿hay pruebas, controles o trabajos? (con su fecha y porcentaje, si los sabes)');
  if (input.en_grupo === null || input.en_grupo === undefined) ask.push('¿los trabajos son en grupo o individuales?');
  if (!input.hasta) ask.push('¿cuándo termina el semestre o trimestre?');
  if (!ask.length) return null;
  return `Armé el ramo con lo que me dijiste. Para completarlo en Estudios, Calendario y Prioridades me falta saber:\n${ask.map((q) => `• ${q.replace(/^(¿?)(.)/, (_, a: string, b: string) => a + b.toUpperCase())}`).join('\n')}\nToca «Corregir» en la tarjeta para completarlo, o confírmalo así y lo completas después en Estudios.`;
}

function parseClause(clause: string, ctx: Ctx): ToolCall[] {
  const t = fold(clause);
  if (!t) return [];

  // Enseñar una regla: «cuando digo X es Y», «la Copec siempre es bencina».
  const rule =
    /^(?:cuando|si) (?:digo|escribo|pongo|hablo de)\s+(.+?)\s+(?:es|son|significa|quiero decir|me refiero a|va en|va a|corresponde a)\s+(.+)$/.exec(t) ??
    /^(.+?)\s+siempre (?:es|son|va en|va a)\s+(.+)$/.exec(t);
  if (rule) return [{ name: 'recordar', input: { frase: rule[1].replace(/[«»"]/g, '').trim(), significado: rule[2].trim() } }];

  // Gratitud.
  if (/^(?:agradezco|doy gracias|gracias por|estoy agradecid[oa]|agradecid[oa])\b/.test(t)) {
    const body = clause.replace(/^\s*(agradezco|doy gracias|gracias por|estoy agradecid[oa]|agradecid[oa])\s*(por|que|de|a)?\s*/i, '').trim();
    return body ? [{ name: 'agradecer', input: { fecha: /\bayer\b/.test(t) ? shift(ctx.today, -1) : ctx.today, texto: cap(body) } }] : [];
  }

  // Diario.
  if (/^(?:diario:|querido diario|hoy fue|ayer fue|el dia fue|mi dia fue|fue un (?:buen|mal|gran|dia|\d)|me senti|me siento|estuvo|estoy (?:feliz|triste|cansad|contento|bien|mal))/.test(t)) {
    return [
      {
        name: 'escribir_diario',
        input: {
          fecha: /^ayer\b/.test(t) ? shift(ctx.today, -1) : ctx.today,
          animo: moodOf(t),
          texto: clause.replace(/^\s*(diario:|querido diario,?)\s*/i, '').trim(),
          actividades: ACTIVITY_WORDS.filter(([re]) => re.test(t)).map(([, a]) => a),
        },
      },
    ];
  }

  // Crear un hábito: «nuevo hábito leer», «quiero contar los cigarros».
  if (/^(?:nuevo habito|agrega(?:r)? (?:el )?habito|quiero (?:empezar a )?contar|empezar a contar|crea(?:r)? (?:el )?habito)\b/.test(t)) {
    const name = clause.replace(/^\s*(nuevo h[aá]bito|agrega(r)? (el )?h[aá]bito|quiero (empezar a )?contar|empezar a contar|crea(r)? (el )?h[aá]bito)\s*:?\s*/i, '');
    const reduce = /\b(dejar de|bajar|menos|reducir)\b/.test(fold(name));
    const target = /\b(\d{1,2})\b/.exec(name);
    const clean = rest(name, [target?.[0]], ['dejar', 'bajar', 'menos', 'reducir', 'veces', 'diarias', 'dia', 'al']);
    return clean ? [{ name: 'crear_habito', input: { nombre: cap(clean), tipo: reduce ? 'reducir' : 'bueno', meta_diaria: target ? Number(target[1]) : 1 } }] : [];
  }

  // Ramo o curso (26-10-2026, prueba del usuario): «tengo un ramo llamado Ingeniería económica
  // todos los jueves a las 10:00 hasta que termine el trimestre en diciembre».
  if (/\b(?:ramo|asignatura|catedra|materia|curso|clases? de)\b/.test(t) && COURSE_DAY.test(t)) {
    const input = parseCourse(clause, t, ctx.today);
    if (input) return [{ name: 'crear_ramo', input }];
  }

  // Prueba, control, entrega o unidad de un ramo que ya está en Estudios (27-10-2026, prueba del
  // usuario: «3 de noviembre prueba de inglés», «el 10 de noviembre se cierra la unidad 5»): va al
  // ramo (y al Calendario), no como evento suelto. Sin el ramo, sigue como evento de Estudios.
  if (EVAL_WORD.test(t)) {
    const course = refByName(ctx.refs, 'course', clause);
    const due = findDate(clause, ctx.today, true);
    if (course && due) {
      const unit = /\bunidad\s+(\d{1,2})\b/.exec(t);
      const kind = /\b(prueba|examen|control|certamen|solemne|evaluacion|interrogacion|disertacion|entrega|test|quiz)\b(?:\s+(?:n(?:umero|o)?\.?\s*)?(\d{1,2})\b)?/.exec(t);
      const label = kind ? `${EVAL_LABEL[kind[1]] ?? cap(kind[1])}${kind[2] ? ` ${kind[2]}` : ''}` : 'Prueba';
      const title = unit ? `${/\b(cierr|cerrad|cerrar)/.test(t) ? 'Cierre unidad' : 'Unidad'} ${unit[1]}` : label;
      const pct = /(\d{1,3})\s*%/.exec(t);
      return [{ name: 'crear_evaluacion', input: { ramo: course, titulo: title, fecha: due.date, porcentaje: pct ? Number(pct[1]) : null } }];
    }
  }

  // Tarea: «tarea pagar la luz», «tengo que…», «hay que…», «recuérdame…».
  if (/^(?:tarea:?|tengo que|hay que|debo|no olvidar|no olvides|no me olvide de|recordar|recuerdame|pendiente:?|anota:?)\s/.test(t)) {
    const body = clause.replace(/^\s*(tarea:?|tengo que|hay que|debo|no olvidar|no olvides|no me olvide de|recordar|recu[eé]rdame|pendiente:?|anota:?)\s+/i, '');
    const date = findDate(body, ctx.today, true);
    const time = date ? findTime(body) : null;
    const title = rest(body, [date?.raw, time?.raw], ['urgente', 'hrs', ...COMMAND_WORDS]);
    return title ? [{ name: 'crear_tarea', input: { titulo: cap(title), fecha: date?.date ?? null, hora: time?.time ?? null, urgente: /\burgente\b/.test(t) } }] : [];
  }

  const amount = findAmount(clause);
  const hints = lessonHints(clause, ctx.lessons, ctx.refs);
  const moneyIsh = !!amount && (amount.amount >= 100 || /\$|luca|mil|palo|gamba/.test(amount.raw));

  // Hábitos: «+1 agua», «tomé 3 vasos de agua», «fumé 2», «leí».
  const habit = hints.habit ?? habitIn(clause, ctx.refs);
  if (habit && !moneyIsh) {
    const plus = /^\+\s*(\d{1,2})/.exec(t);
    const near = /\b(\d{1,2})\b/.exec(t);
    const times = plus ? Number(plus[1]) : near && !/a las|el \d/.test(t) ? Number(near[1]) : 1;
    const date = findDate(clause, ctx.today, false);
    return [{ name: 'marcar_habito', input: { habito: habit, veces: Math.max(1, Math.min(50, times)), fecha: date?.date ?? ctx.today } }];
  }

  // Eventos: con hora, o con una palabra de cita y una fecha.
  const time = findTime(clause);
  const eventWord = /\b(cita|reunion|dentista|medico|doctor|control|cumpleanos|cumple|clase|prueba|certamen|entrevista|evento|junta|hora con|hora al|hora en|turno|matrimonio|asado|vuelo|viaje)\b/.test(t);
  const when = findDate(clause, ctx.today, true);
  if (!moneyIsh && (time || (eventWord && when))) {
    const remind = /\b(?:avisame|recuerdame|aviso|avisar)\b(?:\s+(?:con\s+)?(media|una?|\d+)\s*(minutos?|min|horas?|dias?)\s+antes)?/.exec(t);
    let remindMinutes: number | null = null;
    if (remind) {
      const n = remind[1] === 'media' ? 0.5 : remind[1] === 'un' || remind[1] === 'una' ? 1 : Number(remind[1] ?? 0);
      const unit = remind[2] ?? '';
      remindMinutes = remind[1] ? Math.round(n * (unit.startsWith('h') ? 60 : unit.startsWith('d') ? 1440 : 1)) : 0;
    }
    const repeat = /\b(todos los (?:lunes|martes|miercoles|jueves|viernes|sabados|domingos)|cada semana|semanal)/.test(t)
      ? 'semanal'
      : /\b(cada mes|todos los meses|mensual)/.test(t)
        ? 'mensual'
        : /\b(cada ano|anual|cumpleanos|cumple)\b/.test(t)
          ? 'anual'
          : 'no';
    const layer =
      hints.layer ??
      (/\b(dentista|medico|doctor|control|examen|kine|psicolog|terapia|vacuna|clinica|hospital)/.test(t)
        ? 'salud'
        : /\b(reunion|trabajo|oficina|cliente|junta|turno|jefe)/.test(t)
          ? 'trabajo'
          : /\b(clase|prueba|certamen|universidad|colegio)/.test(t)
            ? 'estudios'
            : /\b(cumpleanos|cumple|mama|papa|hij[oa]|familia|abuel)/.test(t)
              ? 'familia'
              : /\b(pagar|pago|cuota|vence|vencimiento)/.test(t)
                ? 'pagos'
                : 'personal');
    // El título es lo que queda antes de «avísame…» sin la fecha ni la hora.
    const before = remind ? clause.slice(0, Math.max(0, fold(clause).indexOf(remind[0]))) || clause : clause;
    const title = rest(before, [when?.raw, time?.raw], ['tengo', 'hay', 'hrs', 'am', 'pm', 'todos', 'cada', 'semanal', 'mensual', 'anual', ...COMMAND_WORDS]);
    return [
      {
        name: 'crear_evento',
        input: { titulo: cap(title || 'Evento'), fecha: when?.date ?? ctx.today, hora_inicio: time?.time ?? null, hora_fin: null, tipo: layer, repetir: repeat, aviso_minutos: remindMinutes, lugar: null },
      },
    ];
  }

  // Plata: gasto o ingreso.
  if (amount && (moneyIsh || MONEY_VERBS.test(t) || INCOME_VERBS.test(t))) {
    const income = INCOME_VERBS.test(t);
    const sub = income ? 'income' : 'expense';
    const date = findDate(clause, ctx.today, false);
    const category =
      (hints.category && ctx.refs[hints.category]?.sub === sub ? hints.category : null) ?? refByName(ctx.refs, 'category', clause, sub) ?? categoryFromWords(ctx.refs, clause, sub);
    const account = hints.account ?? refByName(ctx.refs, 'account', clause) ?? firstAccount(ctx.refs);
    const description = rest(clause, [amount.raw, date?.raw], MONEY_DROP);
    return [{ name: 'registrar_movimiento', input: { tipo: income ? 'ingreso' : 'gasto', monto: amount.amount, fecha: date?.date ?? ctx.today, categoria: category, cuenta: account, descripcion: description || null } }];
  }

  // Algo para hacer con fecha y sin otra pista (27-10-2026: «trotar 5 km hoy» no se entendía): una
  // tarea de ese día.
  const due = findDate(clause, ctx.today, true);
  if (due && !amount) {
    const title = rest(clause, [due.raw], COMMAND_WORDS);
    if (title.length >= 3) return [{ name: 'crear_tarea', input: { titulo: cap(title), fecha: due.date, hora: null, urgente: false } }];
  }
  return [];
}

// ─── Preguntas ───────────────────────────────────────────────────────────────
// «cuando» solo con signo de pregunta: «cuando digo X es Y» enseña una regla.
const isQuestion = (text: string) => /\?\s*$/.test(text) || /^(cuanto|cuantos|cuantas|que tengo|que hay|como voy|como van|tengo algo)\b/.test(fold(text));

function answer(text: string, ctx: Ctx, data: IntentData): string | null {
  const t = fold(text);
  const today = ctx.today;
  if (/\b(gast|llevo gastado|he gastado)/.test(t)) {
    let [from, to, label] = [today.slice(0, 8) + '01', today, 'este mes'];
    if (/\bhoy\b/.test(t)) [from, to, label] = [today, today, 'hoy'];
    else if (/\bayer\b/.test(t)) [from, to, label] = [shift(today, -1), shift(today, -1), 'ayer'];
    else if (/\bsemana\b/.test(t)) [from, to, label] = [shift(today, -6), today, 'en los últimos 7 días'];
    const catKey = refByName(ctx.refs, 'category', text, 'expense') ?? categoryFromWords(ctx.refs, text, 'expense');
    const cat = catKey ? ctx.refs[catKey].name : null;
    const list = data.movements.filter((m) => m.kind === 'expense' && m.date >= from && m.date <= to && (!cat || m.category === cat));
    const total = list.reduce((s, m) => s + m.amount, 0);
    return `${cap(label)} llevas ${formatCLP(total)} en gastos${cat ? ` de ${cat}` : ''} (${list.length} ${list.length === 1 ? 'movimiento' : 'movimientos'}).`;
  }
  if (/\b(tengo|hay|agenda)\b/.test(t)) {
    let [from, to, label] = [today, today, 'Hoy'];
    if (/(?<!de la |en la )\bmanana\b/.test(t)) [from, to, label] = [shift(today, 1), shift(today, 1), 'Mañana'];
    else if (/\bsemana\b/.test(t)) [from, to, label] = [today, shift(today, 7), 'Esta semana'];
    else {
      const d = findDate(text, today, true);
      if (d && d.date !== today) [from, to, label] = [d.date, d.date, `El ${d.date.slice(8)}-${d.date.slice(5, 7)}`];
    }
    const list = data.agenda.filter((a) => a.date >= from && a.date <= to);
    if (!list.length) return `${label} no tienes nada agendado.`;
    const line = (a: IntentData['agenda'][number]) => `• ${from !== to ? `${a.date.slice(8)}-${a.date.slice(5, 7)} ` : ''}${a.time ? `${a.time} ` : ''}${a.title}${a.kind === 'tarea' ? ' (tarea)' : ''}`;
    return `${label}:\n${list.map(line).join('\n')}`;
  }
  if (/\bhabito/.test(t)) {
    if (!data.habits.length) return 'Todavía no cuentas hábitos. Elígelos en Hábitos.';
    return `Hoy:\n${data.habits.map((h) => `• ${h.name}: ${h.reduce ? `${h.count}` : `${h.count} de ${h.target}${h.count >= h.target ? ' ✓' : ''}`}`).join('\n')}`;
  }
  if (/\b(pago|sueldo|me pagan)\b/.test(t)) {
    if (data.paydayDays === null) return 'No tienes un día de pago fijo. Puedes definirlo en Finanzas.';
    return data.paydayDays === 0 ? 'Hoy es tu día de pago.' : `Faltan ${data.paydayDays} ${data.paydayDays === 1 ? 'día' : 'días'} para tu pago.`;
  }
  return null;
}

export const HELP = [
  'No te entendí. Toca «Anotarlo con opciones» y te pregunto paso a paso, o escribe frases como:',
  '• «gasté 5 lucas en el almuerzo» o «me pagaron 800 mil»',
  '• «+1 agua» o «fumé 2»',
  '• «dentista mañana a las 10, avísame una hora antes»',
  '• «tarea pagar la luz el viernes»',
  '• «hoy fue un buen día, salí con mi familia»',
  '• «agradezco el almuerzo con mi mamá»',
  '• «tengo el ramo Cálculo los martes de 20:30 a 22:00»',
  '• «¿cuánto gasté este mes?» o «¿qué tengo mañana?»',
  'Y si me enseñas («cuando digo la Copec es bencina»), lo aprendo.',
].join('\n');

const WHOLE = new Set(['crear_evento', 'escribir_diario', 'recordar', 'agradecer', 'crear_tarea', 'crear_ramo', 'crear_evaluacion']);

/** Interpreta un mensaje. Puede traer varias acciones («almorcé 6 lucas y tomé 2 vasos de agua»). */
export function parseMessage(text: string, ctx: Ctx, data: IntentData): LocalResult {
  if (isQuestion(text)) {
    return { reply: answer(text, ctx, data) ?? 'Todavía no sé responder eso sin IA. Puedo decirte cuánto gastaste, qué tienes en la agenda, cómo vas con tus hábitos y cuánto falta para tu pago.', calls: [] };
  }
  // Los eventos, las tareas, el diario, la gratitud y las reglas van enteros (sus comas son parte
  // de lo que se dice). Lo demás se separa por «y», comas y puntos.
  const whole = parseClause(text, ctx);
  if (whole[0]?.name === 'crear_ramo') return { reply: courseQuestions(whole[0].input), calls: whole };
  if (whole.length && (WHOLE.has(whole[0].name) || !/\s+y\s+|[,;]|\.\s/.test(text))) return { reply: null, calls: whole };
  const calls: ToolCall[] = [];
  let carry = '';
  for (const part of text.split(/\s+y\s+|[,;]|\.\s+/).map((p) => p.trim()).filter(Boolean)) {
    const found = parseClause(carry ? `${carry} ${part}` : part, ctx);
    if (found.length) {
      calls.push(...found);
      carry = '';
    } else {
      carry = carry ? `${carry} ${part}` : part;
    }
  }
  if (calls.length) return { reply: null, calls };
  return whole.length ? { reply: null, calls: whole } : { reply: HELP, calls: [] };
}

/** Las reglas que deja una corrección en el modo sin IA: lo que el usuario cambió, ligado a la
 *  palabra clave de su mensaje (la descripción, o lo que escribió sin montos ni fechas). */
export function correctionRules(userText: string, before: Record<string, unknown>, after: Record<string, unknown>, refs: Refs): Lesson[] {
  const source = (after.description as string | null) ?? (before.description as string | null) ?? rest(userText, [findAmount(userText)?.raw, findDate(userText, '2000-01-01', false)?.raw], MONEY_DROP);
  const key = fold(source).split(' ').filter((w) => !STOP.has(w)).slice(0, 3).join(' ');
  if (key.length < 3) return [];
  const name = (k: unknown) => (typeof k === 'string' && refs[k] ? refs[k].name : null);
  const rules: Lesson[] = [];
  if (after.tool === 'registrar_movimiento') {
    if (after.category !== before.category && name(after.category)) rules.push({ kind: 'rule', phrase: key, meaning: `Categoría: ${name(after.category)}` });
    if (after.account !== before.account && name(after.account)) rules.push({ kind: 'rule', phrase: key, meaning: `Cuenta: ${name(after.account)}` });
  }
  if (after.tool === 'marcar_habito' && after.habit !== before.habit && name(after.habit)) rules.push({ kind: 'rule', phrase: key, meaning: `Hábito: ${name(after.habit)}` });
  if (after.tool === 'crear_evento' && after.layer !== before.layer) rules.push({ kind: 'rule', phrase: key, meaning: `Tipo: ${String(after.layer)}` });
  return rules;
}
