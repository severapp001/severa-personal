import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { duration, fmtTime, isLive, isPast, type DayIcon, type DayItem } from '@/core/today';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import {
  BarbellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CarIcon,
  CheckIcon,
  CoffeeIcon,
  FlagIcon,
  ForkKnifeIcon,
  HandsPrayingIcon,
  MoonIcon,
  PencilSimpleIcon,
  PersonSimpleWalkIcon,
  PlayIcon,
  SunIcon,
  type Icon,
} from '@/ui/icons';

// La línea del día (vista previa del 17-10-2026, al estilo Structured). En Hoy va corta y se
// desliza para ver lo que pasó y lo que sigue; en Calendario va completa.

export const DAY_ICONS: Record<DayIcon, Icon> = {
  sun: SunIcon,
  moon: MoonIcon,
  book: BookOpenIcon,
  briefcase: BriefcaseIcon,
  fork: ForkKnifeIcon,
  walk: PersonSimpleWalkIcon,
  pen: PencilSimpleIcon,
  dumbbell: BarbellIcon,
  pray: HandsPrayingIcon,
  play: PlayIcon,
  car: CarIcon,
  flag: FlagIcon,
  coffee: CoffeeIcon,
};

const ROW = 56;

type Props = {
  items: DayItem[];
  now: number;
  done: (id: string) => boolean;
  onToggle: (id: string) => void;
};

function useStates(item: DayItem, now: number, done: (id: string) => boolean) {
  const d = done(item.id);
  const live = !d && isLive(item, now);
  const late = !d && !live && isPast(item, now);
  return { d, live, late };
}

function NowRow({ now }: { now: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.nowRow} accessibilityLabel={`Ahora, ${fmtTime(now)}`}>
      <AppText variant="caption" color={colors.accent} style={styles.time}>
        {fmtTime(now)}
      </AppText>
      <View style={[styles.nowLine, { backgroundColor: colors.accent }]} />
    </View>
  );
}

function CompactRow({ item, now, done, onToggle }: Omit<Props, 'items'> & { item: DayItem }) {
  const { colors } = useTheme();
  const { d, live, late } = useStates(item, now, done);
  const Glyph = DAY_ICONS[item.icon];
  const tint = item.work ? colors.accent2 : colors.accent;
  return (
    <View style={styles.row}>
      <AppText variant="caption" muted style={styles.time}>
        {fmtTime(item.t)}
      </AppText>
      <View style={styles.col}>
        <View style={[styles.rail, { backgroundColor: colors.line }]} />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: d }}
          accessibilityLabel={item.title}
          hitSlop={8}
          onPress={() => {
            tap();
            onToggle(item.id);
          }}
          style={[
            styles.tick,
            {
              backgroundColor: d ? tint : live ? colors.accent2Soft : colors.surface,
              borderColor: d ? tint : live ? colors.accent2 : late ? colors.mid : colors.line,
            },
          ]}
        >
          {d ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : live ? <Glyph size={14} color={colors.accent2} /> : null}
        </Pressable>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="label" numberOfLines={1} color={d ? colors.muted : colors.text} style={{ fontSize: 15 }}>
          {item.title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {item.sub}
        </AppText>
      </View>
      {live ? (
        <Pill text="En curso" bg={colors.accent2Soft} fg={colors.accent2} />
      ) : late ? (
        <Pill text="Pendiente" bg={colors.midSoft} fg={colors.mid} />
      ) : (
        <Glyph size={18} color={colors.muted} />
      )}
    </View>
  );
}

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <AppText variant="caption" color={fg} style={{ fontSize: 11 }}>
        {text}
      </AppText>
    </View>
  );
}

/** Versión corta: se ve una fila de lo que pasó, «ahora» y lo que sigue; el resto se desliza. */
export function DayLineCompact({ items, now, done, onToggle }: Props) {
  const scroll = useRef<ScrollView>(null);
  const before = items.filter((it) => it.t <= now).length;
  // La línea «ahora» solo el día de hoy (en un día pasado `now` es 1440 y en uno futuro, -1).
  const showNow = now >= 0 && now < 1440;
  return (
    <ScrollView
      ref={scroll}
      style={{ maxHeight: ROW * 3.6 }}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW}
      onContentSizeChange={() => scroll.current?.scrollTo({ y: Math.max(0, (before - 1) * ROW), animated: false })}
    >
      {items.map((it, i) => (
        <View key={it.id}>
          {showNow && i === before ? <NowRow now={now} /> : null}
          <CompactRow item={it} now={now} done={done} onToggle={onToggle} />
        </View>
      ))}
      {showNow && before === items.length ? <NowRow now={now} /> : null}
    </ScrollView>
  );
}

/** Versión completa (Calendario): cápsulas que crecen con la duración. */
export function DayLineFull({ items, now, done, onToggle }: Props) {
  const { colors } = useTheme();
  const before = items.filter((it) => it.t <= now).length;
  return (
    <View>
      {items.map((it, i) => {
        const d = done(it.id);
        const live = !d && isLive(it, now);
        const Glyph = d ? CheckIcon : DAY_ICONS[it.icon];
        const tint = it.work ? colors.accent2 : colors.accent;
        const height = it.end ? Math.min(150, Math.max(64, ((it.end - it.t) / 60) * 30)) : 48;
        return (
          <View key={it.id}>
            {now >= 0 && now < 1440 && i === before ? <NowRow now={now} /> : i > 0 ? <View style={[styles.gap, { borderColor: colors.line }]} /> : null}
            <View style={styles.fullRow}>
              <AppText variant="caption" muted style={[styles.time, { paddingTop: 14 }]}>
                {fmtTime(it.t)}
              </AppText>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: d }}
                accessibilityLabel={it.title}
                onPress={() => {
                  tap();
                  onToggle(it.id);
                }}
                style={[
                  styles.capsule,
                  { height, backgroundColor: d ? tint : colors.surface2, borderColor: live ? colors.accent2 : 'transparent' },
                ]}
              >
                <Glyph size={20} weight={d ? 'bold' : 'regular'} color={d ? colors.onAccent : tint} />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, paddingTop: 10, gap: 2 }}>
                <AppText variant="label" style={{ fontSize: 15 }} color={d ? colors.muted : colors.text}>
                  {it.title}
                </AppText>
                <AppText variant="caption" muted>
                  {it.end ? `${fmtTime(it.t)} – ${fmtTime(it.end)} · ${duration(it.end - it.t)}` : it.sub}
                </AppText>
                {live ? <Pill text="En curso" bg={colors.accent2Soft} fg={colors.accent2} /> : null}
              </View>
            </View>
          </View>
        );
      })}
      {now >= 0 && now < 1440 && before === items.length ? <NowRow now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  time: { width: 44, fontVariant: ['tabular-nums'] },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: 10 },
  col: { width: 30, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  rail: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  nowRow: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nowLine: { flex: 1, height: 2, borderRadius: 1 },
  fullRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  capsule: { width: 48, borderRadius: 24, alignItems: 'center', paddingTop: 13, borderWidth: 2 },
  gap: { height: 14, marginLeft: 44 + 12 + 23, borderLeftWidth: 2, borderStyle: 'dotted' },
});
