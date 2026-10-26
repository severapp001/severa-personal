import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { continueFrom, nextChapter, parseReference, previousChapter, progress, type BibleBook } from '@/core/bible';
import { dayKey } from '@/core/today';
import { searchBible, useBibleBooks, useBibleNotes, useChapter, type SearchHit } from '@/data/bible';
import { useEntries } from '@/data/entries';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckIcon, HeartIcon } from '@/ui/icons';
import { Empty, Field, Kicker, Panel, Segmented, Sheet } from '@/ui/kit';

// Biblia Reina-Valera 1909 (frente P4, 25-10-2026), con la primera versión como referencia:
// leer por libro y capítulo, ir a un pasaje, buscar, guardar el avance, favoritos y reflexiones.

type Tab = 'leer' | 'buscar' | 'notas';
type Place = { book: string; chapter: number; verse?: number | null };

export default function BibliaScreen() {
  const { colors } = useTheme();
  const books = useBibleBooks();
  const notes = useBibleNotes();
  // Desde el Pan de vida se llega con ?libro=PSA&cap=23&v=1 y se abre ese versículo (26-10-2026).
  const params = useLocalSearchParams<{ libro?: string; cap?: string; v?: string }>();
  const [tab, setTab] = useState<Tab>('leer');
  const [place, setPlace] = useState<Place | null>(params.libro && params.cap ? { book: params.libro, chapter: Number(params.cap), verse: params.v ? Number(params.v) : null } : null);
  const current: Place = place ?? continueFrom(books, notes.reads);
  const open = (p: Place) => {
    setPlace(p);
    setTab('leer');
  };

  return (
    <Screen scroll={false}>
      <ModuleHeader kicker="Reina-Valera 1909" title="Biblia" />
      <Segmented
        options={[
          { value: 'leer', label: 'Leer' },
          { value: 'buscar', label: 'Buscar' },
          { value: 'notas', label: 'Mis notas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!books.length ? (
        <AppText muted>Cargando los libros… (la primera vez necesita conexión)</AppText>
      ) : tab === 'leer' ? (
        <Reader key={`${current.book}:${current.chapter}:${current.verse ?? ''}`} books={books} notes={notes} place={current} onGo={open} />
      ) : tab === 'buscar' ? (
        <Search books={books} onOpen={open} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: space.md }}>
          <MyNotes books={books} notes={notes} onOpen={open} />
          <AppText variant="caption" muted style={{ color: colors.muted }}>
            Texto de dominio público, de eBible.org.
          </AppText>
        </ScrollView>
      )}
    </Screen>
  );
}

