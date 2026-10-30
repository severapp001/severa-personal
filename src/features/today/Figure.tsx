import { router } from 'expo-router';
import { Image, Pressable, View, type DimensionValue } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { partScores, type Part } from '@/core/modules';
import { balance, PART_INFO } from '@/core/parts';
import { partSignals } from '@/features/stats/ThreeParts';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { SERIF } from '@/ui/layout';

// La figura de Hoy (Severa v3, dirección A, 29-10-2026): la persona dentro del círculo y el cuadrado
// de Vitruvio. La cabeza se ilumina con la mente, el pecho con el alma y el cuerpo de la cintura
// para abajo, cada uno tanto como su puntaje (los mismos de Cuerpo, mente y alma). Abajo, el
// equilibrio entre las tres. Tocar una parte abre su pantalla.
// Desde el 29-10 (usuario: «el cuerpo es el que dibujó Da Vinci… no un cuerpo de palitos») el dibujo es
// el Hombre de Vitruvio de Leonardo (1490, dominio público; escaneo de Luc Viatour en Wikimedia
// Commons), pasado a trazo claro sobre fondo transparente: assets/images/vitruvio.png.
// Todo se mide en una caja de 1280 × 1000: el dibujo ocupa el cuadrado del centro (140 a 1140).

const VITRUVIO = require('../../../assets/images/vitruvio.png');

/** Los colores de cada parte, los mismos de Cuerpo, mente y alma. */
export function usePartColors(): Record<Part, string> {
  const { colors } = useTheme();
  return { cuerpo: colors.ok, mente: colors.accent2, alma: colors.accent };
}

// Dónde se toca cada parte, en % del dibujo.
const ZONES: { part: Part; left: DimensionValue; top: DimensionValue; width: DimensionValue; height: DimensionValue }[] = [
  { part: 'mente', left: '41%', top: '13%', width: '18%', height: '22%' },
  { part: 'alma', left: '37%', top: '35%', width: '26%', height: '15%' },
  { part: 'cuerpo', left: '33%', top: '50%', width: '34%', height: '47%' },
];

/** `demo`: puntajes de ejemplo en vez de los tuyos (solo para la vitrina de la landing). */
/** `onPart`: qué hacer al tocar una parte (en «Tu cuerpo», mostrar su análisis); sin él, abre su pantalla. */
export function Figure({ day, size = 420, demo, onPart }: { day: string; size?: number; demo?: Record<Part, number | null>; onPart?: (part: Part) => void }) {
  const tint = usePartColors();
  const stats = useLifeStats(day);
  const real = partScores(partSignals(stats, day));
  const parts = demo ? real.map((p) => ({ ...p, score: demo[p.part] })) : real;
  const score = Object.fromEntries(parts.map((p) => [p.part, p.score])) as Record<Part, number | null>;
  const eq = balance(parts.map((p) => p.score));
  const unknown = parts.find((p) => p.score === null);
  const low = parts.filter((p) => p.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const tip = unknown
    ? `Para conocer tu ${PART_INFO[unknown.part].name.toLowerCase()}: ${(unknown.missing[0]?.hint ?? 'registra algo').toLowerCase()}.`
    : low
      ? `Tu ${PART_INFO[low.part].name.toLowerCase()} es la que más te pide hoy.`
      : '';
  const glow = (p: Part) => (score[p] === null ? 0.1 : 0.15 + ((score[p] as number) / 100) * 0.6);
  const pct = (p: Part) => (score[p] === null ? '?' : `${score[p]} %`);
  const open = (part: Part) => (onPart ? onPart(part) : router.push({ pathname: '/parte/[parte]', params: { parte: part } }));

  const height = Math.round(size / 1.28);
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height }}>
        <Svg width={size} height={height} viewBox="0 0 1280 1000" style={{ position: 'absolute' }}>
          <Defs>
            {(['mente', 'alma', 'cuerpo'] as const).map((p) => (
              <RadialGradient key={p} id={`fig-${p}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={tint[p]} stopOpacity={glow(p)} />
                <Stop offset="1" stopColor={tint[p]} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          <Circle cx={640} cy={250} r={170} fill="url(#fig-mente)" />
          <Circle cx={640} cy={410} r={160} fill="url(#fig-alma)" />
          <Ellipse cx={640} cy={720} rx={230} ry={290} fill="url(#fig-cuerpo)" />
        </Svg>
        <Image source={VITRUVIO} accessibilityIgnoresInvertColors style={{ position: 'absolute', left: (size * 140) / 1280, top: 0, width: (size * 1000) / 1280, height }} />
        <Svg width={size} height={height} viewBox="0 0 1280 1000" style={{ position: 'absolute' }}>
          <Path d="M700 244 H1130" stroke={tint.mente} strokeWidth={2} />
          <SvgText x={1140} y={258} fill={tint.mente} fontSize={40} fontFamily={fonts.bold}>
            {pct('mente')}
          </SvgText>
          <Path d="M560 405 H150" stroke={tint.alma} strokeWidth={2} />
          <SvgText x={140} y={419} fill={tint.alma} fontSize={40} fontFamily={fonts.bold} textAnchor="end">
            {pct('alma')}
          </SvgText>
          <Path d="M740 720 H1130" stroke={tint.cuerpo} strokeWidth={2} />
          <SvgText x={1140} y={734} fill={tint.cuerpo} fontSize={40} fontFamily={fonts.bold}>
            {pct('cuerpo')}
          </SvgText>
        </Svg>
        {ZONES.map((z) => (
          <Pressable
            key={z.part}
            accessibilityRole="button"
            accessibilityLabel={`${PART_INFO[z.part].name}: ${score[z.part] === null ? 'todavía no se sabe' : `${score[z.part]} por ciento`}`}
            onPress={() => open(z.part)}
            style={{ position: 'absolute', left: z.left, top: z.top, width: z.width, height: z.height, borderRadius: 999 }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <AppText muted>Equilibrio</AppText>
        <AppText style={{ fontFamily: SERIF, fontSize: 34 }}>{eq === null ? '—' : eq.toFixed(2).replace('.', ',')}</AppText>
      </View>
      {tip ? (
        <AppText variant="caption" muted style={{ textAlign: 'center', maxWidth: size }}>
          {tip}
        </AppText>
      ) : null}
    </View>
  );
}
