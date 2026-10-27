import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';

import { addDays } from '@/core/agenda';
import { streak } from '@/core/modules';
import { dayKey } from '@/core/today';
import type { Entry } from '@/data/entries';
import { useHabits } from '@/data/modules';
import { useGoals, type Block } from '@/features/goals/useGoals';
import { MODULES } from '@/features/modules/catalog';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ArrowDownIcon, ArrowUpIcon, CaretLeftIcon, CheckIcon, PlusIcon, TrophyIcon, XIcon } from '@/ui/icons';
import { BarRow, DateField, Empty, Field, Kicker, Panel, PillTabs, Sheet } from '@/ui/kit';

// Metas y caminos (usuario, 26-10-2026: «controlar mi TDAH, organizar mis ideas, cumplir mis
// metas… el camino que debería hacer… algo tipo Notion para desarrollar ideas»). Cada meta tiene
// su camino (etapas con pasos chicos), su página de ideas por bloques y su bitácora. En Hoy se ve
// solo el próximo paso.
// 27-10-2026 (usuario: «meta: vender auto; pasos: lavar auto, tomar fotos, publicar, vender…; la
// primera tarea irá a prioridades y, si no se realiza, pasa como prioridad al siguiente día» ·
// «mapa visual del camino» · «pasos al calendario y hábitos»): el próximo paso de cada meta entra a
// Prioridades hasta que se hace; un paso puede tener día (sale en el Calendario y en Prioridades
// ese día) o volverse un hábito; arriba del camino va su mapa.

const META = MODULES.metas.kinds.find((k) => k.kind === 'meta')!;
const PARTS = ['Cuerpo', 'Mente', 'Alma', 'Sin parte'];
const partOf = (g: Entry) => (PARTS.includes(String(g.data.parte)) ? String(g.data.parte) : 'Sin parte');
const uid = () => `${Date.now().toString(36)}${Math.round(Math.random() * 1e6).toString(36)}`;

