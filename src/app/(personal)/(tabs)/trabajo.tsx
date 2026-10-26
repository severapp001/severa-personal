import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, eventsOn, hhmm, shortDay, weekday } from '@/core/agenda';
import { displayAmount } from '@/core/money';
import { dayKey } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import type { Entry } from '@/data/entries';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { moduleHref } from '@/features/space/moduleRoutes';
import { useCross } from '@/features/space/SpaceCross';
import { JornadaCard, useWork } from '@/features/today/WorkToday';
import { useToday } from '@/features/today/useToday';
import { activeJobs, DAYS, JOB_KIND, tramoEarnings, useNowSec, worksOn } from '@/features/work/jobs';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, EyeButton, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ChipRow, DateField, Empty, Kicker, Panel, Row, Sheet, TimeField, normalizeTime } from '@/ui/kit';

// Trabajo en la barra de abajo (usuario, 26-10-2026): tus trabajos (uno fijo y otros por unos días),
// la jornada por tramos, la semana planificada en el calendario y cuánto ganas por trabajo y por hora.

const WEEK = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SHORTCUTS: { code: string; label: string }[] = [
  { code: 'cobros_y_boletas', label: 'Cobros y boletas' },
  { code: 'clientes_y_pacientes', label: 'Clientes' },
  { code: 'tareas_del_trabajo', label: 'Tareas' },
  { code: 'turnos_y_faenas', label: 'Turnos' },
  { code: 'ventas_y_productos', label: 'Ventas' },
  { code: 'pedidos_y_costeo', label: 'Pedidos' },
  { code: 'ficha_al_terminar', label: 'Ficha al terminar' },
  { code: 'documentos_laborales', label: 'Documentos' },
];

