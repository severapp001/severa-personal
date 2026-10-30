import { describe, expect, it } from '@jest/globals';

import { scriptFor } from '../script';

describe('el script de Apps Script', () => {
  it('es JavaScript válido, lleva la clave y pide la búsqueda a Severa', () => {
    const code = scriptFor('abc123', '2026-10-29');
    expect(() => new Function(code)).not.toThrow();
    expect(code).toContain("var SEVERA_KEY = 'abc123';");
    expect(code).toContain("llamar({ accion: 'config' })");
    expect(code).toContain('function instalar()');
  });
});
