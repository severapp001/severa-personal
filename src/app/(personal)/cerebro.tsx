import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { layoutBrain, type NeuronState } from '@/core/discovery';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { useCross } from '@/features/space/SpaceCross';
import { useToday } from '@/features/today/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, personalThemes, type SpaceMode } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { MinusIcon, PlusIcon, CornersOutIcon, XIcon } from '@/ui/icons';

// El cerebro (A2, vista previa del 17-10-2026): Personal a la izquierda y Trabajo a la derecha.
// Se acerca pellizcando o con + y −, se mueve arrastrando y cada neurona se toca para ver su hoja.
// Desde aquí se entra a un hemisferio.

const W = 350;
const H = 290;
const MIN = 1;
const MAX = 4;
const LABELS_FROM = 1.6;
const isOn = (s?: NeuronState) => s === 'discovered' || s === 'suggested';
const HALF_P = 'M171 8 A166 136 0 0 0 171 282 Z';
const HALF_T = 'M179 8 A166 136 0 0 1 179 282 Z';

export default function CerebroScreen() {
  const { colors, theme, mode } = useTheme();
  const base = personalThemes[theme];
  const cross = useCross();
  const t = useToday();
  const { width } = useWindowDimensions();
  const stageW = width - 32;
  const stageH = (stageW * H) / W;
  const unit = W / stageW; // unidades del dibujo por punto de pantalla

  const pos = useMemo(() => layoutBrain(t.neurons), [t.neurons]);
  const [hemi, setHemi] = useState<'all' | SpaceMode>('all');
  const [labels, setLabels] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useAnimatedReaction(
    () => scale.value >= LABELS_FROM,
    (show, prev) => {
      if (show !== prev) scheduleOnRN(setLabels, show);
    },
  );

  const clamp = (v: number, lo: number, hi: number) => {
    'worklet';
    return Math.min(hi, Math.max(lo, v));
  };
  const limit = (s: number) => {
    'worklet';
    return { x: (stageW * (s - 1)) / 2 + 40, y: (stageH * (s - 1)) / 2 + 40 };
  };

  /** Lleva el punto (cx, cy) del dibujo al centro, con el zoom s. */
  const focus = (s: number, cx: number, cy: number) => {
    const px = (cx - W / 2) / unit;
    const py = (cy - H / 2) / unit;
    const l = limit(s);
    scale.set(withTiming(s, { duration: 380 }));
    tx.set(withTiming(clamp(-px * s, -l.x, l.x), { duration: 380 }));
    ty.set(withTiming(clamp(-py * s, -l.y, l.y), { duration: 380 }));
  };

  const select = (code: string) => {
    tap();
    const p = pos[code];
    if (p) focus(Math.max(scale.get(), 2.4), p.x, p.y);
    setSheet(code);
  };

  /** Toque en la pantalla → neurona más cercana (en el dibujo, deshaciendo el zoom). */
  const pick = (x: number, y: number) => {
    const s = scale.get();
    const cx = W / 2 + ((x - stageW / 2 - tx.get()) / s) * unit;
    const cy = H / 2 + ((y - stageH / 2 - ty.get()) / s) * unit;
    let best: string | null = null;
    let dist = 18 / s + 6;
    for (const n of t.neurons) {
      const p = pos[n.code];
      if (!p) continue;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < dist) {
        dist = d;
        best = n.code;
      }
    }
    if (best) select(best);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedX.value = tx.value;
      savedY.value = ty.value;
    })
    .onUpdate((e) => {
      const s = clamp(savedScale.value * e.scale, MIN, MAX);
      const l = limit(s);
      scale.value = s;
      tx.value = clamp((savedX.value * s) / savedScale.value, -l.x, l.x);
      ty.value = clamp((savedY.value * s) / savedScale.value, -l.y, l.y);
    });
  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      savedX.value = tx.value;
      savedY.value = ty.value;
    })
    .onUpdate((e) => {
      const l = limit(scale.value);
      tx.value = clamp(savedX.value + e.translationX, -l.x, l.x);
      ty.value = clamp(savedY.value + e.translationY, -l.y, l.y);
    });
  const touch = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      scheduleOnRN(pick, e.x, e.y);
    });
  const gestures = Gesture.Race(Gesture.Simultaneous(pinch, pan), touch);

  const content = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const zoomBy = (f: number) => {
    tap();
    const old = scale.get();
    const s = clamp(old * f, MIN, MAX);
    const l = limit(s);
    scale.set(withTiming(s, { duration: 280 }));
    tx.set(withTiming(clamp((tx.get() * s) / old, -l.x, l.x), { duration: 280 }));
    ty.set(withTiming(clamp((ty.get() * s) / old, -l.y, l.y), { duration: 280 }));
  };

  const chooseHemi = (h: 'all' | SpaceMode) => {
    tap();
    setHemi(h);
    if (h === 'all') focus(1, W / 2, H / 2);
    else focus(1.75, h === 'personal' ? 100 : 250, 150);
  };

  const counts = useMemo(() => {
    let on = 0;
    let pend = 0;
    for (const n of t.neurons) {
      if (t.states[n.code] === 'discovered') on++;
      else if (t.states[n.code] === 'suggested') pend++;
    }
    return `${on} encendidas · ${pend} por completar · ${t.neurons.length - on - pend} por descubrir`;
  }, [t.neurons, t.states]);

  const target: SpaceMode = hemi === 'all' ? mode : hemi;
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;
  const colorOf = (h: string) => (h === 'work' ? base.accent2 : h === 'bridge' ? colors.text : base.accent);

  return (
    <Screen scroll={false}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">Tu cerebro</AppText>
          <AppText variant="caption" muted>
            {counts}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el cerebro" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface }]}>
          <XIcon size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.seg, { backgroundColor: colors.surface }]}>
        {(['all', 'personal', 'work'] as const).map((h) => (
          <Pressable
            key={h}
            accessibilityRole="tab"
            accessibilityState={{ selected: hemi === h }}
            onPress={() => chooseHemi(h)}
            style={[styles.segBtn, hemi === h && { backgroundColor: colors.surface2 }]}
          >
            <AppText variant="label" color={hemi === h ? colors.text : colors.muted}>
              {h === 'all' ? 'Todo' : h === 'work' ? 'Trabajo' : 'Personal'}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <GestureDetector gesture={gestures}>
          <View style={{ width: stageW, height: stageH, overflow: 'visible' }} collapsable={false}>
            <Animated.View style={[{ width: stageW, height: stageH }, content]}>
              <Svg width={stageW} height={stageH} viewBox={`0 0 ${W} ${H}`}>
                <Path d={HALF_P} fill={base.accent} fillOpacity={0.05} stroke={base.accent} strokeOpacity={0.22} />
                <Path d={HALF_T} fill={base.accent2} fillOpacity={0.05} stroke={base.accent2} strokeOpacity={0.22} />
                {t.synapses.map((s) => {
                  const a = pos[s.neuron_a];
                  const b = pos[s.neuron_b];
                  const onA = isOn(t.states[s.neuron_a]);
                  const onB = isOn(t.states[s.neuron_b]);
                  if (!a || !b || (!onA && !onB)) return null;
                  return <Line key={`${s.neuron_a}-${s.neuron_b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.text} strokeOpacity={onA && onB ? 0.3 : 0.08} strokeWidth={0.8} />;
                })}
                {t.neurons.map((n) => {
                  const p = pos[n.code];
                  if (!p) return null;
                  const st = t.states[n.code];
                  const c = colorOf(n.hemisphere);
                  return (
                    <G key={n.code}>
                      {sheet === n.code ? <Circle cx={p.x} cy={p.y} r={10} fill="none" stroke={colors.text} strokeWidth={1.4} /> : null}
                      {st === 'discovered' ? (
                        <Circle cx={p.x} cy={p.y} r={6} fill={c} />
                      ) : st === 'suggested' ? (
                        <Circle cx={p.x} cy={p.y} r={5.5} fill="none" stroke={c} strokeWidth={1.8} />
                      ) : (
                        <Circle cx={p.x} cy={p.y} r={4} fill={colors.muted} fillOpacity={0.35} />
                      )}
                      {labels ? (
                        <SvgText x={p.x} y={p.y + 13} fontSize={5.6} fontFamily={fonts.bold} fill={st ? colors.text : colors.muted} textAnchor="middle">
                          {n.name}
                        </SvgText>
                      ) : null}
                    </G>
                  );
                })}
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>
        <View style={styles.zoom}>
          {[
            { Icon: PlusIcon, label: 'Acercar', on: () => zoomBy(1.4) },
            { Icon: MinusIcon, label: 'Alejar', on: () => zoomBy(1 / 1.4) },
            { Icon: CornersOutIcon, label: 'Ver todo', on: () => chooseHemi('all') },
          ].map(({ Icon, label, on }) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={on} style={[styles.round, { backgroundColor: colors.surface }]}>
              <Icon size={20} color={colors.text} />
            </Pressable>
          ))}
        </View>
      </View>

      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Pellizca para acercarte y toca una neurona para ver qué es.
      </AppText>
      <Button
        label={target === mode ? `Volver a ${mode === 'work' ? 'Trabajo' : 'Personal'}` : `Entrar a ${target === 'work' ? 'Trabajo' : 'Personal'}`}
        onPress={() => {
          if (target !== mode) cross(target);
          router.back();
        }}
      />
      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  round: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  zoom: { position: 'absolute', right: 0, top: 0, gap: 8 },
});
