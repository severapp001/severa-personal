import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { greeting } from '@/core/today';
import { AgendaPrioritiesCard } from '@/features/agenda/PrioritiesCard';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { SuggestionCard } from '@/features/discovery/SuggestionCard';
import { SpaceTopBar } from '@/features/space/SpaceHeader';
import { HabitsCard } from '@/features/today/HabitsCard';
import {
  BibleCard,
  DayCard,
  JournalCard,
  MoneyCard,
  PrivateNote,
  WorkLinkCard,
} from '@/features/today/PersonalCards';
import { useToday, type Today } from '@/features/today/useToday';
import { JornadaCard, WorkLineCard, WorkTasksCard } from '@/features/today/WorkToday';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Screen } from '@/ui';

// Hoy (vista previa del 17-10-2026, variante B). En Personal se arma con lo que la persona eligió
// en Conocerte y se ordena según la hora; en Trabajo es el modo foco: la jornada y sus tareas.

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function Stagger({ children }: { children: ReactNode[] }) {
  return (
    <>
      {children.filter(Boolean).map((child, i) => (
        <Animated.View key={i} entering={FadeInDown.delay(Math.min(i, 6) * 60).duration(380)}>
          {child}
        </Animated.View>
      ))}
    </>
  );
}

function personalCards(t: Today, openSheet: (code: string) => void): ReactNode[] {
  const h = t.now.getHours();
  const night = h >= 20 || h < 4;
  const morning = h >= 4 && h < 11;
  const cards: Record<string, ReactNode> = {
    dia: <DayCard t={t} onSeeAll={() => router.navigate('/calendario')} />,
    prio: <AgendaPrioritiesCard day={t.day} />,
    hab: <HabitsCard t={t} />,
    plata: <MoneyCard t={t} />,
    trab: t.works ? <WorkLinkCard t={t} /> : null,
    pan: t.on.has('biblia') ? <BibleCard t={t} /> : null,
    diario: t.on.has('diario') || t.on.has('gratitud') ? <JournalCard t={t} night={night} /> : null,
    sug: t.suggestion ? (
      <SuggestionCard
        suggestion={t.suggestion}
        neuron={t.neurons.find((n) => n.code === t.suggestion?.code)}
        onLater={t.skipSuggestion}
        onOpen={() => t.suggestion && openSheet(t.suggestion.code)}
      />
    ) : null,
  };
  const order = night
    ? ['diario', 'dia', 'hab', 'prio', 'plata', 'trab', 'pan', 'sug']
    : morning
      ? ['dia', 'pan', 'prio', 'hab', 'trab', 'plata', 'diario', 'sug']
      : ['dia', 'trab', 'prio', 'hab', 'plata', 'pan', 'diario', 'sug'];
  return order.map((k) => cards[k]).filter(Boolean);
}

export default function HoyScreen() {
  const { colors, mode } = useTheme();
  const t = useToday();
  const [sheet, setSheet] = useState<string | null>(null);
  const work = mode === 'work';
  const date = `${DAYS[t.now.getDay()]} ${t.now.getDate()} de ${MONTHS[t.now.getMonth()]}`;
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;

  const body: ReactNode[] = work
    ? t.works
      ? [<JornadaCard key="j" t={t} />, <WorkLineCard key="l" t={t} />, <WorkTasksCard key="w" t={t} />]
      : [
          <AppText key="n" muted>
            En Conocerte no elegiste un oficio. Cuando agregues tu trabajo, aquí tendrás tu jornada en modo foco.
          </AppText>,
        ]
    : personalCards(t, setSheet);

  return (
    <Screen>
      <SpaceTopBar pip={!work && !!t.suggestion} />
      <View style={{ gap: 4 }}>
        <AppText variant="caption" muted style={{ letterSpacing: 1.6 }}>
          {`${work ? 'TRABAJO · MODO FOCO' : 'PERSONAL'} · ${date.toUpperCase()}`}
        </AppText>
        <AppText variant="title">{work ? (t.trade?.name ?? 'Trabajo') : `${greeting(t.now)}${t.name ? `, ${t.name}` : ''}`}</AppText>
      </View>
      {/* La clave por espacio vuelve a animar las tarjetas al cruzar. */}
      <View key={mode} style={{ gap: 12 }}>
        <Stagger>{body}</Stagger>
      </View>
      <PrivateNote />
      <View style={{ height: 8, backgroundColor: colors.bg }} />
      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
    </Screen>
  );
}