export default function MetasScreen() {
  const { colors } = useTheme();
  const g = useGoals(dayKey(new Date()));
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const goal = open ? (g.goals.find((x) => x.id === open) ?? null) : null;
  const tone: Record<string, string> = { Cuerpo: colors.ok, Mente: colors.accent2, Alma: colors.accent };

  const sheetEl = (
    <EntrySheet
      target={sheet}
      ctx={{ parent: null, entries: g.store.entries }}
      onClose={() => setSheet(null)}
      onSave={(input, target) => (target.entry ? g.store.update(target.entry.id, input) : g.store.add(input))}
      onRemove={async (e) => {
        await g.store.remove(e.id);
        setOpen(null);
      }}
    />
  );

  if (goal) return <GoalDetail goal={goal} g={g} color={tone[String(goal.data.parte)] ?? colors.accent} onBack={() => setOpen(null)} onEdit={() => setSheet({ kind: META, entry: goal })} sheet={sheetEl} />;

  return (
    <Screen>
      <ModuleHeader kicker="Tú" title="Metas y caminos" />
      <AppText variant="caption" muted>
        Una meta grande se cumple con pasos chicos. Arma el camino por etapas, anota tus ideas y Severa te muestra en Hoy solo el próximo paso.
      </AppText>
      {PARTS.map((p) => {
        const list = g.goals.filter((x) => partOf(x) === p);
        if (!list.length) return null;
        return (
          <View key={p} style={{ gap: 8 }}>
            <Kicker color={tone[p] ?? colors.muted}>{p}</Kicker>
            {list.map((x) => {
              const next = g.nextOf(x.id);
              const pct = g.progress(x.id);
              return (
                <Pressable key={x.id} accessibilityRole="button" onPress={() => setOpen(x.id)} style={[styles.goal, { backgroundColor: colors.surface, borderLeftColor: tone[p] ?? colors.line }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText variant="subtitle" style={{ flex: 1, textDecorationLine: x.done ? 'line-through' : 'none' }} color={x.done ? colors.muted : colors.text}>
                      {x.title}
                    </AppText>
                    {x.done ? <AppText variant="label" color={colors.ok}>🏆 Lograda</AppText> : null}
                  </View>
                  <BarRow label={next ? `Próximo: ${next.title}` : g.steps(x.id).length ? 'Todos los pasos hechos' : 'Arma su camino'} value={pct} max={1} text={`${Math.round(pct * 100)} %`} tone="ok" />
                </Pressable>
              );
            })}
          </View>
        );
      })}
      {!g.goals.length ? <Empty text="Plantea tu primera meta o desafío: para tu cuerpo, tu mente o tu alma." /> : null}
      <Button label="+ Nueva meta o desafío" onPress={() => setSheet({ kind: META })} />
      {sheetEl}
    </Screen>
  );
}

function GoalDetail({ goal, g, color, onBack, onEdit, sheet }: { goal: Entry; g: ReturnType<typeof useGoals>; color: string; onBack: () => void; onEdit: () => void; sheet: React.ReactNode }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'camino' | 'ideas' | 'bitacora'>('camino');
  const today = dayKey(new Date());
  const pct = g.progress(goal.id);
  const challenge = /(\d+) días/.exec(String(goal.data.tipo ?? ''));
  const logs = g.logs(goal.id);
  const racha = streak(logs.map((l) => l.day ?? ''), today);
  return (
    <Screen>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} style={[styles.back, { backgroundColor: colors.surface }]}>
          <CaretLeftIcon size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="caption" color={color} style={{ letterSpacing: 1.4 }}>
            {`${String(goal.data.parte ?? '').toUpperCase()} · ${String(goal.data.tipo ?? 'Meta').toUpperCase()}`}
          </AppText>
          <AppText variant="title" numberOfLines={2} style={{ fontSize: 24, lineHeight: 29 }}>
            {goal.title}
          </AppText>
        </View>
        <AppText variant="label" color={colors.accent} onPress={onEdit}>
          Editar
        </AppText>
      </View>
      {goal.body ? <AppText style={{ fontSize: 15 }}>{`«${goal.body}»`}</AppText> : null}
      <BarRow label="Avance del camino" value={pct} max={1} text={`${Math.round(pct * 100)} %`} tone="ok" />
      {challenge ? <BarRow label={`Desafío · racha de ${racha} días`} value={new Set(logs.map((l) => l.day)).size} max={Number(challenge[1])} text={`${new Set(logs.map((l) => l.day)).size} de ${challenge[1]} días`} /> : null}
      <PillTabs
        options={[
          { value: 'camino', label: 'Camino' },
          { value: 'ideas', label: 'Ideas' },
          { value: 'bitacora', label: 'Bitácora' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'camino' ? <Path goal={goal} g={g} color={color} /> : tab === 'ideas' ? <Ideas goal={goal} g={g} /> : <Log goal={goal} g={g} today={today} />}
      <Button
        label={goal.done ? 'Volver a abrirla' : '¡La logré! 🏆'}
        kind={goal.done ? 'secondary' : 'primary'}
        onPress={() => {
          tap();
          g.store.update(goal.id, { done: !goal.done });
        }}
      />
      {sheet}
    </Screen>
  );
}

/** Una fila para escribir y agregar (un paso, una etapa). */
function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    tap();
    onAdd(text.trim());
    setText('');
  };
  return (
    <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
      <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.muted} onSubmitEditing={add} returnKeyType="done" style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Agregar" onPress={add} hitSlop={8}>
        <PlusIcon size={20} color={text.trim() ? colors.accent : colors.muted} />
      </Pressable>
    </View>
  );
}

