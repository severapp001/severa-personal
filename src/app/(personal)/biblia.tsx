import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { continueFrom, nextChapter, parseReference, previousChapter, progress, type BibleBook } from '@/core/bible';
import { dayKey } from '@/core/today';
import { searchBible, useBibleBooks, useBibleNotes, useChapter, type SearchHit } from '@/data/bible';
import { useEntries } from '@/data/entries';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckIcon, HeartIcon, ListIcon, MagnifyingGlassIcon, PencilSimpleIcon } from '@/ui/icons';
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
  const saved = useEntries('biblia').of('posicion')[0];
  const resume = saved && saved.data.book ? { book: String(saved.data.book), chapter: Number(saved.data.chapter) || 1, verse: Number(saved.data.verse) || 1 } : null;
  const current: Place = place ?? resume ?? { ...continueFrom(books, notes.reads), verse: 1 };
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
        <Reader key={`${current.book}:${current.chapter}`} books={books} notes={notes} place={current} onGo={open} />
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

// Lectura de a un versículo (usuario, 26-10-2026: «se ven los versículos en fila, me gustaría que
// solo se vea en pantalla el versículo en el cual se está en progreso»). Se avanza con las flechas
// o deslizando el dedo; al pasar el último versículo, el capítulo queda leído solo y se sigue con
// el siguiente. Severa recuerda dónde quedaste y cada día que lees suma a la racha.
function Reader({ books, notes, place, onGo }: { books: BibleBook[]; notes: ReturnType<typeof useBibleNotes>; place: Place; onGo: (p: Place) => void }) {
  const { colors } = useTheme();
  const log = useEntries('biblia');
  const today = dayKey(new Date());
  const book = books.find((b) => b.code === place.book) ?? books[0];
  const { verses, loading, error } = useChapter(book.code, place.chapter);
  const [picker, setPicker] = useState<'book' | 'chapter' | null>(null);
  const [note, setNote] = useState<number | null>(null);
  const [whole, setWhole] = useState(false);
  const [searching, setSearching] = useState(false);
  const [ref, setRef] = useState('');
  const [refError, setRefError] = useState<string | null>(null);
  const prog = progress(notes.reads);
  const last = verses.at(-1)?.verse ?? 1;
  const current = verses.find((v) => v.verse === (place.verse ?? 1)) ?? verses[0];
  const fav = current ? !!notes.markOf(book.code, place.chapter, current.verse, 'favorite') : false;
  const hasNote = current ? !!notes.markOf(book.code, place.chapter, current.verse, 'note') : false;

  // Guarda dónde quedaste y cuenta el día para la racha (una vez al día).
  async function remember(p: Place) {
    const pos = log.of('posicion')[0];
    const data = { book: p.book, chapter: p.chapter, verse: p.verse ?? 1 };
    try {
      if (pos) await log.update(pos.id, { data, day: today });
      else await log.add({ kind: 'posicion', day: today, data });
      if (!log.of('lectura').some((e) => e.day === today)) await log.add({ kind: 'lectura', day: today, title: `${p.book} ${p.chapter}:${p.verse ?? 1}` });
    } catch {
      // Sin espacio cargado: se intenta en el próximo paso.
    }
  }

  const go = (p: Place) => {
    onGo(p);
    remember(p);
  };

  function step(delta: 1 | -1) {
    if (!current) return;
    tap();
    if (delta > 0 && current.verse < last) return go({ ...place, verse: current.verse + 1 });
    if (delta < 0 && current.verse > 1) return go({ ...place, verse: current.verse - 1 });
    if (delta > 0 && !notes.isRead(book.code, place.chapter)) notes.markRead(book.code, place.chapter, today);
    const other = delta > 0 ? nextChapter(books, book.code, place.chapter) : previousChapter(books, book.code, place.chapter);
    if (other) go({ ...other, verse: 1 });
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -50) scheduleOnRN(step, 1);
      else if (e.translationX > 50) scheduleOnRN(step, -1);
    });

  const goRef = () => {
    const r = parseReference(ref, books);
    if (!r) return setRefError('No encontré ese pasaje. Prueba con «Juan 3:16» o «Salmos 23».');
    setRefError(null);
    setRef('');
    setSearching(false);
    go({ ...r, verse: r.verse ?? 1 });
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
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Ir a un pasaje" onPress={() => setSearching(!searching)} style={[styles.round, { backgroundColor: colors.surface }]}>
          <MagnifyingGlassIcon size={18} color={colors.text} />
        </Pressable>
      </View>
      {searching ? (
        <View style={[styles.input, { backgroundColor: colors.surface }]}>
          <TextInput
            autoFocus
            value={ref}
            onChangeText={setRef}
            placeholder="Ir a… (Juan 3:16)"
            placeholderTextColor={colors.muted}
            onSubmitEditing={goRef}
            returnKeyType="go"
            style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
          />
        </View>
      ) : null}
      {refError ? <Notice text={refError} tone="mid" /> : null}
      {loading ? <AppText muted>Cargando…</AppText> : null}
      {error ? <Notice text={error} /> : null}

      {whole ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: space.xl }}>
          {verses.map((v) => (
            <Pressable
              key={v.verse}
              onPress={() => {
                setWhole(false);
                go({ ...place, verse: v.verse });
              }}
              style={[styles.verse, v.verse === current?.verse && { backgroundColor: colors.accentSoft }]}
            >
              <AppText style={styles.text}>
                <AppText variant="caption" color={colors.accent} style={{ fontFamily: fonts.bold }}>
                  {`${v.verse}  `}
                </AppText>
                {v.body}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : current ? (
        <GestureDetector gesture={swipe}>
          <View style={{ flex: 1, justifyContent: 'center' }} collapsable={false}>
            <Animated.View key={`${book.code}:${place.chapter}:${current.verse}`} entering={FadeIn.duration(220)} style={[styles.card, { backgroundColor: colors.surface }]}>
              <Kicker color={colors.accent}>{`${book.name} ${place.chapter}:${current.verse}`}</Kicker>
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                <AppText style={styles.big}>{current.body}</AppText>
              </ScrollView>
              <View style={{ gap: 6 }}>
                <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
                  <View style={{ width: `${(current.verse / last) * 100}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 3 }} />
                </View>
                <AppText variant="caption" muted>{`Versículo ${current.verse} de ${last} · ${prog.percent} % de la Biblia leído`}</AppText>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}

      {!whole && current ? (
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Versículo anterior" onPress={() => step(-1)} style={[styles.ctl, { backgroundColor: colors.surface }]}>
            <CaretLeftIcon size={22} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onPress={() => {
              tap();
              notes.toggleFavorite(book.code, place.chapter, current.verse);
            }}
            style={[styles.ctl, { backgroundColor: fav ? colors.accentSoft : colors.surface }]}
          >
            <HeartIcon size={22} weight={fav ? 'fill' : 'regular'} color={colors.accent} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Tu reflexión" onPress={() => setNote(current.verse)} style={[styles.ctl, { backgroundColor: hasNote ? colors.accentSoft : colors.surface }]}>
            <PencilSimpleIcon size={22} color={hasNote ? colors.accent : colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver el capítulo completo" onPress={() => setWhole(true)} style={[styles.ctl, { backgroundColor: colors.surface }]}>
            <ListIcon size={22} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Versículo siguiente" onPress={() => step(1)} style={[styles.ctl, styles.next, { backgroundColor: colors.accent }]}>
            <CaretRightIcon size={22} color={colors.onAccent} />
          </Pressable>
        </View>
      ) : whole ? (
        <Button label="Volver al versículo" kind="secondary" onPress={() => setWhole(false)} />
      ) : null}

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
                      go({ book: b.code, chapter: 1, verse: 1 });
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
                  go({ book: book.code, chapter: c, verse: 1 });
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
      <VerseSheet key={note ?? 0} notes={notes} book={book} chapter={place.chapter} verse={note} body={verses.find((v) => v.verse === note)?.body ?? ''} onClose={() => setNote(null)} />
    </>
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
  card: { borderRadius: 24, padding: space.xl, gap: space.lg, minHeight: 260 },
  big: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 35 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: space.sm },
  ctl: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  next: { width: 74 },
  round: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  input: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 12 },
  verse: { borderRadius: 10, paddingVertical: 4, paddingHorizontal: 6, gap: 2 },
  text: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 27 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  num: { width: 46, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fav: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12 },
  hit: { borderRadius: 14, padding: 12, gap: 4 },
});
