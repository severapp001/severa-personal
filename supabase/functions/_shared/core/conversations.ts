// Copiado de src/core/conversations.ts por scripts/bot-core.js. No editar aquí.
// Lo que se conversa con Severa (Z3, 29-10-2026; usuario: «¿podemos tener al chatbot de Telegram en
// Severa? Ver ahí qué se registró»). Cada frase que se le dice al asistente de la app o al bot, lo que
// entendió y en qué quedó, en el motor común (módulo «asistente», tipo «conversacion»), así viaja con
// la cuenta. Sirve hoy para ver lo anotado por Telegram y enseñarle lo que no entendió, y mañana como
// memoria del asistente con IA. Lo usan la app y las funciones `telegram` y `correo` (bot-core.js).

export const CONV_MODULE = 'asistente';
export const CONV_KIND = 'conversacion';

export type Channel = 'telegram' | 'app' | 'correo';
export type ConvState = 'propuesto' | 'guardado' | 'corregido' | 'cancelado' | 'sin_responder' | 'respondido' | 'no_entendido' | 'idea' | 'error';
/** `id` une la frase con sus tarjetas (el código del botón en Telegram, la conversación en la app). */
export type ConvData = { canal: Channel; estado: ConvState; id?: string; lineas?: string[]; resultados?: Record<string, ConvState>; at?: string };

export const STATE_LABEL: Record<ConvState, string> = {
  propuesto: 'Esperando que lo confirmes',
  guardado: 'Guardado',
  corregido: 'Guardado con tu corrección',
  cancelado: 'Cancelado',
  sin_responder: 'Quedó sin responder',
  respondido: 'Te respondió',
  no_entendido: 'No lo entendió',
  idea: 'Idea guardada',
  error: 'No se pudo guardar',
};

const CHANNELS: Channel[] = ['telegram', 'app', 'correo'];
const STATES = Object.keys(STATE_LABEL) as ConvState[];

/** Los datos de un registro, con valores seguros aunque vengan incompletos. */
export function convOf(data: Record<string, unknown>): ConvData {
  const canal = CHANNELS.includes(data.canal as Channel) ? (data.canal as Channel) : 'app';
  const estado = STATES.includes(data.estado as ConvState) ? (data.estado as ConvState) : 'respondido';
  const lineas = Array.isArray(data.lineas) ? data.lineas.filter((l): l is string => typeof l === 'string') : undefined;
  const resultados = data.resultados && typeof data.resultados === 'object' ? (data.resultados as Record<string, ConvState>) : undefined;
  return { canal, estado, id: typeof data.id === 'string' ? data.id : undefined, lineas, resultados, at: typeof data.at === 'string' ? data.at : undefined };
}

/** En qué queda una frase recién leída: propuso algo, respondió una pregunta o no la entendió. */
export function firstState(proposals: number, reply: string | null | undefined, help: string): ConvState {
  if (proposals > 0) return 'propuesto';
  return !reply || reply.trim() === help.trim() ? 'no_entendido' : 'respondido';
}

/** Suma lo que pasó con una de las tarjetas de la frase. Queda guardada si se guardó alguna. */
export function withResult(data: ConvData, key: string, state: ConvState): ConvData {
  const resultados = { ...(data.resultados ?? {}), [key]: state };
  const all = Object.values(resultados);
  const total = Math.max(data.lineas?.length ?? 0, all.length);
  const estado: ConvState = all.includes('corregido') ? 'corregido' : all.includes('guardado') ? 'guardado' : all.length < total ? 'propuesto' : all.includes('error') ? 'error' : all.includes('cancelado') ? 'cancelado' : 'sin_responder';
  return { ...data, resultados, estado };
}

export type ConvFilter = 'todo' | 'telegram' | 'app' | 'no_entendido';

/** Lo que se muestra con cada filtro de «Lo que conversamos». */
export function filterConvs<T extends { data: Record<string, unknown> }>(rows: T[], filter: ConvFilter): T[] {
  if (filter === 'todo') return rows;
  if (filter === 'no_entendido') return rows.filter((r) => convOf(r.data).estado === 'no_entendido');
  return rows.filter((r) => {
    const canal = convOf(r.data).canal;
    return filter === 'telegram' ? canal === 'telegram' || canal === 'correo' : canal === 'app';
  });
}
