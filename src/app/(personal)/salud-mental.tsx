import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { choicesOf, scoreTest, TEST_ORDER, TESTS, type TestResult } from '@/core/mentalTests';
import { dayKey } from '@/core/today';
import { useEntries, type Entry } from '@/data/entries';
import { moduleHref } from '@/features/space/moduleRoutes';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useWay } from '@/features/mind/way';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Field, Kicker, Panel, PillTabs, Sheet } from '@/ui/kit';

// Salud mental (usuario, 27-10-2026: «terapia debería ser una pestaña dentro de un módulo Salud
// mental, que ayude a hacer test… para personalizar un sistema de funcionamiento interno y externo;
// soy TDAH y necesito una app que me ayude a entender»). Tests validados (core/mentalTests.ts), los
// ejercicios de Terapia y «Mi forma de funcionar», que ajusta Severa a cómo funciona tu cabeza.
// Todo es sensible: se guarda cifrado en el teléfono y solo lo ves tú. Orienta; no diagnostica.

type Tab = 'estado' | 'tests' | 'terapia' | 'funcionar';

const CRISIS = 'Si estás pensando en hacerte daño o sientes que no puedes más, llama ahora al *4141 (Línea de prevención del suicidio, gratis y las 24 horas) o al 131 (SAMU). No estás solo.';

export default function SaludMentalScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'terapia' ? 'terapia' : 'estado');
  const store = useEntries('salud_mental');
  const [running, setRunning] = useState<string | null>(null);
  const results = store.of('test');
  const lastOf = (code: string) => results.filter((r) => r.title === code).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  return (
    <Screen>
      <ModuleHeader kicker="Mente" title="Salud mental" />
      <Notice tone="mid" text="Datos sensibles: se guardan cifrados en tu teléfono y solo tú los ves. Los tests orientan, no diagnostican." />
      <PillTabs
        options={[
          { value: 'estado', label: 'Cómo estoy' },
          { value: 'tests', label: 'Tests' },
          { value: 'terapia', label: 'Terapia' },
          { value: 'funcionar', label: 'Mi forma de funcionar' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'estado' ? <Estado lastOf={lastOf} onRun={setRunning} onTab={setTab} /> : null}
      {tab === 'tests' ? <Tests lastOf={lastOf} onRun={setRunning} /> : null}
      {tab === 'terapia' ? <Terapia /> : null}
      {tab === 'funcionar' ? <Funcionar lastOf={lastOf} /> : null}
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {CRISIS}
      </AppText>
      <TestSheet code={running} onClose={() => setRunning(null)} onSave={(code, answers, r) => store.add({ kind: 'test', title: code, day: dayKey(new Date()), value: r.score, data: { answers, label: r.band.label, tone: r.band.tone, max: r.max } })} />
    </Screen>
  );
}

const toneColor = (colors: ReturnType<typeof useTheme>['colors'], tone: unknown) => (tone === 'bad' ? colors.bad : tone === 'mid' ? colors.mid : colors.ok);
const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : '');

