import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NeuronState } from '@/core/discovery';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { MODULE_ROUTES } from '@/features/space/moduleRoutes';
import { useToday } from '@/features/today/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, personalThemes } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';

// Módulos: las neuronas en lista, por hemisferio. Tocar una abre su hoja (qué es, lo mínimo,
// con qué se conecta). El mapa completo está en el cerebro.

const LABEL: Record<NeuronState, string> = { discovered: 'Encendida', suggested: 'Por completar', undiscovered: 'Por descubrir', off: 'Apagada' };

export default function ModulosScreen() {
  const { colors, theme, mode } = useTheme();
  const t = useToday();
  const [sheet, setSheet] = useState<string | null>(null);
  const base = personalThemes[theme];
  const groups = (mode === 'work' ? (['work', 'personal', 'bridge'] as const) : (['personal', 'work', 'bridge'] as const)).map((h) => ({
    h,
    list: t.neurons.filter((n) => n.hemisphere === h).sort((a, b) => rank(t.states[a.code]) - rank(t.states[b.code]) || a.sort_order - b.sort_order),
  }));
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;

  return (
    <Screen>
      <AppText variant="title">Módulos</AppText>
      <Button label="Ver el cerebro completo" kind="secondary" onPress={() => router.push('/cerebro')} />
      {groups.map(({ h, list }) => (
        <View key={h} style={{ gap: 8 }}>
          <AppText variant="caption" color={h === 'work' ? base.accent2 : h === 'bridge' ? colors.text : base.accent} style={styles.kicker}>
            {h === 'work' ? 'TRABAJO' : h === 'bridge' ? 'PUENTE ENTRE LOS DOS' : 'PERSONAL'}
          </AppText>
          <View style={styles.grid}>
            {list.map((n) => {
              const st = t.states[n.code] ?? 'undiscovered';
              const on = st === 'discovered';
              const color = h === 'work' ? base.accent2 : h === 'bridge' ? colors.text : base.accent;
              return (
                <Pressable
                  key={n.code}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.name}, ${LABEL[st]}`}
                  onPress={() => (MODULE_ROUTES[n.code] ? router.push(MODULE_ROUTES[n.code]) : setSheet(n.code))}
                  onLongPress={() => setSheet(n.code)}
                  style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : st === 'undiscovered' ? 0.6 : 1 }]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: on ? color : 'transparent', borderColor: st === 'undiscovered' ? colors.muted : color },
                    ]}
                  />
                  <AppText variant="label" numberOfLines={2} style={{ fontSize: 14 }}>
                    {n.name}
                  </AppText>
                  <AppText variant="caption" color={MODULE_ROUTES[n.code] ? colors.accent : colors.muted} style={{ fontSize: 11 }}>
                    {MODULE_ROUTES[n.code] ? 'Abrir' : LABEL[st]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const rank = (s?: NeuronState) => (s === 'discovered' ? 0 : s === 'suggested' ? 1 : 2);

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.4, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', flexGrow: 1, minHeight: 92, borderRadius: 18, padding: 12, gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
