// Tests de Salud mental (usuario, 27-10-2026: «agregar todos los que sean posibles, certificados y de
// fuentes confiables»; «soy TDAH y necesito una app que me ayude a entender»). Solo cuestionarios
// validados y de uso libre, con su puntaje y sus cortes publicados. ORIENTAN, NO DIAGNOSTICAN: lo
// dice cada resultado. Las preguntas son la traducción de Severa, fiel al original.
//
// Fuentes:
// - ASRS v1.1 (Adult ADHD Self-Report Scale): OMS y Universidad de Harvard (Kessler y cols., 2005).
//   La parte A (6 preguntas) es el tamizaje; 4 o más respuestas en la zona marcada sugiere TDAH.
// - PHQ-9: Kroenke, Spitzer y Williams (2001), Pfizer; uso libre. Cortes 5, 10, 15 y 20.
// - GAD-7: Spitzer, Kroenke, Williams y Löwe (2006), Pfizer; uso libre. Cortes 5, 10 y 15.
// - WHO-5 (Índice de bienestar): OMS, Centro Psiquiátrico del Norte de Selandia; uso libre. 0 a 100;
//   50 o menos sugiere bajo bienestar (vale la pena revisar el ánimo).
// - PSS-10 (Escala de estrés percibido): Cohen, Kamarck y Mermelstein (1983); uso libre sin fines
//   comerciales. 0–13 bajo, 14–26 moderado, 27–40 alto.
// - AUDIT-C: las 3 primeras preguntas del AUDIT de la OMS (Bush y cols., 1998). 4 o más (3 en
//   mujeres) sugiere consumo de riesgo.

export type Choice = { label: string; value: number };
export type Question = { text: string; choices?: Choice[] };
export type Band = { from: number; label: string; tone: 'ok' | 'mid' | 'bad'; text: string };
export type TestDef = {
  code: string;
  name: string;
  about: string;
  /** Período por el que se pregunta. */
  period: string;
  minutes: number;
  source: string;
  choices: Choice[];
  questions: Question[];
  max: number;
};
export type TestResult = { score: number; max: number; band: Band; detail: string[]; crisis: boolean };

const FREQ5: Choice[] = [
  { label: 'Nunca', value: 0 },
  { label: 'Rara vez', value: 1 },
  { label: 'A veces', value: 2 },
  { label: 'A menudo', value: 3 },
  { label: 'Muy a menudo', value: 4 },
];
const DAYS4: Choice[] = [
  { label: 'Ningún día', value: 0 },
  { label: 'Varios días', value: 1 },
  { label: 'Más de la mitad de los días', value: 2 },
  { label: 'Casi todos los días', value: 3 },
];
const WHO5: Choice[] = [
  { label: 'Todo el tiempo', value: 5 },
  { label: 'La mayor parte del tiempo', value: 4 },
  { label: 'Más de la mitad del tiempo', value: 3 },
  { label: 'Menos de la mitad del tiempo', value: 2 },
  { label: 'De vez en cuando', value: 1 },
  { label: 'Nunca', value: 0 },
];
const PSS: Choice[] = [
  { label: 'Nunca', value: 0 },
  { label: 'Casi nunca', value: 1 },
  { label: 'De vez en cuando', value: 2 },
  { label: 'A menudo', value: 3 },
  { label: 'Muy a menudo', value: 4 },
];

