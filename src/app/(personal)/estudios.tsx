import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { addDays } from '@/core/agenda';
import { courseAverage, daysUntil, isoWeekday, neededGrade, upcoming, WEEKDAYS } from '@/core/studies';
import { useAgenda } from '@/data/agenda';
import { useEntries, type Entry } from '@/data/entries';
import { useStudies, type Course } from '@/data/modules';
import { authErrorMessage } from '@/features/account/authErrors';
import type { KindDef } from '@/features/modules/catalog';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ChipRow, DateField, Empty, Field, Kicker, normalizeTime, Panel, PillTabs, Row, Sheet, TimeField, todayIso } from '@/ui/kit';

// Estudios (F20, con la primera versión como referencia): ramos con su promedio y la nota que
// falta, horario semanal y próximas pruebas. 26-10-2026 (revisión del usuario):
// - primero el programa: dónde y qué estudias (universidad, instituto, curso, diplomado…), con su
//   régimen (semestral, trimestral…) y sus fechas; cada ramo pertenece a un programa;
// - horas libres de 00:00 a 23:59 (clases a las 20:30) y varios días a la vez;
// - la semana en una grilla por bloques (45, 60 o 90 minutos) con las pruebas de la semana;
// - calculadora de notas: qué necesitas para la nota que quieres;
// - las pruebas quedan en el Calendario y las clases entran a Tu día.

type Tab = 'courses' | 'week' | 'tests';
const fmtGrade = (g: number | null | undefined) => (g === null || g === undefined ? '—' : Number(g).toFixed(1).replace('.', ','));
const DAY = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
const SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const PROGRAM_KIND: KindDef = {
  kind: 'programa',
  label: 'Programas',
  one: 'Programa',
  empty: 'Dónde y qué estudias.',
  fields: [
    { key: 'title', label: 'Institución y carrera o curso', kind: 'text', required: true, placeholder: 'U. Andrés Bello · Ingeniería Comercial' },
    { key: 'tipo', label: 'Tipo', kind: 'choice', options: ['Universidad', 'Instituto o CFT', 'Colegio', 'Curso', 'Capacitación', 'Diplomado', 'Magíster', 'Otro'], initial: 'Universidad' },
    { key: 'regimen', label: 'Régimen', kind: 'choice', options: ['Semestral', 'Trimestral', 'Anual', 'Por módulos', 'Sin régimen'], initial: 'Semestral' },
    { key: 'day', label: 'Empieza el período', kind: 'date' },
    { key: 'until', label: 'Termina el período', kind: 'date' },
    { key: 'bloque', label: 'Duración de cada bloque de clase', kind: 'choice', options: ['45 min', '60 min', '90 min'], initial: '60 min' },
  ],
};

