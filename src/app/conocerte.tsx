import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { ageOn } from '@/core/age';
import { initialStates, pickQuestions, planModules, works, type Path } from '@/core/discovery';
import { useAuth } from '@/data/auth';
import { saveOnboarding, useHabitTemplates, useNeurons, useTrades } from '@/data/discovery';
import { insertRecord, usePersonalSpace } from '@/data/records';
import { EXTRA_HABITS } from '@/features/habits/HabitPicker';
import { authErrorMessage } from '@/features/account/authErrors';
import { DayTimeStep, GoalsStep, InterestsStep, PathStep, QuestionStep, TradesStep } from '@/features/discovery/ConocerteSteps';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretLeftIcon } from '@/ui/icons';

// F30 · Conocerte: de lo macro a lo micro, después de crear la cuenta. Cabe en 10 a 12 pantallas
// (prueba en el teléfono, 17-10-2026): necesidades, oficio, intereses, hora de despertar y de
// dormir, camino y como máximo 5 preguntas del plan. Al terminar se guarda todo de una vez
// (save_onboarding) y se pasa al cerebro.
const STEPS = { goals: 0, trades: 1, interests: 2, wake: 3, sleep: 4, path: 5, questions: 6 } as const;
const BASE_STEPS = 6;

export default function ConocerteScreen() {
  const { session, markOnboarded } = useAuth();
  const { colors } = useTheme();
  const { neurons } = useNeurons();
  const { trades } = useTrades();
  const habitTemplates = useHabitTemplates();

  const birth = session?.user.user_metadata?.birth_date as string | undefined;
  const age = birth ? ageOn(new Date(`${birth}T12:00:00`)) : null;

  const [step, setStep] = useState<number>(STEPS.goals);
  const [dir, setDir] = useState<1 | -1>(1);
  const [goals, setGoals] = useState<string[]>([]);
  const [tradeCodes, setTradeCodes] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [wake, setWake] = useState<string | null>(null);
  const [sleep, setSleep] = useState<string | null>(null);
  const [path, setPath] = useState<Path>('quick');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);

  const names = useMemo(() => Object.fromEntries(neurons.map((n) => [n.code, n])), [neurons]);
  // Reglas de edad: lo que no corresponde no entra al plan (el servidor también lo impide).
  const allowed = (code: string) => age === null || !names[code] || age >= names[code].min_age;
  const { plans, modules } = useMemo(() => planModules(goals, tradeCodes, trades), [goals, tradeCodes, trades]);
  const planMods = modules.filter(allowed);
  const { ask: questions, later } = pickQuestions(planMods);
  const habits = habitTemplates.filter((h) => age === null || age >= h.min_age);
  const personalSpace = usePersonalSpace();

  function go(next: number) {
    tap();
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  async function finish(finalAnswers: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const status: Record<string, string> = Object.fromEntries(
        Object.entries(finalAnswers).map(([k, v]) => [k, v === 'skipped' ? 'skipped' : 'ok']),
      );
      // Lo que no alcanzamos a preguntar queda por completar, igual que lo saltado.
      for (const code of later) status[code] = 'skipped';
      const states = initialStates(path, planMods, status, tradeCodes);
      for (const code of Object.keys(states)) if (!names[code] || !allowed(code)) delete states[code];
      await saveOnboarding({
        goals,
        interests,
        trades: tradeCodes,
        path,
        plans,
        answers: { ...finalAnswers, horario: { despierta: wake, duerme: sleep } },
        neurons: states,
      });
      await createChosenHabits(finalAnswers.habitos);
      markOnboarded();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  // Los hábitos elegidos quedan listos para contarse en Hoy (si falla, se activan desde Hoy).
  async function createChosenHabits(answer: unknown) {
    const a = answer as { habits?: string[]; custom?: string[] } | undefined;
    if (!personalSpace || !a) return;
    const all = [...habits, ...EXTRA_HABITS];
    try {
      for (const code of a.habits ?? []) {
        const h = all.find((x) => x.code === code);
        if (!h) continue;
        const target = 'target' in h && h.target && h.target > 1 && h.target <= 20 ? h.target : 1;
        await insertRecord('habits', personalSpace, session?.user.id, { name: h.name, direction: h.direction, template_code: h.code, daily_target: target, unit: ('unit' in h && h.unit) || null, active: true, sort_order: 0 });
      }
      for (const name of a.custom ?? []) {
        await insertRecord('habits', personalSpace, session?.user.id, { name, direction: 'good', template_code: null, daily_target: 1, unit: null, active: true, sort_order: 0 });
      }
    } catch {
      // Sin espacio cargado todavía: la tarjeta de Hoy ofrece activarlos.
    }
  }

  function answer(code: string, value: unknown) {
    tap();
    const next = { ...answers, [code]: value };
    setAnswers(next);
    setDir(1);
    if (qIdx + 1 >= questions.length) finish(next);
    else setQIdx(qIdx + 1);
  }

  // Al tocar una hora se ve marcada un momento y la pantalla avanza sola.
  function pickTime(kind: 'wake' | 'sleep', time: string) {
    if (kind === 'wake') setWake(time);
    else setSleep(time);
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(() => go(kind === 'wake' ? STEPS.sleep : STEPS.path), 320);
  }

  function back() {
    if (advance.current) clearTimeout(advance.current);
    tap();
    setDir(-1);
    if (step === STEPS.questions && qIdx > 0) setQIdx(qIdx - 1);
    else setStep(Math.max(0, step - 1));
  }

  const inQuestions = step === STEPS.questions;
  const total = BASE_STEPS + (path === 'quick' ? questions.length : 0);
  const current = inQuestions ? BASE_STEPS + qIdx : step;
  const Enter = dir > 0 ? FadeInRight : FadeInLeft;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atrás"
          disabled={step === 0}
          onPress={back}
          style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, opacity: step === 0 ? 0.4 : 1 }}
        >
          <CaretLeftIcon size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="caption" muted style={{ letterSpacing: 1 }}>
            {`${inQuestions ? 'TU PLAN' : 'CONOCERTE'} · ${current + 1} DE ${total}`}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= current ? colors.accent : colors.surface2 }} />
            ))}
          </View>
        </View>
      </View>

      {error ? <Notice text={error} /> : null}

      <Animated.View key={inQuestions ? `q-${qIdx}` : `s-${step}`} entering={Enter.duration(260)} style={{ gap: space.md }}>
        {step === STEPS.goals ? <GoalsStep value={goals} onChange={setGoals} /> : null}
        {step === STEPS.trades ? <TradesStep trades={trades} value={tradeCodes} onChange={setTradeCodes} /> : null}
        {step === STEPS.interests ? <InterestsStep value={interests} onChange={setInterests} /> : null}
        {step === STEPS.wake ? <DayTimeStep kind="wake" wake={wake} sleep={sleep} onPick={(t) => pickTime('wake', t)} /> : null}
        {step === STEPS.sleep ? <DayTimeStep kind="sleep" wake={wake} sleep={sleep} onPick={(t) => pickTime('sleep', t)} /> : null}
        {step === STEPS.path ? (
          <PathStep value={path} onChange={setPath} moduleNames={planMods.map((m) => names[m]?.name ?? m)} questions={questions.length} />
        ) : null}
        {inQuestions && questions[qIdx] ? (
          <QuestionStep
            code={questions[qIdx]}
            moduleName={names[questions[qIdx]]?.name ?? questions[qIdx]}
            habits={habits}
            onAnswer={(v) => answer(questions[qIdx], v)}
          />
        ) : null}
      </Animated.View>

      <View style={{ flexGrow: 1 }} />

      {step <= STEPS.interests ? (
        <Button label="Siguiente" disabled={step === STEPS.goals && goals.length === 0} onPress={() => go(step + 1)} />
      ) : step === STEPS.path ? (
        <Button
          label="Empezar"
          loading={busy}
          disabled={path === 'quick' && planMods.length === 0}
          onPress={() => {
            if (path === 'calm' || questions.length === 0) finish({});
            else {
              setQIdx(0);
              go(STEPS.questions);
            }
          }}
        />
      ) : inQuestions ? (
        <>
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            Lo que saltes queda por completar; te lo recordamos con calma.
          </AppText>
          <Button label="Saltar" kind="secondary" loading={busy} onPress={() => answer(questions[qIdx], 'skipped')} />
        </>
      ) : null}
      {step === STEPS.trades && !works(tradeCodes) && tradeCodes.length === 0 ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          Si no eliges nada, seguimos sin Trabajo. Lo puedes agregar después.
        </AppText>
      ) : null}
    </Screen>
  );
}
