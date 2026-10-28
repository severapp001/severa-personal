import { Pressable, StyleSheet, View } from 'react-native';

import type { Neuron } from '@/core/discovery';
import { dayKey } from '@/core/today';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { Kicker, Sheet } from '@/ui/kit';
import { useInsights } from './useInsights';

// «Lo que ve tu cerebro» (27-10-2026): las relaciones que aparecen en lo que registras, con las dos
// neuronas que conectan. Tocar una lleva a esa neurona en el cerebro.

export function InsightsSheet({ visible, neurons, onClose, onPick }: { visible: boolean; neurons: Neuron[]; onClose: () => void; onPick: (code: string) => void }) {
  return (
    <Sheet visible={visible} title="Lo que ve tu cerebro" onClose={onClose}>
      {visible ? <Body neurons={neurons} onPick={onPick} /> : null}
    </Sheet>
  );
}

function Body({ neurons, onPick }: { neurons: Neuron[]; onPick: (code: string) => void }) {
  const { colors } = useTheme();
  const { insights, missing } = useInsights(dayKey(new Date()));
  const name = (code: string) => neurons.find((n) => n.code === code)?.name ?? code;
  return (
    <>
      <AppText variant="caption" muted>
        Severa compara tus últimas 8 semanas: qué acompaña a tus días de buen ánimo, a tu energía y a tu calma, y cuándo gastas más.
      </AppText>
      {insights.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="button"
          onPress={() => {
            tap();
            onPick(i.modules[0]);
          }}
          style={[styles.card, { backgroundColor: colors.surface2 }]}
        >
          <AppText variant="label" style={{ fontSize: 15 }}>
            {i.title}
          </AppText>
          <AppText variant="caption" muted>
            {i.detail}
          </AppText>
          <AppText variant="caption" color={colors.accent}>{`${name(i.modules[0])} ↔ ${name(i.modules[1])}`}</AppText>
        </Pressable>
      ))}
      {!insights.length ? (
        <AppText variant="label">Todavía no veo relaciones claras: necesito unos días más de datos.</AppText>
      ) : null}
      {missing.length ? (
        <View style={{ gap: 4 }}>
          <Kicker>Para conocerte mejor</Kicker>
          {missing.map((m) => (
            <AppText key={m} variant="caption">{`• ${m}`}</AppText>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, gap: 4 },
});
