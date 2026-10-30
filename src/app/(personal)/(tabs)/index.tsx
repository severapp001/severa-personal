import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { addDays } from '@/core/agenda';
import { greeting } from '@/core/today';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { MODULES } from '@/features/modules/catalog';
import { SpaceTopBar } from '@/features/space/SpaceHeader';
import { usePref } from '@/features/space/usePref';
import { cardFor } from '@/features/today/homeCards';
import { PrivateNote } from '@/features/today/PersonalCards';
import { useToday, type Today } from '@/features/today/useToday';
import { HoyV3 } from '@/features/v3/HoyV3';
import { useV3 } from '@/features/v3/useV3';
import { JornadaCard, WorkLineCard, WorkTasksCard } from '@/features/today/WorkToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ArrowDownIcon, ArrowUpIcon, CaretLeftIcon, CaretRightIcon, PlusIcon, XIcon } from '@/ui/icons';
import { Sheet } from '@/ui/kit';
import { useLayout } from '@/ui/layout';

// Hoy (vista previa del 17-10-2026, variante B). En Personal se arma con lo que la persona eligió en
// Conocerte y se ordena según la hora; en Trabajo es el modo foco: la jornada y sus tareas.
// 26-10-2026 (usuario): se puede ver otro día (atrás y adelante, como en la v1) y personalizar el
// inicio: cada módulo tiene su tarjeta y se eligen y ordenan; sin tocar nada, manda lo de Severa.

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const CORE: Record<string, string> = {
  dia: 'Tu día',
  paso: 'Tu próximo paso (metas)',
  yo: 'Cuerpo, mente y alma',
  prio: 'Prioridades del día',
  hab: 'Hábitos',
  plata: 'Tu plata',
  trab: 'Trabajo',
  pan: 'Pan de vida',
  diario: 'Cerrar el día',
  zen: 'Zen · frase del día',
  resp: 'Respiración',
  medit: 'Meditación',
  sug: 'Sugerencia de Severa',
};
// Las tarjetas que dependen de un módulo encendido (para no ofrecerlas si no está).
const NEEDS: Record<string, string> = { pan: 'biblia', zen: 'zen', resp: 'respiracion', medit: 'meditacion' };
const labelOf = (k: string) => CORE[k] ?? (k.startsWith('mod:') ? (MODULES[k.slice(4)]?.title ?? k) : k);

function Stagger({ children }: { children: ReactNode[] }) {
  return (
    <>
      {children.filter(Boolean).map((child, i) => (
        <Animated.View key={i} entering={FadeInDown.delay(Math.min(i, 6) * 60).duration(380)}>
          {child}
        </Animated.View>
      ))}
    </>
  );
}

// Módulos que ya tienen su tarjeta propia en Inicio (Metas → «Tu próximo paso»).
const OWN_CARD = new Set(['metas']);

/** El orden de Severa: según la hora y con las tarjetas de los módulos encendidos. */
function defaultOrder(t: Today): string[] {
  const h = t.now.getHours();
  const night = h >= 20 || h < 4;
  const morning = h >= 4 && h < 11;
  const mods = Object.keys(MODULES)
    .filter((c) => t.on.has(c) && !OWN_CARD.has(c))
    .slice(0, 4)
    .map((c) => `mod:${c}`);
  const base = night
    ? ['diario', 'dia', 'paso', 'hab', 'yo', 'prio', 'plata', 'trab', 'pan', 'medit', ...mods, 'sug']
    : morning
      ? ['dia', 'paso', 'yo', 'zen', 'pan', 'prio', 'hab', 'trab', 'plata', ...mods, 'diario', 'sug']
      : ['dia', 'paso', 'trab', 'prio', 'hab', 'yo', 'plata', 'zen', 'pan', 'resp', ...mods, 'diario', 'sug'];
  return base.filter((k) => !NEEDS[k] || t.on.has(NEEDS[k]));
}

// Severa v3 (C64–C70): con «Probar Severa v3» encendido en Ajustes, Hoy es el de la v3 (features/v3).
export default function Hoy() {
  const { on } = useV3();
  return on ? <HoyV3 /> : <HoyScreen />;
}

