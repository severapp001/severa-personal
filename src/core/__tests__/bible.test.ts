import { describe, expect, it } from '@jest/globals';

import { continueFrom, nextChapter, parseReference, previousChapter, progress, verseOfDay, type BibleBook } from '../bible';

const books: BibleBook[] = [
  { code: 'GEN', ord: 1, name: 'Génesis', testament: 'AT', chapters: 50 },
  { code: 'PSA', ord: 19, name: 'Salmos', testament: 'AT', chapters: 150 },
  { code: 'MAL', ord: 39, name: 'Malaquías', testament: 'AT', chapters: 4 },
  { code: 'MAT', ord: 40, name: 'Mateo', testament: 'NT', chapters: 28 },
  { code: 'JOH', ord: 43, name: 'Juan', testament: 'NT', chapters: 21 },
  { code: '1CO', ord: 46, name: '1 Corintios', testament: 'NT', chapters: 16 },
  { code: 'REV', ord: 66, name: 'Apocalipsis', testament: 'NT', chapters: 22 },
];

describe('Biblia', () => {
  it('entiende referencias escritas a mano', () => {
    expect(parseReference('Juan 3:16', books)).toEqual({ book: 'JOH', chapter: 3, verse: 16 });
    expect(parseReference('salmo 23', books)).toEqual({ book: 'PSA', chapter: 23, verse: null });
    expect(parseReference('1 corintios 13.4', books)).toEqual({ book: '1CO', chapter: 13, verse: 4 });
    expect(parseReference('1co 13', books)).toEqual({ book: '1CO', chapter: 13, verse: null });
    expect(parseReference('malaquias 3', books)).toEqual({ book: 'MAL', chapter: 3, verse: null });
    expect(parseReference('Juan 30', books)).toBeNull();
    expect(parseReference('amor', books)).toBeNull();
  });

  it('avanza y retrocede cruzando libros', () => {
    expect(nextChapter(books, 'JOH', 3)).toEqual({ book: 'JOH', chapter: 4 });
    expect(nextChapter(books, 'MAL', 4)).toEqual({ book: 'MAT', chapter: 1 });
    expect(nextChapter(books, 'REV', 22)).toBeNull();
    expect(previousChapter(books, 'MAT', 1)).toEqual({ book: 'MAL', chapter: 4 });
  });

  it('guarda el avance: capítulos distintos y dónde seguir', () => {
    const reads = [
      { id: '1', book: 'JOH', chapter: 1, read_on: '2026-10-20', created_at: '2026-10-20T10:00:00Z' },
      { id: '2', book: 'JOH', chapter: 1, read_on: '2026-10-21', created_at: '2026-10-21T10:00:00Z' },
      { id: '3', book: 'JOH', chapter: 2, read_on: '2026-10-22', created_at: '2026-10-22T10:00:00Z' },
    ];
    expect(progress(reads)).toEqual({ chapters: 2, percent: 0.2 });
    expect(continueFrom(books, reads)).toEqual({ book: 'JOH', chapter: 3 });
    expect(continueFrom(books, [])).toEqual({ book: 'GEN', chapter: 1 });
  });

  it('un versículo distinto cada día', () => {
    expect(verseOfDay('2026-01-01')).toEqual({ book: 'PSA', chapter: 23, verse: 1 });
    expect(verseOfDay('2026-01-02')).toEqual({ book: 'JOH', chapter: 3, verse: 16 });
  });
});
