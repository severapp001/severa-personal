import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays } from '@/core/agenda';
import { courseStatus, neededGrade, sessionsBetween, WEEKDAYS, type Assessment, type Block } from '@/core/studies';
import type { Entries, Entry } from '@/data/entries';
import type { Course } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretLeftIcon, CheckIcon } from '@/ui/icons';
import { BarRow, Empty, Kicker, Panel, PillTabs, Row } from '@/ui/kit';

// La ficha de un ramo (28-10-2026, usuario: «que se despliegue el ramo y muestre horarios, pruebas y
// ponderaciones, así saber cómo voy; al marcar que se asistió a la clase, se marque como asistida;
// estudio online, así sabré qué clases ver y cuáles no porque ya las vi»). Cómo voy (promedio, lo
// evaluado y la nota que falta), el horario, las pruebas con su porcentaje y cada clase con dos
// marcas: «Asistí» (la misma de Tu día, el Calendario y Prioridades) y «La vi» (grabada u online).

const fmtGrade = (g: number | null | undefined) => (g === null || g === undefined ? '—' : Number(g).toFixed(1).replace('.', ','));
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const label = (day: string) => `${DOW[new Date(`${day}T12:00:00`).getDay()]} ${day.slice(8, 10)}-${day.slice(5, 7)}`;
type Filter = 'ver' | 'todas' | 'proximas';

