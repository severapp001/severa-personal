import { router } from 'expo-router';
import { useState } from 'react';

import { MIN_AGE, ageOn, parseChileanDate, toIsoDate } from '@/core/age';
import { isValidPassword } from '@/core/password';
import { useAuth } from '@/data/auth';
import { authErrorMessage } from '@/features/account/authErrors';
import { AppText, Button, Checkbox, Notice, PasswordRules, Screen, TextField } from '@/ui';

type Errors = Partial<Record<'name' | 'birth' | 'email' | 'password' | 'terms', string>>;

// F01 · Crear la cuenta: lo único obligatorio es el nombre y la fecha de nacimiento (reglas de edad).
export default function CrearCuentaScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): { ok: boolean; birthIso?: string } {
    const next: Errors = {};
    if (!name.trim()) next.name = '¿Cómo te llamas?';
    const date = parseChileanDate(birth);
    if (!date || date > new Date()) next.birth = 'Escríbela como día-mes-año, por ejemplo 10-05-1990.';
    else if (ageOn(date) < MIN_AGE) next.birth = `Severa es para mayores de ${MIN_AGE} años.`;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Revisa el correo.';
    if (!isValidPassword(password)) next.password = 'Al menos 8 caracteres, con letras y números.';
    if (!terms) next.terms = 'Necesitas aceptar para continuar.';
    setErrors(next);
    return { ok: Object.keys(next).length === 0, birthIso: date ? toIsoDate(date) : undefined };
  }

  async function onSubmit() {
    const { ok, birthIso } = validate();
    if (!ok || !birthIso) return;
    setBusy(true);
    setError(null);
    try {
      await signUp({ name, birthDate: birthIso, email, password });
      router.replace({ pathname: '/verificar', params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen width="narrow">
      <AppText variant="title">Crear tu cuenta</AppText>
      <AppText muted>Después te haremos unas preguntas para armar tu Severa. Todo se puede cambiar.</AppText>

      {error ? <Notice text={error} /> : null}

      <TextField label="Nombre" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
      <TextField
        label="Fecha de nacimiento"
        value={birth}
        onChangeText={setBirth}
        placeholder="dd-mm-aaaa"
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
        hint="Decide qué módulos puedes activar."
        error={errors.birth}
      />
      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email}
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        footer={<PasswordRules password={password} />}
        error={errors.password}
      />
      <Checkbox checked={terms} onChange={setTerms}>
        <AppText variant="caption">
          Acepto los términos y la política de privacidad de la beta. Mis datos se guardan protegidos y solo yo decido con quién los comparto.
        </AppText>
      </Checkbox>
      {errors.terms ? <Notice text={errors.terms} /> : null}

      <Button label="Crear cuenta" onPress={onSubmit} loading={busy} />
      {/* Desde la bienvenida se llega con «replace»: no hay pantalla anterior a la cual volver. */}
      <Button label="Ya tengo cuenta" kind="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/entrar'))} />
    </Screen>
  );
}
