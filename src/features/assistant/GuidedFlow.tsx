import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { useAgenda } from '@/data/agenda';
import { useEntries, type Entry } from '@/data/entries';
import { useFinance } from '@/data/finance';
import { useJournal } from '@/data/journal';
import { useHabits, useStudies } from '@/data/modules';
import { authErrorMessage } from '@/features/account/authErrors';
import { MODULES, entryTitle, type FieldDef, type KindDef } from '@/features/modules/catalog';
import { buildInput, FieldInput, filled, initialValues } from '@/features/modules/EntrySheet';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { normalizeTime, Sheet } from '@/ui/kit';

// «Anotar con opciones» (usuario, 26-10-2026: «el chatbot solo responde la primera pregunta…
// debería poder agregar información de los módulos basado en opciones estructuradas»). Se elige
// qué anotar y Severa pregunta campo por campo, con opciones para tocar; al final, un resumen y
// guardar. Sirve para todo lo que el intérprete sin IA todavía no entiende de corrido.

type Flow = { id: string; group: string; label: string; kind: KindDef; save: (values: Record<string, unknown>, parent: Entry | null) => Promise<string> };

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MOODS = ['Difícil', 'Regular', 'Bien', 'Muy bien'];
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function useFlows(today: string): { flows: Flow[]; entries: Entry[]; parentsOf: (kind: KindDef, module: string) => Entry[] } {
  const finance = useFinance();
  const agenda = useAgenda(today, today);
  const habits = useHabits(today);
  const journal = useJournal();
  const studies = useStudies();
  const store = useEntries([...Object.keys(MODULES), 'diario']);
  const catId = (name: unknown) => finance.categories.find((c) => c.name === name)?.id ?? null;
  const account = finance.accounts.find((a) => !a.archived)?.id ?? null;

  const k = (kind: string, one: string, fields: FieldDef[]): KindDef => ({ kind, label: one, one, empty: '', fields });
  const core: Flow[] = [
    {
      id: 'gasto',
      group: 'Lo de siempre',
      label: 'Gasto',
      kind: k('gasto', 'Gasto', [
        { key: 'amount', label: '¿Cuánto gastaste?', kind: 'amount', required: true },
        { key: 'title', label: '¿En qué?', kind: 'text', placeholder: 'Almuerzo, luz, bencina…' },
        { key: 'categoria', label: '¿De qué categoría?', kind: 'choice', options: finance.categories.filter((c) => c.kind === 'expense').map((c) => c.name) },
        { key: 'day', label: '¿Qué día?', kind: 'date', initial: 'today' },
      ]),
      save: async (v) => {
        await finance.addMovement({ kind: 'expense', amount: Number(v.amount), occurred_on: String(v.day ?? today), account_id: account, category_id: catId(v.categoria), description: str(v.title) });
        return `Gasto de $${Number(v.amount).toLocaleString('es-CL')} guardado en Finanzas.`;
      },
    },
    {
      id: 'ingreso',
      group: 'Lo de siempre',
      label: 'Ingreso',
      kind: k('ingreso', 'Ingreso', [
        { key: 'amount', label: '¿Cuánto entró?', kind: 'amount', required: true },
        { key: 'title', label: '¿De qué?', kind: 'text', placeholder: 'Sueldo, venta, devolución…' },
        { key: 'categoria', label: '¿De qué categoría?', kind: 'choice', options: finance.categories.filter((c) => c.kind === 'income').map((c) => c.name) },
        { key: 'day', label: '¿Qué día?', kind: 'date', initial: 'today' },
      ]),
      save: async (v) => {
        await finance.addMovement({ kind: 'income', amount: Number(v.amount), occurred_on: String(v.day ?? today), account_id: account, category_id: catId(v.categoria), description: str(v.title) });
        return `Ingreso de $${Number(v.amount).toLocaleString('es-CL')} guardado en Finanzas.`;
      },
    },
    {
      id: 'evento',
      group: 'Lo de siempre',
      label: 'Evento',
      kind: k('evento', 'Evento', [
        { key: 'title', label: '¿Qué es?', kind: 'text', required: true, placeholder: 'Dentista, reunión, cumpleaños…' },
        { key: 'day', label: '¿Qué día?', kind: 'date', required: true, initial: 'today' },
        { key: 'desde', label: '¿A qué hora empieza? (vacío = todo el día)', kind: 'time' },
        { key: 'hasta', label: '¿A qué hora termina?', kind: 'time' },
        { key: 'importancia', label: '¿Qué tan importante es?', kind: 'choice', options: ['Normal', 'Prioridad del día', 'Urgente'], initial: 'Normal' },
        { key: 'lugar', label: '¿Dónde? (opcional)', kind: 'text' },
      ]),
      save: async (v) => {
        const start = normalizeTime(String(v.desde ?? '')) || null;
        const end = start ? normalizeTime(String(v.hasta ?? '')) || null : null;
        await agenda.addEvent({ title: String(v.title), event_date: String(v.day), starts_at: start, ends_at: end && start && end > start ? end : null, layer: 'personal', repeat: 'none', remind_minutes: start ? 60 : null, location: str(v.lugar), notes: null, importance: v.importancia === 'Urgente' ? 2 : v.importancia === 'Prioridad del día' ? 1 : 0, repeat_until: null });
        return `«${v.title}» quedó en tu Calendario.`;
      },
    },
    {
      id: 'tarea',
      group: 'Lo de siempre',
      label: 'Tarea',
      kind: k('tarea', 'Tarea', [
        { key: 'title', label: '¿Qué tienes que hacer?', kind: 'text', required: true },
        { key: 'day', label: '¿Para cuándo? (vacío = sin fecha)', kind: 'date', initial: 'today' },
        { key: 'urgente', label: 'Es urgente', kind: 'check' },
      ]),
      save: async (v) => {
        await agenda.addTask({ title: String(v.title), due_on: str(v.day), due_at: null, urgent: !!v.urgente });
        return `Tarea «${v.title}» guardada.`;
      },
    },
    {
      id: 'habito',
      group: 'Lo de siempre',
      label: 'Sumar a un hábito',
      kind: k('habito', 'Hábito', [
        { key: 'habito', label: '¿Qué hábito?', kind: 'choice', required: true, options: habits.habits.map((h) => h.name) },
        { key: 'veces', label: '¿Cuántas veces?', kind: 'scale', max: 8, initial: '1' },
      ]),
      save: async (v) => {
        const h = habits.habits.find((x) => x.name === v.habito);
        if (!h) throw new Error('Ese hábito ya no está.');
        for (let i = 0; i < (Number(v.veces) || 1); i++) await habits.log(h.id, 1);
        return `${h.name}: +${Number(v.veces) || 1}.`;
      },
    },
    {
      id: 'nuevo_habito',
      group: 'Lo de siempre',
      label: 'Nuevo hábito',
      kind: k('nuevo_habito', 'Nuevo hábito', [
        { key: 'title', label: '¿Qué hábito?', kind: 'text', required: true, placeholder: 'Tomar agua, cigarros…' },
        { key: 'tipo', label: '¿Es para sumar o para bajar?', kind: 'choice', required: true, options: ['Para sumar', 'Para bajar'], initial: 'Para sumar' },
        { key: 'meta', label: '¿Cuántas veces al día? (o el límite, si es para bajar)', kind: 'scale', max: 10, initial: '1' },
      ]),
      save: async (v) => {
        await habits.addHabit({ name: String(v.title), direction: v.tipo === 'Para bajar' ? 'reduce' : 'good', daily_target: Number(v.meta) || 1 });
        return `Hábito «${v.title}» creado (${String(v.tipo).toLowerCase()}).`;
      },
    },
    {
      id: 'diario',
      group: 'Lo de siempre',
      label: 'Diario',
      kind: k('diario', 'Diario', [
        { key: 'animo', label: '¿Cómo estuvo tu día?', kind: 'choice', options: MOODS },
        { key: 'body', label: '¿Qué pasó?', kind: 'long', placeholder: 'Escribe con calma…' },
      ]),
      save: async (v) => {
        const mood = MOODS.indexOf(String(v.animo)) + 1;
        if (mood > 0) await journal.saveDay(today, { mood });
        if (str(v.body)) await store.add({ module: 'diario', kind: 'momento', day: today, body: String(v.body), data: { hora: null } });
        return 'Guardado en tu Diario.';
      },
    },
    {
      id: 'ramo',
      group: 'Lo de siempre',
      label: 'Ramo o curso',
      kind: k('ramo', 'Ramo', [
        { key: 'title', label: '¿Cómo se llama el ramo?', kind: 'text', required: true },
        { key: 'dia', label: '¿Qué día es la clase?', kind: 'choice', options: DAYS },
        { key: 'desde', label: '¿A qué hora empieza?', kind: 'time' },
        { key: 'hasta', label: '¿A qué hora termina?', kind: 'time' },
        { key: 'profesor', label: '¿Quién es el profesor o la profesora?', kind: 'text' },
        { key: 'grupo', label: '¿Los trabajos son en grupo?', kind: 'choice', options: ['En grupo', 'Individuales', 'No hay trabajos'] },
      ]),
      save: async (v) => {
        const id = await studies.addCourse({ name: String(v.title), teacher: str(v.profesor), term: str(v.grupo) });
        const start = normalizeTime(String(v.desde ?? ''));
        const end = normalizeTime(String(v.hasta ?? ''));
        const wd = DAYS.indexOf(String(v.dia)) + 1;
        if (wd > 0 && start) await studies.addBlock({ course_id: id, weekday: wd, starts_at: start, ends_at: end && end > start ? end : start, room: null });
        return `Ramo «${v.title}» guardado en Estudios.`;
      },
    },
  ];

  const generic: Flow[] = Object.values(MODULES).flatMap((m) =>
    m.kinds.map((kind) => ({
      id: `${m.code}:${kind.kind}`,
      group: `${m.space} · ${m.title}`,
      label: kind.one,
      kind,
      save: async (v: Record<string, unknown>, parent: Entry | null) => {
        const input = buildInput(kind, v);
        if (typeof input === 'string') throw new Error(input);
        await store.add({ ...input, module: m.code, parent_id: parent?.id ?? null });
        return `Guardado en ${m.title} · ${kind.label}.`;
      },
    })),
  );

  return {
    flows: [...core, ...generic],
    entries: store.entries,
    parentsOf: (kind, module) => (kind.parent ? store.entries.filter((e) => e.module === module && e.kind === kind.parent) : []),
  };
}

