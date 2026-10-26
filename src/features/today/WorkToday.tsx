import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayAmount, formatCLP } from '@/core/money';
import { duration, minutesNow, type DayItem } from '@/core/today';
import { useFinance } from '@/data/finance';
import { useHabits } from '@/data/modules';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, EyeButton } from '@/ui';
import { tap } from '@/ui/haptics';
import { CoffeeIcon, DropIcon } from '@/ui/icons';
import { DayLineCompact, DayLineFull } from './DayLine';
import { Card, PrioritiesCard } from './PersonalCards';
import type { Today } from './useToday';

// Trabajo en modo foco (A3, F28): la jornada, su línea y los hábitos rápidos. Mientras llegan las
// tablas de la jornada (MD7), lo que se registra queda en este teléfono.

type LogEntry = { t: number; kind: 'trip' | 'fuel'; a: number };

const nowSec = () => Math.floor(Date.now() / 1000);
const minOfDay = (sec: number) => minutesNow(new Date(sec * 1000));

function useJornada(t: Today) {
  const start = t.marks['j:start']?.value || null;
  const end = t.marks['j:end']?.value || null;
  let log: LogEntry[] = [];
  try {
    log = JSON.parse(t.marks['j:log']?.text ?? '[]') as LogEntry[];
  } catch {
    log = [];
  }
  const trips = log.filter((e) => e.kind === 'trip');
  const earned = trips.reduce((s, e) => s + e.a, 0);
  const fuel = log.filter((e) => e.kind === 'fuel').reduce((s, e) => s + e.a, 0);
  const add = (kind: LogEntry['kind'], a: number) => t.setMark('j:log', { text: JSON.stringify([...log, { t: nowSec(), kind, a }]) });
  return { start, end, log, trips, earned, fuel, net: earned - fuel, add };
}

function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

const clock = (secs: number) =>
  [Math.floor(secs / 3600), Math.floor(secs / 60) % 60, secs % 60].map((v) => String(Math.max(0, v)).padStart(2, '0')).join(':');

/** Los ítems de la línea del día en Trabajo, armados con lo registrado. */
export function workItems(t: Today, j: ReturnType<typeof useJornada>): DayItem[] {
  const items: DayItem[] = [];
  if (!j.start) {
    items.push({ id: 'w-start', t: t.nowMin, title: 'Empezar jornada', sub: 'Cuando partas, toca Empezar', icon: 'play', work: true });
    return items;
  }
  items.push({ id: 'w-start', t: minOfDay(j.start), title: 'Empezar jornada', sub: 'Conductor', icon: 'play', work: true });
  j.log.forEach((e, i) =>
    items.push({
      id: `w-log-${i}`,
      t: minOfDay(e.t),
      title: e.kind === 'trip' ? `Viaje ${j.log.slice(0, i + 1).filter((x) => x.kind === 'trip').length}` : 'Bencina',
      sub: e.kind === 'trip' ? 'Ganado' : 'Gasto del trabajo',
      icon: e.kind === 'trip' ? 'car' : 'coffee',
      work: true,
    }),
  );
  if (t.marks['h:pausa']?.value) items.push({ id: 'w-pausa', t: t.nowMin - 1, title: 'Pausa', sub: `${t.marks['h:pausa'].value} hoy`, icon: 'coffee', work: true });
  items.push({ id: 'w-end', t: j.end ? minOfDay(j.end) : Math.max(t.nowMin + 1, minOfDay(j.start) + 1), title: 'Cerrar jornada', sub: j.end ? 'Ganancia neta calculada' : 'Calcula tu ganancia neta', icon: 'flag', work: true });
  return items.sort((a, b) => a.t - b.t);
}

