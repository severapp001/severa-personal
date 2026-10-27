import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { progress, randomVerse, verseOfDay } from '@/core/bible';
import { incomeStatement, monthKey } from '@/core/finance';
import { dayEntry } from '@/core/journal';
import { displayAmount } from '@/core/money';
import { streak } from '@/core/modules';
import { daysToPayday, fmtTime, nextItem, type PaydayAnswer } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useBibleBooks, useBibleNotes, useChapter } from '@/data/bible';
import { useEntries } from '@/data/entries';
import { useFinance } from '@/data/finance';
import { useJournal } from '@/data/journal';
import { useHabits } from '@/data/modules';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { AgendaSheet, type AgendaTarget } from '@/features/agenda/AgendaSheet';
import { CLOSING_DEFAULT } from '@/features/notifications/useReminders';
import { usePref } from '@/features/space/usePref';
import { useCross } from '@/features/space/SpaceCross';
import { worksOn } from '@/features/work/jobs';
import { useWork } from './WorkToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, EyeButton } from '@/ui';
import { tap } from '@/ui/haptics';
import { BookOpenIcon, CalendarPlusIcon, CheckIcon, ListChecksIcon, LockIcon, PlusIcon } from '@/ui/icons';
import { DayLineCompact } from './DayLine';
import type { Today } from './useToday';

// Tarjetas de Hoy en Personal (vista previa del 17-10-2026). Solo aparecen las que calzan con lo
// que la persona eligió en Conocerte; el orden cambia según la hora.

export function Card({ kicker, title, right, children, kickerColor }: { kicker: string; title?: string; right?: ReactNode; children?: ReactNode; kickerColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <AppText variant="caption" color={kickerColor ?? colors.muted} style={styles.kicker}>
            {kicker.toUpperCase()}
          </AppText>
          {title ? <AppText variant="subtitle">{title}</AppText> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Check({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.check, { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.line }]}
    >
      {on ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
    </Pressable>
  );
}

export function DayCard({ t, onSeeAll }: { t: Today; onSeeAll: () => void }) {
  const { colors } = useTheme();
  const agenda = useAgenda(t.day, t.day);
  const [target, setTarget] = useState<AgendaTarget | null>(null);
  const all = [...t.items, ...t.flexible];
  const doneCount = all.filter((it) => t.done(it.id)).length;
  const next = nextItem(t.items, t.nowMin, t.done) ?? t.flexible.find((it) => !t.done(it.id)) ?? null;
  // Agregar desde Hoy (usuario, 26-10-2026: «falta un agregar evento en el inicio»).
  const add = (kind: 'event' | 'task', label: string, Icon: typeof CalendarPlusIcon) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tap();
        setTarget({ kind });
      }}
      style={[styles.mini, { backgroundColor: colors.surface2 }]}
    >
      <Icon size={18} color={colors.accent} />
    </Pressable>
  );
  const left = all.length - doneCount;
  const title = next ? (next.flexible ? `Pendiente: ${next.title}` : `${t.isToday ? 'Sigue' : 'A las'} ${fmtTime(next.t)}: ${next.title}`) : left ? `${left} sin marcar` : 'Todo listo';
  return (
    <Card
      kicker={`${t.isToday ? 'Tu día' : 'Ese día'} · ${doneCount} de ${all.length} hechas`}
      title={title}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {add('event', 'Agregar evento', CalendarPlusIcon)}
          {add('task', 'Agregar tarea', ListChecksIcon)}
          <AppText variant="label" color={colors.accent} onPress={onSeeAll}>
            Ver todo
          </AppText>
        </View>
      }
    >
      {t.items.length ? <DayLineCompact items={t.items} now={t.nowMin} done={t.done} onToggle={t.toggleDone} /> : null}
      {t.flexible.length ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted style={styles.kicker}>
            DURANTE EL DÍA · SIN HORA
          </AppText>
          <View style={styles.flexRow}>
            {t.flexible.map((it) => {
              const on = t.done(it.id);
              return (
                <Pressable
                  key={it.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    tap();
                    t.toggleDone(it.id);
                  }}
                  style={[styles.flexChip, { backgroundColor: on ? colors.okSoft : colors.surface2 }]}
                >
                  {on ? <CheckIcon size={14} weight="bold" color={colors.ok} /> : null}
                  <AppText variant="label" style={{ fontSize: 13, textDecorationLine: on ? 'line-through' : 'none' }} color={on ? colors.ok : colors.text}>
                    {it.title}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: t.variable }} onPress={() => t.setVariable(!t.variable)} hitSlop={6}>
        <AppText variant="caption" color={colors.muted}>
          {t.variable ? '✓ Mi horario cambia cada día (sin despertar ni dormir fijos) · cambiar' : '¿Tu horario cambia cada día? Toca aquí y quedan sin hora'}
        </AppText>
      </Pressable>
      <AgendaSheet agenda={agenda} target={target} day={t.day} onClose={() => setTarget(null)} />
    </Card>
  );
}

