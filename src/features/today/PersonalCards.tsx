import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { continueFrom, progress, verseOfDay } from '@/core/bible';
import { incomeStatement, monthKey } from '@/core/finance';
import { dayEntry, MOODS } from '@/core/journal';
import { displayAmount } from '@/core/money';
import { streak } from '@/core/modules';
import { daysToPayday, fmtTime, nextItem, type PaydayAnswer } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useBibleBooks, useBibleNotes, useChapter } from '@/data/bible';
import { useEntries } from '@/data/entries';
import { useFinance } from '@/data/finance';
import { useJournal } from '@/data/journal';
import { useHabits } from '@/data/modules';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { AgendaSheet, type AgendaTarget } from '@/features/agenda/AgendaSheet';
import { useCross } from '@/features/space/SpaceCross';
import { worksOn } from '@/features/work/jobs';
import { useWork } from './WorkToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, EyeButton } from '@/ui';
import { tap } from '@/ui/haptics';
import { BookOpenIcon, CalendarPlusIcon, CheckIcon, ListChecksIcon, LockIcon, PencilSimpleIcon, PlusIcon } from '@/ui/icons';
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
  const doneCount = t.items.filter((it) => t.done(it.id)).length;
  const next = nextItem(t.items, t.nowMin, t.done);
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
  return (
    <Card
      kicker={`Tu día · ${doneCount} de ${t.items.length} hechas`}
      title={next ? `Sigue a las ${fmtTime(next.t)}: ${next.title}` : 'Todo listo por hoy'}
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
      <DayLineCompact items={t.items} now={t.nowMin} done={t.done} onToggle={t.toggleDone} />
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

// Pan de vida (25-10-2026): un versículo distinto cada día. Desde el 26-10-2026 (usuario): tocarlo
// abre ese versículo para leer el anterior y el siguiente; arriba, «Leer» sigue donde quedaste;
// abajo, la barra de avance y la racha (🔥). Marcarlo como leído cuenta para la racha y completa
// el Pan de vida de tu día y el hábito de la Biblia, si lo tienes.
export function BibleCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const done = t.done('pan');
  const books = useBibleBooks();
  const notes = useBibleNotes();
  const log = useEntries('biblia');
  const habits = useHabits(t.day);
  const v = verseOfDay(t.day);
  const { verses, loading } = useChapter(v.book, v.chapter);
  const text = verses.find((x) => x.verse === v.verse)?.body;
  const name = (code: string) => books.find((b) => b.code === code)?.name ?? '';
  const next = continueFrom(books, notes.reads);
  const prog = progress(notes.reads);
  const days = new Set([...notes.reads.map((r) => String(r.read_on).slice(0, 10)), ...log.entries.filter((e) => e.kind === 'pan' || e.kind === 'lectura').map((e) => e.day ?? '')]);
  const racha = streak(days, t.day);
  const bibleHabit = habits.habits.find((h) => /biblia|pan de vida/i.test(h.name));
  const toggle = async () => {
    tap();
    await t.toggleDone('pan');
    const mine = log.of('pan').find((e) => e.day === t.day);
    if (done) {
      if (mine) await log.remove(mine.id);
    } else {
      if (!mine) await log.add({ kind: 'pan', day: t.day, title: `${v.book} ${v.chapter}:${v.verse}` });
      if (bibleHabit && habits.countFor(bibleHabit.id) < (Number(bibleHabit.daily_target) || 1)) await habits.log(bibleHabit.id, 1);
    }
  };
  const open = () => router.push({ pathname: '/biblia', params: { libro: v.book, cap: String(v.chapter), v: String(v.verse) } });
  return (
    <Card
      kicker={`Pan de vida · ${name(v.book)} ${v.chapter}:${v.verse}`}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Leer la Biblia: ${name(next.book)} ${next.chapter}`} onPress={() => router.push('/biblia')} style={[styles.readBtn, { backgroundColor: colors.surface2 }]}>
            <BookOpenIcon size={16} color={colors.accent} />
            <AppText variant="label" style={{ fontSize: 13 }} color={colors.accent}>
              Leer
            </AppText>
          </Pressable>
          <Check on={done} label="Pan de vida leído" onPress={toggle} />
        </View>
      }
    >
      <Pressable accessibilityRole="button" accessibilityHint="Abre el versículo para seguir leyendo" onPress={open}>
        <AppText style={{ fontSize: 19, lineHeight: 27, fontFamily: fonts.semibold }}>
          {text ? `«${text}»` : loading ? '…' : 'Abre la Biblia con conexión para ver el versículo de hoy.'}
        </AppText>
      </Pressable>
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

// Desde el 25-10-2026 el ánimo y el cierre del día se guardan en el Diario (journal_days).
export function JournalCard({ t, night }: { t: Today; night: boolean }) {
  const { colors } = useTheme();
  const j = useJournal();
  const moodColor = useMoodColor();
  const entry = dayEntry(j.days, t.day);
  const close = t.items.find((i) => i.id === 'cierre');
  if (!night && !entry) {
    return (
      <Card
        kicker="Diario"
        title="Esta noche cierras tu día"
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir el diario" hitSlop={8} onPress={() => router.push('/diario')}>
            <PencilSimpleIcon size={22} color={colors.muted} />
          </Pressable>
        }
      >
        <AppText variant="caption" muted>
          {close ? `A las ${fmtTime(close.t)} · toma un minuto` : 'Toma un minuto'}
        </AppText>
      </Card>
    );
  }
  // Día cerrado: la tarjeta sale de Hoy (usuario, 26-10-2026); en el Diario se sigue editando.
  if (entry?.closed) return null;
  const mood = entry?.mood ?? null;
  return (
    <View style={[styles.card, styles.compact, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <AppText variant="caption" color={colors.muted} style={[styles.kicker, { flex: 1 }]}>
          CERRAR EL DÍA · ¿CÓMO ESTUVO?
        </AppText>
        <AppText variant="label" color={colors.accent} onPress={() => router.push('/diario')}>
          Escribir
        </AppText>
      </View>
      <View style={styles.moods}>
        {MOODS.map((m) => {
          const on = mood === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                j.saveDay(t.day, { mood: on ? null : m.value });
              }}
              style={[styles.mood, { backgroundColor: on ? moodColor(m.value) : colors.surface2 }]}
            >
              <AppText variant="label" style={{ fontSize: 12 }} color={on ? colors.onAccent : colors.text}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          j.saveDay(t.day, { closed: true });
        }}
        style={[styles.closeDay, { backgroundColor: colors.accent }]}
      >
        <CheckIcon size={16} weight="bold" color={colors.onAccent} />
        <AppText variant="label" color={colors.onAccent}>
          Cerrar el día
        </AppText>
      </Pressable>
    </View>
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
  moods: { flexDirection: 'row', gap: 6 },
  mood: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  compact: { padding: space.md, gap: space.sm },
  mini: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  readBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  closeDay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 11 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: space.sm },
});
