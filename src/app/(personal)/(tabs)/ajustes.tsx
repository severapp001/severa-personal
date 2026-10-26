import { StyleSheet, Switch, View } from 'react-native';

import { useAuth } from '@/data/auth';
import { usePreferences } from '@/data/preferences';
import { SyncStatus } from '@/features/sync/SyncStatus';
import { useTheme } from '@/theme/ThemeProvider';
import { themeNames, type ThemeKey } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';

// Ajustes: tema y su par de Trabajo (A1), montos ocultos (H3), sincronización y la cuenta.

const THEMES: ThemeKey[] = ['gold', 'dark', 'blue', 'light', 'pink'];

export default function AjustesScreen() {
  const { colors, theme, mode, workTheme, setWorkTheme } = useTheme();
  const { hideAmounts, setHideAmounts, setTheme } = usePreferences();
  const { signOut, redoOnboarding } = useAuth();
  const card = [styles.card, { backgroundColor: colors.surface }];

  const row = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={styles.row}>
      <AppText variant="label" style={{ flex: 1 }}>
        {label}
      </AppText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.surface2 }} accessibilityLabel={label} />
    </View>
  );

  return (
    <Screen>
      <AppText variant="title">Ajustes</AppText>

      <View style={card}>
        <AppText variant="subtitle">Tema</AppText>
        <AppText variant="caption" muted>
          {mode === 'work' ? 'Estás en Trabajo: se ve el par de cada tema.' : 'Cada tema tiene su par para Trabajo.'}
        </AppText>
        <View style={styles.themes}>
          {THEMES.map((k) => (
            <Button key={k} kind={k === theme ? 'primary' : 'secondary'} label={mode === 'work' ? themeNames[k].work : themeNames[k].personal} onPress={() => setTheme(k)} />
          ))}
        </View>
        {row('Trabajo con el mismo tema que Personal', workTheme === 'same', (v) => setWorkTheme(v ? 'same' : 'pair'))}
      </View>

      <View style={card}>{row('Ocultar montos al abrir', hideAmounts, setHideAmounts)}</View>

      <SyncStatus />

      <View style={card}>
        <AppText variant="subtitle">Beta</AppText>
        <Button label="Repetir Conocerte" kind="secondary" onPress={redoOnboarding} />
        <Button label="Salir" kind="link" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, gap: 12 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
