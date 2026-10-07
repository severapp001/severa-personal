import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { layoutBrain, type Neuron, type NeuronState, type Synapse } from '@/core/discovery';
import { useTheme } from '@/theme/ThemeProvider';
import { personalThemes } from '@/theme/tokens';
import { AppText } from '@/ui';

// El cerebro (E3·18, F30): Personal a la izquierda (oro), Trabajo a la derecha (acero),
// Tu rutina abajo como puente. Encendida = punto lleno · por completar = anillo · por descubrir = tenue.

const isOn = (s?: NeuronState) => s === 'discovered' || s === 'suggested';

export function useBrainColors() {
  const { colors, theme } = useTheme();
  const base = personalThemes[theme];
  return {
    personal: base.accent,
    work: base.accent2,
    bridge: colors.text,
    faint: colors.muted,
    text: colors.text,
  };
}

export function Brain({
  neurons,
  synapses,
  states,
  selected,
  onSelect,
}: {
  neurons: Neuron[];
  synapses: Synapse[];
  states: Record<string, NeuronState>;
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  const c = useBrainColors();
  const pos = useMemo(() => layoutBrain(neurons), [neurons]);
  const colorOf = (n: Neuron) => (n.hemisphere === 'work' ? c.work : n.hemisphere === 'bridge' ? c.bridge : c.personal);
  const counts = useMemo(() => {
    let on = 0;
    let pend = 0;
    for (const n of neurons) {
      if (states[n.code] === 'discovered') on++;
      else if (states[n.code] === 'suggested') pend++;
    }
    return { on, pend, off: neurons.length - on - pend };
  }, [neurons, states]);

  return (
    <View style={{ gap: 10 }}>
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {counts.on} encendidas · {counts.pend} por completar · {counts.off} por descubrir
      </AppText>
      <View style={{ width: '100%', aspectRatio: 350 / 290 }}>
        <Svg width="100%" height="100%" viewBox="0 0 350 290">
          <G>
            {synapses.map((s) => {
              const a = pos[s.neuron_a];
              const b = pos[s.neuron_b];
              if (!a || !b) return null;
              const onA = isOn(states[s.neuron_a]);
              const onB = isOn(states[s.neuron_b]);
              if (!onA && !onB) return null;
              return (
                <Line
                  key={`${s.neuron_a}-${s.neuron_b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={c.text}
                  strokeOpacity={onA && onB ? 0.34 : 0.1}
                  strokeWidth={1}
                />
              );
            })}
          </G>
          {neurons.map((n) => {
            const p = pos[n.code];
            if (!p) return null;
            const st = states[n.code];
            const color = colorOf(n);
            const isSel = selected === n.code;
            return (
              <G key={n.code} onPress={onSelect ? () => onSelect(n.code) : undefined}>
                {/* Zona táctil más grande que el punto */}
                <Circle cx={p.x} cy={p.y} r={13} fill="transparent" />
                {isSel ? <Circle cx={p.x} cy={p.y} r={10} fill="none" stroke={c.text} strokeWidth={2} /> : null}
                {st === 'discovered' ? (
                  <Circle cx={p.x} cy={p.y} r={6} fill={color} />
                ) : st === 'suggested' ? (
                  <Circle cx={p.x} cy={p.y} r={5.5} fill="none" stroke={color} strokeWidth={2} />
                ) : (
                  <Circle cx={p.x} cy={p.y} r={4} fill={c.faint} fillOpacity={0.35} />
                )}
              </G>
            );
          })}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Legend label="Encendida" render={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.personal }} />} />
        <Legend label="Por completar" render={<View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.personal }} />} />
        <Legend label="Por descubrir" render={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.faint, opacity: 0.4 }} />} />
        <Legend label="Personal" render={<View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: c.personal }} />} />
        <Legend label="Trabajo" render={<View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: c.work }} />} />
      </View>
    </View>
  );
}

function Legend({ label, render }: { label: string; render: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {render}
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}
