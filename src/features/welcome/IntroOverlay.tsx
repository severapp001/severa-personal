import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { useAuth } from '@/data/auth';
import { useNeurons, useSynapses, useUserNeurons } from '@/data/discovery';
import { LiveBrain } from '@/features/discovery/LiveBrain';
import { LiveLogo } from '@/features/welcome/LiveLogo';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { Logo } from '@/ui/Logo';

// Inicio animado (usuario, 26-10-2026: «en ningún momento Severa hizo una animación al iniciar…
// con un espiral, un inicio dinámico, mostrando un cerebro o tarjetas con lo que puede hacer»).
// Cada vez que se abre la app: las neuronas nacen en la espiral áurea, se arma tu cerebro, pasan
// las cosas que hace Severa y aparece el logo. Se salta con un toque.

const CAPTIONS = ['Ordena tu día', 'Cuida tu plata', 'Suma tus hábitos', 'Escribe tu diario', 'Cruza a tu trabajo', 'Todo conectado'];
let shownThisLaunch = false;

export function IntroOverlay() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { session } = useAuth();
  const { neurons } = useNeurons();
  const synapses = useSynapses();
  const states = useUserNeurons(session?.user.id);
  const [visible, setVisible] = useState(() => !shownThisLaunch && !reduced);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) return;
    shownThisLaunch = true;
    const tick = setInterval(() => setStep((s) => s + 1), 520);
    const end = setTimeout(() => setVisible(false), 4100);
    return () => {
      clearInterval(tick);
      clearTimeout(end);
    };
  }, [visible]);

  if (!visible) return null;
  const caption = CAPTIONS[Math.min(step, CAPTIONS.length - 1)];
  const showLogo = step >= CAPTIONS.length;

  return (
    <Animated.View exiting={FadeOut.duration(420)} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.bg }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Saltar la animación" onPress={() => setVisible(false)} style={styles.fill}>
        <View style={{ alignItems: 'center', gap: 22 }}>
          {neurons.length ? <LiveBrain neurons={neurons} synapses={synapses} states={states} width={width - 32} impulses={24} /> : <LiveLogo run={0} />}
          <View style={{ height: 64, alignItems: 'center', justifyContent: 'center' }}>
            {showLogo ? (
              <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Logo size={34} />
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 26, letterSpacing: 7 }}>SEVERA</AppText>
                </View>
                <AppText variant="caption" muted>
                  Tu vida y tu trabajo, en un solo cerebro.
                </AppText>
              </Animated.View>
            ) : (
              <Animated.View key={caption} entering={FadeInDown.duration(300)} exiting={FadeOut.duration(160)}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 22, letterSpacing: 0.5 }} color={step % 2 ? colors.accent2 : colors.accent}>
                  {caption}
                </AppText>
              </Animated.View>
            )}
          </View>
        </View>
        <AppText variant="caption" muted style={styles.skip}>
          Toca para entrar
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skip: { position: 'absolute', bottom: 48 },
});
