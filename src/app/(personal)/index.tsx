import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { useAuth } from '@/data/auth';
import { usePreferences } from '@/data/preferences';
import { supabase } from '@/data/supabase';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { useTheme } from '@/theme/ThemeProvider';
import { themeNames, type ThemeKey } from '@/theme/tokens';
import { Amount, AppText, Button, EyeButton, Screen } from '@/ui';

const THEMES: ThemeKey[] = ['gold', 'dark', 'blue', 'light', 'pink'];

// Entrega 0: pantalla mínima que prueba la sesión, el espacio personal, los temas
// y los montos ocultos con el ojo.
export default function HoyScreen() {
  const { session, signOut } = useAuth();
  const { colors, theme, mode, setMode } = useTheme();
  const { hideAmounts, setHideAmounts, setTheme } = usePreferences();
  const money = useAmountVisibility();
  const [name, setName] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('people')
      .select('name')
      .eq('type', 'self')
      .maybeSingle()
      .then(({ data }) => setName(data?.name ?? null));
    supabase
      .from('spaces')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setSpaces(count ?? 0));
  }, [session?.user.id]);

  const card = { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 12 } as const;

  return (
    <Screen>
      <AppText variant="caption" muted style={{ letterSpacing: 2 }}>
        {mode === 'personal' ? 'PERSONAL' : 'TRABAJO'}
      </AppText>
      <AppText variant="title">{name ? `Hola, ${name}` : 'Hola'}</AppText>
      <AppText muted>
        Tu cuenta está lista: {spaces === null ? '…' : `${spaces} espacio${spaces === 1 ? '' : 's'}`} · {session?.user.email}
      </AppText>

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

      <AppText variant="caption" muted>
        Entrega 0 · cimientos. Lo que sigue: conocerte, tu rutina y el primer oficio.
      </AppText>
      <Button label="Salir" kind="link" onPress={signOut} />
    </Screen>
  );
}
