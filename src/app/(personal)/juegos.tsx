import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { dayKey } from '@/core/today';
import { useEntries } from '@/data/entries';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Kicker, Panel, PillTabs } from '@/ui/kit';

// Juegos (P10, 26-10-2026): juegos breves para descansar la mente, con algo de matemáticas, como
// Severa. Los puntajes se guardan (motor común, módulo «juegos») y cuentan para los Logros.

type Game = 'calculo' | 'memoria';

export default function JuegosScreen() {
  const [game, setGame] = useState<Game>('calculo');
  const store = useEntries('juegos');
  const scores = store.of('puntaje');
  const best = (g: Game, higher: boolean) => {
    const list = scores.filter((s) => s.data.juego === g).map((s) => Number(s.value) || 0);
    return list.length ? (higher ? Math.max(...list) : Math.min(...list)) : null;
  };
  const save = (g: Game, value: number) => store.add({ kind: 'puntaje', day: dayKey(new Date()), value, data: { juego: g } });

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Juegos" />
      <PillTabs
        options={[
          { value: 'calculo', label: 'Cálculo rápido' },
          { value: 'memoria', label: 'Memoria áurea' },
        ]}
        value={game}
        onChange={setGame}
      />
      {game === 'calculo' ? <Calc best={best('calculo', true)} onEnd={(n) => save('calculo', n)} /> : <Memory best={best('memoria', false)} onEnd={(n) => save('memoria', n)} />}
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>{`${scores.length} ${scores.length === 1 ? 'partida jugada' : 'partidas jugadas'}`}</AppText>
    </Screen>
  );
}

// ─── Cálculo rápido: 60 segundos, toca la respuesta correcta ─────────────────
type Problem = { text: string; answer: number; options: number[] };
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
function makeProblem(level: number): Problem {
  const kind = rnd(0, level > 6 ? 2 : 1);
  let a = rnd(2, 9 + level * 2);
  let b = rnd(2, 9 + level);
  let text: string;
  let answer: number;
  if (kind === 0) {
    text = `${a} + ${b}`;
    answer = a + b;
  } else if (kind === 1) {
    if (b > a) [a, b] = [b, a];
    text = `${a} − ${b}`;
    answer = a - b;
  } else {
    a = rnd(2, 9);
    b = rnd(2, 9);
    text = `${a} × ${b}`;
    answer = a * b;
  }
  const options = new Set([answer]);
  while (options.size < 4) options.add(Math.max(0, answer + rnd(-6, 6)));
  return { text, answer, options: [...options].sort(() => Math.random() - 0.5) };
}

