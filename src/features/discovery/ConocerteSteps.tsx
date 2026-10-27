import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  GOALS,
  INTERESTS,
  NO_WORK,
  QUESTIONS,
  SLEEP_TIMES,
  STUDY,
  VARIES,
  WAKE_TIMES,
  dayLength,
  type Question,
  type Trade,
} from '@/core/discovery';
import { EXTRA_HABITS, HabitPicker } from '@/features/habits/HabitPicker';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { AppText, Button, Chip } from '@/ui';
import { tap } from '@/ui/haptics';
import {
  BriefcaseIcon,
  CheckIcon,
  HeartIcon,
  ImagesIcon,
  ListChecksIcon,
  MoonIcon,
  PlantIcon,
  SunIcon,
  WalletIcon,
  type Icon,
} from '@/ui/icons';

// Pasos de Conocerte (F30, E3·18): necesidades → oficios → intereses → camino → plan rápido.

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const GOAL_ICON: Record<string, Icon> = {
  finanzas: WalletIcon,
  dia: ListChecksIcon,
  salud: HeartIcon,
  fe: PlantIcon,
  recordar: ImagesIcon,
  trabajo: BriefcaseIcon,
};

export function GoalsStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="title">¿Para qué quieres Severa?</AppText>
      <AppText muted>Elige una o varias. Con eso armamos tu inicio; lo demás se descubre con calma.</AppText>
      <View style={styles.grid}>
        {GOALS.map((g) => {
          const on = value.includes(g.code);
          const GoalIcon = GOAL_ICON[g.code];
          return (
            <Pressable
              key={g.code}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                onChange(toggle(value, g.code));
              }}
              style={[styles.goal, { backgroundColor: colors.surface, borderColor: on ? colors.accent : 'transparent' }]}
            >
              <View style={[styles.goalIcon, { backgroundColor: on ? colors.accentSoft : colors.surface2 }]}>
                <GoalIcon size={20} color={on ? colors.accent : colors.muted} />
              </View>
              <AppText variant="label">{g.name}</AppText>
              <AppText variant="caption" muted>
                {g.detail}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TradesStep({ trades, value, onChange }: { trades: Trade[]; value: string[]; onChange: (v: string[]) => void }) {
  // Primero los oficios con los que parte la beta (conductor, shopper, prevencionista, ventas).
  const sorted = [...trades].sort((a, b) => (a.beta_priority ?? 99) - (b.beta_priority ?? 99) || a.sort_order - b.sort_order);
  const pick = (code: string) => {
    if (code === NO_WORK) return onChange(value.includes(NO_WORK) ? [] : [NO_WORK]);
    onChange(toggle(value.filter((x) => x !== NO_WORK), code));
  };
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="title">¿En qué trabajas?</AppText>
      <AppText muted>Puedes elegir más de uno (por ejemplo, un trabajo con horario y Uber).</AppText>
      <View style={styles.wrap}>
        {sorted.map((t) => (
          <Chip key={t.code} work label={t.name} selected={value.includes(t.code)} onPress={() => pick(t.code)} />
        ))}
      </View>
      <View style={styles.wrap}>
        <Chip work label="Estudio" selected={value.includes(STUDY)} onPress={() => pick(STUDY)} />
        <Chip work label="No trabajo por ahora" selected={value.includes(NO_WORK)} onPress={() => pick(NO_WORK)} />
      </View>
    </View>
  );
}

export function InterestsStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="title">¿Y cuando no trabajas?</AppText>
      <AppText muted>Lo que te gusta hacer no enciende nada todavía: nos dice qué sugerirte después.</AppText>
      <View style={styles.wrap}>
        {INTERESTS.map((i) => (
          <Chip key={i.code} label={i.name} selected={value.includes(i.code)} onPress={() => onChange(toggle(value, i.code))} />
        ))}
      </View>
    </View>
  );
}

