import { Alert, StyleSheet, View } from 'react-native';

import type { Entries } from '@/data/entries';
import { useEntries } from '@/data/entries';
import { useAgenda } from '@/data/agenda';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { Empty, Sheet } from '@/ui/kit';

// Tus ideas (usuario, 27-10-2026: «dejaría algo como ideas, quizás el asistente estaría bien»):
// lo que se te ocurre se anota al tiro en el Asistente («idea: …») y después se ordena: se vuelve
// una meta con su camino, una tarea o se borra. Con TDAH, sacar la idea de la cabeza ya ayuda.

/** «idea: vender el auto» → «vender el auto»; si no empieza con «idea», null. */
export function ideaText(raw: string): string | null {
  const m = /^\s*(?:💡\s*)?idea\s*[:,.-]?\s+(.+)$/is.exec(raw);
  return m ? m[1].trim().slice(0, 300) : null;
}

export function useIdeas(): Entries {
  return useEntries(['ideas', 'metas']);
}

export function IdeasSheet({ visible, onClose, today }: { visible: boolean; onClose: () => void; today: string }) {
  const { colors } = useTheme();
  const store = useIdeas();
  const agenda = useAgenda(today, today);
  const ideas = store.entries.filter((e) => e.module === 'ideas' && e.kind === 'idea' && !e.done).sort((a, b) => (b.day ?? '').localeCompare(a.day ?? ''));
  const used = (id: string, to: string) => store.update(id, { done: true, data: { to } });

  const choose = (id: string, title: string) =>
    Alert.alert(title, '¿Qué hacemos con esta idea?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => store.remove(id) },
      {
        text: 'Volverla tarea',
        onPress: async () => {
          await agenda.addTask({ title: title.slice(0, 120), due_on: null, due_at: null, urgent: false, notes: 'Desde tus ideas' });
          await used(id, 'tarea');
        },
      },
      {
        text: 'Volverla meta',
        onPress: async () => {
          await store.add({ module: 'metas', kind: 'meta', title: title.slice(0, 120), day: today, data: { parte: 'Mente', tipo: 'Meta', desde: 'idea' } });
          await used(id, 'meta');
        },
      },
    ]);

  return (
    <Sheet visible={visible} title="Tus ideas" onClose={onClose}>
      <AppText variant="caption" muted>
        Escribe en el Asistente «idea: …» y queda aquí. Toca una para volverla meta (con su camino), tarea o borrarla.
      </AppText>
      {ideas.length ? (
        ideas.map((i) => (
          <View key={i.id} style={[styles.row, { borderBottomColor: colors.line }]}>
            <AppText
              style={{ flex: 1, fontSize: 15 }}
              onPress={() => {
                tap();
                choose(i.id, i.title ?? '');
              }}
            >
              {`💡 ${i.title ?? ''}`}
            </AppText>
            <AppText variant="caption" muted>
              {i.day ? `${i.day.slice(8, 10)}-${i.day.slice(5, 7)}` : ''}
            </AppText>
          </View>
        ))
      ) : (
        <Empty text="Todavía no anotas ideas. Prueba: «idea: vender el auto y comprar uno más chico»." />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