function Estado({ lastOf, onRun, onTab }: { lastOf: (c: string) => Entry[]; onRun: (c: string) => void; onTab: (t: Tab) => void }) {
  const { colors } = useTheme();
  const done = TEST_ORDER.filter((c) => lastOf(c).length);
  const asrs = lastOf('asrs')[0];
  const high = done.filter((c) => lastOf(c)[0].data.tone === 'bad');
  return (
    <>
      <Panel>
        <Kicker>Tus últimos resultados</Kicker>
        {done.length ? (
          done.map((c) => {
            const [last, prev] = lastOf(c);
            const trend = prev ? Number(last.value) - Number(prev.value) : null;
            return (
              <Pressable key={c} accessibilityRole="button" onPress={() => onRun(c)} style={[styles.row, { borderBottomColor: colors.line }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label">{TESTS[c].name}</AppText>
                  <AppText variant="caption" muted>{`${fmt(last.day)}${trend !== null && trend !== 0 ? ` · ${trend > 0 ? 'subió' : 'bajó'} ${Math.abs(trend)} desde la vez anterior` : ''}`}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="label" color={toneColor(colors, last.data.tone)}>
                    {String(last.data.label ?? '')}
                  </AppText>
                  <AppText variant="caption" muted>{`${last.value} de ${last.data.max ?? ''}`}</AppText>
                </View>
              </Pressable>
            );
          })
        ) : (
          <AppText variant="caption" muted>
            Todavía no haces ningún test. Empieza por el de TDAH en adultos (5 minutos) o el de bienestar (1 minuto).
          </AppText>
        )}
        <Button label={done.length ? 'Hacer otro test' : 'Ver los tests'} kind="secondary" onPress={() => onTab('tests')} />
      </Panel>
      {asrs && asrs.data.tone === 'bad' ? (
        <Panel>
          <Kicker color={colors.accent}>Para ti</Kicker>
          <AppText variant="body">Tu tamizaje de TDAH salió alto. Severa puede acomodarse a cómo funciona tu cabeza: una cosa a la vez, bloques de foco y pasos chicos.</AppText>
          <Button label="Ajustar mi forma de funcionar" onPress={() => onTab('funcionar')} />
        </Panel>
      ) : null}
      {high.some((c) => c === 'phq9' || c === 'gad7' || c === 'pss10' || c === 'who5') ? (
        <Panel>
          <Kicker color={colors.bad}>Cuídate</Kicker>
          <AppText variant="body">Algunos resultados salieron altos. Conversarlo con un profesional ayuda mucho; mientras, la respiración y escribir lo que piensas pueden bajar la carga.</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Respirar" kind="secondary" onPress={() => router.push('/respiracion')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Terapia" kind="secondary" onPress={() => onTab('terapia')} />
            </View>
          </View>
        </Panel>
      ) : null}
    </>
  );
}

function Tests({ lastOf, onRun }: { lastOf: (c: string) => Entry[]; onRun: (c: string) => void }) {
  const { colors } = useTheme();
  return (
    <>
      {TEST_ORDER.map((c) => {
        const t = TESTS[c];
        const last = lastOf(c)[0];
        return (
          <Panel key={c}>
            <AppText variant="subtitle">{t.name}</AppText>
            <AppText variant="caption" muted>{`${t.about} Sobre ${t.period} · ${t.questions.length} preguntas · unos ${t.minutes} min.`}</AppText>
            <AppText variant="caption" muted style={{ fontSize: 11 }}>{`Fuente: ${t.source}.`}</AppText>
            {last ? <AppText variant="caption" color={toneColor(colors, last.data.tone)}>{`Última vez (${fmt(last.day)}): ${String(last.data.label ?? '')} · ${last.value} de ${last.data.max ?? ''}`}</AppText> : null}
            <Button label={last ? 'Repetir' : 'Hacer el test'} kind={last ? 'secondary' : 'primary'} onPress={() => onRun(c)} />
          </Panel>
        );
      })}
    </>
  );
}

function Terapia() {
  const items: [string, string, string][] = [
    ['pensamiento', 'Me siento mal por algo', 'Registro de pensamientos: qué pasó, qué pensé, qué sentí y una forma más justa de verlo.'],
    ['decision', 'Tengo que decidir', 'Pros y contras de una decisión, con su peso.'],
    ['opuesto', 'Pensar lo contrario', 'Escribe lo opuesto a un pensamiento que te frena y busca evidencia.'],
    ['ahora', '¿Qué estoy haciendo?', 'Para cuando pierdes el foco: qué hacías, qué te sacó y cuál es el próximo paso.'],
  ];
  return (
    <Panel>
      <Kicker>Ejercicios de terapia cognitivo-conductual</Kicker>
      {items.map(([kind, title, text]) => (
        <Pressable key={kind} accessibilityRole="button" onPress={() => (tap(), router.push(moduleHref('terapia', kind)))} style={styles.exercise}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption" muted>
            {text}
          </AppText>
        </Pressable>
      ))}
      <Button label="Ver mis ejercicios" kind="secondary" onPress={() => router.push(moduleHref('terapia'))} />
      <AppText variant="caption" muted>
        No reemplaza a un profesional: es una ayuda para ordenar la cabeza entre sesiones.
      </AppText>
    </Panel>
  );
}

/** Estrategias con respaldo para el TDAH en adultos, y dónde las hace Severa. */
const ADHD_TOOLS: [string, string, string][] = [
  ['Sacar todo de la cabeza', 'Anota ideas y pendientes apenas aparecen: «idea: …» en el Asistente o en Telegram.', '/asistente'],
  ['Una cosa a la vez', 'Prioridades te muestra solo lo más importante ahora.', '/prioridades'],
  ['Bloques de foco', 'Un temporizador corto para empezar (10 min) o para avanzar (25 min).', '/prioridades'],
  ['Pasos chicos', 'Cada meta dividida en pasos; en Hoy ves solo el próximo.', '/metas'],
  ['Rutina visible', 'Tu semana en barras: sin sorpresas.', '/modulo/tu_rutina'],
  ['Moverse y respirar', 'El ejercicio y la respiración ayudan a la atención y a la ansiedad.', '/respiracion'],
  ['Cerrar el día', 'Un minuto cada noche para soltar lo pendiente.', '/cierre'],
];

function Funcionar({ lastOf }: { lastOf: (c: string) => Entry[] }) {
  const { colors } = useTheme();
  const [way, save] = useWay();
  const [ayuda, setAyuda] = useState<string | null>(null);
  const [cuesta, setCuesta] = useState<string | null>(null);
  const asrs = lastOf('asrs')[0];
  const toggle = (label: string, on: boolean, change: (v: boolean) => void, hint: string) => (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => (tap(), change(!on))} style={[styles.switch, { backgroundColor: on ? colors.accentSoft : colors.surface2 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" color={on ? colors.accent : colors.text}>
          {label}
        </AppText>
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      </View>
      <AppText variant="label" color={on ? colors.accent : colors.muted}>
        {on ? 'Sí' : 'No'}
      </AppText>
    </Pressable>
  );
  return (
    <>
      <Panel>
        <Kicker>Cómo funciona tu cabeza</Kicker>
        <AppText variant="caption" muted>
          {asrs ? `Tu tamizaje de TDAH (${fmt(asrs.day)}): ${String(asrs.data.label ?? '')}.` : 'Si quieres, haz el test de TDAH en adultos para orientarte.'}
        </AppText>
        {toggle('Tengo TDAH (diagnóstico o sospecha)', way.tdah, (v) => save({ tdah: v, unaCosa: v ? true : way.unaCosa }), 'Severa prioriza los pasos chicos, el foco y los recordatorios.')}
        {toggle('Una cosa a la vez', way.unaCosa, (v) => save({ unaCosa: v }), 'Prioridades muestra solo lo más importante; el resto queda plegado.')}
        <AppText variant="label">Tu bloque de foco</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[10, 25, 45].map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: way.foco === m }} onPress={() => (tap(), save({ foco: m }))} style={[styles.chip, { backgroundColor: way.foco === m ? colors.accent : colors.surface2 }]}>
              <AppText variant="label" color={way.foco === m ? colors.onAccent : colors.text}>{`${m} min`}</AppText>
            </Pressable>
          ))}
        </View>
        <Field label="Lo que me ayuda" value={ayuda ?? way.ayuda} onChangeText={setAyuda} placeholder="Música sin letra, anotar todo, trabajar con alguien al lado…" multiline />
        <Field label="Lo que me cuesta" value={cuesta ?? way.cuesta} onChangeText={setCuesta} placeholder="Empezar, terminar los detalles, recordar citas…" multiline />
        {(ayuda !== null && ayuda !== way.ayuda) || (cuesta !== null && cuesta !== way.cuesta) ? (
          <Button
            label="Guardar"
            onPress={() => {
              save({ ayuda: (ayuda ?? way.ayuda).trim(), cuesta: (cuesta ?? way.cuesta).trim() });
              setAyuda(null);
              setCuesta(null);
            }}
          />
        ) : null}
      </Panel>
      {way.tdah ? (
        <Panel>
          <Kicker color={colors.accent}>Lo que Severa hace por tu TDAH</Kicker>
          {ADHD_TOOLS.map(([title, text, href]) => (
            <Pressable key={title} accessibilityRole="button" onPress={() => router.push(href as never)} style={styles.exercise}>
              <AppText variant="label">{title}</AppText>
              <AppText variant="caption" muted>
                {text}
              </AppText>
            </Pressable>
          ))}
        </Panel>
      ) : null}
    </>
  );
}

