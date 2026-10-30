import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { AgendaPrioritiesCard } from '@/features/agenda/PrioritiesCard';
import { SuggestionCard } from '@/features/discovery/SuggestionCard';
import { NextStepCard } from '@/features/goals/NextStepCard';
import { MODULES } from '@/features/modules/catalog';
import { ThreePartsMini } from '@/features/stats/ThreeParts';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { HabitsCard } from './HabitsCard';
import { BreathCard, MeditationCard, ZenCard } from './MindCards';
import { ModuleHomeCard } from './ModuleHomeCard';
import { BibleCard, DayCard, JournalCard, MoneyCard, WorkLinkCard } from './PersonalCards';
import type { Today } from './useToday';
import { JornadaCard, WorkLineCard, WorkTasksCard } from './WorkToday';

// Las tarjetas de Hoy por su clave (`dia`, `hab`, `mod:salud`…). Salieron de la pantalla de Hoy el
// 29-10-2026 para que también las use la pantalla de cada parte (cuerpo, mente y alma).

function PartsCard({ t }: { t: Today }) {
  const stats = useLifeStats(t.day);
  return <ThreePartsMini stats={stats} today={t.day} onOpen={() => router.push('/cuerpo-mente-alma')} />;
}

export function cardFor(key: string, t: Today, openSheet: (code: string) => void): ReactNode {
  switch (key) {
    case 'dia':
      return <DayCard t={t} onSeeAll={() => router.navigate('/calendario')} />;
    case 'paso':
      return <NextStepCard day={t.day} />;
    case 'yo':
      return <PartsCard t={t} />;
    case 'prio':
      return <AgendaPrioritiesCard day={t.day} />;
    case 'hab':
      return <HabitsCard t={t} />;
    case 'plata':
      return <MoneyCard t={t} />;
    case 'trab':
      return t.works ? <WorkLinkCard t={t} /> : null;
    // Severa v3 (29-10-2026): Trabajo vive en el cuerpo; su jornada, su línea y sus tareas son tarjetas.
    case 'jornada':
      return t.works ? <JornadaCard t={t} /> : null;
    case 'wline':
      return t.works ? <WorkLineCard t={t} /> : null;
    case 'wtasks':
      return t.works ? <WorkTasksCard t={t} /> : null;
    case 'pan':
      return t.on.has('biblia') ? <BibleCard t={t} /> : null;
    case 'diario':
      return t.on.has('diario') || t.on.has('gratitud') ? <JournalCard t={t} /> : null;
    case 'zen':
      return <ZenCard day={t.day} />;
    case 'resp':
      return <BreathCard day={t.day} />;
    case 'medit':
      return <MeditationCard day={t.day} />;
    case 'sug':
      return t.suggestion && t.isToday ? (
        <SuggestionCard suggestion={t.suggestion} neuron={t.neurons.find((n) => n.code === t.suggestion?.code)} onLater={t.skipSuggestion} onOpen={() => t.suggestion && openSheet(t.suggestion.code)} />
      ) : null;
    default:
      return key.startsWith('mod:') && MODULES[key.slice(4)] ? <ModuleHomeCard def={MODULES[key.slice(4)]} today={t.day} /> : null;
  }
}

// Las tarjetas que necesitan un módulo encendido o un trabajo para tener sentido.
const NEEDS: Record<string, string> = { pan: 'biblia', zen: 'zen', resp: 'respiracion', medit: 'meditacion' };
const WORK = new Set(['trab', 'jornada', 'wline', 'wtasks']);

/** Si la tarjeta `key` tiene algo que mostrar para esta persona (sin dibujarla). */
export function cardAvailable(key: string, t: Today): boolean {
  if (key.startsWith('mod:')) return t.on.has(key.slice(4)) && !!MODULES[key.slice(4)];
  if (WORK.has(key)) return !!t.works;
  if (key === 'diario') return t.on.has('diario') || t.on.has('gratitud');
  if (key === 'sug') return !!t.suggestion && t.isToday;
  return !NEEDS[key] || t.on.has(NEEDS[key]);
}
