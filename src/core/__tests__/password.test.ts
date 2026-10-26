import { describe, expect, it } from '@jest/globals';
import { isValidPassword, passwordChecks } from '../password';

describe('passwordChecks', () => {
  it('cuenta los caracteres que faltan', () => {
    expect(passwordChecks('abc1')[0]).toEqual({ key: 'length', label: '4 de 8 caracteres', ok: false });
    expect(passwordChecks('abcdefg1')[0]).toEqual({ key: 'length', label: '8 caracteres', ok: true });
  });

  it('reconoce letras con tilde y eñe', () => {
    expect(passwordChecks('ñ')[1].ok).toBe(true);
    expect(passwordChecks('12345678')[1].ok).toBe(false);
  });

  it('pide números', () => {
    expect(passwordChecks('abcdefgh')[2].ok).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('exige las tres reglas', () => {
    expect(isValidPassword('montaña2026')).toBe(true);
    expect(isValidPassword('montaña')).toBe(false);
    expect(isValidPassword('12345678')).toBe(false);
    expect(isValidPassword('abc123')).toBe(false);
  });
});