export const TESTS: Record<string, TestDef> = {
  asrs: {
    code: 'asrs',
    name: 'TDAH en adultos (ASRS v1.1)',
    about: 'Cómo han sido tu atención, tu organización y tu inquietud. Las 6 primeras preguntas son el tamizaje; las otras 12 dan más detalle.',
    period: 'los últimos 6 meses',
    minutes: 5,
    source: 'OMS y Universidad de Harvard (Kessler y cols., 2005)',
    choices: FREQ5,
    max: 72,
    questions: [
      { text: '¿Con qué frecuencia te cuesta terminar los detalles finales de un proyecto, una vez hecho lo difícil?' },
      { text: '¿Con qué frecuencia te cuesta ordenar las cosas cuando una tarea requiere organización?' },
      { text: '¿Con qué frecuencia te cuesta recordar citas u obligaciones?' },
      { text: 'Cuando una tarea requiere pensar mucho, ¿con qué frecuencia evitas o postergas empezarla?' },
      { text: '¿Con qué frecuencia mueves inquieto las manos o los pies cuando tienes que estar sentado mucho rato?' },
      { text: '¿Con qué frecuencia te sientes demasiado activo y con la necesidad de hacer cosas, como si te moviera un motor?' },
      { text: '¿Con qué frecuencia cometes errores por descuido en un proyecto aburrido o difícil?' },
      { text: '¿Con qué frecuencia te cuesta mantener la atención en un trabajo aburrido o repetitivo?' },
      { text: '¿Con qué frecuencia te cuesta concentrarte en lo que te dicen, incluso cuando te hablan directamente?' },
      { text: '¿Con qué frecuencia pierdes cosas o te cuesta encontrarlas en la casa o en el trabajo?' },
      { text: '¿Con qué frecuencia te distraen la actividad o el ruido a tu alrededor?' },
      { text: '¿Con qué frecuencia te levantas de tu asiento en reuniones u otras situaciones en que se espera que sigas sentado?' },
      { text: '¿Con qué frecuencia te sientes inquieto o intranquilo?' },
      { text: '¿Con qué frecuencia te cuesta desconectarte y relajarte cuando tienes tiempo para ti?' },
      { text: '¿Con qué frecuencia hablas demasiado en reuniones sociales?' },
      { text: 'En una conversación, ¿con qué frecuencia terminas las frases de los demás antes de que ellos las terminen?' },
      { text: '¿Con qué frecuencia te cuesta esperar tu turno cuando hay que hacerlo?' },
      { text: '¿Con qué frecuencia interrumpes a otros cuando están ocupados?' },
    ],
  },
  phq9: {
    code: 'phq9',
    name: 'Ánimo (PHQ-9)',
    about: 'Señales de depresión. Sirve para repetirlo cada 2 a 4 semanas y ver cómo vas.',
    period: 'las últimas 2 semanas',
    minutes: 3,
    source: 'Kroenke, Spitzer y Williams (2001); de uso libre',
    choices: DAYS4,
    max: 27,
    questions: [
      { text: 'Poco interés o placer en hacer las cosas' },
      { text: 'Sentirte decaído, deprimido o sin esperanza' },
      { text: 'Dificultad para dormir o mantener el sueño, o dormir demasiado' },
      { text: 'Sentirte cansado o con poca energía' },
      { text: 'Poco apetito o comer en exceso' },
      { text: 'Sentirte mal contigo mismo, que eres un fracaso o que has quedado mal contigo o con tu familia' },
      { text: 'Dificultad para concentrarte, por ejemplo al leer o ver televisión' },
      { text: 'Moverte o hablar tan lento que otros lo podrían notar, o lo contrario: estar tan inquieto que te mueves mucho más de lo normal' },
      { text: 'Pensamientos de que estarías mejor muerto o de hacerte daño de alguna forma' },
    ],
  },
  gad7: {
    code: 'gad7',
    name: 'Ansiedad (GAD-7)',
    about: 'Señales de ansiedad. Sirve para repetirlo y ver cómo vas.',
    period: 'las últimas 2 semanas',
    minutes: 2,
    source: 'Spitzer, Kroenke, Williams y Löwe (2006); de uso libre',
    choices: DAYS4,
    max: 21,
    questions: [
      { text: 'Sentirte nervioso, ansioso o con los nervios de punta' },
      { text: 'No poder dejar de preocuparte o controlar la preocupación' },
      { text: 'Preocuparte demasiado por distintas cosas' },
      { text: 'Dificultad para relajarte' },
      { text: 'Estar tan inquieto que te cuesta quedarte quieto' },
      { text: 'Molestarte o irritarte con facilidad' },
      { text: 'Sentir miedo de que algo terrible pudiera pasar' },
    ],
  },
  who5: {
    code: 'who5',
    name: 'Bienestar (WHO-5)',
    about: 'Cómo te has sentido. Es corto: sirve para repetirlo cada mes y ver la tendencia.',
    period: 'las últimas 2 semanas',
    minutes: 1,
    source: 'Organización Mundial de la Salud (Índice de bienestar WHO-5); de uso libre',
    choices: WHO5,
    max: 100,
    questions: [
      { text: 'Me he sentido alegre y de buen ánimo' },
      { text: 'Me he sentido tranquilo y relajado' },
      { text: 'Me he sentido activo y con energía' },
      { text: 'Me he despertado fresco y descansado' },
      { text: 'Mi vida diaria ha estado llena de cosas que me interesan' },
    ],
  },
  pss10: {
    code: 'pss10',
    name: 'Estrés (PSS-10)',
    about: 'Cuánto estrés has sentido y cuánto control sientes sobre tu vida.',
    period: 'el último mes',
    minutes: 3,
    source: 'Cohen, Kamarck y Mermelstein (1983); de uso libre sin fines comerciales',
    choices: PSS,
    max: 40,
    questions: [
      { text: '¿Con qué frecuencia te ha afectado algo que pasó de forma inesperada?' },
      { text: '¿Con qué frecuencia has sentido que no puedes controlar las cosas importantes de tu vida?' },
      { text: '¿Con qué frecuencia te has sentido nervioso o estresado?' },
      { text: '¿Con qué frecuencia te has sentido seguro de poder manejar tus problemas personales?' },
      { text: '¿Con qué frecuencia has sentido que las cosas te van bien?' },
      { text: '¿Con qué frecuencia has sentido que no podías con todo lo que tenías que hacer?' },
      { text: '¿Con qué frecuencia has podido controlar las dificultades de tu vida?' },
      { text: '¿Con qué frecuencia has sentido que tenías todo bajo control?' },
      { text: '¿Con qué frecuencia te has enojado porque pasaron cosas fuera de tu control?' },
      { text: '¿Con qué frecuencia has sentido que las dificultades se acumulan tanto que no puedes superarlas?' },
    ],
  },
  auditc: {
    code: 'auditc',
    name: 'Alcohol (AUDIT-C)',
    about: 'Tres preguntas sobre tu consumo de alcohol.',
    period: 'el último año',
    minutes: 1,
    source: 'Organización Mundial de la Salud (AUDIT; Bush y cols., 1998)',
    choices: [],
    max: 12,
    questions: [
      {
        text: '¿Con qué frecuencia tomas alguna bebida con alcohol?',
        choices: [
          { label: 'Nunca', value: 0 },
          { label: 'Una vez al mes o menos', value: 1 },
          { label: '2 a 4 veces al mes', value: 2 },
          { label: '2 a 3 veces a la semana', value: 3 },
          { label: '4 o más veces a la semana', value: 4 },
        ],
      },
      {
        text: '¿Cuántos tragos tomas en un día típico en que tomas?',
        choices: [
          { label: '1 o 2', value: 0 },
          { label: '3 o 4', value: 1 },
          { label: '5 o 6', value: 2 },
          { label: '7 a 9', value: 3 },
          { label: '10 o más', value: 4 },
        ],
      },
      {
        text: '¿Con qué frecuencia tomas 6 o más tragos en una sola ocasión?',
        choices: [
          { label: 'Nunca', value: 0 },
          { label: 'Menos de una vez al mes', value: 1 },
          { label: 'Una vez al mes', value: 2 },
          { label: 'Una vez a la semana', value: 3 },
          { label: 'A diario o casi a diario', value: 4 },
        ],
      },
    ],
  },
};

