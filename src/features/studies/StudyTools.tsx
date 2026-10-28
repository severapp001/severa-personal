import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { plusDays } from '@/core/modules';
import { isDue, review } from '@/core/srs';
import type { Entries, Entry } from '@/data/entries';
import type { Course } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';
import { AppText, Button } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon, PlusIcon } from '@/ui/icons';
import { BarRow, ChipRow, Empty, Field, Kicker, Panel } from '@/ui/kit';

// Estudios de primer nivel (usuario, 27-10-2026: «el módulo de estudios aún sigue bajo de nivel para
// una app que ayudaría a reemplazar otras… buscar inspiración, no copiar»). Tres herramientas:
// - Temario: las unidades de cada ramo, con su fecha y su avance (como «cerrar hasta la unidad 5»).
// - Estudiar ahora: sesiones con temporizador por ramo y los minutos de la semana (al estilo Pomodoro).
// - Repaso: tarjetas con repetición espaciada (al estilo Anki), las que tocan hoy.
// Viven en el motor común (módulo «estudios»): `unidad`, `sesion_estudio` y `tarjeta`, con el ramo
// en data.course_id.

const endIn = (minutes: number) => Date.now() + minutes * 60 * 1000;
const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}` : '');
const ofCourse = (list: Entry[], id: string) => list.filter((e) => e.data.course_id === id);

export function UnitsTab({ courses, store, today }: { courses: Course[]; store: Entries; today: string }) {
  const { colors } = useTheme();
  const units = store.of('unidad');
  const sessions = store.of('sesion_estudio');
  const weekFrom = plusDays(today, -6);
  if (!courses.length) return <Empty text="Primero agrega tus ramos en «Programas y ramos»." />;
  return (
    <>
      <StudyNow courses={courses} store={store} today={today} />
      {courses.map((c) => {
        const mine = ofCourse(units, c.id).sort((a, b) => Number(a.data.orden ?? 0) - Number(b.data.orden ?? 0));
        const done = mine.filter((u) => u.done).length;
        const minutes = ofCourse(sessions, c.id)
          .filter((x) => (x.day ?? '') >= weekFrom)
          .reduce((n, x) => n + (Number(x.value) || 0), 0);
        const next = mine.find((u) => !u.done && u.day);
        return (
          <Panel key={c.id}>
            <Kicker>{c.name}</Kicker>
            {mine.length ? <BarRow label={`Temario · ${done} de ${mine.length} unidades`} value={done} max={mine.length} text={`${Math.round((done / mine.length) * 100)} %`} tone="ok" /> : null}
            {next ? <AppText variant="caption" color={next.day! < today ? colors.bad : colors.accent}>{`Próximo cierre: ${next.title} · ${fmt(next.day)}`}</AppText> : null}
            {mine.map((u) => (
              <View key={u.id} style={styles.unit}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: u.done }}
                  accessibilityLabel={u.title ?? 'Unidad'}
                  hitSlop={8}
                  onPress={() => (tap(), store.update(u.id, { done: !u.done }))}
                  style={[styles.check, { backgroundColor: u.done ? colors.ok : 'transparent', borderColor: u.done ? colors.ok : colors.line }]}
                >
                  {u.done ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : null}
                </Pressable>
                <AppText style={{ flex: 1, fontSize: 15, textDecorationLine: u.done ? 'line-through' : 'none' }} color={u.done ? colors.muted : colors.text} onLongPress={() => store.remove(u.id)}>
                  {u.title}
                </AppText>
                {u.day ? (
                  <AppText variant="caption" color={!u.done && u.day < today ? colors.bad : colors.muted}>
                    {fmt(u.day)}
                  </AppText>
                ) : null}
              </View>
            ))}
            <AddUnit onAdd={(title, day) => store.add({ module: 'estudios', kind: 'unidad', title, day, data: { course_id: c.id, orden: mine.length } })} />
            <AppText variant="caption" muted>{`Esta semana estudiaste ${minutes} min de ${c.name}.`}</AppText>
          </Panel>
        );
      })}
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Mantén presionada una unidad para borrarla.
      </AppText>
    </>
  );
}

function AddUnit({ onAdd }: { onAdd: (title: string, day: string | null) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const add = () => {
    if (!text.trim()) return;
    tap();
    const m = /^(\d{1,2})[-/](\d{1,2})$/.exec(date.trim());
    const year = new Date().getFullYear();
    onAdd(text.trim(), m ? `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null);
    setText('');
    setDate('');
  };
  return (
    <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
      <TextInput value={text} onChangeText={setText} placeholder="Unidad 1: Present simple" placeholderTextColor={colors.muted} style={[styles.text, { color: colors.text, flex: 1 }]} />
      <TextInput value={date} onChangeText={setDate} placeholder="dd-mm" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" style={[styles.text, { color: colors.text, width: 62 }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Agregar unidad" onPress={add} hitSlop={8}>
        <PlusIcon size={20} color={text.trim() ? colors.accent : colors.muted} />
      </Pressable>
    </View>
  );
}

