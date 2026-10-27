import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { addDays } from '@/core/agenda';
import { useEntries } from '@/data/entries';
import { PHRASES, phraseOfDay, type Phrase } from '@/features/zen/phrases';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { HeartIcon, ShareNetworkIcon } from '@/ui/icons';
import { Card } from './PersonalCards';

// Tarjetas de Inicio para Zen, Respiración y Meditación (usuario, 27-10-2026: «por ejemplo Zen sería
// como Pan de vida, entregaría mensajes motivacionales en el inicio»).

export function ZenCard({ day }: { day: string }) {
  const { colors } = useTheme();
  const store = useEntries('zen');
  const [current, setCurrent] = useState<Phrase>(() => phraseOfDay(day));
  const fav = store.of('favorita').find((f) => f.title === current.id) ?? null;
  const another = () => {
    tap();
    const i = PHRASES.findIndex((p) => p.id === current.id);
    setCurrent(PHRASES[(i + 7) % PHRASES.length]);
  };
  return (
    <Card kicker={current.id === phraseOfDay(day).id ? 'Zen · la frase de hoy' : `Zen · ${current.topic}`}>
      <Animated.View key={current.id} entering={FadeIn.duration(350)} style={{ gap: 6 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/zen')}>
          <AppText style={styles.quote}>{current.kind === 'cita' ? `«${current.text}»` : current.text}</AppText>
        </Pressable>
        <AppText variant="caption" muted>
          {current.who}
        </AppText>
      </Animated.View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fav ? 'Quitar de favoritas' : 'Guardar en favoritas'}
          hitSlop={6}
          onPress={() => {
            tap();
            return fav ? store.remove(fav.id) : store.add({ kind: 'favorita', title: current.id, day });
          }}
          style={[styles.round, { backgroundColor: fav ? colors.accentSoft : colors.surface2 }]}
        >
          <HeartIcon size={18} weight={fav ? 'fill' : 'regular'} color={colors.accent} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Compartir" hitSlop={6} onPress={() => Share.share({ message: `${current.text}\n— ${current.who}` })} style={[styles.round, { backgroundColor: colors.surface2 }]}>
          <ShareNetworkIcon size={18} color={colors.muted} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <AppText variant="label" color={colors.accent} onPress={another} suppressHighlighting>
          Otra frase
        </AppText>
      </View>
    </Card>
  );
}

/** Minutos de la semana y racha de días seguidos con al menos una sesión. */
function useSessions(module: string, day: string) {
  const store = useEntries(module);
  const sessions = store.of('sesion');
  const weekFrom = addDays(day, -6);
  const week = sessions.filter((s) => (s.day ?? '') >= weekFrom && (s.day ?? '') <= day).reduce((n, s) => n + (Number(s.value) || 0), 0);
  const today = sessions.filter((s) => s.day === day).reduce((n, s) => n + (Number(s.value) || 0), 0);
  const days = new Set(sessions.map((s) => s.day));
  let streak = 0;
  for (let d = days.has(day) ? day : addDays(day, -1); days.has(d); d = addDays(d, -1)) streak++;
  return { week, today, streak, any: sessions.length > 0 };
}

export function BreathCard({ day }: { day: string }) {
  const { colors } = useTheme();
  const s = useSessions('respiracion', day);
  return (
    <Card kicker="Respiración" title={s.today ? `Hoy respiraste ${s.today} min` : 'Un minuto para respirar'}>
      <AppText variant="caption" muted>
        {s.any ? `Esta semana: ${s.week} min${s.streak > 1 ? ` · ${s.streak} días seguidos 🔥` : ''}` : 'Si sube la ansiedad o te cuesta enfocarte, la respiración en caja (4-4-4-4) te calma en un minuto.'}
      </AppText>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => (tap(), router.push('/respiracion'))} style={[styles.pill, { backgroundColor: colors.accent }]}>
          <AppText variant="label" color={colors.onAccent}>
            Respirar
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => (tap(), router.push('/respiracion'))} style={[styles.pill, { backgroundColor: colors.surface2 }]}>
          <AppText variant="label">5-4-3-2-1</AppText>
        </Pressable>
      </View>
    </Card>
  );
}

export function MeditationCard({ day }: { day: string }) {
  const { colors } = useTheme();
  const s = useSessions('meditacion', day);
  return (
    <Card kicker="Meditación" title={s.today ? `Hoy meditaste ${s.today} min` : s.streak ? `Racha de ${s.streak} ${s.streak === 1 ? 'día' : 'días'} 🔥` : 'Tu primera meditación'}>
      <AppText variant="caption" muted>
        {s.any ? `Esta semana: ${s.week} min. Unos minutos al día ya cambian cómo empiezas o terminas el día.` : 'Empieza con 3 minutos en silencio o con la guía «Quién quiero ser».'}
      </AppText>
      <Pressable accessibilityRole="button" onPress={() => (tap(), router.push('/meditacion'))} style={[styles.pill, { backgroundColor: colors.accent, alignSelf: 'flex-start' }]}>
        <AppText variant="label" color={colors.onAccent}>
          Meditar
        </AppText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  quote: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 25 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
});
