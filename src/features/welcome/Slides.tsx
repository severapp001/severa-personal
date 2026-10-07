import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCLP } from '@/core/money';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, paletteFor, radius, space, type Palette } from '@/theme/tokens';
import { AppText } from '@/ui';

// Tres pantallas que se tocan (L2, E3·20): Personal, Trabajo (conductor) y los dos conectados.
// Los montos son de ejemplo.

const FRASES = [
  'Comida se lleva casi 4 de cada 10 pesos.',
  'Vas $4.500 más arriba que la semana pasada a esta altura.',
  'Este mes vas parejo con tu promedio.',
];

function Card({ c, children }: { c: Palette; children: React.ReactNode }) {
  return <View style={[styles.card, { backgroundColor: c.surface }]}>{children}</View>;
}

function Chip({ label, onPress, bg, fg }: { label: string; onPress: () => void; bg: string; fg: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}>
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Kicker({ text, color }: { text: string; color: string }) {
  return (
    <AppText variant="caption" color={color} style={{ fontFamily: fonts.extrabold, letterSpacing: 1.5 }}>
      {text}
    </AppText>
  );
}

export function SlidePersonal() {
  const { colors: c } = useTheme();
  const [spent, setSpent] = useState(412300);
  const [water, setWater] = useState(5);
  const n = Math.round((spent - 412300) / 4500);
  return (
    <View style={styles.slide}>
      <Kicker text="PERSONAL" color={c.accent} />
      <AppText variant="title">Tu día, en orden. Tócalo.</AppText>
      <Card c={c}>
        <AppText variant="caption" muted>
          GASTADO ESTE MES
        </AppText>
        <AppText variant="title">{formatCLP(spent)}</AppText>
        <View style={[styles.bar, { backgroundColor: c.surface2 }]}>
          <View style={{ width: `${Math.min(100, Math.round((spent / 650000) * 100))}%`, height: '100%', borderRadius: 4, backgroundColor: c.accent }} />
        </View>
        <AppText variant="caption">{FRASES[Math.min(n, 2)]}</AppText>
      </Card>
      <Card c={c}>
        <AppText variant="caption" muted>
          AGUA HOY · {water} DE 8
        </AppText>
        <View style={styles.glasses}>
          {Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={[styles.glass, { backgroundColor: i < water ? c.accent2 : c.surface2 }]} />
          ))}
        </View>
      </Card>
      <View style={styles.row}>
        <Chip label="+ Gasto $4.500" onPress={() => setSpent((s) => s + 4500)} bg={c.accent} fg={c.onAccent} />
        <Chip label="Agua +1" onPress={() => setWater((w) => Math.min(8, w + 1))} bg={c.surface2} fg={c.text} />
      </View>
      <AppText variant="caption" muted>
        Registras en un toque y Severa te dice qué significa. Cambia según la hora: planear en la mañana, registrar en la tarde y cerrar el día en la noche.
      </AppText>
    </View>
  );
}

export function SlideTrabajo() {
  const { theme } = useTheme();
  const w = paletteFor(theme, 'work');
  const [net, setNet] = useState(42300);
  const [trips, setTrips] = useState(6);
  const [water, setWater] = useState(5);
  const done = trips >= 10;
  return (
    <View style={[styles.slide, styles.workBg, { backgroundColor: w.bg }]}>
      <Kicker text="TRABAJO · CONDUCTOR" color={w.accent} />
      <AppText variant="title" color={w.text}>
        Tu trabajo, en foco.
      </AppText>
      <Card c={w}>
        <AppText variant="caption" color={w.muted}>
          GANANCIA NETA DE HOY
        </AppText>
        <AppText variant="title" color={w.text}>
          {formatCLP(net)}
        </AppText>
        <AppText variant="caption" color={w.muted}>
          {trips} viajes · bencina y comisión ya descontadas
        </AppText>
      </Card>
      <Card c={w}>
        <AppText variant="caption" color={w.muted}>
          AHORA
        </AppText>
        <AppText variant="subtitle" color={w.text}>
          {done ? 'Jornada lista' : `Viaje ${trips + 1} · Providencia → Ñuñoa`}
        </AppText>
        <Chip
          label={done ? 'Cerrar jornada' : 'Viaje +$6.800'}
          onPress={() => {
            if (done) return;
            setNet((x) => x + 6800);
            setTrips((x) => x + 1);
          }}
          bg={w.accent}
          fg={w.onAccent}
        />
      </Card>
      <View style={[styles.row, { alignItems: 'center' }]}>
        <AppText variant="caption" color={w.muted}>
          Hábitos
        </AppText>
        <Chip label={`Agua +1 · ${water} de 8`} onPress={() => setWater((x) => Math.min(8, x + 1))} bg={w.surface2} fg={w.text} />
      </View>
      <AppText variant="caption" color={w.muted}>
        Una acción grande y el resultado al instante. Y tu vaso de agua, sin salir de Trabajo.
      </AppText>
    </View>
  );
}

export function SlideConectados() {
  const { colors: c, theme } = useTheme();
  const w = paletteFor(theme, 'work');
  const [crossed, setCrossed] = useState(false);
  return (
    <View style={styles.slide}>
      <Kicker text="LOS DOS, CONECTADOS" color={c.accent} />
      <AppText variant="title">Lo que ganas llega solo a tus finanzas.</AppText>
      <View style={styles.row}>
        <View style={[styles.half, { backgroundColor: w.surface }]}>
          <Kicker text="TRABAJO" color={w.accent} />
          <AppText variant="caption" color={w.muted}>
            Ganancia de hoy
          </AppText>
          <AppText variant="subtitle" color={w.text}>
            $42.300
          </AppText>
        </View>
        <View style={[styles.half, { backgroundColor: c.surface }]}>
          <Kicker text="FINANZAS" color={c.accent} />
          <AppText variant="caption" muted>
            Ingresos del mes
          </AppText>
          <AppText variant="subtitle">{formatCLP(1240000 + (crossed ? 42300 : 0))}</AppText>
          {crossed ? (
            <AppText variant="caption" color={c.ok}>
              +$42.300
            </AppText>
          ) : null}
        </View>
      </View>
      <Chip
        label={crossed ? 'Así cruza cada cobro ✓' : 'Ver cómo cruza'}
        onPress={() => setCrossed(true)}
        bg={crossed ? c.okSoft : c.surface2}
        fg={crossed ? c.ok : c.text}
      />
      <Card c={c}>
        <Kicker text="LO QUE LOGRAS" color={c.muted} />
        <AppText>Tu mes completo: lo que ganas y lo que gastas</AppText>
        <AppText>Tu tiempo: trabajo, descanso y lo tuyo</AppText>
        <AppText>Silencio cuando duermes o estás en tu jornada</AppText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { gap: space.lg },
  workBg: { marginHorizontal: -space.xl, paddingHorizontal: space.xl, paddingVertical: space.lg, borderRadius: radius.lg },
  card: { borderRadius: 22, padding: space.lg, gap: space.sm },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  glasses: { flexDirection: 'row', gap: 6 },
  glass: { flex: 1, height: 22, borderRadius: 6 },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  half: { flex: 1, borderRadius: 18, padding: space.md, gap: 4 },
});