function AmountSheet({ kind, onClose, onSave }: { kind: LogEntry['kind'] | null; onClose: () => void; onSave: (a: number) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const amount = Number(value.replace(/\D/g, '')) || 0;
  const quick = kind === 'fuel' ? [5000, 10000, 20000] : [3000, 5000, 8000];
  if (!kind) return null;
  const save = (a: number) => {
    if (!a) return;
    tap();
    onSave(a);
    setValue('');
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]}>
        <AppText variant="subtitle">{kind === 'trip' ? '¿Cuánto ganaste en el viaje?' : '¿Cuánto cargaste de bencina?'}</AppText>
        <TextInput
          autoFocus
          value={value ? formatCLP(amount) : ''}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="$0"
          placeholderTextColor={colors.muted}
          style={[styles.amountInput, { color: colors.text, backgroundColor: colors.surface2 }]}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {quick.map((q) => (
            <Pressable key={q} onPress={() => save(q)} style={[styles.quick, { backgroundColor: colors.surface2 }]}>
              <AppText variant="label">{formatCLP(q)}</AppText>
            </Pressable>
          ))}
        </View>
        <Button label="Guardar" disabled={!amount} onPress={() => save(amount)} />
      </View>
    </Modal>
  );
}

export function JornadaCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const money = useAmountVisibility();
  const f = useFinance();
  const j = useJornada(t);
  const [sheet, setSheet] = useState<LogEntry['kind'] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const running = !!j.start && !j.end;
  useTicker(running);
  const show = (n: number) => displayAmount(n, money.visible);
  const stats = (
    <View style={styles.stats}>
      {[
        ['Viajes', String(j.trips.length)],
        ['Ganado', show(j.earned)],
        ['Bencina', show(j.fuel)],
      ].map(([k, v]) => (
        <View key={k} style={[styles.stat, { backgroundColor: colors.surface2 }]}>
          <AppText variant="caption" muted>
            {k}
          </AppText>
          <AppText variant="label" style={{ fontSize: 16, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {v}
          </AppText>
        </View>
      ))}
    </View>
  );

  if (!j.start) {
    return (
      <Card kicker={`Jornada de hoy${t.trade ? ` · ${t.trade.name}` : ''}`} title="Cuando partas, empieza tu jornada">
        <AppText variant="caption" muted>
          Severa cuenta el tiempo, tus viajes y la bencina, y al cerrar te dice cuánto ganaste de verdad.
        </AppText>
        <Button
          label="Empezar jornada"
          onPress={() => {
            tap();
            t.setMark('j:start', { value: nowSec() });
          }}
        />
      </Card>
    );
  }

  const elapsed = (j.end ?? nowSec()) - j.start;
  if (j.end) {
    const hours = Math.max(elapsed / 3600, 1 / 60);
    return (
      <Card kicker={`Jornada cerrada · ${duration(Math.round(elapsed / 60))}`} title={`Ganancia neta ${show(j.net)}`} right={<EyeButton visible={money.visible} onPress={money.toggle} />}>
        {stats}
        <AppText variant="caption" muted>
          {`${show(j.net / hours)} por hora. Lo ganado y la bencina ya quedaron en tus Finanzas.`}
        </AppText>
      </Card>
    );
  }

  return (
    <Card kicker="En jornada" right={<EyeButton visible={money.visible} onPress={money.toggle} />}>
      <AppText style={{ fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{clock(elapsed)}</AppText>
      {stats}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="+ Viaje" onPress={() => setSheet('trip')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="+ Bencina" kind="secondary" onPress={() => setSheet('fuel')} />
        </View>
      </View>
      {confirm ? (
        <View style={[styles.confirm, { backgroundColor: colors.surface2 }]}>
          <AppText variant="label">{`Ganado ${show(j.earned)} − bencina ${show(j.fuel)} = ${show(j.net)} neto`}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Seguir" kind="secondary" onPress={() => setConfirm(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Cerrar jornada"
                onPress={async () => {
                  tap();
                  await t.setMark('j:end', { value: nowSec() });
                  setConfirm(false);
                  // Un cobro de Trabajo es el ingreso de Finanzas (MD3): lo ganado y la bencina pasan solos.
                  const cat = (code: string) => f.categories.find((c) => (c as { code?: string }).code === code)?.id ?? null;
                  const day = t.day;
                  const name = t.trade?.name ?? 'Trabajo';
                  try {
                    if (j.earned) await f.addMovement({ kind: 'income', amount: j.earned, occurred_on: day, account_id: null, category_id: cat('work_income'), description: `Jornada · ${name} · ${j.trips.length} viajes` });
                    if (j.fuel) await f.addMovement({ kind: 'expense', amount: j.fuel, occurred_on: day, account_id: null, category_id: cat('fuel'), description: `Bencina · ${name}` });
                  } catch {
                    // Si aún no carga el espacio, la jornada queda cerrada igual; se puede registrar a mano.
                  }
                }}
              />
            </View>
          </View>
        </View>
      ) : (
        <Button label="Cerrar jornada" kind="link" onPress={() => setConfirm(true)} />
      )}
      <AmountSheet
        kind={sheet}
        onClose={() => setSheet(null)}
        onSave={(a) => {
          if (sheet) j.add(sheet, a);
          setSheet(null);
        }}
      />
    </Card>
  );
}

export function WorkLineCard({ t }: { t: Today }) {
  const j = useJornada(t);
  const items = workItems(t, j);
  return (
    <Card kicker="Tu jornada en línea" title={j.end ? 'Jornada cerrada' : j.start ? `${j.trips.length} ${j.trips.length === 1 ? 'viaje' : 'viajes'} hasta ahora` : 'Todavía no empiezas'}>
      <DayLineCompact items={items} now={t.nowMin} done={(id) => id === 'w-start' ? !!j.start : id === 'w-end' ? !!j.end : id.startsWith('w-log') || id === 'w-pausa'} onToggle={() => undefined} />
    </Card>
  );
}

export function WorkTasksCard({ t }: { t: Today }) {
  return <PrioritiesCard t={t} prefix="wt" kicker="Tareas del trabajo" empty="Lo pendiente del trabajo" placeholder="Por ejemplo: pagar el TAG" />;
}

/** Barra de hábitos rápidos sobre la navegación de Trabajo (A3): se suma sin cruzar a Personal.
 *  Desde el 25-10-2026 usa los mismos hábitos que Personal (tabla habits), así un vaso de agua
 *  sumado en un espacio se ve en el otro. La pausa es propia de la jornada. */
export function QuickHabitsBar({ day, pauses, onPause }: { day: string; pauses: number; onPause: () => void }) {
  const { colors } = useTheme();
  const h = useHabits(day);
  const shown = h.habits.slice(0, 3);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg }}
      contentContainerStyle={styles.quickBar}
    >
      <AppText variant="caption" muted style={{ fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 10 }}>
        HÁBITOS
      </AppText>
      {shown.map((x) => {
        const n = h.countFor(x.id);
        const target = Number(x.daily_target) || 1;
        const reduce = x.direction === 'reduce';
        return (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`Sumar: ${x.name}`}
            onPress={() => {
              tap();
              if (reduce || n < target) h.log(x.id, 1);
            }}
            onLongPress={() => n && h.log(x.id, -1)}
            style={[styles.qpill, { backgroundColor: colors.surface2 }]}
          >
            {x.template_code === 'agua' ? <DropIcon size={16} color={colors.text} /> : null}
            <AppText variant="label" numberOfLines={1} style={{ fontSize: 13, maxWidth: 110 }}>
              {x.name}
            </AppText>
            <AppText variant="label" color={reduce ? colors.mid : n >= target ? colors.ok : colors.accent} style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {reduce ? n : `${n}/${target}`}
            </AppText>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sumar una pausa"
        onPress={() => {
          tap();
          onPause();
        }}
        style={[styles.qpill, { backgroundColor: colors.surface2 }]}
      >
        <CoffeeIcon size={16} color={colors.text} />
        <AppText variant="label" style={{ fontSize: 13 }}>
          Pausa
        </AppText>
        {pauses ? (
          <AppText variant="label" color={colors.accent} style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
            {pauses}
          </AppText>
        ) : null}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, padding: 10, gap: 2, minWidth: 0 },
  confirm: { borderRadius: radius.md, padding: space.md, gap: space.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, gap: space.md },
  amountInput: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, fontFamily: fonts.extrabold, fontSize: 28 },
  quick: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  quickBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 8 },
  qpill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
});

/** La jornada completa, para Calendario en Trabajo. */
export function WorkDayFull({ t }: { t: Today }) {
  const j = useJornada(t);
  const items = workItems(t, j);
  return (
    <DayLineFull
      items={items}
      now={t.nowMin}
      done={(id) => (id === 'w-start' ? !!j.start : id === 'w-end' ? !!j.end : id.startsWith('w-log') || id === 'w-pausa')}
      onToggle={() => undefined}
    />
  );
}
