import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/data/auth';
import { authErrorMessage } from '@/features/account/authErrors';
import { AppText, Button, Notice, Screen, TextField } from '@/ui';

// F06 · ¿Olvidaste tu contraseña? Llega un correo con un enlace para escribir una nueva.
export default function RecuperarScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Revisa el correo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">Cambiar tu contraseña</AppText>
      {sent ? (
        <>
          <Notice tone="ok" text="Listo. Si hay una cuenta con ese correo, te llegará un enlace." />
          <AppText muted>Ábrelo en este teléfono y toca el enlace: la app se abre para que escribas la contraseña nueva.</AppText>
        </>
      ) : (
        <>
          <AppText muted>Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.</AppText>
          {error ? <Notice text={error} /> : null}
          <TextField
            label="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
          />
          <Button label="Enviar enlace" onPress={onSubmit} loading={busy} />
        </>
      )}
      <Button label="Volver a entrar" kind="link" onPress={() => router.replace('/entrar')} />
    </Screen>
  );
}
