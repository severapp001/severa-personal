import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { personalThemes, type SpaceMode } from '@/theme/tokens';
import { AppText } from '@/ui';
import { GearIcon } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { useCross } from './SpaceCross';

// Variante B (decidida el 18-10-2026): arriba, el logo abre el cerebro y el interruptor
// Personal/Trabajo queda al lado, siempre a la vista.

const SWITCH_WIDTH = 168;

export function SpaceSwitch() {
  const { mode, theme, colors } = useTheme();
  const cross = useCross();
  const base = personalThemes[theme];
  const x = useSharedValue(mode === 'work' ? 1 : 0);

  // Si se cruza desde otro lado (el cerebro), el interruptor se pone al día.
  useEffect(() => {
    x.set(withTiming(mode === 'work' ? 1 : 0, { duration: 320 }));
  }, [mode, x]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * (SWITCH_WIDTH / 2 - 3) }],
    backgroundColor: interpolateColor(x.value, [0, 1], [base.accent, base.accent2]),
  }));
  const press = (to: SpaceMode) => {
    if (to === mode) return;
    x.set(withTiming(to === 'work' ? 1 : 0, { duration: 320 }));
    cross(to);
  };

  return (
    <View style={[styles.switch, { backgroundColor: colors.surface2 }]} accessibilityRole="tablist">
      <Animated.View style={[styles.thumb, thumb]} />
      {(['personal', 'work'] as const).map((m) => (
        <Pressable
          key={m}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === m }}
          onPress={() => press(m)}
          style={styles.option}
        >
          <AppText variant="label" style={{ fontSize: 13 }} color={mode !== m ? colors.muted : m === 'work' ? (base.isDark ? '#0A0D10' : '#FFFFFF') : base.onAccent}>
            {m === 'work' ? 'Trabajo' : 'Personal'}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function BrainButton({ pip }: { pip?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir tu cerebro"
      onPress={() => router.push('/cerebro')}
      style={({ pressed }) => [styles.brain, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}
    >
      <Logo size={28} />
      {pip ? <View style={[styles.pip, { backgroundColor: colors.accent, borderColor: colors.surface }]} /> : null}
    </Pressable>
  );
}

/** Ajustes salió de la barra de abajo para dar lugar a Trabajo (26-10-2026). */
export function SettingsButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajustes"
      onPress={() => router.push('/ajustes')}
      style={({ pressed }) => [styles.brain, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}
    >
      <GearIcon size={22} color={colors.text} />
    </Pressable>
  );
}

/** Barra superior de Hoy: cerebro a la izquierda, interruptor y ajustes a la derecha. */
export function SpaceTopBar({ pip }: { pip?: boolean }) {
  return (
    <View style={styles.bar}>
      <BrainButton pip={pip} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SpaceSwitch />
        <SettingsButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switch: { width: SWITCH_WIDTH, flexDirection: 'row', borderRadius: 999, padding: 3 },
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 3, width: SWITCH_WIDTH / 2 - 3, borderRadius: 999 },
  option: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  brain: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pip: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
});
