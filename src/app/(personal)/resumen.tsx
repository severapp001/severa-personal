import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { activityInsights, moodOf } from '@/core/journal';
import { displayAmount } from '@/core/money';
import { plusDays } from '@/core/modules';
import { dayKey } from '@/core/today';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { MODULES } from '@/features/modules/catalog';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { moduleHref } from '@/features/space/moduleRoutes';
import { ThreeParts } from '@/features/stats/ThreeParts';
import { useLifeStats, type LifeStats } from '@/features/stats/useLifeStats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, EyeButton, Screen } from '@/ui';
import { BarRow, Kicker, Panel } from '@/ui/kit';

// Resumen (P7, 26-10-2026; usuario: «muy importante: análisis, resúmenes, consejos,
// retroalimentaciones, conexiones»). Se arma solo con lo que registras en cada módulo.

const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function tips(s: LifeStats, $: (n: number) => string, today: string): string[] {
  const out: string[] = [];
  if (s.habitRate !== null) {
    if (s.habitRate >= 80) out.push(`Esta semana cumpliste el ${s.habitRate} % de tus hábitos. Vas muy bien: mantén el ritmo.`);
    else if (s.habitRate < 50) out.push(`Cumpliste el ${s.habitRate} % de tus hábitos esta semana. Prueba con uno a la vez y déjalo a una hora fija en tu día.`);
  }
  if (s.month.expenses && s.previous.expenses) {
    const pct = Math.round(((s.month.expenses - s.previous.expenses) / s.previous.expenses) * 100);
    if (pct > 10) out.push(`Llevas gastado ${$(s.month.expenses)} este mes: ${pct} % más que todo el mes pasado. Lo que más pesa: ${s.month.expensesByCategory[0]?.name.toLowerCase() ?? 'sin categoría'}.`);
    else if (pct < -10) out.push(`Vas gastando ${Math.abs(pct)} % menos que el mes pasado. Buen momento para apartar un ahorro.`);
  }
  if (s.month.income && s.month.result < 0) out.push(`Este mes gastaste ${$(-s.month.result)} más de lo que entró. Revisa los gastos chicos que se repiten.`);
  if (s.exercise.total < 150) out.push(`Llevas ${s.exercise.total} minutos de ejercicio esta semana; la OMS recomienda 150. Dos caminatas de 30 minutos te acercan.`);
  const from = plusDays(today, -13);
  const ins = activityInsights(s.journal.days, from, today);
  if (ins.good[0]) out.push(`En tus días buenos se repite «${ins.good[0].name}». Haz más espacio para eso.`);
  if (ins.bad[0]) out.push(`En tus días difíciles aparece «${ins.bad[0].name}». Míralo con calma, sin culpas.`);
  if (!s.journalStreak) out.push('Escribir un minuto en el Diario cada noche te ayuda a ver tus patrones de ánimo.');
  if (s.bibleStreak >= 3) out.push(`Llevas ${s.bibleStreak} días seguidos con la Biblia. ¡Sigue así!`);
  return out.slice(0, 5);
}