function StepRow({ step, g, onOpen }: { step: Entry; g: ReturnType<typeof useGoals>; onOpen: (s: Entry) => void }) {
  const { colors } = useTheme();
  const today = dayKey(new Date());
  return (
    <Pressable onPress={() => onOpen(step)} style={styles.step}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: step.done }}
        accessibilityLabel={step.title ?? ''}
        hitSlop={8}
        onPress={() => {
          tap();
          g.toggleStep(step);
        }}
        style={[styles.check, { backgroundColor: step.done ? colors.ok : 'transparent', borderColor: step.done ? colors.ok : colors.line }]}
      >
        {step.done ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : null}
      </Pressable>
      <AppText style={{ flex: 1, fontSize: 15, textDecorationLine: step.done ? 'line-through' : 'none' }} color={step.done ? colors.muted : colors.text}>
        {step.title}
      </AppText>
      {step.data.habito ? (
        <AppText variant="caption" color={colors.ok}>
          ↻ hábito
        </AppText>
      ) : step.day && !step.done ? (
        <AppText variant="caption" color={step.day < today ? colors.bad : colors.accent}>
          {`📅 ${step.day.slice(8, 10)}-${step.day.slice(5, 7)}`}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Un paso: cambiarle el nombre, darle un día (va al Calendario y a Prioridades) o volverlo hábito. */
function StepSheet({ step, g, onClose }: { step: Entry | null; g: ReturnType<typeof useGoals>; onClose: () => void }) {
  return (
    <Sheet visible={!!step} title="Paso del camino" onClose={onClose}>
      {step ? <StepForm key={step.id} step={step} g={g} onClose={onClose} /> : null}
    </Sheet>
  );
}

function StepForm({ step, g, onClose }: { step: Entry; g: ReturnType<typeof useGoals>; onClose: () => void }) {
  const today = dayKey(new Date());
  const habits = useHabits(today);
  const [title, setTitle] = useState(step.title ?? '');
  const [day, setDay] = useState<string | null>(step.day);
  const save = async () => {
    tap();
    await g.store.update(step.id, { title: title.trim() || step.title, day });
    onClose();
  };
  return (
    <>
      <Field label="Paso" value={title} onChangeText={setTitle} />
      <DateField label="¿Qué día lo harás? (opcional: sale en tu Calendario y en Prioridades ese día)" value={day} onChange={setDay} future />
      <Button label="Guardar" onPress={save} />
      {!step.data.habito ? (
        <Button
          label="Volverlo un hábito que se repite"
          kind="secondary"
          onPress={async () => {
            tap();
            await habits.addHabit({ name: (title.trim() || step.title || 'Hábito').slice(0, 60), direction: 'good' });
            await g.store.update(step.id, { done: true, data: { ...step.data, habito: true, hecho: today } });
            onClose();
          }}
        />
      ) : null}
      <Button
        label="Borrar el paso"
        kind="link"
        onPress={() =>
          Alert.alert('¿Borrar el paso?', step.title ?? '', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Borrar',
              style: 'destructive',
              onPress: async () => {
                await g.store.remove(step.id);
                onClose();
              },
            },
          ])
        }
      />
    </>
  );
}

/** El mapa del camino: un sendero que baja zigzagueando por cada paso hasta la meta. Lo hecho se
 *  enciende en dorado; el próximo paso late más grande. */
