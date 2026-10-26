import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { dayKey } from '@/core/today';
import { useHabitTemplates } from '@/data/discovery';
import { useHabits } from '@/data/modules';
import { EXTRA_HABITS, HabitPicker, type HabitSuggestion } from '@/features/habits/HabitPicker';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { MinusIcon, PlusIcon } from '@/ui/icons';
import { Empty, Kicker, Panel } from '@/ui/kit';

// Hábitos (F14): los tuyos con el conteo de hoy, y la lista de sugerencias con buscador para
// sumar más o crear uno propio. Mantén presionado un hábito para dejar de contarlo.

export default function HabitosScreen() {
  const { colors } = useTheme();
  const day = dayKey(new Date());
  const h = useHabits(day);
  const templates = useHabitTemplates();
  const suggestions: HabitSuggestion[] = [
    ...templates.map((t) => ({ code: t.code, name: t.name, direction: t.direction, target: t.target, unit: t.unit })),
    ...EXTRA_HABITS,
  ];
  const mine = h.habits.map((x) => x.template_code ?? `own:${x.id}`);
  const [picking, setPicking] = useState(false);

  const toggle = (s: HabitSuggestion) => {
    const existing = h.habits.find((x) => x.template_code === s.code);
    if (existing) h.archive(existing.id);
    else h.addHabit({ name: s.name, direction: s.direction, template_code: s.code, daily_target: s.target && s.target > 1 && s.target <= 20 ? s.target : 1, unit: s.unit ?? null });
  };

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Hábitos" />
      <Panel>
        <Kicker>Hoy</Kicker>
        {h.habits.length ? (
          h.habits.map((x) => {
            const n = h.countFor(x.id);
            const target = Number(x.daily_target) || 1;
            const reduce = x.direction === 'reduce';
            const done = !reduce && n >= target;
            return (
              <Pressable
                key={x.id}
                onLongPress={() =>
                  Alert.alert('¿Dejar de contar?', `«${x.name}» sale de tus hábitos. Lo ya contado se guarda.`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Dejar de contar', style: 'destructive', onPress: () => h.archive(x.id) },
                  ])
                }
                style={[styles.row, { borderBottomColor: colors.line }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label" style={{ fontSize: 15 }} color={done ? colors.ok : colors.text}>
                    {x.name}
                  </AppText>
                  <AppText variant="caption" muted>
                    {reduce ? (n ? `Hoy: ${n}. Sin culpas, solo números.` : 'Hoy: ninguno.') : `${n} de ${target}${x.unit ? ` ${x.unit}` : ''}${done ? ' · ¡listo!' : ''}`}
                  </AppText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Restar: ${x.name}`} onPress={() => n && h.log(x.id, -1)} style={[styles.btn, { backgroundColor: colors.surface2 }]}>
                  <MinusIcon size={18} color={colors.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sumar: ${x.name}`}
                  onPress={() => {
                    tap();
                    h.log(x.id, 1);
                  }}
                  style={[styles.btn, { backgroundColor: reduce ? colors.midSoft : colors.accentSoft }]}
                >
                  <PlusIcon size={18} color={reduce ? colors.mid : colors.accent} />
                </Pressable>
              </Pressable>
            );
          })
        ) : (
          <Empty text="Elige abajo los hábitos que quieres contar." />
        )}
      </Panel>
      {/* Con hábitos ya elegidos, la lista de sugerencias queda guardada detrás de un botón
          (pedido del usuario, 25-10-2026). */}
      {h.habits.length && !picking ? (
        <Button label="Agregar o quitar hábitos" kind="secondary" onPress={() => setPicking(true)} />
      ) : (
        <>
          <Kicker>{h.habits.length ? 'Agregar o quitar' : 'Sugerencias'}</Kicker>
          <HabitPicker
            suggestions={suggestions}
            chosen={mine}
            onToggle={toggle}
            onCreate={(name) => h.addHabit({ name, direction: 'good' })}
          />
          {h.habits.length ? <Button label="Listo" onPress={() => setPicking(false)} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  btn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
