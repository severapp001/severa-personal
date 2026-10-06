// Lee el enlace con el que vuelve la persona después de tocar el botón del correo
// (confirmar el correo o cambiar la contraseña). Supabase devuelve los datos de la sesión
// en el fragmento (#access_token=…&type=signup|recovery) o un error.

export type AuthLinkType = 'signup' | 'recovery' | 'other';

export type AuthRedirect =
  | { kind: 'session'; accessToken: string; refreshToken: string; type: AuthLinkType }
  | { kind: 'code'; code: string }
  | { kind: 'error'; code: string; description: string }
  | { kind: 'none' };

function params(part: string): URLSearchParams {
  return new URLSearchParams(part.replace(/^[#?]/, ''));
}

function linkType(value: string | null): AuthLinkType {
  if (value === 'signup' || value === 'recovery') return value;
  return 'other';
}

export function parseAuthRedirect(url: string): AuthRedirect {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? params(url.slice(hashIndex)) : new URLSearchParams();
  const query =
    queryIndex >= 0 ? params(url.slice(queryIndex, hashIndex > queryIndex ? hashIndex : undefined)) : new URLSearchParams();
  const get = (key: string) => hash.get(key) ?? query.get(key);

  const error = get('error_code') ?? get('error');
  if (error) return { kind: 'error', code: error, description: get('error_description') ?? '' };

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, type: linkType(get('type')) };

  const code = get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'none' };
}