function Reader({ books, notes, place, onGo }: { books: BibleBook[]; notes: ReturnType<typeof useBibleNotes>; place: Place; onGo: (p: Place) => void }) {
  const { colors } = useTheme();
  const today = dayKey(new Date());
  const book = books.find((b) => b.code === place.book) ?? books[0];
  const { verses, loading, error } = useChapter(book.code, place.chapter);
  const [picker, setPicker] = useState<'book' | 'chapter' | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ref, setRef] = useState('');
  const [refError, setRefError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});
  const prog = progress(notes.reads);
  const read = notes.isRead(book.code, place.chapter);
  const next = nextChapter(books, book.code, place.chapter);
  const prev = previousChapter(books, book.code, place.chapter);

  const go = () => {
    const r = parseReference(ref, books);
    if (!r) return setRefError('No encontré ese pasaje. Prueba con «Juan 3:16» o «Salmos 23».');
    setRefError(null);
    setRef('');
    onGo(r);
  };

  return (
    <>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={() => setPicker('book')} style={[styles.pick, { backgroundColor: colors.surface }]}>
          <AppText variant="label">{book.name}</AppText>
          <CaretDownIcon size={14} color={colors.muted} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setPicker('chapter')} style={[styles.pick, { backgroundColor: colors.surface }]}>
          <AppText variant="label">{`Cap. ${place.chapter}`}</AppText>
          <CaretDownIcon size={14} color={colors.muted} />
        </Pressable>
        <AppText variant="caption" muted style={{ flex: 1, textAlign: 'right' }}>
          {`${prog.percent} % leído`}
        </AppText>
      </View>
      <View style={[styles.input, { backgroundColor: colors.surface }]}>
        <TextInput
          value={ref}
          onChangeText={setRef}
          placeholder="Ir a… (Juan 3:16)"
          placeholderTextColor={colors.muted}
          onSubmitEditing={go}
          returnKeyType="go"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
        />
      </View>
      {refError ? <Notice text={refError} tone="mid" /> : null}
      {place.verse && verses.length ? <VerseFocus books={books} notes={notes} book={book} place={place} verses={verses} onGo={onGo} /> : null}

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: space.xl }}>
        {loading ? <AppText muted>Cargando…</AppText> : null}
        {error ? <Notice text={error} /> : null}
        {verses.map((v) => {
          const fav = !!notes.markOf(book.code, place.chapter, v.verse, 'favorite');
          const note = notes.markOf(book.code, place.chapter, v.verse, 'note');
          const target = place.verse === v.verse;
          return (
            <Pressable
              key={v.verse}
              onLayout={(e) => {
                positions.current[v.verse] = e.nativeEvent.layout.y;
                if (target) scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 40), animated: false });
              }}
              onPress={() => setSelected(v.verse)}
              style={[styles.verse, (fav || target) && { backgroundColor: target ? colors.accentSoft : colors.surface }]}
            >
              <AppText style={styles.text}>
                <AppText variant="caption" color={colors.accent} style={{ fontFamily: fonts.bold }}>
                  {`${v.verse}  `}
                </AppText>
                {v.body}
              </AppText>
              {fav || note ? (
                <AppText variant="caption" color={colors.accent}>
                  {[fav ? '♥ Favorito' : null, note ? `Reflexión: ${note.body}` : null].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
        {verses.length ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Button
              label={read ? 'Capítulo leído ✓' : 'Marcar capítulo como leído'}
              kind={read ? 'secondary' : 'primary'}
              onPress={() => {
                tap();
                if (read) notes.unmarkRead(book.code, place.chapter);
                else notes.markRead(book.code, place.chapter, today);
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>{prev ? <NavButton label="Anterior" back onPress={() => onGo(prev)} /> : null}</View>
              <View style={{ flex: 1 }}>
                {next ? (
                  <NavButton
                    label="Siguiente"
                    onPress={() => {
                      if (!read) notes.markRead(book.code, place.chapter, today);
                      onGo(next);
                    }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Sheet visible={picker === 'book'} title="Libros" onClose={() => setPicker(null)}>
        {(['AT', 'NT'] as const).map((t) => (
          <View key={t} style={{ gap: 6 }}>
            <Kicker>{t === 'AT' ? 'Antiguo Testamento' : 'Nuevo Testamento'}</Kicker>
            <View style={styles.grid}>
              {books
                .filter((b) => b.testament === t)
                .map((b) => (
                  <Pressable
                    key={b.code}
                    accessibilityRole="button"
                    onPress={() => {
                      setPicker(null);
                      onGo({ book: b.code, chapter: 1 });
                    }}
                    style={[styles.cell, { backgroundColor: b.code === book.code ? colors.accent : colors.surface2 }]}
                  >
                    <AppText variant="label" style={{ fontSize: 13 }} color={b.code === book.code ? colors.onAccent : colors.text}>
                      {b.name}
                    </AppText>
                  </Pressable>
                ))}
            </View>
          </View>
        ))}
      </Sheet>
      <Sheet visible={picker === 'chapter'} title={book.name} onClose={() => setPicker(null)}>
        <View style={styles.grid}>
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => {
            const done = notes.isRead(book.code, c);
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Capítulo ${c}${done ? ', leído' : ''}`}
                onPress={() => {
                  setPicker(null);
                  onGo({ book: book.code, chapter: c });
                }}
                style={[styles.num, { backgroundColor: c === place.chapter ? colors.accent : done ? colors.okSoft : colors.surface2 }]}
              >
                <AppText variant="label" color={c === place.chapter ? colors.onAccent : done ? colors.ok : colors.text}>
                  {c}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
      <VerseSheet key={selected ?? 0} notes={notes} book={book} chapter={place.chapter} verse={selected} body={verses.find((v) => v.verse === selected)?.body ?? ''} onClose={() => setSelected(null)} />
    </>
  );
}

/** Un versículo a la vez (usuario, 26-10-2026: «mostrar el versículo que salió en el pan de vida y
 *  moverse al siguiente o al anterior»), con favorito y «leído hoy», que cuenta para la racha. */
function VerseFocus({ books, notes, book, place, verses, onGo }: { books: BibleBook[]; notes: ReturnType<typeof useBibleNotes>; book: BibleBook; place: Place; verses: { verse: number; body: string }[]; onGo: (p: Place) => void }) {
  const { colors } = useTheme();
  const log = useEntries('biblia');
  const today = dayKey(new Date());
  const v = verses.find((x) => x.verse === place.verse) ?? verses[0];
  const fav = !!notes.markOf(book.code, place.chapter, v.verse, 'favorite');
  const readToday = log.of('lectura').find((e) => e.day === today && e.title === `${book.code} ${place.chapter}:${v.verse}`);
  const last = verses.at(-1)?.verse ?? 1;
  const go = (delta: 1 | -1) => {
    tap();
    if (delta > 0 && v.verse < last) return onGo({ ...place, verse: v.verse + 1 });
    if (delta < 0 && v.verse > 1) return onGo({ ...place, verse: v.verse - 1 });
    const other = delta > 0 ? nextChapter(books, book.code, place.chapter) : previousChapter(books, book.code, place.chapter);
    if (other) onGo({ ...other, verse: 1 });
  };
  return (
    <View style={[styles.focus, { backgroundColor: colors.surface }]}>
      <Kicker color={colors.accent}>{`${book.name} ${place.chapter}:${v.verse}`}</Kicker>
      <AppText style={{ fontSize: 21, lineHeight: 30, fontFamily: fonts.semibold }}>{`«${v.body}»`}</AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <NavButton label="Anterior" back onPress={() => go(-1)} />
        </View>
        <View style={{ flex: 1 }}>
          <NavButton label="Siguiente" onPress={() => go(1)} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            notes.toggleFavorite(book.code, place.chapter, v.verse);
          }}
          style={[styles.fav, { flex: 1, backgroundColor: fav ? colors.accentSoft : colors.surface2 }]}
        >
          <HeartIcon size={18} weight={fav ? 'fill' : 'regular'} color={colors.accent} />
          <AppText variant="label">{fav ? 'Favorito' : 'Favorito'}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            if (readToday) log.remove(readToday.id);
            else log.add({ kind: 'lectura', day: today, title: `${book.code} ${place.chapter}:${v.verse}` });
          }}
          style={[styles.fav, { flex: 1, backgroundColor: readToday ? colors.okSoft : colors.surface2 }]}
        >
          <CheckIcon size={18} color={readToday ? colors.ok : colors.muted} />
          <AppText variant="label" color={readToday ? colors.ok : colors.text}>
            {readToday ? 'Leído hoy' : 'Marcar leído'}
          </AppText>
        </Pressable>
      </View>
      <AppText variant="caption" color={colors.accent} onPress={() => onGo({ book: book.code, chapter: place.chapter })}>
        Ver el capítulo completo
      </AppText>
    </View>
  );
}

function NavButton({ label, back, onPress }: { label: string; back?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = back ? CaretLeftIcon : CaretRightIcon;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.nav, { backgroundColor: colors.surface }]}>
      {back ? <Icon size={16} color={colors.text} /> : null}
      <AppText variant="label">{label}</AppText>
      {back ? null : <Icon size={16} color={colors.text} />}
    </Pressable>
  );
}

function VerseSheet({ notes, book, chapter, verse, body, onClose }: { notes: ReturnType<typeof useBibleNotes>; book: BibleBook; chapter: number; verse: number | null; body: string; onClose: () => void }) {
  const { colors } = useTheme();
  const existing = verse ? notes.markOf(book.code, chapter, verse, 'note') : null;
  const fav = verse ? !!notes.markOf(book.code, chapter, verse, 'favorite') : false;
  const [text, setText] = useState(existing?.body ?? '');
  return (
    <Sheet visible={verse !== null} title={`${book.name} ${chapter}:${verse ?? ''}`} onClose={onClose}>
      <AppText style={styles.text}>{body}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          if (verse) notes.toggleFavorite(book.code, chapter, verse);
        }}
        style={[styles.fav, { backgroundColor: fav ? colors.accentSoft : colors.surface2 }]}
      >
        <HeartIcon size={18} weight={fav ? 'fill' : 'regular'} color={colors.accent} />
        <AppText variant="label">{fav ? 'En tus favoritos' : 'Agregar a favoritos'}</AppText>
      </Pressable>
      <Field label="Tu reflexión" value={text} onChangeText={setText} multiline placeholder="Lo que este versículo te dice hoy…" />
      <Button
        label="Guardar reflexión"
        onPress={async () => {
          if (verse) await notes.saveNote(book.code, chapter, verse, text);
          onClose();
        }}
      />
    </Sheet>
  );
}

function Search({ books, onOpen }: { books: BibleBook[]; onOpen: (p: Place) => void }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const text = q.trim();
    if (!text) return;
    const ref = parseReference(text, books);
    if (ref) return onOpen(ref);
    setBusy(true);
    setError(null);
    try {
      setHits(await searchBible(text));
    } catch {
      setError('La búsqueda necesita conexión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={[styles.input, { backgroundColor: colors.surface }]}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Palabras (amor, pastor) o un pasaje"
          placeholderTextColor={colors.muted}
          onSubmitEditing={run}
          returnKeyType="search"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
        />
      </View>
      <Button label="Buscar" loading={busy} onPress={run} />
      {error ? <Notice text={error} /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: space.xl }}>
        {hits === null ? null : hits.length ? (
          <>
            <AppText variant="caption" muted>
              {hits.length >= 80 ? 'Los primeros 80 resultados' : `${hits.length} resultados`}
            </AppText>
            {hits.map((h) => (
              <Pressable key={`${h.book}${h.chapter}:${h.verse}`} onPress={() => onOpen({ book: h.book, chapter: h.chapter, verse: h.verse })} style={[styles.hit, { backgroundColor: colors.surface }]}>
                <AppText variant="label" color={colors.accent}>{`${h.name} ${h.chapter}:${h.verse}`}</AppText>
                <AppText variant="body" style={{ fontSize: 15 }}>
                  {h.body}
                </AppText>
              </Pressable>
            ))}
          </>
        ) : (
          <Empty text="Sin resultados. Prueba con otra palabra." />
        )}
      </ScrollView>
    </>
  );
}

function MyNotes({ books, notes, onOpen }: { books: BibleBook[]; notes: ReturnType<typeof useBibleNotes>; onOpen: (p: Place) => void }) {
  const { colors } = useTheme();
  const name = (code: string) => books.find((b) => b.code === code)?.name ?? code;
  const ord = (code: string) => books.find((b) => b.code === code)?.ord ?? 0;
  const sorted = [...notes.marks].sort((a, b) => ord(a.book) - ord(b.book) || Number(a.chapter) - Number(b.chapter) || Number(a.verse) - Number(b.verse));
  const prog = progress(notes.reads);
  return (
    <>
      <Panel>
        <Kicker>Tu avance</Kicker>
        <AppText variant="title">{`${prog.percent} %`}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CheckIcon size={16} color={colors.ok} />
          <AppText variant="caption" muted>{`${prog.chapters} de 1.189 capítulos leídos`}</AppText>
        </View>
      </Panel>
      {(['favorite', 'note'] as const).map((k) => {
        const list = sorted.filter((m) => m.kind === k);
        return (
          <Panel key={k}>
            <Kicker>{k === 'favorite' ? 'Favoritos' : 'Reflexiones'}</Kicker>
            {list.length ? (
              list.map((m) => (
                <Pressable key={m.id} onPress={() => onOpen({ book: m.book, chapter: Number(m.chapter), verse: Number(m.verse) })} style={{ gap: 2, paddingVertical: 4 }}>
                  <AppText variant="label" color={colors.accent}>{`${name(m.book)} ${m.chapter}:${m.verse}`}</AppText>
                  {m.body ? (
                    <AppText variant="caption" muted>
                      {m.body}
                    </AppText>
                  ) : null}
                </Pressable>
              ))
            ) : (
              <Empty text={k === 'favorite' ? 'Toca un versículo para guardarlo en favoritos.' : 'Toca un versículo para escribir lo que te dice.'} />
            )}
          </Panel>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  focus: { borderRadius: 20, padding: space.lg, gap: space.md },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  input: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 12 },
  verse: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 6, gap: 2 },
  text: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 27 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  num: { width: 46, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 12 },
  fav: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12 },
  hit: { borderRadius: 14, padding: 12, gap: 4 },
});
