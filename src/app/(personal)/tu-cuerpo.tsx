import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { partScores, type Part } from '@/core/modules';
import { balance, levelOf, PART_INFO, PART_ORDER } from '@/core/parts';
import { dayKey } from '@/core/today';
import { medals } from '@/features/stats/medals';
import { partSignals } from '@/features/stats/ThreeParts';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { Figure } from '@/features/today/Figure';
import { setCapa, useCapaColors } from '@/features/v3/useV3';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretLeftIcon } from '@/ui/icons';
import { SERIF, useLayout } from '@/ui/layout';

// «Tu cuerpo» (Severa v3, C68–C69, 29-10-2026): se abre desde el logo. La figura es el Hombre de
// Vitruvio de Leonardo y cada parte se ilumina según su puntaje; al tocar una parte se ve su análisis
// (lo que la forma y lo que falta) y se puede ir a ella. Abajo, el **equilibrio** (un triángulo con las
// tres partes) y el **nivel**, el rectángulo áureo de cuadrados de Fibonacci (1, 1, 2, 3, 5, 8) que
// se van llenando con los logros.

// Los cuadrados del rectángulo áureo (13 × 8), del más chico al más grande: así se llenan.
const SQUARES = [
  { x: 8, y: 5, s: 1 },
  { x: 9, y: 5, s: 1 },
  { x: 8, y: 6, s: 2 },
  { x: 10, y: 5, s: 3 },
  { x: 8, y: 0, s: 5 },
  { x: 0, y: 0, s: 8 },
];
const SPIRAL = 'M0 8 A8 8 0 0 1 8 0 A5 5 0 0 1 13 5 A3 3 0 0 1 10 8 A2 2 0 0 1 8 6 A1 1 0 0 1 9 5 A1 1 0 0 1 10 6';

