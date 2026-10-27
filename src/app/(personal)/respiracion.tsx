import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { dayKey } from '@/core/today';
import { useEntries } from '@/data/entries';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';
import { ChipRow, Kicker, Panel, PillTabs } from '@/ui/kit';

// Respiración y ansiedad (usuario, 26-10-2026): ejercicios guiados con un círculo que crece al
// inhalar y se achica al exhalar, y el 5-4-3-2-1 para volver al presente. Cada sesión queda
// registrada (motor común, módulo «respiracion») y suma a la mente y al alma.

type Phase = { label: string; seconds: number; to: number };
const PATTERNS: { id: string; name: string; hint: string; phases: Phase[] }[] = [
  { id: 'caja', name: 'Caja 4-4-4-4', hint: 'Para calmarte y enfocarte.', phases: [{ label: 'Inhala', seconds: 4, to: 1 }, { label: 'Sostén', seconds: 4, to: 1 }, { label: 'Exhala', seconds: 4, to: 0 }, { label: 'Sostén', seconds: 4, to: 0 }] },
  { id: '478', name: '4-7-8', hint: 'Para bajar la ansiedad o dormir.', phases: [{ label: 'Inhala', seconds: 4, to: 1 }, { label: 'Sostén', seconds: 7, to: 1 }, { label: 'Exhala lento', seconds: 8, to: 0 }] },
  { id: 'coherente', name: 'Coherente 5-5', hint: 'Para equilibrarte durante el día.', phases: [{ label: 'Inhala', seconds: 5, to: 1 }, { label: 'Exhala', seconds: 5, to: 0 }] },
  { id: 'suspiro', name: 'Suspiro', hint: 'Dos inhalaciones y una exhalación larga: alivia rápido.', phases: [{ label: 'Inhala', seconds: 2, to: 0.75 }, { label: 'Inhala un poco más', seconds: 1, to: 1 }, { label: 'Exhala largo', seconds: 6, to: 0 }] },
];
const GROUND = ['5 cosas que puedes ver', '4 cosas que puedes tocar', '3 sonidos que oyes', '2 olores que sientes', '1 sabor en tu boca'];

