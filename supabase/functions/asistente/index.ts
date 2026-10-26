// Asistente de Severa (decisión del 25-10-2026). Recibe la conversación desde la app, le pregunta a
// Claude y devuelve su respuesta. No guarda nada ni ejecuta acciones: las herramientas son
// propuestas que la app muestra como tarjetas y ejecuta solo si el usuario confirma.
// La clave de Anthropic vive aquí (secreto ANTHROPIC_API_KEY), nunca en el teléfono.
// Solo responde a las cuentas de ASSISTANT_ALLOWED_USERS (ids separados por coma): Severa es un
// proyecto personal y cada mensaje cuesta.
import Anthropic from 'npm:@anthropic-ai/sdk@0.134.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const MODEL = 'claude-opus-5-5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Fijo para todas las conversaciones: va primero para que la API lo reutilice (caché).
const INSTRUCTIONS = `Eres Severa, el asistente dentro de Severa Personal, la app personal de una sola persona en Chile. Te escribe como habla, con chilenismos: «luca» es mil pesos, «lucas» son miles, «gamba» son cien, «palo» es un millón.

Tu trabajo es convertir lo que escribe en acciones de la app con las herramientas. Cada herramienta es una propuesta: la app muestra una tarjeta y la persona confirma, corrige o cancela. Nada se guarda sin su confirmación, así que cuando el mensaje es claro, propón directo, sin pedir permiso en texto.

- Un mensaje puede traer varias acciones («almorcé 6 lucas y tomé 2 vasos de agua»): propón una herramienta por cada una en la misma respuesta.
- Si falta un dato imprescindible, como el monto, pregunta en una frase corta. Si falta algo secundario, como la cuenta o la categoría, elige lo más probable según el contexto y las lecciones.
- Montos en pesos chilenos, enteros. Fechas en AAAA-MM-DD; calcula «ayer», «el lunes» o «anoche» desde la fecha del contexto.
- Usa solo las referencias de la lista del contexto (c1, a1, h1…). Si ninguna calza, usa null.
- Las lecciones del contexto son correcciones y reglas que la persona te dio: síguelas siempre, mandan sobre tu intuición. Si un resultado dice que la persona corrigió tu propuesta, aplica esa corrección en el resto de la conversación.
- Cuando la persona te enseñe una expresión o una regla («cuando digo X es Y», «la Copec siempre es bencina del trabajo»), propón la herramienta recordar.
- Puedes responder preguntas con los datos del contexto (resumen del mes, últimos movimientos, hábitos de hoy, la agenda de la semana). Si el dato no está, dilo; no inventes cifras.
- Puedes registrar gastos e ingresos, contar y crear hábitos, recordar reglas, y agendar: eventos con fecha y hora («dentista mañana a las 10») y tareas («pagar la luz el viernes»; sin fecha si no la dice). Un evento es algo que pasa a una hora o un día; una tarea es algo que la persona tiene que hacer.
- Los avisos de los eventos se guardan, pero el teléfono todavía no los hace sonar: si te piden un recordatorio, crea el evento con su aviso y dilo en una frase.
- También escribes en el diario («hoy fue un buen día, salí con mi familia»: ánimo de 1 a 4 y actividades) y anotas lo que la persona agradece. Lo que cuenta de su día va al diario con sus palabras; no lo resumas de más.
- La Biblia se lee en su pantalla; la salud y el ejercicio todavía no están en la app: si te piden eso, dilo en una frase y cuenta que viene pronto.
- Responde breve, en español de Chile, cálido y directo. Cuando propones acciones, no repitas en texto lo que ya muestra la tarjeta: basta una frase corta o nada. Nunca muestres las referencias (c1, a1, h1) en tus respuestas.`;

const nullable = (type: 'string' | 'integer', description: string) => ({ type: [type, 'null'], description });