function PathMap({ goal, g, color, onOpen }: { goal: Entry; g: ReturnType<typeof useGoals>; color: string; onOpen: (s: Entry) => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const steps = g.steps(goal.id);
  const next = g.nextOf(goal.id);
  if (!steps.length) return null;
  const w = Math.min(width, 560) - 64;
  const GAP = 74;
  const pts = [...steps.map((_, i) => ({ x: i % 2 ? w * 0.74 : w * 0.26, y: 30 + i * GAP })), { x: w / 2, y: 30 + steps.length * GAP }];
  const curve = (list: typeof pts) => list.map((p, i) => (i ? `C ${list[i - 1].x} ${list[i - 1].y + GAP / 2} ${p.x} ${p.y - GAP / 2} ${p.x} ${p.y}` : `M ${p.x} ${p.y}`)).join(' ');
  const lastDone = steps.reduce((n, s, i) => (s.done ? i + 1 : n), 0);
  const height = pts[pts.length - 1].y + 40;
  return (
    <Panel>
      <Kicker color={color}>{`Mapa del camino · ${steps.filter((s) => s.done).length} de ${steps.length}`}</Kicker>
      <View style={{ width: w, height, alignSelf: 'center' }}>
        <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
          <SvgPath d={curve(pts)} stroke={colors.surface2} strokeWidth={12} strokeLinecap="round" fill="none" />
          {lastDone > 0 ? <SvgPath d={curve(pts.slice(0, lastDone + (lastDone === steps.length ? 1 : 0)))} stroke={color} strokeWidth={6} strokeLinecap="round" fill="none" /> : null}
        </Svg>
        {steps.map((s, i) => {
          const p = pts[i];
          const isNext = next?.id === s.id;
          const size = isNext ? 34 : 26;
          const left = i % 2 === 0;
          return (
            <View key={s.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.title ?? 'Paso'}
                onPress={() => onOpen(s)}
                style={[
                  styles.mapNode,
                  { width: size, height: size, borderRadius: size / 2, left: p.x - size / 2, top: p.y - size / 2, backgroundColor: s.done ? color : colors.surface, borderColor: s.done ? color : isNext ? color : colors.line, borderWidth: isNext ? 3 : 2 },
                ]}
              >
                {s.done ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : <AppText variant="caption" style={{ fontSize: 11 }}>{String(i + 1)}</AppText>}
              </Pressable>
              <View style={[styles.mapLabel, left ? { left: p.x + 22, width: w - p.x - 22 } : { left: 0, width: p.x - 22, alignItems: 'flex-end' }, { top: p.y - 16 }]}>
                <AppText variant="label" numberOfLines={2} style={{ fontSize: 13, textAlign: left ? 'left' : 'right', textDecorationLine: s.done ? 'line-through' : 'none' }} color={s.done ? colors.muted : isNext ? color : colors.text}>
                  {s.title}
                </AppText>
                {isNext ? (
                  <AppText variant="caption" color={color} style={{ fontSize: 11 }}>
                    Próximo paso
                  </AppText>
                ) : s.day && !s.done ? (
                  <AppText variant="caption" muted style={{ fontSize: 11 }}>{`📅 ${s.day.slice(8, 10)}-${s.day.slice(5, 7)}`}</AppText>
                ) : null}
              </View>
            </View>
          );
        })}
        <View style={[styles.mapGoal, { left: w / 2 - 22, top: pts[pts.length - 1].y - 22, backgroundColor: lastDone === steps.length ? color : colors.surface2 }]}>
          <TrophyIcon size={22} color={lastDone === steps.length ? colors.onAccent : colors.muted} />
        </View>
      </View>
    </Panel>
  );
}

/** El camino: etapas en orden, cada una con sus pasos; los pasos sueltos al final. */
function Path({ goal, g, color }: { goal: Entry; g: ReturnType<typeof useGoals>; color: string }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState<Entry | null>(null);
  const hitos = g.hitos(goal.id);
  const steps = g.steps(goal.id);
  const loose = steps.filter((s) => !hitos.some((h) => h.id === s.data.hito));
  const next = g.nextOf(goal.id);
  const addStep = (text: string, hito: string | null) => g.store.add({ kind: 'paso', parent_id: goal.id, title: text, data: { hito, orden: steps.length } });
  return (
    <>
      {next ? (
        <Panel>
          <Kicker color={color}>Tu próximo paso</Kicker>
          <AppText variant="subtitle">{next.title}</AppText>
          <AppText variant="caption" muted>
            Ya está en tus Prioridades de hoy y sigue ahí hasta que lo hagas. Si te cuesta empezar, hazlo solo 10 minutos.
          </AppText>
        </Panel>
      ) : null}
      <PathMap goal={goal} g={g} color={color} onOpen={setEditing} />
      {hitos.map((h, i) => {
        const mine = steps.filter((s) => s.data.hito === h.id);
        const done = mine.length > 0 && mine.every((s) => s.done);
        return (
          <View key={h.id} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 18 }}>
              <View style={[styles.node, { backgroundColor: done ? colors.ok : color }]} />
              {i < hitos.length - 1 || loose.length ? <View style={[styles.stem, { backgroundColor: colors.line }]} /> : null}
            </View>
            <View style={[styles.stage, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppText variant="label" style={{ flex: 1 }} color={done ? colors.ok : colors.text}>
                  {`${i + 1}. ${h.title}`}
                </AppText>
                <Pressable accessibilityLabel="Subir etapa" onPress={() => i && Promise.all([g.store.update(h.id, { data: { ...h.data, orden: i - 1 } }), g.store.update(hitos[i - 1].id, { data: { ...hitos[i - 1].data, orden: i } })])} hitSlop={6}>
                  <ArrowUpIcon size={16} color={i ? colors.muted : colors.line} />
                </Pressable>
                <Pressable accessibilityLabel="Bajar etapa" onPress={() => i < hitos.length - 1 && Promise.all([g.store.update(h.id, { data: { ...h.data, orden: i + 1 } }), g.store.update(hitos[i + 1].id, { data: { ...hitos[i + 1].data, orden: i } })])} hitSlop={6}>
                  <ArrowDownIcon size={16} color={i < hitos.length - 1 ? colors.muted : colors.line} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Borrar etapa"
                  onPress={() =>
                    Alert.alert('¿Borrar la etapa?', 'Sus pasos quedan sueltos.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Borrar', style: 'destructive', onPress: () => g.store.remove(h.id) },
                    ])
                  }
                  hitSlop={6}
                >
                  <XIcon size={16} color={colors.muted} />
                </Pressable>
              </View>
              {mine.map((s) => (
                <StepRow key={s.id} step={s} g={g} onOpen={setEditing} />
              ))}
              <AddRow placeholder="Agregar un paso chico" onAdd={(t) => addStep(t, h.id)} />
            </View>
          </View>
        );
      })}
      {loose.length || !hitos.length ? (
        <Panel>
          <Kicker>{hitos.length ? 'Pasos sueltos' : 'Pasos'}</Kicker>
          {loose.map((s) => (
            <StepRow key={s.id} step={s} g={g} onOpen={setEditing} />
          ))}
          <AddRow placeholder="Agregar un paso chico" onAdd={(t) => addStep(t, null)} />
        </Panel>
      ) : null}
      <AddRow placeholder={hitos.length ? 'Agregar otra etapa del camino' : 'Agregar una etapa (opcional, por ejemplo: Preparar)'} onAdd={(t) => g.store.add({ kind: 'hito', parent_id: goal.id, title: t, data: { orden: hitos.length } })} />
      <AppText variant="caption" muted>
        Toca un paso para darle un día o volverlo hábito.
      </AppText>
      <StepSheet step={editing} g={g} onClose={() => setEditing(null)} />
    </>
  );
}

