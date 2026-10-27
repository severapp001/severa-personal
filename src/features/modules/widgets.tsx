import { Pressable, StyleSheet, View } from 'react-native';

import { formatCLP } from '@/core/money';
import { bmi, dailyCalories, daysBetween, expiry, plusDays, predictCycle, settle, sharedBalances, weekMinutes, type SharedExpense, type SharedPayment } from '@/core/modules';
import type { Entries, Entry } from '@/data/entries';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';
import { BarRow, Empty, Kicker, Panel, Row } from '@/ui/kit';
import { groupPeople, type ModuleDef } from './catalog';

// Lo que se ve arriba de cada módulo del motor común: el resumen que hace útil lo registrado.

export type WidgetProps = {
  def: ModuleDef;
  store: Entries;
  today: string;
  age: number | null;
  parent: Entry | null;
  money: (n: number) => string;
  onAdd: (kind: string) => void;
  onOpen: (e: Entry) => void;
  /** La respuesta a la pregunta inicial del módulo (Íntimo y ciclo: quién lo usa). */
  answer?: string | null;
};

const fmt = (day: string | null) => (day ? `${day.slice(8, 10)}-${day.slice(5, 7)}` : '');
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function ModuleWidget(p: WidgetProps) {
  switch (p.def.widget) {
    case 'goals':
      return <Goals {...p} />;
    case 'routine':
      return <Routine {...p} />;
    case 'therapy':
      return <Therapy {...p} />;
    case 'meds':
      return <Meds {...p} />;
    case 'exercise':
      return <Exercise {...p} />;
    case 'imc':
      return <Imc {...p} />;
    case 'expiry':
      return <Expiry {...p} />;
    case 'shared':
      return <Shared {...p} />;
    case 'trip':
      return <Trip {...p} />;
    case 'timeline':
      return <Timeline {...p} />;
    case 'swot':
      return <Swot {...p} />;
    case 'cycle':
      return <Cycle {...p} />;
    case 'cobros':
      return <Cobros {...p} />;
    case 'clients':
      return <Clients {...p} />;
    case 'orders':
      return <Orders {...p} />;
    case 'shifts':
      return <Shifts {...p} />;
    case 'sales':
      return <Sales {...p} />;
    default:
      return null;
  }
}

// ─── Tu rutina: los bloques fijos de hoy y de mañana (tarjeta de Inicio, 27-10-2026) ─
const WEEKDAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
function Routine({ store, today }: WidgetProps) {
  const on = (d: string) =>
    store
      .of('bloque')
      .filter((b) => Array.isArray(b.data.dias) && (b.data.dias as string[]).includes(WEEKDAY[new Date(`${d}T12:00:00`).getDay()]))
      .sort((a, b) => String(a.data.desde ?? '').localeCompare(String(b.data.desde ?? '')));
  const line = (b: Entry) => `${b.data.desde ? `${b.data.desde}${b.data.hasta ? `–${b.data.hasta}` : ''} · ` : ''}${b.title}`;
  const days: [string, Entry[]][] = [
    ['Hoy', on(today)],
    ['Mañana', on(plusDays(today, 1))],
  ];
  return (
    <Panel>
      {days.map(([label, list]) => (
        <View key={label} style={{ gap: 4 }}>
          <Kicker>{label}</Kicker>
          {list.length ? (
            list.map((b) => (
              <AppText key={b.id} variant="label" style={{ fontSize: 15 }}>
                {line(b)}
              </AppText>
            ))
          ) : (
            <AppText variant="caption" muted>
              Sin bloques fijos.
            </AppText>
          )}
        </View>
      ))}
    </Panel>
  );
}

