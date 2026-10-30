import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { partScores, type Part } from '@/core/modules';
import { PART_INFO, PART_OF_MODULE, partOfCard } from '@/core/parts';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { MODULE_ROUTES } from '@/features/space/moduleRoutes';
import { partSignals } from '@/features/stats/ThreeParts';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { usePartColors } from '@/features/today/Figure';
import { cardFor } from '@/features/today/homeCards';
import { useToday } from '@/features/today/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Screen } from '@/ui';
import { CaretLeftIcon } from '@/ui/icons';
import { SERIF, useLayout } from '@/ui/layout';

// Cada parte de la persona (Severa v3, dirección A, 29-10-2026): Cuerpo, Mente o Alma, con su
// puntaje y lo que lo forma, las tarjetas de Hoy que le tocan y todos sus módulos. En el escritorio
// se llega desde la barra de arriba o tocando la figura; en el teléfono, tocando la figura.

const OWN_CARDS = ['dia', 'paso', 'prio', 'sug', 'hab', 'plata', 'trab', 'pan', 'diario', 'zen', 'resp', 'medit'];

export default function ParteScreen() {
  const { parte } = useLocalSearchParams<{ parte?: string }>();
  const part: Part = parte === 'cuerpo' || parte === 'alma' ? parte : 'mente';
  const info = PART_INFO[part];
  const { colors } = useTheme();
  const tint = usePartColors()[part];
  const { wide, columns } = useLayout();
  const t = useToday();
  const stats = useLifeStats(t.day);
  const score = partScores(partSignals(stats, t.day)).find((p) => p.part === part);
  const [sheet, setSheet] = useState<string | null>(null);
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;

  // Las tarjetas de esta parte: las propias de Hoy y las de sus módulos encendidos (Metas ya va en «paso»).
  const keys = [...OWN_CARDS, ...[...t.on].filter((c) => c !== 'metas').map((c) => `mod:${c}`)].filter((k) => partOfCard(k) === part);
  const cards = keys
    .map((k) => [k, cardFor(k, t, setSheet)] as const)
    .filter(([, node]) => node !== null)
    .map(([k, node]) => <View key={k}>{node}</View>);
  const cols: ReactNode[][] = Array.from({ length: wide ? columns : 1 }, () => []);
  cards.forEach((card, i) => cols[i % cols.length].push(card));

  // Sus módulos, los encendidos primero.
  const mods = t.neurons.filter((n) => PART_OF_MODULE[n.code] === part).sort((a, b) => Number(t.on.has(b.code)) - Number(t.on.has(a.code)));

  return (
    <Screen width="full">
      {wide ? null : (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/')} style={styles.back}>
          <CaretLeftIcon size={16} color={colors.muted} />
          <AppText variant="label" muted>
            Hoy
          </AppText>
        </Pressable>
      )}

      <View style={[styles.head, wide && { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }]}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <AppText style={styles.kicker} color={tint}>
            {info.verb.toUpperCase()}
          </AppText>
          <AppText style={{ fontFamily: SERIF, fontSize: wide ? 64 : 40, lineHeight: wide ? 68 : 44 }}>{info.name}</AppText>
          <AppText muted style={{ maxWidth: 560 }}>
            {info.about}
          </AppText>
        </View>
        <View style={{ alignItems: wide ? 'flex-end' : 'flex-start' }}>
          <AppText style={{ fontFamily: SERIF, fontSize: 56, lineHeight: 60 }} color={tint}>
            {score?.score === null || score === undefined ? '?' : `${score.score} %`}
          </AppText>
          <AppText variant="caption" muted>
            {score?.score === null ? 'Todavía no se sabe' : 'Lo que llevas los últimos días'}
          </AppText>
        </View>
      </View>

      {score ? (
        <View style={[styles.panel, { backgroundColor: colors.surface }]}>
          <AppText style={styles.kicker} color={colors.muted}>
            LO QUE LA FORMA
          </AppText>
          <View style={[styles.signals, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
            {score.known.map((s) => (
              <View key={s.name} style={[styles.signal, wide && { width: '31%' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="label" style={{ fontSize: 14 }}>
                    {s.name}
                  </AppText>
                  <AppText variant="label" style={{ fontSize: 14 }} color={tint}>{`${Math.round((s.value ?? 0) * 100)} %`}</AppText>
                </View>
                <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
                  <View style={[styles.fill, { width: `${Math.round((s.value ?? 0) * 100)}%`, backgroundColor: tint }]} />
                </View>
              </View>
            ))}
          </View>
          {score.missing.length ? (
            <AppText variant="caption" muted>
              {`Para conocerla mejor: ${score.missing
                .slice(0, 3)
                .map((m) => m.hint.toLowerCase())
                .join(' · ')}.`}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {cards.length ? (
        <View style={styles.columns}>
          {cols.map((col, i) => (
            <View key={i} style={styles.column}>
              {col}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <AppText style={styles.kicker} color={colors.muted}>
          {`SUS MÓDULOS · ${mods.filter((m) => t.on.has(m.code)).length} DE ${mods.length} ENCENDIDOS`}
        </AppText>
        <View style={styles.mods}>
          {mods.map((m) => {
            const on = t.on.has(m.code);
            return (
              <Pressable
                key={m.code}
                accessibilityRole="button"
                onPress={() => (MODULE_ROUTES[m.code] && on ? router.push(MODULE_ROUTES[m.code]) : setSheet(m.code))}
                style={[styles.mod, { backgroundColor: colors.surface, borderColor: on ? tint : colors.line }]}
              >
                <AppText variant="label" style={{ fontSize: 14 }} color={on ? colors.text : colors.muted}>
                  {m.name}
                </AppText>
                {on ? null : (
                  <AppText variant="caption" muted style={{ fontSize: 11 }}>
                    apagado
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  head: { gap: 16 },
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.6, fontSize: 12 },
  panel: { borderRadius: 22, padding: 18, gap: 14 },
  signals: { gap: 12 },
  signal: { gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  column: { flex: 1, minWidth: 0, gap: 16 },
  mods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mod: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
});
