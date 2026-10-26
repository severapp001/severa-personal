import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/features/today/PersonalCards';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { PlusIcon } from '@/ui/icons';
import { PriorityList } from './PriorityList';
import { usePriorities } from './usePriorities';

// Prioridades del día en Hoy (25-10-2026): ya no son 3 notas sueltas, sino la lista que se arma
// con la agenda, los hábitos, Estudios y Familia. Lo que se escribe aquí queda como tarea de hoy.

const VISIBLE = 6;

export function AgendaPrioritiesCard({ day }: { day: string }) {
  const { colors } = useTheme();
  const p = usePriorities(day);
  const [draft, setDraft] = useState('');
  const done = p.items.filter((i) => i.done).length;

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    tap();
    setDraft('');
    await p.agenda.addTask({ title, due_on: day, due_at: null, urgent: false });
  };

  return (
    <Card
      kicker="Prioridades del día"
      title={p.items.length ? `${done} de ${p.items.length} listas` : 'Nada pendiente por hoy'}
      right={
        <AppText variant="label" color={colors.accent} onPress={() => router.push('/prioridades')}>
          Todas
        </AppText>
      }
    >
      <PriorityList items={p.items.slice(0, VISIBLE)} onToggle={p.toggle} onLater={p.later} />
      {p.items.length > VISIBLE ? (
        <AppText variant="caption" color={colors.accent} onPress={() => router.push('/prioridades')}>
          {`Ver ${p.items.length - VISIBLE} más`}
        </AppText>
      ) : null}
      <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Agregar una tarea para hoy"
          placeholderTextColor={colors.muted}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Agregar tarea" onPress={add} hitSlop={8}>
          <PlusIcon size={20} color={draft.trim() ? colors.accent : colors.muted} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12 },
});
