import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { addDays } from '@/core/agenda';
import { CAPAS, OWN_CARDS, PART_INFO, partOfCard, transitionOf, type Capa, type Transition } from '@/core/parts';
import { greeting } from '@/core/today';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { MODULES } from '@/features/modules/catalog';
import { cardAvailable, cardFor } from '@/features/today/homeCards';
import { PrivateNote } from '@/features/today/PersonalCards';
import { useToday, type Today } from '@/features/today/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretLeftIcon, CaretRightIcon, CheckIcon, GearIcon, StarIcon } from '@/ui/icons';
import { Sheet } from '@/ui/kit';
import { SERIF, useLayout } from '@/ui/layout';
import { LogoCuatro } from '@/ui/Logo';
import { setCapa, useCapa, useCapaColors, useV3 } from './useV3';

// Hoy en Severa v3 (C68, 29-10-2026): arriba el logo (abre «Tu cuerpo») y el selector Ser · Cuerpo ·
// Mente · Alma, que reemplaza al interruptor Personal/Trabajo. En el **Ser** van tu día, lo importante
// y tus favoritos de cada parte; en cada **parte**, los módulos que elegiste de ella. El paso entre capas
// sigue el recorrido por el cuerpo: mente↔cuerpo baja o sube, cuerpo↔alma late, mente↔alma gira en
// espiral y el Ser se acerca o se aleja, con un velo del color de la capa de destino.

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const LABEL: Record<string, string> = {
  dia: 'Tu día',
  prio: 'Prioridades',
  paso: 'Tu próximo paso',
  hab: 'Hábitos',
  plata: 'Tu plata',
  trab: 'Trabajo',
  jornada: 'Tu jornada',
  wline: 'Lo de hoy en el trabajo',
  wtasks: 'Tareas del trabajo',
  pan: 'Pan de vida',
  diario: 'Cerrar el día',
  zen: 'Zen',
  resp: 'Respiración',
  medit: 'Meditación',
  sug: 'Sugerencia de Severa',
};
const labelOf = (k: string) => LABEL[k] ?? (k.startsWith('mod:') ? (MODULES[k.slice(4)]?.title ?? k) : k);

// Lo que se ofrece primero como favorito de cada parte, si está.
const FAV_FIRST: Record<Capa, string[]> = { ser: [], cuerpo: ['mod:salud', 'mod:ejercicio', 'jornada', 'mod:alimentacion'], mente: ['paso', 'mod:tu_rutina'], alma: ['pan', 'zen', 'medit'] };

/** Las tarjetas que puede tener una capa para esta persona. */
function candidates(capa: Capa, t: Today): string[] {
  const mods = [...t.on].filter((c) => c !== 'metas' && MODULES[c]).map((c) => `mod:${c}`);
  return [...OWN_CARDS, ...mods].filter((k) => partOfCard(k) === capa && cardAvailable(k, t));
}

function defaultFavs(t: Today): string[] {
  return (['cuerpo', 'mente', 'alma'] as const).flatMap((p) => {
    const list = candidates(p, t);
    return [FAV_FIRST[p].find((k) => list.includes(k)) ?? list[0]].filter(Boolean) as string[];
  });
}

const KIND: Transition[] = ['baja', 'sube', 'latido', 'espiral', 'acerca', 'aleja'];
const DURATION: Record<Transition, number> = { baja: 650, sube: 650, latido: 720, espiral: 620, acerca: 420, aleja: 420 };

