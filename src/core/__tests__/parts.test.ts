import { describe, expect, it } from '@jest/globals';
import { balance, CAPAS, levelOf, PART_OF_MODULE, partOfCard, transitionOf } from '../parts';

describe('Severa v3: el Ser y sus partes', () => {
  it('cada tarjeta de Hoy va a su capa', () => {
    expect(partOfCard('dia')).toBe('ser');
    expect(partOfCard('plata')).toBe('ser');
    expect(partOfCard('hab')).toBe('ser');
    expect(partOfCard('paso')).toBe('mente');
    expect(partOfCard('pan')).toBe('alma');
    expect(partOfCard('jornada')).toBe('cuerpo');
    expect(partOfCard('mod:salud')).toBe('cuerpo');
    expect(partOfCard('mod:finanzas')).toBe('ser');
    expect(partOfCard('mod:viajes')).toBe('alma');
    expect(partOfCard('yo')).toBeNull();
  });

  it('un módulo sin capa asignada cae en mente', () => {
    expect(partOfCard('mod:modulo_nuevo')).toBe('mente');
  });

  it('el Ser reúne finanzas, hábitos, logros y documentos (C65)', () => {
    for (const code of ['finanzas', 'habitos', 'logros', 'documentos', 'perfil_personal']) expect(PART_OF_MODULE[code]).toBe('ser');
    expect(CAPAS).toEqual(['ser', 'cuerpo', 'mente', 'alma']);
  });

  it('el equilibrio compara las partes que se conocen', () => {
    expect(balance([71, 62, 40])).toBe(0.69);
    expect(balance([50, 50, 50])).toBe(1);
    expect(balance([100, null, 0])).toBe(0);
    expect(balance([80, null, null])).toBeNull();
  });

  it('el nivel sube con Fibonacci: 1, 2, 3, 5, 8 y 13 logros', () => {
    expect(levelOf(0)).toEqual({ level: 0, next: 1 });
    expect(levelOf(1)).toEqual({ level: 1, next: 1 });
    expect(levelOf(4)).toEqual({ level: 3, next: 1 });
    expect(levelOf(8)).toEqual({ level: 5, next: 5 });
    expect(levelOf(20)).toEqual({ level: 6, next: null });
  });

  it('cada par de capas tiene su transición (C68)', () => {
    expect(transitionOf('mente', 'cuerpo')).toBe('baja');
    expect(transitionOf('cuerpo', 'mente')).toBe('sube');
    expect(transitionOf('cuerpo', 'alma')).toBe('latido');
    expect(transitionOf('alma', 'cuerpo')).toBe('latido');
    expect(transitionOf('mente', 'alma')).toBe('espiral');
    expect(transitionOf('ser', 'alma')).toBe('acerca');
    expect(transitionOf('mente', 'ser')).toBe('aleja');
  });
});