function Calc({ best, onEnd }: { best: number | null; onEnd: (score: number) => void }) {
  const { colors } = useTheme();
  const [left, setLeft] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const playing = left !== null && left > 0;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setLeft((l) => (l === null ? null : l - 1)), 1000);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (left === 0) onEnd(score);
    // Se guarda una vez, cuando el tiempo llega a cero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const start = () => {
    tap();
    setScore(0);
    setLeft(60);
    setProblem(makeProblem(0));
  };
  const pick = (n: number) => {
    if (!problem || !playing) return;
    const ok = n === problem.answer;
    tap();
    setFlash(ok ? 'ok' : 'bad');
    const next = ok ? score + 1 : score;
    setScore(next);
    setProblem(makeProblem(next));
  };

  if (!playing) {
    return (
      <Panel>
        <Kicker>Cálculo rápido</Kicker>
        <AppText>{left === 0 ? `¡Tiempo! Hiciste ${score} ${score === 1 ? 'punto' : 'puntos'}.` : 'Resuelve todas las operaciones que puedas en 60 segundos. Se ponen más difíciles mientras aciertas.'}</AppText>
        {best !== null ? <AppText variant="caption" muted>{`Tu mejor marca: ${best}`}</AppText> : null}
        <Button label={left === 0 ? 'Jugar otra vez' : 'Empezar'} onPress={start} />
      </Panel>
    );
  }
  return (
    <Panel>
      <View style={styles.between}>
        <Kicker>{`Puntos: ${score}`}</Kicker>
        <AppText variant="label" color={left! <= 10 ? colors.bad : colors.muted} style={{ fontVariant: ['tabular-nums'] }}>{`${left} s`}</AppText>
      </View>
      <Animated.View key={problem?.text} entering={ZoomIn.duration(180)} style={{ alignItems: 'center', paddingVertical: 18 }}>
        <AppText style={{ fontFamily: fonts.extrabold, fontSize: 48, fontVariant: ['tabular-nums'] }} color={flash === 'bad' ? colors.bad : colors.text}>
          {problem?.text}
        </AppText>
      </Animated.View>
      <View style={styles.options}>
        {problem?.options.map((n) => (
          <Pressable key={n} accessibilityRole="button" onPress={() => pick(n)} style={({ pressed }) => [styles.option, { backgroundColor: pressed ? colors.accent : colors.surface2 }]}>
            <AppText style={{ fontFamily: fonts.extrabold, fontSize: 26, fontVariant: ['tabular-nums'] }}>{String(n)}</AppText>
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

// ─── Memoria áurea: parejas de números de Fibonacci ──────────────────────────
const FIB = [1, 2, 3, 5, 8, 13];
const deck = () => [...FIB, ...FIB].map((n, i) => ({ id: i, n })).sort(() => Math.random() - 0.5);

function Memory({ best, onEnd }: { best: number | null; onEnd: (moves: number) => void }) {
  const { colors } = useTheme();
  const [cards, setCards] = useState<{ id: number; n: number }[] | null>(null);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const done = !!cards && found.length === cards.length;

  const start = () => {
    tap();
    setCards(deck());
    setOpen([]);
    setFound([]);
    setMoves(0);
  };
  const flip = (id: number) => {
    if (!cards || open.includes(id) || found.includes(id) || open.length === 2) return;
    tap();
    const next = [...open, id];
    setOpen(next);
    if (next.length === 2) {
      const [a, b] = next.map((x) => cards.find((c) => c.id === x)!);
      const m = moves + 1;
      setMoves(m);
      setTimeout(() => {
        if (a.n === b.n) {
          const f = [...found, a.id, b.id];
          setFound(f);
          if (f.length === cards.length) onEnd(m);
        }
        setOpen([]);
      }, a.n === b.n ? 250 : 700);
    }
  };

  if (!cards) {
    return (
      <Panel>
        <Kicker>Memoria áurea</Kicker>
        <AppText>Encuentra las parejas de la sucesión de Fibonacci (1, 2, 3, 5, 8, 13), la misma de la espiral de Severa, en la menor cantidad de jugadas.</AppText>
        {best !== null ? <AppText variant="caption" muted>{`Tu mejor marca: ${best} jugadas`}</AppText> : null}
        <Button label="Empezar" onPress={start} />
      </Panel>
    );
  }
  return (
    <Panel>
      <View style={styles.between}>
        <Kicker>{`Jugadas: ${moves}`}</Kicker>
        <AppText variant="caption" muted>{`${found.length / 2} de ${FIB.length} parejas`}</AppText>
      </View>
      <View style={styles.cards}>
        {cards.map((c) => {
          const shown = open.includes(c.id) || found.includes(c.id);
          return (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={shown ? String(c.n) : 'Carta tapada'} onPress={() => flip(c.id)} style={[styles.card, { backgroundColor: found.includes(c.id) ? colors.okSoft : shown ? colors.accentSoft : colors.surface2 }]}>
              {shown ? (
                <Animated.View entering={FadeIn.duration(150)}>
                  <AppText style={{ fontFamily: fonts.extrabold, fontSize: 26 }} color={found.includes(c.id) ? colors.ok : colors.accent}>
                    {String(c.n)}
                  </AppText>
                </Animated.View>
              ) : (
                <AppText style={{ fontSize: 22 }} color={colors.muted}>
                  φ
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
      {done ? <Button label={`¡Listo en ${moves} jugadas! Otra vez`} onPress={start} /> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { width: '48%', flexGrow: 1, borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '22%', flexGrow: 1, aspectRatio: 0.8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