export default function TrabajoScreen() {
  const { colors, mode } = useTheme();
  const t = useToday();
  const today = dayKey(t.now);
  const w = useWork(today);
  const cross = useCross();
  const money = useAmountVisibility();
  const $ = (n: number) => displayAmount(n, money.visible);
  const agenda = useAgenda(today, addDays(today, 6));
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [plan, setPlan] = useState<Entry | null | 'new'>(null);

  const jobs = activeJobs(w.jobs, today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const monthKey = today.slice(0, 7);
  const weekFrom = addDays(today, -6);
  const now = useNowSec(!!w.open);
  const stats = w.jobs.map((j) => {
    const mine = w.tramos.filter((x) => x.parent_id === j.id);
    const sum = (list: Entry[]) => list.reduce((s, x) => {
      const r = tramoEarnings(x, j, now);
      return { hours: s.hours + r.hours, earned: s.earned + r.earned, fuel: s.fuel + r.fuel };
    }, { hours: 0, earned: 0, fuel: 0 });
    return { job: j, week: sum(mine.filter((x) => (x.day ?? '') >= weekFrom)), month: sum(mine.filter((x) => (x.day ?? '').startsWith(monthKey))) };
  });
  const monthTotal = stats.reduce((s, x) => ({ hours: s.hours + x.month.hours, net: s.net + x.month.earned - x.month.fuel }), { hours: 0, net: 0 });

  const jobSub = (j: Entry) =>
    [
      j.data.oficio,
      j.data.pago ? `${j.data.pago}${j.amount ? ` ${$(Number(j.amount))}` : ''}` : null,
      Array.isArray(j.data.dias) && (j.data.dias as string[]).length ? (j.data.dias as string[]).join(' ') : null,
      j.data.desde ? `${j.data.desde}${j.data.hasta ? `–${j.data.hasta}` : ''}` : null,
      j.data.contrato,
      j.until ? `hasta el ${shortDay(j.until)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" muted style={{ letterSpacing: 1.6 }}>
            {`TRABAJO · ${WEEK[t.now.getDay()].toUpperCase()}`}
          </AppText>
          <AppText variant="title">Mis trabajos</AppText>
        </View>
        <EyeButton visible={money.visible} onPress={money.toggle} />
      </View>
      {mode !== 'work' ? <Button label="Entrar en modo foco" kind="secondary" onPress={() => cross('work')} /> : null}

      <JornadaCard t={t} />

      <Panel>
        <View style={styles.between}>
          <Kicker>{`Tus trabajos · ${w.jobs.length}`}</Kicker>
          <AppText variant="label" color={colors.accent} onPress={() => setSheet({ kind: JOB_KIND })}>
            + Trabajo
          </AppText>
        </View>
        {w.jobs.length ? (
          w.jobs.map((j) => (
            <Row
              key={j.id}
              title={j.title ?? 'Trabajo'}
              sub={jobSub(j) || 'Toca para completar el pago, los días y el horario'}
              onPress={() => setSheet({ kind: JOB_KIND, entry: j })}
              right={jobs.includes(j) ? undefined : <AppText variant="caption" muted>Terminado</AppText>}
            />
          ))
        ) : (
          <Empty text="Agrega el trabajo de siempre y los de unos días (un reemplazo, una feria): cada uno con su pago, días, horario y contrato." />
        )}
      </Panel>

      <Panel>
        <View style={styles.between}>
          <Kicker>Tu semana</Kicker>
          <AppText variant="label" color={colors.accent} onPress={() => setPlan('new')}>
            + Planificar
          </AppText>
        </View>
        {week.map((d) => {
          const fixed = jobs.filter((j) => worksOn(j, weekday(d)) && (!j.until || j.until >= d));
          const events = eventsOn(agenda.events, d).filter((e) => e.layer === 'trabajo');
          if (!fixed.length && !events.length) return null;
          return (
            <View key={d} style={{ gap: 4 }}>
              <AppText variant="label" color={d === today ? colors.accent : colors.text}>
                {`${d === today ? 'Hoy' : WEEK[weekday(d)][0].toUpperCase() + WEEK[weekday(d)].slice(1)} · ${shortDay(d)}`}
              </AppText>
              {fixed.map((j) => (
                <AppText key={j.id} variant="caption" muted>
                  {`• ${j.title}${j.data.desde ? ` · ${j.data.desde}${j.data.hasta ? `–${j.data.hasta}` : ''}` : ''}`}
                </AppText>
              ))}
              {events.map((e) => (
                <AppText key={e.id} variant="caption">
                  {`• ${e.title}${hhmm(e.starts_at) ? ` · ${hhmm(e.starts_at)}${hhmm(e.ends_at) ? `–${hhmm(e.ends_at)}` : ''}` : ''}`}
                </AppText>
              ))}
            </View>
          );
        })}
        {week.every((d) => !jobs.some((j) => worksOn(j, weekday(d))) && !eventsOn(agenda.events, d).some((e) => e.layer === 'trabajo')) ? (
          <Empty text="Marca los días de cada trabajo o planifica un tramo (por ejemplo, shopper de 7 a 13 y Uber de 13 a 17). Queda en tu calendario." />
        ) : null}
      </Panel>

      {w.tramos.length ? (
        <Panel>
          <Kicker>{`Este mes · ${monthTotal.hours.toFixed(1).replace('.', ',')} h · neto ${$(monthTotal.net)}`}</Kicker>
          {stats
            .filter((s) => s.month.hours > 0)
            .map((s) => (
              <Row
                key={s.job.id}
                title={s.job.title ?? 'Trabajo'}
                sub={`Semana: ${s.week.hours.toFixed(1).replace('.', ',')} h · ${$(s.week.earned - s.week.fuel)} · Mes: ${s.month.hours.toFixed(1).replace('.', ',')} h`}
                right={
                  <AppText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                    {s.month.hours ? `${$(Math.round((s.month.earned - s.month.fuel) / s.month.hours))}/h` : '—'}
                  </AppText>
                }
              />
            ))}
          <AppText variant="caption" muted>
            Ganancia neta por hora: lo ganado menos la bencina, dividido por las horas. Así ves qué trabajo te conviene más.
          </AppText>
        </Panel>
      ) : null}

      <Panel>
        <Kicker>Herramientas</Kicker>
        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <Pressable
              key={s.code}
              accessibilityRole="button"
              onPress={() => {
                tap();
                router.push(moduleHref(s.code));
              }}
              style={[styles.tool, { backgroundColor: colors.surface2 }]}
            >
              <AppText variant="label" style={{ fontSize: 13 }}>
                {s.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Panel>

      <EntrySheet
        target={sheet}
        ctx={{ parent: null, entries: w.store.entries }}
        onClose={() => setSheet(null)}
        onSave={(input, target) => (target.entry ? w.store.update(target.entry.id, input) : w.store.add(input))}
        onRemove={(e) => w.store.remove(e.id)}
      />
      <PlanSheet visible={plan !== null} jobs={jobs.length ? jobs : w.jobs} agenda={agenda} day={today} onClose={() => setPlan(null)} />
    </Screen>
  );
}

/** Planificar un tramo de un trabajo en el calendario (se repite cada semana si quieres). */
function PlanSheet({ visible, jobs, agenda, day, onClose }: { visible: boolean; jobs: Entry[]; agenda: ReturnType<typeof useAgenda>; day: string; onClose: () => void }) {
  const [job, setJob] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(day);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'weekly'>('none');
  const [until, setUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = jobs.find((j) => j.id === (job ?? jobs[0]?.id)) ?? null;

  async function save() {
    const start = normalizeTime(from);
    const end = normalizeTime(to);
    if (!chosen) return setError('Primero agrega un trabajo.');
    if (!date || !start) return setError('Elige el día y la hora de inicio.');
    if (end && end <= start) return setError('La hora de término debe ser después del inicio.');
    setBusy(true);
    setError(null);
    try {
      await agenda.addEvent({ title: chosen.title ?? 'Trabajo', event_date: date, starts_at: start, ends_at: end || null, layer: 'trabajo', repeat, repeat_until: repeat === 'weekly' ? until : null, remind_minutes: 30, location: null, notes: null, importance: 1 });
      tap();
      setFrom('');
      setTo('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Planificar un tramo" onClose={onClose}>
      {jobs.length ? (
        <>
          <AppText variant="caption" muted>
            Trabajo
          </AppText>
          <ChipRow options={jobs.map((j) => ({ value: j.id, label: j.title ?? 'Trabajo' }))} value={chosen?.id ?? null} onChange={setJob} />
          <DateField label="Día" value={date} onChange={setDate} future />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TimeField label="Desde" value={from} onChange={setFrom} placeholder={String(chosen?.data.desde ?? '07:00')} />
            <TimeField label="Hasta" value={to} onChange={setTo} placeholder={String(chosen?.data.hasta ?? '13:00')} />
          </View>
          <ChipRow
            options={[
              { value: 'none', label: 'Solo ese día' },
              { value: 'weekly', label: `Cada ${date ? WEEK[weekday(date)] : 'semana'}` },
            ]}
            value={repeat}
            onChange={setRepeat}
          />
          {repeat === 'weekly' ? <DateField label="Hasta cuándo (vacío = sin fin)" value={until} onChange={setUntil} future /> : null}
          {error ? <Notice text={error} /> : null}
          <Button label="Guardar en el calendario" loading={busy} onPress={save} />
        </>
      ) : (
        <AppText muted>Primero agrega un trabajo.</AppText>
      )}
      <AppText variant="caption" muted style={{ fontFamily: fonts.medium }}>
        {`Días de la semana: ${DAYS.join(' ')}. Lo planificado aparece en tu Calendario y en Hoy en Trabajo.`}
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { width: '48%', flexGrow: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
});
