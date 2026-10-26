import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, paletteFor, personalThemes, type SpaceMode } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';

// Cruzar entre Personal y Trabajo (A1, concepto «cerebro partido»). Desde el 26-10-2026 (usuario:
// «una transición básica… algo matemático, algo del cerebro, como un cambio de hemisferio»): el
// logo partido crece hasta cubrir la pantalla, el hemisferio de destino se enciende mientras gira
// una espiral áurea y pasan los números de Fibonacci; a mitad de camino cambia el tema y las dos
// mitades se abren como un cerebro, dejando ver el otro espacio.

const CrossContext = createContext<(to: SpaceMode) => void>(() => undefined);
export const useCross = () => useContext(CrossContext);

let DURATION = 1050;
/** Solo para la vista previa de desarrollo: ver el cruce en cámara lenta. */
export const setCrossDurationForPreview = (ms: number) => {
  DURATION = ms;
};
const FIB = '1 · 1 · 2 · 3 · 5 · 8 · 13 · 21 · 34';
// Las dos mitades del M13 (viewBox 0–100), como en el logo.
const TOP = 'M80.39 20.09A34.5 34.5 0 0 0 29.57 66.66Z';
const BOTTOM = 'M70.43 33.34A34.5 34.5 0 0 1 19.61 79.91Z';

function spiralPath() {
  const phi = 1.618034;
  const pts: string[] = [];
  for (let i = 0; i <= 260; i++) {
    const th = (i / 80) * 2 * Math.PI;
    const r = 0.9 * phi ** ((2 * th) / Math.PI);
    pts.push(`${(50 + r * Math.cos(th)).toFixed(2)},${(50 + r * Math.sin(th)).toFixed(2)}`);
  }
  return `M${pts.join(' L')}`;
}
const SPIRAL = spiralPath();

export function SpaceCrossProvider({ children }: { children: ReactNode }) {
  const { mode, setMode, theme, workTheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const [target, setTarget] = useState<SpaceMode | null>(null);
  const busy = useRef(false);

  const cross = useCallback(
    (to: SpaceMode) => {
      if (to === mode || busy.current) return;
      tap();
      if (reduced) {
        setMode(to);
        return;
      }
      busy.current = true;
      setTarget(to);
      p.set(0);
      p.set(withTiming(1, { duration: DURATION, easing: Easing.bezier(0.45, 0, 0.25, 1) }));
      setTimeout(() => setMode(to), DURATION * 0.48);
      setTimeout(() => tap(), DURATION * 0.5);
      setTimeout(() => {
        busy.current = false;
        setTarget(null);
      }, DURATION + 40);
    },
    [mode, reduced, setMode, p],
  );

  const size = Math.max(width, height) * 1.25;
  const dir = target === 'work' ? 1 : -1;
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.18, 0.62, 0.86], [0, 1, 1, 0], 'clamp') }));
  const logo = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.12, 0.8, 1], [0, 1, 1, 0], 'clamp'),
    transform: [{ scale: interpolate(p.value, [0, 0.45], [0.18, 1], 'clamp') }, { rotate: `${interpolate(p.value, [0, 0.5], [dir * -40, 0], 'clamp')}deg` }],
  }));
  // Las mitades se separan después del cambio de tema, como un cerebro que se abre.
  const top = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0.5, 1], [0, -width * 0.9], 'clamp') }, { translateY: interpolate(p.value, [0.5, 1], [0, -height * 0.25], 'clamp') }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0.5, 1], [0, width * 0.9], 'clamp') }, { translateY: interpolate(p.value, [0.5, 1], [0, height * 0.25], 'clamp') }] }));
  const spiral = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.05, 0.3, 0.6, 0.8], [0, 0.9, 0.9, 0], 'clamp'),
    transform: [{ rotate: `${dir * interpolate(p.value, [0, 1], [0, 300])}deg` }, { scale: interpolate(p.value, [0, 0.6], [0.4, 1.1], 'clamp') }],
  }));
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.3, 0.45, 0.72, 0.85], [0, 1, 1, 0], 'clamp'),
    transform: [{ translateY: interpolate(p.value, [0.3, 0.45], [14, 0], 'clamp') }],
  }));
  const numbers = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.15, 0.35, 0.6, 0.75], [0, 0.8, 0.8, 0], 'clamp'),
    transform: [{ translateX: dir * interpolate(p.value, [0, 0.8], [width * 0.4, -width * 0.4]) }],
  }));

  const colors = target ? paletteFor(theme, target, workTheme) : null;
  const base = personalThemes[theme];
  const glowTop = target === 'personal' ? base.accent : base.accent + '55';
  const glowBottom = target === 'work' ? base.accent2 : base.accent2 + '55';

  return (
    <CrossContext.Provider value={cross}>
      <View style={{ flex: 1 }}>
        {children}
        {target && colors ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }, veil]} />
            <Animated.View style={[styles.center, numbers]}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 15, letterSpacing: 3, marginTop: size * 0.32 }} color={colors.muted}>
                {FIB}
              </AppText>
            </Animated.View>
            <Animated.View style={[styles.center, spiral]}>
              <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 100 100">
                <Path d={SPIRAL} stroke={target === 'work' ? base.accent2 : base.accent} strokeWidth={0.5} fill="none" strokeOpacity={0.8} />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.center, logo]}>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, top]}>
                <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 100 100">
                  <Path d={TOP} fill={glowTop} />
                </Svg>
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, bottom]}>
                <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 100 100">
                  <Path d={BOTTOM} fill={glowBottom} />
                </Svg>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.center, label]}>
              <View style={[styles.pill, { backgroundColor: colors.surface }]}>
                <AppText style={{ fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 4 }} color={target === 'work' ? base.accent2 : base.accent}>
                  {target === 'work' ? 'TRABAJO' : 'PERSONAL'}
                </AppText>
              </View>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </CrossContext.Provider>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 50, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
});