export default function EstudiosScreen() {
  const { colors } = useTheme();
  const s = useStudies();
  const programs = useEntries('estudios');
  // Asistencia: las clases marcadas en Tu día, el Calendario o Prioridades («clase:<bloque>»).
  const marks = useEntries('hoy').of('hecho');
  const agenda = useAgenda(todayIso(), todayIso());
  const [tab, setTab] = useState<Tab>('courses');
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'course' | 'block' | 'test' | null>(null);
  const [programSheet, setProgramSheet] = useState<SheetTarget | null>(null);
  const [grading, setGrading] = useState<string | null>(null);
  const today = todayIso();
  const courses = s.courses.filter((c) => !c.archived);
  const progs = programs.of('programa');
  const name = (id: string) => s.courses.find((c) => c.id === id)?.name ?? 'Ramo';

  const confirmDelete = (table: 'study_courses' | 'study_blocks' | 'study_assessments', id: string, what: string) =>
    Alert.alert('¿Borrar?', `Se borra ${what}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => s.remove(table, id) },
    ]);

  const courseCard = (c: Course) => {
    const list = s.assessments.filter((a) => a.course_id === c.id);
    const avg = courseAverage(list);
    const pass = Number(c.pass_grade) || 4;
    const need = neededGrade(list, pass);
    const expanded = open === c.id;
    const blocks = s.blocks.filter((b) => b.course_id === c.id).sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at));
    const program = progs.find((p) => p.id === c.program_id);
    const from = program?.day ?? addDays(today, -56);
    const held = (() => {
      let n = 0;
      for (let d = from; d <= today && n < 400; d = addDays(d, 1)) n += blocks.filter((b) => Number(b.weekday) === isoWeekday(d)).length;
      return n;
    })();
    const went = marks.filter((m) => m.day && m.day >= from && blocks.some((b) => m.title === `clase:${b.id}`)).length;
    return (
      <Panel key={c.id}>
        <Pressable onPress={() => setOpen(expanded ? null : c.id)} onLongPress={() => confirmDelete('study_courses', c.id, `el ramo ${c.name}`)} style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subtitle">{c.name}</AppText>
            <AppText variant="caption" muted>
              {[blocks.map((b) => `${SHORT[b.weekday - 1]} ${b.starts_at.slice(0, 5)}`).join(', ') || null, c.teacher].filter(Boolean).join(' · ') || 'Toca para ver horario, notas y pruebas'}
            </AppText>
          </View>
          <View style={[styles.avg, { backgroundColor: avg === null ? colors.surface2 : avg >= pass ? colors.okSoft : colors.badSoft }]}>
            <AppText variant="subtitle" color={avg === null ? colors.muted : avg >= pass ? colors.ok : colors.bad}>
              {fmtGrade(avg)}
            </AppText>
          </View>
        </Pressable>
        {held ? <AppText variant="caption" muted>{`Asistencia: ${went} de ${held} clases${program?.day ? '' : ' (últimas 8 semanas)'}. Se marca en Tu día, el Calendario o Prioridades.`}</AppText> : null}
        {need ? (
          <AppText variant="caption" color={need.possible ? colors.text : colors.bad}>
            {need.possible ? `Necesitas un ${fmtGrade(need.grade)} en lo que queda para aprobar.` : `Con lo que queda ya no alcanza el ${fmtGrade(pass)}. Habla con tu profesor o profesora.`}
          </AppText>
        ) : null}
        {expanded ? (
          <View style={{ gap: 6 }}>
            <Kicker>Horario</Kicker>
            {blocks.length ? (
              blocks.map((b) => <Row key={b.id} title={`${WEEKDAYS[b.weekday - 1]} · ${b.starts_at.slice(0, 5)} – ${b.ends_at.slice(0, 5)}`} sub={b.room ? `Sala ${b.room}` : undefined} onLongPress={() => confirmDelete('study_blocks', b.id, 'este bloque')} />)
            ) : (
              <Empty text="Agrega cuándo tienes clases de este ramo." />
            )}
            <Kicker>Notas y pruebas</Kicker>
            {list.map((a) => (
              <Row
                key={a.id}
                title={a.title}
                sub={[a.due_on ? DAY(a.due_on) : null, a.weight ? `${a.weight} %` : null].filter(Boolean).join(' · ') || undefined}
                onPress={() => setGrading(a.id)}
                onLongPress={() => confirmDelete('study_assessments', a.id, a.title)}
                right={<AppText variant="label">{fmtGrade(a.grade)}</AppText>}
              />
            ))}
            {!list.length ? <Empty text="Agrega las pruebas con su porcentaje para calcular el promedio." /> : null}
            {list.length ? <GradeCalculator list={list} pass={pass} /> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="+ Prueba o nota" kind="secondary" onPress={() => setSheet('test')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="+ Clase" kind="secondary" onPress={() => setSheet('block')} />
              </View>
            </View>
          </View>
        ) : null}
      </Panel>
    );
  };

  const next = upcoming(s.assessments, today);
  const loose = courses.filter((c) => !c.program_id || !progs.some((p) => p.id === c.program_id));

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Estudios" />
      <PillTabs
        options={[
          { value: 'courses', label: 'Programas y ramos' },
          { value: 'week', label: 'Semana' },
          { value: 'tests', label: 'Pruebas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'courses' ? (
        <>
          {!progs.length ? (
            <Panel>
              <Kicker color={colors.accent}>Para empezar</Kicker>
              <AppText>¿Dónde y qué estudias? Puede ser la universidad, un instituto, un curso, una capacitación o un diplomado; cada uno con su régimen y sus fechas.</AppText>
              <Button label="+ Programa de estudio" onPress={() => setProgramSheet({ kind: PROGRAM_KIND })} />
            </Panel>
          ) : null}
          {progs.map((p) => {
            const mine = courses.filter((c) => c.program_id === p.id);
            const left = p.until ? daysUntil(p.until, today) : null;
            return (
              <View key={p.id} style={{ gap: 8 }}>
                <Pressable onPress={() => setProgramSheet({ kind: PROGRAM_KIND, entry: p })} style={[styles.program, { backgroundColor: colors.accentSoft }]}>
                  <AppText variant="label" color={colors.accent}>
                    {p.title}
                  </AppText>
                  <AppText variant="caption" color={colors.accent}>
                    {[p.data.tipo, p.data.regimen, p.day && p.until ? `${DAY(p.day)} al ${DAY(p.until)}` : null, left !== null && left >= 0 ? `faltan ${left} días` : null].filter(Boolean).join(' · ')}
                  </AppText>
                </Pressable>
                {mine.length ? mine.map(courseCard) : <Empty text="Agrega los ramos de este programa." />}
              </View>
            );
          })}
          {loose.length ? (
            <>
              {progs.length ? <Kicker>Ramos sin programa</Kicker> : null}
              {loose.map(courseCard)}
            </>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="+ Ramo" onPress={() => setSheet('course')} />
            </View>
            {progs.length ? (
              <View style={{ flex: 1 }}>
                <Button label="+ Programa" kind="secondary" onPress={() => setProgramSheet({ kind: PROGRAM_KIND })} />
              </View>
            ) : null}
          </View>
        </>
      ) : null}
      {tab === 'week' ? <WeekGrid courses={courses} blocks={s.blocks} tests={s.assessments} programs={progs} name={name} today={today} /> : null}
      {tab === 'tests' ? (
        <Panel>
          <Kicker>Próximas pruebas y entregas</Kicker>
          {next.length ? (
            next.map((a) => {
              const days = daysUntil(a.due_on ?? today, today);
              return (
                <Row
                  key={a.id}
                  title={`${a.title} · ${name(a.course_id)}`}
                  sub={days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días · ${DAY(a.due_on ?? today)}`}
                  onPress={() => setGrading(a.id)}
                  right={days <= 3 ? <AppText variant="label" color={colors.mid}>Pronto</AppText> : undefined}
                />
              );
            })
          ) : (
            <Empty text="Sin pruebas por venir. Agrégalas dentro de cada ramo." />
          )}
        </Panel>
      ) : null}

      <CourseSheet visible={sheet === 'course'} programs={progs} onClose={() => setSheet(null)} onSave={s.addCourse} />
      <TestSheet
        visible={sheet === 'test'}
        courses={courses}
        courseId={open}
        onClose={() => setSheet(null)}
        onSave={async (v) => {
          await s.addAssessment(v);
          // La prueba queda en el Calendario como prioridad del día (26-10-2026).
          if (v.due_on && v.grade === null) {
            await agenda.addEvent({ title: `Prueba: ${v.title} · ${name(v.course_id)}`.slice(0, 120), event_date: v.due_on, starts_at: null, ends_at: null, layer: 'estudios', repeat: 'none', remind_minutes: null, location: null, notes: null, importance: 1, repeat_until: null });
          }
        }}
      />
      <BlockSheet visible={sheet === 'block'} courses={courses} courseId={open} onClose={() => setSheet(null)} onSave={s.addBlock} />
      <GradeSheet id={grading} title={s.assessments.find((a) => a.id === grading)?.title ?? ''} onClose={() => setGrading(null)} onSave={(g) => (grading ? s.setGrade(grading, g) : undefined)} />
      <EntrySheet
        target={programSheet}
        ctx={{ parent: null, entries: programs.entries }}
        onClose={() => setProgramSheet(null)}
        onSave={(input, target) => (target.entry ? programs.update(target.entry.id, input) : programs.add(input))}
        onRemove={(e) => programs.remove(e.id)}
      />
    </Screen>
  );
}