export function HoyV3() {
  const { colors } = useTheme();
  const tint = useCapaColors();
  const { wide, columns } = useLayout();
  const v3 = useV3();
  const capa = useCapa();
  const [viewDay, setViewDay] = useState<string | undefined>(undefined);
  const t = useToday(viewDay);
  const [sheet, setSheet] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;
  const d = new Date(`${t.day}T12:00:00`);
  const date = `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const go = (n: number) => {
    tap();
    const next = addDays(t.day, n);
    setViewDay(next === t.realToday ? undefined : next);
  };

  // Lo que se ve en cada capa: lo elegido (si lo hay) o, por defecto, todo lo de esa parte.
  const favs = (v3.favs ?? defaultFavs(t)).filter((k) => cardAvailable(k, t));
  const serBase = [...new Set(['dia', 'prio', ...candidates('ser', t)])].filter((k) => cardAvailable(k, t));
  const listFor = (c: Capa) => (c === 'ser' ? serBase : candidates(c, t));
  const shownFor = (c: Capa) => (v3.picks[c] ?? listFor(c)).filter((k) => listFor(c).includes(k));
  const keys = capa === 'ser' ? [...new Set([...shownFor('ser'), ...favs])] : shownFor(capa);
  const cards = keys.map((k) => [k, cardFor(k, t, setSheet)] as const).filter(([, node]) => node !== null);
  const cols: ReactNode[][] = Array.from({ length: wide ? columns : 1 }, () => []);
  cards.forEach(([k, node], i) => cols[i % cols.length].push(<View key={k}>{node}</View>));

  // La transición entre capas.
  const prev = useRef<Capa>(capa);
  const p = useSharedValue(1);
  const kind = useSharedValue(0);
  useEffect(() => {
    if (prev.current === capa) return;
    const k = transitionOf(prev.current, capa);
    prev.current = capa;
    kind.set(KIND.indexOf(k));
    p.set(0);
    p.set(withTiming(1, { duration: DURATION[k] }));
  }, [capa, kind, p]);
  const moving = useAnimatedStyle(() => {
    const v = p.get();
    switch (KIND[kind.get()]) {
      case 'baja':
        return { opacity: v, transform: [{ translateY: (1 - v) * 240 }] };
      case 'sube':
        return { opacity: v, transform: [{ translateY: -(1 - v) * 240 }] };
      case 'latido': {
        const beat = v < 0.3 ? Math.sin((v / 0.3) * Math.PI) * 0.06 : v < 0.62 ? Math.sin(((v - 0.3) / 0.32) * Math.PI) * 0.035 : 0;
        return { opacity: Math.min(1, v * 2), transform: [{ scale: 1 + beat }] };
      }
      case 'espiral':
        return { opacity: v, transform: [{ rotate: `${(1 - v) * -28}deg` }, { scale: 0.84 + 0.16 * v }] };
      case 'acerca':
        return { opacity: v, transform: [{ scale: 0.9 + 0.1 * v }] };
      default:
        return { opacity: v, transform: [{ scale: 1.08 - 0.08 * v }] };
    }
  });
  const veil = useAnimatedStyle(() => ({ opacity: (1 - p.get()) * 0.22 }));

  const pick = (c: Capa) => {
    tap();
    setCapa(c);
  };
  const title = capa === 'ser' ? (t.isToday ? `${greeting(t.now)}${t.name ? `, ${t.name}` : ''}` : t.day < t.realToday ? 'Así fue tu día' : 'Lo que viene') : PART_INFO[capa].name;

  return (
    <Screen width="full">
      {wide ? null : (
        <View style={{ gap: 12 }}>
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir tu cuerpo" onPress={() => router.push('/tu-cuerpo')} style={[styles.round, { backgroundColor: colors.surface }]}>
              <LogoCuatro size={30} lit={capa === 'ser' ? null : capa} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => router.push('/ajustes')} style={[styles.round, { backgroundColor: colors.surface }]}>
              <GearIcon size={22} color={colors.text} />
            </Pressable>
          </View>
          <View accessibilityRole="tablist" style={[styles.selector, { backgroundColor: colors.surface }]}>
            {CAPAS.map((c) => (
              <Pressable key={c} accessibilityRole="tab" accessibilityState={{ selected: capa === c }} onPress={() => pick(c)} style={[styles.option, capa === c && { backgroundColor: tint[c] }]}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13 }} color={capa === c ? colors.bg : tint[c]}>
                  {PART_INFO[c].name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <View style={styles.dateRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Día anterior" onPress={() => go(-1)} hitSlop={8} style={[styles.arrow, { backgroundColor: colors.surface }]}>
            <CaretLeftIcon size={16} color={colors.text} />
          </Pressable>
          <AppText variant="caption" muted style={{ letterSpacing: 1.4, flex: 1, textAlign: 'center' }}>
            {`${t.isToday ? 'HOY · ' : ''}${date.toUpperCase()}`}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Día siguiente" onPress={() => go(1)} hitSlop={8} style={[styles.arrow, { backgroundColor: colors.surface }]}>
            <CaretRightIcon size={16} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            {capa === 'ser' ? null : (
              <AppText style={styles.kicker} color={tint[capa]}>
                {PART_INFO[capa].verb.toUpperCase()}
              </AppText>
            )}
            <AppText style={{ fontFamily: SERIF, fontSize: wide ? 46 : 34, lineHeight: wide ? 52 : 40 }} color={capa === 'ser' ? colors.text : tint[capa]}>
              {title}
            </AppText>
          </View>
          {!t.isToday ? (
            <Pressable accessibilityRole="button" onPress={() => setViewDay(undefined)} style={[styles.today, { backgroundColor: colors.accent }]}>
              <AppText variant="label" style={{ fontSize: 13 }} color={colors.onAccent}>
                Volver a hoy
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View>
        <Animated.View style={[styles.columns, moving]}>
          {cols.map((col, i) => (
            <View key={i} style={styles.column}>
              {col}
            </View>
          ))}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint[capa], borderRadius: 22 }, veil]} />
      </View>
      {cards.length ? null : (
        <AppText muted>{capa === 'ser' ? 'Todavía no hay nada para tu día.' : `Todavía no tienes módulos de tu ${PART_INFO[capa].name.toLowerCase()} encendidos. Búscalos en Módulos.`}</AppText>
      )}

      <Button label={capa === 'ser' ? 'Elegir lo que ves en el Ser' : `Elegir lo que ves en ${PART_INFO[capa].name}`} kind="secondary" onPress={() => setChoosing(true)} />
      <PrivateNote />
      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
      <ChooseSheet
        visible={choosing}
        capa={capa}
        list={listFor(capa)}
        shown={shownFor(capa)}
        favs={favs}
        onClose={() => setChoosing(false)}
        onShown={(next) => v3.save({ picks: { ...v3.picks, [capa]: next } })}
        onFavs={(next) => v3.save({ favs: next })}
      />
    </Screen>
  );
}

/** Elegir qué tarjetas se ven en una capa y, en las partes, cuáles van como favoritas al Ser. */
function ChooseSheet({ visible, capa, list, shown, favs, onClose, onShown, onFavs }: { visible: boolean; capa: Capa; list: string[]; shown: string[]; favs: string[]; onClose: () => void; onShown: (k: string[]) => void; onFavs: (k: string[]) => void }) {
  const { colors } = useTheme();
  const tint = useCapaColors();
  return (
    <Sheet visible={visible} title={capa === 'ser' ? 'Lo que ves en el Ser' : `Lo que ves en ${PART_INFO[capa].name}`} onClose={onClose}>
      <AppText variant="caption" muted>
        {capa === 'ser' ? 'Tu día y lo importante. Tus favoritos de cada parte se marcan con la estrella dentro de cada parte.' : 'Toca para mostrar u ocultar. La estrella la lleva también al Ser, entre tus favoritos.'}
      </AppText>
      {list.length ? null : (
        <AppText variant="caption" muted>
          No hay módulos encendidos en esta parte. Enciéndelos en Módulos.
        </AppText>
      )}
      {list.map((k) => {
        const on = shown.includes(k);
        const fav = favs.includes(k);
        return (
          <View key={k} style={[styles.row, { borderBottomColor: colors.line }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                onShown(on ? shown.filter((x) => x !== k) : list.filter((x) => x === k || shown.includes(x)));
              }}
              style={styles.rowMain}
            >
              <View style={[styles.check, { borderColor: on ? tint[capa] : colors.line, backgroundColor: on ? tint[capa] : 'transparent' }]}>{on ? <CheckIcon size={14} weight="bold" color={colors.bg} /> : null}</View>
              <AppText variant="label" style={{ flex: 1 }}>
                {labelOf(k)}
              </AppText>
            </Pressable>
            {capa === 'ser' ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fav ? `Quitar ${labelOf(k)} de tus favoritos` : `Llevar ${labelOf(k)} al Ser`}
                onPress={() => {
                  tap();
                  onFavs(fav ? favs.filter((x) => x !== k) : [...favs, k]);
                }}
                hitSlop={6}
                style={[styles.star, { backgroundColor: colors.surface2 }]}
              >
                <StarIcon size={18} weight={fav ? 'fill' : 'regular'} color={fav ? colors.accent : colors.muted} />
              </Pressable>
            )}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  selector: { flexDirection: 'row', padding: 4, borderRadius: 999, gap: 2 },
  option: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  today: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.6, fontSize: 12 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  column: { flex: 1, minWidth: 0, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  star: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