// ─── Metas y desafíos: avance, racha del desafío y lo que Severa sabe que ayuda ─
const HELPS: Record<string, string[]> = {
  Cuerpo: ['Ejercicio: anota cada sesión y mira tu semana frente a los 150 minutos.', 'Hábitos: cuenta agua, sueño o caminar para ver tu constancia.', 'Alimentación: anota tus comidas y tu peso.'],
  Mente: ['Diario: cierra el día y mira qué se repite en tus días buenos.', 'Estudios: tus ramos y pruebas con la nota que necesitas.', 'Hábitos: leer o estudiar unos minutos cada día.'],
  Alma: ['Biblia: el Pan de vida de cada día y tu racha.', 'Gratitud: una cosa buena del día.', 'Hábitos: orar o meditar, y FODA para conocerte.'],
};
function Goals({ store, today, parent, onAdd }: WidgetProps) {
  const { colors } = useTheme();
  if (!parent) {
    const open = store.of('meta').filter((g) => !g.done);
    if (!open.length) return null;
    return (
      <Panel>
        <Kicker>{`${open.length} en curso`}</Kicker>
        {open.slice(0, 4).map((g) => {
          const steps = store.of('paso', g.id);
          const pct = steps.length ? steps.filter((x) => x.done).length / steps.length : 0;
          return <BarRow key={g.id} label={`${g.title} · ${String(g.data.parte ?? '')}`} value={pct} max={1} text={`${Math.round(pct * 100)} %`} tone="ok" />;
        })}
      </Panel>
    );
  }
  const steps = store.of('paso', parent.id);
  const logs = store.of('avance', parent.id);
  const challenge = /(\d+) días/.exec(String(parent.data.tipo ?? ''));
  const goal = challenge ? Number(challenge[1]) : 0;
  const daysDone = new Set(logs.map((l) => l.day)).size;
  const left = parent.until ? daysBetween(today, parent.until) : null;
  return (
    <Panel>
      <Kicker>{[parent.data.parte, parent.data.tipo, left !== null ? (left >= 0 ? `quedan ${left} días` : 'plazo cumplido') : null].filter(Boolean).join(' · ')}</Kicker>
      {parent.body ? <AppText style={{ fontSize: 15 }}>{`«${parent.body}»`}</AppText> : null}
      {goal ? <BarRow label="Desafío" value={daysDone} max={goal} text={`${daysDone} de ${goal} días`} tone="ok" /> : null}
      {steps.length ? <BarRow label="Pasos" value={steps.filter((x) => x.done).length} max={steps.length} text={`${steps.filter((x) => x.done).length} de ${steps.length}`} /> : null}
      <Kicker>Lo que Severa sabe que te ayuda</Kicker>
      {(HELPS[String(parent.data.parte)] ?? HELPS.Cuerpo).map((t) => (
        <AppText key={t} variant="caption">{`• ${t}`}</AppText>
      ))}
      {goal ? <Button label="Hoy cumplí" kind="secondary" onPress={() => onAdd('avance')} /> : null}
      {goal && daysDone >= goal ? (
        <AppText variant="label" color={colors.ok}>
          ¡Desafío cumplido! Márcalo como logrado.
        </AppText>
      ) : null}
    </Panel>
  );
}

// ─── Terapia: qué necesitas ahora y a quién llamar ───────────────────────────
const NEEDS: [string, string][] = [
  ['pensamiento', 'Me siento mal por algo'],
  ['decision', 'Tengo que decidir'],
  ['ahora', 'Perdí el foco'],
  ['opuesto', 'Tengo una idea negativa'],
];
function Therapy({ store, onAdd }: WidgetProps) {
  const { colors } = useTheme();
  const thoughts = store.of('pensamiento').filter((t) => t.value && t.data.despues);
  const relief = thoughts.length ? thoughts.reduce((s, t) => s + (Number(t.value) - Number(t.data.despues)), 0) / thoughts.length : null;
  return (
    <Panel>
      <Kicker>¿Qué necesitas ahora?</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {NEEDS.map(([k, l]) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => onAdd(k)} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
            <AppText variant="label" style={{ fontSize: 13 }}>
              {l}
            </AppText>
          </Pressable>
        ))}
      </View>
      {relief !== null ? <AppText variant="caption" muted>{`Después de escribir, la intensidad baja en promedio ${relief.toFixed(1).replace('.', ',')} puntos.`}</AppText> : null}
      <AppText variant="caption" color={colors.bad}>
        ¿En crisis? Llama al *4141 (prevención del suicidio, gratis, 24 horas) o al 131 (SAMU).
      </AppText>
    </Panel>
  );
}

