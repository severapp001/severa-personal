// Biblia Reina-Valera 1909 (frente P4, 25-10-2026), con la primera versión como referencia: leer
// por libro y capítulo, ir a un pasaje, buscar, guardar el avance, favoritos y reflexiones.
// Dominio puro: sin React ni base de datos.

export type BibleBook = { code: string; ord: number; name: string; testament: 'AT' | 'NT'; chapters: number };
export type Verse = { verse: number; body: string };
export type BibleRead = { id: string; book: string; chapter: number; read_on: string; created_at?: string | null };
export type BibleMark = { id: string; book: string; chapter: number; verse: number; kind: 'favorite' | 'note'; body: string | null };

export const TOTAL_CHAPTERS = 1189;

/** Capítulos distintos leídos y su porcentaje de toda la Biblia. */
export function progress(reads: Pick<BibleRead, 'book' | 'chapter'>[]): { chapters: number; percent: number } {
  const n = new Set(reads.map((r) => `${r.book}:${Number(r.chapter)}`)).size;
  return { chapters: n, percent: Math.round((n / TOTAL_CHAPTERS) * 1000) / 10 };
}

/** El capítulo siguiente (pasa al libro siguiente al terminar uno); null al final de Apocalipsis. */
export function nextChapter(books: BibleBook[], book: string, chapter: number): { book: string; chapter: number } | null {
  const sorted = [...books].sort((a, b) => a.ord - b.ord);
  const i = sorted.findIndex((b) => b.code === book);
  if (i < 0) return null;
  if (chapter < sorted[i].chapters) return { book, chapter: chapter + 1 };
  return sorted[i + 1] ? { book: sorted[i + 1].code, chapter: 1 } : null;
}

export function previousChapter(books: BibleBook[], book: string, chapter: number): { book: string; chapter: number } | null {
  const sorted = [...books].sort((a, b) => a.ord - b.ord);
  const i = sorted.findIndex((b) => b.code === book);
  if (i < 0) return null;
  if (chapter > 1) return { book, chapter: chapter - 1 };
  return sorted[i - 1] ? { book: sorted[i - 1].code, chapter: sorted[i - 1].chapters } : null;
}

/** Dónde seguir: el capítulo siguiente al último marcado como leído (o Génesis 1). */
export function continueFrom(books: BibleBook[], reads: BibleRead[]): { book: string; chapter: number } {
  const last = [...reads].sort((a, b) => (a.created_at ?? a.read_on).localeCompare(b.created_at ?? b.read_on)).at(-1);
  if (!last) return { book: 'GEN', chapter: 1 };
  return nextChapter(books, last.book, Number(last.chapter)) ?? { book: last.book, chapter: Number(last.chapter) };
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** «Juan 3:16», «jn 3», «1 corintios 13:4», «salmo 23» → libro, capítulo y versículo. */
export function parseReference(text: string, books: BibleBook[]): { book: string; chapter: number; verse: number | null } | null {
  const m = /^\s*([1-3]?\s*[a-záéíóúüñ. ]+?)\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3}))?\s*$/i.exec(text);
  if (!m) return null;
  const wanted = fold(m[1]).replace(/\.$/, '').replace(/^([1-3])\s*/, '$1 ');
  const aliases = (b: BibleBook) => {
    const name = fold(b.name);
    return [name, name.replace(/s$/, ''), b.code.toLowerCase()];
  };
  const book =
    books.find((b) => aliases(b).includes(wanted)) ??
    books.find((b) => wanted.length >= 2 && fold(b.name).startsWith(wanted)) ??
    null;
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  return { book: book.code, chapter, verse: m[3] ? Number(m[3]) : null };
}

/** Un versículo para cada día (se repite cada 31 días). */
const DAILY: [string, number, number][] = [
  ['PSA', 23, 1], ['JOH', 3, 16], ['PHI', 4, 13], ['ROM', 8, 28], ['JER', 29, 11], ['PRO', 3, 5], ['ISA', 41, 10],
  ['MAT', 11, 28], ['PSA', 46, 1], ['JOS', 1, 9], ['2TI', 1, 7], ['PSA', 119, 105], ['ROM', 12, 2], ['GAL', 5, 22],
  ['1CO', 13, 4], ['EPH', 2, 8], ['HEB', 11, 1], ['MAT', 6, 33], ['PSA', 37, 5], ['LAM', 3, 22], ['ISA', 40, 31],
  ['PRO', 16, 3], ['PSA', 91, 1], ['JOH', 14, 6], ['1PE', 5, 7], ['ROM', 5, 8], ['PSA', 139, 14], ['COL', 3, 23],
  ['MIC', 6, 8], ['PHI', 4, 6], ['JAM', 1, 5],
];
export function verseOfDay(day: string): { book: string; chapter: number; verse: number } {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
  const start = new Date(d.getFullYear(), 0, 1, 12);
  const n = Math.round((d.getTime() - start.getTime()) / 86_400_000);
  const [book, chapter, verse] = DAILY[n % DAILY.length];
  return { book, chapter, verse };
}
