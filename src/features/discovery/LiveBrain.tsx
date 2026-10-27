import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { layoutBrain, type Neuron, type NeuronState, type Synapse } from '@/core/discovery';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, personalThemes } from '@/theme/tokens';

// El cerebro vivo (usuario, 26-10-2026: «es el punto más importante de Severa… estático, sin
// animación»). Las neuronas nacen en una espiral áurea (ángulo de 137,5°) y viajan a su lugar en
// cada hemisferio; las encendidas laten; por las sinapsis activas corren impulsos; detrás gira una
// espiral de Fibonacci. Se usa en el cerebro, en Módulos y en el inicio animado.

export const BRAIN_W = 350;
export const BRAIN_H = 290;
const GOLDEN = (137.508 * Math.PI) / 180;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const isOn = (s?: NeuronState) => s === 'discovered' || s === 'suggested';

/** Espiral logarítmica áurea (crece φ cada cuarto de vuelta), centrada en el cerebro. */
function goldenSpiral(cx: number, cy: number, turns = 3.2): string {
  const phi = 1.618034;
  const pts: string[] = [];
  for (let i = 0; i <= turns * 80; i++) {
    const th = (i / 80) * 2 * Math.PI;
    const r = 2.2 * phi ** ((2 * th) / Math.PI);
    pts.push(`${(cx + r * Math.cos(th)).toFixed(1)},${(cy + r * 0.82 * Math.sin(th)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}
const SPIRAL = goldenSpiral(BRAIN_W / 2, BRAIN_H / 2 - 4);
const HALF_P = 'M171 8 A166 136 0 0 0 171 282 Z';
const HALF_T = 'M179 8 A166 136 0 0 1 179 282 Z';

type Point = { x: number; y: number };

function SynapseLine({ a, b, from, to, appear, strong, dim, color }: { a: Point; b: Point; from: Point; to: Point; appear: SharedValue<number>; strong: boolean; dim: boolean; color: string }) {
  const props = useAnimatedProps(() => {
    const k = appear.value;
    return {
      x1: from.x + (a.x - from.x) * k,
      y1: from.y + (a.y - from.y) * k,
      x2: to.x + (b.x - to.x) * k,
      y2: to.y + (b.y - to.y) * k,
      strokeOpacity: interpolate(k, [0.55, 1], [0, dim ? 0.06 : strong ? 0.42 : 0.12], 'clamp'),
    };
  });
  return <AnimatedLine animatedProps={props} stroke={color} strokeWidth={strong ? 1 : 0.7} />;
}

function NeuronDot({
  p,
  start,
  appear,
  clock,
  phase,
  state,
  color,
  faint,
  scale,
  selected,
}: {
  p: Point;
  start: Point;
  appear: SharedValue<number>;
  clock: SharedValue<number>;
  phase: number;
  state?: NeuronState;
  color: string;
  faint: string;
  scale: number;
  selected: boolean;
}) {
  const on = state === 'discovered';
  const pending = state === 'suggested';
  // Tamaño fijo y solo transformaciones (mover y escalar) en cada cuadro: el teléfono las anima
  // sin recalcular el diseño (26-10-2026, usuario: «más dinámico, pero poco fluido»).
  const size = (on ? 12 : pending ? 11 : 8) * scale * (selected ? 1.5 : 1);
  const halo = size * 2.4;
  const alpha = on || pending ? 1 : 0.35;
  const style = useAnimatedStyle(() => {
    const k = appear.value;
    const beat = on ? 1 + 0.16 * Math.sin(2 * Math.PI * (clock.value * 2 + phase)) : 1;
    const drift = 1.2 * scale * Math.sin(2 * Math.PI * (clock.value + phase));
    return {
      opacity: interpolate(k, [0, 0.2], [0, alpha], 'clamp'),
      transform: [
        { translateX: (start.x + (p.x - start.x) * k) * scale - halo / 2 + drift },
        { translateY: (start.y + (p.y - start.y) * k) * scale - halo / 2 - drift * 0.6 },
        { scale: beat },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.dot, { width: halo, height: halo }, style]}>
      {on ? <View style={{ position: 'absolute', width: halo, height: halo, borderRadius: halo / 2, backgroundColor: color, opacity: 0.16 }} /> : null}
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          on && { backgroundColor: color },
          pending && { borderWidth: 1.8 * scale, borderColor: color },
          !on && !pending && { backgroundColor: faint },
          selected && { borderWidth: 2, borderColor: '#FFFFFF' },
        ]}
      />
    </Animated.View>
  );
}

/** Un impulso que recorre una sinapsis activa, una y otra vez. */
function Impulse({ a, b, clock, appear, offset, speed, color, scale }: { a: Point; b: Point; clock: SharedValue<number>; appear: SharedValue<number>; offset: number; speed: number; color: string; scale: number }) {
  const style = useAnimatedStyle(() => {
    const f = (clock.value * speed + offset) % 1;
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    return {
      opacity: Math.sin(Math.PI * f) * interpolate(appear.value, [0.8, 1], [0, 1], 'clamp'),
      transform: [{ translateX: x * scale - 3 }, { translateY: y * scale - 3 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.impulse, { backgroundColor: color }, style]} />;
}

export function LiveBrain({
  neurons,
  synapses,
  states,
  width,
  selected,
  labels,
  replay = 0,
  impulses = 18,
}: {
  neurons: Neuron[];
  synapses: Synapse[];
  states: Record<string, NeuronState>;
  width: number;
  selected?: string | null;
  labels?: boolean;
  /** Cambiarlo vuelve a lanzar la animación de nacimiento. */
  replay?: number;
  impulses?: number;
}) {
  const { colors, theme } = useTheme();
  const base = personalThemes[theme];
  const reduced = useReducedMotion();
  const scale = width / BRAIN_W;
  const height = BRAIN_H * scale;
  const pos = useMemo(() => layoutBrain(neurons), [neurons]);
  const sorted = useMemo(() => [...neurons].sort((a, b) => a.sort_order - b.sort_order), [neurons]);
  // De dónde nace cada neurona: su lugar en una espiral áurea desde el centro.
  const starts = useMemo(() => {
    const out: Record<string, Point> = {};
    sorted.forEach((n, i) => {
      const r = 9 * Math.sqrt(i + 0.6);
      out[n.code] = { x: BRAIN_W / 2 + r * Math.cos(i * GOLDEN), y: BRAIN_H / 2 + r * 0.82 * Math.sin(i * GOLDEN) };
    });
    return out;
  }, [sorted]);

  const appear = useSharedValue(reduced ? 1 : 0);
  const clock = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      appear.value = 1;
      return;
    }
    appear.value = 0;
    appear.value = withDelay(120, withTiming(1, { duration: 1600, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: 60000, easing: Easing.linear }), -1, false);
  }, [replay, reduced, appear, clock, spin]);

  const colorOf = (h: string) => (h === 'work' ? base.accent2 : h === 'bridge' ? colors.text : base.accent);
  const linked = useMemo(() => new Set(selected ? synapses.filter((s) => s.neuron_a === selected || s.neuron_b === selected).flatMap((s) => [s.neuron_a, s.neuron_b]) : []), [selected, synapses]);

  const active = synapses.filter((s) => pos[s.neuron_a] && pos[s.neuron_b] && (isOn(states[s.neuron_a]) || isOn(states[s.neuron_b])));
  const live = active.filter((s) => isOn(states[s.neuron_a]) && isOn(states[s.neuron_b]));
  const pulses = (live.length ? live : active).slice(0, reduced ? 0 : impulses);

  const halo = useAnimatedProps(() => ({ fillOpacity: 0.04 + 0.04 * Math.sin(2 * Math.PI * clock.value) }));
  const halo2 = useAnimatedProps(() => ({ fillOpacity: 0.04 + 0.04 * Math.sin(2 * Math.PI * (clock.value + 0.5)) }));
  const spiralStyle = useAnimatedStyle(() => ({ opacity: interpolate(appear.value, [0, 0.6], [0, 1], 'clamp'), transform: [{ rotate: `${spin.value}deg` }] }));

  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={`Tu cerebro: ${neurons.filter((n) => states[n.code] === 'discovered').length} neuronas encendidas`}>
      <Animated.View style={[StyleSheet.absoluteFill, spiralStyle]} pointerEvents="none">
        <Svg width={width} height={height} viewBox={`0 0 ${BRAIN_W} ${BRAIN_H}`}>
          <Path d={SPIRAL} stroke={base.accent} strokeOpacity={0.13} strokeWidth={0.8} fill="none" />
        </Svg>
      </Animated.View>
      <Svg width={width} height={height} viewBox={`0 0 ${BRAIN_W} ${BRAIN_H}`} style={StyleSheet.absoluteFill}>
        <AnimatedPath d={HALF_P} fill={base.accent} animatedProps={halo} stroke={base.accent} strokeOpacity={0.25} />
        <AnimatedPath d={HALF_T} fill={base.accent2} animatedProps={halo2} stroke={base.accent2} strokeOpacity={0.25} />
        <G>
          {active.map((s) => {
            const both = isOn(states[s.neuron_a]) && isOn(states[s.neuron_b]);
            const touches = !selected || s.neuron_a === selected || s.neuron_b === selected;
            return (
              <SynapseLine
                key={`${s.neuron_a}-${s.neuron_b}`}
                a={pos[s.neuron_a]}
                b={pos[s.neuron_b]}
                from={starts[s.neuron_a] ?? pos[s.neuron_a]}
                to={starts[s.neuron_b] ?? pos[s.neuron_b]}
                appear={appear}
                strong={both || (!!selected && touches)}
                dim={!!selected && !touches}
                color={selected && touches ? colorOf(neurons.find((n) => n.code === selected)?.hemisphere ?? 'personal') : colors.text}
              />
            );
          })}
        </G>
        {labels
          ? sorted.map((n) =>
              pos[n.code] && (states[n.code] || n.code === selected || linked.has(n.code)) ? (
                <SvgText key={n.code} x={pos[n.code].x} y={pos[n.code].y + 13} fontSize={5.6} fontFamily={fonts.bold} fill={linked.has(n.code) || n.code === selected ? colors.text : colors.muted} textAnchor="middle">
                  {n.name}
                </SvgText>
              ) : null,
            )
          : null}
      </Svg>
      {pulses.map((s, i) => (
        <Impulse
          key={`i-${s.neuron_a}-${s.neuron_b}`}
          a={i % 2 ? pos[s.neuron_b] : pos[s.neuron_a]}
          b={i % 2 ? pos[s.neuron_a] : pos[s.neuron_b]}
          clock={clock}
          appear={appear}
          offset={(i * 0.618) % 1}
          speed={1 + (i % 3) * 0.5}
          color={colorOf(neurons.find((n) => n.code === s.neuron_a)?.hemisphere ?? 'personal')}
          scale={scale}
        />
      ))}
      {sorted.map((n, i) =>
        pos[n.code] ? (
          <NeuronDot
            key={n.code}
            p={pos[n.code]}
            start={starts[n.code]}
            appear={appear}
            clock={clock}
            phase={(i * 0.618) % 1}
            state={states[n.code]}
            color={colorOf(n.hemisphere)}
            faint={colors.muted}
            scale={scale}
            selected={selected === n.code}
          />
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  impulse: { position: 'absolute', left: 0, top: 0, width: 6, height: 6, borderRadius: 3 },
});
