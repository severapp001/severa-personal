import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { useAuth } from '@/data/auth';
import { authErrorMessage, isEmailNotConfirmed } from '@/features/account/authErrors';
import { AppText, Button, Notice, Screen, TextField } from '@/ui';

// F01 · Entrar con correo y contraseña.
export default function EntrarScreen() {
  const { signIn, resendCode, bootstrapError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function onSubmit() {
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      if (isEmailNotConfirmed(e)) {
        await resendCode(email).catch(() => undefined);
        router.push({ pathname: '/verificar', params: { email: email.trim().toLowerCase() } });
      } else {
        setError(authErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="caption" muted style={{ letterSpacing: 2 }}>
        SEVERA
      </AppText>
      <AppText variant="title">Entrar</AppText>
      <AppText muted>Tu vida y tu trabajo, en un solo cerebro.</AppText>

      {bootstrapError ? <Notice text={authErrorMessage({ message: bootstrapError })} /> : null}
      {error ? <Notice text={error} /> : null}

      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button label="Entrar" onPress={onSubmit} loading={busy} />
      <Button label="Crear una cuenta" kind="link" onPress={() => router.push('/crear-cuenta')} />
    </Screen>
  );
}