/** «Quiero un ___»: qué nota necesitas en lo que queda para llegar a la nota que quieres. */
function GradeCalculator({ list, pass }: { list: Parameters<typeof neededGrade>[0]; pass: number }) {
  const { colors } = useTheme();
  const [target, setTarget] = useState(String(pass).replace('.', ','));
  const goal = Number(target.replace(',', '.'));
  const r = Number.isFinite(goal) && goal >= 1 && goal <= 7 ? neededGrade(list, goal) : null;
  const allWeighted = list.every((a) => a.weight);
  return (
    <View style={[styles.calc, { backgroundColor: colors.surface2 }]}>
      <AppText variant="label">Calculadora de notas</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="caption" muted>
          Quiero terminar con un
        </AppText>
        <View style={{ width: 70 }}>
          <Field label="" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
        </View>
      </View>
      <AppText variant="caption" color={r && !r.possible ? colors.bad : colors.text}>
        {!allWeighted
          ? 'Pon el porcentaje a todas las pruebas para calcular.'
          : !r
            ? 'Ya tienes todas las notas: tu promedio es el final.'
            : r.possible
              ? `Necesitas un promedio de ${fmtGrade(r.grade)} en lo que queda.`
              : `Con lo que queda no alcanza el ${target}: necesitarías un ${fmtGrade(r.grade)}.`}
      </AppText>
    </View>
  );
}

