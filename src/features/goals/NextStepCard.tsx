import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon, TargetIcon } from '@/ui/icons';
import { useGoals } from './useGoals';

// «Tu próximo paso» en Hoy (TDAH, 26-10-2026): una sola acción concreta de tus metas, para no
// abrumarse con todo el camino. Se marca aquí mismo y aparece la siguiente.
export function NextStepCard({ day }: { day: string }) {
  const { colors } = useTheme();
  const g = useGoals(day);
  const next = g.nextStep();
  if (!g.active.length) return null;
  const pct = next ? Math.round(g.progress(next.goal.id) * 100) : 0;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/metas')} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.head}>
        <TargetIcon size={18} color={colors.accent} />
        <AppText variant="caption" muted style={styles.kicker}>
          {next ? `TU PRÓXIMO PASO · ${String(next.goal.title ?? '').toUpperCase()}` : 'TUS METAS'}
        </AppText>
      </View>
      {next ? (
        <View style={styles.row}>
          <AppText variant="subtitle" style={{ flex: 1 }}>
            {next.step.title}
          </AppText>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            accessibilityLabel={`Hecho: ${next.step.title}`}
            hitSlop={8}
            onPress={() => {
              tap();
              g.toggleStep(next.step);
            }}
            style={[styles.check, { borderColor: colors.accent }]}
          >
            <CheckIcon size={16} weight="bold" color={colors.accent} />
          </Pressable>
        </View>
      ) : (
        <AppText variant="label">Agrega el próximo paso de tu meta para verlo aquí.</AppText>
      )}
      {next ? (
        <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
          <View style={{ width: `${Math.max(3, pct)}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 3 }} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { flex: 1, fontFamily: fonts.extrabold, letterSpacing: 1.1, fontSize: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 36, height: 36, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
});
