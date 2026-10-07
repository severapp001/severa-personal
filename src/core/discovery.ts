// Conocerte y descubrimiento (F30): planes, estado inicial de cada neurona, preguntas del
// plan rápido, sugerencia del día y posición de las neuronas en el cerebro. Dominio puro.

export type Hemisphere = 'personal' | 'work' | 'bridge';
export type NeuronState = 'undiscovered' | 'suggested' | 'discovered' | 'off';
export type Path = 'quick' | 'calm';

export type Neuron = {
  code: string;
  name: string;
  hemisphere: Hemisphere;
  level: number;
  minimum: string | null;
  summary: string | null;
  sensitive: boolean;
  min_age: number;
  sort_order: number;
};
export type Synapse = { neuron_a: string; neuron_b: string };
export type Trade = { code: string; name: string; tools: string[]; beta_priority: number | null; status: string; sort_order: number };

export const BASICS = ['perfil_personal', 'calendario', 'prioridades', 'resumen'];

export const GOALS = [
  { code: 'finanzas', name: 'Ordenar mis finanzas', detail: 'Sueldo, gastos y deudas', plan: 'finanzas' },
  { code: 'dia', name: 'Organizar mi día', detail: 'Rutina, tareas y hábitos', plan: 'dia' },
  { code: 'salud', name: 'Cuidar mi salud', detail: 'Remedios, comida y ejercicio', plan: 'bienestar' },
  { code: 'fe', name: 'Crecer y mi fe', detail: 'Diario, gratitud y Biblia', plan: 'fe' },
  { code: 'recordar', name: 'Recordar mi vida', detail: 'Recuerdos y viajes', plan: 'recuerdos' },
  { code: 'trabajo', name: 'Mi trabajo', detail: 'Jornada, clientes y cobros', plan: null },
] as const;

export const PLANS: Record<string, { name: string; modules: string[] }> = {
  finanzas: { name: 'Finanzas en orden', modules: ['finanzas', 'gastos_compartidos', 'documentos'] },
  dia: { name: 'Organizar mi día', modules: ['habitos', 'diario', 'tu_rutina'] },
  bienestar: { name: 'Bienestar', modules: ['salud', 'alimentacion', 'ejercicio', 'habitos'] },
  fe: { name: 'Fe y crecimiento', modules: ['biblia', 'diario', 'gratitud', 'habitos'] },
  recuerdos: { name: 'Recuerdos', modules: ['diario', 'gratitud', 'biografia', 'viajes'] },
  estudiante: { name: 'Estudiante', modules: ['estudios', 'habitos', 'finanzas'] },
};

export const INTERESTS = [
  { code: 'deporte', name: 'Hacer deporte', neuron: 'ejercicio' },
  { code: 'familia', name: 'Estar con mi familia', neuron: 'familia_y_mascotas' },
  { code: 'estudiar', name: 'Estudiar', neuron: 'estudios' },
  { code: 'fe', name: 'Mi fe', neuron: 'biblia' },
  { code: 'cocinar', name: 'Cocinar', neuron: 'alimentacion' },
  { code: 'leer', name: 'Leer', neuron: 'diario' },
  { code: 'amigos', name: 'Salir con amigos', neuron: 'gastos_compartidos' },
  { code: 'viajar', name: 'Viajar', neuron: 'viajes' },
  { code: 'mascotas', name: 'Mis mascotas', neuron: 'familia_y_mascotas' },
  { code: 'descansar', name: 'Descansar', neuron: 'juegos' },
  { code: 'emprender', name: 'Emprender', neuron: 'ventas_y_productos' },
  { code: 'manualidades', name: 'Hacer manualidades', neuron: 'biografia' },
] as const;

export const STUDY = 'study';
export const NO_WORK = 'no_work';

/** Planes y módulos del plan rápido (sin los básicos), sin repetir y en orden. */
export function planModules(goals: string[], tradeCodes: string[], trades: Trade[]) {
  const plans: string[] = [];
  const modules: string[] = [];
  const add = (list: string[]) => list.forEach((m) => !modules.includes(m) && !BASICS.includes(m) && modules.push(m));

  for (const g of GOALS) {
    if (goals.includes(g.code) && g.plan) {
      plans.push(g.plan);
      add(PLANS[g.plan].modules);
    }
  }
  if (goals.includes('trabajo')) {
    for (const t of trades) {
      if (!tradeCodes.includes(t.code)) continue;
      plans.push(`trade:${t.code}`);
      add(['trabajo', ...t.tools, 'finanzas']);
    }
  }
  if (tradeCodes.includes(STUDY)) {
    plans.push('estudiante');
    add(PLANS.estudiante.modules);
  }
  return { plans, modules };
}

export const works = (tradeCodes: string[]) => tradeCodes.some((c) => c !== STUDY && c !== NO_WORK);

