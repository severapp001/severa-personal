import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { paletteFor, personalThemes, type SpaceMode } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';

// Cruzar entre Personal y Trabajo (A1, concepto «cerebro partido»): una cortina con el color del
// otro espacio pasa por la pantalla y, a mitad de camino, cambia el tema. Personal queda a la
// izquierda y Trabajo a la derecha, como en el cerebro.

const CrossContext = createContext<(to: SpaceMode) => void>(() => undefined);
export const useCross = () => useContext(CrossContext);

export function SpaceCrossProvider({ children }: { children: ReactNode }) {
  const { mode, setMode, theme, workTheme } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const x = useSharedValue(width * 2);
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
      const from = to === 'work' ? width : -width;
      const ease = Easing.bezier(0.65, 0, 0.35, 1);
      x.set(from);
      x.set(withSequence(withTiming(0, { duration: 270, easing: ease }), withDelay(90, withTiming(-from, { duration: 300, easing: ease }))));
      setTimeout(() => setMode(to), 280);
      setTimeout(() => {
        busy.current = false;
        setTarget(null);
      }, 720);
    },
    [mode, reduced, setMode, width, x],
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const colors = target ? paletteFor(theme, target, workTheme) : null;
  const seam = target === 'work' ? personalThemes[theme].accent2 : personalThemes[theme].accent;

  return (
    <CrossContext.Provider value={cross}>
      <View style={{ flex: 1 }}>
        {children}
        {target && colors ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.curtain, { backgroundColor: colors.bg, borderColor: seam }, style]}>
            <AppText variant="title" color={seam}>
              {target === 'work' ? 'Trabajo' : 'Personal'}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
    </CrossContext.Provider>
  );
}

const styles = StyleSheet.create({
  curtain: { alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderRightWidth: 2, zIndex: 50 },
});