/** Estudiar ahora: un ramo, 25 o 45 minutos, y la sesión queda registrada. */
function StudyNow({ courses, store, today }: { courses: Course[]; store: Entries; today: string }) {
  const { colors } = useTheme();
  const [course, setCourse] = useState(courses[0]?.id ?? '');
  const [minutes, setMinutes] = useState('25');
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      const rest = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) {
        clearInterval(id);
        setEndAt(null);
        tap();
        store.add({ module: 'estudios', kind: 'sesion_estudio', day: today, value: Number(minutes), title: courses.find((c) => c.id === course)?.name ?? 'Estudio', data: { course_id: course } });
        setSaved(`¡Listo! ${minutes} min de estudio guardados. Toma 5 minutos de pausa.`);
      }
    }, 1000);
    return () => clearInterval(id);
    // La sesión se arma al empezar; lo demás no cambia mientras corre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt]);

  return (
    <Panel>
      <Kicker color={colors.accent}>Estudiar ahora</Kicker>
      {endAt ? (
        <>
          <AppText style={{ fontFamily: fonts.extrabold, fontSize: 40, fontVariant: ['tabular-nums'] }}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</AppText>
          <AppText variant="caption" muted>{`${courses.find((c) => c.id === course)?.name ?? ''} · deja el celular boca abajo`}</AppText>
          <Button label="Terminar antes" kind="secondary" onPress={() => setEndAt(null)} />
        </>
      ) : (
        <>
          <ChipRow options={courses.map((c) => ({ value: c.id, label: c.name }))} value={course} onChange={setCourse} />
          <ChipRow
            options={[
              { value: '25', label: '25 min' },
              { value: '45', label: '45 min' },
              { value: '10', label: '10 min (para empezar)' },
            ]}
            value={minutes}
            onChange={setMinutes}
          />
          <Button
            label="Empezar"
            onPress={() => {
              tap();
              setSaved(null);
              setLeft(Number(minutes) * 60);
              setEndAt(endIn(Number(minutes)));
            }}
          />
          {saved ? (
            <AppText variant="caption" color={colors.ok}>
              {saved}
            </AppText>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/** Repaso con tarjetas: las que tocan hoy, de a una. */
export function CardsTab({ courses, store, today }: { courses: Course[]; store: Entries; today: string }) {
  const { colors } = useTheme();
  const [course, setCourse] = useState<string>('todos');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [shown, setShown] = useState(false);
  const cards = store.of('tarjeta').filter((c) => course === 'todos' || c.data.course_id === course);
  const due = cards.filter((c) => isDue(c, today));
  const card = due[0] ?? null;
  const answer = (knew: boolean) => {
    if (!card) return;
    tap();
    const r = review(Number(card.data.box) || 1, knew, today);
    store.update(card.id, { day: r.day, data: { ...card.data, box: r.box } });
    setShown(false);
  };
  return (
    <>
      <ChipRow options={[{ value: 'todos', label: 'Todos los ramos' }, ...courses.map((c) => ({ value: c.id, label: c.name }))]} value={course} onChange={setCourse} />
      <Panel>
        <Kicker>{`Para repasar hoy · ${due.length} de ${cards.length}`}</Kicker>
        {card ? (
          <Animated.View key={`${card.id}:${shown}`} entering={FadeIn.duration(250)} style={{ gap: 12 }}>
            <AppText variant="caption" muted>{`${courses.find((c) => c.id === card.data.course_id)?.name ?? ''} · caja ${Number(card.data.box) || 1} de 5`}</AppText>
            <AppText variant="title" style={{ fontSize: 22, lineHeight: 29 }}>
              {card.title}
            </AppText>
            {shown ? (
              <>
                <AppText variant="body" style={{ fontSize: 17 }}>
                  {card.body}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button label="No la sabía" kind="secondary" onPress={() => answer(false)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="La sabía" onPress={() => answer(true)} />
                  </View>
                </View>
              </>
            ) : (
              <Button label="Mostrar la respuesta" onPress={() => (tap(), setShown(true))} />
            )}
          </Animated.View>
        ) : (
          <AppText variant="label" color={colors.ok}>
            {cards.length ? 'No te queda nada por repasar hoy. 👏' : 'Crea tu primera tarjeta abajo.'}
          </AppText>
        )}
      </Panel>
      <Panel>
        <Kicker>Nueva tarjeta</Kicker>
        {course === 'todos' && courses.length ? <AppText variant="caption" muted>Elige un ramo arriba para crearla ahí.</AppText> : null}
        <Field label="Pregunta" value={front} onChangeText={setFront} placeholder="¿Cómo se dice «yo fui» en inglés?" />
        <Field label="Respuesta" value={back} onChangeText={setBack} placeholder="I went" multiline />
        <Button
          label="Guardar tarjeta"
          kind="secondary"
          onPress={() => {
            if (!front.trim() || !back.trim() || course === 'todos') return;
            tap();
            store.add({ module: 'estudios', kind: 'tarjeta', title: front.trim(), body: back.trim(), day: today, data: { course_id: course, box: 1 } });
            setFront('');
            setBack('');
          }}
        />
        <AppText variant="caption" muted>
          Si la sabes, vuelve más tarde (2, 4, 8 y 16 días); si no, mañana. Repasar justo antes de olvidar es lo que más ayuda a recordar.
        </AppText>
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  unit: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 12 },
  text: { fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 },
});
