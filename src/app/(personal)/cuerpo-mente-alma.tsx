import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { partScores, plusDays } from '@/core/modules';
import { dayKey } from '@/core/today';
import { useCross } from '@/features/space/SpaceCross';
import { moduleHref } from '@/features/space/moduleRoutes';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { usePref } from '@/features/space/usePref';
import { PartsCheck, useChecks, WeekSquares, type PartKey } from '@/features/stats/PartsCheck';
import { partSignals, ThreeParts } from '@/features/stats/ThreeParts';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';
import { Field, Kicker, Panel } from '@/ui/kit';

// Cuerpo, mente y alma (26-10-2026): la neurona del centro del cerebro. Desde el 27-10 (usuario:
// «es muy básico, siendo de los más importantes y recopilatorios»; estructura que él mismo propuso,
// inspirada en Joe Dispenza):
// 1. Cuerpo — energía · salud · acción: ejercicio y movimiento; sueño, alimentación y descanso;
//    hábitos físicos; registro de energía y bienestar.
// 2. Mente — conciencia · pensamientos · aprendizaje: diario; meditación y respiración; pensamientos
//    que se repiten; objetivos, visualización y aprendizaje; modo Trabajo para concentrarse.
// 3. Alma — propósito · valores · espiritualidad: Biblia y reflexión; oración o contemplación;
//    gratitud; valores personales; propósito, relaciones y contribución.
// Cada parte junta lo que ya registras en sus módulos y deja hacer lo que falta con un toque.

const VALUES = ['Fe', 'Familia', 'Honestidad', 'Salud', 'Libertad', 'Aprender', 'Servir', 'Disciplina', 'Alegría', 'Amistad', 'Justicia', 'Creatividad', 'Gratitud', 'Humildad', 'Valentía', 'Paz', 'Responsabilidad', 'Generosidad'];
const SOUL_DEFAULT: { valores: string[]; proposito: string } = { valores: [], proposito: '' };