/** Estado inicial de cada neurona tras Conocerte. Lo saltado queda «por completar». */
export function initialStates(
  path: Path,
  modules: string[],
  answers: Record<string, string>,
  tradeCodes: string[],
): Record<string, NeuronState> {
  const on: Record<string, NeuronState> = { perfil_personal: 'discovered' };
  if (works(tradeCodes)) on.trabajo = 'discovered';
  if (path === 'calm') return on;
  for (const code of [...BASICS, ...modules]) {
    if (code === 'perfil_personal') continue;
    on[code] = code === 'resumen' || answers[code] === 'skipped' ? 'suggested' : 'discovered';
  }
  return on;
}

// Plan rápido: una pregunta por módulo (F30, E3·18).
export type Question = { q: string; options: string[]; note?: string; kind?: 'payday' | 'habits' };
export const QUESTIONS: Record<string, Question> = {
  finanzas: {
    q: '¿Qué día te pagan?',
    options: ['Día 5', 'Día 15', 'Último día hábil', 'Otro día', 'Cambia según el mes', 'No tengo sueldo fijo'],
    note: 'Tu mes financiero va de un pago al siguiente. Si cambia según el mes (como en muchos Servicios públicos), anotas la fecha de cada mes.',
    kind: 'payday',
  },
  gastos_compartidos: { q: '¿Compartes gastos con alguien?', options: ['Con mi pareja', 'En la casa', 'En viajes', 'Después'] },
  documentos: { q: '¿Algún documento vence pronto?', options: ['Licencia de conducir', 'Permiso de circulación', 'Carnet', 'Después'], note: 'Te avisamos 30, 7 y 1 día antes.' },
  agenda_y_citas: { q: '¿Qué días atiendes?', options: ['Lunes a viernes', 'Lunes a sábado', 'Varía cada semana'] },
  clientes_y_pacientes: {
    q: '¿Agregamos a tu primer cliente?',
    options: ['Ahora', 'Después'],
    note: 'Son datos de terceros: se guardan protegidos y con su consentimiento.',
  },
  cobros_y_boletas: { q: '¿Cómo te pagan?', options: ['Boleta de honorarios', 'Efectivo', 'Transferencia', 'Varias formas'], note: 'Con boleta, calculamos la retención del año.' },
  calendario: { q: '¿Conectamos el calendario de tu teléfono?', options: ['Conectar', 'Después'], note: 'Severa lo lee, pero escribe solo en el suyo.' },
  prioridades: { q: '¿Algo que tengas que hacer hoy?', options: ['Escribir una tarea', 'Después'] },
  habitos: { q: '¿Qué quieres contar?', options: [], kind: 'habits' },
  salud: { q: '¿Tomas algún remedio?', options: ['Sí, lo agrego', 'Después'], note: 'Salud guarda datos sensibles: solo tú los ves.' },
  alimentacion: { q: '¿Anotamos tu peso y estatura?', options: ['Ahora', 'Después'], note: 'Severa acompaña: no recomienda dietas.' },
  ejercicio: { q: '¿Qué ejercicio haces?', options: ['Gimnasio', 'Correr', 'Fútbol', 'Nada aún'] },
  diario: { q: '¿Cierras el día con una nota?', options: ['Sí, en la noche', 'Después'] },
  tu_rutina: { q: '¿Cómo es tu rutina?', options: ['De día', 'Turnos', 'Faena', 'Según mi agenda', 'Variable'], note: 'Las horas las vemos después, en Tu rutina.' },
  jornada: { q: '¿Empiezas a una hora fija?', options: ['Sí', 'Depende del día'] },
  turnos_y_faenas: { q: '¿Cuál es tu sistema?', options: ['Cuarto turno', '4x4', '3 turnos', '14x14 u otro'] },
  recorridos: { q: '¿En qué tipo de app trabajas?', options: ['Transporte', 'Delivery', 'Compras', 'Varias'] },
  gastos_del_trabajo: { q: '¿Cuánto gastas en bencina a la semana?', options: ['Menos de $20 mil', '$20 a $40 mil', 'Más de $40 mil', 'No sé'] },
  ventas_y_productos: { q: '¿Qué vendes?', options: ['Comida', 'Ropa', 'Cosmética', 'Otro'] },
  tareas_del_trabajo: { q: '¿Un pendiente del trabajo?', options: ['Escribir', 'Después'] },
  ficha_al_terminar: { q: '¿Qué anotas al terminar una visita o atención?', options: ['Hallazgos y fotos', 'Lo que hice', 'Después'] },
  documentos_laborales: { q: '¿Tienes documentos del trabajo que venzan?', options: ['Sí', 'Después'] },
  estudios: { q: '¿Dónde estudias?', options: ['Colegio', 'Universidad', 'Instituto', 'Curso'] },
  familia_y_mascotas: { q: '¿Tienes a alguien a cargo?', options: ['Hijos', 'Mascota', 'Padres', 'Después'] },
  biblia: { q: '¿Activamos el pan de vida en la mañana?', options: ['Sí', 'Después'] },
  gratitud: { q: 'Una cosa buena de hoy', options: ['Escribir', 'Después'] },
  biografia: { q: '¿Agregamos tu primer recuerdo?', options: ['Ahora', 'Después'] },
  viajes: { q: '¿Un viaje próximo o reciente?', options: ['Agregar', 'Después'] },
};