/** Un test, pregunta por pregunta, y su resultado. */
function TestSheet({ code, onClose, onSave }: { code: string | null; onClose: () => void; onSave: (code: string, answers: number[], r: TestResult) => Promise<unknown> }) {
  return (
    <Sheet visible={!!code} title={code ? TESTS[code].name : ''} onClose={onClose}>
      {code ? <Runner key={code} code={code} onClose={onClose} onSave={onSave} /> : null}
    </Sheet>
  );
}

function Runner({ code, onClose, onSave }: { code: string; onClose: () => void; onSave: (code: string, answers: number[], r: TestResult) => Promise<unknown> }) {
  const { colors } = useTheme();
  const t = TESTS[code];
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<TestResult | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const i = answers.length;

  const pick = async (value: number) => {
    tap();
    const next = [...answers, value];
    setAnswers(next);
    if (next.length === t.questions.length) {
      const r = scoreTest(code, next);
      setResult(r);
      try {
        await onSave(code, next, r);
      } catch {
        setUnsaved(true);
      }
    }
  };

  if (result) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={{ gap: 12 }}>
        {result.crisis ? <Notice text={CRISIS} /> : null}
        {unsaved ? <Notice tone="mid" text="No se pudo guardar el resultado. Revisa tu conexión y vuelve a hacerlo." /> : null}
        <AppText style={{ fontFamily: fonts.extrabold, fontSize: 34 }} color={toneColor(colors, result.band.tone)}>{`${result.score} de ${result.max}`}</AppText>
        <AppText variant="subtitle" color={toneColor(colors, result.band.tone)}>
          {result.band.label}
        </AppText>
        <AppText variant="body">{result.band.text}</AppText>
        {result.detail.map((d) => (
          <AppText key={d} variant="caption" muted>{`• ${d}`}</AppText>
        ))}
        <AppText variant="caption" muted>{`Fuente: ${t.source}. Este cuestionario orienta; no es un diagnóstico.`}</AppText>
        <Button label="Listo" onPress={onClose} />
      </Animated.View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <AppText variant="caption" muted>{`Pregunta ${i + 1} de ${t.questions.length} · sobre ${t.period}`}</AppText>
      <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
        <View style={{ width: `${(i / t.questions.length) * 100}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 3 }} />
      </View>
      <Animated.View key={i} entering={FadeIn.duration(250)}>
        <AppText variant="subtitle">{t.questions[i].text}</AppText>
      </Animated.View>
      {choicesOf(t, i).map((c) => (
        <Pressable key={c.label} accessibilityRole="button" onPress={() => pick(c.value)} style={[styles.choice, { backgroundColor: colors.surface2 }]}>
          <AppText variant="label">{c.label}</AppText>
        </Pressable>
      ))}
      {i > 0 ? <Button label="Atrás" kind="link" onPress={() => setAnswers(answers.slice(0, -1))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  exercise: { gap: 2, paddingVertical: 8 },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  choice: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
});