export function PathStep({
  value,
  onChange,
  moduleNames,
  questions,
}: {
  value: 'quick' | 'calm';
  onChange: (v: 'quick' | 'calm') => void;
  moduleNames: string[];
  questions: number;
}) {
  const { colors } = useTheme();
  const many = moduleNames.length > 8;
  const option = (code: 'quick' | 'calm', title: string, text: string) => {
    const on = value === code;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        onPress={() => onChange(code)}
        style={[styles.path, { backgroundColor: colors.surface, borderColor: on ? colors.accent : 'transparent' }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="subtitle">{title}</AppText>
          <View style={[styles.radio, { borderColor: on ? colors.accent : colors.muted, borderWidth: on ? 7 : 2 }]} />
        </View>
        <AppText variant="caption" muted>
          {text}
        </AppText>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="title">¿Cómo quieres partir?</AppText>
      {option(
        'quick',
        'Plan rápido',
        moduleNames.length
          ? `${moduleNames.length} módulos + 4 básicos · unos ${Math.max(1, Math.round((questions * 15) / 60))} min. Una pregunta corta por módulo; todo se puede saltar.`
          : 'Elige una necesidad para armar tu plan.',
      )}
      {moduleNames.length ? (
        <View style={styles.wrap}>
          {moduleNames.map((m) => (
            <View key={m} style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" color={colors.accent}>
                {m}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {many ? (
        <AppText variant="caption" color={colors.mid}>
          Son muchos módulos para partir: te recomendamos ir con calma o quitar una necesidad.
        </AppText>
      ) : null}
      {option('calm', 'Con calma', 'Partimos con lo mínimo y te sugerimos un módulo a la vez, cuando lo necesites. Tu cerebro crece contigo.')}
    </View>
  );
}

/** Hora de despertar o de dormir: se toca una hora y avanza sola. Abajo se arma el día en vivo. */
export function DayTimeStep({
  kind,
  wake,
  sleep,
  onPick,
}: {
  kind: 'wake' | 'sleep';
  wake: string | null;
  sleep: string | null;
  onPick: (time: string) => void;
}) {
  const { colors } = useTheme();
  const times = kind === 'wake' ? WAKE_TIMES : SLEEP_TIMES;
  const value = kind === 'wake' ? wake : sleep;
  const length = wake && sleep ? dayLength(wake, sleep) : null;
  const row = (Icon: Icon, label: string, time: string | null, on: boolean) => (
    <View style={styles.dayRow}>
      <View style={[styles.dayIcon, { backgroundColor: on ? colors.accent : colors.surface2 }]}>
        <Icon size={18} color={on ? colors.onAccent : colors.muted} weight={on ? 'fill' : 'regular'} />
      </View>
      <AppText variant="label" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="label" color={time ? colors.text : colors.muted} style={{ fontVariant: ['tabular-nums'] }}>
        {time ?? '—'}
      </AppText>
    </View>
  );
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="title">{kind === 'wake' ? '¿A qué hora despiertas?' : '¿Y a qué hora te duermes?'}</AppText>
      <AppText muted>{kind === 'wake' ? 'Con esto empieza tu día en Severa.' : 'Así Severa sabe cuándo cerrar tu día.'}</AppText>
      <View style={styles.times}>
        {times.map((t) => {
          const on = value === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                onPick(t);
              }}
              style={({ pressed }) => [styles.time, { backgroundColor: on ? colors.accent : colors.surface, opacity: pressed ? 0.85 : 1 }]}
            >
              <AppText variant="label" style={{ fontSize: 16, fontVariant: ['tabular-nums'] }} color={on ? colors.onAccent : colors.text}>
                {t}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Chip
        label="Varía según el día"
        selected={value === VARIES}
        onPress={() => onPick(VARIES)}
      />
      <View style={[styles.dayCard, { backgroundColor: colors.surface }]}>
        <AppText variant="caption" muted style={{ letterSpacing: 1 }}>
          TU DÍA
        </AppText>
        {row(SunIcon, 'Despertar', wake === VARIES ? 'Varía' : wake, kind === 'wake' || !!wake)}
        <View style={[styles.dayLine, { backgroundColor: colors.line }]} />
        {row(MoonIcon, 'Dormir', sleep === VARIES ? 'Varía' : sleep, kind === 'sleep')}
        {length ? (
          <AppText variant="caption" muted>
            {`${length.awake} h despierto · ${length.asleep} h de sueño`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export type HabitOption = { code: string; name: string; direction: 'good' | 'reduce'; target?: number; unit?: string | null };

export function QuestionStep({
  code,
  moduleName,
  habits,
  onAnswer,
}: {
  code: string;
  moduleName: string;
  habits: HabitOption[];
  onAnswer: (value: unknown | 'skipped') => void;
}) {
  const { colors } = useTheme();
  const q: Question = QUESTIONS[code];
  const [otherDay, setOtherDay] = useState(false);
  const [day, setDay] = useState(24);
  const [chosen, setChosen] = useState<string[]>([]);

  return (
    <View style={{ gap: space.md }}>
      <View style={[styles.tag, { alignSelf: 'flex-start', backgroundColor: colors.accentSoft }]}>
        <AppText variant="label" color={colors.accent}>
          {moduleName}
        </AppText>
      </View>
      <AppText variant="title">{q.q}</AppText>

      {q.kind === 'payday' && otherDay ? (
        <View style={{ gap: space.md }}>
          <AppText variant="caption" muted>
            Elige el día. Si algún mes cambia (feriado, fin de semana o el calendario de tu Servicio), lo corriges ese mes en Finanzas.
          </AppText>
          <View style={styles.days}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <Pressable
                key={d}
                accessibilityRole="radio"
                accessibilityState={{ checked: d === day }}
                onPress={() => setDay(d)}
                style={[styles.day, { backgroundColor: d === day ? colors.accent : colors.surface }]}
              >
                <AppText variant="label" color={d === day ? colors.onAccent : colors.text}>
                  {d}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Button label={`Me pagan el ${day}`} onPress={() => onAnswer({ option: 'Otro día', day })} />
          <Button label="Volver a las opciones" kind="link" onPress={() => setOtherDay(false)} />
        </View>
      ) : q.kind === 'habits' ? (
        <View style={{ gap: space.md }}>
          <AppText muted>Marca los que quieres contar o escribe uno propio. Sin juicios, solo números.</AppText>
          <Button
            label={chosen.length ? `Contar ${chosen.length} ${chosen.length === 1 ? 'hábito' : 'hábitos'}` : 'Elige al menos uno'}
            disabled={!chosen.length}
            onPress={() => onAnswer({ habits: chosen.filter((c) => !c.startsWith('own:') && !c.startsWith('ownr:')), custom: chosen.filter((c) => c.startsWith('own:')).map((c) => c.slice(4)), customReduce: chosen.filter((c) => c.startsWith('ownr:')).map((c) => c.slice(5)) })}
          />
          <HabitPicker
            suggestions={[...habits, ...EXTRA_HABITS]}
            chosen={chosen}
            onToggle={(h) => setChosen(toggle(chosen, h.code))}
            onCreate={(name, dir) => setChosen([...chosen, `${dir === 'reduce' ? 'ownr' : 'own'}:${name}`])}
          />
          {chosen.filter((c) => c.startsWith('own:') || c.startsWith('ownr:')).map((c) => (
            <AppText key={c} variant="caption" color={c.startsWith('ownr:') ? colors.mid : colors.accent}>{`✓ ${c.slice(c.indexOf(':') + 1)} (tuyo, ${c.startsWith('ownr:') ? 'para bajar' : 'para sumar'})`}</AppText>
          ))}
          {/* Al llegar abajo también se sigue (usuario, 26-10-2026: «solo dice saltar»). */}
          <Button
            label={chosen.length ? `Siguiente · contar ${chosen.length}` : 'Siguiente'}
            disabled={!chosen.length}
            onPress={() => onAnswer({ habits: chosen.filter((c) => !c.startsWith('own:') && !c.startsWith('ownr:')), custom: chosen.filter((c) => c.startsWith('own:')).map((c) => c.slice(4)), customReduce: chosen.filter((c) => c.startsWith('ownr:')).map((c) => c.slice(5)) })}
          />
        </View>
      ) : q.multi ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted>
            Puedes marcar más de una.
          </AppText>
          {q.options.map((op) => {
            const on = chosen.includes(op);
            return (
              <Pressable
                key={op}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  tap();
                  setChosen(op === q.only ? (on ? [] : [op]) : toggle(chosen.filter((x) => x !== q.only), op));
                }}
                style={({ pressed }) => [
                  styles.option,
                  styles.multi,
                  { backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: on ? colors.accent : 'transparent', opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <AppText variant="label" style={{ fontSize: 16, flex: 1 }} color={on ? colors.accent : colors.text}>
                  {op}
                </AppText>
                <View style={[styles.box, { borderColor: on ? colors.accent : colors.muted, backgroundColor: on ? colors.accent : 'transparent' }]}>
                  {on ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : null}
                </View>
              </Pressable>
            );
          })}
          <Button
            label={chosen.length ? 'Listo' : 'Elige al menos una'}
            disabled={!chosen.length}
            onPress={() => onAnswer(chosen.length === 1 && chosen[0] === q.only ? 'skipped' : { options: chosen })}
          />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {q.options.map((op) => (
            <Pressable
              key={op}
              accessibilityRole="button"
              onPress={() => {
                tap();
                if (q.kind === 'payday' && op === 'Otro día') return setOtherDay(true);
                onAnswer(op === 'Después' ? 'skipped' : { option: op });
              }}
              style={({ pressed }) => [styles.option, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
            >
              <AppText variant="label" style={{ fontSize: 16 }}>
                {op}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
      {q.note && !otherDay ? (
        <AppText variant="caption" muted>
          {q.note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goal: { width: '48%', flexGrow: 1, minHeight: 112, borderRadius: 20, padding: 14, gap: 6, borderWidth: 2 },
  goalIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  path: { borderRadius: 22, padding: 16, gap: 6, borderWidth: 2 },
  radio: { width: 22, height: 22, borderRadius: 11 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  option: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' },
  multi: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { width: '23%', flexGrow: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dayCard: { borderRadius: 22, padding: 16, gap: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayLine: { width: 2, height: 18, marginLeft: 17, borderRadius: 1 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { width: '12.6%', height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
