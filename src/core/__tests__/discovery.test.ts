import { describe, expect, it } from '@jest/globals';

import {
  initialStates,
  layoutBrain,
  planModules,
  questionList,
  suggest,
  type Neuron,
  type Trade,
} from '../discovery';

const trades: Trade[] = [
  { code: 'conductor', name: 'Conductor/a', tools: ['jornada', 'recorridos', 'gastos_del_trabajo', 'cobros_y_boletas'], beta_priority: 1, status: 'active', sort_order: 1 },
  { code: 'ventas', name: 'Ventas', tools: ['ventas_y_productos', 'clientes_y_pacientes', 'cobros_y_boletas', 'gastos_del_trabajo'], beta_priority: 4, status: 'active', sort_order: 4 },
];

const n = (code: string, hemisphere: Neuron['hemisphere'], level: number, sort_order: number): Neuron => ({
  code,
  name: code,
  hemisphere,
  level,
  minimum: null,
  summary: null,
  sensitive: false,
  min_age: code === 'salud' ? 16 : 14,
  sort_order,
});

describe('planModules', () => {
  it('suma los módulos de las necesidades y del oficio, sin repetir ni básicos', () => {
    const r = planModules(['finanzas', 'trabajo'], ['conductor'], trades);
    expect(r.plans).toEqual(['finanzas', 'trade:conductor']);
    expect(r.modules).toEqual(['finanzas', 'gastos_compartidos', 'documentos', 'trabajo', 'jornada', 'recorridos', 'gastos_del_trabajo', 'cobros_y_boletas']);
  });

  it('sin la necesidad «Mi trabajo» no suma las herramientas del oficio', () => {
    expect(planModules(['dia'], ['conductor'], trades).modules).toEqual(['habitos', 'diario', 'tu_rutina']);
  });

  it('el estudio suma el plan de estudiante', () => {
    expect(planModules([], ['study'], trades).plans).toEqual(['estudiante']);
  });
});

describe('initialStates', () => {
  it('plan rápido: lo respondido se enciende y lo saltado queda por completar', () => {
    const s = initialStates('quick', ['finanzas', 'documentos'], { documentos: 'skipped' }, ['conductor']);
    expect(s).toMatchObject({ perfil_personal: 'discovered', trabajo: 'discovered', finanzas: 'discovered', documentos: 'suggested', resumen: 'suggested', calendario: 'discovered' });
  });

  it('con calma: solo Perfil personal (y Trabajo si trabaja)', () => {
    expect(initialStates('calm', ['finanzas'], {}, ['no_work'])).toEqual({ perfil_personal: 'discovered' });
  });
});

describe('questionList', () => {
  it('pregunta por cada módulo con pregunta, más Calendario y Prioridades, sin Trabajo', () => {
    expect(questionList(['finanzas', 'trabajo', 'jornada'])).toEqual(['finanzas', 'jornada', 'calendario', 'prioridades']);
  });
});

describe('suggest', () => {
  const neurons = [
    n('perfil_personal', 'personal', 0, 1),
    n('habitos', 'personal', 1, 2),
    n('ejercicio', 'personal', 2, 3),
    n('diario', 'personal', 3, 4),
    n('salud', 'personal', 4, 5),
  ];
  const synapses = [
    { neuron_a: 'habitos', neuron_b: 'perfil_personal' },
    { neuron_a: 'ejercicio', neuron_b: 'habitos' },
    { neuron_a: 'diario', neuron_b: 'habitos' },
    { neuron_a: 'habitos', neuron_b: 'salud' },
  ];

  it('elige la vecina de lo encendido con el nivel más bajo', () => {
    const r = suggest(neurons, synapses, { perfil_personal: 'discovered' }, { interests: [], planModules: [], notInterested: [] });
    expect(r?.code).toBe('habitos');
  });

  it('los intereses adelantan una neurona y explican el motivo', () => {
    const r = suggest(neurons, synapses, { perfil_personal: 'discovered', habitos: 'discovered' }, { interests: ['deporte'], planModules: [], notInterested: [] });
    expect(r).toEqual({ code: 'ejercicio', reason: 'Porque te gusta hacer deporte' });
  });

  it('nunca sugiere lo sensible (nivel 4) ni lo marcado «no me interesa»', () => {
    const r = suggest(neurons, synapses, { perfil_personal: 'discovered', habitos: 'discovered' }, { interests: [], planModules: [], notInterested: ['ejercicio', 'diario'] });
    expect(r).toBeNull();
  });
});

describe('layoutBrain', () => {
  it('pone Personal a la izquierda, Trabajo a la derecha y Tu rutina abajo al centro', () => {
    const pos = layoutBrain([n('finanzas', 'personal', 1, 1), n('jornada', 'work', 1, 2), n('tu_rutina', 'bridge', 2, 3)]);
    expect(pos.finanzas.x).toBeLessThan(175);
    expect(pos.jornada.x).toBeGreaterThan(175);
    expect(pos.tu_rutina).toEqual({ x: 175, y: 262 });
  });
});
