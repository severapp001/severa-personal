import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { Logo } from '@/ui/Logo';

// Inicio animado (26-10-2026, idea del usuario: «que comiencen a llegar palabras para generar la
// espiral, comience a rotar y genere el logo de Severa»). Las palabras de la vida de la persona
// llegan desde los bordes y se ordenan en una espiral que se abre como la del logo; gira, las palabras
// se vuelven puntos y los puntos se acomodan sobre las dos mitades del M13, que aparece. Unos 5 s (27-10: «un poco más lenta»);
// se salta con un toque. Fases de `t`: 0 lejos · 1 espiral de palabras · 2 puntos girando · 3 logo.

// De adentro hacia afuera: las cortas al centro, donde la espiral es más apretada.
const WORDS = ['Fe', 'Zen', 'Amor', 'Alma', 'Foco', 'Mente', 'Calma', 'Ideas', 'Metas', 'Salud', 'Diario', 'Cuerpo', 'Viajes', 'Sueños', 'Logros', 'Biblia', 'Hábitos', 'Familia', 'Trabajo', 'Gratitud', 'Finanzas', 'Estudios', 'Ejercicio', 'Calendario'];
const STEP = 0.72; // radianes entre palabra y palabra (unas 2,7 vueltas)
const GROW = 1.088; // cuánto se abre la espiral en cada palabra (espiral logarítmica, como la del logo)
let shownThisLaunch = false;

const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Puntos sobre las dos mitades del M13 (viewBox 0–100), como en el logo vivo de la bienvenida.
function logoPoint(i: number): { u: number; v: number; gold: boolean } {
  let th: number;
  let k: number;
  if (i < 8) {
    th = ((137.4 + (i + 0.5) * 22.5) * Math.PI) / 180;
    return { u: 54.98 + 34.5 * Math.cos(th), v: 43.375 + 34.5 * Math.sin(th), gold: true };
  }
  if (i < 12) {
    k = (i - 7) / 5;
    return { u: 29.57 + 50.82 * k, v: 66.66 - 46.57 * k, gold: true };
  }
  if (i < 20) {
    th = ((-42.5 + (i - 12 + 0.5) * 22.5) * Math.PI) / 180;
    return { u: 45.02 + 34.5 * Math.cos(th), v: 56.625 + 34.5 * Math.sin(th), gold: false };
  }
  k = (i - 19) / 5;
  return { u: 19.61 + 50.82 * k, v: 79.91 - 46.57 * k, gold: false };
}

function Word({ i, t, spin, size, color }: { i: number; t: SharedValue<number>; spin: SharedValue<number>; size: number; color: string }) {
  const c = size / 2;
  const angle = i * STEP - Math.PI / 2;
  const r = size * 0.055 * Math.pow(GROW, i);
  const fromA = hash(i) * Math.PI * 2;
  const far = size * 0.9;
  const lp = logoPoint(i);
  const logoSize = size * 0.62;
  const L = { x: c - logoSize / 2 + (lp.u / 100) * logoSize, y: c - logoSize / 2 + (lp.v / 100) * logoSize };
  const sx = c + r * Math.cos(angle);
  const sy = c + r * Math.sin(angle);
  const box = useAnimatedStyle(() => {
    // Del espiral al logo se deshace el giro de la espiral, para que cada punto llegue a su lugar.
    const turn = (spin.value * Math.PI) / 180;
    const rx = c + (sx - c) * Math.cos(turn) - (sy - c) * Math.sin(turn);
    const ry = c + (sx - c) * Math.sin(turn) + (sy - c) * Math.cos(turn);
    const x = interpolate(t.value, [0, 1, 2, 3], [c + far * Math.cos(fromA), sx, rx, L.x]);
    const y = interpolate(t.value, [0, 1, 2, 3], [c + far * Math.sin(fromA), sy, ry, L.y]);
    return {
      opacity: interpolate(t.value, [0, 0.3, 3, 3.4], [0, 1, 1, 0], 'clamp'),
      transform: [{ translateX: x }, { translateY: y }],
    };
  });
  const label = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [1.2, 1.7], [1, 0], 'clamp'), transform: [{ scale: interpolate(t.value, [0, 1, 1.7], [0.7, 1, 0.3], 'clamp') }] }));
  const dot = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [1.3, 1.8], [0, 1], 'clamp'), transform: [{ scale: interpolate(t.value, [1.3, 2, 3], [0.2, 1.2, 0.9], 'clamp') }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.word, box]}>
      <Animated.View style={label}>
        <AppText numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 9 + Math.round((i / WORDS.length) * 8) }} color={color}>
          {WORDS[i]}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dot]} />
    </Animated.View>
  );
}

/** `preview`: solo en la vista previa de desarrollo, para verla otra vez. */
export function IntroOverlay({ preview = false }: { preview?: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => preview || (!shownThisLaunch && !reduced));
  const t = useSharedValue(0);
  const spin = useSharedValue(0);
  const size = Math.min(width - 24, 380);

  useEffect(() => {
    if (!visible) return;
    shownThisLaunch = true;
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    t.set(
      withSequence(
        withTiming(1, { duration: 1700, easing: ease }),
        withTiming(2, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        withTiming(3, { duration: 1200, easing: ease }),
        withTiming(3.4, { duration: 700 }),
      ),
    );
    spin.set(withSequence(withTiming(0, { duration: 1400 }), withTiming(220, { duration: 1900, easing: Easing.inOut(Easing.quad) })));
    const end = setTimeout(() => setVisible(false), 5300);
    return () => clearTimeout(end);
  }, [visible, t, spin]);

  const logo = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [2.7, 3.2], [0, 1], 'clamp'), transform: [{ scale: interpolate(t.value, [2.7, 3.4], [0.9, 1], 'clamp') }] }));
  const name = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [3.0, 3.4], [0, 1], 'clamp') }));

  if (!visible) return null;
  return (
    <Animated.View exiting={FadeOut.duration(300)} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.bg }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Saltar la animación" onPress={() => setVisible(false)} style={styles.fill}>
        <View style={{ width: size, height: size }}>
          {WORDS.map((w, i) => (
            <Word key={w} i={i} t={t} spin={spin} size={size} color={logoPoint(i).gold ? colors.accent : colors.text} />
          ))}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fill, logo]}>
            <Logo size={size * 0.62} />
          </Animated.View>
        </View>
        <Animated.View style={[{ alignItems: 'center', gap: 6, marginTop: 8 }, name]}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 30, letterSpacing: 9 }}>SEVERA</AppText>
          <AppText variant="caption" muted>
            Tu vida y tu trabajo, en un solo cerebro.
          </AppText>
        </Animated.View>
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
  // Una caja fija centrada en (0,0): el translate la lleva a su punto sin que el texto se corte.
  word: { position: 'absolute', left: -70, top: -14, width: 140, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', left: 65.5, top: 9.5, width: 9, height: 9, borderRadius: 5 },
  skip: { position: 'absolute', bottom: 48 },
});