export function CourseDetail({
  course,
  blocks,
  assessments,
  program,
  marks,
  studies,
  today,
  onBack,
  onAddTest,
  onAddBlock,
  onGrade,
  onRemoveTest,
  onRemoveBlock,
  calculator,
}: {
  course: Course;
  blocks: Block[];
  assessments: Assessment[];
  program: Entry | null;
  marks: Entries;
  studies: Entries;
  today: string;
  onBack: () => void;
  onAddTest: () => void;
  onAddBlock: () => void;
  onGrade: (id: string) => void;
  onRemoveTest: (a: Assessment) => void;
  onRemoveBlock: (b: Block) => void;
  calculator: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('ver');
  const pass = Number(course.pass_grade) || 4;
  const st = courseStatus(assessments);
  const need = neededGrade(assessments, pass);
  const tests = [...assessments].sort((a, b) => (a.due_on ?? '9').localeCompare(b.due_on ?? '9'));

  // Las clases: desde que empieza el programa (o las últimas 8 semanas) hasta dos semanas más.
  const from = program?.day ?? addDays(today, -56);
  const to = program?.until && program.until < addDays(today, 14) ? program.until : addDays(today, 14);
  const sessions = sessionsBetween(blocks, from, to);
  const id = (day: string, b: Block) => `${day}|clase:${b.id}`;
  const went = new Set(marks.entries.filter((m) => m.module === 'hoy' && m.kind === 'hecho').map((m) => `${m.day}|${m.title}`));
  const seen = new Set(studies.entries.filter((m) => m.kind === 'clase_vista').map((m) => `${m.day}|${m.title}`));
  const past = sessions.filter((x) => x.day <= today);
  const attended = past.filter((x) => went.has(id(x.day, x.block))).length;
  const viewed = past.filter((x) => !went.has(id(x.day, x.block)) && seen.has(id(x.day, x.block))).length;
  const pending = past.filter((x) => !went.has(id(x.day, x.block)) && !seen.has(id(x.day, x.block)));
  const shown = filter === 'ver' ? pending : filter === 'proximas' ? sessions.filter((x) => x.day > today).reverse() : past;

  const toggle = (store: Entries, module: string, kind: string, day: string, b: Block) => {
    tap();
    const title = `clase:${b.id}`;
    const row = store.entries.find((m) => m.module === module && m.kind === kind && m.day === day && m.title === title);
    return row ? store.remove(row.id) : store.add({ module, kind, day, title });
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} style={[styles.back, { backgroundColor: colors.surface }]}>
          <CaretLeftIcon size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="caption" muted style={{ letterSpacing: 1.2 }}>
            {[program?.title, course.teacher].filter(Boolean).join(' · ').toUpperCase() || 'RAMO'}
          </AppText>
          <AppText variant="title" numberOfLines={2} style={{ fontSize: 24, lineHeight: 29 }}>
            {course.name}
          </AppText>
        </View>
        <View style={[styles.avg, { backgroundColor: st.average === null ? colors.surface2 : st.average >= pass ? colors.okSoft : colors.badSoft }]}>
          <AppText variant="subtitle" color={st.average === null ? colors.muted : st.average >= pass ? colors.ok : colors.bad}>
            {fmtGrade(st.average)}
          </AppText>
        </View>
      </View>

      <Panel>
        <Kicker>Cómo voy</Kicker>
        <AppText variant="body">
          {st.average === null ? 'Todavía no tienes notas en este ramo.' : `Llevas un ${fmtGrade(st.average)} de promedio${st.average >= pass ? ', sobre el ' + fmtGrade(pass) + ' para aprobar.' : `, bajo el ${fmtGrade(pass)} para aprobar.`}`}
        </AppText>
        {st.planned ? <BarRow label={`Evaluado: ${st.evaluated} % de ${st.planned} %`} value={st.evaluated} max={Math.max(100, st.planned)} text={`${st.graded} de ${st.total} notas`} tone="ok" /> : null}
        {st.planned && st.planned !== 100 ? <AppText variant="caption" color={colors.mid}>{`Los porcentajes suman ${st.planned} %: revisa que lleguen a 100 %.`}</AppText> : null}
        {need ? (
          <AppText variant="label" color={need.possible ? colors.text : colors.bad}>
            {need.possible ? `Necesitas un ${fmtGrade(need.grade)} en lo que queda para aprobar.` : `Con lo que queda ya no alcanza el ${fmtGrade(pass)}. Habla con tu profesor o profesora.`}
          </AppText>
        ) : null}
        {past.length ? <BarRow label={`Clases: asististe a ${attended} y viste ${viewed} de ${past.length}`} value={attended + viewed} max={past.length} text={`${Math.round(((attended + viewed) / past.length) * 100)} %`} /> : null}
      </Panel>

      <Panel>
        <Kicker>{`Pruebas y ponderaciones · ${st.planned} %`}</Kicker>
        {tests.length ? (
          tests.map((a) => (
            <Row
              key={a.id}
              title={a.title}
              sub={[a.due_on ? label(a.due_on) : 'Sin fecha', a.weight ? `${a.weight} %` : 'sin %', a.due_on && a.due_on >= today && a.grade === null ? 'por venir' : null].filter(Boolean).join(' · ')}
              onPress={() => onGrade(a.id)}
              onLongPress={() => onRemoveTest(a)}
              right={
                <AppText variant="subtitle" color={a.grade === null ? colors.muted : Number(a.grade) >= pass ? colors.ok : colors.bad}>
                  {fmtGrade(a.grade)}
                </AppText>
              }
            />
          ))
        ) : (
          <Empty text="Agrega las pruebas con su porcentaje para saber cómo vas." />
        )}
        <Button label="+ Prueba o nota" kind="secondary" onPress={onAddTest} />
        {tests.length ? calculator : null}
      </Panel>

      <Panel>
        <Kicker>Horario</Kicker>
        {blocks.length ? (
          blocks.map((b) => <Row key={b.id} title={`${WEEKDAYS[b.weekday - 1]} · ${b.starts_at.slice(0, 5)} – ${b.ends_at.slice(0, 5)}`} sub={b.room ? `Sala ${b.room}` : undefined} onLongPress={() => onRemoveBlock(b)} />)
        ) : (
          <Empty text="Agrega cuándo tienes clases de este ramo." />
        )}
        <Button label="+ Clase en el horario" kind="secondary" onPress={onAddBlock} />
      </Panel>

      {sessions.length ? (
        <Panel>
          <Kicker>{`Clases · ${pending.length} por ver`}</Kicker>
          <PillTabs
            options={[
              { value: 'ver', label: `Por ver (${pending.length})` },
              { value: 'todas', label: 'Ya pasaron' },
              { value: 'proximas', label: 'Próximas' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {shown.length ? (
            shown.slice(0, 40).map(({ day, block }) => {
              const a = went.has(id(day, block));
              const v = seen.has(id(day, block));
              const future = day > today;
              return (
                <View key={`${day}:${block.id}`} style={[styles.session, { borderBottomColor: colors.line }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="label">{label(day)}</AppText>
                    <AppText variant="caption" muted>{`${block.starts_at.slice(0, 5)} – ${block.ends_at.slice(0, 5)}${a ? ' · asististe' : v ? ' · la viste' : future ? '' : ' · por ver'}`}</AppText>
                  </View>
                  {!future ? (
                    <>
                      <Chip on={a} text="Asistí" onPress={() => toggle(marks, 'hoy', 'hecho', day, block)} />
                      <Chip on={v} text="La vi" onPress={() => toggle(studies, 'estudios', 'clase_vista', day, block)} />
                    </>
                  ) : null}
                </View>
              );
            })
          ) : (
            <AppText variant="label" color={colors.ok}>
              {filter === 'ver' ? 'Estás al día: viste todas las clases. 👏' : 'Nada por aquí.'}
            </AppText>
          )}
          <AppText variant="caption" muted>
            «Asistí» es la misma marca de Tu día, el Calendario y Prioridades. «La vi» es para la clase grabada u online.
          </AppText>
        </Panel>
      ) : null}
    </Screen>
  );
}

function Chip({ on, text, onPress }: { on: boolean; text: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={text} onPress={onPress} style={[styles.chip, { backgroundColor: on ? colors.okSoft : colors.surface2 }]}>
      {on ? <CheckIcon size={13} weight="bold" color={colors.ok} /> : null}
      <AppText variant="label" style={{ fontSize: 12, fontFamily: fonts.bold }} color={on ? colors.ok : colors.text}>
        {text}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avg: { minWidth: 54, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
});
