import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { addDays } from '@/core/agenda';
import { dayEntry, MOODS } from '@/core/journal';
import { dayKey } from '@/core/today';
import { useEntries } from '@/data/entries';
import { useJournal } from '@/data/journal';
import { usePriorities } from '@/features/agenda/usePriorities';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { CLOSING_DEFAULT } from '@/features/notifications/useReminders';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { usePref } from '@/features/space/usePref';
import { PartsCheck } from '@/features/stats/PartsCheck';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';
import { Field, Panel, TimeField } from '@/ui/kit';

// Cerrar el día (usuario, 27-10-2026: «podría aparecer realmente al terminar el día… se podría
// enviar una notificación y que active el cierre de día, donde responde cosas necesarias para ir
// recopilando información»). Llega con el aviso a la hora que la persona elige y pregunta, paso a
// paso: cómo estuvo el día, cómo están el cuerpo, la mente y el alma, lo que quedó pendiente, algo
// bueno y lo primero de mañana. Todo se guarda donde ya vive (Diario, Gratitud, tareas) y el
// chequeo de las tres partes alimenta Cuerpo, mente y alma.

const STEPS = ['¿Cómo estuvo tu día?', '¿Cómo están tu cuerpo, tu mente y tu alma?', 'Lo que quedó pendiente', 'Algo para guardar', 'Mañana'];