// ─── Salud: los remedios de hoy, con una casilla por toma ────────────────────
function Meds({ store, today, onAdd }: WidgetProps) {
  const { colors } = useTheme();
  const active = store.of('remedio').filter((r) => (!r.day || r.day <= today) && (!r.until || r.until >= today));
  const takes = store.of('toma').filter((t) => t.day === today);
  if (!active.length) return null;
  const total = active.reduce((s, r) => s + (Number(r.data.veces) || 1), 0);
  const done = takes.length;
  return (
    <Panel>
      <Kicker>{`Remedios de hoy · ${Math.min(done, total)} de ${total}`}</Kicker>
      {active.map((r) => {
        const times = Number(r.data.veces) || 1;
        const mine = takes.filter((t) => t.parent_id === r.id);
        return (
          <View key={r.id} style={styles.line}>
            <View style={{ flex: 1 }}>
              <AppText variant="label">{r.title}</AppText>
              <AppText variant="caption" muted>
                {[r.data.dosis, r.data.hora ? `desde las ${r.data.hora}` : null, r.data.veces === 'Cuando lo necesito' ? 'cuando lo necesites' : null].filter(Boolean).join(' · ') || 'Toca cuando lo tomes'}
              </AppText>
            </View>
            {Array.from({ length: r.data.veces === 'Cuando lo necesito' ? 1 : times }, (_, i) => {
              const take = mine[i];
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!take }}
                  accessibilityLabel={`Toma ${i + 1} de ${r.title}`}
                  onPress={() => {
                    tap();
                    if (take) store.remove(take.id);
                    else store.add({ kind: 'toma', parent_id: r.id, day: today, title: r.title, done: true });
                  }}
                  style={[styles.check, { backgroundColor: take ? colors.ok : 'transparent', borderColor: take ? colors.ok : colors.line }]}
                >
                  {take ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <AppText variant="caption" muted onPress={() => onAdd('remedio')}>
        Se marca cada toma. Lo que tomas cuenta en Prioridades.
      </AppText>
    </Panel>
  );
}

// ─── Ejercicio: la semana frente a 150 minutos ───────────────────────────────
function Exercise({ store, today, onAdd }: WidgetProps) {
  const { colors } = useTheme();
  const w = weekMinutes(store.of('sesion'), today);
  const max = Math.max(60, ...w.days.map((d) => d.minutes));
  const goal = 150;
  return (
    <Panel>
      <Kicker>{`Tu semana · ${w.total} de ${goal} min`}</Kicker>
      <View style={styles.bars}>
        {w.days.map((d, i) => (
          <View key={d.day} style={styles.barCol}>
            <View style={[styles.barTrack, { backgroundColor: colors.surface2 }]}>
              <View style={{ height: `${(d.minutes / max) * 100}%`, backgroundColor: d.day === today ? colors.accent : colors.accent2, borderRadius: 6 }} />
            </View>
            <AppText variant="caption" muted style={{ fontSize: 11 }} color={d.day === today ? colors.accent : colors.muted}>
              {DOW[i]}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" muted>
        {w.total >= goal ? '¡Cumpliste los 150 minutos de la semana que recomienda la OMS!' : `Te faltan ${goal - w.total} minutos para los 150 de la semana (recomendación de la OMS para adultos).`}
      </AppText>
      <Button label="+ Sesión de hoy" onPress={() => onAdd('sesion')} />
    </Panel>
  );
}

// ─── Alimentación: IMC, calorías y peso ──────────────────────────────────────
function Imc({ store, age, onAdd }: WidgetProps) {
  const { colors } = useTheme();
  const list = store.of('medida').filter((m) => m.value);
  const last = list[0];
  if (!last) {
    return (
      <Panel>
        <Kicker>Tu IMC</Kicker>
        <AppText variant="caption" muted>
          Con tu peso y tu estatura, Severa calcula tu IMC (referencia de la OMS) y las calorías que gastas al día.
        </AppText>
        <Button label="Anotar peso y estatura" onPress={() => onAdd('medida')} />
      </Panel>
    );
  }
  const weight = Number(last.value);
  const height = Number(last.data.estatura);
  const b = bmi(weight, height);
  const cal = dailyCalories(weight, height, age, (last.data.sexo as string) ?? null, (last.data.actividad as string) ?? null);
  const prev = list[1];
  const tone = b ? (b.tone === 'ok' ? colors.ok : b.tone === 'mid' ? colors.mid : colors.bad) : colors.text;
  return (
    <Panel>
      <Kicker>{`Tu IMC · ${fmt(last.day)}`}</Kicker>
      <View style={styles.line}>
        <AppText style={{ fontFamily: fonts.extrabold, fontSize: 40 }} color={tone}>
          {b ? String(b.value).replace('.', ',') : '—'}
        </AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="label" color={tone}>
            {b?.label ?? 'Revisa la estatura'}
          </AppText>
          <AppText variant="caption" muted>{`${String(weight).replace('.', ',')} kg · ${height} cm${prev?.value ? ` · ${weight - Number(prev.value) > 0 ? '+' : ''}${(weight - Number(prev.value)).toFixed(1).replace('.', ',')} kg desde el ${fmt(prev.day)}` : ''}`}</AppText>
        </View>
      </View>
      <AppText variant="caption" muted>
        Normal según la OMS: de 18,5 a 24,9.
      </AppText>
      {cal ? (
        <AppText variant="body" style={{ fontSize: 15 }}>{`Gastas cerca de ${formatCLP(cal.total).replace('$', '')} calorías al día (${formatCLP(cal.basal).replace('$', '')} en reposo).`}</AppText>
      ) : (
        <AppText variant="caption" muted>
          {age ? 'Anota tu sexo en la medición para estimar las calorías del día.' : 'Con tu fecha de nacimiento en el Perfil, Severa estima las calorías del día.'}
        </AppText>
      )}
    </Panel>
  );
}

// ─── Documentos: lo que vence primero ────────────────────────────────────────
function Expiry({ store, today, onOpen }: WidgetProps) {
  const { colors } = useTheme();
  const soon = store
    .of('documento')
    .map((d) => ({ d, x: expiry(d.until, today) }))
    .filter((r) => r.x && r.x.days <= 60)
    .sort((a, b) => a.x!.days - b.x!.days);
  if (!soon.length) return null;
  return (
    <Panel>
      <Kicker>Vence pronto</Kicker>
      {soon.map(({ d, x }) => (
        <Row
          key={d.id}
          title={d.title ?? String(d.data.tipo ?? 'Documento')}
          sub={String(d.data.tipo ?? '')}
          onPress={() => onOpen(d)}
          right={
            <AppText variant="label" color={x!.tone === 'bad' ? colors.bad : colors.mid}>
              {x!.label}
            </AppText>
          }
        />
      ))}
    </Panel>
  );
}

// ─── Gastos compartidos: saldos del grupo ────────────────────────────────────
function groupMath(store: Entries, group: Entry) {
  const people = groupPeople(group);
  const expenses: SharedExpense[] = store.of('gasto', group.id).map((g) => ({ amount: Number(g.amount) || 0, payer: String(g.data.pago || 'Yo'), among: Array.isArray(g.data.entre) ? (g.data.entre as string[]) : [] }));
  const payments: SharedPayment[] = store.of('abono', group.id).map((a) => ({ from: String(a.data.de ?? ''), to: String(a.data.a ?? ''), amount: Number(a.amount) || 0 }));
  const balances = sharedBalances(people, expenses, payments);
  return { people, balances, total: expenses.reduce((s, e) => s + e.amount, 0), moves: settle(balances) };
}

function Shared({ store, parent, money }: WidgetProps) {
  const { colors } = useTheme();
  if (!parent) {
    const groups = store.of('grupo');
    if (!groups.length) return null;
    const mine = groups.reduce((s, g) => s + (groupMath(store, g).balances.Yo ?? 0), 0);
    return (
      <Panel>
        <Kicker>En todos tus grupos</Kicker>
        <AppText variant="title" color={mine < 0 ? colors.bad : mine > 0 ? colors.ok : colors.text}>
          {mine === 0 ? 'Estás a mano' : mine > 0 ? `Te deben ${money(mine)}` : `Debes ${money(-mine)}`}
        </AppText>
        <AppText variant="caption" muted>
          Toca un grupo para ver quién le debe a quién.
        </AppText>
      </Panel>
    );
  }
  const m = groupMath(store, parent);
  return (
    <Panel>
      <Kicker>{`Gastado en el grupo · ${money(m.total)}`}</Kicker>
      {m.people.map((p) => {
        const v = m.balances[p] ?? 0;
        return (
          <View key={p} style={styles.line}>
            <AppText variant="label" style={{ flex: 1 }}>
              {p === 'Yo' ? 'Tú' : p}
            </AppText>
            <AppText variant="label" color={v < 0 ? colors.bad : v > 0 ? colors.ok : colors.muted}>
              {v === 0 ? 'a mano' : v > 0 ? `le deben ${money(v)}` : `debe ${money(-v)}`}
            </AppText>
          </View>
        );
      })}
      {m.moves.length ? (
        <>
          <Kicker>Para quedar a mano</Kicker>
          {m.moves.map((x, i) => (
            <AppText key={i} variant="body" style={{ fontSize: 15 }}>{`• ${x.from === 'Yo' ? 'Tú le pagas' : `${x.from} le paga`} a ${x.to === 'Yo' ? 'ti' : x.to}: ${money(x.amount)}`}</AppText>
          ))}
        </>
      ) : null}
    </Panel>
  );
}

// ─── Viajes: el próximo y, dentro de uno, el presupuesto ─────────────────────
function Trip({ store, today, parent, money }: WidgetProps) {
  const { colors } = useTheme();
  if (!parent) {
    const next = store
      .of('viaje')
      .filter((v) => v.day && (v.until ?? v.day) >= today)
      .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''))[0];
    if (!next) return null;
    const days = daysBetween(today, next.day!);
    return (
      <Panel>
        <Kicker>{days > 0 ? 'Tu próximo viaje' : 'Estás de viaje'}</Kicker>
        <AppText variant="title">{next.title}</AppText>
        <AppText variant="caption" muted>
          {days > 0 ? `Faltan ${days} ${days === 1 ? 'día' : 'días'} · ${fmt(next.day)}${next.until ? ` al ${fmt(next.until)}` : ''}` : `Hasta el ${fmt(next.until ?? next.day)}`}
        </AppText>
      </Panel>
    );
  }
  const spent = store.of('gasto_viaje', parent.id).reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const budget = Number(parent.amount) || 0;
  return (
    <Panel>
      <Kicker>{`${fmt(parent.day)}${parent.until ? ` al ${fmt(parent.until)}` : ''}`}</Kicker>
      {budget ? (
        <BarRow label="Gastado del presupuesto" value={spent} max={budget} text={`${money(spent)} de ${money(budget)}`} tone={spent > budget ? 'bad' : 'data'} />
      ) : (
        <AppText variant="label">{`Gastado: ${money(spent)}`}</AppText>
      )}
      {budget && spent > budget ? (
        <AppText variant="caption" color={colors.bad}>
          {`Te pasaste por ${money(spent - budget)}.`}
        </AppText>
      ) : null}
    </Panel>
  );
}

// ─── Biografía: la línea de tu vida ──────────────────────────────────────────
const STAGES = ['Infancia', 'Adolescencia', 'Juventud', 'Adultez', 'Este año'];
function Timeline({ store, onOpen }: WidgetProps) {
  const { colors } = useTheme();
  const list = [...store.of('recuerdo')].sort((a, b) => {
    if (a.day && b.day) return a.day.localeCompare(b.day);
    return STAGES.indexOf(String(a.data.etapa ?? 'Este año')) - STAGES.indexOf(String(b.data.etapa ?? 'Este año'));
  });
  if (list.length < 2) return null;
  return (
    <Panel>
      <Kicker>Tu línea de tiempo</Kicker>
      {list.map((r, i) => (
        <Pressable key={r.id} onPress={() => onOpen(r)} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center', width: 14 }}>
            <View style={[styles.node, { backgroundColor: colors.accent }]} />
            {i < list.length - 1 ? <View style={[styles.stem, { backgroundColor: colors.line }]} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: 12 }}>
            <AppText variant="caption" muted>
              {[r.day ? r.day.slice(0, 4) : null, r.data.etapa, r.data.lugar].filter(Boolean).join(' · ')}
            </AppText>
            <AppText variant="label">{r.title}</AppText>
          </View>
        </Pressable>
      ))}
    </Panel>
  );
}

// ─── FODA: los cuatro cuadrantes y qué hacer ─────────────────────────────────
const QUADS = [
  { name: 'Fortaleza', plural: 'Fortalezas', tone: 'ok' },
  { name: 'Oportunidad', plural: 'Oportunidades', tone: 'data' },
  { name: 'Debilidad', plural: 'Debilidades', tone: 'mid' },
  { name: 'Amenaza', plural: 'Amenazas', tone: 'bad' },
] as const;
function Swot({ store, onOpen }: WidgetProps) {
  const { colors } = useTheme();
  const items = store.of('item');
  if (!items.length) return null;
  const by = (q: string) => items.filter((i) => i.data.cuadrante === q).sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const color = { ok: colors.ok, data: colors.accent2, mid: colors.mid, bad: colors.bad };
  const top = (q: string) => by(q)[0]?.title;
  const ideas = [
    top('Fortaleza') && top('Oportunidad') ? `Usa «${top('Fortaleza')}» para aprovechar «${top('Oportunidad')}».` : null,
    top('Fortaleza') && top('Amenaza') ? `Apóyate en «${top('Fortaleza')}» frente a «${top('Amenaza')}».` : null,
    top('Debilidad') && top('Oportunidad') ? `«${top('Oportunidad')}» te puede ayudar a mejorar «${top('Debilidad')}».` : null,
  ].filter(Boolean) as string[];
  return (
    <Panel>
      <View style={styles.quads}>
        {QUADS.map((q) => (
          <View key={q.name} style={[styles.quad, { backgroundColor: colors.surface2, borderColor: color[q.tone] }]}>
            <AppText variant="caption" color={color[q.tone]} style={{ fontFamily: fonts.extrabold }}>
              {`${q.plural.toUpperCase()} · ${by(q.name).length}`}
            </AppText>
            {by(q.name)
              .slice(0, 3)
              .map((i) => (
                <AppText key={i.id} variant="caption" numberOfLines={1} onPress={() => onOpen(i)}>
                  {`• ${i.title}`}
                </AppText>
              ))}
          </View>
        ))}
      </View>
      {ideas.length ? (
        <>
          <Kicker>Qué hacer</Kicker>
          {ideas.map((t) => (
            <AppText key={t} variant="body" style={{ fontSize: 15 }}>
              {`• ${t}`}
            </AppText>
          ))}
        </>
      ) : (
        <AppText variant="caption" muted>
          Con una fortaleza y una oportunidad, Severa te sugiere cómo combinarlas.
        </AppText>
      )}
    </Panel>
  );
}

// ─── Íntimo y ciclo: el próximo período ──────────────────────────────────────
// Cómo acompañar a la pareja en cada fase: sugerencias generales, sin suponer cómo se siente ella.
const PARTNER_TIPS: Record<string, string[]> = {
  menstrual: ['Pregúntale cómo se siente y qué necesita; no minimices el dolor.', 'Ofrece calor, una infusión o que descanse; toma tú más tareas de la casa.'],
  folicular: ['Muchas personas sienten más energía en estos días: buen momento para planes juntos.'],
  ovulacion: ['Es la ventana fértil estimada. Si buscan o evitan un embarazo, no usen esto como método.'],
  lutea: ['Puede haber cansancio, hinchazón o cambios de ánimo. Más paciencia, menos carga; pregunta en vez de suponer.'],
};
function Cycle({ store, today, onAdd, answer }: WidgetProps) {
  const { colors } = useTheme();
  const p = predictCycle(store.of('periodo').map((x) => x.day).filter((d): d is string => !!d), today);
  if (answer === 'Soy hombre') return null;
  if (!p) return null;
  const partner = answer === 'Soy hombre y quiero acompañar el ciclo de mi pareja';
  const fertile = today >= p.fertileFrom && today <= p.fertileTo;
  const phase = p.dayOfCycle <= 5 ? 'menstrual' : fertile ? 'ovulacion' : today < p.fertileFrom ? 'folicular' : 'lutea';
  if (partner) {
    return (
      <Panel>
        <Kicker>{`Su ciclo: día ${p.dayOfCycle} · promedio ${p.average} días`}</Kicker>
        <AppText variant="title">{p.daysToNext === 0 ? 'Su período podría llegar hoy' : `Su próximo período, en ${p.daysToNext} ${p.daysToNext === 1 ? 'día' : 'días'}`}</AppText>
        <Kicker color={colors.accent}>Cómo acompañarla ahora</Kicker>
        {PARTNER_TIPS[phase].map((tip) => (
          <AppText key={tip} variant="body" style={{ fontSize: 15 }}>{`• ${tip}`}</AppText>
        ))}
        <AppText variant="caption" muted>
          Cada persona vive su ciclo distinto: lo mejor es conversarlo con ella.
        </AppText>
        <Button label="Le llegó el período" kind="secondary" onPress={() => onAdd('periodo')} />
      </Panel>
    );
  }
  return (
    <Panel>
      <Kicker>{`Día ${p.dayOfCycle} de tu ciclo · promedio ${p.average} días`}</Kicker>
      <AppText variant="title">{p.daysToNext === 0 ? 'Tu período podría llegar hoy' : `Próximo período en ${p.daysToNext} ${p.daysToNext === 1 ? 'día' : 'días'}`}</AppText>
      <AppText variant="caption" muted>{`Cerca del ${fmt(p.next)}. Ventana fértil estimada: ${fmt(p.fertileFrom)} al ${fmt(p.fertileTo)}.`}</AppText>
      {fertile ? (
        <AppText variant="label" color={colors.mid}>
          Hoy estás en tu ventana fértil estimada.
        </AppText>
      ) : null}
      {p.known < 2 ? (
        <AppText variant="caption" muted>
          Con dos o tres períodos más, la estimación se ajusta a tu ciclo.
        </AppText>
      ) : null}
      <Button label="Empezó mi período" kind="secondary" onPress={() => onAdd('periodo')} />
    </Panel>
  );
}

// ─── Cobros: lo que te deben ─────────────────────────────────────────────────
function Cobros({ store, today, money }: WidgetProps) {
  const { colors } = useTheme();
  const list = store.of('cobro');
  if (!list.length) return null;
  const pending = list.filter((c) => !c.done).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const month = list.filter((c) => c.done && c.day?.slice(0, 7) === today.slice(0, 7));
  const paid = month.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const fees = month.filter((c) => c.data.forma === 'Boleta de honorarios').reduce((s, c) => s + (Number(c.amount) || 0), 0);
  return (
    <Panel>
      <Kicker>Este mes</Kicker>
      <View style={styles.line}>
        <AppText variant="caption" muted style={{ flex: 1 }}>
          Cobrado
        </AppText>
        <AppText variant="subtitle" color={colors.ok}>
          {money(paid)}
        </AppText>
      </View>
      <View style={styles.line}>
        <AppText variant="caption" muted style={{ flex: 1 }}>
          Por cobrar
        </AppText>
        <AppText variant="subtitle" color={pending ? colors.mid : colors.muted}>
          {money(pending)}
        </AppText>
      </View>
      {fees ? <AppText variant="caption" muted>{`Retención de tus boletas (15,25 %): ${money(Math.round(fees * 0.1525))}. Te llega líquido ${money(Math.round(fees * 0.8475))}.`}</AppText> : null}
    </Panel>
  );
}

// ─── Clientes: saldos de fiados ──────────────────────────────────────────────
const balanceOf = (store: Entries, c: Entry) =>
  store.of('cuenta', c.id).reduce((s, x) => s + (x.data.tipo === 'Abono' ? -1 : 1) * (Number(x.amount) || 0), 0);
function Clients({ store, parent, money }: WidgetProps) {
  const { colors } = useTheme();
  if (parent) {
    const b = balanceOf(store, parent);
    return (
      <Panel>
        <Kicker>Saldo</Kicker>
        <AppText variant="title" color={b > 0 ? colors.mid : colors.ok}>
          {b > 0 ? `Te debe ${money(b)}` : 'Al día'}
        </AppText>
        {parent.data.telefono ? <AppText variant="caption" muted>{`Teléfono: ${parent.data.telefono}`}</AppText> : null}
      </Panel>
    );
  }
  const total = store.of('cliente').reduce((s, c) => s + Math.max(0, balanceOf(store, c)), 0);
  if (!total) return null;
  return (
    <Panel>
      <Kicker>Fiado por cobrar</Kicker>
      <AppText variant="title" color={colors.mid}>
        {money(total)}
      </AppText>
    </Panel>
  );
}

// ─── Pedidos: entregas y margen ──────────────────────────────────────────────
function Orders({ store, today, money }: WidgetProps) {
  const { colors } = useTheme();
  const open = store.of('pedido').filter((o) => !o.done);
  if (!store.of('pedido').length) return null;
  const margin = store.of('pedido').reduce((s, o) => s + (Number(o.amount) || 0) - (Number(o.data.costo) || 0), 0);
  const next = [...open].filter((o) => o.day).sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''))[0];
  return (
    <Panel>
      <Kicker>{`${open.length} por entregar`}</Kicker>
      {next ? <AppText variant="label">{`Próxima entrega: ${next.title} · ${next.day === today ? 'hoy' : fmt(next.day)}`}</AppText> : null}
      <AppText variant="caption" color={margin >= 0 ? colors.ok : colors.bad}>{`Ganancia de todos tus pedidos (precio − costo): ${money(margin)}`}</AppText>
    </Panel>
  );
}

// ─── Turnos: qué te toca ─────────────────────────────────────────────────────
function Shifts({ store, today }: WidgetProps) {
  const { colors } = useTheme();
  const list = store.of('turno');
  if (!list.length) return null;
  const on = (d: string) => list.find((t) => t.day === d);
  const now = on(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) + i, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  return (
    <Panel>
      <Kicker>Hoy te toca</Kicker>
      <AppText variant="title">{now ? String(now.data.tipo) : 'Nada anotado'}</AppText>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((d) => (
          <View key={d} style={[styles.shift, { backgroundColor: on(d) ? colors.accent2Soft : colors.surface2 }]}>
            <AppText variant="caption" muted style={{ fontSize: 10 }}>
              {fmt(d)}
            </AppText>
            <AppText variant="caption" numberOfLines={1} style={{ fontSize: 11, fontFamily: fonts.bold }}>
              {on(d) ? String(on(d)!.data.tipo).split(' ')[0] : '—'}
            </AppText>
          </View>
        ))}
      </View>
    </Panel>
  );
}

// ─── Ventas: hoy y el mes ────────────────────────────────────────────────────
function Sales({ store, today, money }: WidgetProps) {
  const list = store.of('venta');
  if (!list.length) return null;
  const sum = (xs: Entry[]) => xs.reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const day = list.filter((v) => v.day === today);
  const month = list.filter((v) => v.day?.slice(0, 7) === today.slice(0, 7));
  return (
    <Panel>
      <Kicker>{`Hoy · ${day.length} ${day.length === 1 ? 'venta' : 'ventas'}`}</Kicker>
      <AppText variant="title">{money(sum(day))}</AppText>
      <AppText variant="caption" muted>{`Este mes: ${money(sum(month))}`}</AppText>
    </Panel>
  );
}

export function EmptyWidget({ text }: { text: string }) {
  return <Empty text={text} />;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 6, height: 110, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barTrack: { flex: 1, width: '100%', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  node: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  stem: { width: 2, flex: 1, marginTop: 2 },
  quads: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quad: { width: '48%', flexGrow: 1, borderRadius: 14, padding: 10, gap: 3, borderLeftWidth: 3, minHeight: 90 },
  shift: { flex: 1, borderRadius: 8, paddingVertical: 6, alignItems: 'center', gap: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
});
