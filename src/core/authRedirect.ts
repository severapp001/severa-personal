// Lee el enlace con el que vuelve la persona después de tocar «Confirmar» en el correo.
// Supabase devuelve los datos de la sesión en el fragmento (#access_token=…) o un error.

export type AuthRedirect =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; code: string; description: string }
  | { kind: 'none' };

function params(part: string): URLSearchParams {
  return new URLSearchParams(part.replace(/^[#?]/, ''));
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
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken };

  const code = get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'none' };
}