export default function CierreScreen() {
  const { colors } = useTheme();
  const moodColor = useMoodColor();
  const day = dayKey(new Date());
  const journal = useJournal();
  const moments = useEntries('diario');
  const prio = usePriorities(day);
  const [closing, saveClosing] = usePref('cierre', CLOSING_DEFAULT);
  const [step, setStep] = useState(0);
  const [editHour, setEditHour] = useState(false);
  const [good, setGood] = useState('');
  const [happened, setHappened] = useState('');
  const [first, setFirst] = useState('');
  const [busy, setBusy] = useState(false);

  const entry = dayEntry(journal.days, day);
  const pending = prio.items.filter((i) => !i.done && i.origin !== 'habits');
  const tomorrow = addDays(day, 1);

  async function finish() {
    setBusy(true);
    try {
      if (good.trim()) await journal.addGratitude(day, good);
      if (happened.trim()) await moments.add({ kind: 'momento', day, body: happened.trim(), data: { hora: 'Cierre' } });
      if (first.trim()) await prio.agenda.addTask({ title: first.trim().slice(0, 120), due_on: tomorrow, due_at: null, urgent: false, notes: 'Desde el cierre del día' });
      await journal.saveDay(day, { closed: true });
      setStep(STEPS.length);
    } finally {
      setBusy(false);
    }
  }

  const next = () => {
    tap();
    setStep((s) => s + 1);
  };

  if (step >= STEPS.length || entry?.closed) {
    return (
      <Screen>
        <ModuleHeader kicker="Diario" title="Día cerrado" />
        <Animated.View entering={FadeIn.duration(400)} style={[styles.done, { backgroundColor: colors.surface }]}>
          <View style={[styles.doneIcon, { backgroundColor: colors.accent }]}>
            <CheckIcon size={28} weight="bold" color={colors.onAccent} />
          </View>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            Bien hecho. Descansa.
          </AppText>
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            Lo que contaste queda en tu Diario y suma a lo que Severa sabe de tu cuerpo, tu mente y tu alma.
          </AppText>
        </Animated.View>
        <Button label="Volver a Hoy" onPress={() => router.navigate('/')} />
        <Button label="Abrir el Diario" kind="secondary" onPress={() => router.push('/diario')} />
        {entry?.closed && step < STEPS.length ? <Button label="Volver a responder" kind="link" onPress={() => journal.saveDay(day, { closed: false })} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <ModuleHeader kicker={`Cerrar el día · ${step + 1} de ${STEPS.length}`} title={STEPS[step]} />
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.surface2 }]} />
        ))}
      </View>

      <Animated.View key={step} entering={FadeIn.duration(300)} style={{ gap: 12 }}>
        {step === 0 ? (
          <Panel>
            <View style={styles.moods}>
              {MOODS.map((m) => {
                const on = entry?.mood === m.value;
                return (
                  <Pressable
                    key={m.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      tap();
                      journal.saveDay(day, { mood: m.value });
                    }}
                    style={[styles.mood, { backgroundColor: on ? moodColor(m.value) : colors.surface2 }]}
                  >
                    <AppText variant="label" color={on ? colors.onAccent : colors.text}>
                      {m.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        ) : null}

        {step === 1 ? (
          <Panel>
            <AppText variant="caption" muted>
              Del 1 (muy bajo) al 5 (muy bien). Con los días, Severa te muestra cómo van las tres partes.
            </AppText>
            <PartsCheck day={day} />
          </Panel>
        ) : null}

        {step === 2 ? (
          <Panel>
            {pending.length ? (
              <>
                <AppText variant="caption" muted>
                  Márcalo si lo hiciste. Lo que no, pasa a mañana.
                </AppText>
                {pending.map((i) => (
                  <View key={i.key} style={[styles.pending, { borderBottomColor: colors.line }]}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={i.title} onPress={() => (tap(), prio.toggle(i))} style={[styles.box, { borderColor: colors.line }]} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{i.title}</AppText>
                      {i.sub ? (
                        <AppText variant="caption" muted>
                          {i.sub}
                        </AppText>
                      ) : null}
                    </View>
                    {i.origin === 'task' ? (
                      <AppText variant="label" color={colors.accent} onPress={() => (tap(), prio.later(i))}>
                        A mañana
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </>
            ) : (
              <AppText variant="label" color={colors.ok}>
                No quedó nada pendiente. 👏
              </AppText>
            )}
          </Panel>
        ) : null}

        {step === 3 ? (
          <Panel>
            <Field label="Algo bueno de hoy (va a Gratitud)" value={good} onChangeText={setGood} placeholder="Almorcé con mi familia" />
            <Field label="¿Qué pasó hoy? (va a tu Diario, solo para ti)" value={happened} onChangeText={setHappened} placeholder="Lo que quieras recordar" multiline />
          </Panel>
        ) : null}

        {step === 4 ? (
          <Panel>
            <Field label="¿Qué es lo primero que harás mañana?" value={first} onChangeText={setFirst} placeholder="Llamar al banco" />
            <AppText variant="caption" muted>
              Queda como tarea de mañana y aparece en tus prioridades.
            </AppText>
          </Panel>
        ) : null}
      </Animated.View>

      {step < STEPS.length - 1 ? <Button label="Siguiente" onPress={next} /> : <Button label="Cerrar el día" loading={busy} onPress={finish} />}
      {step > 0 ? <Button label="Atrás" kind="link" onPress={() => setStep(step - 1)} /> : null}

      <Panel>
        <View style={styles.row}>
          <AppText variant="caption" muted style={{ flex: 1 }}>
            {closing.aviso ? `Te aviso todos los días a las ${closing.hora}.` : 'El aviso para cerrar el día está apagado.'}
          </AppText>
          <AppText variant="label" color={colors.accent} onPress={() => setEditHour(!editHour)}>
            Cambiar
          </AppText>
        </View>
        {editHour ? (
          <>
            <View style={{ flexDirection: 'row' }}>
              <TimeField label="Hora del aviso" value={String(closing.hora)} onChange={(v) => /^\d{1,2}:\d{2}$/.test(v) && saveClosing({ hora: v, aviso: true })} />
            </View>
            <Button label={closing.aviso ? 'Apagar el aviso' : 'Encender el aviso'} kind="secondary" onPress={() => saveClosing({ aviso: !closing.aviso })} />
          </>
        ) : null}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mood: { flexGrow: 1, minWidth: '45%', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  done: { borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
