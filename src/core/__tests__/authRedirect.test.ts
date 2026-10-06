import { describe, expect, it } from '@jest/globals';
import { parseAuthRedirect } from '../authRedirect';

describe('parseAuthRedirect', () => {
  it('lee la sesión del fragmento', () => {
    const url = 'severa://verificado#access_token=AAA&expires_in=3600&refresh_token=RRR&token_type=bearer&type=signup';
    expect(parseAuthRedirect(url)).toEqual({ kind: 'session', accessToken: 'AAA', refreshToken: 'RRR' });
  });

  it('funciona con la dirección de Expo Go', () => {
    const url = 'exp://192.168.1.20:8081/--/verificado#access_token=A&refresh_token=R';
    expect(parseAuthRedirect(url)).toEqual({ kind: 'session', accessToken: 'A', refreshToken: 'R' });
  });

  it('lee el código del flujo PKCE', () => {
    expect(parseAuthRedirect('severa://verificado?code=123abc')).toEqual({ kind: 'code', code: '123abc' });
  });

  it('informa el error de un enlace vencido', () => {
    const url = 'severa://verificado#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthRedirect(url)).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    });
  });

  it('sin datos no hace nada', () => {
    expect(parseAuthRedirect('severa://verificado')).toEqual({ kind: 'none' });
  });
});
