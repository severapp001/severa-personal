import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { neighbors, type Neuron, type NeuronState, type Synapse } from '@/core/discovery';
import { answerSuggestion, setNeuronState } from '@/data/discovery';
import { authErrorMessage } from '@/features/account/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { AppText, Button, Notice } from '@/ui';
import { useBrainColors } from './Brain';

const LEVELS = ['conocerte', 'rápidos', 'orden y rutina', 'personales', 'íntimos y sensibles'];
const HEMI = { personal: 'Personal', work: 'Trabajo', bridge: 'Puente entre los dos' };
const STATE = { discovered: 'Encendida', suggested: 'Por completar', undiscovered: 'Por descubrir', off: 'Apagada' };

// Hoja de una neurona (E3·18): qué es, lo mínimo, con qué se conecta y encenderla.
// Nunca se bloquea de verdad: cualquier módulo se puede abrir (F11).
export function NeuronSheet({
  neuron,
  neurons,
  synapses,
  states,
  age,
  onClose,
}: {
  neuron: Neuron | null;
  neurons: Neuron[];
  synapses: Synapse[];
  states: Record<string, NeuronState>;
  age: number | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const bc = useBrainColors();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!neuron) return null;

  const st: NeuronState = states[neuron.code] ?? 'undiscovered';
  const tooYoung = age !== null && age < neuron.min_age;
  const color = neuron.hemisphere === 'work' ? bc.work : neuron.hemisphere === 'bridge' ? bc.bridge : bc.personal;
  const vec = neighbors(synapses)[neuron.code] ?? [];
  const names = Object.fromEntries(neurons.map((n) => [n.code, n]));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]}>
        <ScrollView contentContainerStyle={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: st === 'discovered' ? color : 'transparent',
                borderWidth: st === 'suggested' ? 2 : 0,
                borderColor: color,
                opacity: st === 'undiscovered' ? 0.4 : 1,
              }}
            />
            <AppText variant="title" style={{ flex: 1 }}>
              {neuron.name}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            {HEMI[neuron.hemisphere]} · nivel {neuron.level} · {LEVELS[neuron.level]} · {STATE[st]}
          </AppText>
          {neuron.summary ? <AppText>{neuron.summary}</AppText> : null}
          {neuron.minimum ? (
            <View style={[styles.box, { backgroundColor: colors.surface2 }]}>
              <AppText variant="label">Lo mínimo para encenderla</AppText>
              <AppText variant="caption">{neuron.minimum}</AppText>
            </View>
          ) : null}
          {neuron.sensitive ? (
            <Notice tone="mid" text="Guarda datos sensibles: solo tú los ves, puedes protegerla con Face ID y pide tu consentimiento antes de empezar." />
          ) : null}
          {tooYoung ? <Notice tone="mid" text={`Disponible desde los ${neuron.min_age} años.`} /> : null}
          {vec.length ? (
            <View style={{ gap: 6 }}>
              <AppText variant="label">Se conecta con</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {vec.map((code) => {
                  const on = states[code] === 'discovered' || states[code] === 'suggested';
                  return (
                    <View key={code} style={[styles.tag, { backgroundColor: on ? colors.accentSoft : colors.surface2 }]}>
                      <AppText variant="caption" color={on ? colors.accent : colors.muted}>
                        {names[code]?.name ?? code}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
          {error ? <Notice text={error} /> : null}
          {st === 'undiscovered' || st === 'off' ? (
            <>
              <Button label="Encender" loading={busy} disabled={tooYoung} onPress={() => run(() => setNeuronState(neuron.code, 'discovered', 'own'))} />
              <Button label="No me interesa por ahora" kind="link" onPress={() => run(() => answerSuggestion(neuron.code, 'hoja de la neurona', 'not_interested'))} />
            </>
          ) : st === 'suggested' ? (
            <Button label="Ya completé lo mínimo" loading={busy} onPress={() => run(() => setNeuronState(neuron.code, 'discovered', 'own'))} />
          ) : (
            <AppText variant="caption" muted>
              Ya está encendida. Desde Módulos la abres cuando quieras.
            </AppText>
          )}
          <Button label="Cerrar" kind="secondary" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: space.xl, maxHeight: '80%' },
  box: { borderRadius: radius.md, padding: space.md, gap: 4 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
});
