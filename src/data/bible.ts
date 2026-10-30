import { useEffect, useState } from 'react';

import type { BibleBook, BibleMark, BibleRead, Verse } from '@/core/bible';
import { useAuth } from './auth';
import { demoRows } from './demo';
import { useRows } from './live';
import { db } from './powersync/database';
import { deleteRecord, insertRecord, updateRecord, usePersonalSpace, useRecords } from './records';
import { supabase } from './supabase';

// Biblia RV 1909 (migración 20261025190000_bible.sql). El texto se pide en línea, capítulo por
// capítulo, y lo leído queda guardado en el teléfono (tabla local bible_cache) para leerlo sin
// conexión. El avance, los favoritos y las reflexiones se sincronizan.

export function useBibleBooks(): BibleBook[] {
  const { data } = useRows<BibleBook>('SELECT * FROM bible_books ORDER BY ord', [], () => supabase.from('bible_books').select('*').order('ord'), 'bible_books');
  return data.map((b) => ({ ...b, ord: Number(b.ord), chapters: Number(b.chapters) }));
}

const memoryCache = new Map<string, Verse[]>();

async function readCache(book: string, chapter: number): Promise<Verse[] | null> {
  const key = `${book}:${chapter}`;
  if (!db) return memoryCache.get(key) ?? null;
  const row = await db.getOptional<{ verses: string }>('SELECT verses FROM bible_cache WHERE id = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.verses) as Verse[];
  } catch {
    return null;
  }
}

async function writeCache(book: string, chapter: number, verses: Verse[]) {
  const key = `${book}:${chapter}`;
  if (!db) {
    memoryCache.set(key, verses);
    return;
  }
  await db.writeTransaction(async (tx) => {
    await tx.execute('DELETE FROM bible_cache WHERE id = ?', [key]);
    await tx.execute('INSERT INTO bible_cache (id, book, chapter, verses) VALUES (?, ?, ?, ?)', [key, book, chapter, JSON.stringify(verses)]);
  });
}

/** Los versículos de un capítulo: del teléfono si ya se leyó, si no del servidor. */
export async function loadChapter(book: string, chapter: number): Promise<Verse[]> {
  // En la vitrina (data/demo.ts) el capítulo sale de los datos de ejemplo.
  const demo = demoRows(`bible_verses:${book}:${chapter}`);
  if (demo) return demo as Verse[];
  const cached = await readCache(book, chapter);
  if (cached?.length) return cached;
  const { data, error } = await supabase.from('bible_verses').select('verse, body').eq('book', book).eq('chapter', chapter).order('verse');
  if (error) throw error;
  const verses = (data ?? []).map((v) => ({ verse: Number(v.verse), body: String(v.body) }));
  if (verses.length) await writeCache(book, chapter, verses);
  return verses;
}

export function useChapter(book: string, chapter: number): { verses: Verse[]; loading: boolean; error: string | null } {
  const key = `${book}:${chapter}`;
  const [state, setState] = useState<{ key: string; verses: Verse[]; error: string | null }>({ key: '', verses: [], error: null });
  useEffect(() => {
    let alive = true;
    loadChapter(book, chapter)
      .then((verses) => alive && setState({ key: `${book}:${chapter}`, verses, error: null }))
      .catch(() => alive && setState({ key: `${book}:${chapter}`, verses: [], error: 'Sin conexión: este capítulo todavía no está guardado en el teléfono.' }));
    return () => {
      alive = false;
    };
  }, [book, chapter]);
  const loading = state.key !== key;
  return { verses: loading ? [] : state.verses, loading, error: loading ? null : state.error };
}

export type SearchHit = { book: string; name: string; chapter: number; verse: number; body: string };

/** Busca en toda la Biblia (en línea, sin importar tildes). */
export async function searchBible(q: string): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc('search_bible', { q, max_rows: 80 });
  if (error) throw error;
  return ((data ?? []) as SearchHit[]).map((h) => ({ ...h, chapter: Number(h.chapter), verse: Number(h.verse) }));
}

/** Avance, favoritos y reflexiones del usuario. */
export function useBibleNotes() {
  const { session } = useAuth();
  const space = usePersonalSpace();
  const reads = useRecords<BibleRead>('bible_reads', space, 'created_at');
  const marks = useRecords<BibleMark>('bible_marks', space, 'book, chapter, verse');

  const add = (table: string, values: Record<string, string | number | null>) => {
    if (!space) throw new Error('Todavía no se carga tu espacio personal. Prueba de nuevo en un momento.');
    return insertRecord(table, space, session?.user.id, values);
  };
  const markOf = (book: string, chapter: number, verse: number, kind: BibleMark['kind']) =>
    marks.find((m) => m.book === book && Number(m.chapter) === chapter && Number(m.verse) === verse && m.kind === kind) ?? null;

  return {
    reads,
    marks,
    markOf,
    isRead: (book: string, chapter: number) => reads.some((r) => r.book === book && Number(r.chapter) === chapter),
    markRead: (book: string, chapter: number, day: string) => add('bible_reads', { book, chapter, read_on: day }),
    unmarkRead: async (book: string, chapter: number) => {
      for (const r of reads.filter((x) => x.book === book && Number(x.chapter) === chapter)) await deleteRecord('bible_reads', r.id);
    },
    toggleFavorite: (book: string, chapter: number, verse: number) => {
      const fav = markOf(book, chapter, verse, 'favorite');
      return fav ? deleteRecord('bible_marks', fav.id) : add('bible_marks', { book, chapter, verse, kind: 'favorite', body: null });
    },
    /** Guarda (o borra, si queda vacía) la reflexión de un versículo. */
    saveNote: (book: string, chapter: number, verse: number, body: string) => {
      const note = markOf(book, chapter, verse, 'note');
      const text = body.trim().slice(0, 2000);
      if (note) return text ? updateRecord('bible_marks', note.id, { body: text }) : deleteRecord('bible_marks', note.id);
      return text ? add('bible_marks', { book, chapter, verse, kind: 'note', body: text }) : Promise.resolve();
    },
  };
}
