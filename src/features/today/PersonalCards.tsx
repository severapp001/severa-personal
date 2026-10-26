import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { continueFrom, verseOfDay } from '@/core/bible';
import { incomeStatement, monthKey } from '@/core/finance';
import { dayEntry, MOODS } from '@/core/journal';
import { displayAmount } from '@/core/money';
import { daysToPayday, fmtTime, nextItem, type PaydayAnswer } from '@/core/today';
import { useBibleBooks, useBibleNotes, useChapter } from '@/data/bible';
import { useFinance } from '@/data/finance';
import { useJournal } from '@/data/journal';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { useCross } from '@/features/space/SpaceCross';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, EyeButton } from '@/ui';
import { tap } from '@/ui/haptics';
import { BookOpenIcon, CheckIcon, LockIcon, PencilSimpleIcon, PlusIcon } from '@/ui/icons';
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
  const doneCount = t.items.filter((it) => t.done(it.id)).length;
  const next = nextItem(t.items, t.nowMin, t.done);
  return (
    <Card
      kicker={`Tu día · ${doneCount} de ${t.items.length} hechas`}
      title={next ? `Sigue a las ${fmtTime(next.t)}: ${next.title}` : 'Todo listo por hoy'}
      right={
        <AppText variant="label" color={colors.accent} onPress={onSeeAll}>
          Ver todo
        </AppText>
      }
    >
      <DayLineCompact items={t.items} now={t.nowMin} done={t.done} onToggle={t.toggleDone} />
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
  const started = t.marks['j:start']?.value;
  const ended = t.marks['j:end']?.value;
  const title = ended ? 'Jornada cerrada' : started ? 'Estás en jornada' : 'Tu jornada te espera en Trabajo';
  return (
    <Card kicker={`Trabajo${t.trade ? ` · ${t.trade.name}` : ''}`} kickerColor={colors.accent2} title={title}>
      <Button label="Cruzar a Trabajo" kind="secondary" onPress={() => cross('work')} />
    </Card>
  );
}

// Pan de vida (25-10-2026): un versículo distinto cada día, sacado de la Biblia, y dónde seguir leyendo.
export function BibleCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const done = t.done('pan');
  const books = useBibleBooks();
  const notes = useBibleNotes();
  const v = verseOfDay(t.day);
  const { verses, loading } = useChapter(v.book, v.chapter);
  const text = verses.find((x) => x.verse === v.verse)?.body;
  const name = (code: string) => books.find((b) => b.code === code)?.name ?? '';
  const next = continueFrom(books, notes.reads);
  return (
    <Card kicker={`Pan de vida · ${name(v.book)} ${v.chapter}:${v.verse}`} right={<Check on={done} label="Pan de vida leído" onPress={() => t.toggleDone('pan')} />}>
      <AppText style={{ fontSize: 19, lineHeight: 27, fontFamily: fonts.semibold }}>
        {text ? `«${text}»` : loading ? '…' : 'Abre la Biblia con conexión para ver el versículo de hoy.'}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <BookOpenIcon size={16} color={colors.muted} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          Reina-Valera 1909
        </AppText>
        <AppText variant="label" color={colors.accent} onPress={() => router.push('/biblia')}>
          {notes.reads.length ? `Seguir: ${name(next.book)} ${next.chapter}` : 'Leer'}
        </AppText>
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
  const mood = entry?.mood ?? null;
  const done = !!entry?.closed;
  return (
    <Card kicker="Cerrar el día" title="¿Cómo estuvo tu día?">
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
              <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Escribir" kind="secondary" onPress={() => router.push('/diario')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={done ? 'Día cerrado' : 'Cerrar el día'} kind={done ? 'secondary' : 'primary'} onPress={() => j.saveDay(t.day, { closed: !done })} />
        </View>
      </View>
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
  moods: { flexDirection: 'row', gap: 6 },
  mood: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: space.sm },
});
