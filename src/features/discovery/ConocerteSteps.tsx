import { BriefcaseIcon, HeartIcon, ImagesIcon, ListChecksIcon, PlantIcon, WalletIcon, type Icon } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GOALS, INTERESTS, NO_WORK, QUESTIONS, STUDY, type Question, type Trade } from '@/core/discovery';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { AppText, Button, Chip } from '@/ui';

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
              onPress={() => onChange(toggle(value, g.code))}
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

export type HabitOption = { code: string; name: string; direction: 'good' | 'reduce' };

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
          <AppText muted>Lo que te hace bien y lo que quieres bajar. Sin juicios, solo números.</AppText>
          <AppText variant="label" color={colors.accent}>
            LO QUE TE HACE BIEN
          </AppText>
          <View style={styles.wrap}>
            {habits.filter((h) => h.direction === 'good').map((h) => (
              <Chip key={h.code} label={h.name} selected={chosen.includes(h.code)} onPress={() => setChosen(toggle(chosen, h.code))} />
            ))}
          </View>
          <AppText variant="label" muted>
            LO QUE QUIERES BAJAR
          </AppText>
          <View style={styles.wrap}>
            {habits.filter((h) => h.direction === 'reduce').map((h) => (
              <Chip key={h.code} work label={h.name} selected={chosen.includes(h.code)} onPress={() => setChosen(toggle(chosen, h.code))} />
            ))}
          </View>
          <Button
            label={chosen.length ? `Contar ${chosen.length} ${chosen.length === 1 ? 'hábito' : 'hábitos'}` : 'Elige al menos uno'}
            disabled={!chosen.length}
            onPress={() => onAnswer({ habits: chosen })}
          />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {q.options.map((op) => (
            <Pressable
              key={op}
              accessibilityRole="button"
              onPress={() => {
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
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { width: '12.6%', height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