export const TEST_ORDER = ['asrs', 'phq9', 'gad7', 'who5', 'pss10', 'auditc'];
export const choicesOf = (t: TestDef, i: number) => t.questions[i].choices ?? t.choices;

const band = (bands: Band[], score: number) => [...bands].reverse().find((b) => score >= b.from) ?? bands[0];
const SEEK = 'Conversarlo con un profesional de salud te puede ayudar a entenderlo mejor.';

/** El puntaje y lo que significa, según los cortes publicados de cada cuestionario. */
export function scoreTest(code: string, answers: number[]): TestResult {
  const t = TESTS[code];
  const sum = (idx: number[]) => idx.reduce((s, i) => s + (answers[i] ?? 0), 0);
  switch (code) {
    case 'asrs': {
      // Parte A: preguntas 1–3 cuentan desde «A veces»; 4–6 desde «A menudo».
      const positives = [0, 1, 2].filter((i) => (answers[i] ?? 0) >= 2).length + [3, 4, 5].filter((i) => (answers[i] ?? 0) >= 3).length;
      const inattention = sum([0, 1, 2, 3, 6, 7, 8, 9, 10]);
      const hyper = sum([4, 5, 11, 12, 13, 14, 15, 16, 17]);
      const b =
        positives >= 4
          ? { from: 4, label: 'Síntomas consistentes con TDAH', tone: 'bad' as const, text: `${positives} de 6 respuestas del tamizaje están en la zona marcada. Es muy consistente con TDAH en adultos y vale la pena una evaluación con un profesional (psiquiatra o neurólogo).` }
          : { from: 0, label: 'Pocos síntomas en el tamizaje', tone: 'ok' as const, text: `${positives} de 6 respuestas del tamizaje están en la zona marcada (el corte es 4). Si igual sientes que te cuesta, cuéntaselo a un profesional.` };
      return {
        score: positives,
        max: 6,
        band: b,
        detail: [`Atención: ${inattention} de 36`, `Inquietud e impulsividad: ${hyper} de 36`, 'Un tamizaje no es un diagnóstico.'],
        crisis: false,
      };
    }
    case 'phq9': {
      const score = sum(t.questions.map((_, i) => i));
      const b = band(
        [
          { from: 0, label: 'Mínimo', tone: 'ok', text: 'Pocas señales de depresión.' },
          { from: 5, label: 'Leve', tone: 'mid', text: 'Algunas señales. Vale la pena repetirlo en 2 a 4 semanas.' },
          { from: 10, label: 'Moderado', tone: 'bad', text: `Señales moderadas. ${SEEK}` },
          { from: 15, label: 'Moderadamente severo', tone: 'bad', text: `Señales importantes. ${SEEK}` },
          { from: 20, label: 'Severo', tone: 'bad', text: `Señales fuertes. Busca ayuda profesional pronto. ${SEEK}` },
        ],
        score,
      );
      return { score, max: 27, band: b, detail: [], crisis: (answers[8] ?? 0) > 0 };
    }
    case 'gad7': {
      const score = sum(t.questions.map((_, i) => i));
      const b = band(
        [
          { from: 0, label: 'Mínimo', tone: 'ok', text: 'Pocas señales de ansiedad.' },
          { from: 5, label: 'Leve', tone: 'mid', text: 'Algunas señales. La respiración y el 5-4-3-2-1 te pueden ayudar.' },
          { from: 10, label: 'Moderado', tone: 'bad', text: `Señales moderadas. ${SEEK}` },
          { from: 15, label: 'Severo', tone: 'bad', text: `Señales fuertes. Busca ayuda profesional. ${SEEK}` },
        ],
        score,
      );
      return { score, max: 21, band: b, detail: [], crisis: false };
    }
    case 'who5': {
      const score = sum(t.questions.map((_, i) => i)) * 4;
      const b = band(
        [
          { from: 0, label: 'Bienestar bajo', tone: 'bad', text: `Un resultado de 28 o menos se asocia a depresión: haz el test de ánimo (PHQ-9). ${SEEK}` },
          { from: 29, label: 'Bienestar bajo', tone: 'mid', text: 'Un resultado de 50 o menos sugiere revisar cómo está tu ánimo (PHQ-9).' },
          { from: 51, label: 'Buen bienestar', tone: 'ok', text: 'Repítelo cada mes para ver la tendencia.' },
        ],
        score,
      );
      return { score, max: 100, band: b, detail: [], crisis: false };
    }
    case 'pss10': {
      // Las preguntas 4, 5, 7 y 8 son positivas: se invierten.
      const score = answers.reduce((s, v, i) => s + ([3, 4, 6, 7].includes(i) ? 4 - (v ?? 0) : (v ?? 0)), 0);
      const b = band(
        [
          { from: 0, label: 'Estrés bajo', tone: 'ok', text: 'Tu estrés percibido es bajo.' },
          { from: 14, label: 'Estrés moderado', tone: 'mid', text: 'Estrés moderado: las pausas, la respiración y dormir bien ayudan.' },
          { from: 27, label: 'Estrés alto', tone: 'bad', text: `Estrés alto. ${SEEK}` },
        ],
        score,
      );
      return { score, max: 40, band: b, detail: [], crisis: false };
    }
    case 'auditc': {
      const score = sum([0, 1, 2]);
      const b =
        score >= 4
          ? { from: 4, label: 'Consumo de riesgo', tone: 'bad' as const, text: `Un puntaje de 4 o más (3 en mujeres) sugiere consumo de riesgo. ${SEEK}` }
          : score >= 3
            ? { from: 3, label: 'En el límite', tone: 'mid' as const, text: 'En mujeres, 3 ya sugiere consumo de riesgo; en hombres el corte es 4.' }
            : { from: 0, label: 'Bajo riesgo', tone: 'ok' as const, text: 'Tu consumo está en la zona de bajo riesgo.' };
      return { score, max: 12, band: b, detail: [], crisis: false };
    }
    default:
      return { score: 0, max: 0, band: { from: 0, label: '', tone: 'ok', text: '' }, detail: [], crisis: false };
  }
}
