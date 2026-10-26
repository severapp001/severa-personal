import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eventsOn, hhmm } from '@/core/agenda';
import { displayAmount, formatCLP } from '@/core/money';
import { duration, minutesNow, toMinutes, type DayItem } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useEntries, type Entry } from '@/data/entries';
import { useFinance } from '@/data/finance';
import { useHabits } from '@/data/modules';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { activeJobs, byTrips, clock, endOf, logOf, nowSec, startOf, tramoEarnings, useNowSec, worksOn, type LogItem } from '@/features/work/jobs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, EyeButton } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon, CoffeeIcon, DropIcon, PlusIcon } from '@/ui/icons';
import { DayLineCompact, DayLineFull } from './DayLine';
import { Card } from './PersonalCards';
import type { Today } from './useToday';

// Trabajo en modo foco (A3, F28). Desde el 26-10-2026 la jornada es por tramos y por trabajo
// (shopper de 7 a 13, Uber hasta las 17…), se guarda sincronizada (motor común, módulo «trabajo»)
// y el cronómetro avanza de verdad. Al terminar un tramo, lo ganado y la bencina pasan a Finanzas.

/** Los trabajos, los tramos de hoy y las acciones de la jornada. */
export function useWork(day: string) {
  const store = useEntries('trabajo');
  const finance = useFinance();
  const jobs = store.of('trabajo');
  const tramos = store.of('tramo');
  const open = tramos.find((x) => !endOf(x)) ?? null;
  const today = tramos.filter((x) => x.day === day).sort((a, b) => startOf(a) - startOf(b));
  const jobOf = (x: Entry | null) => (x ? (jobs.find((j) => j.id === x.parent_id) ?? null) : null);

  async function close(tramo: Entry) {
    const end = nowSec();
    const job = jobOf(tramo);
    const r = tramoEarnings({ ...tramo, data: { ...tramo.data, end } }, job, end);
    await store.update(tramo.id, { data: { ...tramo.data, end }, amount: r.earned, value: Math.round(r.hours * 100) / 100 });
    // Un cobro de Trabajo es el ingreso de Finanzas (MD3): lo ganado y la bencina pasan solos.
    try {
      const cat = (code: string) => finance.categories.find((c) => (c as { code?: string }).code === code)?.id ?? null;
      const name = job?.title ?? 'Trabajo';
      if (r.earned && job?.data.pago !== 'Sueldo mensual') await finance.addMovement({ kind: 'income', amount: r.earned, occurred_on: tramo.day ?? day, account_id: null, category_id: cat('work_income'), description: `Jornada · ${name}${r.trips ? ` · ${r.trips} viajes` : ''} · ${duration(Math.round(r.hours * 60))}` });
      if (r.fuel) await finance.addMovement({ kind: 'expense', amount: r.fuel, occurred_on: tramo.day ?? day, account_id: null, category_id: cat('fuel'), description: `Bencina · ${name}` });
    } catch {
      // Si aún no carga el espacio, el tramo queda cerrado igual; se puede registrar a mano.
    }
  }

  return {
    store,
    jobs,
    tramos,
    open,
    today,
    jobOf,
    addJob: (title: string, oficio?: string | null) => store.add({ kind: 'trabajo', title, data: { oficio: oficio ?? null, pago: oficio && /Conductor|Shopper/.test(oficio) ? 'Por viaje o pedido' : null } }),
    /** Empieza un tramo; si había otro abierto, lo cierra (cambiar de trabajo). */
    start: async (job: Entry) => {
      if (open) await close(open);
      await store.add({ kind: 'tramo', parent_id: job.id, day, title: job.title, data: { start: nowSec(), end: null, log: [] } });
    },
    close,
    log: (tramo: Entry, kind: LogItem['kind'], a: number) => store.update(tramo.id, { data: { ...tramo.data, log: [...logOf(tramo), { t: nowSec(), kind, a }] } }),
  };
}