export default function ResumenScreen() {
  const { colors } = useTheme();
  const today = dayKey(new Date());
  const s = useLifeStats(today);
  const money = useAmountVisibility();
  const $ = (n: number) => displayAmount(n, money.visible);
  const moodColor = useMoodColor();
  const strip = Array.from({ length: 14 }, (_, i) => plusDays(today, i - 13));
  const pct = s.previous.expenses ? Math.round(((s.month.expenses - s.previous.expenses) / s.previous.expenses) * 100) : null;

  const tiles: { label: string; value: string; sub: string; go: Href; tone?: string }[] = [
    { label: 'Hábitos', value: s.habitRate === null ? '—' : `${s.habitRate} %`, sub: s.habitStreak ? `racha de ${s.habitStreak} días` : 'esta semana', go: '/habitos', tone: s.habitRate !== null && s.habitRate >= 70 ? colors.ok : undefined },
    { label: 'Diario', value: `${s.journalStreak}`, sub: s.journalStreak === 1 ? 'día seguido' : 'días seguidos', go: '/diario' },
    { label: 'Gastado', value: $(s.month.expenses), sub: pct === null ? 'este mes' : `${pct > 0 ? '+' : ''}${pct} % vs. mes pasado`, go: '/finanzas', tone: pct !== null && pct > 10 ? colors.bad : undefined },
    { label: 'Ejercicio', value: `${s.exercise.total}`, sub: 'de 150 min esta semana', go: moduleHref('ejercicio'), tone: s.exercise.total >= 150 ? colors.ok : undefined },
    { label: 'Biblia', value: `${s.bibleProgress.percent} %`, sub: s.bibleStreak ? `racha de ${s.bibleStreak} días` : 'leída', go: '/biblia' },
    { label: 'Tareas', value: `${s.tasksDone}`, sub: 'hechas en 7 días', go: '/prioridades' },
  ];
  const feeds = [
    { code: 'habitos', name: 'Hábitos', n: s.habits.habits.length },
    { code: 'diario', name: 'Diario', n: s.journal.days.length },
    { code: 'finanzas', name: 'Finanzas', n: s.finance.movements.length },
    ...Object.values(MODULES)
      .filter((m) => m.space === 'Personal')
      .map((m) => ({ code: m.code, name: m.title, n: s.counts[m.code] ?? 0 })),
  ];
  const advice = tips(s, $, today);

  return (
    <Screen>
      <ModuleHeader kicker="Tu semana y tu mes" title="Resumen" right={<EyeButton visible={money.visible} onPress={money.toggle} />} />

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable key={t.label} accessibilityRole="button" onPress={() => router.push(t.go)} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}>
            <AppText variant="caption" muted style={styles.kick}>
              {t.label.toUpperCase()}
            </AppText>
            <AppText style={{ fontFamily: fonts.extrabold, fontSize: 24, fontVariant: ['tabular-nums'] }} color={t.tone ?? colors.text} numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </AppText>
            <AppText variant="caption" muted numberOfLines={2} style={{ fontSize: 12 }}>
              {t.sub}
            </AppText>
          </Pressable>
        ))}
      </View>

      <ThreeParts stats={s} today={today} compact />

      <Panel>
        <Kicker>Consejos para esta semana</Kicker>
        {advice.length ? (
          advice.map((t) => (
            <AppText key={t} variant="body" style={{ fontSize: 15 }}>
              {`• ${t}`}
            </AppText>
          ))
        ) : (
          <AppText variant="caption" muted>
            Cuando registres unos días de hábitos, diario y gastos, aquí aparecen consejos hechos con tus datos.
          </AppText>
        )}
      </Panel>

      {s.habits.good.length ? (
        <Panel>
          <Kicker>Hábitos · últimos 7 días</Kicker>
          <View style={styles.bars}>
            {s.habitWeek.map((d) => (
              <View key={d.day} style={styles.barCol}>
                <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
                  <View style={{ height: `${d.total ? (d.done / d.total) * 100 : 0}%`, backgroundColor: d.day === today ? colors.accent : colors.accent2, borderRadius: 6 }} />
                </View>
                <AppText variant="caption" muted style={{ fontSize: 11 }}>
                  {DOW[new Date(`${d.day}T12:00:00`).getDay()]}
                </AppText>
              </View>
            ))}
          </View>
        </Panel>
      ) : null}

      <Panel>
        <Kicker>Ánimo · últimos 14 días</Kicker>
        <View style={styles.strip}>
          {strip.map((d) => (
            <View key={d} style={[styles.square, { backgroundColor: moodColor(s.moodByDay.get(d)) }]} accessibilityLabel={`${d}: ${moodOf(s.moodByDay.get(d))?.label ?? 'sin registro'}`} />
          ))}
        </View>
        <AppText variant="caption" muted>
          {s.moodByDay.size ? 'Cada cuadro es un día del Diario, con el color de tu ánimo.' : 'Marca cómo estuvo tu día al cerrarlo y aquí verás tu ánimo.'}
        </AppText>
      </Panel>

      <Panel>
        <Kicker>Plata del mes</Kicker>
        <BarRow label="Entró" value={s.month.income} max={Math.max(s.month.income, s.month.expenses, 1)} text={$(s.month.income)} tone="ok" />
        <BarRow label="Salió" value={s.month.expenses} max={Math.max(s.month.income, s.month.expenses, 1)} text={$(s.month.expenses)} tone="bad" />
        {s.month.expensesByCategory.slice(0, 3).map((c) => (
          <BarRow key={c.name} label={c.name} value={c.total} max={s.month.expensesByCategory[0].total} text={$(c.total)} />
        ))}
      </Panel>

      <Panel>
        <Kicker>De dónde sale tu resumen</Kicker>
        <AppText variant="caption" muted>
          Cada módulo con datos alimenta el resumen. Los que están en gris todavía no tienen registros: ábrelos para encenderlos.
        </AppText>
        <View style={styles.feeds}>
          {feeds.map((f) => (
            <Pressable
              key={f.code}
              accessibilityRole="button"
              onPress={() => router.push(f.code === 'habitos' ? '/habitos' : f.code === 'diario' ? '/diario' : f.code === 'finanzas' ? '/finanzas' : moduleHref(f.code))}
              style={[styles.feed, { backgroundColor: f.n ? colors.accentSoft : colors.surface2 }]}
            >
              <AppText variant="caption" color={f.n ? colors.accent : colors.muted} style={{ fontFamily: fonts.bold }}>
                {f.n ? `${f.name} · ${f.n}` : f.name}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', flexGrow: 1, borderRadius: 18, padding: 12, gap: 2, minHeight: 100 },
  kick: { fontFamily: fonts.extrabold, letterSpacing: 1, fontSize: 10 },
  bars: { flexDirection: 'row', gap: 6, height: 90, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  track: { flex: 1, width: '100%', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  strip: { flexDirection: 'row', gap: 4 },
  square: { flex: 1, height: 22, borderRadius: 5 },
  feeds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feed: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
