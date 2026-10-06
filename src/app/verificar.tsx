import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/data/auth';
import { authErrorMessage } from '@/features/account/authErrors';
import { AppText, Button, Notice, Screen, TextField } from '@/ui';

const RESEND_SECONDS = 60;

// F01 · Verificar el correo. Con el correo estándar llega un enlace («Confirmar»);
// con SMTP propio llega un código de 6 dígitos. La pantalla acepta los dos.
export default function VerificarScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const { verifyEmail, resendCode, bootstrapError } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function onVerify(value = code) {
    if (!/^\d{6}$/.test(value)) {
      setError('El código tiene 6 números.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Al verificar se abre la sesión y la app entra sola (se crea el espacio personal).
      await verifyEmail(email, value);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    try {
      await resendCode(email);
      setInfo('Te enviamos el correo de nuevo.');
      setWait(RESEND_SECONDS);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  return (
    <Screen>
      <AppText variant="title">Revisa tu correo</AppText>
      <AppText muted>
        Enviamos un correo a <AppText variant="body">{email}</AppText>. Ábrelo en este teléfono y toca
        «Confirmar»: la app se abre sola. Si te llegó un código, escríbelo aquí.
      </AppText>

      {bootstrapError ? <Notice text={authErrorMessage({ message: bootstrapError })} /> : null}
      {error ? <Notice text={error} /> : null}
      {info && !error ? <Notice text={info} tone="ok" /> : null}

      <TextField
        label="Código"
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (digits.length === 6) onVerify(digits);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
      />
      <Button label="Verificar" onPress={() => onVerify()} loading={busy} />
      <Button
        label={wait > 0 ? `Reenviar el correo en ${wait} s` : 'Reenviar el correo'}
        kind="link"
        disabled={wait > 0}
        onPress={onResend}
      />
      <AppText variant="caption" muted>
        Si confirmaste desde otro dispositivo, vuelve y entra con tu contraseña.
      </AppText>
      <Button label="Ir a entrar" kind="link" onPress={() => router.replace('/entrar')} />
    </Screen>
  );
}
