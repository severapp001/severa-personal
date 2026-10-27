import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays } from '@/core/agenda';
import { classesOn } from '@/core/studies';
import { dayKey, toMinutes } from '@/core/today';
import { useAuth } from '@/data/auth';
import { setOnboardingAnswer, useOnboarding } from '@/data/discovery';
import { useEntries, type Entry } from '@/data/entries';
import { useStudies } from '@/data/modules';
import { MODULES } from '@/features/modules/catalog';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useToday } from '@/features/today/useToday';
import { activeJobs, worksOn } from '@/features/work/jobs';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { ChipRow, Kicker, Panel, Row, TimeField } from '@/ui/kit';

// Tu rutina (usuario, 27-10-2026: «es muy básico… siendo de las más importantes y recopilatorias»).
// Junta en un lugar cómo es tu semana: el tipo de rutina, a qué hora despiertas y te duermes (o si tu
// horario cambia), y cada día con tus trabajos, tus clases y tus bloques fijos, como una barra de
// 24 horas. De aquí sale la línea de Tu día.

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TYPES = ['De día', 'Turnos', 'Faena', 'Según mi agenda', 'Variable'];
const BLOCK = MODULES.tu_rutina.kinds[0];
type Seg = { id: string; from: number; to: number; title: string; kind: 'trabajo' | 'clase' | 'rutina' };

/** El lunes de la semana de `day`. */
const mondayOf = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return addDays(day, -((d.getDay() + 6) % 7));
};
const hours = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;

