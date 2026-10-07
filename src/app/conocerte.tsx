import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ageOn } from '@/core/age';
import { initialStates, planModules, questionList, works, type Path } from '@/core/discovery';
import { useAuth } from '@/data/auth';
import { saveOnboarding, useHabitTemplates, useNeurons, useTrades } from '@/data/discovery';
import { authErrorMessage } from '@/features/account/authErrors';
import { GoalsStep, InterestsStep, PathStep, QuestionStep, TradesStep } from '@/features/discovery/ConocerteSteps';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice, Screen } from '@/ui';
import { CaretLeftIcon } from '@/ui/icons';

// F30 · Conocerte: de lo macro a lo micro, después de crear la cuenta. Al terminar se guarda
// todo de una vez (save_onboarding) y se pasa al cerebro.
export default function ConocerteScreen() {
  const { session, markOnboarded } = useAuth();
  const { colors } = useTheme();
  const { neurons } = useNeurons();
  const { trades } = useTrades();
  const habitTemplates = useHabitTemplates();

  const birth = session?.user.user_metadata?.birth_date as string | undefined;
  const age = birth ? ageOn(new Date(`${birth}T12:00:00`)) : null;

  const [step, setStep] = useState(0); // 0 necesidades · 1 oficios · 2 intereses · 3 camino · 4 preguntas
  const [goals, setGoals] = useState<string[]>([]);
  const [tradeCodes, setTradeCodes] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [path, setPath] = useState<Path>('quick');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => Object.fromEntries(neurons.map((n) => [n.code, n])), [neurons]);
  // Reglas de edad: lo que no corresponde no entra al plan (el servidor también lo impide).
  const allowed = (code: string) => age === null || !names[code] || age >= names[code].min_age;
  const { plans, modules } = useMemo(() => planModules(goals, tradeCodes, trades), [goals, tradeCodes, trades]);
  const planMods = modules.filter(allowed);
  const questions = questionList(planMods);
  const habits = habitTemplates.filter((h) => age === null || age >= h.min_age);

  async function finish(finalAnswers: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const status = Object.fromEntries(Object.entries(finalAnswers).map(([k, v]) => [k, v === 'skipped' ? 'skipped' : 'ok']));
      const states = initialStates(path, planMods, status, tradeCodes);
      for (const code of Object.keys(states)) if (!names[code] || !allowed(code)) delete states[code];
      await saveOnboarding({ goals, interests, trades: tradeCodes, path, plans, answers: finalAnswers, neurons: states });
      markOnboarded();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  function answer(code: string, value: unknown) {
    const next = { ...answers, [code]: value };
    setAnswers(next);
    if (qIdx + 1 >= questions.length) finish(next);
    else setQIdx(qIdx + 1);
  }

  function back() {
    if (step === 4 && qIdx > 0) setQIdx(qIdx - 1);
    else setStep(Math.max(0, step - 1));
  }

  const inQuestions = step === 4;
  const total = inQuestions ? questions.length : 4;
  const current = inQuestions ? qIdx : step;
  const header = inQuestions ? `PLAN RÁPIDO · ${qIdx + 1} DE ${questions.length}` : `CONOCERTE · ${step + 1} DE 4`;

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
            {header}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= current ? colors.accent : colors.surface2 }} />
            ))}
          </View>
        </View>
      </View>

      {error ? <Notice text={error} /> : null}

      {step === 0 ? <GoalsStep value={goals} onChange={setGoals} /> : null}
      {step === 1 ? <TradesStep trades={trades} value={tradeCodes} onChange={setTradeCodes} /> : null}
      {step === 2 ? <InterestsStep value={interests} onChange={setInterests} /> : null}
      {step === 3 ? (
        <PathStep value={path} onChange={setPath} moduleNames={planMods.map((m) => names[m]?.name ?? m)} questions={questions.length} />
      ) : null}
      {inQuestions && questions[qIdx] ? (
        <QuestionStep
          key={questions[qIdx]}
          code={questions[qIdx]}
          moduleName={names[questions[qIdx]]?.name ?? questions[qIdx]}
          habits={habits}
          onAnswer={(v) => answer(questions[qIdx], v)}
        />
      ) : null}

      <View style={{ flexGrow: 1 }} />

      {step < 3 ? (
        <Button label="Siguiente" disabled={step === 0 && goals.length === 0} onPress={() => setStep(step + 1)} />
      ) : step === 3 ? (
        <Button
          label="Empezar"
          loading={busy}
          disabled={path === 'quick' && planMods.length === 0}
          onPress={() => {
            if (path === 'calm' || questions.length === 0) finish({});
            else {
              setQIdx(0);
              setStep(4);
            }
          }}
        />
      ) : (
        <>
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            Lo que saltes queda por completar; te lo recordamos con calma.
          </AppText>
          <Button label="Saltar" kind="secondary" loading={busy} onPress={() => answer(questions[qIdx], 'skipped')} />
        </>
      )}
      {step === 1 && !works(tradeCodes) && tradeCodes.length === 0 ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          Si no eliges nada, seguimos sin Trabajo. Lo puedes agregar después.
        </AppText>
      ) : null}
    </Screen>
  );
}
