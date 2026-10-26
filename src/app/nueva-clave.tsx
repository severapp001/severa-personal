import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { isValidPassword } from '@/core/password';
import { useAuth } from '@/data/auth';
import { authErrorMessage } from '@/features/account/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice, PasswordRules, Screen, TextField } from '@/ui';

// F06 · Aquí vuelve el enlace de «cambiar contraseña». Se abre la sesión de recuperación,
// se escribe la contraseña nueva y recién ahí se entra a Personal.
export default function NuevaClaveScreen() {
  const url = Linking.useURL();
  const { completeFromUrl, updatePassword, recovering } = useAuth();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!url) return;
    completeFromUrl(url).catch((e) => setError(authErrorMessage(e)));
  }, [url, completeFromUrl]);

  async function onSubmit() {
    if (!isValidPassword(password)) {
      setError('Al menos 8 caracteres, con letras y números.');
      return;
    }
    if (password !== repeat) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">Contraseña nueva</AppText>
      {error ? <Notice text={error} /> : null}
      {!recovering && !error ? (
        <ActivityIndicator color={colors.accent} />
      ) : recovering ? (
        <>
          <TextField
            label="Contraseña nueva"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            footer={<PasswordRules password={password} />}
          />
          <TextField
            label="Repite la contraseña"
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          <Button label="Guardar y entrar" onPress={onSubmit} loading={busy} />
        </>
      ) : null}
      <Button label="Volver a entrar" kind="link" onPress={() => router.replace('/entrar')} />
    </Screen>
  );
}
