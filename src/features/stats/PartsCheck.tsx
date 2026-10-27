import { Pressable, StyleSheet, View } from 'react-native';

import { plusDays } from '@/core/modules';
import { useEntries } from '@/data/entries';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';

// El chequeo del día de las tres partes (27-10-2026): cuerpo (energía y descanso), mente (calma y
// claridad) y alma (conexión y propósito), del 1 al 5. Se responde al cerrar el día o en Cuerpo,
// mente y alma; con los días se ve cómo van.

export const PARTS = [
  { key: 'cuerpo', label: 'Cuerpo', hint: 'Energía y descanso' },
  { key: 'mente', label: 'Mente', hint: 'Calma y claridad' },
  { key: 'alma', label: 'Alma', hint: 'Conexión y propósito' },
] as const;
export type PartKey = (typeof PARTS)[number]['key'];

export function useChecks(day: string) {
  const store = useEntries('cuerpo_mente_alma');
  const checks = store.of('chequeo');
  const today = checks.find((e) => e.day === day) ?? null;
  const set = (key: PartKey, n: number) => {
    const data = { ...(today?.data ?? {}), [key]: n };
    return today ? store.update(today.id, { data }) : store.add({ kind: 'chequeo', day, data });
  };
  /** Los últimos 7 días de una parte (0 si ese día no hubo chequeo). */
  const week = (key: PartKey) => Array.from({ length: 7 }, (_, i) => plusDays(day, i - 6)).map((d) => Number(checks.find((c) => c.day === d)?.data[key]) || 0);
  return { store, checks, today, set, week };
}

export function PartsCheck({ day, colorOf }: { day: string; colorOf?: (key: PartKey) => string }) {
  const { colors } = useTheme();
  const c = useChecks(day);
  return (
    <View style={{ gap: 12 }}>
      {PARTS.map((p) => {
        const v = Number(c.today?.data[p.key]) || 0;
        const tint = colorOf?.(p.key) ?? colors.accent;
        return (
          <View key={p.key} style={{ gap: 6 }}>
            <AppText variant="label">{`${p.label} · ${p.hint}`}</AppText>
            <View style={styles.scale}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: v === n }}
                  accessibilityLabel={`${p.label} ${n}`}
                  onPress={() => {
                    tap();
                    c.set(p.key, n);
                  }}
                  style={[styles.num, { backgroundColor: v === n ? tint : colors.surface2 }]}
                >
                  <AppText variant="label" color={v === n ? colors.onAccent : colors.text}>
                    {String(n)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Siete cuadritos: cómo estuvo esa parte cada día de la semana (más intenso, mejor). */
export function WeekSquares({ values, color }: { values: number[]; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.week}>
      {values.map((v, i) => (
        <View key={i} style={[styles.square, { backgroundColor: v ? color : colors.surface2, opacity: v ? 0.25 + (v / 5) * 0.75 : 1 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scale: { flexDirection: 'row', gap: 8 },
  num: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', gap: 3 },
  square: { width: 12, height: 12, borderRadius: 3 },
});