/** La semana en una grilla por bloques, con las pruebas y entregas de esta semana arriba. */
function WeekGrid({ courses, blocks, tests, programs, name, today }: { courses: Course[]; blocks: ReturnType<typeof useStudies>['blocks']; tests: ReturnType<typeof useStudies>['assessments']; programs: Entry[]; name: (id: string) => string; today: string }) {
  const { colors } = useTheme();
  const block = Number(String(programs[0]?.data.bloque ?? '60').replace(/\D/g, '')) || 60;
  const [step, setStep] = useState(block);
  if (!blocks.length) return <Empty text="Abre un ramo y toca «+ Clase» para armar tu semana." />;
  const wd = new Date(`${today}T12:00:00`).getDay();
  const monday = addDays(today, wd === 0 ? -6 : 1 - wd);
  const days = blocks.some((b) => Number(b.weekday) === 7) ? 7 : 6;
  const startMin = Math.floor(Math.min(...blocks.map((b) => toMin(b.starts_at))) / 60) * 60;
  const endMin = Math.ceil(Math.max(...blocks.map((b) => toMin(b.ends_at))) / 60) * 60;
  const H = 0.9; // puntos por minuto
  const lines = Array.from({ length: Math.floor((endMin - startMin) / step) + 1 }, (_, i) => startMin + i * step);
  const palette = [colors.accent, colors.accent2, colors.ok, colors.mid, colors.bad];
  const colorOf = (courseId: string) => palette[Math.max(0, courses.findIndex((c) => c.id === courseId)) % palette.length];
  const weekTests = tests.filter((t) => t.due_on && t.due_on >= monday && t.due_on <= addDays(monday, 6) && (t.grade === null || t.grade === undefined));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return (
    <>
      <ChipRow
        options={[
          { value: '45', label: 'Bloques de 45 min' },
          { value: '60', label: '1 hora' },
          { value: '90', label: '90 min' },
        ]}
        value={String(step)}
        onChange={(v) => setStep(Number(v))}
      />
      {weekTests.length ? (
        <Panel>
          <Kicker color={colors.mid}>Esta semana tienes</Kicker>
          {weekTests.map((t) => (
            <AppText key={t.id} variant="body" style={{ fontSize: 15 }}>{`• ${SHORT[(new Date(`${t.due_on}T12:00:00`).getDay() + 6) % 7]} ${DAY(t.due_on!)}: ${t.title} · ${name(t.course_id)}`}</AppText>
          ))}
        </Panel>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 44, marginTop: 22 }}>
            {lines.map((m) => (
              <AppText key={m} variant="caption" muted style={{ position: 'absolute', top: (m - startMin) * H - 7, fontSize: 10, fontVariant: ['tabular-nums'] }}>
                {fmt(m)}
              </AppText>
            ))}
          </View>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const date = addDays(monday, d - 1);
            const hasTest = weekTests.some((t) => t.due_on === date);
            return (
              <View key={d} style={{ width: 92 }}>
                <AppText variant="label" style={{ textAlign: 'center', fontSize: 12, height: 22 }} color={date === today ? colors.accent : hasTest ? colors.mid : colors.text}>
                  {`${SHORT[d - 1]}${hasTest ? ' •' : ''}`}
                </AppText>
                <View style={{ height: (endMin - startMin) * H, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.line }}>
                  {lines.map((m) => (
                    <View key={m} style={{ position: 'absolute', left: 0, right: 0, top: (m - startMin) * H, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line }} />
                  ))}
                  {blocks
                    .filter((b) => Number(b.weekday) === d)
                    .map((b) => (
                      <View key={b.id} style={[styles.block, { top: (toMin(b.starts_at) - startMin) * H, height: Math.max(22, (toMin(b.ends_at) - toMin(b.starts_at)) * H - 2), backgroundColor: colorOf(b.course_id) + '33', borderLeftColor: colorOf(b.course_id) }]}>
                        <AppText variant="caption" numberOfLines={2} style={{ fontSize: 11, fontFamily: fonts.bold }}>
                          {name(b.course_id)}
                        </AppText>
                        <AppText variant="caption" muted style={{ fontSize: 10 }}>
                          {`${b.starts_at.slice(0, 5)}${b.room ? ` · ${b.room}` : ''}`}
                        </AppText>
                      </View>
                    ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      tap();
      onDone();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function CourseSheet({ visible, programs, onClose, onSave }: { visible: boolean; programs: Entry[]; onClose: () => void; onSave: (v: { name: string; institution: string | null; teacher: string | null; program_id?: string | null }) => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [program, setProgram] = useState<string | null>(null);
  const [teacher, setTeacher] = useState('');
  const chosen = programs.find((p) => p.id === (program ?? programs[0]?.id)) ?? null;
  const s = useSave(() => {
    setName('');
    setTeacher('');
    onClose();
  });
  return (
    <Sheet visible={visible} title="Nuevo ramo" onClose={onClose}>
      <Field label="Nombre del ramo" value={name} onChangeText={setName} placeholder="Por ejemplo: Ingeniería económica" />
      {programs.length ? (
        <>
          <AppText variant="caption" muted>
            Programa
          </AppText>
          <ChipRow options={programs.map((p) => ({ value: p.id, label: p.title ?? 'Programa' }))} value={chosen?.id ?? null} onChange={setProgram} />
        </>
      ) : (
        <AppText variant="caption" muted>
          Sin programa todavía: el ramo queda suelto. Puedes agregar tu universidad, instituto o curso en «+ Programa».
        </AppText>
      )}
      <Field label="Profesor o profesora (opcional)" value={teacher} onChangeText={setTeacher} />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => (name.trim() ? s.run(() => onSave({ name: name.trim(), institution: chosen?.title ?? null, teacher: teacher.trim() || null, program_id: chosen?.id ?? null })) : s.setError('Escribe el nombre del ramo.'))}
      />
    </Sheet>
  );
}

const parseGrade = (t: string) => {
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 1 && n <= 7 ? Math.round(n * 10) / 10 : null;
};

function TestSheet({
  visible,
  courses,
  courseId,
  onClose,
  onSave,
}: {
  visible: boolean;
  courses: Course[];
  courseId: string | null;
  onClose: () => void;
  onSave: (v: { course_id: string; title: string; due_on: string | null; weight: number | null; grade: number | null }) => Promise<unknown>;
}) {
  const [course, setCourse] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [grade, setGrade] = useState('');
  const s = useSave(() => {
    setTitle('');
    setWeight('');
    setGrade('');
    setDue(null);
    onClose();
  });
  const chosen = course ?? courseId ?? courses[0]?.id ?? null;
  return (
    <Sheet visible={visible} title="Prueba, trabajo o nota" onClose={onClose}>
      <ChipRow options={courses.map((c) => ({ value: c.id, label: c.name }))} value={chosen} onChange={setCourse} />
      <Field label="Nombre" value={title} onChangeText={setTitle} placeholder="Prueba 1, Trabajo grupal, Examen" />
      <DateField label="Fecha (queda en tu calendario)" value={due} onChange={setDue} future />
      <Field label="Porcentaje del ramo (opcional)" value={weight} onChangeText={(v) => setWeight(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" placeholder="Por ejemplo: 30" />
      <Field label="Nota, si ya la tienes (1,0 a 7,0)" value={grade} onChangeText={setGrade} keyboardType="decimal-pad" placeholder="Por ejemplo: 5,8" />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => {
          if (!chosen || !title.trim()) return s.setError('Elige el ramo y escribe el nombre.');
          if (grade && parseGrade(grade) === null) return s.setError('La nota va de 1,0 a 7,0.');
          s.run(() => onSave({ course_id: chosen, title: title.trim(), due_on: due, weight: weight ? Math.min(100, Number(weight)) : null, grade: grade ? parseGrade(grade) : null }));
        }}
      />
    </Sheet>
  );
}

function BlockSheet({
  visible,
  courses,
  courseId,
  onClose,
  onSave,
}: {
  visible: boolean;
  courses: Course[];
  courseId: string | null;
  onClose: () => void;
  onSave: (v: { course_id: string; weekday: number; starts_at: string; ends_at: string; room: string | null }) => Promise<unknown>;
}) {
  const [course, setCourse] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [room, setRoom] = useState('');
  const { colors } = useTheme();
  const s = useSave(() => {
    setDays([]);
    setStart('');
    setEnd('');
    onClose();
  });
  const chosen = course ?? courseId ?? courses[0]?.id ?? null;
  return (
    <Sheet visible={visible} title="Clase" onClose={onClose}>
      <ChipRow options={courses.map((c) => ({ value: c.id, label: c.name }))} value={chosen} onChange={setCourse} />
      <AppText variant="caption" muted>
        Días (puedes marcar varios)
      </AppText>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {SHORT.map((d, i) => {
          const on = days.includes(i + 1);
          return (
            <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setDays(on ? days.filter((x) => x !== i + 1) : [...days, i + 1])} style={[styles.day, { backgroundColor: on ? colors.accent : colors.surface2 }]}>
              <AppText variant="label" style={{ fontSize: 12 }} color={on ? colors.onAccent : colors.text}>
                {d}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TimeField label="Empieza" value={start} onChange={setStart} placeholder="20:30" />
        <TimeField label="Termina" value={end} onChange={setEnd} placeholder="22:00" />
      </View>
      <Field label="Sala (opcional)" value={room} onChangeText={setRoom} />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => {
          const a = normalizeTime(start);
          const b = normalizeTime(end);
          if (!chosen) return s.setError('Primero agrega un ramo.');
          if (!days.length) return s.setError('Marca al menos un día.');
          if (!a || !b || b <= a) return s.setError('Escribe la hora de inicio y de término (por ejemplo, 20:30 y 22:00).');
          s.run(async () => {
            for (const d of days) await onSave({ course_id: chosen, weekday: d, starts_at: a, ends_at: b, room: room.trim() || null });
          });
        }}
      />
    </Sheet>
  );
}

function GradeSheet({ id, title, onClose, onSave }: { id: string | null; title: string; onClose: () => void; onSave: (g: number | null) => Promise<unknown> | undefined }) {
  const [grade, setGrade] = useState('');
  const s = useSave(() => {
    setGrade('');
    onClose();
  });
  return (
    <Sheet visible={!!id} title={`Nota · ${title}`} onClose={onClose}>
      <Field label="Nota (1,0 a 7,0)" value={grade} onChangeText={setGrade} keyboardType="decimal-pad" placeholder="Por ejemplo: 6,2" />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar nota"
        loading={s.busy}
        onPress={() => {
          const g = parseGrade(grade);
          if (g === null) return s.setError('La nota va de 1,0 a 7,0.');
          s.run(async () => onSave(g));
        }}
      />
      <Button label="Quitar la nota" kind="link" onPress={() => s.run(async () => onSave(null))} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avg: { minWidth: 58, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  program: { borderRadius: 16, padding: 12, gap: 2 },
  calc: { borderRadius: 14, padding: 12, gap: 6 },
  block: { position: 'absolute', left: 3, right: 3, borderRadius: 8, borderLeftWidth: 3, padding: 4 },
  day: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
});
