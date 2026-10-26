import type { Entry } from '@/data/entries';

// Fichas de los módulos que viven en el motor común (module_entries, 26-10-2026). Cada ficha dice
// qué se registra, con qué campos, qué es lo mínimo para que el módulo funcione y con qué se
// conecta. Una sola pantalla (`/modulo/[code]`) las dibuja todas; los módulos con lógica propia
// suman un widget arriba (IMC, ciclo, saldos de un grupo…).
//
// Campos: `title`, `body`, `day`, `until`, `amount`, `value` y `done` son columnas; cualquier otra
// llave queda en `data`.

export type FieldKind = 'text' | 'long' | 'date' | 'time' | 'amount' | 'number' | 'choice' | 'multi' | 'scale' | 'check';
export type OptionsCtx = { parent: Entry | null; entries: Entry[] };

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[] | ((ctx: OptionsCtx) => string[]);
  placeholder?: string;
  required?: boolean;
  /** Para `scale`: de 1 a max. */
  max?: number;
  unit?: string;
  /** 'today' para fechas; un texto para las opciones. */
  initial?: 'today' | string;
};

export type KindDef = {
  kind: string;
  /** Nombre de la pestaña («Remedios»). */
  label: string;
  /** Para el botón («+ Remedio»). */
  one: string;
  fields: FieldDef[];
  empty: string;
  /** Vive dentro de otro registro (gastos de un grupo, recuerdos de un viaje). */
  parent?: string;
  /** Se marca como hecho con un toque (comprado, pagado, entregado). */
  checkable?: string;
  /** Además, queda en el Calendario. */
  toCalendar?: { layer: 'salud' | 'trabajo' | 'personal' | 'familia' | 'otro'; prefix?: string; timeKey?: string; placeKey?: string };
};

export type WidgetKey = 'meds' | 'exercise' | 'imc' | 'shopping' | 'expiry' | 'shared' | 'trip' | 'timeline' | 'swot' | 'cycle' | 'cobros' | 'clients' | 'orders' | 'shifts' | 'sales';

export type ModuleDef = {
  code: string;
  title: string;
  space: 'Personal' | 'Trabajo';
  /** Qué hace, en una frase. */
  intro: string;
  /** Lo mínimo para que empiece a funcionar (se muestra mientras está vacío). */
  minimum: string;
  /** Con qué se conecta, en palabras. */
  connects: string;
  kinds: KindDef[];
  widget?: WidgetKey;
  sensitive?: boolean;
  note?: string;
};

