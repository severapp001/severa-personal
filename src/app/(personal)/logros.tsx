import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { dayKey } from '@/core/today';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useLifeStats, type LifeStats } from '@/features/stats/useLifeStats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Screen } from '@/ui';
import { MedalIcon, TrophyIcon } from '@/ui/icons';
import { Kicker } from '@/ui/kit';

// Logros (P9, 26-10-2026): medallas que se ganan solas con lo que registras en toda la app.

type Medal = { id: string; name: string; desc: string; value: number; goal: number; area: string };

function medals(s: LifeStats): Medal[] {
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

export default function LogrosScreen() {
  const { colors } = useTheme();
  const s = useLifeStats(dayKey(new Date()));
  const list = medals(s);
  const won = list.filter((m) => m.value >= m.goal);
  const next = list.filter((m) => m.value < m.goal).sort((a, b) => b.value / b.goal - a.value / a.goal);

  const card = (m: Medal, i: number) => {
    const ok = m.value >= m.goal;
    const pct = Math.min(1, m.value / m.goal);
    return (
      <Animated.View key={m.id} entering={FadeInDown.delay(Math.min(i, 10) * 40)} style={[styles.card, { backgroundColor: colors.surface, borderColor: ok ? colors.accent : 'transparent' }]}>
        <View style={[styles.badge, { backgroundColor: ok ? colors.accentSoft : colors.surface2 }]}>
          {ok ? <TrophyIcon size={26} weight="fill" color={colors.accent} /> : <MedalIcon size={26} color={colors.muted} />}
        </View>
        <AppText variant="caption" muted style={{ fontFamily: fonts.extrabold, letterSpacing: 1, fontSize: 10 }}>
          {m.area.toUpperCase()}
        </AppText>
        <AppText variant="label" color={ok ? colors.text : colors.muted}>
          {m.name}
        </AppText>
        <AppText variant="caption" muted style={{ fontSize: 12 }}>
          {m.desc}
        </AppText>
        {!ok ? (
          <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
            <View style={{ width: `${Math.max(4, pct * 100)}%`, height: '100%', backgroundColor: colors.accent2, borderRadius: 3 }} />
          </View>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Logros" />
      <AppText variant="subtitle">{`${won.length} de ${list.length} medallas`}</AppText>
      <AppText variant="caption" muted>
        Se ganan solas con lo que registras en Hábitos, Diario, Finanzas, Ejercicio, Biblia, Agenda y Juegos.
      </AppText>
      {won.length ? (
        <>
          <Kicker color={colors.accent}>Ganadas</Kicker>
          <View style={styles.grid}>{won.map(card)}</View>
        </>
      ) : null}
      <Kicker>Por ganar</Kicker>
      <View style={styles.grid}>{next.map(card)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '48%', flexGrow: 1, borderRadius: 20, padding: 12, gap: 3, borderWidth: 1.5 },
  badge: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
});