export function PrioritiesCard({
  t,
  prefix = 'prio',
  kicker = 'Prioridades del día',
  empty = 'Las 3 cosas más importantes de hoy',
  placeholder = 'Por ejemplo: pagar la luz',
}: {
  t: Today;
  prefix?: string;
  kicker?: string;
  empty?: string;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const list = [1, 2, 3].map((n) => ({ n, mark: t.marks[`${prefix}:${n}`] })).filter((p) => p.mark?.text);
  const free = [1, 2, 3].find((n) => !t.marks[`${prefix}:${n}`]?.text);
  const add = () => {
    const text = draft.trim();
    if (!text || !free) return;
    tap();
    t.setMark(`${prefix}:${free}`, { value: 0, text });
    setDraft('');
  };
  return (
    <Card kicker={kicker} title={list.length ? `${list.filter((p) => p.mark.value).length} de ${list.length} listas` : empty}>
      {list.map(({ n, mark }) => (
        <View key={n} style={styles.line}>
          <AppText variant="label" style={{ flex: 1, fontSize: 15, textDecorationLine: mark.value ? 'line-through' : 'none' }} color={mark.value ? colors.muted : colors.text}>
            {mark.text}
          </AppText>
          <Check on={!!mark.value} label={mark.text ?? ''} onPress={() => t.setMark(`${prefix}:${n}`, { value: mark.value ? 0 : 1 })} />
        </View>
      ))}
      {free ? (
        <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={list.length ? 'Agregar otra' : placeholder}
            placeholderTextColor={colors.muted}
            onSubmitEditing={add}
            returnKeyType="done"
            style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Agregar prioridad" onPress={add} hitSlop={8}>
            <PlusIcon size={20} color={draft.trim() ? colors.accent : colors.muted} />
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

export function MoneyCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const f = useFinance();
  const money = useAmountVisibility();
  const pay = daysToPayday(t.answers.finanzas as PaydayAnswer, t.now);
  const month = incomeStatement(f.movements, f.categories, monthKey(t.now));
  const title = pay ? (pay.days === 0 ? 'Hoy es tu día de pago' : `Faltan ${pay.days} ${pay.days === 1 ? 'día' : 'días'} para tu pago`) : 'Tu mes';
  const top = month.expensesByCategory[0];
  return (
    <Card kicker={pay ? `Tu plata · pago el ${pay.date.getDate()}` : 'Tu plata'} title={title} right={<EyeButton visible={money.visible} onPress={money.toggle} />}>
      {month.income || month.expenses ? (
        <>
          <View style={styles.line}>
            <AppText variant="caption" muted style={{ flex: 1 }}>
              Gastado este mes
            </AppText>
            <AppText variant="subtitle">{displayAmount(month.expenses, money.visible)}</AppText>
          </View>
          <View style={styles.line}>
            <AppText variant="caption" muted style={{ flex: 1 }}>
              Te queda de lo que entró
            </AppText>
            <AppText variant="label" color={month.result < 0 ? colors.bad : colors.ok}>
              {displayAmount(month.result, money.visible)}
            </AppText>
          </View>
          {top ? (
            <AppText variant="caption" muted>
              {`Lo que más pesa: ${top.name.toLowerCase()}.`}
            </AppText>
          ) : null}
        </>
      ) : (
        <AppText variant="caption" muted>
          Registra un gasto o tu sueldo con el botón + y aquí verás cómo va tu mes.
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="+ Gasto" onPress={() => router.push({ pathname: '/finanzas', params: { nuevo: 'expense' } })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Finanzas" kind="secondary" onPress={() => router.push('/finanzas')} />
        </View>
      </View>
    </Card>
  );
}

export function WorkLinkCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const cross = useCross();
  const w = useWork(t.day);
  const job = w.jobOf(w.open);
  const tasks = useEntries('tareas_del_trabajo').of('tarea').filter((x) => !x.done);
  const planned = w.jobs.filter((j) => worksOn(j, t.now.getDay()));
  const title = w.open ? `En jornada · ${job?.title ?? 'Trabajo'}` : w.today.length ? `${w.today.length} ${w.today.length === 1 ? 'tramo' : 'tramos'} hoy` : planned.length ? `Hoy te toca: ${planned.map((j) => j.title).join(', ')}` : 'Tu jornada te espera en Trabajo';
  return (
    <Card kicker={`Trabajo${t.trade ? ` · ${t.trade.name}` : ''}`} kickerColor={colors.accent2} title={title}>
      {tasks.length ? <AppText variant="caption" muted>{`Pendiente: ${tasks.slice(0, 3).map((x) => x.title).join(' · ')}${tasks.length > 3 ? ` y ${tasks.length - 3} más` : ''}`}</AppText> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Mis trabajos" kind="secondary" onPress={() => router.navigate('/trabajo')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Modo foco" onPress={() => cross('work')} />
        </View>
      </View>
    </Card>
  );
}

// Pan de vida (25-10-2026): un versículo distinto cada día. 26-10-2026 (usuario): tocarlo abre ese
// versículo; arriba, «Leer» sigue donde quedaste; abajo, la barra de avance y la racha (🔥). Al
// marcarlo, el Pan de vida del día queda hecho (y el hábito de la Biblia, si lo tienes) y aparece
// otro versículo al azar para seguir; «Otro» trae uno más.
type Ref = { book: string; chapter: number; verse: number };
const refKey = (v: Ref) => `${v.book} ${v.chapter}:${v.verse}`;

export function BibleCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const done = t.done('pan');
  const books = useBibleBooks();
  const notes = useBibleNotes();
  const log = useEntries('biblia');
  const habits = useHabits(t.day);
  const daily = verseOfDay(t.day);
  const [extra, setExtra] = useState<Ref | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const v = extra ?? daily;
  const { verses, loading } = useChapter(v.book, v.chapter);
  const text = verses.find((x) => x.verse === v.verse)?.body;
  const name = (code: string) => books.find((b) => b.code === code)?.name ?? '';
  const prog = progress(notes.reads);
  const days = new Set([...notes.reads.map((r) => String(r.read_on).slice(0, 10)), ...log.entries.filter((e) => e.kind === 'pan' || e.kind === 'lectura').map((e) => e.day ?? '')]);
  const racha = streak(days, t.day);
  const bibleHabit = habits.habits.find((h) => /biblia|pan de vida/i.test(h.name));
  const another = () => {
    tap();
    const next = randomVerse([refKey(daily), refKey(v), ...seen]);
    setSeen((list) => [...list, refKey(v)].slice(-40));
    setExtra(next);
  };
  const toggle = async () => {
    tap();
    await t.toggleDone('pan');
    const mine = log.of('pan').find((e) => e.day === t.day);
    if (done) {
      setExtra(null);
      if (mine) await log.remove(mine.id);
      return;
    }
    if (!mine) await log.add({ kind: 'pan', day: t.day, title: refKey(daily) });
    if (bibleHabit && habits.countFor(bibleHabit.id) < (Number(bibleHabit.daily_target) || 1)) await habits.log(bibleHabit.id, 1);
    setExtra(randomVerse([refKey(daily), ...seen]));
  };
  const open = () => router.push({ pathname: '/biblia', params: { libro: v.book, cap: String(v.chapter), v: String(v.verse) } });
  return (
    <Card
      kicker={done ? `Pan de vida ✓ · ${extra ? 'otro para ti' : 'de hoy'}` : `Pan de vida · ${name(v.book)} ${v.chapter}:${v.verse}`}
      kickerColor={done ? colors.ok : undefined}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Leer la Biblia" onPress={() => router.push('/biblia')} style={[styles.readBtn, { backgroundColor: colors.surface2 }]}>
            <BookOpenIcon size={16} color={colors.accent} />
            <AppText variant="label" style={{ fontSize: 13 }} color={colors.accent}>
              Leer
            </AppText>
          </Pressable>
          {done ? null : <Check on={done} label="Pan de vida leído" onPress={toggle} />}
        </View>
      }
    >
      <Pressable accessibilityRole="button" accessibilityHint="Abre el versículo para seguir leyendo" onPress={open}>
        <AppText style={{ fontSize: 19, lineHeight: 27, fontFamily: fonts.semibold }}>
          {text ? `«${text}»` : loading ? '…' : 'Abre la Biblia con conexión para ver el versículo.'}
        </AppText>
        {done ? (
          <AppText variant="caption" muted style={{ marginTop: 4 }}>
            {`${name(v.book)} ${v.chapter}:${v.verse}`}
          </AppText>
        ) : null}
      </Pressable>
      {done ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={another} style={[styles.pill, { backgroundColor: colors.surface2 }]}>
            <AppText variant="label" style={{ fontSize: 13 }}>
              Otro versículo
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={toggle} style={[styles.pill, { backgroundColor: 'transparent' }]}>
            <AppText variant="caption" muted>
              Desmarcar
            </AppText>
          </Pressable>
        </View>
      ) : null}
      <View style={{ gap: 6 }}>
        <View style={styles.line}>
          <AppText variant="caption" muted style={{ flex: 1 }}>
            {`Reina-Valera 1909 · ${prog.percent} % leído`}
          </AppText>
          <AppText variant="label" color={racha ? colors.mid : colors.muted}>
            {racha ? `🔥 ${racha} ${racha === 1 ? 'día' : 'días'}` : 'Sin racha'}
          </AppText>
        </View>
        <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
          <View style={{ width: `${Math.max(1, Math.min(100, prog.percent))}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 3 }} />
        </View>
      </View>
    </Card>
  );
}

// Desde el 25-10-2026 el ánimo y el cierre del día se guardan en el Diario (journal_days). Desde el
// 27-10 (usuario: «podría aparecer realmente al terminar el día») la tarjeta sale recién a la hora
// del aviso que eligió la persona y lleva a «Cerrar el día», paso a paso.
export function JournalCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const j = useJournal();
  const [closing] = usePref('cierre', CLOSING_DEFAULT);
  const entry = dayEntry(j.days, t.day);
  const [h, m] = String(closing.hora).split(':').map(Number);
  const due = t.isToday && t.now.getHours() * 60 + t.now.getMinutes() >= (h || 0) * 60 + (m || 0);
  if (!due || entry?.closed) return null;
  return (
    <Card kicker={`Cerrar el día · ${closing.hora}`} title="Es hora de cerrar tu día">
      <AppText variant="caption" muted>
        Un minuto: cómo estuvo, cómo están tu cuerpo, tu mente y tu alma, lo que quedó pendiente y lo primero de mañana.
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          router.push('/cierre');
        }}
        style={[styles.closeDay, { backgroundColor: colors.accent }]}
      >
        <CheckIcon size={16} weight="bold" color={colors.onAccent} />
        <AppText variant="label" color={colors.onAccent}>
          Cerrar el día
        </AppText>
      </Pressable>
    </Card>
  );
}

export function PrivateNote() {
  const { colors } = useTheme();
  return (
    <View style={styles.note}>
      <LockIcon size={14} color={colors.muted} />
      <AppText variant="caption" muted style={{ flex: 1 }}>
        Tus datos se guardan cifrados en este teléfono y se respaldan en tu cuenta.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 11 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  add: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reduce: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  mini: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flexRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flexChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  readBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  closeDay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 11 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: space.sm },
});