function HoyScreen() {
  const { colors, mode } = useTheme();
  const { wide, columns } = useLayout();
  const [viewDay, setViewDay] = useState<string | undefined>(undefined);
  const t = useToday(viewDay);
  const [sheet, setSheet] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [layout, saveLayout, customized] = usePref<{ order: string[] }>('inicio', { order: [] });
  const work = mode === 'work';
  const d = new Date(`${t.day}T12:00:00`);
  const date = `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;
  const order = customized && layout.order.length ? layout.order : defaultOrder(t);
  const go = (n: number) => {
    tap();
    const next = addDays(t.day, n);
    setViewDay(next === t.realToday ? undefined : next);
  };

  const body: ReactNode[] = work
    ? t.works
      ? [
          <JornadaCard key="j" t={t} />,
          <WorkLineCard key="l" t={t} />,
          <WorkTasksCard key="w" t={t} />,
          <Button key="m" label="Mis trabajos y su calendario" kind="secondary" onPress={() => router.navigate('/trabajo')} />,
        ]
      : [
          <AppText key="n" muted>
            En Conocerte no elegiste un oficio. Cuando agregues tu trabajo, aquí tendrás tu jornada en modo foco.
          </AppText>,
          <Button key="m" label="Agregar mi trabajo" onPress={() => router.navigate('/trabajo')} />,
        ]
    : order.map((k) => cardFor(k, t, setSheet));

  // En el computador (29-10-2026): «Tu día» (o la jornada) arriba a todo el ancho y el resto en
  // columnas, repartidas en orden. En el teléfono, una sola columna como siempre.
  const [lead, ...rest] = body.filter(Boolean);
  const cols: ReactNode[][] = Array.from({ length: columns }, () => []);
  rest.forEach((card, i) => cols[i % columns].push(card));
  const cards =
    wide && lead ? (
      <View key={`${mode}:${t.day}`} style={{ gap: 16 }}>
        <Stagger>{[lead]}</Stagger>
        <View style={styles.columns}>
          {cols.map((col, i) => (
            <View key={i} style={styles.column}>
              <Stagger>{col}</Stagger>
            </View>
          ))}
        </View>
      </View>
    ) : (
      // La clave por espacio y día vuelve a animar las tarjetas al cruzar o cambiar de día.
      <View key={`${mode}:${t.day}`} style={{ gap: 12 }}>
        <Stagger>{body}</Stagger>
      </View>
    );

  return (
    <Screen width="full">
      {wide ? null : <SpaceTopBar pip={!work && !!t.suggestion} />}
      <View style={{ gap: 6 }}>
        <View style={styles.dateRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Día anterior" onPress={() => go(-1)} hitSlop={8} style={[styles.arrow, { backgroundColor: colors.surface }]}>
            <CaretLeftIcon size={16} color={colors.text} />
          </Pressable>
          <AppText variant="caption" muted style={{ letterSpacing: 1.4, flex: 1, textAlign: 'center' }}>
            {`${work ? 'TRABAJO · ' : ''}${t.isToday ? 'HOY · ' : ''}${date.toUpperCase()}`}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Día siguiente" onPress={() => go(1)} hitSlop={8} style={[styles.arrow, { backgroundColor: colors.surface }]}>
            <CaretRightIcon size={16} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText variant="title" style={{ flex: 1 }}>
            {work ? (t.trade?.name ?? 'Trabajo') : t.isToday ? `${greeting(t.now)}${t.name ? `, ${t.name}` : ''}` : t.day < t.realToday ? 'Así fue tu día' : 'Lo que viene'}
          </AppText>
          {!t.isToday ? (
            <Pressable accessibilityRole="button" onPress={() => setViewDay(undefined)} style={[styles.today, { backgroundColor: colors.accent }]}>
              <AppText variant="label" style={{ fontSize: 13 }} color={colors.onAccent}>
                Volver a hoy
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
      {cards}
      {!work ? <Button label="Personalizar inicio" kind="secondary" onPress={() => setEditing(true)} /> : null}
      <PrivateNote />
      <View style={{ height: 8, backgroundColor: colors.bg }} />
      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
      <LayoutSheet
        visible={editing}
        order={order}
        customized={customized && layout.order.length > 0}
        onClose={() => setEditing(false)}
        onSave={(o) => saveLayout({ order: o })}
      />
    </Screen>
  );
}

/** Elegir y ordenar las tarjetas de Hoy. */
function LayoutSheet({ visible, order, customized, onClose, onSave }: { visible: boolean; order: string[]; customized: boolean; onClose: () => void; onSave: (o: string[]) => Promise<void> }) {
  const { colors } = useTheme();
  const all = [...Object.keys(CORE), ...Object.keys(MODULES).filter((c) => !OWN_CARD.has(c)).map((c) => `mod:${c}`)];
  const hidden = all.filter((k) => !order.includes(k));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    tap();
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onSave(next);
  };
  return (
    <Sheet visible={visible} title="Personalizar inicio" onClose={onClose}>
      <AppText variant="caption" muted>
        {customized ? 'Tu orden. Sube, baja o quita tarjetas; abajo están las que puedes sumar.' : 'Ahora manda el orden de Severa (cambia según la hora). Si mueves algo, queda tu orden.'}
      </AppText>
      {order.map((k, i) => (
        <View key={k} style={[styles.row, { borderBottomColor: colors.line }]}>
          <AppText variant="label" style={{ flex: 1 }}>
            {labelOf(k)}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={`Subir ${labelOf(k)}`} onPress={() => move(i, -1)} style={[styles.ctl, { backgroundColor: colors.surface2, opacity: i ? 1 : 0.3 }]}>
            <ArrowUpIcon size={16} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Bajar ${labelOf(k)}`} onPress={() => move(i, 1)} style={[styles.ctl, { backgroundColor: colors.surface2, opacity: i < order.length - 1 ? 1 : 0.3 }]}>
            <ArrowDownIcon size={16} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${labelOf(k)}`}
            onPress={() => {
              tap();
              onSave(order.filter((x) => x !== k));
            }}
            style={[styles.ctl, { backgroundColor: colors.surface2 }]}
          >
            <XIcon size={16} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <AppText variant="caption" muted style={{ fontFamily: fonts.extrabold, letterSpacing: 1.1, fontSize: 10 }}>
        PARA SUMAR
      </AppText>
      <View style={styles.wrap}>
        {hidden.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            onPress={() => {
              tap();
              onSave([...order, k]);
            }}
            style={[styles.chip, { backgroundColor: colors.surface2 }]}
          >
            <PlusIcon size={14} color={colors.accent} />
            <AppText variant="label" style={{ fontSize: 13 }}>
              {labelOf(k)}
            </AppText>
          </Pressable>
        ))}
      </View>
      {customized ? <Button label="Volver al orden de Severa" kind="link" onPress={() => onSave([])} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  column: { flex: 1, minWidth: 0, gap: 16 },
  arrow: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  today: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  ctl: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
});