export function GuidedFlow({ visible, today, onClose, onSaved }: { visible: boolean; today: string; onClose: () => void; onSaved: (text: string) => void }) {
  const { colors } = useTheme();
  const { flows, entries, parentsOf } = useFlows(today);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [parent, setParent] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setFlow(null);
    setStep(0);
    setValues({});
    setParent(null);
    setError(null);
    onClose();
  };
  const start = (f: Flow) => {
    tap();
    setFlow(f);
    setStep(0);
    setValues(initialValues(f.kind));
    setParent(null);
    setError(null);
  };

  const groups = [...new Set(flows.map((f) => f.group))];
  const module = flow?.id.includes(':') ? flow.id.split(':')[0] : '';
  const parents = flow ? parentsOf(flow.kind, module) : [];
  const needsParent = !!flow?.kind.parent;
  const fields = flow?.kind.fields ?? [];
  const field = fields[step];
  const atSummary = !!flow && step >= fields.length;

  async function save() {
    if (!flow) return;
    const missing = fields.find((f) => f.required && !filled(values[f.key]));
    if (missing) {
      setStep(fields.indexOf(missing));
      return setError(`Falta: ${missing.label.replace(/\?.*$/, '?')}`);
    }
    setBusy(true);
    setError(null);
    try {
      const text = await flow.save(values, parent);
      tap();
      onSaved(text);
      close();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title={flow ? `Anotar · ${flow.label}` : '¿Qué quieres anotar?'} onClose={close}>
      {!flow ? (
        groups.map((g) => (
          <View key={g} style={{ gap: 6 }}>
            <AppText variant="caption" muted style={styles.kick}>
              {g.toUpperCase()}
            </AppText>
            <View style={styles.wrap}>
              {flows
                .filter((f) => f.group === g)
                .map((f) => (
                  <Pressable key={f.id} accessibilityRole="button" onPress={() => start(f)} style={[styles.option, { backgroundColor: colors.surface2 }]}>
                    <AppText variant="label" style={{ fontSize: 13 }}>
                      {f.label}
                    </AppText>
                  </Pressable>
                ))}
            </View>
          </View>
        ))
      ) : needsParent && !parent ? (
        <View style={{ gap: space.md }}>
          <AppText variant="subtitle">{`¿En qué ${MODULES[module]?.kinds.find((x) => x.kind === flow.kind.parent)?.one.toLowerCase() ?? 'registro'}?`}</AppText>
          {parents.length ? (
            <View style={styles.wrap}>
              {parents.map((p) => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => setParent(p)} style={[styles.option, { backgroundColor: colors.surface2 }]}>
                  <AppText variant="label">{entryTitle(p)}</AppText>
                </Pressable>
              ))}
            </View>
          ) : (
            <Notice tone="mid" text="Todavía no hay ninguno. Créalo primero (está en la misma lista) y vuelve." />
          )}
          <Button label="Elegir otra cosa" kind="link" onPress={() => setFlow(null)} />
        </View>
      ) : atSummary ? (
        <View style={{ gap: space.md }}>
          <AppText variant="subtitle">¿Lo guardo así?</AppText>
          <View style={[styles.summary, { backgroundColor: colors.surface2 }]}>
            {parent ? <AppText variant="caption" muted>{`En: ${entryTitle(parent)}`}</AppText> : null}
            {fields
              .filter((f) => filled(values[f.key]))
              .map((f, i) => (
                <Pressable key={f.key} onPress={() => setStep(fields.indexOf(f))} style={{ gap: 1 }}>
                  <AppText variant="caption" muted>
                    {f.label.replace(/ \(.*\)$/, '')}
                  </AppText>
                  <AppText variant="label" key={i}>
                    {Array.isArray(values[f.key]) ? (values[f.key] as string[]).join(', ') : f.kind === 'amount' ? `$${Number(values[f.key]).toLocaleString('es-CL')}` : f.kind === 'check' ? 'Sí' : String(values[f.key])}
                  </AppText>
                </Pressable>
              ))}
          </View>
          {error ? <Notice text={error} /> : null}
          <Button label="Guardar" loading={busy} onPress={save} />
          <Button label="Cambiar algo" kind="link" onPress={() => setStep(0)} />
        </View>
      ) : field ? (
        <Animated.View key={`${flow.id}:${step}`} entering={FadeInRight.duration(200)} style={{ gap: space.md }}>
          <View style={styles.dots}>
            {fields.map((f, i) => (
              <View key={f.key} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.surface2 }]} />
            ))}
          </View>
          <AppText variant="subtitle">{field.label.replace(/ \(.*\)$/, '')}</AppText>
          {/\(.*\)$/.test(field.label) ? (
            <AppText variant="caption" muted>
              {field.label.match(/\((.*)\)$/)?.[1]}
            </AppText>
          ) : null}
          <FieldInput field={{ ...field, label: '' }} value={values[field.key]} onChange={(v) => setValues((s) => ({ ...s, [field.key]: v }))} ctx={{ parent, entries: entries.filter((e) => e.module === module) }} />
          {error ? <Notice text={error} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label={step ? 'Atrás' : 'Otra cosa'} kind="secondary" onPress={() => (step ? setStep(step - 1) : setFlow(null))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={filled(values[field.key]) ? 'Siguiente' : field.required ? 'Siguiente' : 'Saltar'}
                onPress={() => {
                  if (field.required && !filled(values[field.key])) return setError('Esta la necesito para guardar.');
                  setError(null);
                  setStep(step + 1);
                }}
              />
            </View>
          </View>
        </Animated.View>
      ) : null}
      {!flow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <AppText variant="caption" muted style={{ fontFamily: fonts.medium }}>
            Cada opción pregunta lo que necesita el módulo, paso a paso.
          </AppText>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  kick: { fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  summary: { borderRadius: radius.md, padding: space.md, gap: 8 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 4, borderRadius: 2 },
});
