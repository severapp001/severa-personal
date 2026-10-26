// Regla de la contraseña de Severa (F01, F06): al menos 8 caracteres, con letras y números.
// Las mismas comprobaciones se muestran en vivo mientras se escribe.

export const PASSWORD_MIN = 8;

export type PasswordCheck = { key: 'length' | 'letters' | 'digits'; label: string; ok: boolean };

export function passwordChecks(password: string): PasswordCheck[] {
  const n = [...password].length;
  return [
    { key: 'length', label: n >= PASSWORD_MIN ? `${n} caracteres` : `${n} de ${PASSWORD_MIN} caracteres`, ok: n >= PASSWORD_MIN },
    { key: 'letters', label: 'Letras', ok: /\p{L}/u.test(password) },
    { key: 'digits', label: 'Números', ok: /\d/.test(password) },
  ];
}

export const isValidPassword = (password: string) => passwordChecks(password).every((c) => c.ok);
