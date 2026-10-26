import { useState } from 'react';
import { View } from 'react-native';

import { daysToPayday, type PaydayAnswer } from '@/core/today';
import { useAuth } from '@/data/auth';
import { setOnboardingAnswer, useOnboarding } from '@/data/discovery';
import { AppText, Button, Notice } from '@/ui';
import { Chips, Field, Kicker, Panel, Sheet } from '@/ui/kit';

// Día de pago en Finanzas (pedido del usuario, 25-10-2026: «no puedo cambiar la fecha de pago,
// esto debiese aparecer en finanzas»). Es la misma respuesta de Conocerte (answers.finanzas).

const OPTIONS = ['Día 5', 'Día 15', 'Último día hábil', 'Otro día', 'Cambia según el mes', 'No tengo sueldo fijo'];

const label = (a: PaydayAnswer) => {
  if (!a || a === 'skipped' || !a.option) return 'Sin definir';
  return a.option === 'Otro día' && a.day ? `El día ${a.day} de cada mes` : a.option;
};

export function PaydayPanel() {
  const { session } = useAuth();
  const accountId = session?.user.id;
  const onboarding = useOnboarding(accountId);
  const answer = onboarding?.answers.finanzas as PaydayAnswer;
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<string | null>(null);
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = daysToPayday(answer, new Date());

  const start = () => {
    const a = answer && answer !== 'skipped' ? answer : null;
    setOption(a?.option ?? null);
    setDay(a?.day ? String(a.day) : '');
    setError(null);
    setOpen(true);
  };

  async function save() {
    if (!accountId || !onboarding || !option) return setError('Elige una opción.');
    const n = Number(day);
    if (option === 'Otro día' && !(n >= 1 && n <= 31)) return setError('Escribe un día entre 1 y 31.');
    setBusy(true);
    try {
      await setOnboardingAnswer(accountId, onboarding.answers, 'finanzas', option === 'Otro día' ? { option, day: n } : { option });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <Kicker>Día de pago</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" style={{ fontSize: 16 }}>
            {label(answer)}
          </AppText>
          <AppText variant="caption" muted>
            {next ? (next.days === 0 ? 'Hoy es tu día de pago' : `Faltan ${next.days} ${next.days === 1 ? 'día' : 'días'}`) : 'Sin una fecha fija, Hoy no cuenta los días.'}
          </AppText>
        </View>
        <Button label="Cambiar" kind="link" onPress={start} />
      </View>
      <Sheet visible={open} title="¿Cuándo te pagan?" onClose={() => setOpen(false)}>
        <Chips options={OPTIONS.map((o) => ({ value: o, label: o }))} value={option} onChange={setOption} />
        {option === 'Otro día' ? <Field label="Día del mes (1 a 31)" value={day} onChangeText={setDay} keyboardType="number-pad" placeholder="25" /> : null}
        {error ? <Notice text={error} /> : null}
        <Button label="Guardar" loading={busy} onPress={save} />
      </Sheet>
    </Panel>
  );
}