export default function TuCuerpoScreen() {
  const { colors } = useTheme();
  const tint = useCapaColors();
  const { wide } = useLayout();
  const { width } = useWindowDimensions();
  const [today] = useState(() => dayKey(new Date()));
  const stats = useLifeStats(today);
  const parts = partScores(partSignals(stats, today));
  const known = parts.filter((p) => p.score !== null);
  const [sel, setSel] = useState<Part | null>(null);
  const part = sel ?? [...known].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]?.part ?? 'mente';
  const current = parts.find((p) => p.part === part);
  const eq = balance(parts.map((p) => p.score));
  const earned = medals(stats).filter((m) => m.value >= m.goal).length;
  const { level, next } = levelOf(earned);
  const figSize = wide ? Math.min(600, Math.round((width - 160) / 2)) : width - 48;
  const choose = (p: Part) => {
    tap();
    setSel(p);
  };

  // El triángulo: mente arriba, alma a la derecha y cuerpo a la izquierda; cada punto avanza desde el
  // centro hacia su vértice según el puntaje.
  const V: Record<Part, [number, number]> = { mente: [150, 26], alma: [272, 236], cuerpo: [28, 236] };
  const C: [number, number] = [150, 166];
  const at = (p: Part, f: number): [number, number] => [C[0] + (V[p][0] - C[0]) * f, C[1] + (V[p][1] - C[1]) * f];
  const pts = (f: (p: Part) => number) => PART_ORDER.map((p) => at(p, f(p)).join(',')).join(' ');
  const scoreOf = (p: Part) => (parts.find((x) => x.part === p)?.score ?? 0) / 100;

  const analysis = current ? (
    <View style={[styles.panel, { backgroundColor: colors.surface }]}>
      <View style={styles.chips}>
        {PART_ORDER.map((p) => (
          <Pressable key={p} accessibilityRole="tab" accessibilityState={{ selected: p === part }} onPress={() => choose(p)} style={[styles.chip, { borderColor: tint[p], backgroundColor: p === part ? tint[p] : 'transparent' }]}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 13 }} color={p === part ? colors.bg : tint[p]}>
              {PART_INFO[p].name}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.kicker} color={tint[part]}>
            {PART_INFO[part].verb.toUpperCase()}
          </AppText>
          <AppText style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 44 }}>{PART_INFO[part].name}</AppText>
        </View>
        <AppText style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 48 }} color={tint[part]}>
          {current.score === null ? '?' : `${current.score} %`}
        </AppText>
      </View>
      {current.known.map((s) => (
        <View key={s.name} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="label" style={{ fontSize: 14 }}>
              {s.name}
            </AppText>
            <AppText variant="label" style={{ fontSize: 14 }} color={tint[part]}>{`${Math.round((s.value ?? 0) * 100)} %`}</AppText>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
            <View style={[styles.fill, { width: `${Math.round((s.value ?? 0) * 100)}%`, backgroundColor: tint[part] }]} />
          </View>
        </View>
      ))}
      {current.missing.length ? (
        <AppText variant="caption" muted>
          {`Para conocerla mejor: ${current.missing
            .slice(0, 3)
            .map((m) => m.hint.toLowerCase())
            .join(' · ')}.`}
        </AppText>
      ) : null}
      <Button
        label={`Ir a ${PART_INFO[part].name}`}
        onPress={() => {
          setCapa(part);
          router.navigate('/');
        }}
      />
    </View>
  ) : null;

  const balanceCard = (
    <View style={[styles.panel, { backgroundColor: colors.surface, flex: 1 }]}>
      <AppText style={styles.kicker} color={colors.muted}>
        TU EQUILIBRIO
      </AppText>
      <View style={{ alignItems: 'center' }}>
        <Svg width={300} height={270} viewBox="0 0 300 270" accessibilityRole="image" accessibilityLabel={`Equilibrio ${eq === null ? 'todavía sin datos' : String(eq).replace('.', ',')}`}>
          <Polygon points={pts(() => 1)} fill="none" stroke={colors.line} strokeWidth={1.5} />
          <Polygon points={pts(() => 0.5)} fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="4 5" />
          {PART_ORDER.map((p) => (
            <Line key={p} x1={C[0]} y1={C[1]} x2={V[p][0]} y2={V[p][1]} stroke={colors.line} strokeWidth={1} />
          ))}
          <Polygon points={pts(scoreOf)} fill={colors.accent} fillOpacity={0.18} stroke={colors.accent} strokeWidth={2} />
          <SvgText x={150} y={14} fill={tint.mente} fontSize={13} fontFamily={fonts.bold} textAnchor="middle">{`Mente ${parts.find((x) => x.part === 'mente')?.score ?? '?'}`}</SvgText>
          <SvgText x={286} y={258} fill={tint.alma} fontSize={13} fontFamily={fonts.bold} textAnchor="end">{`Alma ${parts.find((x) => x.part === 'alma')?.score ?? '?'}`}</SvgText>
          <SvgText x={14} y={258} fill={tint.cuerpo} fontSize={13} fontFamily={fonts.bold}>{`Cuerpo ${parts.find((x) => x.part === 'cuerpo')?.score ?? '?'}`}</SvgText>
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10 }}>
        <AppText muted>Equilibrio</AppText>
        <AppText style={{ fontFamily: SERIF, fontSize: 36 }}>{eq === null ? '—' : eq.toFixed(2).replace('.', ',')}</AppText>
      </View>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        1 es cuando tus tres partes van parejas.
      </AppText>
    </View>
  );

  const levelCard = (
    <View style={[styles.panel, { backgroundColor: colors.surface, flex: 1 }]}>
      <AppText style={styles.kicker} color={colors.muted}>
        TU NIVEL
      </AppText>
      <View style={{ alignItems: 'center' }}>
        <Svg width={312} height={192} viewBox="-0.2 -0.2 13.4 8.4" accessibilityRole="image" accessibilityLabel={`Nivel ${level} de 6`}>
          {SQUARES.map((q, i) => (
            <Rect key={i} x={q.x} y={q.y} width={q.s} height={q.s} fill={i < level ? colors.accent : 'transparent'} fillOpacity={i < level ? 0.22 + i * 0.1 : 0} stroke={i < level ? colors.accent : colors.line} strokeWidth={0.05} />
          ))}
          <Path d={SPIRAL} fill="none" stroke={colors.text} strokeOpacity={0.55} strokeWidth={0.06} />
          {SQUARES.map((q, i) => (
            <SvgText key={`n${i}`} x={q.x + q.s / 2} y={q.y + q.s / 2 + q.s * 0.12} fill={i < level ? colors.text : colors.muted} fontSize={Math.max(0.42, q.s * 0.32)} fontFamily={fonts.bold} textAnchor="middle">
              {String([1, 1, 2, 3, 5, 8][i])}
            </SvgText>
          ))}
        </Svg>
      </View>
      <AppText style={{ fontFamily: SERIF, fontSize: 30, textAlign: 'center' }}>{`Nivel ${level} de 6`}</AppText>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {next === null ? `¡Nivel máximo! Llevas ${earned} logros, como el 13 del M13.` : `Llevas ${earned} ${earned === 1 ? 'logro' : 'logros'}. Te ${next === 1 ? 'falta 1' : `faltan ${next}`} para el nivel ${level + 1} (los niveles siguen a Fibonacci: 1, 2, 3, 5, 8 y 13).`}
      </AppText>
      <Button label="Ver tus logros" kind="link" onPress={() => router.push('/logros')} />
    </View>
  );

  return (
    <Screen width="full">
      {wide ? null : (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <CaretLeftIcon size={16} color={colors.muted} />
          <AppText variant="label" muted>
            Hoy
          </AppText>
        </Pressable>
      )}
      <View style={{ gap: 4 }}>
        <AppText style={styles.kicker} color={colors.accent}>
          LA PERSONA COMPLETA
        </AppText>
        <AppText style={{ fontFamily: SERIF, fontSize: wide ? 56 : 40, lineHeight: wide ? 60 : 44 }}>Tu cuerpo</AppText>
        <AppText muted style={{ maxWidth: 560 }}>
          Toca una parte de la figura para ver qué la forma y qué le falta.
        </AppText>
      </View>
      <View style={[wide && { flexDirection: 'row', alignItems: 'flex-start', gap: 28 }]}>
        <View style={{ alignItems: 'center' }}>
          <Figure day={today} size={figSize} onPart={choose} />
        </View>
        <View style={{ flex: 1, gap: 16 }}>{analysis}</View>
      </View>
      <View style={[{ gap: 16 }, wide && { flexDirection: 'row' }]}>
        {balanceCard}
        {levelCard}
      </View>
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        El dibujo es el Hombre de Vitruvio de Leonardo da Vinci (hacia 1490).
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.6, fontSize: 12 },
  panel: { borderRadius: 22, padding: 18, gap: 14 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