export default function CuerpoMenteAlmaScreen() {
  const { colors } = useTheme();
  const today = dayKey(new Date());
  const stats = useLifeStats(today);
  const checks = useChecks(today);
  const cross = useCross();
  const [soul, saveSoul] = usePref('alma', SOUL_DEFAULT);
  const [purpose, setPurpose] = useState<string | null>(null);
  const e = stats.entries;
  const weekFrom = plusDays(today, -6);
  const inWeek = (d: string | null | undefined) => !!d && d >= weekFrom && d <= today;
  const parts = Object.fromEntries(partScores(partSignals(stats, today)).map((p) => [p.part, p.score]));
  const color: Record<PartKey, string> = { cuerpo: colors.ok, mente: colors.accent2, alma: colors.accent };

  // Lo que ya se registra, parte por parte.
  const minutes = (module: string) => e.entries.filter((x) => x.module === module && x.kind === 'sesion' && inWeek(x.day)).reduce((n, x) => n + (Number(x.value) || 0), 0);
  const meals = e.of('comida').filter((m) => inWeek(m.day)).length;
  const lastWeek = stats.habitWeek.at(-1);
  const habitDays = stats.habitWeek.filter((d) => d.total && d.done >= d.total).length;
  const journalDays = stats.journal.days.filter((d) => inWeek(d.day)).length;
  const moods = stats.journal.days.filter((d) => d.mood && inWeek(d.day));
  const thoughts = e.entries.filter((x) => x.module === 'terapia' && x.kind === 'pensamiento');
  const goals = e.entries.filter((x) => x.module === 'metas' && x.kind === 'meta' && !x.done);
  const stepsWeek = e.entries.filter((x) => x.module === 'metas' && x.kind === 'paso' && x.done && inWeek(String(x.data.hecho ?? ''))).length;
  const workHours = e.entries.filter((x) => x.module === 'trabajo' && x.kind === 'tramo' && inWeek(x.day)).reduce((n, x) => n + (Number(x.value) || 0), 0);
  const gratitudeDays = new Set(stats.journal.gratitude.filter((g) => inWeek(g.day)).map((g) => g.day)).size;
  const people = stats.journal.days.filter((d) => inWeek(d.day) && /Familia|Amigos/.test(d.activities ?? '')).length;
  const own = (kind: string) => e.entries.filter((x) => x.module === 'cuerpo_mente_alma' && x.kind === kind);
  const toggleOwn = (kind: string) => {
    tap();
    const row = own(kind).find((x) => x.day === today);
    return row ? checks.store.remove(row.id) : checks.store.add({ kind, day: today });
  };
  const did = (kind: string) => own(kind).some((x) => x.day === today);
  const weekOf = (kind: string) => own(kind).filter((x) => inWeek(x.day)).length;
  const go = (href: Href) => () => {
    tap();
    router.push(href);
  };

  return (
    <Screen>
      <ModuleHeader kicker="Tú" title="Cuerpo, mente y alma" />
      <AppText variant="caption" muted>
        Severa mira tus tres partes con lo que registras y te conoce mejor a medida que tu cerebro crece. Inspirado en «Deja de ser tú», de Joe Dispenza: una forma de mirarte, no un diagnóstico.
      </AppText>
      <ThreeParts stats={stats} today={today} compact />

      <Panel>
        <Kicker>{checks.today ? 'Tu chequeo de hoy' : '¿Cómo estás hoy?'}</Kicker>
        <PartsCheck day={today} colorOf={(k) => color[k]} />
      </Panel>

      <Part title="Cuerpo" tagline="Energía · Salud · Acción" text="Tu estado físico y tus acciones de cada día." color={color.cuerpo} score={parts.cuerpo ?? null} week={checks.week('cuerpo')}>
        <Item title="Ejercicio, pasos y movimiento" status={`${stats.exercise.total} de 150 minutos esta semana · los pasos llegarán con Health Connect`} action="Anotar" onPress={go(moduleHref('ejercicio', 'sesion'))} />
        <Item title="Sueño, alimentación y descanso" status={meals ? `${meals} comidas anotadas esta semana` : 'Anota tus comidas y cuántas horas dormiste'} action="Alimentación" onPress={go(moduleHref('alimentacion'))} />
        <Item title="Hábitos físicos y constancia" status={lastWeek?.total ? `Hoy ${lastWeek.done} de ${lastWeek.total} · ${habitDays} de 7 días completos` : 'Elige hábitos como agua, caminar o dormir temprano'} action="Hábitos" onPress={go('/habitos')} />
        <Item title="Energía y bienestar" status={checks.today?.data.cuerpo ? `Hoy: ${checks.today.data.cuerpo} de 5` : 'Cuéntalo arriba o al cerrar el día'} />
      </Part>

      <Part title="Mente" tagline="Conciencia · Pensamientos · Aprendizaje" text="Reconoce tus patrones mentales y dirige tu atención." color={color.mente} score={parts.mente ?? null} week={checks.week('mente')}>
        <Item title="Diario personal y emocional" status={journalDays ? `${journalDays} de 7 días escritos${moods.length ? ` · ánimo promedio ${(moods.reduce((n, d) => n + Number(d.mood), 0) / moods.length).toFixed(1).replace('.', ',')} de 4` : ''}` : 'Escribe cómo estuvo tu día'} action="Diario" onPress={go('/diario')} />
        <Item title="Meditación y respiración" status={`${minutes('meditacion')} min meditando y ${minutes('respiracion')} min respirando esta semana`} action="Meditar" onPress={go('/meditacion')} secondary="Respirar" onSecondary={go('/respiracion')} />
        <Item title="Pensamientos que se repiten" status={thoughts.length ? `${thoughts.length} anotados · el último: «${thoughts.sort((a, b) => (b.day ?? '').localeCompare(a.day ?? ''))[0].title ?? ''}»` : 'Cuando un pensamiento vuelva y vuelva, anótalo: verlo escrito ayuda a soltarlo'} action="Anotar" onPress={go(moduleHref('terapia', 'pensamiento'))} />
        <Item title="Objetivos, visualización y aprendizaje" status={goals.length ? `${goals.length} ${goals.length === 1 ? 'meta en curso' : 'metas en curso'} · ${stepsWeek} pasos hechos esta semana` : 'Plantea una meta y Severa te muestra el próximo paso'} action="Metas" onPress={go('/metas')} secondary="Visualizar" onSecondary={go('/meditacion')} />
        <Item title="Modo Trabajo para concentrarte" status={workHours ? `${workHours.toFixed(1).replace('.', ',')} h de jornada esta semana` : 'Entra en modo foco para trabajar sin distracciones'} action="Modo foco" onPress={() => (tap(), cross('work'))} />
      </Part>

      <Part title="Alma" tagline="Propósito · Valores · Espiritualidad" text="Conecta lo que haces con la persona que quieres ser y con lo que consideras importante." color={color.alma} score={parts.alma ?? null} week={checks.week('alma')}>
        <Item title="Biblia y reflexión espiritual" status={stats.bibleStreak ? `Racha de ${stats.bibleStreak} días · ${stats.bibleProgress.percent} % leído` : 'Lee el Pan de vida de hoy'} action="Biblia" onPress={go('/biblia')} />
        <Item title="Oración o contemplación" status={`Si es parte de tu práctica · ${weekOf('oracion')} de 7 días`} toggle={did('oracion')} toggleLabel="Hoy oré" onToggle={() => toggleOwn('oracion')} />
        <Item title="Gratitud" status={`${gratitudeDays} de 7 días con algo bueno anotado`} action="Anotar" onPress={go({ pathname: '/diario', params: { tab: 'gratitud' } })} />
        <View style={{ gap: 8 }}>
          <AppText variant="label">Valores personales</AppText>
          <AppText variant="caption" muted>
            Elige hasta 5. Severa los usa para recordarte por qué haces lo que haces.
          </AppText>
          <View style={styles.chips}>
            {VALUES.map((v) => {
              const on = soul.valores.includes(v);
              return (
                <Pressable
                  key={v}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    tap();
                    saveSoul({ valores: on ? soul.valores.filter((x) => x !== v) : [...soul.valores, v].slice(-5) });
                  }}
                  style={[styles.chip, { backgroundColor: on ? color.alma : colors.surface2 }]}
                >
                  <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
                    {v}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="label">Propósito, relaciones y contribución</AppText>
          <Field label="¿Para qué vives? ¿Quién quieres ser?" value={purpose ?? soul.proposito} onChangeText={setPurpose} placeholder="Ser un buen padre, servir a otros, crecer cada día…" multiline />
          {purpose !== null && purpose !== soul.proposito ? (
            <AppText variant="label" color={colors.accent} onPress={() => (tap(), saveSoul({ proposito: purpose.trim() }), setPurpose(null))}>
              Guardar mi propósito
            </AppText>
          ) : null}
          <AppText variant="caption" muted>{`Relaciones: ${people} de 7 días con familia o amigos (lo marcas al cerrar el día).`}</AppText>
        </View>
        <Item title="Contribución" status={`${weekOf('aporte')} de 7 días ayudando a alguien`} toggle={did('aporte')} toggleLabel="Hoy ayudé a alguien" onToggle={() => toggleOwn('aporte')} />
      </Part>
    </Screen>
  );
}

function Part({ title, tagline, text, color, score, week, children }: { title: string; tagline: string; text: string; color: string; score: number | null; week: number[]; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.part, { backgroundColor: colors.surface, borderTopColor: color }]}>
      <View style={styles.partHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontFamily: fonts.extrabold, fontSize: 22 }} color={color}>
            {title}
          </AppText>
          <AppText variant="caption" style={{ fontFamily: fonts.bold, letterSpacing: 0.6 }}>
            {tagline}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <AppText style={{ fontFamily: fonts.extrabold, fontSize: 20 }} color={score === null ? colors.muted : colors.text}>
            {score === null ? '?' : `${score}`}
          </AppText>
          <WeekSquares values={week} color={color} />
        </View>
      </View>
      <AppText variant="caption" muted>
        {text}
      </AppText>
      {children}
    </View>
  );
}

function Item({
  title,
  status,
  action,
  onPress,
  secondary,
  onSecondary,
  toggle,
  toggleLabel,
  onToggle,
}: {
  title: string;
  status: string;
  action?: string;
  onPress?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  toggle?: boolean;
  toggleLabel?: string;
  onToggle?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.item, { borderBottomColor: colors.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" muted>
          {status}
        </AppText>
      </View>
      {onToggle ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!toggle }} onPress={onToggle} style={[styles.toggle, { backgroundColor: toggle ? colors.okSoft : colors.surface2 }]}>
          {toggle ? <CheckIcon size={14} weight="bold" color={colors.ok} /> : null}
          <AppText variant="label" style={{ fontSize: 12 }} color={toggle ? colors.ok : colors.text}>
            {toggleLabel}
          </AppText>
        </Pressable>
      ) : (
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {action && onPress ? (
            <AppText variant="label" color={colors.accent} onPress={onPress} suppressHighlighting>
              {action}
            </AppText>
          ) : null}
          {secondary && onSecondary ? (
            <AppText variant="label" color={colors.accent} onPress={onSecondary} suppressHighlighting>
              {secondary}
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  part: { borderRadius: 22, padding: 16, gap: 8, borderTopWidth: 4 },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 140 },
});
