import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { eventsOn, eventTime, longDay, monthGrid, monthLabel, type CalendarEvent, type Task } from '@/core/agenda';
import { dayKey } from '@/core/today';
import { useAgenda, useHolidays } from '@/data/agenda';
import { useEntries, type Entry } from '@/data/entries';
import { useJournal } from '@/data/journal';
import { useStudies } from '@/data/modules';
import { classesOn } from '@/core/studies';
import { AgendaSheet, type AgendaTarget } from '@/features/agenda/AgendaSheet';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { DayLineFull } from '@/features/today/DayLine';
import { Card, PrivateNote } from '@/features/today/PersonalCards';
import { useToday } from '@/features/today/useToday';
import { useWork, WorkDayFull } from '@/features/today/WorkToday';
import { activeJobs } from '@/features/work/jobs';
import { PlanSheet } from '@/features/work/PlanSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, space } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretLeftIcon, CaretRightIcon, CheckIcon } from '@/ui/icons';

// Calendario (MD4, 25-10-2026, con la primera versión como referencia): el mes completo con
// eventos y feriados, el día elegido con sus eventos y tareas, y hoy la línea del día al estilo
// Structured. Tocar un día lo elige; mantenerlo presionado agrega un evento ese día.
// 26-10-2026 (usuario: «algo diferenciador»): cada día tiene un anillo que se llena con lo
// cumplido de su agenda y un punto con el color del ánimo del Diario.

const SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarioScreen() {
  const { colors, mode } = useTheme();
  const t = useToday();
  const today = dayKey(t.now);
  const [month, setMonth] = useState({ y: t.now.getFullYear(), m: t.now.getMonth() });
  const [selected, setSelected] = useState(today);
  // Desde el + se llega con ?nuevo=event o ?nuevo=task (26-10-2026).
  const { nuevo } = useLocalSearchParams<{ nuevo?: string }>();
  const [target, setTarget] = useState<AgendaTarget | null>(nuevo === 'event' || nuevo === 'task' ? { kind: nuevo } : null);
  const [planning, setPlanning] = useState(false);
  const work = useWork(today);
  const weeks = monthGrid(month.y, month.m);
  const agenda = useAgenda(weeks[0][0].day, weeks.at(-1)!.at(-1)!.day);
  const holidays = useHolidays();
  // El ánimo del Diario, como en la primera versión: una rayita de color bajo el día.
  const journal = useJournal();
  const moodColor = useMoodColor();
  const mood = new Map(journal.days.filter((d) => d.mood).map((d) => [d.day, Number(d.mood)]));

  // Las clases de Estudios en cada día, con su asistencia (la misma marca de Tu día).
  const studies = useStudies();
  const store = useEntries(['hoy', 'estudios', 'metas']);
  // Los pasos de las metas con día (27-10-2026: «pasos al calendario»), con su mismo check.
  const goalsById = new Map(store.entries.filter((e) => e.module === 'metas' && e.kind === 'meta').map((g) => [g.id, g]));
  const stepsOn = (day: string) => store.entries.filter((e) => e.module === 'metas' && e.kind === 'paso' && e.day === day && !goalsById.get(e.parent_id ?? '')?.done);
  const toggleStep = (step: Entry) => {
    tap();
    return store.update(step.id, { done: !step.done, data: { ...step.data, hecho: step.done ? null : today } });
  };
  const programs = store.entries.filter((e) => e.kind === 'programa');
  const attended = (day: string, blockId: string) => store.entries.some((e) => e.module === 'hoy' && e.kind === 'hecho' && e.day === day && e.title === `clase:${blockId}`);
  const toggleClass = (day: string, blockId: string) => {
    tap();
    const row = store.entries.find((e) => e.module === 'hoy' && e.kind === 'hecho' && e.day === day && e.title === `clase:${blockId}`);
    return row ? store.remove(row.id) : store.add({ module: 'hoy', kind: 'hecho', day, title: `clase:${blockId}` });
  };
  const dayClasses = classesOn(selected, studies.blocks, studies.courses, programs);
  const dayEvents = eventsOn(agenda.events, selected);
  const dayTasks = agenda.tasks.filter((x) => x.due_on === selected && x.status !== 'dismissed');
  const eventDone = (e: CalendarEvent) => agenda.states.some((s) => s.day === selected && s.origin_type === 'event' && s.origin_id === e.id && s.status === 'done');
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="caption" muted style={{ letterSpacing: 1.6 }}>
          {`CALENDARIO · ${mode === 'work' ? 'TRABAJO' : 'PERSONAL'}`}
        </AppText>
        <View style={styles.nav}>
          <AppText variant="title" style={{ flex: 1 }}>
            {monthLabel(month.y, month.m)}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => shift(-1)} style={[styles.navBtn, { backgroundColor: colors.surface }]}>
            <CaretLeftIcon size={18} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => shift(1)} style={[styles.navBtn, { backgroundColor: colors.surface }]}>
            <CaretRightIcon size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.month, { backgroundColor: colors.surface }]}>
        <View style={styles.week}>
          {SHORT.map((d) => (
            <AppText key={d} variant="caption" muted style={styles.head}>
              {d}
            </AppText>
          ))}
        </View>
        {weeks.map((w) => (
          <View key={w[0].day} style={styles.week}>
            {w.map(({ day, inMonth }) => {
              const isToday = day === today;
              const isSel = day === selected;
              const evs = eventsOn(agenda.events, day);
              const tks = agenda.tasks.filter((x) => x.due_on === day && x.status !== 'dismissed');
              const cls = classesOn(day, studies.blocks, studies.courses, programs);
              const sts = stepsOn(day);
              const count = evs.length + tks.filter((x) => x.status === 'pending').length + cls.length + sts.filter((x) => !x.done).length;
              const total = evs.length + tks.length + cls.length + sts.length;
              const doneN =
                evs.filter((e) => agenda.states.some((st) => st.day === day && st.origin_type === 'event' && st.origin_id === e.id && st.status === 'done')).length +
                tks.filter((x) => x.status === 'done').length +
                cls.filter((c) => attended(day, c.block.id)).length +
                sts.filter((x) => x.done).length;
              const ratio = total ? doneN / total : 0;
              const holiday = holidays.get(day);
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${longDay(day)}${holiday ? `, feriado: ${holiday}` : ''}${count ? `, ${count} en la agenda` : ''}`}
                  onPress={() => {
                    tap();
                    setSelected(day);
                  }}
                  onLongPress={() => {
                    setSelected(day);
                    setTarget({ kind: 'event' });
                  }}
                  style={styles.cell}
                >
                  <View style={[styles.num, isSel && { backgroundColor: colors.accent }]}>
                    {total && !isSel ? (
                      <Svg width={38} height={38} style={StyleSheet.absoluteFill}>
                        <Circle cx={19} cy={19} r={16} stroke={colors.surface2} strokeWidth={3} fill="none" />
                        {ratio ? <Circle cx={19} cy={19} r={16} stroke={ratio === 1 ? colors.ok : colors.accent2} strokeWidth={3} fill="none" strokeDasharray={`${2 * Math.PI * 16 * ratio} ${2 * Math.PI * 16}`} strokeLinecap="round" rotation={-90} origin="19, 19" /> : null}
                      </Svg>
                    ) : null}
                    {!isSel && isToday && !total ? <View style={[StyleSheet.absoluteFill, { borderRadius: 19, borderWidth: 2, borderColor: colors.accent }]} /> : null}
                    <AppText
                      variant="label"
                      color={isSel ? colors.onAccent : holiday ? colors.bad : inMonth ? colors.text : colors.muted}
                      style={{ fontVariant: ['tabular-nums'], opacity: inMonth ? 1 : 0.45 }}
                    >
                      {Number(day.slice(8))}
                    </AppText>
                  </View>
                  <View style={styles.dots}>
                    {mood.has(day) ? <View style={[styles.mood, { backgroundColor: moodColor(mood.get(day)) }]} /> : null}
                    {count && !mood.has(day) ? <AppText style={{ fontSize: 9, lineHeight: 10, fontFamily: fonts.bold }} color={colors.muted}>{String(count)}</AppText> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <AppText variant="caption" muted style={{ textAlign: 'center', marginTop: -6 }}>
        El anillo se llena con lo cumplido del día · el punto es tu ánimo del Diario
      </AppText>
      <Card kicker={selected === today ? 'Hoy' : 'Día elegido'} title={longDay(selected)}>
        {holidays.get(selected) ? (
          <AppText variant="caption" color={colors.bad}>
            {`Feriado · ${holidays.get(selected)}`}
          </AppText>
        ) : null}
        {dayClasses.map(({ block, course }) => (
          <Row key={`c-${block.id}`} title={`Clase: ${course.name}`} sub={`${block.starts_at.slice(0, 5)} – ${block.ends_at.slice(0, 5)}${block.room ? ` · sala ${block.room}` : ''}${course.teacher ? ` · ${course.teacher}` : ''}`} done={attended(selected, block.id)} onCheck={() => toggleClass(selected, block.id)} onOpen={() => router.push('/estudios')} />
        ))}
        {stepsOn(selected).map((x) => (
          <Row key={`m-${x.id}`} title={x.title ?? 'Paso'} sub={`Meta: ${goalsById.get(x.parent_id ?? '')?.title ?? ''}`} done={x.done} onCheck={() => toggleStep(x)} onOpen={() => router.push('/metas')} />
        ))}
        {dayEvents.map((e) => (
          <Row key={e.id} title={`${Number(e.importance) === 2 ? '‼ ' : Number(e.importance) === 1 ? '★ ' : ''}${e.title}`} sub={`${eventTime(e)}${e.location ? ` · ${e.location}` : ''}`} done={eventDone(e)} onCheck={() => agenda.setState(selected, 'event', e.id, eventDone(e) ? null : 'done')} onOpen={() => setTarget({ kind: 'event', event: e })} />
        ))}
        {dayTasks.map((x: Task) => (
          <Row key={x.id} title={x.title} sub={x.due_at ? `Tarea · ${x.due_at.slice(0, 5)}` : 'Tarea'} done={x.status === 'done'} onCheck={() => agenda.completeTask(x.id, x.status !== 'done', selected)} onOpen={() => setTarget({ kind: 'task', task: x })} />
        ))}
        {!dayEvents.length && !dayTasks.length && !dayClasses.length ? (
          <AppText variant="caption" muted>
            Nada en la agenda. Mantén presionado un día para agregar un evento.
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="+ Evento" onPress={() => setTarget({ kind: 'event' })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="+ Tarea" kind="secondary" onPress={() => setTarget({ kind: 'task' })} />
          </View>
        </View>
        {work.jobs.length ? <Button label="Planificar trabajo (varios días)" kind="secondary" onPress={() => setPlanning(true)} /> : null}
      </Card>

      {selected === today ? (
        mode === 'work' ? (
          t.works ? (
            <WorkDayFull t={t} />
          ) : (
            <AppText muted>Cuando agregues tu trabajo, aquí verás tu jornada.</AppText>
          )
        ) : (
          <DayLineFull items={t.items} now={t.nowMin} done={t.done} onToggle={t.toggleDone} />
        )
      ) : null}
      <PrivateNote />
      <AgendaSheet agenda={agenda} target={target} day={selected} onClose={() => setTarget(null)} />
      <PlanSheet visible={planning} jobs={activeJobs(work.jobs, today).length ? activeJobs(work.jobs, today) : work.jobs} agenda={agenda} day={selected} onClose={() => setPlanning(false)} />
    </Screen>
  );
}

function Row({ title, sub, done, onCheck, onOpen }: { title: string; sub: string; done: boolean; onCheck: () => void; onOpen: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderTopColor: colors.line }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={title}
        hitSlop={8}
        onPress={() => {
          tap();
          onCheck();
        }}
        style={[styles.check, { backgroundColor: done ? colors.accent : 'transparent', borderColor: done ? colors.accent : colors.line }]}
      >
        {done ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
      </Pressable>
      <Pressable style={{ flex: 1, gap: 2 }} onPress={onOpen} accessibilityRole="button">
        <AppText variant="label" style={{ fontSize: 15, textDecorationLine: done ? 'line-through' : 'none' }} color={done ? colors.muted : colors.text}>
          {title}
        </AppText>
        <AppText variant="caption" muted>
          {sub}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  month: { borderRadius: 20, padding: 8, gap: 2 },
  week: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 11, paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3, gap: 2 },
  num: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 10, alignItems: 'center' },
  mood: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
