import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { addDays, eventsOn, hhmm, shortDay, weekday } from '@/core/agenda';
import { NO_WORK, STUDY } from '@/core/discovery';
import { displayAmount } from '@/core/money';
import { dayKey } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { setOnboardingTrades, useOnboarding, useTrades } from '@/data/discovery';
import type { Entry } from '@/data/entries';
import { useAuth } from '@/data/auth';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { moduleHref } from '@/features/space/moduleRoutes';
import { useCross } from '@/features/space/SpaceCross';
import { JornadaCard, useWork } from '@/features/today/WorkToday';
import { useToday } from '@/features/today/useToday';
import { activeJobs, JOB_KIND, tramoEarnings, useNowSec, worksOn } from '@/features/work/jobs';
import { PlanSheet } from '@/features/work/PlanSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, EyeButton, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Empty, Kicker, Panel, Row } from '@/ui/kit';

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

  const { session } = useAuth();
  const onboarding = useOnboarding(session?.user.id);
  const { trades } = useTrades();
  const myTrades = (onboarding?.trades ?? []).filter((c) => c !== STUDY && c !== NO_WORK);
  const jobs = activeJobs(w.jobs, today);
  const ended = w.jobs.filter((j) => !jobs.includes(j));

  // Terminar o borrar un trabajo (usuario, 27-10-2026: «no encuentro manera de eliminar el trabajo,
  // o poner término, como si ya no lo hiciera»). Terminado: deja de salir en la jornada y en la
  // semana, pero sus horas y ganancias se guardan.
  const finish = (j: Entry) =>
    Alert.alert(`¿Ya no trabajas en ${j.title ?? 'este trabajo'}?`, 'Si lo terminas, sus horas y ganancias quedan guardadas. Si lo borras, se va de tus trabajos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (w.open?.parent_id === j.id) await w.close(w.open);
          await w.store.remove(j.id);
        },
      },
      {
        text: 'Ya no lo hago',
        onPress: async () => {
          if (w.open?.parent_id === j.id) await w.close(w.open);
          const yesterday = addDays(today, -1);
          await w.store.update(j.id, { until: yesterday, day: j.day && j.day > yesterday ? yesterday : j.day });
        },
      },
    ]);
  const removeTrade = (code: string) => {
    const name = trades.find((x) => x.code === code)?.name ?? code;
    Alert.alert(`¿Quitar «${name}»?`, 'Es el oficio que elegiste en Conocerte. Si lo quitas, Severa deja de sugerirlo en tu jornada.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => session && setOnboardingTrades(session.user.id, (onboarding?.trades ?? []).filter((c) => c !== code)) },
    ]);
  };
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
        {jobs.length ? (
          jobs.map((j) => (
            <Row
              key={j.id}
              title={j.title ?? 'Trabajo'}
              sub={jobSub(j) || 'Toca para completar el pago, los días y el horario'}
              onPress={() => setSheet({ kind: JOB_KIND, entry: j })}
              right={
                <AppText variant="label" color={colors.muted} onPress={() => (tap(), finish(j))} suppressHighlighting>
                  Terminar
                </AppText>
              }
            />
          ))
        ) : (
          <Empty text="Agrega el trabajo de siempre y los de unos días (un reemplazo, una feria): cada uno con su pago, días, horario y contrato." />
        )}
        {ended.length ? (
          <>
            <Kicker>Terminados</Kicker>
            {ended.map((j) => (
              <Row
                key={j.id}
                title={j.title ?? 'Trabajo'}
                sub={j.until ? `Hasta el ${shortDay(j.until)}` : 'Terminado'}
                onPress={() => setSheet({ kind: JOB_KIND, entry: j })}
                right={
                  <AppText variant="label" color={colors.accent} onPress={() => (tap(), w.store.update(j.id, { until: null }))} suppressHighlighting>
                    Reactivar
                  </AppText>
                }
              />
            ))}
          </>
        ) : null}
        {myTrades.length ? (
          <>
            <Kicker>Tu oficio en Conocerte</Kicker>
            <View style={styles.trades}>
              {myTrades.map((c) => (
                <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Quitar ${trades.find((x) => x.code === c)?.name ?? c}`} onPress={() => (tap(), removeTrade(c))} style={[styles.trade, { backgroundColor: colors.surface2 }]}>
                  <AppText variant="label" style={{ fontSize: 13 }}>{`${trades.find((x) => x.code === c)?.name ?? c}  ✕`}</AppText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
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

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { width: '48%', flexGrow: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  trades: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trade: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
});
