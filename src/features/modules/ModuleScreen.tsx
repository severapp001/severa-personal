import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ageOn } from '@/core/age';
import { dayKey } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useAuth } from '@/data/auth';
import { useSelfPerson } from '@/data/discovery';
import { useEntries, type Entry, type EntryInput } from '@/data/entries';
import { useFinance } from '@/data/finance';
import { useHabits } from '@/data/modules';
import { entryTitle, groupPeople, type KindDef, type ModuleDef } from '@/features/modules/catalog';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { ModuleWidget } from '@/features/modules/widgets';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { displayAmount } from '@/core/money';
import { AppText, Button, EyeButton, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretLeftIcon, CheckIcon } from '@/ui/icons';
import { Empty, Kicker, Panel, PillTabs, Row } from '@/ui/kit';

// Cuerpo de un módulo del motor común (26-10-2026): lo que hace, lo mínimo para que funcione, su
// resumen (widget), sus pestañas con el nombre completo y, dentro de un registro, lo que vive en él.

const fmt = (day: string | null) => (day ? `${day.slice(8, 10)}-${day.slice(5, 7)}-${day.slice(0, 4)}` : '');

export function ModuleBody({ def, nuevo }: { def: ModuleDef; nuevo?: string }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const store = useEntries(def.code);
  const money = useAmountVisibility();
  const $ = (n: number) => displayAmount(n, money.visible);
  const today = dayKey(new Date());
  const person = useSelfPerson(session?.user.id);
  const age = person?.birthDate ? ageOn(new Date(`${person.birthDate}T12:00:00`)) : null;
  const agenda = useAgenda(today, today);
  const habits = useHabits(today);
  const finance = useFinance();

  const config = store.of('config')[0] ?? null;
  const answer = def.setup ? ((config?.data[def.setup.key] as string | undefined) ?? null) : null;
  const arranged = def.arrange?.(answer);
  const top = (arranged ? arranged.order.map((k) => def.kinds.find((x) => x.kind === k)!).filter(Boolean) : def.kinds.filter((k) => !k.parent)).map((k) => (arranged?.labels?.[k.kind] ? { ...k, label: arranged.labels[k.kind] } : k));
  const [tab, setTab] = useState(top[0].kind);
  const [openId, setOpenId] = useState<string | null>(null);
  const [childTab, setChildTab] = useState<string | null>(null);
  const firstKind = def.kinds.find((k) => k.kind === nuevo && !k.parent);
  const [sheet, setSheet] = useState<SheetTarget | null>(firstKind ? { kind: firstKind } : null);

  const parent = openId ? (store.entries.find((e) => e.id === openId) ?? null) : null;
  const kindOf = (k: string) => def.kinds.find((x) => x.kind === k)!;
  const visible = store.entries.filter((e) => def.kinds.some((k) => k.kind === e.kind));
  const showMoney = def.kinds.some((k) => k.fields.some((f) => f.kind === 'amount'));

  // Lo que pasa al guardar: además del registro, lo que se conecta con otros módulos.
  async function save(input: EntryInput, target: SheetTarget) {
    const k = target.kind;
    if (target.entry) {
      await store.update(target.entry.id, input);
      const eventId = target.entry.data.event_id as string | undefined;
      if (eventId && k.toCalendar && input.day) {
        await agenda.updateEvent(eventId, { title: `${k.toCalendar.prefix ?? ''}${input.title ?? k.one}`.slice(0, 120), event_date: input.day, starts_at: (input.data?.[k.toCalendar.timeKey ?? ''] as string) ?? null });
      }
      return;
    }
    const data = { ...(input.data ?? {}) };
    if (k.toCalendar && input.day) {
      data.event_id = await agenda.addEvent({
        title: `${k.toCalendar.prefix ?? ''}${input.title ?? k.one}`.slice(0, 120),
        event_date: input.day,
        starts_at: (data[k.toCalendar.timeKey ?? ''] as string) ?? null,
        ends_at: null,
        layer: k.toCalendar.layer,
        repeat: 'none',
        remind_minutes: data[k.toCalendar.timeKey ?? ''] ? 60 : null,
        location: (data[k.toCalendar.placeKey ?? ''] as string) ?? null,
        notes: null,
        importance: 1,
        repeat_until: null,
      });
    }
    await store.add({ ...input, data });
    await connect(k, { ...input, data }, target.parent ?? null);
  }

  /** Conexiones con Hábitos y Finanzas al crear un registro. */
  async function connect(k: KindDef, input: EntryInput, group: Entry | null) {
    try {
      const cat = (code: string) => finance.categories.find((c) => (c as { code?: string }).code === code)?.id ?? null;
      if (def.code === 'ejercicio' && k.kind === 'sesion' && (input.day ?? today) === today) {
        const walk = input.title === 'Caminar';
        const h = habits.habits.find((x) => x.template_code === (walk ? 'caminar' : 'entrenar')) ?? habits.habits.find((x) => x.template_code === 'entrenar');
        if (h && habits.countFor(h.id) < (Number(h.daily_target) || 1)) await habits.log(h.id, 1);
      }
      if (def.code === 'gastos_compartidos' && k.kind === 'gasto' && (input.data?.pago ?? 'Yo') === 'Yo' && input.amount) {
        const among = (input.data?.entre as string[] | undefined)?.length ? (input.data?.entre as string[]) : groupPeople(group);
        const share = among.includes('Yo') ? Math.round(Number(input.amount) / among.length) : 0;
        if (share) await finance.addMovement({ kind: 'expense', amount: share, occurred_on: input.day ?? today, account_id: null, category_id: null, description: `Compartido · ${group?.title ?? 'grupo'}: tu parte de ${input.title ?? 'un gasto'}` });
      }
      if (def.code === 'ventas_y_productos' && k.kind === 'venta') {
        const product = store.of('producto').find((p) => p.title === input.title);
        const total = Number(input.amount) || (Number(product?.amount) || 0) * (Number(input.value) || 1);
        if (total) await finance.addMovement({ kind: 'income', amount: total, occurred_on: input.day ?? today, account_id: null, category_id: cat('work_income'), description: `Venta · ${input.title}` });
        if (product && product.value !== null) await store.update(product.id, { value: Math.max(0, Number(product.value) - (Number(input.value) || 1)) });
      }
      if (def.code === 'cobros_y_boletas' && input.done && input.amount) {
        await finance.addMovement({ kind: 'income', amount: Number(input.amount), occurred_on: input.day ?? today, account_id: null, category_id: cat('work_income'), description: `Cobro · ${input.title}` });
      }
    } catch {
      // La conexión es un extra: si falla (espacio sin cargar), el registro igual quedó guardado.
    }
  }

  async function toggleDone(e: Entry, k: KindDef) {
    tap();
    await store.update(e.id, { done: !e.done });
    if (!e.done && def.code === 'cobros_y_boletas' && e.amount) await connect(k, { kind: k.kind, done: true, amount: e.amount, title: e.title, day: today }, null);
  }

  const sub = (e: Entry, k: KindDef) => {
    const parts: string[] = [];
    for (const f of k.fields) {
      if (f.key === 'title' || parts.length >= 3) continue;
      const v = (['body', 'day', 'until', 'amount', 'value'] as const).includes(f.key as 'day') ? (e as unknown as Record<string, unknown>)[f.key] : e.data[f.key];
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (f.key === 'body') continue;
      if (f.kind === 'date') parts.push(f.key === 'until' ? `hasta ${fmt(String(v))}` : fmt(String(v)));
      else if (f.kind === 'amount') parts.push($(Number(v)));
      else if (f.kind === 'scale') parts.push(`${v}/${f.max ?? 5}`);
      else if (f.kind === 'number') parts.push(`${String(v).replace('.', ',')}${f.unit ? ` ${f.unit}` : ''}`);
      else if (Array.isArray(v)) parts.push((v as string[]).join(', '));
      else if (f.kind !== 'check') parts.push(String(v));
    }
    return parts.join(' · ') || undefined;
  };

  const list = (k: KindDef, parentId?: string) => {
    let rows = store.of(k.kind, parentId ?? null);
    if (k.checkable) rows = [...rows].sort((a, b) => Number(a.done) - Number(b.done));
    if (!rows.length) return <Empty text={k.empty} />;
    return rows.map((e) => (
      <Row
        key={e.id}
        title={entryTitle(e, k)}
        sub={sub(e, k)}
        onPress={() => (def.kinds.some((c) => c.parent === k.kind) ? (setOpenId(e.id), setChildTab(null)) : setSheet({ kind: k, entry: e, parent }))}
        onLongPress={() => setSheet({ kind: k, entry: e, parent })}
        right={
          k.checkable ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: e.done }}
              accessibilityLabel={`${k.checkable}: ${entryTitle(e, k)}`}
              hitSlop={8}
              onPress={() => toggleDone(e, k)}
              style={[styles.check, { backgroundColor: e.done ? colors.accent : 'transparent', borderColor: e.done ? colors.accent : colors.line }]}
            >
              {e.done ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
            </Pressable>
          ) : def.kinds.some((c) => c.parent === k.kind) ? (
            <AppText variant="caption" color={colors.accent}>
              Abrir
            </AppText>
          ) : undefined
        }
      />
    ));
  };

  const widget = (p: Entry | null) =>
    def.widget ? (
      <ModuleWidget
        def={def}
        store={store}
        today={today}
        age={age}
        parent={p}
        money={$}
        onAdd={(kind) => setSheet({ kind: kindOf(kind), parent: p })}
        onOpen={(e) => setSheet({ kind: kindOf(e.kind), entry: e, parent: p })}
        answer={answer}
      />
    ) : null;

  // ─── Dentro de un registro (un grupo, un viaje, un cliente) ──────────────────
  if (parent) {
    const pk = kindOf(parent.kind);
    const kids = def.kinds.filter((k) => k.parent === parent.kind);
    const current = kids.find((k) => k.kind === childTab) ?? kids[0];
    return (
      <Screen>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => setOpenId(null)} style={[styles.back, { backgroundColor: colors.surface }]}>
            <CaretLeftIcon size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="caption" muted style={{ letterSpacing: 1.4 }}>
              {`${def.title.toUpperCase()} · ${pk.one.toUpperCase()}`}
            </AppText>
            <AppText variant="title" numberOfLines={1}>
              {entryTitle(parent, pk)}
            </AppText>
          </View>
          <AppText variant="label" color={colors.accent} onPress={() => setSheet({ kind: pk, entry: parent })}>
            Editar
          </AppText>
        </View>
        {widget(parent)}
        <PillTabs options={kids.map((k) => ({ value: k.kind, label: k.label }))} value={current.kind} onChange={setChildTab} />
        <Panel>
          <Kicker>{current.label}</Kicker>
          {list(current, parent.id)}
          <Button label={`+ ${current.one}`} onPress={() => setSheet({ kind: current, parent })} />
        </Panel>
        <EntrySheet target={sheet} ctx={{ parent, entries: store.entries }} onClose={() => setSheet(null)} onSave={save} onRemove={(e) => store.remove(e.id)} />
      </Screen>
    );
  }

  const current = top.find((k) => k.kind === tab) ?? top[0];
  return (
    <Screen>
      <ModuleHeader kicker={def.space} title={def.title} right={showMoney ? <EyeButton visible={money.visible} onPress={money.toggle} /> : undefined} />
      {def.sensitive ? <Notice tone="mid" text="Datos sensibles: se guardan cifrados en tu teléfono y solo tú los ves." /> : null}
      {def.setup ? (
        <Panel>
          <Kicker>{def.setup.question}</Kicker>
          <View style={{ gap: 6 }}>
            {def.setup.options.map((o) => (
              <Pressable
                key={o}
                accessibilityRole="radio"
                accessibilityState={{ checked: answer === o }}
                onPress={() => {
                  tap();
                  if (config) store.update(config.id, { data: { ...config.data, [def.setup!.key]: o } });
                  else store.add({ kind: 'config', data: { [def.setup!.key]: o } });
                  setTab(def.arrange?.(o).order[0] ?? tab);
                }}
                style={[styles.setup, { backgroundColor: answer === o ? colors.accentSoft : colors.surface2 }]}
              >
                <AppText variant="label" color={answer === o ? colors.accent : colors.text}>
                  {o}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Panel>
      ) : null}
      {!visible.length ? (
        <Panel>
          <Kicker color={colors.accent}>Para que funcione</Kicker>
          <AppText>{def.intro}</AppText>
          <AppText variant="label">{`Lo mínimo: ${def.minimum}`}</AppText>
          <AppText variant="caption" muted>{`Se conecta con: ${def.connects}`}</AppText>
          <Button label={`+ ${top[0].one}`} onPress={() => setSheet({ kind: top[0] })} />
        </Panel>
      ) : null}
      {widget(null)}
      {top.length > 1 ? <PillTabs options={top.map((k) => ({ value: k.kind, label: k.label }))} value={current.kind} onChange={setTab} /> : null}
      <Panel>
        <View style={styles.listHead}>
          <Kicker>{current.label}</Kicker>
          <AppText variant="label" color={colors.accent} onPress={() => setSheet({ kind: current })}>
            {`+ ${current.one}`}
          </AppText>
        </View>
        {list(current)}
      </Panel>
      {def.note ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          {def.note}
        </AppText>
      ) : null}
      {visible.length ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          {`Se conecta con: ${def.connects}`}
        </AppText>
      ) : null}
      <EntrySheet target={sheet} ctx={{ parent: null, entries: store.entries }} onClose={() => setSheet(null)} onSave={save} onRemove={(e) => store.remove(e.id)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setup: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
});
