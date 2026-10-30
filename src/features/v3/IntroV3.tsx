import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { SERIF } from '@/ui/layout';

// La entrada de Severa v3 (C69, 29-10-2026): las cuatro piezas del logo M13 de cuatro llegan, cada una
// desde su lado, y se arman en el ombligo de la figura (el centro del círculo de Vitruvio, donde está el
// Ser); aparecen el círculo y el cuadrado del dibujo de Leonardo y la palabra Severa; luego el logo
// viaja a la esquina de Hoy. Unos 3,5 s; se salta con un toque. Fases de `t`: 0 lejos · 1 logo armado ·
// 2 el dibujo · 3 la palabra · 4 a la esquina.

const VITRUVIO = require('../../../assets/images/vitruvio.png');
let shownThisLaunch = false;

type Piece = { d: string; fill: string; from: [number, number] };
// Mente llega desde arriba, alma desde la derecha, cuerpo desde abajo y el Ser desde la izquierda.
const PIECES: Piece[] = [
  { d: 'M80.39 20.09A34.5 34.5 0 0 0 29.57 66.66L38.32 58.64A22.6 22.6 0 0 1 71.64 28.11Z', fill: 'url(#oroIntro)', from: [0, -1] },
  { d: 'M70.70 28.97A21.32 21.32 0 0 0 39.26 57.78Z', fill: '#8E6B24', from: [1, 0] },
  { d: 'M70.43 33.34A34.5 34.5 0 0 1 19.61 79.91L28.36 71.89A22.6 22.6 0 0 0 61.68 41.36Z', fill: '#F4F1EA', from: [0, 1] },
  { d: 'M60.74 42.22A21.32 21.32 0 0 1 29.30 71.03Z', fill: '#C9C2B2', from: [-1, 0] },
];

function PieceView({ piece, t, logo, far }: { piece: Piece; t: SharedValue<number>; logo: number; far: number }) {
  const style = useAnimatedStyle(() => {
    const k = interpolate(t.get(), [0, 1], [1, 0], 'clamp');
    return { opacity: interpolate(t.get(), [0, 0.5], [0, 1], 'clamp'), transform: [{ translateX: piece.from[0] * far * k }, { translateY: piece.from[1] * far * k }, { rotate: `${k * 40 * (piece.from[0] || piece.from[1])}deg` }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={logo} height={logo} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="oroIntro" gradientUnits="userSpaceOnUse" x1="18" y1="86" x2="82" y2="14">
            <Stop offset="0" stopColor="#F6DE9A" />
            <Stop offset="0.5" stopColor="#D4AF5A" />
            <Stop offset="1" stopColor="#8E6B24" />
          </LinearGradient>
        </Defs>
        <Path d={piece.d} fill={piece.fill} />
      </Svg>
    </Animated.View>
  );
}

export function IntroV3() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => !shownThisLaunch && !reduced);
  const t = useSharedValue(0);
  const size = Math.min(width - 24, height * 0.62, 460);
  const logo = size * 0.24;
  // El logo termina en la esquina de arriba (donde está en Hoy): desde el centro del dibujo hasta ahí.
  const toX = -(width / 2) + 46;
  const toY = -(height / 2) + 46 + size * 0.06;

  useEffect(() => {
    if (!visible) return;
    shownThisLaunch = true;
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    t.set(withTiming(1, { duration: 1150, easing: ease }, () => t.set(withTiming(3, { duration: 1500, easing: Easing.inOut(Easing.quad) }, () => t.set(withTiming(4, { duration: 750, easing: ease }))))));
    const end = setTimeout(() => setVisible(false), 3600);
    return () => clearTimeout(end);
  }, [visible, t]);

  const drawing = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [1, 1.9, 3.3, 4], [0, 0.9, 0.9, 0], 'clamp'), transform: [{ scale: interpolate(t.get(), [1, 2], [0.94, 1], 'clamp') }] }));
  const logoBox = useAnimatedStyle(() => {
    const m = interpolate(t.get(), [3.2, 4], [0, 1], 'clamp');
    return { transform: [{ translateX: toX * m }, { translateY: toY * m }, { scale: 1 - 0.45 * m }] };
  });
  const word = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [2, 2.7, 3.3, 3.8], [0, 1, 1, 0], 'clamp') }));
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [3.5, 4], [1, 0], 'clamp') }));

  if (!visible) return null;
  return (
    <Animated.View exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }, veil]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Saltar la entrada" onPress={() => setVisible(false)} style={styles.fill}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, drawing]}>
            <Image source={VITRUVIO} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ width: logo, height: logo }, logoBox]}>
            {PIECES.map((p) => (
              <PieceView key={p.d} piece={p} t={t} logo={logo} far={size * 0.75} />
            ))}
          </Animated.View>
        </View>
        <Animated.View style={[{ alignItems: 'center', gap: 6, marginTop: 10 }, word]}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 28, letterSpacing: 9 }}>SEVERA</AppText>
          <AppText style={{ fontFamily: SERIF, fontSize: 20 }} muted>
            Tu persona, completa.
          </AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