const TOOLS = [
  {
    name: 'registrar_movimiento',
    description: 'Propone registrar un gasto o un ingreso en Finanzas.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['tipo', 'monto', 'fecha', 'categoria', 'cuenta', 'descripcion'],
      properties: {
        tipo: { type: 'string', enum: ['gasto', 'ingreso'] },
        monto: { type: 'integer', description: 'Pesos chilenos, entero y mayor que cero.' },
        fecha: { type: 'string', description: 'AAAA-MM-DD.' },
        categoria: nullable('string', 'Referencia de categoría (cN) del mismo tipo, o null.'),
        cuenta: nullable('string', 'Referencia de cuenta (aN). Si no la menciona, la de siempre; null si no hay cuentas.'),
        descripcion: nullable('string', 'Breve y con sus palabras: «almuerzo», «Copec».'),
      },
    },
  },
  {
    name: 'marcar_habito',
    description: 'Propone sumar al conteo de un hábito que la persona ya cuenta.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['habito', 'veces', 'fecha'],
      properties: {
        habito: { type: 'string', description: 'Referencia del hábito (hN).' },
        veces: { type: 'integer', description: 'Cuántas veces o unidades (vasos, cigarros). Mínimo 1.' },
        fecha: { type: 'string', description: 'AAAA-MM-DD.' },
      },
    },
  },
  {
    name: 'crear_habito',
    description: 'Propone empezar a contar un hábito nuevo, cuando no está en su lista.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['nombre', 'tipo', 'meta_diaria'],
      properties: {
        nombre: { type: 'string', description: 'Corto: «Leer», «Fumar», «Caminar».' },
        tipo: { type: 'string', enum: ['bueno', 'reducir'] },
        meta_diaria: { type: 'integer', description: 'Veces al día para un hábito bueno; 1 si es por reducir.' },
      },
    },
  },
  {
    name: 'crear_evento',
    description: 'Propone agregar un evento al calendario: algo que pasa un día, con o sin hora.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['titulo', 'fecha', 'hora_inicio', 'hora_fin', 'tipo', 'repetir', 'aviso_minutos', 'lugar'],
      properties: {
        titulo: { type: 'string', description: 'Corto: «Dentista», «Reunión con Pedro».' },
        fecha: { type: 'string', description: 'AAAA-MM-DD.' },
        hora_inicio: nullable('string', 'HH:MM en 24 horas, o null si es de todo el día.'),
        hora_fin: nullable('string', 'HH:MM, o null si no la dice.'),
        tipo: { type: 'string', enum: ['personal', 'trabajo', 'salud', 'estudios', 'familia', 'pagos', 'otro'] },
        repetir: { type: 'string', enum: ['no', 'semanal', 'mensual', 'anual'] },
        aviso_minutos: nullable('integer', 'Minutos antes para avisar (0 = a la hora), o null si no pide aviso.'),
        lugar: nullable('string', 'Dónde, si lo dice.'),
      },
    },
  },
  {
    name: 'crear_tarea',
    description: 'Propone una tarea: algo que la persona tiene que hacer, con o sin fecha.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['titulo', 'fecha', 'hora', 'urgente'],
      properties: {
        titulo: { type: 'string', description: 'Lo que tiene que hacer: «Pagar la luz».' },
        fecha: nullable('string', 'AAAA-MM-DD, o null si no dice cuándo.'),
        hora: nullable('string', 'HH:MM, o null.'),
        urgente: { type: 'boolean' },
      },
    },
  },
  {
    name: 'escribir_diario',
    description: 'Propone guardar en el diario cómo estuvo un día: ánimo, actividades y lo que pasó.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['fecha', 'animo', 'texto', 'actividades'],
      properties: {
        fecha: { type: 'string', description: 'AAAA-MM-DD.' },
        animo: nullable('integer', '1 difícil, 2 regular, 3 bien, 4 muy bien; null si no se sabe.'),
        texto: nullable('string', 'Lo que pasó, con sus palabras.'),
        actividades: { type: 'array', items: { type: 'string' }, description: 'Cortas: Ejercicio, Familia, Trabajo, Lectura…' },
      },
    },
  },
  {
    name: 'agradecer',
    description: 'Propone anotar algo que la persona agradece.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['fecha', 'texto'],
      properties: {
        fecha: { type: 'string', description: 'AAAA-MM-DD.' },
        texto: { type: 'string', description: 'Lo que agradece, breve.' },
      },
    },
  },
  {
    name: 'recordar',
    description: 'Propone guardar una regla o expresión que la persona te enseñó, para usarla siempre.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['frase', 'significado'],
      properties: {
        frase: { type: 'string', description: 'La expresión o situación, con sus palabras.' },
        significado: { type: 'string', description: 'Qué significa o qué hacer cuando aparece.' },
      },
    },
  },
];

const allowed = (Deno.env.get('ASSISTANT_ALLOWED_USERS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);

  // ¿Quién pregunta? (la sesión de Supabase de la app)
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
  const { data: auth } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
  if (!auth.user) return json({ error: 'Inicia sesión para usar el asistente.' }, 401);
  if (!allowed.includes(auth.user.id)) return json({ error: 'El asistente no está habilitado para esta cuenta.' }, 403);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Falta la clave de Anthropic en Supabase (secreto ANTHROPIC_API_KEY).' }, 503);

  let body: { context?: unknown; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }
  const { context, messages } = body;
  if (typeof context !== 'string' || context.length > 40_000 || !Array.isArray(messages) || !messages.length || messages.length > 60) {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  const anthropic = new Anthropic({ apiKey });
  try {
    // Opus 5.5 siempre razona; con esfuerzo bajo responde rápido y gasta poco. Si un filtro de
    // seguridad rechaza el pedido, la API reintenta sola con otro modelo (fallbacks).
    // Al publicar instrucciones o herramientas nuevas, el razonamiento guardado en una conversación
    // ya empezada deja de calzar: con drop_block la API lo descarta en vez de responder un error.
    const params = {
      model: MODEL,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: INSTRUCTIONS },
        { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
      ],
      tools: TOOLS,
      messages,
    };
    const response = await anthropic.beta.messages.create(params as unknown as Parameters<typeof anthropic.beta.messages.create>[0]);
    const usage = response.usage as unknown as Record<string, unknown>;
    console.log('asistente', response.model, response.stop_reason, JSON.stringify({ in: usage.input_tokens, out: usage.output_tokens, cache: usage.cache_read_input_tokens }));
    return json({ content: response.content, stop_reason: response.stop_reason, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'La clave de Anthropic no es válida.' }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Demasiados mensajes seguidos. Espera un momento.' }, 429);
    if (e instanceof Anthropic.APIError) {
      console.error('asistente', e.status, e.message);
      return json({ error: 'La IA no pudo responder.', detail: e.message }, 502);
    }
    console.error('asistente', e);
    return json({ error: 'No se pudo conectar con la IA.' }, 502);
  }
});
