import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Logo } from '@/ui/Logo';

// Logo vivo (L1, E3·20): 24 nodos dispersos buscan, se ordenan en una espiral con el ángulo
// áureo (137,5°), la espiral gira y, al girar, los nodos se acomodan sobre las dos mitades del
// M13; luego aparece el logo. Fases: 0 dispersos · 1 buscando · 2 espiral · 3 logo · 4 logo final.

const SIZE = 300;
const C = SIZE / 2;
const N = 24;
const GOLD = '#D4AF5A';
const STEEL = '#8DB6CF';
const WHITE = '#F4F1EA';

// Pseudoazar fijo para que el dibujo sea siempre el mismo.
const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Puntos sobre las dos mitades del M13 (viewBox 0–100, centros de los arcos en el logo oficial).
function logoPoint(i: number) {
  let u: number;
  let v: number;
  let k: number;
  let th: number;
  if (i < 8) {
    th = ((137.4 + (i + 0.5) * 22.5) * Math.PI) / 180;
    u = 54.98 + 34.5 * Math.cos(th);
    v = 43.375 + 34.5 * Math.sin(th);
  } else if (i < 12) {
    k = (i - 7) / 5;
    u = 29.57 + 50.82 * k;
    v = 66.66 - 46.57 * k;
  } else if (i < 20) {
    th = ((-42.5 + (i - 12 + 0.5) * 22.5) * Math.PI) / 180;
    u = 45.02 + 34.5 * Math.cos(th);
    v = 56.625 + 34.5 * Math.sin(th);
  } else {
    k = (i - 19) / 5;
    u = 19.61 + 50.82 * k;
    v = 79.91 - 46.57 * k;
  }
  const scale = (SIZE - 60) / 100;
  return { x: 30 + u * scale, y: 30 + v * scale, gold: i < 12 };
}

type NodePlan = { xs: number[]; ys: number[]; from: string; to: string; spiralSize: number };

function plan(): NodePlan[] {
  return Array.from({ length: N }, (_, i) => {
    const angle = (i * 137.508 * Math.PI) / 180;
    const r = 18 * Math.sqrt(i + 0.6);
    const lp = logoPoint(i);
    return {
      xs: [-30 + hash(i) * (SIZE + 60), 20 + hash(i + 80) * (SIZE - 40), C + r * Math.cos(angle), lp.x],
      ys: [-60 + hash(i + 40) * (SIZE + 120), 20 + hash(i + 120) * (SIZE - 40), C + r * Math.sin(angle), lp.y],
      from: i % 2 ? STEEL : GOLD,
      to: lp.gold ? GOLD : WHITE,
      spiralSize: Math.round(6 + i / 4),
    };
  });
}

const NODES = plan();

function Node({ t, p }: { t: SharedValue<number>; p: NodePlan }) {
  const style = useAnimatedStyle(() => {
    const size = interpolate(t.value, [1, 2, 3], [7, p.spiralSize, 8], 'clamp');
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [
        { translateX: interpolate(t.value, [0, 1, 2, 3], p.xs, 'clamp') - size / 2 },
        { translateY: interpolate(t.value, [0, 1, 2, 3], p.ys, 'clamp') - size / 2 },
      ],
      backgroundColor: interpolateColor(t.value, [2, 3], [p.from, p.to]),
      opacity: interpolate(t.value, [3, 4], [1, 0], 'clamp'),
    };
  });
  return <Animated.View style={[styles.node, style]} />;
}

export function LiveLogo({ run, onDone }: { run: number; onDone?: () => void }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      t.value = 4;
      onDone?.();
      return;
    }
    t.value = 0;
    const ease = Easing.bezier(0.4, 0, 0.2, 1);
    t.value = withSequence(
      withDelay(250, withTiming(1, { duration: 1200, easing: ease })),
      withDelay(50, withTiming(2, { duration: 1300, easing: ease })),
      withDelay(150, withTiming(3, { duration: 1600, easing: ease })),
      withDelay(100, withTiming(4, { duration: 700 })),
    );
    const timer = setTimeout(() => onDone?.(), 5300);
    return () => clearTimeout(timer);
    // `run` vuelve a lanzar la animación («Ver de nuevo»).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, reduced]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(t.value, [2, 3], [0, 360], 'clamp')}deg` }],
  }));
  const logo = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [3, 4], [0, 1], 'clamp') }));

  return (
    <View style={styles.canvas} accessible accessibilityRole="image" accessibilityLabel="Logo de Severa">
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        {NODES.map((p, i) => (
          <Node key={i} t={t} p={p} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.logo, logo]}>
        <Logo size={SIZE - 60} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: SIZE, height: SIZE, alignSelf: 'center' },
  node: { position: 'absolute', left: 0, top: 0 },
  logo: { position: 'absolute', left: 30, top: 30 },
});