/** Ideas tipo Notion: una página por meta con bloques de título, texto, lista y tarea. */
function Ideas({ goal, g }: { goal: Entry; g: ReturnType<typeof useGoals> }) {
  const { colors } = useTheme();
  const page = g.pages(goal.id)[0] ?? null;
  const blocks: Block[] = Array.isArray(page?.data.blocks) ? (page!.data.blocks as Block[]) : [];
  const save = (next: Block[]) => (page ? g.store.update(page.id, { data: { ...page.data, blocks: next } }) : g.store.add({ kind: 'pagina', parent_id: goal.id, title: 'Ideas', data: { blocks: next } }));
  const add = (type: Block['type']) => {
    tap();
    save([...blocks, { id: uid(), type, text: '' }]);
  };
  const change = (id: string, patch: Partial<Block>) => save(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: string) => save(blocks.filter((b) => b.id !== id));
  return (
    <Panel>
      {blocks.length ? null : <Empty text="Escribe aquí todo lo que se te ocurra sobre esta meta: ideas, dudas, recursos, listas. Sácalo de la cabeza." />}
      {blocks.map((b) => (
        <View key={b.id} style={styles.block}>
          {b.type === 'todo' ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!b.done }} onPress={() => change(b.id, { done: !b.done })} style={[styles.check, { backgroundColor: b.done ? colors.ok : 'transparent', borderColor: b.done ? colors.ok : colors.line }]}>
              {b.done ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : null}
            </Pressable>
          ) : b.type === 'li' ? (
            <AppText style={{ fontSize: 18, width: 14 }}>•</AppText>
          ) : null}
          <BlockInput block={b} onCommit={(text) => text !== b.text && change(b.id, { text })} />
          <Pressable accessibilityRole="button" accessibilityLabel="Borrar bloque" onPress={() => remove(b.id)} hitSlop={6}>
            <XIcon size={14} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <View style={styles.tools}>
        {(
          [
            ['h', 'Título'],
            ['p', 'Texto'],
            ['li', 'Lista'],
            ['todo', 'Tarea'],
          ] as const
        ).map(([type, label]) => (
          <Pressable key={type} accessibilityRole="button" onPress={() => add(type)} style={[styles.tool, { backgroundColor: colors.surface2 }]}>
            <PlusIcon size={14} color={colors.accent} />
            <AppText variant="label" style={{ fontSize: 13 }}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

function BlockInput({ block, onCommit }: { block: Block; onCommit: (text: string) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState(block.text);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onEndEditing={() => onCommit(text)}
      onBlur={() => onCommit(text)}
      multiline
      autoFocus={!block.text}
      placeholder={block.type === 'h' ? 'Título' : block.type === 'todo' ? 'Algo por hacer' : 'Escribe…'}
      placeholderTextColor={colors.muted}
      style={{
        flex: 1,
        color: block.done ? colors.muted : colors.text,
        fontFamily: block.type === 'h' ? fonts.extrabold : fonts.medium,
        fontSize: block.type === 'h' ? 20 : 15,
        textDecorationLine: block.done ? 'line-through' : 'none',
        paddingVertical: 4,
      }}
    />
  );
}

/** La bitácora: cómo vas, día a día (los días cumplidos cuentan para el desafío). */
function Log({ goal, g, today }: { goal: Entry; g: ReturnType<typeof useGoals>; today: string }) {
  const { colors } = useTheme();
  const logs = [...g.logs(goal.id)].sort((a, b) => (b.day ?? '').localeCompare(a.day ?? ''));
  const did = logs.some((l) => l.day === today);
  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return (
    <Panel>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {strip.map((d) => (
          <View key={d} style={[styles.square, { backgroundColor: logs.some((l) => l.day === d) ? colors.ok : colors.surface2 }]} />
        ))}
      </View>
      <AddRow placeholder={did ? 'Algo más de hoy…' : '¿Cómo te fue hoy? (marca el día)'} onAdd={(t) => g.store.add({ kind: 'avance', parent_id: goal.id, day: today, body: t })} />
      {!did ? <Button label="Hoy cumplí" kind="secondary" onPress={() => g.store.add({ kind: 'avance', parent_id: goal.id, day: today })} /> : null}
      {logs.map((l) => (
        <View key={l.id} style={{ gap: 2 }}>
          <AppText variant="caption" muted>
            {`${l.day?.slice(8, 10)}-${l.day?.slice(5, 7)}`}
          </AppText>
          {l.body ? <AppText style={{ fontSize: 15 }}>{l.body}</AppText> : <AppText variant="caption">Día cumplido ✓</AppText>}
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  goal: { borderRadius: 18, padding: 14, gap: 8, borderLeftWidth: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  mapNode: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mapLabel: { position: 'absolute' },
  mapGoal: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  node: { width: 14, height: 14, borderRadius: 7, marginTop: 14 },
  stem: { width: 2, flex: 1, marginTop: 2 },
  stage: { flex: 1, borderRadius: 18, padding: space.md, gap: 6, marginBottom: 8 },
  block: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  square: { flex: 1, height: 18, borderRadius: 4 },
});
