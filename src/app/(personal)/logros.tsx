import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { dayKey } from '@/core/today';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { medals, type Medal } from '@/features/stats/medals';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Screen } from '@/ui';
import { MedalIcon, TrophyIcon } from '@/ui/icons';
import { Kicker } from '@/ui/kit';

// Logros (P9, 26-10-2026): medallas que se ganan solas con lo que registras en toda la app.

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
