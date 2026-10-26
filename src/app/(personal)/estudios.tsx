import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { courseAverage, daysUntil, neededGrade, upcoming, weekPlan, WEEKDAYS } from '@/core/studies';
import { useStudies, type Course } from '@/data/modules';
import { authErrorMessage } from '@/features/account/authErrors';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Chips, DateField, Empty, Field, Kicker, Panel, Row, Segmented, Sheet } from '@/ui/kit';

// Estudios (F20, con la primera versión como referencia): ramos con su promedio y la nota que
// falta para aprobar, horario semanal por bloques y próximas pruebas.

type Tab = 'courses' | 'week' | 'tests';
const fmtGrade = (g: number | null | undefined) => (g === null || g === undefined ? '—' : Number(g).toFixed(1).replace('.', ','));
const DAY = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function EstudiosScreen() {
  const { colors } = useTheme();
  const s = useStudies();
  const [tab, setTab] = useState<Tab>('courses');
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'course' | 'block' | 'test' | null>(null);
  const [grading, setGrading] = useState<string | null>(null);
  const today = todayIso();
  const courses = s.courses.filter((c) => !c.archived);
  const name = (id: string) => s.courses.find((c) => c.id === id)?.name ?? 'Ramo';

  const confirmDelete = (table: 'study_courses' | 'study_blocks' | 'study_assessments', id: string, what: string) =>
    Alert.alert('¿Borrar?', `Se borra ${what}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => s.remove(table, id) },
    ]);

  const courseCard = (c: Course) => {
    const list = s.assessments.filter((a) => a.course_id === c.id);
    const avg = courseAverage(list);
    const need = neededGrade(list, Number(c.pass_grade) || 4);
    const expanded = open === c.id;
    return (
      <Panel key={c.id}>
        <Pressable onPress={() => setOpen(expanded ? null : c.id)} onLongPress={() => confirmDelete('study_courses', c.id, `el ramo ${c.name}`)} style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subtitle">{c.name}</AppText>
            <AppText variant="caption" muted>
              {[c.institution, c.teacher].filter(Boolean).join(' · ') || 'Toca para ver notas y pruebas'}
            </AppText>
          </View>
          <View style={[styles.avg, { backgroundColor: avg === null ? colors.surface2 : avg >= (Number(c.pass_grade) || 4) ? colors.okSoft : colors.badSoft }]}>
            <AppText variant="subtitle" color={avg === null ? colors.muted : avg >= (Number(c.pass_grade) || 4) ? colors.ok : colors.bad}>
              {fmtGrade(avg)}
            </AppText>
          </View>
        </Pressable>
        {need ? (
          <AppText variant="caption" color={need.possible ? colors.text : colors.bad}>
            {need.possible ? `Necesitas un ${fmtGrade(need.grade)} en lo que queda para aprobar.` : `Con lo que queda ya no alcanza el ${fmtGrade(c.pass_grade)}. Habla con tu profesor o profesora.`}
          </AppText>
        ) : null}
        {expanded ? (
          <View style={{ gap: 4 }}>
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="+ Prueba o nota" kind="secondary" onPress={() => setSheet('test')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="+ Horario" kind="secondary" onPress={() => setSheet('block')} />
              </View>
            </View>
          </View>
        ) : null}
      </Panel>
    );
  };

  const week = weekPlan(s.blocks);
  const next = upcoming(s.assessments, today);

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Estudios" />
      <Segmented
        options={[
          { value: 'courses', label: 'Ramos' },
          { value: 'week', label: 'Semana' },
          { value: 'tests', label: 'Pruebas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'courses' ? (
        <>
          <Button label="+ Nuevo ramo" onPress={() => setSheet('course')} />
          {courses.length ? courses.map(courseCard) : <Empty text="Agrega tus ramos para llevar notas, horario y pruebas." />}
        </>
      ) : null}
      {tab === 'week' ? (
        <Panel>
          <Kicker>Horario semanal</Kicker>
          {week.length ? (
            week.map((d) => (
              <View key={d.weekday} style={{ gap: 2 }}>
                <AppText variant="label" color={colors.accent}>
                  {WEEKDAYS[d.weekday - 1]}
                </AppText>
                {d.blocks.map((b) => (
                  <Row key={b.id} title={name(b.course_id)} sub={`${b.starts_at.slice(0, 5)} – ${b.ends_at.slice(0, 5)}${b.room ? ` · sala ${b.room}` : ''}`} onLongPress={() => confirmDelete('study_blocks', b.id, 'este bloque')} />
                ))}
              </View>
            ))
          ) : (
            <Empty text="Abre un ramo y toca «+ Horario» para armar tu semana." />
          )}
        </Panel>
      ) : null}
      {tab === 'tests' ? (
        <Panel>
          <Kicker>Próximas pruebas</Kicker>
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

      <CourseSheet visible={sheet === 'course'} onClose={() => setSheet(null)} onSave={s.addCourse} />
      <TestSheet visible={sheet === 'test'} courses={courses} courseId={open} onClose={() => setSheet(null)} onSave={s.addAssessment} />
      <BlockSheet visible={sheet === 'block'} courses={courses} courseId={open} onClose={() => setSheet(null)} onSave={s.addBlock} />
      <GradeSheet
        id={grading}
        title={s.assessments.find((a) => a.id === grading)?.title ?? ''}
        onClose={() => setGrading(null)}
        onSave={(g) => (grading ? s.setGrade(grading, g) : undefined)}
      />
    </Screen>
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

function CourseSheet({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (v: { name: string; institution: string | null; teacher: string | null }) => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [inst, setInst] = useState('');
  const [teacher, setTeacher] = useState('');
  const s = useSave(() => {
    setName('');
    setTeacher('');
    onClose();
  });
  return (
    <Sheet visible={visible} title="Nuevo ramo" onClose={onClose}>
      <Field label="Nombre del ramo" value={name} onChangeText={setName} placeholder="Por ejemplo: Matemáticas" />
      <Field label="Colegio, universidad o instituto (opcional)" value={inst} onChangeText={setInst} />
      <Field label="Profesor o profesora (opcional)" value={teacher} onChangeText={setTeacher} />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => (name.trim() ? s.run(() => onSave({ name: name.trim(), institution: inst.trim() || null, teacher: teacher.trim() || null })) : s.setError('Escribe el nombre del ramo.'))}
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
    <Sheet visible={visible} title="Prueba o nota" onClose={onClose}>
      <Chips options={courses.map((c) => ({ value: c.id, label: c.name }))} value={chosen} onChange={setCourse} />
      <Field label="Nombre" value={title} onChangeText={setTitle} placeholder="Por ejemplo: Prueba 1, Examen" />
      <DateField label="Fecha (opcional)" value={due} onChange={setDue} future />
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

const TIMES = ['08:00', '08:30', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

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
  const [day, setDay] = useState('1');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('09:30');
  const [room, setRoom] = useState('');
  const s = useSave(onClose);
  const chosen = course ?? courseId ?? courses[0]?.id ?? null;
  return (
    <Sheet visible={visible} title="Bloque de horario" onClose={onClose}>
      <Chips options={courses.map((c) => ({ value: c.id, label: c.name }))} value={chosen} onChange={setCourse} />
      <Chips options={WEEKDAYS.slice(0, 6).map((w, i) => ({ value: String(i + 1), label: w.slice(0, 3) }))} value={day} onChange={setDay} />
      <AppText variant="caption" muted>
        Empieza
      </AppText>
      <Chips options={TIMES.map((t) => ({ value: t, label: t }))} value={start} onChange={setStart} />
      <Field label="Termina (HH:MM)" value={end} onChangeText={setEnd} placeholder="09:30" />
      <Field label="Sala (opcional)" value={room} onChangeText={setRoom} />
      {s.error ? <Notice text={s.error} /> : null}
      <Button
        label="Guardar"
        loading={s.busy}
        onPress={() => {
          if (!chosen) return s.setError('Primero agrega un ramo.');
          if (!/^\d{2}:\d{2}$/.test(end) || end <= start) return s.setError('La hora de término va como 09:30 y después del inicio.');
          s.run(() => onSave({ course_id: chosen, weekday: Number(day), starts_at: start, ends_at: end, room: room.trim() || null }));
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
});