function AmountSheet({ kind, onClose, onSave }: { kind: LogItem['kind'] | null; onClose: () => void; onSave: (a: number) => void }) {
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
        <AppText variant="subtitle">{kind === 'trip' ? '¿Cuánto ganaste en el viaje?' : kind === 'fuel' ? '¿Cuánto cargaste de bencina?' : '¿Cuánto ganaste?'}</AppText>
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

/** Botones para empezar (o cambiar a) cada trabajo vigente. */
function JobChips({ jobs, current, onPick }: { jobs: Entry[]; current: string | null; onPick: (j: Entry) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {jobs.map((j) => {
        const on = j.id === current;
        return (
          <Pressable
            key={j.id}
            accessibilityRole="button"
            disabled={on}
            onPress={() => {
              tap();
              onPick(j);
            }}
            style={[styles.job, { backgroundColor: on ? colors.accent : colors.surface2 }]}
          >
            <AppText variant="label" color={on ? colors.onAccent : colors.text}>
              {on ? `● ${j.title}` : `▶ ${j.title}`}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function JornadaCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const money = useAmountVisibility();
  const w = useWork(t.day);
  const [sheet, setSheet] = useState<LogItem['kind'] | null>(null);
  const now = useNowSec(!!w.open);
  const show = (n: number) => displayAmount(n, money.visible);
  const jobs = activeJobs(w.jobs, t.day);
  const weekday = t.now.getDay();
  const planned = jobs.filter((j) => worksOn(j, weekday));

  if (!w.jobs.length) {
    return (
      <Card kicker="Jornada de hoy" title={t.trade ? `Empieza como ${t.trade.name}` : 'Agrega tu primer trabajo'}>
        <AppText variant="caption" muted>
          Severa cuenta el tiempo de cada trabajo, tus viajes y la bencina, y al terminar te dice cuánto ganaste de verdad. Puedes tener varios trabajos y cambiar entre ellos en el día.
        </AppText>
        {t.trade ? (
          <Button
            label={`Empezar jornada · ${t.trade.name}`}
            onPress={async () => {
              const id = await w.addJob(t.trade!.name, /conductor|uber|shopper|repart/i.test(t.trade!.name) ? 'Conductor de aplicaciones' : null);
              await w.start({ id, title: t.trade!.name } as Entry);
            }}
          />
        ) : null}
        <Button label="Mis trabajos" kind="secondary" onPress={() => router.navigate('/trabajo')} />
      </Card>
    );
  }

  const totals = w.today.reduce(
    (s, x) => {
      const r = tramoEarnings(x, w.jobOf(x), now);
      return { earned: s.earned + r.earned, fuel: s.fuel + r.fuel, hours: s.hours + r.hours };
    },
    { earned: 0, fuel: 0, hours: 0 },
  );

  if (!w.open) {
    return (
      <Card kicker={w.today.length ? `Hoy · ${duration(Math.round(totals.hours * 60))} trabajadas` : 'Jornada de hoy'} title={w.today.length ? `Ganancia neta ${show(totals.earned - totals.fuel)}` : '¿Con qué trabajo partes?'} right={w.today.length ? <EyeButton visible={money.visible} onPress={money.toggle} /> : undefined}>
        {planned.length && !w.today.length ? <AppText variant="caption" muted>{`Hoy te toca: ${planned.map((j) => `${j.title}${j.data.desde ? ` (${j.data.desde}${j.data.hasta ? `–${j.data.hasta}` : ''})` : ''}`).join(' · ')}`}</AppText> : null}
        <JobChips jobs={jobs.length ? jobs : w.jobs} current={null} onPick={(j) => w.start(j)} />
        <AppText variant="caption" muted>
          Toca un trabajo para empezar a contar. Si en el día cambias de trabajo, tocas el otro.
        </AppText>
      </Card>
    );
  }

  const job = w.jobOf(w.open);
  const r = tramoEarnings(w.open, job, now);
  const trips = byTrips(job);
  return (
    <Card kicker={`En jornada · ${job?.title ?? 'Trabajo'}`} right={<EyeButton visible={money.visible} onPress={money.toggle} />}>
      <AppText style={{ fontFamily: fonts.extrabold, fontSize: 36, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="none">
        {clock(now - startOf(w.open))}
      </AppText>
      <View style={styles.stats}>
        {(trips
          ? [
              ['Viajes', String(r.trips)],
              ['Ganado', show(r.earned)],
              ['Bencina', show(r.fuel)],
            ]
          : [
              ['Horas', r.hours.toFixed(1).replace('.', ',')],
              ['Ganado', show(r.earned)],
              ['Hoy', show(totals.earned)],
            ]
        ).map(([k, v]) => (
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
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label={trips ? '+ Viaje' : '+ Ingreso'} onPress={() => setSheet(trips ? 'trip' : 'income')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={trips ? '+ Bencina' : 'Terminar'} kind="secondary" onPress={() => (trips ? setSheet('fuel') : w.close(w.open!))} />
        </View>
      </View>
      {jobs.length > 1 ? (
        <>
          <AppText variant="caption" muted>
            Cambiar de trabajo (cierra este tramo y empieza el otro)
          </AppText>
          <JobChips jobs={jobs} current={job?.id ?? null} onPick={(j) => w.start(j)} />
        </>
      ) : null}
      {trips ? <Button label={`Terminar tramo · neto ${show(r.net)}`} kind="link" onPress={() => w.close(w.open!)} /> : null}
      <AmountSheet
        kind={sheet}
        onClose={() => setSheet(null)}
        onSave={(a) => {
          if (sheet && w.open) w.log(w.open, sheet, a);
          setSheet(null);
        }}
      />
    </Card>
  );
}

/** Los ítems de la línea del día en Trabajo: lo planificado en la agenda y los tramos. */
function useWorkItems(t: Today, now: number): DayItem[] {
  const w = useWork(t.day);
  const agenda = useAgenda(t.day, t.day);
  const items: DayItem[] = [];
  for (const e of eventsOn(agenda.events, t.day).filter((e) => e.layer === 'trabajo' && hhmm(e.starts_at))) {
    items.push({ id: `ev:${e.id}`, t: toMinutes(hhmm(e.starts_at))!, end: toMinutes(hhmm(e.ends_at)) ?? undefined, title: e.title, sub: 'Planificado', icon: 'briefcase', work: true });
  }
  for (const x of w.today) {
    const r = tramoEarnings(x, w.jobOf(x), now);
    const start = minutesNow(new Date(startOf(x) * 1000));
    const end = endOf(x) ? minutesNow(new Date(endOf(x)! * 1000)) : undefined;
    items.push({ id: `tramo:${x.id}`, t: start, end: end && end > start ? end : undefined, title: x.title ?? 'Tramo', sub: end ? `${duration(Math.round(r.hours * 60))} · ganado` : 'En curso', icon: 'car', work: true });
  }
  if (!items.length) items.push({ id: 'w-start', t: t.nowMin, title: 'Empezar jornada', sub: 'Toca un trabajo para partir', icon: 'play', work: true });
  return items.sort((a, b) => a.t - b.t);
}

export function WorkLineCard({ t }: { t: Today }) {
  const w = useWork(t.day);
  const now = useNowSec(false);
  const items = useWorkItems(t, now);
  return (
    <Card kicker="Tu jornada en línea" title={w.today.length ? `${w.today.length} ${w.today.length === 1 ? 'tramo' : 'tramos'} hoy` : 'Todavía no empiezas'}>
      <DayLineCompact items={items} now={t.nowMin} done={(id) => id.startsWith('tramo:') && !!endOf(w.today.find((x) => `tramo:${x.id}` === id)!)} onToggle={() => undefined} />
    </Card>
  );
}

/** Tareas del trabajo (módulo «tareas_del_trabajo»), separadas de las personales. */
export function WorkTasksCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const store = useEntries('tareas_del_trabajo');
  const [draft, setDraft] = useState('');
  const list = store.of('tarea').filter((x) => !x.done || x.day === t.day).slice(0, 8);
  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    tap();
    setDraft('');
    await store.add({ kind: 'tarea', title, day: t.day });
  };
  return (
    <Card kicker="Tareas del trabajo" title={list.length ? `${list.filter((x) => x.done).length} de ${list.length} listas` : 'Lo pendiente del trabajo'}>
      {list.map((x) => (
        <View key={x.id} style={styles.line}>
          <AppText variant="label" style={{ flex: 1, fontSize: 15, textDecorationLine: x.done ? 'line-through' : 'none' }} color={x.done ? colors.muted : colors.text}>
            {x.title}
          </AppText>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: x.done }}
            accessibilityLabel={x.title ?? ''}
            hitSlop={8}
            onPress={() => {
              tap();
              store.update(x.id, { done: !x.done, day: t.day });
            }}
            style={[styles.check, { backgroundColor: x.done ? colors.accent : 'transparent', borderColor: x.done ? colors.accent : colors.line }]}
          >
            {x.done ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
          </Pressable>
        </View>
      ))}
      <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Por ejemplo: pagar el TAG"
          placeholderTextColor={colors.muted}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Agregar tarea" onPress={add} hitSlop={8}>
          <PlusIcon size={20} color={draft.trim() ? colors.accent : colors.muted} />
        </Pressable>
      </View>
    </Card>
  );
}

/** Barra de hábitos rápidos sobre la navegación de Trabajo (A3): se suma sin cruzar a Personal.
 *  Desde el 25-10-2026 usa los mismos hábitos que Personal (tabla habits), así un vaso de agua
 *  sumado en un espacio se ve en el otro. La pausa es propia de la jornada. */
export function QuickHabitsBar({ day, pauses, onPause }: { day: string; pauses: number; onPause: () => void }) {
  const { colors } = useTheme();
  const h = useHabits(day);
  const shown = [...h.good].sort((a, b) => Number(b.template_code === 'agua') - Number(a.template_code === 'agua')).slice(0, 3);
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
        return (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`Sumar: ${x.name}`}
            onPress={() => {
              tap();
              if (n < target) h.log(x.id, 1);
            }}
            onLongPress={() => n && h.log(x.id, -1)}
            style={[styles.qpill, { backgroundColor: colors.surface2 }]}
          >
            {x.template_code === 'agua' ? <DropIcon size={16} color={colors.text} /> : null}
            <AppText variant="label" numberOfLines={1} style={{ fontSize: 13, maxWidth: 110 }}>
              {x.name}
            </AppText>
            <AppText variant="label" color={n >= target ? colors.ok : colors.accent} style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {`${n}/${target}`}
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

/** La jornada completa, para Calendario en Trabajo. */
export function WorkDayFull({ t }: { t: Today }) {
  const w = useWork(t.day);
  const now = useNowSec(false);
  const items = useWorkItems(t, now);
  return <DayLineFull items={items} now={t.nowMin} done={(id) => id.startsWith('tramo:') && !!endOf(w.today.find((x) => `tramo:${x.id}` === id)!)} onToggle={() => undefined} />;
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, padding: 10, gap: 2, minWidth: 0 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, gap: space.md },
  amountInput: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, fontFamily: fonts.extrabold, fontSize: 28 },
  quick: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  quickBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 8 },
  qpill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  job: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 11 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12 },
});