export default function RespiracionScreen() {
  const [tab, setTab] = useState<'respirar' | 'ansiedad'>('respirar');
  return (
    <Screen>
      <ModuleHeader kicker="Mente y alma" title="Respiración" />
      <PillTabs
        options={[
          { value: 'respirar', label: 'Respirar' },
          { value: 'ansiedad', label: 'Ansiedad: 5-4-3-2-1' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'respirar' ? <Breathe /> : <Grounding />}
    </Screen>
  );
}

function Breathe() {
  const { colors } = useTheme();
  const log = useEntries('respiracion');
  const [pattern, setPattern] = useState(PATTERNS[0].id);
  const [minutes, setMinutes] = useState('3');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const [cycles, setCycles] = useState(0);
  const size = useSharedValue(0);
  const p = PATTERNS.find((x) => x.id === pattern)!;
  const today = dayKey(new Date());
  const doneToday = log.of('sesion').filter((s) => s.day === today).reduce((sum, s) => sum + (Number(s.value) || 0), 0);

  // Cada fase dura sus segundos; el círculo se anima hacia su tamaño.
  useEffect(() => {
    if (!running) return;
    const ph = p.phases[phase];
    size.set(withTiming(ph.to, { duration: ph.seconds * 1000, easing: Easing.inOut(Easing.quad) }));
    tap();
    const t = setTimeout(() => {
      const next = (phase + 1) % p.phases.length;
      if (next === 0) setCycles((c) => c + 1);
      setPhase(next);
    }, ph.seconds * 1000);
    return () => clearTimeout(t);
  }, [running, phase, p, size]);

  const finish = (minutesDone: number) => {
    setRunning(false);
    size.set(withTiming(0, { duration: 600 }));
    if (minutesDone >= 1) log.add({ kind: 'sesion', day: today, title: p.name, value: minutesDone });
  };

  // Un contador por segundo; al llegar a la hora de término, la sesión se guarda ahí mismo.
  useEffect(() => {
    if (!running) return;
    const endAt = Date.now() + Number(minutes) * 60 * 1000;
    const t = setInterval(() => {
      const rest = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        clearInterval(t);
        finish(Number(minutes));
      }
    }, 1000);
    return () => clearInterval(t);
    // La sesión se arma al empezar; lo demás no cambia mientras corre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: 0.45 + 0.55 * size.value }], opacity: 0.35 + 0.65 * size.value }));
  const start = () => {
    tap();
    setPhase(0);
    setCycles(0);
    setLeft(Number(minutes) * 60);
    setRunning(true);
  };

  return (
    <>
      {!running ? (
        <Panel>
          <Kicker>Elige un ejercicio</Kicker>
          {PATTERNS.map((x) => (
            <Pressable key={x.id} accessibilityRole="radio" accessibilityState={{ checked: pattern === x.id }} onPress={() => setPattern(x.id)} style={[styles.option, { backgroundColor: pattern === x.id ? colors.accentSoft : colors.surface2 }]}>
              <AppText variant="label" color={pattern === x.id ? colors.accent : colors.text}>
                {x.name}
              </AppText>
              <AppText variant="caption" muted>
                {x.hint}
              </AppText>
            </Pressable>
          ))}
          <ChipRow
            options={[
              { value: '1', label: '1 minuto' },
              { value: '3', label: '3 minutos' },
              { value: '5', label: '5 minutos' },
              { value: '10', label: '10 minutos' },
            ]}
            value={minutes}
            onChange={setMinutes}
          />
          <Button label="Empezar" onPress={start} />
          {doneToday ? <AppText variant="caption" color={colors.ok}>{`Hoy llevas ${doneToday} ${doneToday === 1 ? 'minuto' : 'minutos'} respirando.`}</AppText> : null}
        </Panel>
      ) : null}
      <View style={styles.stage}>
        <Animated.View style={[styles.circle, { backgroundColor: colors.accent2 }, circle]} />
        <View style={styles.center}>
          <AppText style={{ fontFamily: fonts.extrabold, fontSize: 26 }}>{running ? p.phases[phase].label : 'Listo para respirar'}</AppText>
          {running ? (
            <AppText variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ${cycles} ${cycles === 1 ? 'ciclo' : 'ciclos'}`}</AppText>
          ) : null}
        </View>
      </View>
      {running ? (
        <Button
          label="Terminar"
          kind="secondary"
          onPress={() => finish(Math.round((Number(minutes) * 60 - left) / 60))}
        />
      ) : null}
    </>
  );
}

function Grounding() {
  const { colors } = useTheme();
  const log = useEntries('respiracion');
  const [done, setDone] = useState<number[]>([]);
  const all = done.length === GROUND.length;
  return (
    <Panel>
      <Kicker>Vuelve al presente</Kicker>
      <AppText variant="caption" muted>
        Cuando la ansiedad sube, nombra en voz baja lo que te rodea. Toca cada paso al terminarlo.
      </AppText>
      {GROUND.map((g, i) => {
        const on = done.includes(i);
        return (
          <Pressable
            key={g}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              const next = on ? done.filter((x) => x !== i) : [...done, i];
              setDone(next);
              if (next.length === GROUND.length) log.add({ kind: 'anclaje', day: dayKey(new Date()), title: '5-4-3-2-1' });
            }}
            style={[styles.step, { backgroundColor: on ? colors.okSoft : colors.surface2 }]}
          >
            <View style={[styles.check, { borderColor: on ? colors.ok : colors.line, backgroundColor: on ? colors.ok : 'transparent' }]}>{on ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : null}</View>
            <AppText variant="label" color={on ? colors.ok : colors.text}>
              {g}
            </AppText>
          </Pressable>
        );
      })}
      {all ? (
        <AppText variant="label" color={colors.ok}>
          Bien hecho. Respira una vez más, lento. Si la ansiedad no baja o es muy fuerte, busca ayuda: *4141 o 131.
        </AppText>
      ) : null}
      {done.length ? <Button label="Empezar de nuevo" kind="link" onPress={() => setDone([])} /> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  option: { borderRadius: 14, padding: 12, gap: 2 },
  stage: { height: 300, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  center: { alignItems: 'center', gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
