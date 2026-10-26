import { Pressable, StyleSheet, View } from 'react-native';

import type { PriorityItem } from '@/core/agenda';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';

// Una fila por prioridad: el visto la marca y «Después» la saca de hoy (la tarea pasa a mañana).

export function PriorityList({ items, onToggle, onLater, onOpen }: { items: PriorityItem[]; onToggle: (i: PriorityItem) => void; onLater?: (i: PriorityItem) => void; onOpen?: (i: PriorityItem) => void }) {
  const { colors } = useTheme();
  return (
    <View>
      {items.map((i) => (
        <View key={i.key} style={[styles.row, { borderBottomColor: colors.line }]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: i.done }}
            accessibilityLabel={i.title}
            hitSlop={8}
            onPress={() => {
              tap();
              onToggle(i);
            }}
            style={[styles.check, { backgroundColor: i.done ? colors.accent : 'transparent', borderColor: i.done ? colors.accent : i.overdue ? colors.bad : colors.line }]}
          >
            {i.done ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
          </Pressable>
          <Pressable style={{ flex: 1, gap: 2 }} disabled={!onOpen} onPress={() => onOpen?.(i)}>
            <AppText variant="label" style={{ fontSize: 15, textDecorationLine: i.done ? 'line-through' : 'none' }} color={i.done ? colors.muted : colors.text}>
              {i.time ? `${i.time} · ` : ''}
              {i.title}
              {i.urgent && !i.done ? '  ·  urgente' : ''}
            </AppText>
            <AppText variant="caption" color={i.overdue ? colors.bad : colors.muted}>
              {i.sub}
            </AppText>
          </Pressable>
          {onLater && !i.done && i.origin !== 'habits' ? (
            <AppText variant="caption" color={colors.accent} onPress={() => onLater(i)} accessibilityRole="button">
              {i.origin === 'task' ? 'Mañana' : 'Quitar'}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
