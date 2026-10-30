import type { LifeStats } from './useLifeStats';

// Las medallas de Logros (P9, 26-10-2026): se ganan solas con lo que registras en toda la app.
// Desde el 29-10 también dan el nivel de «Tu cuerpo» (Severa v3, con Fibonacci: core/parts.ts).

export type Medal = { id: string; name: string; desc: string; value: number; goal: number; area: string };

export function medals(s: LifeStats): Medal[] {
  const withData = Object.keys(s.counts).length + (s.habits.habits.length ? 1 : 0) + (s.journal.days.length ? 1 : 0) + (s.finance.movements.length ? 1 : 0);
  return [
    { id: 'inicio', area: 'Severa', name: 'Primer paso', desc: 'Conocerte completo', value: 1, goal: 1 },
    { id: 'explorador', area: 'Severa', name: 'Explorador', desc: '10 módulos con datos', value: withData, goal: 10 },
    { id: 'hab3', area: 'Hábitos', name: 'Arranque', desc: '3 días seguidos con hábitos', value: s.habitStreak, goal: 3 },
    { id: 'hab7', area: 'Hábitos', name: 'Una semana firme', desc: '7 días seguidos con hábitos', value: s.habitStreak, goal: 7 },
    { id: 'hab30', area: 'Hábitos', name: 'Ya es parte de ti', desc: '30 días seguidos con hábitos', value: s.habitStreak, goal: 30 },
    { id: 'dia7', area: 'Diario', name: 'Siete noches', desc: '7 días seguidos en el Diario', value: s.journalStreak, goal: 7 },
    { id: 'dia30', area: 'Diario', name: 'Tu historia', desc: '30 días escritos', value: s.journal.days.length, goal: 30 },
    { id: 'gra10', area: 'Gratitud', name: 'Corazón agradecido', desc: '10 cosas agradecidas', value: s.journal.gratitude.length, goal: 10 },
    { id: 'pla10', area: 'Finanzas', name: 'Cuentas claras', desc: '10 movimientos registrados', value: s.finance.movements.length, goal: 10 },
    { id: 'plaok', area: 'Finanzas', name: 'Mes en azul', desc: 'Un mes con más ingresos que gastos', value: s.month.income > 0 && s.month.result > 0 ? 1 : 0, goal: 1 },
    { id: 'eje150', area: 'Ejercicio', name: '150 de la OMS', desc: '150 minutos en una semana', value: s.exercise.total, goal: 150 },
    { id: 'eje10', area: 'Ejercicio', name: 'En movimiento', desc: '10 sesiones de ejercicio', value: s.entries.of('sesion').length, goal: 10 },
    { id: 'bib7', area: 'Biblia', name: 'Pan de cada día', desc: '7 días seguidos con la Biblia', value: s.bibleStreak, goal: 7 },
    { id: 'bib10', area: 'Biblia', name: 'Lector', desc: '10 % de la Biblia leída', value: s.bibleProgress.percent, goal: 10 },
    { id: 'tar10', area: 'Agenda', name: 'Semana productiva', desc: '10 tareas hechas en 7 días', value: s.tasksDone, goal: 10 },
    { id: 'jue10', area: 'Juegos', name: 'Mente ágil', desc: '10 partidas jugadas', value: s.games.length, goal: 10 },
  ];
}
