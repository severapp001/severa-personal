import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  buildContext,
  buildRefs,
  correctionLesson,
  isStale,
  isText,
  isToolUse,
  pendingToolUses,
  proposalLine,
  readProposal,
  resultOf,
  toolResult,
  userTextBefore,
  type Block,
  type ChatMessage,
  type Proposal,
  type ResultStatus,
  type ToolUse,
} from '@/core/assistant';
import { addDays, eventsOn, hhmm } from '@/core/agenda';
import { incomeStatement, monthKey } from '@/core/finance';
import { correctionRules, HELP, parseMessage, type IntentData } from '@/core/intent';
import { activitiesOf, dayEntry } from '@/core/journal';
import { dayKey, daysToPayday, type PaydayAnswer } from '@/core/today';
import { appendMessage, askAssistant, replaceMessage, startConversation, updateConversationRefs, useAssistantActions, useChat, type Conversation, type StoredMessage } from '@/data/assistant';
import { useAuth } from '@/data/auth';
import { useOnboarding } from '@/data/discovery';
import { BRAIN } from '@/features/assistant/brain';
import { GuidedFlow } from '@/features/assistant/GuidedFlow';
import { ideaText, IdeasSheet, useIdeas } from '@/features/assistant/IdeasSheet';
import { ProposalCard } from '@/features/assistant/ProposalCard';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ArrowClockwiseIcon, LightbulbIcon, ListChecksIcon, PaperPlaneRightIcon, SparkleIcon } from '@/ui/icons';
import { Empty, Sheet } from '@/ui/kit';

// Asistente (decisión del 25-10-2026): escribes con tus palabras y Severa propone qué registrar.
// Cada propuesta es una tarjeta que se confirma, se corrige o se cancela; lo corregido queda en
// «Lo que Severa aprendió» y se usa en los mensajes siguientes. Por ahora entiende sin IA, en el
// teléfono (BRAIN = 'local', decisión del usuario); con Claude basta cambiar features/assistant/brain.ts.

const EXAMPLES = [
  'Idea: vender el auto y comprar uno más chico',
  'Gasté 5 lucas en el almuerzo',
  'Dentista mañana a las 10, avísame una hora antes',
  'Tengo que pagar la luz el viernes',
  'Hoy tomé 3 vasos de agua',
  '¿Qué tengo esta semana?',
  'Cuando digo «la Copec» es bencina del trabajo',
];

const strip = (m: StoredMessage): ChatMessage => ({ role: m.role, content: m.content });

