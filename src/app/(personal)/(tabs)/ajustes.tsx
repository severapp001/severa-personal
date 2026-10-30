import * as Updates from 'expo-updates';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { useAuth } from '@/data/auth';
import { usePreferences } from '@/data/preferences';
import { SyncStatus } from '@/features/sync/SyncStatus';
import { AutomationCard } from '@/features/automation/AutomationCard';
import { TelegramCard } from '@/features/telegram/TelegramCard';
import { useTheme } from '@/theme/ThemeProvider';
import { themeNames, type ThemeKey } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';

// Ajustes: tema y su par de Trabajo (A1), montos ocultos (H3), sincronización, Telegram (27-10-2026)
// y la cuenta, con el correo con que se entró (27-10: en la web se entró con otra cuenta sin notarlo).

const THEMES: ThemeKey[] = ['gold', 'dark', 'blue', 'light', 'pink'];

/** Qué versión corre (29-10-2026: para saber si ya llegó la última actualización). */
function appVersion(): string {
  if (Platform.OS === 'web') return 'web';
  const d = Updates.createdAt;
  if (!d || Updates.isEmbeddedLaunch) return 'la de la instalación (sin actualizaciones todavía)';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())} · ${String(Updates.updateId ?? '').slice(0, 8)}`;
}

export default function AjustesScreen() {
  const { colors, theme, mode, workTheme, setWorkTheme } = useTheme();
  const { hideAmounts, setHideAmounts, setTheme } = usePreferences();
  const { session, signOut, redoOnboarding } = useAuth();
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

      <TelegramCard />

      <AutomationCard />

      <View style={card}>
        <AppText variant="subtitle">Tu cuenta</AppText>
        {session?.user.email ? (
          <AppText variant="caption" muted>
            {`Entraste con ${session.user.email}. Usa el mismo correo en el teléfono y en la web para ver los mismos datos.`}
          </AppText>
        ) : null}
        <AppText variant="caption" muted>
          {`Versión de la app: ${appVersion()}`}
        </AppText>
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
