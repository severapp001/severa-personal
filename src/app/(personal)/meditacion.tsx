import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { plusDays, streak } from '@/core/modules';
import { dayKey } from '@/core/today';
import { useEntries } from '@/data/entries';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ChipRow, Kicker, Panel } from '@/ui/kit';

// Meditación (usuario, 26-10-2026): un temporizador con una luz que respira lento y, si quieres,
// una guía corta que cambia cada minuto (con textos propios de Severa). Cada sesión suma a la mente
// y al alma, y lleva su racha.

const GUIDES: Record<string, string[]> = {
  respiracion: ['Siente el aire que entra y sale. No lo cambies, solo míralo.', 'Si te distraes, está bien: vuelve al aire, sin juzgarte.', 'Nota la pausa entre una respiración y otra.', 'Cada vez que vuelves, entrenas tu atención.'],
  cuerpo: ['Lleva la atención a tus pies. ¿Qué sientes ahí?', 'Sube a las piernas y suelta la tensión.', 'Ahora la espalda y los hombros: déjalos caer.', 'Afloja la mandíbula y la frente.', 'Siente el cuerpo entero, quieto, respirando.'],
  futuro: ['Imagina a la persona que quieres ser. ¿Cómo piensa?', '¿Cómo se siente al despertar? Siéntelo ahora.', '¿Qué hace distinto en un día normal?', 'Quédate con esa emoción unos segundos, como si ya fuera cierto.', 'Elige un paso chico de hoy que esa persona daría.'],
  gratitud: ['Piensa en algo bueno que pasó hoy, por pequeño que sea.', 'Piensa en una persona que te quiere. Agradécele en silencio.', 'Agradece algo de tu cuerpo que hoy funcionó bien.', 'Quédate con la sensación de tener suficiente.'],
};
const GUIDE_LABEL: Record<string, string> = { silencio: 'En silencio', respiracion: 'Respiración', cuerpo: 'Recorrer el cuerpo', futuro: 'Quién quiero ser', gratitud: 'Gratitud' };

export default function MeditacionScreen() {
  const { colors } = useTheme();
  const log = useEntries('meditacion');
  const [minutes, setMinutes] = useState('5');
  const [guide, setGuide] = useState('respiracion');
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const glow = useSharedValue(0);
  const today = dayKey(new Date());
  const sessions = log.of('sesion');
  const racha = streak(sessions.map((s) => s.day ?? ''), today);
  const week = sessions.filter((s) => (s.day ?? '') >= plusDays(today, -6)).reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  const total = Number(minutes) * 60;
  const lines = GUIDES[guide] ?? [];
  const line = guide !== 'silencio' && running ? lines[Math.floor((total - left) / 60) % lines.length] : null;

  const finish = (minutesDone: number, completed: boolean) => {
    setRunning(false);
    setEnded(completed);
    if (completed) tap();
    glow.set(withTiming(0, { duration: 1000 }));
    if (minutesDone >= 1) log.add({ kind: 'sesion', day: today, title: GUIDE_LABEL[guide], value: minutesDone });
  };

  // Un contador por segundo; al llegar a la hora de término, la sesión se guarda ahí mismo.
  useEffect(() => {
    if (!running) return;
    glow.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true));
    const endAt = Date.now() + total * 1000;
    const t = setInterval(() => {
      const rest = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        clearInterval(t);
        finish(Number(minutes), true);
      }
    }, 1000);
    return () => clearInterval(t);
    // La sesión se arma al empezar; lo demás no cambia mientras corre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const orb = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + 0.3 * glow.value }], opacity: 0.25 + 0.5 * glow.value }));

  return (
    <Screen>
      <ModuleHeader kicker="Mente y alma" title="Meditación" />
      {!running ? (
        <Panel>
          <Kicker>{racha ? `Racha de ${racha} ${racha === 1 ? 'día' : 'días'} · ${week} min esta semana` : 'Tu primera meditación'}</Kicker>
          <ChipRow
            options={['3', '5', '10', '15', '20'].map((m) => ({ value: m, label: `${m} min` }))}
            value={minutes}
            onChange={setMinutes}
          />
          <ChipRow options={Object.entries(GUIDE_LABEL).map(([value, label]) => ({ value, label }))} value={guide} onChange={setGuide} />
          <Button
            label="Empezar"
            onPress={() => {
              tap();
              setEnded(false);
              setLeft(total);
              setRunning(true);
            }}
          />
          {ended ? <AppText variant="label" color={colors.ok}>Listo. Quédate un momento quieto antes de seguir.</AppText> : null}
        </Panel>
      ) : null}
      <View style={styles.stage}>
        <Animated.View style={[styles.orb, { backgroundColor: colors.accent }, orb]} />
        <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 24 }}>
          <AppText style={{ fontFamily: fonts.extrabold, fontSize: 40, fontVariant: ['tabular-nums'] }}>{running ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${minutes}:00`}</AppText>
          {line ? (
            <AppText style={{ fontSize: 17, textAlign: 'center' }} muted>
              {line}
            </AppText>
          ) : null}
        </View>
      </View>
      {running ? (
        <Button
          label="Terminar"
          kind="secondary"
          onPress={() => finish(Math.round((total - left) / 60), false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { height: 320, alignItems: 'center', justifyContent: 'center' },
  orb: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
});
