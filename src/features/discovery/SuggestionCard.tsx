import { useState } from 'react';
import { View } from 'react-native';

import type { Neuron, Suggestion } from '@/core/discovery';
import { answerSuggestion } from '@/data/discovery';
import { authErrorMessage } from '@/features/account/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Notice } from '@/ui';

// Sugerencia de hoy (L5): una a la vez. Encender · Después · No me interesa (30 días).
export function SuggestionCard({
  suggestion,
  neuron,
  onLater,
  onOpen,
}: {
  suggestion: Suggestion;
  neuron: Neuron | undefined;
  onLater: () => void;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!neuron) return null;

  async function answer(a: 'accepted' | 'not_interested') {
    setBusy(true);
    setError(null);
    try {
      await answerSuggestion(suggestion.code, suggestion.reason, a);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 8 }}>
      <AppText variant="caption" color={colors.accent} style={{ fontFamily: fonts.extrabold, letterSpacing: 1.2 }}>
        SUGERENCIA DE HOY
      </AppText>
      <AppText variant="subtitle" onPress={onOpen}>
        {neuron.name}
      </AppText>
      <AppText variant="caption" muted>
        {suggestion.reason}
        {neuron.minimum ? ` · Lo mínimo: ${neuron.minimum}` : ''}
      </AppText>
      {error ? <Notice text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Encender" loading={busy} onPress={() => answer('accepted')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Después" kind="secondary" onPress={onLater} />
        </View>
      </View>
      <Button label="No me interesa" kind="link" onPress={() => answer('not_interested')} />
    </View>
  );
}
