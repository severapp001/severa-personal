import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { dayKey } from '@/core/today';
import { useEntries } from '@/data/entries';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { PHRASES, phraseOfDay, type Phrase } from '@/features/zen/phrases';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { HeartIcon } from '@/ui/icons';
import { Kicker, Panel, PillTabs } from '@/ui/kit';

// Zen (usuario, 26-10-2026): una frase para cada día y otras para cuando las necesites, por tema:
// cuerpo, mente y alma; TDAH y hábitos; metas; estoicismo y fe. Las favoritas se guardan.

const TOPICS = ['Todas', 'Favoritas', 'Cuerpo, mente y alma', 'TDAH y hábitos', 'Metas', 'Estoicismo', 'Fe'] as const;

export default function ZenScreen() {
  const { colors } = useTheme();
  const store = useEntries('zen');
  const today = dayKey(new Date());
  const [current, setCurrent] = useState<Phrase>(phraseOfDay(today));
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('Todas');
  const favs = store.of('favorita');
  const isFav = (p: Phrase) => favs.some((f) => f.title === p.id);
  const toggleFav = (p: Phrase) => {
    tap();
    const row = favs.find((f) => f.title === p.id);
    return row ? store.remove(row.id) : store.add({ kind: 'favorita', title: p.id, day: today });
  };
  const list = PHRASES.filter((p) => (topic === 'Todas' ? true : topic === 'Favoritas' ? isFav(p) : p.topic === topic));
  // «Otra frase» recorre la lista en orden desde la actual (sin azar: el render queda puro).
  const another = () => {
    tap();
    const pool = list.length ? list : PHRASES;
    const i = pool.findIndex((p) => p.id === current.id);
    setCurrent(pool[(i + 1 + pool.length) % pool.length] ?? current);
  };

  return (
    <Screen>
      <ModuleHeader kicker="Mente y alma" title="Zen" />
      <Animated.View key={current.id} entering={FadeIn.duration(400)} style={[styles.card, { backgroundColor: colors.surface }]}>
        <Kicker color={colors.accent}>{current.id === phraseOfDay(today).id ? 'La frase de hoy' : current.topic}</Kicker>
        <AppText style={styles.quote}>{current.kind === 'cita' ? `«${current.text}»` : current.text}</AppText>
        <AppText variant="caption" muted>
          {current.who}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={isFav(current) ? 'Quitar de favoritas' : 'Guardar en favoritas'} onPress={() => toggleFav(current)} style={[styles.round, { backgroundColor: isFav(current) ? colors.accentSoft : colors.surface2 }]}>
            <HeartIcon size={20} weight={isFav(current) ? 'fill' : 'regular'} color={colors.accent} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button label="Otra frase" kind="secondary" onPress={another} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Compartir" kind="secondary" onPress={() => Share.share({ message: `${current.text}\n— ${current.who}` })} />
          </View>
        </View>
      </Animated.View>
      <PillTabs options={TOPICS.map((t) => ({ value: t, label: t }))} value={topic} onChange={setTopic} />
      <Panel>
        {list.length ? (
          list.map((p) => (
            <Pressable key={p.id} onPress={() => setCurrent(p)} style={[styles.row, { borderBottomColor: colors.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontSize: 15 }}>{p.text}</AppText>
                <AppText variant="caption" muted>
                  {p.who}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => toggleFav(p)}>
                <HeartIcon size={18} weight={isFav(p) ? 'fill' : 'regular'} color={isFav(p) ? colors.accent : colors.muted} />
              </Pressable>
            </Pressable>
          ))
        ) : (
          <AppText variant="caption" muted>
            Toca el corazón de una frase para guardarla aquí.
          </AppText>
        )}
      </Panel>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Las ideas de libros con derechos van con palabras de Severa; las citas textuales son de obras de dominio público.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 22, gap: 12 },
  quote: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 31 },
  round: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