const peopleOf = (parent: Entry | null) =>
  String(parent?.data.personas ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

/** Quienes están en un grupo de gastos compartidos: tú y los demás. */
export const groupPeople = (parent: Entry | null) => ['Yo', ...peopleOf(parent)];

const DOC_TYPES = ['Carnet', 'Licencia de conducir', 'Pasaporte', 'Revisión técnica', 'Permiso de circulación', 'SOAP', 'Seguro', 'Contrato', 'Garantía', 'Otro'];

export const MODULES: Record<string, ModuleDef> = {
  salud: {
    code: 'salud',
    title: 'Salud',
    space: 'Personal',
    intro: 'Tus remedios con su horario, lo que sientes para mostrarle al médico, tus citas, exámenes y licencias.',
    minimum: 'Un remedio o una cita. Con eso Severa te arma el día y te recuerda la cita.',
    connects: 'Calendario (citas), Prioridades (remedios de hoy), Resumen.',
    widget: 'meds',
    sensitive: true,
    note: 'Severa registra, no recomienda: lo que anotes es para ti y para mostrarlo a tu médico.',
    kinds: [
      {
        kind: 'remedio',
        label: 'Remedios',
        one: 'Remedio',
        empty: 'Agrega tus remedios para marcarlos cada día.',
        fields: [
          { key: 'title', label: 'Remedio', kind: 'text', required: true, placeholder: 'Por ejemplo: Losartán 50 mg' },
          { key: 'dosis', label: 'Dosis (opcional)', kind: 'text', placeholder: '1 comprimido' },
          { key: 'veces', label: '¿Cuántas veces al día?', kind: 'choice', options: ['1', '2', '3', '4', 'Cuando lo necesito'], initial: '1' },
          { key: 'hora', label: 'Primera toma', kind: 'time' },
          { key: 'day', label: 'Desde', kind: 'date', initial: 'today' },
          { key: 'until', label: 'Hasta (vacío = sin fecha de término)', kind: 'date' },
        ],
      },
      {
        kind: 'cita',
        label: 'Citas',
        one: 'Cita',
        empty: 'Tus horas al médico, dentista o exámenes. Quedan en tu calendario.',
        toCalendar: { layer: 'salud', prefix: 'Cita: ', timeKey: 'hora', placeKey: 'lugar' },
        fields: [
          { key: 'title', label: 'Con quién o qué especialidad', kind: 'text', required: true, placeholder: 'Dentista, Dr. Pérez…' },
          { key: 'day', label: 'Día', kind: 'date', required: true, initial: 'today' },
          { key: 'hora', label: 'Hora', kind: 'time' },
          { key: 'lugar', label: 'Lugar (opcional)', kind: 'text' },
          { key: 'body', label: 'Qué preguntar (opcional)', kind: 'long' },
        ],
      },
      {
        kind: 'sintoma',
        label: 'Síntomas',
        one: 'Síntoma',
        empty: 'Anota lo que sientes y cuándo: tu médico lo agradecerá.',
        fields: [
          { key: 'title', label: '¿Qué sentiste?', kind: 'text', required: true, placeholder: 'Dolor de cabeza, mareo…' },
          { key: 'value', label: 'Intensidad', kind: 'scale', max: 10 },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
          { key: 'body', label: 'Notas (opcional)', kind: 'long' },
        ],
      },
      {
        kind: 'dato',
        label: 'Mediciones',
        one: 'Medición',
        empty: 'Presión, glicemia, temperatura o lo que te pidan medir.',
        fields: [
          { key: 'title', label: '¿Qué mediste?', kind: 'choice', options: ['Presión', 'Glicemia', 'Temperatura', 'Saturación', 'Pulso', 'Otro'], required: true },
          { key: 'value', label: 'Valor', kind: 'number', required: true },
          { key: 'unidad', label: 'Unidad (opcional)', kind: 'text', placeholder: 'mmHg, mg/dL, °C…' },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
      {
        kind: 'examen',
        label: 'Exámenes',
        one: 'Examen',
        empty: 'Tus exámenes con su resultado.',
        fields: [
          { key: 'title', label: 'Examen', kind: 'text', required: true },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
          { key: 'body', label: 'Resultado (opcional)', kind: 'long' },
        ],
      },
      {
        kind: 'licencia',
        label: 'Licencias',
        one: 'Licencia',
        empty: 'Licencias médicas con sus fechas.',
        fields: [
          { key: 'title', label: 'Motivo', kind: 'text', required: true },
          { key: 'day', label: 'Desde', kind: 'date', required: true, initial: 'today' },
          { key: 'until', label: 'Hasta', kind: 'date' },
          { key: 'body', label: 'Notas (opcional)', kind: 'long' },
        ],
      },
    ],
  },

  ejercicio: {
    code: 'ejercicio',
    title: 'Ejercicio',
    space: 'Personal',
    intro: 'Registra tus sesiones y mira tu semana frente a los 150 minutos que recomienda la OMS.',
    minimum: 'Una sesión: qué hiciste y cuántos minutos.',
    connects: 'Hábitos (entrenar o caminar se marca solo), Alimentación, Resumen y Logros.',
    widget: 'exercise',
    kinds: [
      {
        kind: 'sesion',
        label: 'Sesiones',
        one: 'Sesión',
        empty: 'Cada sesión suma a tu semana.',
        fields: [
          { key: 'title', label: '¿Qué hiciste?', kind: 'choice', required: true, options: ['Caminar', 'Correr', 'Gimnasio', 'Bicicleta', 'Fútbol', 'Natación', 'Yoga o estirar', 'Baile', 'Otro'] },
          { key: 'value', label: 'Minutos', kind: 'number', required: true, unit: 'min' },
          { key: 'intensidad', label: 'Intensidad', kind: 'choice', options: ['Suave', 'Moderada', 'Intensa'], initial: 'Moderada' },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
          { key: 'body', label: 'Notas (opcional)', kind: 'long', placeholder: 'Series, distancia, cómo te sentiste' },
        ],
      },
      {
        kind: 'rutina',
        label: 'Mis rutinas',
        one: 'Rutina',
        empty: 'Arma tus rutinas para repetirlas.',
        fields: [
          { key: 'title', label: 'Nombre', kind: 'text', required: true, placeholder: 'Piernas, cardio…' },
          { key: 'dias', label: 'Días', kind: 'multi', options: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] },
          { key: 'body', label: 'Ejercicios', kind: 'long', placeholder: 'Sentadillas 3×12…' },
        ],
      },
    ],
  },

  alimentacion: {
    code: 'alimentacion',
    title: 'Alimentación',
    space: 'Personal',
    intro: 'Tu IMC con la referencia de la OMS, las calorías que gastas al día, tus comidas y la lista del supermercado.',
    minimum: 'Tu peso y tu estatura (para el IMC), o una comida.',
    connects: 'Ejercicio, Hábitos, Finanzas (supermercado) y Resumen.',
    widget: 'imc',
    note: 'Las cifras son referencias generales; no reemplazan a un profesional de la salud.',
    kinds: [
      {
        kind: 'comida',
        label: 'Comidas',
        one: 'Comida',
        empty: 'Anota qué comiste y qué tan sano fue: con el tiempo ves tus patrones.',
        fields: [
          { key: 'title', label: '¿Qué comiste?', kind: 'text', required: true, placeholder: 'Porotos con riendas' },
          { key: 'momento', label: 'Momento', kind: 'choice', options: ['Desayuno', 'Almuerzo', 'Once', 'Cena', 'Colación'] },
          { key: 'value', label: '¿Qué tan sano? (1 a 5)', kind: 'scale', max: 5 },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
      {
        kind: 'compra',
        label: 'Supermercado',
        one: 'Producto',
        checkable: 'Comprado',
        empty: 'Tu lista del supermercado. Marca lo que ya echaste al carro.',
        fields: [
          { key: 'title', label: 'Producto', kind: 'text', required: true, placeholder: 'Pan, leche…' },
          { key: 'value', label: 'Cantidad (opcional)', kind: 'number' },
          { key: 'pasillo', label: 'Sección', kind: 'choice', options: ['Frutas y verduras', 'Carnes', 'Lácteos', 'Despensa', 'Panadería', 'Limpieza', 'Otro'] },
        ],
      },
      {
        kind: 'medida',
        label: 'Peso',
        one: 'Peso y estatura',
        empty: 'Tu peso y tu estatura calculan el IMC y las calorías.',
        fields: [
          { key: 'value', label: 'Peso (kg)', kind: 'number', required: true, unit: 'kg' },
          { key: 'estatura', label: 'Estatura (cm)', kind: 'number', required: true },
          { key: 'sexo', label: 'Sexo (para las calorías)', kind: 'choice', options: ['Mujer', 'Hombre'] },
          { key: 'actividad', label: 'Actividad diaria', kind: 'choice', options: ['Poca', 'Ligera', 'Moderada', 'Alta'], initial: 'Ligera' },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
    ],
  },

  documentos: {
    code: 'documentos',
    title: 'Documentos',
    space: 'Personal',
    intro: 'Tus documentos con su fecha de vencimiento, para que no te pille la revisión técnica ni el carnet vencido.',
    minimum: 'Un documento con su fecha de vencimiento.',
    connects: 'Calendario y Prioridades (avisa 30 días antes), Familia, Mis vehículos.',
    widget: 'expiry',
    sensitive: true,
    note: 'Subir la foto o el PDF llega con la próxima versión instalable de la app (necesita un permiso nuevo del teléfono).',
    kinds: [
      {
        kind: 'documento',
        label: 'Documentos',
        one: 'Documento',
        empty: 'Agrega tu carnet, licencia o revisión técnica.',
        fields: [
          { key: 'tipo', label: 'Tipo', kind: 'choice', options: DOC_TYPES, required: true },
          { key: 'title', label: 'Nombre (opcional)', kind: 'text', placeholder: 'Licencia clase B' },
          { key: 'until', label: 'Vence', kind: 'date' },
          { key: 'body', label: 'Nota (opcional)', kind: 'long', placeholder: 'Dónde está guardado, a nombre de quién…' },
        ],
      },
    ],
  },

  gastos_compartidos: {
    code: 'gastos_compartidos',
    title: 'Gastos compartidos',
    space: 'Personal',
    intro: 'Grupos para dividir gastos (depto, pareja, familia, amigos o un viaje): quién pagó, entre quiénes y quién le debe a quién.',
    minimum: 'Crear un grupo con las personas.',
    connects: 'Finanzas (tu parte queda como gasto), Viajes y Familia.',
    widget: 'shared',
    kinds: [
      {
        kind: 'grupo',
        label: 'Grupos',
        one: 'Grupo',
        empty: 'Crea un grupo: el depto, tu pareja o los amigos del asado.',
        fields: [
          { key: 'title', label: 'Nombre del grupo', kind: 'text', required: true, placeholder: 'Depto Ñuñoa' },
          { key: 'tipo', label: 'Tipo', kind: 'choice', options: ['Depto o casa', 'Pareja', 'Familia', 'Amigos', 'Viaje', 'Trabajo'] },
          { key: 'personas', label: 'Personas, separadas por coma (sin contarte)', kind: 'text', required: true, placeholder: 'Cata, Nico' },
        ],
      },
      {
        kind: 'gasto',
        parent: 'grupo',
        label: 'Gastos',
        one: 'Gasto',
        empty: 'Anota quién pagó y entre quiénes se divide.',
        fields: [
          { key: 'title', label: '¿En qué?', kind: 'text', required: true, placeholder: 'Supermercado, luz…' },
          { key: 'amount', label: 'Monto', kind: 'amount', required: true },
          { key: 'pago', label: '¿Quién pagó?', kind: 'choice', options: (c) => groupPeople(c.parent), initial: 'Yo' },
          { key: 'entre', label: 'Entre quiénes (vacío = todos)', kind: 'multi', options: (c) => groupPeople(c.parent) },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
      {
        kind: 'abono',
        parent: 'grupo',
        label: 'Pagos entre ustedes',
        one: 'Pago',
        empty: 'Cuando alguien salda lo que debe.',
        fields: [
          { key: 'de', label: '¿Quién pagó?', kind: 'choice', options: (c) => groupPeople(c.parent), required: true },
          { key: 'a', label: '¿A quién?', kind: 'choice', options: (c) => groupPeople(c.parent), required: true },
          { key: 'amount', label: 'Monto', kind: 'amount', required: true },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
    ],
  },

  viajes: {
    code: 'viajes',
    title: 'Viajes',
    space: 'Personal',
    intro: 'Cada viaje con sus fechas, presupuesto, gastos, plan del día y recuerdos.',
    minimum: 'Un viaje con destino y fecha.',
    connects: 'Finanzas (presupuesto), Gastos compartidos, Calendario y Biografía.',
    widget: 'trip',
    kinds: [
      {
        kind: 'viaje',
        label: 'Viajes',
        one: 'Viaje',
        empty: 'Agrega tu próximo viaje o uno que ya hiciste.',
        fields: [
          { key: 'title', label: 'Destino', kind: 'text', required: true, placeholder: 'Pucón' },
          { key: 'day', label: 'Ida', kind: 'date', required: true },
          { key: 'until', label: 'Vuelta', kind: 'date' },
          { key: 'amount', label: 'Presupuesto (opcional)', kind: 'amount' },
          { key: 'body', label: 'Notas (opcional)', kind: 'long' },
        ],
      },
      {
        kind: 'gasto_viaje',
        parent: 'viaje',
        label: 'Gastos',
        one: 'Gasto',
        empty: 'Lo que vas gastando, frente al presupuesto.',
        fields: [
          { key: 'title', label: '¿En qué?', kind: 'text', required: true },
          { key: 'amount', label: 'Monto', kind: 'amount', required: true },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
      {
        kind: 'plan',
        parent: 'viaje',
        label: 'Itinerario',
        one: 'Actividad',
        checkable: 'Hecho',
        empty: 'Qué harás cada día.',
        fields: [
          { key: 'title', label: 'Actividad', kind: 'text', required: true },
          { key: 'day', label: 'Día', kind: 'date' },
          { key: 'hora', label: 'Hora (opcional)', kind: 'time' },
        ],
      },
      {
        kind: 'recuerdo_viaje',
        parent: 'viaje',
        label: 'Recuerdos',
        one: 'Recuerdo',
        empty: 'Lo que no quieres olvidar.',
        fields: [
          { key: 'body', label: 'Recuerdo', kind: 'long', required: true },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
    ],
  },

  biografia: {
    code: 'biografia',
    title: 'Biografía',
    space: 'Personal',
    intro: 'Los recuerdos y lugares de tu vida en una línea de tiempo, con fechas aproximadas.',
    minimum: 'Un recuerdo.',
    connects: 'Viajes, Diario, Familia.',
    widget: 'timeline',
    kinds: [
      {
        kind: 'recuerdo',
        label: 'Recuerdos',
        one: 'Recuerdo',
        empty: 'Tu primer recuerdo, el colegio, un viaje, el día que conociste a alguien…',
        fields: [
          { key: 'title', label: 'Qué pasó', kind: 'text', required: true },
          { key: 'day', label: 'Cuándo (aproximado)', kind: 'date' },
          { key: 'etapa', label: 'Etapa', kind: 'choice', options: ['Infancia', 'Adolescencia', 'Juventud', 'Adultez', 'Este año'] },
          { key: 'lugar', label: 'Dónde (opcional)', kind: 'text' },
          { key: 'body', label: 'Cuéntalo (opcional)', kind: 'long' },
        ],
      },
    ],
  },

  foda_personal: {
    code: 'foda_personal',
    title: 'FODA personal',
    space: 'Personal',
    intro: 'Tus fortalezas, oportunidades, debilidades y amenazas, con su importancia, y qué hacer con ellas.',
    minimum: 'Una fortaleza.',
    connects: 'Hábitos (lo que te ayuda), Metas, Resumen.',
    widget: 'swot',
    kinds: [
      {
        kind: 'item',
        label: 'Mi FODA',
        one: 'Punto',
        empty: 'Empieza por una fortaleza: algo que haces bien.',
        fields: [
          { key: 'cuadrante', label: 'Es una…', kind: 'choice', required: true, options: ['Fortaleza', 'Oportunidad', 'Debilidad', 'Amenaza'], initial: 'Fortaleza' },
          { key: 'title', label: 'Cuál', kind: 'text', required: true, placeholder: 'Soy constante' },
          { key: 'value', label: 'Importancia (1 a 5)', kind: 'scale', max: 5 },
          { key: 'body', label: 'Qué harás con esto (opcional)', kind: 'long' },
        ],
      },
    ],
  },

  intimo_y_ciclo: {
    code: 'intimo_y_ciclo',
    title: 'Íntimo y ciclo',
    space: 'Personal',
    intro: 'Tu ciclo con la predicción del próximo período, síntomas y un registro íntimo. Solo tú lo ves.',
    minimum: 'El día que empezó tu último período.',
    connects: 'Salud, Diario (ánimo) y Calendario.',
    widget: 'cycle',
    sensitive: true,
    note: 'La predicción es una estimación con tus registros; no sirve como método anticonceptivo.',
    kinds: [
      {
        kind: 'periodo',
        label: 'Períodos',
        one: 'Período',
        empty: 'Anota cuándo empezó tu período.',
        fields: [
          { key: 'day', label: 'Empezó', kind: 'date', required: true, initial: 'today' },
          { key: 'until', label: 'Terminó (opcional)', kind: 'date' },
          { key: 'flujo', label: 'Flujo', kind: 'choice', options: ['Ligero', 'Medio', 'Abundante'] },
        ],
      },
      {
        kind: 'sintoma_ciclo',
        label: 'Síntomas',
        one: 'Síntomas',
        empty: 'Cómo te sientes en cada parte del ciclo.',
        fields: [
          { key: 'sintomas', label: '¿Qué sentiste?', kind: 'multi', required: true, options: ['Cólicos', 'Dolor de cabeza', 'Hinchazón', 'Cambios de ánimo', 'Cansancio', 'Acné', 'Antojos', 'Sensibilidad'] },
          { key: 'value', label: 'Intensidad (1 a 5)', kind: 'scale', max: 5 },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
      {
        kind: 'intimo',
        label: 'Íntimo',
        one: 'Registro',
        empty: 'Un registro privado, solo para ti.',
        fields: [
          { key: 'day', label: 'Día', kind: 'date', required: true, initial: 'today' },
          { key: 'proteccion', label: 'Protección', kind: 'choice', options: ['Con protección', 'Sin protección', 'Prefiero no decir'] },
          { key: 'body', label: 'Nota (opcional)', kind: 'long' },
        ],
      },
    ],
  },

  tu_rutina: {
    code: 'tu_rutina',
    title: 'Tu rutina',
    space: 'Personal',
    intro: 'Los bloques fijos de tu semana (gimnasio, clases, llevar a los niños): Severa arma tu día con ellos.',
    minimum: 'Un bloque con sus días y horas.',
    connects: 'Hoy (línea del día), Calendario y el cruce a Trabajo.',
    kinds: [
      {
        kind: 'bloque',
        label: 'Bloques',
        one: 'Bloque',
        empty: 'Agrega lo que se repite cada semana.',
        fields: [
          { key: 'title', label: 'Qué', kind: 'text', required: true, placeholder: 'Gimnasio' },
          { key: 'dias', label: 'Días', kind: 'multi', required: true, options: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] },
          { key: 'desde', label: 'Desde', kind: 'time' },
          { key: 'hasta', label: 'Hasta', kind: 'time' },
        ],
      },
    ],
  },

  // ─── Trabajo ─────────────────────────────────────────────────────────────────
  cobros_y_boletas: {
    code: 'cobros_y_boletas',
    title: 'Cobros y boletas',
    space: 'Trabajo',
    intro: 'Lo que cobraste y lo que te deben, con la retención de las boletas de honorarios.',
    minimum: 'Un cobro.',
    connects: 'Finanzas (lo pagado es ingreso), Clientes y Ficha al terminar.',
    widget: 'cobros',
    note: 'Retención de boletas de honorarios en 2026: 15,25 % (confírmalo en el SII).',
    kinds: [
      {
        kind: 'cobro',
        label: 'Cobros',
        one: 'Cobro',
        checkable: 'Pagado',
        empty: 'Anota cada trabajo cobrado o por cobrar.',
        fields: [
          { key: 'title', label: 'Cliente o servicio', kind: 'text', required: true },
          { key: 'amount', label: 'Monto', kind: 'amount', required: true },
          { key: 'forma', label: 'Forma', kind: 'choice', options: ['Efectivo', 'Transferencia', 'Boleta de honorarios', 'Factura'] },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
          { key: 'done', label: 'Ya me pagaron', kind: 'check' },
        ],
      },
    ],
  },

  clientes_y_pacientes: {
    code: 'clientes_y_pacientes',
    title: 'Clientes y pacientes',
    space: 'Trabajo',
    intro: 'La ficha de cada persona que atiendes y, si fías, su saldo con cargos y abonos.',
    minimum: 'Un cliente o paciente.',
    connects: 'Agenda y citas, Cobros, Ficha al terminar, Ventas.',
    widget: 'clients',
    sensitive: true,
    kinds: [
      {
        kind: 'cliente',
        label: 'Clientes',
        one: 'Cliente',
        empty: 'Agrega a quien atiendes o le vendes.',
        fields: [
          { key: 'title', label: 'Nombre', kind: 'text', required: true },
          { key: 'telefono', label: 'Teléfono (opcional)', kind: 'text' },
          { key: 'body', label: 'Notas (opcional)', kind: 'long' },
        ],
      },
      {
        kind: 'cuenta',
        parent: 'cliente',
        label: 'Cuenta',
        one: 'Cargo o abono',
        empty: 'Fiados y abonos: Severa lleva el saldo.',
        fields: [
          { key: 'tipo', label: 'Tipo', kind: 'choice', required: true, options: ['Fiado o cargo', 'Abono'], initial: 'Fiado o cargo' },
          { key: 'amount', label: 'Monto', kind: 'amount', required: true },
          { key: 'title', label: 'Detalle (opcional)', kind: 'text' },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
    ],
  },

  ficha_al_terminar: {
    code: 'ficha_al_terminar',
    title: 'Ficha al terminar',
    space: 'Trabajo',
    intro: 'Al terminar una cita o un trabajo anotas qué hiciste, cuánto cobraste y qué quedó pendiente. Con el tiempo es el historial de cada cliente.',
    minimum: 'Una ficha después de un trabajo.',
    connects: 'Clientes, Cobros y Agenda.',
    kinds: [
      {
        kind: 'ficha',
        label: 'Fichas',
        one: 'Ficha',
        empty: 'Termina un trabajo y anota lo importante en un minuto.',
        fields: [
          { key: 'title', label: 'Cliente o trabajo', kind: 'text', required: true },
          { key: 'body', label: 'Qué se hizo', kind: 'long', required: true },
          { key: 'pendiente', label: 'Qué quedó pendiente (opcional)', kind: 'text' },
          { key: 'amount', label: 'Cobrado (opcional)', kind: 'amount' },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
    ],
  },

  pedidos_y_costeo: {
    code: 'pedidos_y_costeo',
    title: 'Pedidos y costeo',
    space: 'Trabajo',
    intro: 'Pedidos con fecha de entrega, precio y costo: Severa te dice cuánto ganas en cada uno.',
    minimum: 'Un pedido.',
    connects: 'Calendario (entregas), Finanzas y Clientes.',
    widget: 'orders',
    kinds: [
      {
        kind: 'pedido',
        label: 'Pedidos',
        one: 'Pedido',
        checkable: 'Entregado',
        empty: 'Anota tu próximo pedido.',
        toCalendar: { layer: 'trabajo', prefix: 'Entrega: ' },
        fields: [
          { key: 'title', label: 'Cliente o pedido', kind: 'text', required: true },
          { key: 'day', label: 'Entrega', kind: 'date', initial: 'today' },
          { key: 'amount', label: 'Precio', kind: 'amount' },
          { key: 'costo', label: 'Costo de materiales (opcional)', kind: 'amount' },
          { key: 'body', label: 'Detalle (opcional)', kind: 'long' },
        ],
      },
    ],
  },

  turnos_y_faenas: {
    code: 'turnos_y_faenas',
    title: 'Turnos y faenas',
    space: 'Trabajo',
    intro: 'Qué te toca cada día: largo, noche, saliente, libre, o la subida y bajada de faena.',
    minimum: 'El turno de hoy o tu próxima subida.',
    connects: 'Hoy, Calendario y Tu rutina.',
    widget: 'shifts',
    kinds: [
      {
        kind: 'turno',
        label: 'Turnos',
        one: 'Turno',
        empty: 'Anota tus turnos para ver tu mes.',
        fields: [
          { key: 'tipo', label: 'Turno', kind: 'choice', required: true, options: ['Día', 'Largo', 'Noche', 'Saliente', 'Libre', 'Subida a faena', 'Bajada de faena'] },
          { key: 'day', label: 'Día', kind: 'date', required: true, initial: 'today' },
          { key: 'desde', label: 'Desde (opcional)', kind: 'time' },
          { key: 'hasta', label: 'Hasta (opcional)', kind: 'time' },
        ],
      },
    ],
  },

  ventas_y_productos: {
    code: 'ventas_y_productos',
    title: 'Ventas y productos',
    space: 'Trabajo',
    intro: 'Tus productos con precio y stock, y las ventas del día.',
    minimum: 'Un producto o una venta.',
    connects: 'Finanzas (lo vendido es ingreso), Clientes (fiados).',
    widget: 'sales',
    kinds: [
      {
        kind: 'venta',
        label: 'Ventas',
        one: 'Venta',
        empty: 'Registra cada venta.',
        fields: [
          { key: 'title', label: 'Producto', kind: 'choice', options: (c) => c.entries.filter((e) => e.kind === 'producto').map((e) => e.title ?? '').filter(Boolean), required: true },
          { key: 'value', label: 'Cantidad', kind: 'number', initial: '1' },
          { key: 'amount', label: 'Total (vacío = precio × cantidad)', kind: 'amount' },
          { key: 'day', label: 'Día', kind: 'date', initial: 'today' },
        ],
      },
      {
        kind: 'producto',
        label: 'Productos',
        one: 'Producto',
        empty: 'Agrega lo que vendes.',
        fields: [
          { key: 'title', label: 'Producto', kind: 'text', required: true },
          { key: 'amount', label: 'Precio', kind: 'amount', required: true },
          { key: 'value', label: 'Stock (opcional)', kind: 'number' },
        ],
      },
    ],
  },

  tareas_del_trabajo: {
    code: 'tareas_del_trabajo',
    title: 'Tareas del trabajo',
    space: 'Trabajo',
    intro: 'Pendientes y trámites del trabajo, separados de los personales.',
    minimum: 'Una tarea.',
    connects: 'Hoy en Trabajo y Prioridades.',
    kinds: [
      {
        kind: 'tarea',
        label: 'Tareas',
        one: 'Tarea',
        checkable: 'Hecha',
        empty: 'Lo pendiente del trabajo.',
        fields: [
          { key: 'title', label: 'Qué hay que hacer', kind: 'text', required: true, placeholder: 'Pagar el TAG' },
          { key: 'day', label: 'Para cuándo (opcional)', kind: 'date' },
        ],
      },
    ],
  },

  documentos_laborales: {
    code: 'documentos_laborales',
    title: 'Documentos laborales',
    space: 'Trabajo',
    intro: 'Contratos, finiquitos, certificados y liquidaciones, con su vencimiento.',
    minimum: 'Un documento.',
    connects: 'Mis trabajos y CV.',
    widget: 'expiry',
    kinds: [
      {
        kind: 'documento',
        label: 'Documentos',
        one: 'Documento',
        empty: 'Agrega tu contrato o un certificado.',
        fields: [
          { key: 'tipo', label: 'Tipo', kind: 'choice', required: true, options: ['Contrato', 'Anexo', 'Finiquito', 'Liquidación', 'Certificado', 'Licencia', 'Otro'] },
          { key: 'title', label: 'Nombre (opcional)', kind: 'text' },
          { key: 'until', label: 'Vence (opcional)', kind: 'date' },
          { key: 'body', label: 'Nota (opcional)', kind: 'long' },
        ],
      },
    ],
  },
};

/** El nombre a mostrar de un registro. */
export function entryTitle(e: Entry, def?: KindDef): string {
  const d = e.data;
  if (e.title) return e.title;
  if (typeof d.tipo === 'string') return d.tipo;
  if (typeof d.cuadrante === 'string') return d.cuadrante;
  if (Array.isArray(d.sintomas) && d.sintomas.length) return (d.sintomas as string[]).join(', ');
  if (e.body) return e.body.length > 60 ? `${e.body.slice(0, 60)}…` : e.body;
  return def?.one ?? 'Registro';
}
