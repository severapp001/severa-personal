import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { ageOn } from '@/core/age';
import { planModules, suggest } from '@/core/discovery';
import { useAuth } from '@/data/auth';
import { useNeurons, useNotInterested, useOnboarding, useSelfPerson, useSynapses, useTrades, useUserNeurons } from '@/data/discovery';
import { usePreferences } from '@/data/preferences';
import { Brain } from '@/features/discovery/Brain';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { SuggestionCard } from '@/features/discovery/SuggestionCard';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { SyncStatus } from '@/features/sync/SyncStatus';
import { useTheme } from '@/theme/ThemeProvider';
import { themeNames, type ThemeKey } from '@/theme/tokens';
import { Amount, AppText, Button, EyeButton, Screen } from '@/ui';

const THEMES: ThemeKey[] = ['gold', 'dark', 'blue', 'light', 'pink'];

// Inicio de Personal (entrega 1, en construcción): el cerebro con sus neuronas, la sugerencia
// de hoy y, por ahora, los ajustes rápidos (temas, montos ocultos).
export default function HoyScreen() {
  const { session, signOut } = useAuth();
  const accountId = session?.user.id;
  const { colors, theme, mode, setMode } = useTheme();
  const { hideAmounts, setHideAmounts, setTheme } = usePreferences();
  const money = useAmountVisibility();

  const person = useSelfPerson(accountId);
  const { neurons } = useNeurons();
  const synapses = useSynapses();
  const { trades } = useTrades();
  const states = useUserNeurons(accountId);
  const onboarding = useOnboarding(accountId);
  const notInterested = useNotInterested(accountId);
  const [selected, setSelected] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);

  const age = person?.birthDate ? ageOn(new Date(`${person.birthDate}T12:00:00`)) : undefined;
  const suggestion = useMemo(() => {
    if (!neurons.length) return null;
    const modules = onboarding ? planModules(onboarding.goals, onboarding.trades, trades).modules : [];
    return suggest(neurons, synapses, states, {
      interests: onboarding?.interests ?? [],
      planModules: modules,
      notInterested,
      skip,
      age,
    });
  }, [neurons, synapses, states, onboarding, trades, notInterested, skip, age]);

  const byCode = useMemo(() => Object.fromEntries(neurons.map((n) => [n.code, n])), [neurons]);
  const card = { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 12 } as const;

  return (
    <Screen>
      <AppText variant="caption" muted style={{ letterSpacing: 2 }}>
        {mode === 'personal' ? 'PERSONAL' : 'TRABAJO'}
      </AppText>
      <AppText variant="title">{person?.name ? `Hola, ${person.name}` : 'Hola'}</AppText>

      <View style={card}>
        <AppText variant="subtitle">Tu cerebro</AppText>
        {neurons.length ? (
          <Brain neurons={neurons} synapses={synapses} states={states} selected={selected} onSelect={setSelected} />
        ) : (
          <AppText variant="caption" muted>
            Cargando tus neuronas…
          </AppText>
        )}
        <AppText variant="caption" muted>
          Toca un punto para ver qué es y cómo encenderlo.
        </AppText>
      </View>

      {suggestion ? (
        <SuggestionCard
          suggestion={suggestion}
          neuron={byCode[suggestion.code]}
          onLater={() => setSkip((x) => x + 1)}
          onOpen={() => setSelected(suggestion.code)}
        />
      ) : null}

      <SyncStatus />

      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <AppText variant="caption" muted>
              Gastado este mes (ejemplo)
            </AppText>
            <Amount value={412300} visible={money.visible} size="big" />
          </View>
          <EyeButton visible={money.visible} onPress={money.toggle} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <AppText variant="caption" style={{ flex: 1 }}>
            Ocultar montos al abrir
          </AppText>
          <Switch
            value={hideAmounts}
            onValueChange={setHideAmounts}
            trackColor={{ true: colors.accent, false: colors.surface2 }}
            accessibilityLabel="Ocultar montos al abrir"
          />
        </View>
      </View>

      <View style={card}>
        <AppText variant="subtitle">Tema</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEMES.map((t) => (
            <Button
              key={t}
              kind={t === theme ? 'primary' : 'secondary'}
              label={mode === 'personal' ? themeNames[t].personal : themeNames[t].work}
              onPress={() => setTheme(t)}
            />
          ))}
        </View>
        <Button
          kind="secondary"
          label={mode === 'personal' ? 'Cruzar a Trabajo' : 'Volver a Personal'}
          onPress={() => setMode(mode === 'personal' ? 'work' : 'personal')}
        />
      </View>

      <Button label="Salir" kind="link" onPress={signOut} />

      <NeuronSheet
        neuron={selected ? byCode[selected] ?? null : null}
        neurons={neurons}
        synapses={synapses}
        states={states}
        age={age ?? null}
        onClose={() => setSelected(null)}
      />
    </Screen>
  );
}
