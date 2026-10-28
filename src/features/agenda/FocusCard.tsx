import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PriorityItem } from '@/core/agenda';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';
import { useWay } from '@/features/mind/way';

// Lo más importante ahora (27-10-2026, usuario: «prioridades tiene muy poca relevancia»; con TDAH,
// una cosa a la vez): la primera prioridad sin hacer, grande, con un modo foco de 10, 25 o 45 minutos.
// Al terminar el tiempo, pregunta si quedó hecha.

const MINUTES = [10, 25, 45];
/** La hora de término (fuera del componente: se llama al tocar, nunca en el render). */
const endIn = (minutes: number) => Date.now() + minutes * 60 * 1000;

export function FocusCard({ item, onDone, onLater }: { item: PriorityItem | null; onDone: (i: PriorityItem) => void; onLater: (i: PriorityItem) => void }) {
  const { colors } = useTheme();
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [way] = useWay();
  // El bloque de foco elegido en «Mi forma de funcionar» va primero.
  const minutes = [way.foco, ...MINUTES.filter((m) => m !== way.foco)];

  // El contador corre en el intervalo (no en el render): con el compilador de React la hora del
  // render queda fija.
  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      const rest = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        clearInterval(id);
        setEndAt(null);
        setFinished(true);
        tap();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  if (!item) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <AppText variant="caption" muted style={styles.kicker}>
          LO MÁS IMPORTANTE AHORA
        </AppText>
        <AppText variant="title">Todo listo por hoy 🙌</AppText>
      </View>
    );
  }
  const start = (m: number) => {
    tap();
    setFinished(false);
    setLeft(m * 60);
    setEndAt(endIn(m));
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: endAt ? colors.accent : 'transparent' }]}>
      <AppText variant="caption" muted style={styles.kicker}>
        {endAt ? 'EN FOCO' : 'LO MÁS IMPORTANTE AHORA'}
      </AppText>
      <AppText variant="title" style={{ fontSize: 24, lineHeight: 30 }}>
        {item.title}
      </AppText>
      {item.sub ? (
        <AppText variant="caption" color={item.overdue ? colors.bad : colors.muted}>
          {item.sub}
        </AppText>
      ) : null}
      {endAt ? (
        <AppText style={{ fontFamily: fonts.extrabold, fontSize: 40, fontVariant: ['tabular-nums'] }}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</AppText>
      ) : finished ? (
        <AppText variant="label" color={colors.accent}>
          Se acabó el tiempo. ¿Quedó hecha?
        </AppText>
      ) : null}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => (tap(), setEndAt(null), setFinished(false), onDone(item))} style={[styles.btn, { backgroundColor: colors.accent }]}>
          <CheckIcon size={16} weight="bold" color={colors.onAccent} />
          <AppText variant="label" color={colors.onAccent}>
            Hecha
          </AppText>
        </Pressable>
        {endAt ? (
          <Pressable accessibilityRole="button" onPress={() => (tap(), setEndAt(null))} style={[styles.btn, { backgroundColor: colors.surface2 }]}>
            <AppText variant="label">Pausar</AppText>
          </Pressable>
        ) : (
          minutes.map((m) => (
            <Pressable key={m} accessibilityRole="button" accessibilityLabel={`Foco ${m} minutos`} onPress={() => start(m)} style={[styles.btn, { backgroundColor: colors.surface2 }]}>
              <AppText variant="label">{`${m} min`}</AppText>
            </Pressable>
          ))
        )}
      </View>
      {!endAt ? (
        <AppText variant="caption" color={colors.accent} onPress={() => (tap(), onLater(item))} suppressHighlighting>
          {item.origin === 'task' || item.origin === 'goal' ? 'Pasarla a mañana' : 'Hoy no'}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, gap: 10, borderWidth: 2 },
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 11 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
});