export const SKIP_OPTIONS = new Set(['Después', 'Nada aún']);

/** Módulos que tienen pregunta en el plan rápido (más Calendario y Prioridades). */
export function questionList(modules: string[]): string[] {
  return [...modules, 'calendario', 'prioridades'].filter((m, i, all) => QUESTIONS[m] && m !== 'trabajo' && all.indexOf(m) === i);
}

export const GOOD_HABITS = ['agua', 'sueno', 'caminar', 'leer', 'entrenar', 'orar_meditar'];
export const REDUCE_HABITS = ['cigarros', 'energeticas', 'alcohol', 'salidas', 'redes', 'chatarra'];

/** Vecinas de cada neurona según las sinapsis. */
export function neighbors(synapses: Synapse[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of synapses) {
    (map[s.neuron_a] ??= []).push(s.neuron_b);
    (map[s.neuron_b] ??= []).push(s.neuron_a);
  }
  return map;
}

const isOn = (state: NeuronState | undefined) => state === 'discovered' || state === 'suggested';

export type Suggestion = { code: string; reason: string };

/**
 * Una sugerencia a la vez: vecina de lo encendido, del nivel más bajo; primero lo que calza
 * con los intereses y los planes. Nunca nivel 4 (sensibles) ni lo marcado «no me interesa».
 */
export function suggest(
  neurons: Neuron[],
  synapses: Synapse[],
  states: Record<string, NeuronState>,
  opts: { interests: string[]; planModules: string[]; notInterested: string[]; skip?: number; age?: number },
): Suggestion | null {
  const vec = neighbors(synapses);
  const byCode = Object.fromEntries(neurons.map((n) => [n.code, n]));
  const interestOf = (code: string) => INTERESTS.find((i) => opts.interests.includes(i.code) && i.neuron === code);
  const candidates = neurons
    .filter(
      (n) =>
        !isOn(states[n.code]) &&
        states[n.code] !== 'off' &&
        n.level < 4 &&
        n.hemisphere !== 'bridge' &&
        (opts.age === undefined || opts.age >= n.min_age) &&
        !opts.notInterested.includes(n.code) &&
        (vec[n.code] ?? []).some((v) => isOn(states[v])),
    )
    .map((n) => ({
      n,
      score: n.level * 10 - (interestOf(n.code) ? 6 : 0) - (opts.planModules.includes(n.code) ? 4 : 0),
    }))
    .sort((a, b) => a.score - b.score || a.n.sort_order - b.n.sort_order);
  if (!candidates.length) return null;
  const pick = candidates[(opts.skip ?? 0) % candidates.length].n;
  const interest = interestOf(pick.code);
  let reason: string;
  if (interest) reason = `Porque te gusta ${interest.name.toLowerCase()}`;
  else if (opts.planModules.includes(pick.code)) reason = 'Por lo que quieres lograr';
  else {
    const on = (vec[pick.code] ?? []).find((v) => isOn(states[v]));
    reason = on ? `Se conecta con ${byCode[on]?.name ?? on}` : 'Para empezar';
  }
  return { code: pick.code, reason };
}

/**
 * Posición de cada neurona: dos hemisferios (Personal a la izquierda, Trabajo a la derecha),
 * del centro (nivel 0) hacia afuera (nivel 4). Lienzo de 350 × 290; Tu rutina abajo al centro.
 */
export function layoutBrain(neurons: Neuron[]): Record<string, { x: number; y: number }> {
  const RAD = [28, 62, 96, 130, 158];
  const groups: Record<string, Neuron[]> = {};
  for (const n of [...neurons].sort((a, b) => a.sort_order - b.sort_order)) {
    if (n.hemisphere === 'bridge') continue;
    (groups[`${n.hemisphere}:${n.level}`] ??= []).push(n);
  }
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [key, list] of Object.entries(groups)) {
    const [hemi, lvl] = key.split(':');
    const level = Number(lvl);
    list.forEach((n, i) => {
      const deg =
        hemi === 'personal' && level === 4
          ? (i === 0 ? 168 : 192)
          : (hemi === 'personal' ? 105 : -75) + (i + 0.5) * (150 / list.length);
      const r = (deg * Math.PI) / 180;
      pos[n.code] = { x: 175 + RAD[Math.min(level, 4)] * Math.cos(r), y: 145 + RAD[Math.min(level, 4)] * 0.8 * Math.sin(r) };
    });
  }
  for (const n of neurons) if (n.hemisphere === 'bridge') pos[n.code] = { x: 175, y: 262 };
  return pos;
}
