// Mensajes claros en español para los errores de la cuenta.
type MaybeAuthError = { code?: string; message?: string; status?: number } | null | undefined;

const byCode: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no coinciden.',
  email_not_confirmed: 'Falta verificar tu correo. Te lo enviamos de nuevo.',
  user_already_exists: 'Ya existe una cuenta con ese correo. Prueba entrar.',
  email_exists: 'Ya existe una cuenta con ese correo. Prueba entrar.',
  weak_password: 'La contraseña debe tener al menos 8 caracteres, con letras y números.',
  otp_expired: 'El código o el enlace venció o no es correcto. Pide otro correo.',
  access_denied: 'El enlace ya no sirve. Pide otro correo.',
  over_email_send_rate_limit: 'Espera un momento antes de pedir otro código.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento.',
  validation_failed: 'Revisa los datos ingresados.',
};

export function authErrorMessage(error: unknown): string {
  const e = error as MaybeAuthError;
  if (e?.code && byCode[e.code]) return byCode[e.code];
  const message = e?.message ?? '';
  if (message.includes('ERR_EDAD')) return 'Severa es para mayores de 14 años.';
  if (message.includes('ERR_DATO_INVALIDO')) return 'Revisa tu nombre y tu fecha de nacimiento.';
  if (/network|fetch/i.test(message)) return 'No hay conexión con el servidor. Revisa tu Internet.';
  return 'Algo salió mal. Intenta de nuevo.';
}

export function isEmailNotConfirmed(error: unknown): boolean {
  return (error as MaybeAuthError)?.code === 'email_not_confirmed';
}
