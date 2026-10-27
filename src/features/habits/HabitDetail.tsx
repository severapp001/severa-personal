import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { plusDays, streak } from '@/core/modules';
import { updateRecord } from '@/data/records';
import { useHabitHistory, type Habit } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button } from '@/ui';
import { tap } from '@/ui/haptics';
import { MinusIcon, PlusIcon } from '@/ui/icons';
import { ChipRow, Field, Kicker, Sheet } from '@/ui/kit';

// El detalle de un hábito (26-10-2026, noche; usuario: «la parte de los hábitos me gustaría
// mejorarla»): racha actual y mejor racha, el mapa de los últimos 35 días, y editar el nombre, la
// meta (o el límite, si es para bajar) y si es para sumar o para bajar.

export function HabitDetail({ habit, today, onClose, onArchive }: { habit: Habit | null; today: string; onClose: () => void; onArchive: (id: string) => void }) {
  return (
    <Sheet visible={!!habit} title={habit?.name ?? ''} onClose={onClose}>
      {habit ? <Body key={habit.id} habit={habit} today={today} onClose={onClose} onArchive={onArchive} /> : null}
    </Sheet>
  );
}

function Body({ habit, today, onClose, onArchive }: { habit: Habit; today: string; onClose: () => void; onArchive: (id: string) => void }) {
  const { colors } = useTheme();
  const from = plusDays(today, -120);
  const logs = useHabitHistory(habit.id, from);
  const [name, setName] = useState(habit.name);
  const [target, setTarget] = useState(Number(habit.daily_target) || 1);
  const [direction, setDirection] = useState<Habit['direction']>(habit.direction);
  const reduce = direction === 'reduce';
  const perDay = new Map<string, number>();
  for (const l of logs) perDay.set(l.day, (perDay.get(l.day) ?? 0) + Number(l.count));
  // Un día «cumplido»: llegó a la meta; si es para bajar, no pasó del límite (y lo marcó en la app).
  const okDays = [...perDay.entries()].filter(([, n]) => (reduce ? n <= target : n >= target)).map(([d]) => d);
  const current = streak(reduce ? Array.from({ length: 120 }, (_, i) => plusDays(today, -i)).filter((d) => (perDay.get(d) ?? 0) <= target) : okDays, today);
  let best = 0;
  let run = 0;
  for (let i = 120; i >= 0; i--) {
    const d = plusDays(today, -i);
    const n = perDay.get(d) ?? 0;
    const ok = reduce ? n <= target : n >= target;
    run = ok ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const days = Array.from({ length: 35 }, (_, i) => plusDays(today, i - 34));
  const total = [...perDay.values()].reduce((s, n) => s + n, 0);
  const changed = name.trim() !== habit.name || target !== (Number(habit.daily_target) || 1) || direction !== habit.direction;

  return (
    <>
      <View style={styles.stats}>
        {[
          [reduce ? 'Días dentro del límite' : 'Racha actual', `🔥 ${current}`],
          ['Mejor racha', String(best)],
          [reduce ? 'Contados (120 días)' : 'Veces (120 días)', String(total)],
        ].map(([k, v]) => (
          <View key={k} style={[styles.stat, { backgroundColor: colors.surface2 }]}>
            <AppText style={{ fontFamily: fonts.extrabold, fontSize: 20 }}>{v}</AppText>
            <AppText variant="caption" muted style={{ fontSize: 11, textAlign: 'center' }}>
              {k}
            </AppText>
          </View>
        ))}
      </View>
      <Kicker>Últimos 35 días</Kicker>
      <View style={styles.grid}>
        {days.map((d) => {
          const n = perDay.get(d) ?? 0;
          const ok = reduce ? n <= target : n >= target;
          const bg = d > today ? colors.surface2 : reduce ? (n === 0 ? colors.okSoft : ok ? colors.midSoft : colors.badSoft) : ok ? colors.ok : n ? colors.accent2Soft : colors.surface2;
          return <View key={d} style={[styles.cell, { backgroundColor: bg }]} accessibilityLabel={`${d}: ${n}`} />;
        })}
      </View>
      <Kicker>Editar</Kicker>
      <Field label="Nombre" value={name} onChangeText={setName} />
      <ChipRow
        options={[
          { value: 'good', label: 'Para sumar' },
          { value: 'reduce', label: 'Para bajar' },
        ]}
        value={direction}
        onChange={setDirection}
      />
      <View style={styles.row}>
        <AppText style={{ flex: 1 }}>{reduce ? 'Límite al día' : 'Meta al día'}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Menos" onPress={() => setTarget(Math.max(1, target - 1))} style={[styles.btn, { backgroundColor: colors.surface2 }]}>
          <MinusIcon size={18} color={colors.text} />
        </Pressable>
        <AppText style={{ fontFamily: fonts.extrabold, fontSize: 20, minWidth: 30, textAlign: 'center' }}>{String(target)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Más" onPress={() => setTarget(Math.min(50, target + 1))} style={[styles.btn, { backgroundColor: colors.surface2 }]}>
          <PlusIcon size={18} color={colors.text} />
        </Pressable>
      </View>
      {changed ? (
        <Button
          label="Guardar cambios"
          onPress={async () => {
            tap();
            await updateRecord('habits', habit.id, { name: name.trim().slice(0, 60) || habit.name, daily_target: target, direction });
            onClose();
          }}
        />
      ) : null}
      <Button
        label="Dejar de contarlo"
        kind="link"
        onPress={() =>
          Alert.alert('¿Dejar de contar?', `«${habit.name}» sale de tus hábitos. Lo ya contado se guarda.`, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Dejar de contar',
              style: 'destructive',
              onPress: () => {
                onArchive(habit.id);
                onClose();
              },
            },
          ])
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '12.5%', aspectRatio: 1, borderRadius: 6, flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