export default function AsistenteScreen() {
  const { colors, mode } = useTheme();
  const now = new Date();
  const today = dayKey(now);
  const { conversation, messages } = useChat();
  const { finance, habits, lessons, agenda, journal, studies, execute } = useAssistantActions(today);
  const { session } = useAuth();
  const onboarding = useOnboarding(session?.user.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLessons, setShowLessons] = useState(false);
  // Anotar con opciones (26-10-2026): el paso a paso por módulo, para lo que no entiendo escrito.
  const [guided, setGuided] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  // Tus ideas (27-10-2026): «idea: …» se guarda al tiro, sin pasar por el intérprete.
  const ideas = useIdeas();
  const [showIdeas, setShowIdeas] = useState(false);
  const openIdeas = ideas.entries.filter((e) => e.module === 'ideas' && e.kind === 'idea' && !e.done).length;
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const tail = messages.at(-1);
  const stale = !conversation || isStale(tail?.createdAt ?? conversation.startedAt, messages.length, now);
  const waitingRetry = !busy && tail?.role === 'user' && tail.content.some(isText);

  function freshContext() {
    const names = new Map(finance.categories.map((c) => [c.id, c.name]));
    const month = incomeStatement(finance.movements, finance.categories, monthKey(now));
    return buildContext({
      now,
      mode,
      categories: finance.categories,
      accounts: finance.accounts,
      habits: habits.habits,
      habitCounts: Object.fromEntries(habits.habits.map((h) => [h.id, habits.countFor(h.id)])),
      monthSpent: month.expensesByCategory.map((c) => ({ name: c.name, amount: c.total })),
      monthIncome: month.income,
      recent: finance.movements
        .filter((m) => m.kind === 'expense' || m.kind === 'income')
        .slice(0, 10)
        .map((m) => ({ occurred_on: m.occurred_on, kind: m.kind, amount: Number(m.amount), category: m.category_id ? (names.get(m.category_id) ?? null) : null, description: m.description ?? null })),
      upcoming: Array.from({ length: 8 }, (_, i) => addDays(today, i)).flatMap((d) => [
        ...eventsOn(agenda.events, d).map((e) => ({ date: d, time: hhmm(e.starts_at), title: e.title, kind: 'evento' as const })),
        ...agenda.tasks.filter((x) => x.due_on === d && x.status === 'pending').map((x) => ({ date: d, time: hhmm(x.due_at), title: x.title, kind: 'tarea' as const })),
      ]),
      undated: agenda.tasks
        .filter((x) => !x.due_on && x.status === 'pending')
        .map((x) => x.title)
        .slice(0, 20),
      journal: Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i))
        .map((d) => dayEntry(journal.days, d))
        .filter((e) => e !== null)
        .map((e) => ({ date: e.day, mood: e.mood === null ? null : Number(e.mood), activities: activitiesOf(e.activities) })),
      lessons: lessons.lessons,
    });
  }

  // Modo sin IA: referencias con los datos de ahora y lo necesario para responder preguntas.
  const localRefs = () => buildRefs({ categories: finance.categories, accounts: finance.accounts, habits: habits.habits, courses: studies.courses });
  function intentData(): IntentData {
    const names = new Map(finance.categories.map((c) => [c.id, c.name]));
    const pay = daysToPayday(onboarding?.answers.finanzas as PaydayAnswer, now);
    return {
      movements: finance.movements.map((m) => ({ date: m.occurred_on, kind: m.kind, amount: Number(m.amount), category: m.category_id ? (names.get(m.category_id) ?? null) : null })),
      agenda: Array.from({ length: 8 }, (_, i) => addDays(today, i)).flatMap((d) => [
        ...eventsOn(agenda.events, d).map((e) => ({ date: d, time: hhmm(e.starts_at), title: e.title, kind: 'evento' as const })),
        ...agenda.tasks.filter((x) => x.due_on === d && x.status === 'pending').map((x) => ({ date: d, time: hhmm(x.due_at), title: x.title, kind: 'tarea' as const })),
      ]),
      habits: habits.habits.map((h) => ({ name: h.name, count: habits.countFor(h.id), target: Number(h.daily_target) || 1, reduce: h.direction === 'reduce' })),
      paydayDays: pay?.days ?? null,
    };
  }

  async function ask(conv: Conversation, outgoing: ChatMessage[]) {
    if (BRAIN === 'local') {
      // Sin IA: se interpreta en el teléfono, al tiro. Las referencias crecen con lo nuevo.
      const refs = { ...conv.refs, ...localRefs() };
      if (Object.keys(refs).length !== Object.keys(conv.refs).length) await updateConversationRefs(conv.id, refs);
      const lastText =
        [...outgoing]
          .reverse()
          .find((m) => m.role === 'user')
          ?.content.filter(isText)
          .map((b) => b.text)
          .at(-1) ?? '';
      const r = parseMessage(lastText, { today, refs, lessons: lessons.lessons }, intentData());
      // El id de cada tarjeta sale del largo de la conversación (único dentro de ella).
      const stamp = `${outgoing.length}`;
      const content: Block[] = [...(r.reply ? [{ type: 'text', text: r.reply }] : []), ...r.calls.map((c, i) => ({ type: 'tool_use', id: `local-${stamp}-${i}`, name: c.name, input: c.input }))];
      await appendMessage(conv.id, 'assistant', content.length ? content : [{ type: 'text', text: HELP }]);
      return;
    }
    const { content } = await askAssistant(conv.context, outgoing);
    if (!content.length) throw new Error('El asistente no respondió. Prueba de nuevo.');
    await appendMessage(conv.id, 'assistant', content);
  }

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;
    const idea = ideaText(value);
    if (idea) {
      setText('');
      await ideas.add({ module: 'ideas', kind: 'idea', title: idea, day: today });
      setSavedNote(`Idea guardada en «Tus ideas»: ${idea}`);
      return;
    }
    setBusy(true);
    setError(null);
    setText('');
    try {
      let conv = conversation;
      let history = messages;
      if (!conv || stale) {
        const fresh = BRAIN === 'local' ? { text: '', refs: localRefs() } : freshContext();
        conv = await startConversation(fresh.text, fresh.refs);
        history = [];
      }
      // Lo que quedó sin responder se avisa como «sin respuesta» antes del texto nuevo.
      const blocks: Block[] = [...pendingToolUses(history).map((t) => toolResult(t.id, 'skipped')), { type: 'text', text: value }];
      const last = history.at(-1);
      let outgoing: ChatMessage[];
      if (last?.role === 'user') {
        const merged = [...last.content, ...blocks];
        await replaceMessage(last.rowId, merged);
        outgoing = [...history.slice(0, -1).map(strip), { role: 'user', content: merged }];
      } else {
        await appendMessage(conv.id, 'user', blocks);
        outgoing = [...history.map(strip), { role: 'user', content: blocks }];
      }
      await ask(conv, outgoing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!conversation || busy) return;
    setBusy(true);
    setError(null);
    try {
      await ask(conversation, messages.map(strip));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  }

  // La respuesta a una tarjeta se guarda al tiro y viaja con el próximo mensaje: confirmar no
  // le vuelve a preguntar a la IA (más rápido y más barato).
  async function resolve(tool: ToolUse, status: ResultStatus, detail?: string) {
    if (!conversation) return;
    const block = toolResult(tool.id, status, detail);
    const last = messages.at(-1);
    if (last?.role === 'user') await replaceMessage(last.rowId, [block, ...last.content]);
    else await appendMessage(conversation.id, 'user', [block]);
  }

  async function confirm(tool: ToolUse, index: number, before: Proposal, after: Proposal) {
    if (!conversation) return;
    const refs = conversation.refs;
    await execute(after, refs);
    const userText = userTextBefore(messages, index);
    const changedIt = JSON.stringify(before) !== JSON.stringify(after);
    if (BRAIN === 'local') {
      // Sin IA, lo corregido queda como regla («copec» → Categoría: Bencina) que el intérprete usa.
      for (const rule of changedIt ? correctionRules(userText, before, after, refs) : []) await lessons.addLesson(rule);
    } else {
      const lesson = correctionLesson(userText, before, after, refs);
      if (lesson) await lessons.addLesson(lesson);
    }
    await resolve(tool, changedIt ? 'corrected' : 'done', changedIt ? `se guardó ${proposalLine(after, refs)}; tu propuesta era ${proposalLine(before, refs)}` : proposalLine(after, refs));
  }

  return (
    <Screen scroll={false}>
      <ModuleHeader
        kicker="Tu cerebro"
        title="Severa"
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Tus ideas: ${openIdeas}`} onPress={() => setShowIdeas(true)} style={[styles.round, { backgroundColor: colors.surface }]}>
              <SparkleIcon size={20} color={colors.accent} />
              {openIdeas ? (
                <AppText variant="caption" color={colors.accent} style={styles.badge}>
                  {openIdeas}
                </AppText>
              ) : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Lo que Severa aprendió: ${lessons.lessons.length}`} onPress={() => setShowLessons(true)} style={[styles.round, { backgroundColor: colors.surface }]}>
              <LightbulbIcon size={20} color={colors.accent} />
              {lessons.lessons.length ? (
                <AppText variant="caption" color={colors.accent} style={styles.badge}>
                  {lessons.lessons.length}
                </AppText>
              ) : null}
            </Pressable>
          </View>
        }
      />

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
        {stale || !messages.length ? (
          <View style={{ gap: space.md }}>
            <AppText variant="body" muted>
              {BRAIN === 'local'
                ? 'Escríbeme frases cortas y te propongo qué anotar. Entiendo sin IA, aquí en tu teléfono: no se envía nada. Tú confirmas, corriges o cancelas; lo que corrijas lo aprendo.'
                : 'Escríbeme como hablas y te propongo qué anotar. Tú confirmas, corriges o cancelas; lo que corrijas lo aprendo.'}
            </AppText>
            <Button label="Anotar con opciones, paso a paso" onPress={() => setGuided(true)} />
            <AppText variant="caption" muted>
              O escribe una frase. Por ejemplo:
            </AppText>
            <View style={styles.examples}>
              {EXAMPLES.map((e) => (
                <Pressable key={e} accessibilityRole="button" onPress={() => setText(e)} style={[styles.example, { backgroundColor: colors.surface }]}>
                  <AppText variant="caption">{e}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {stale
          ? null
          : messages.map((m, i) =>
              m.role === 'user'
                ? m.content.filter(isText).map((b, j) => (
                    <View key={`${m.rowId}:${j}`} style={[styles.bubble, styles.mine, { backgroundColor: colors.accentSoft }]}>
                      <AppText variant="body">{b.text}</AppText>
                    </View>
                  ))
                : m.content.map((b, j) => {
                    if (isText(b)) {
                      return (
                        <View key={`${m.rowId}:${j}`} style={[styles.bubble, { backgroundColor: colors.surface }]}>
                          <AppText variant="body">{b.text}</AppText>
                        </View>
                      );
                    }
                    if (!isToolUse(b) || !conversation) return null;
                    const proposal = readProposal(b.name, b.input, conversation.refs, today);
                    return (
                      <ProposalCard
                        key={`${m.rowId}:${b.id}`}
                        proposal={proposal}
                        refs={conversation.refs}
                        today={today}
                        status={resultOf(messages, b.id)}
                        onConfirm={(final) => confirm(b, i, proposal ?? final, final)}
                        onCancel={() => resolve(b, proposal ? 'cancelled' : 'failed', proposal ? undefined : 'faltaban datos o una referencia no existía')}
                      />
                    );
                  }),
            )}

        {busy ? (
          <AppText variant="caption" muted>
            Severa está pensando…
          </AppText>
        ) : null}
        {/* Si lo último fue «no te entendí», el paso a paso queda a un toque. */}
        {!busy && !stale && tail?.role === 'assistant' && tail.content.some((b) => isText(b) && b.text.startsWith('No te entendí')) ? <Button label="Anotarlo con opciones" kind="secondary" onPress={() => setGuided(true)} /> : null}
        {savedNote ? <Notice tone="ok" text={`✓ ${savedNote}`} /> : null}
        {error ? <Notice text={error} /> : null}
        {waitingRetry && conversation && !stale ? <Button label="Reintentar" kind="secondary" onPress={retry} /> : null}
      </ScrollView>

      <View style={[styles.inputRow, { backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Anotar con opciones"
          onPress={() => {
            tap();
            setGuided(true);
          }}
          style={[styles.send, { backgroundColor: colors.surface2 }]}
        >
          <ListChecksIcon size={20} color={colors.accent} />
        </Pressable>
        <TextInput value={text} onChangeText={setText} placeholder="Escribe aquí…" placeholderTextColor={colors.muted} multiline style={[styles.input, { color: colors.text }]} accessibilityLabel="Mensaje para Severa" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={busy || !text.trim()}
          onPress={() => {
            tap();
            send(text);
          }}
          style={[styles.send, { backgroundColor: colors.accent, opacity: busy || !text.trim() ? 0.5 : 1 }]}
        >
          {busy ? <ArrowClockwiseIcon size={20} color={colors.onAccent} /> : <PaperPlaneRightIcon size={20} weight="fill" color={colors.onAccent} />}
        </Pressable>
      </View>

      <GuidedFlow
        visible={guided}
        today={today}
        onClose={() => setGuided(false)}
        onSaved={(t) => {
          setSavedNote(t);
          setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
        }}
      />
      <IdeasSheet visible={showIdeas} today={today} onClose={() => setShowIdeas(false)} />
      <Sheet visible={showLessons} title="Lo que Severa aprendió de ti" onClose={() => setShowLessons(false)}>
        <AppText variant="caption" muted>
          Se usa en cada conversación nueva. Si algo quedó mal, olvídalo y corrige la próxima vez.
        </AppText>
        {lessons.lessons.length ? (
          lessons.lessons.map((l) => (
            <View key={l.id} style={[styles.lesson, { borderBottomColor: colors.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{l.kind === 'rule' ? `«${l.phrase}»` : `Cuando escribiste «${l.phrase}»`}</AppText>
                <AppText variant="caption" muted>
                  {l.meaning}
                </AppText>
              </View>
              <Button label="Olvidar" kind="link" onPress={() => lessons.forget(l.id)} />
            </View>
          ))
        ) : (
          <Empty text="Todavía nada. Cuando corrijas una tarjeta o me enseñes una expresión, aparece aquí." />
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: { minWidth: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 10 },
  badge: { fontSize: 12 },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  example: { borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  bubble: { borderRadius: radius.md, padding: space.md, maxWidth: '88%', alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: radius.md, padding: 6 },
  input: { flex: 1, minHeight: 40, maxHeight: 140, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 8 },
  send: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