export function RoutineScreen({ nuevo }: { nuevo?: string }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const onboarding = useOnboarding(session?.user.id);
  const t = useToday();
  const today = dayKey(new Date());
  const store = useEntries(['tu_rutina', 'trabajo', 'estudios']);
  const studies = useStudies();
  const [sheet, setSheet] = useState<SheetTarget | null>(() => (nuevo ? { kind: BLOCK } : null));
  const [open, setOpen] = useState<string | null>(null);

  const answers = onboarding?.answers ?? {};
  const type = (answers.tu_rutina as { option?: string } | undefined)?.option ?? null;
  const horario = (answers.horario ?? {}) as { despierta?: string | null; duerme?: string | null };
  const save = (key: string, value: unknown) => session && onboarding && setOnboardingAnswer(session.user.id, onboarding.answers, key, value);
  const wake = toMinutes(horario.despierta ?? '') ?? null;
  const sleep = toMinutes(horario.duerme ?? '') ?? null;
  const sleepMin = wake !== null && sleep !== null ? (wake - sleep + 1440) % 1440 : null;

  const blocks = store.entries.filter((e) => e.module === 'tu_rutina' && e.kind === 'bloque');
  const jobs = activeJobs(store.entries.filter((e) => e.module === 'trabajo' && e.kind === 'trabajo'), today);
  const programs = store.entries.filter((e) => e.module === 'estudios' && e.kind === 'programa');
  const week = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i));

  const segmentsOf = (day: string, i: number): Seg[] => {
    const weekday = (i + 1) % 7; // 0 = domingo, como Date.getDay
    const out: Seg[] = [];
    for (const j of jobs.filter((x) => worksOn(x, weekday))) {
      const from = toMinutes(String(j.data.desde ?? ''));
      const to = toMinutes(String(j.data.hasta ?? ''));
      if (from !== null) out.push({ id: `j${j.id}`, from, to: to ?? from + 60, title: j.title ?? 'Trabajo', kind: 'trabajo' });
    }
    for (const { block, course } of classesOn(day, studies.blocks, studies.courses, programs)) {
      const from = toMinutes(block.starts_at.slice(0, 5));
      const to = toMinutes(block.ends_at.slice(0, 5));
      if (from !== null) out.push({ id: `c${block.id}`, from, to: to ?? from + 60, title: course.name, kind: 'clase' });
    }
    for (const b of blocks.filter((x) => Array.isArray(x.data.dias) && (x.data.dias as string[]).includes(DOW[i]))) {
      const from = toMinutes(String(b.data.desde ?? ''));
      const to = toMinutes(String(b.data.hasta ?? ''));
      if (from !== null) out.push({ id: `b${b.id}`, from, to: to ?? from + 60, title: b.title ?? 'Bloque', kind: 'rutina' });
    }
    return out.sort((a, b) => a.from - b.from);
  };
  const tint: Record<Seg['kind'], string> = { trabajo: colors.accent2, clase: colors.ok, rutina: colors.accent };

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Tu rutina" />
      <AppText variant="caption" muted>
        Cómo es tu semana: tus horas, tus trabajos, tus clases y lo que se repite. Con esto Severa arma tu día.
      </AppText>

      <Panel>
        <Kicker>¿Cómo es tu rutina?</Kicker>
        <ChipRow
          options={TYPES.map((x) => ({ value: x, label: x }))}
          value={type}
          onChange={(v) => {
            save('tu_rutina', { option: v });
            if ((v === 'Variable') !== t.variable) t.setVariable(v === 'Variable');
          }}
        />
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: t.variable }} onPress={() => (tap(), t.setVariable(!t.variable))} style={[styles.switch, { backgroundColor: t.variable ? colors.accentSoft : colors.surface2 }]}>
          <AppText variant="label" style={{ flex: 1 }} color={t.variable ? colors.accent : colors.text}>
            Mi horario cambia cada día
          </AppText>
          <AppText variant="caption" muted>
            {t.variable ? 'Hábitos sin hora' : 'Con horas fijas'}
          </AppText>
        </Pressable>
        {!t.variable ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TimeField label="Despierto" value={horario.despierta ?? ''} onChange={(v) => /^\d{1,2}:\d{2}$/.test(v) && save('horario', { ...horario, despierta: v })} />
              <TimeField label="Me duermo" value={horario.duerme ?? ''} onChange={(v) => /^\d{1,2}:\d{2}$/.test(v) && save('horario', { ...horario, duerme: v })} />
            </View>
            {sleepMin !== null ? (
              <AppText variant="caption" color={sleepMin >= 420 ? colors.ok : colors.mid}>
                {`Duermes ${hours(sleepMin)}${sleepMin < 420 ? ': la recomendación para adultos es de 7 a 9 horas.' : '.'}`}
              </AppText>
            ) : null}
          </>
        ) : null}
      </Panel>

      <Panel>
        <Kicker>Tu semana</Kicker>
        <View style={styles.legend}>
          {(['trabajo', 'clase', 'rutina'] as const).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: tint[k] }]} />
              <AppText variant="caption" muted>
                {k === 'trabajo' ? 'Trabajo' : k === 'clase' ? 'Clases' : 'Tus bloques'}
              </AppText>
            </View>
          ))}
        </View>
        {week.map((d, i) => {
          const segs = segmentsOf(d, i);
          const busy = segs.reduce((n, s) => n + Math.max(0, s.to - s.from), 0);
          return (
            <Pressable key={d} accessibilityRole="button" onPress={() => (tap(), setOpen(open === d ? null : d))} style={{ gap: 4 }}>
              <View style={styles.dayHead}>
                <AppText variant="label" style={{ width: 36 }} color={d === today ? colors.accent : colors.text}>
                  {DOW[i]}
                </AppText>
                <View style={[styles.bar, { backgroundColor: colors.surface2 }]}>
                  {!t.variable && wake !== null ? <View style={[styles.night, { left: 0, width: `${(wake / 1440) * 100}%`, backgroundColor: colors.line }]} /> : null}
                  {!t.variable && sleep !== null && sleep > (wake ?? 0) ? <View style={[styles.night, { left: `${(sleep / 1440) * 100}%`, right: 0, backgroundColor: colors.line }]} /> : null}
                  {segs.map((s) => (
                    <View key={s.id} style={[styles.seg, { left: `${(s.from / 1440) * 100}%`, width: `${(Math.max(20, s.to - s.from) / 1440) * 100}%`, backgroundColor: tint[s.kind] }]} />
                  ))}
                </View>
                <AppText variant="caption" muted style={{ width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {busy ? `${Math.round(busy / 60)} h` : '—'}
                </AppText>
              </View>
              {open === d ? (
                segs.length ? (
                  segs.map((s) => (
                    <AppText key={s.id} variant="caption" style={{ marginLeft: 44 }}>{`${String(Math.floor(s.from / 60)).padStart(2, '0')}:${String(s.from % 60).padStart(2, '0')} · ${s.title}`}</AppText>
                  ))
                ) : (
                  <AppText variant="caption" muted style={{ marginLeft: 44 }}>
                    Día libre de bloques fijos.
                  </AppText>
                )
              ) : null}
            </Pressable>
          );
        })}
        <AppText variant="caption" muted>
          Toca un día para ver su detalle. Los trabajos salen de Mis trabajos y las clases, de Estudios.
        </AppText>
      </Panel>

      <Panel>
        <Kicker>{`Tus bloques fijos · ${blocks.length}`}</Kicker>
        {blocks.map((b: Entry) => (
          <Row
            key={b.id}
            title={b.title ?? 'Bloque'}
            sub={[Array.isArray(b.data.dias) ? (b.data.dias as string[]).join(' ') : null, b.data.desde ? `${b.data.desde}${b.data.hasta ? `–${b.data.hasta}` : ''}` : null].filter(Boolean).join(' · ')}
            onPress={() => setSheet({ kind: BLOCK, entry: b })}
          />
        ))}
        {!blocks.length ? (
          <AppText variant="caption" muted>
            Lo que se repite cada semana: gimnasio, llevar a los niños, la misa, estudiar. Aparece en tu día y en tu calendario.
          </AppText>
        ) : null}
        <Button label="+ Bloque" kind="secondary" onPress={() => setSheet({ kind: BLOCK })} />
      </Panel>

      <EntrySheet
        target={sheet}
        ctx={{ parent: null, entries: store.entries }}
        onClose={() => setSheet(null)}
        onSave={(input, target) => (target.entry ? store.update(target.entry.id, input) : store.add({ ...input, module: 'tu_rutina' }))}
        onRemove={(e) => store.remove(e.id)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1, height: 16, borderRadius: 8, overflow: 'hidden' },
  night: { position: 'absolute', top: 0, bottom: 0, opacity: 0.6 },
  seg: { position: 'absolute', top: 2, bottom: 2, borderRadius: 4 },
});
