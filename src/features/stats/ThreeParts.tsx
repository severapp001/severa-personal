import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { activitiesOf } from '@/core/journal';
import { daysShare, partScores, plusDays, type Part, type Signal } from '@/core/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { Kicker, Panel } from '@/ui/kit';
import type { LifeStats } from './useLifeStats';

// Cuerpo, mente y alma (usuario, 26-10-2026, inspirado en «Deja de ser tú» de Joe Dispenza): Severa
// mira las tres partes de la persona con lo que registra en los módulos y, a medida que el cerebro
// crece, la conoce mejor. Es una forma de mirarse, no un diagnóstico.

const BODY = ['agua', 'sueno', 'caminar', 'entrenar', 'estirar', 'fruta', 'vitaminas', 'dormir_temprano'];
const BODY_LESS = ['cigarros', 'energeticas', 'alcohol', 'chatarra', 'azucar'];
const MIND = ['leer', 'estudiar', 'ordenar', 'diario'];
const SOUL = ['orar_meditar'];
const LABEL: Record<Part, string> = { cuerpo: 'Cuerpo', mente: 'Mente', alma: 'Alma' };

/** Las señales de cada parte (las usa también la pantalla Cuerpo, mente y alma). */
export function partSignals(s: LifeStats, today: string): Record<Part, Signal[]> {
  const week = Array.from({ length: 7 }, (_, i) => plusDays(today, -i));
  // Cumplimiento de los últimos 7 días de los hábitos de una lista (null si no cuenta ninguno).
  const habitRate = (codes: string[], reduce = false): number | null => {
    const list = s.habits.habits.filter((h) => codes.includes(h.template_code ?? '') && (h.direction === 'reduce') === reduce);
    if (!list.length) return null;
    let ok = 0;
    for (const h of list) {
      const target = Number(h.daily_target) || 1;
      for (const d of week) {
        const n = s.logs.filter((l) => l.habit_id === h.id && l.day === d).reduce((sum, l) => sum + Number(l.count), 0);
        if (reduce ? n <= (target > 1 ? target : 0) : n >= target) ok += 1;
      }
    }
    return ok / (list.length * 7);
  };
  const e = s.entries;
  const meals = e.of('comida').filter((m) => m.day && m.day >= plusDays(today, -13) && m.value);
  const takes = e.of('toma').filter((t) => t.day && t.day >= plusDays(today, -6)).length;
  const meds = e.of('remedio').filter((r) => !r.until || r.until >= today);
  const expected = meds.reduce((sum, r) => sum + (Number(r.data.veces) || 1), 0) * 7;
  const moods = s.journal.days.filter((d) => d.mood && d.day >= plusDays(today, -13));
  const acts = (names: string[]) => s.journal.days.filter((d) => d.day >= plusDays(today, -13) && activitiesOf(d.activities).some((a) => names.includes(a))).length;
  const bibleDays = [...e.of('pan'), ...e.of('lectura')].map((x) => x.day ?? '');
  const gratitudeDays = s.journal.gratitude.map((g) => g.day);
  // El chequeo del día (27-10-2026): el promedio de los últimos 7 días, de 1–5 a 0–1.
  const checks = e.entries.filter((x) => x.module === 'cuerpo_mente_alma' && x.kind === 'chequeo' && (x.day ?? '') >= plusDays(today, -6));
  const checkOf = (k: string) => {
    const v = checks.map((c) => Number(c.data[k]) || 0).filter(Boolean);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length - 1) / 4 : null;
  };
  const own = (kind: string) => e.entries.filter((x) => x.module === 'cuerpo_mente_alma' && x.kind === kind).map((x) => x.day ?? '');
  return {
    cuerpo: [
      { name: 'Energía y bienestar', value: checkOf('cuerpo'), hint: 'Cuenta cómo está tu energía al cerrar el día' },
      { name: 'Ejercicio', value: e.of('sesion').length ? s.exercise.total / 150 : null, hint: 'Registra una sesión de ejercicio' },
      { name: 'Hábitos del cuerpo', value: habitRate(BODY), hint: 'Cuenta agua, sueño o caminar en Hábitos' },
      { name: 'Lo que quieres bajar', value: habitRate(BODY_LESS, true), hint: 'Si fumas, tomas o comes chatarra, cuéntalo sin culpa' },
      { name: 'Comidas', value: meals.length ? meals.reduce((sum, m) => sum + Number(m.value), 0) / meals.length / 5 : null, hint: 'Anota tus comidas en Alimentación' },
      { name: 'Remedios', value: expected ? takes / expected : null, hint: 'Si tomas remedios, agrégalos en Salud' },
    ],
    mente: [
      { name: 'Calma y claridad', value: checkOf('mente'), hint: 'Cuenta cómo está tu mente al cerrar el día' },
      { name: 'Diario', value: daysShare(s.journal.days.map((d) => d.day), today, 14, s.journal.days.length > 0), hint: 'Cierra el día en el Diario' },
      { name: 'Ánimo', value: moods.length ? (moods.reduce((sum, d) => sum + Number(d.mood), 0) / moods.length - 1) / 3 : null, hint: 'Marca cómo estuvo tu día' },
      { name: 'Hábitos de la mente', value: habitRate(MIND), hint: 'Cuenta leer o estudiar en Hábitos' },
      { name: 'Redes', value: habitRate(['redes'], true), hint: 'Si quieres usar menos redes, cuéntalas' },
      { name: 'Terapia y respiración', value: daysShare([...e.entries.filter((x) => x.module === 'terapia' || x.module === 'respiracion').map((x) => x.day ?? '')], today, 14, e.entries.some((x) => x.module === 'terapia' || x.module === 'respiracion')), hint: 'Prueba un ejercicio de Respiración o de Terapia' },
      { name: 'Descanso y juegos', value: s.games.length ? Math.min(1, s.games.filter((g) => (g.day ?? '') >= plusDays(today, -13)).length / 4) : null, hint: 'Juega un rato en Juegos' },
    ],
    alma: [
      { name: 'Conexión y propósito', value: checkOf('alma'), hint: 'Cuenta cómo está tu alma al cerrar el día' },
      { name: 'Biblia', value: daysShare(bibleDays, today, 14, bibleDays.length > 0), hint: 'Lee el Pan de vida' },
      { name: 'Gratitud', value: daysShare(gratitudeDays, today, 14, gratitudeDays.length > 0), hint: 'Anota una cosa buena del día' },
      { name: 'Oración o meditación', value: habitRate(SOUL), hint: 'Cuenta «orar o meditar» en Hábitos' },
      { name: 'Meditación', value: daysShare(e.entries.filter((x) => x.module === 'meditacion').map((x) => x.day ?? ''), today, 14, e.entries.some((x) => x.module === 'meditacion')), hint: 'Medita unos minutos en Meditación' },
      { name: 'Oración o contemplación', value: daysShare(own('oracion'), today, 14, own('oracion').length > 0), hint: 'Si es parte de tu práctica, marca «hoy oré» en Cuerpo, mente y alma' },
      { name: 'Contribución', value: daysShare(own('aporte'), today, 14, own('aporte').length > 0), hint: 'Marca cuando ayudes a alguien' },
      { name: 'Familia y amigos', value: s.journal.days.length ? Math.min(1, acts(['Familia', 'Amigos']) / 6) : null, hint: 'Marca con quién estuviste al cerrar el día' },
      { name: 'Conocerte', value: e.of('item').length || e.of('recuerdo').length ? Math.min(1, (e.of('item').length + e.of('recuerdo').length) / 8) : null, hint: 'Agrega tu FODA o un recuerdo en Biografía' },
    ],
  };
}

function Ring({ value, color, track, size }: { value: number | null; color: string; track: string; size: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {value ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${(c * value) / 100} ${c}`} strokeLinecap="round" rotation={-90} origin={`${size / 2}, ${size / 2}`} /> : null}
    </Svg>
  );
}

/** La tarjeta chica de Hoy: los tres anillos y lo próximo que conviene registrar. */
export function ThreePartsMini({ stats, today, onOpen }: { stats: LifeStats; today: string; onOpen: () => void }) {
  const { colors } = useTheme();
  const parts = partScores(partSignals(stats, today));
  const color: Record<Part, string> = { cuerpo: colors.ok, mente: colors.accent2, alma: colors.accent };
  const low = [...parts].filter((p) => p.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const unknown = parts.find((p) => p.score === null);
  const tip = unknown ? `Para conocer tu ${LABEL[unknown.part].toLowerCase()}: ${unknown.missing[0]?.hint.toLowerCase() ?? 'registra algo'}.` : low ? `Tu ${LABEL[low.part].toLowerCase()} es la que más te pide hoy: ${(low.known.find((k) => (k.value ?? 1) < 0.5)?.name ?? low.known[0]?.name ?? '').toLowerCase()}.` : '';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir cuerpo, mente y alma" onPress={onOpen} style={[styles.mini, { backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {parts.map((p) => (
          <View key={p.part} style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ring value={p.score} color={color[p.part]} track={colors.surface2} size={44} />
              <AppText style={[styles.center, { fontFamily: fonts.extrabold, fontSize: 12 }]} color={p.score === null ? colors.muted : colors.text}>
                {p.score === null ? '?' : `${p.score}`}
              </AppText>
            </View>
            <AppText variant="caption" style={{ fontSize: 10, fontFamily: fonts.bold }} color={color[p.part]}>
              {LABEL[p.part]}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" muted style={{ fontFamily: fonts.extrabold, letterSpacing: 1, fontSize: 10 }}>
          CUERPO · MENTE · ALMA
        </AppText>
        <AppText variant="caption" numberOfLines={3}>
          {tip}
        </AppText>
      </View>
    </Pressable>
  );
}

export function ThreeParts({ stats, today, compact }: { stats: LifeStats; today: string; compact?: boolean }) {
  const { colors } = useTheme();
  const parts = partScores(partSignals(stats, today));
  const [open, setOpen] = useState<Part | null>(null);
  const color: Record<Part, string> = { cuerpo: colors.ok, mente: colors.accent2, alma: colors.accent };
  const known = parts.reduce((n, p) => n + p.known.length, 0);
  const total = parts.reduce((n, p) => n + p.known.length + p.missing.length, 0);
  const sel = parts.find((p) => p.part === open);
  return (
    <Panel>
      <Kicker>Cuerpo · mente · alma</Kicker>
      <View style={styles.row}>
        {parts.map((p) => (
          <Pressable
            key={p.part}
            accessibilityRole="button"
            accessibilityLabel={`${LABEL[p.part]}: ${p.score === null ? 'todavía no te conozco' : `${p.score} %`}`}
            onPress={() => {
              tap();
              setOpen(open === p.part ? null : p.part);
            }}
            style={[styles.part, open === p.part && { backgroundColor: colors.surface2 }]}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ring value={p.score} color={color[p.part]} track={colors.surface2} size={compact ? 64 : 78} />
              <AppText style={[styles.center, { fontFamily: fonts.extrabold, fontSize: compact ? 15 : 18 }]} color={p.score === null ? colors.muted : colors.text}>
                {p.score === null ? '?' : `${p.score}`}
              </AppText>
            </View>
            <AppText variant="label" color={color[p.part]}>
              {LABEL[p.part]}
            </AppText>
          </Pressable>
        ))}
      </View>
      {sel ? (
        <View style={{ gap: 6 }}>
          {sel.known.map((s) => (
            <View key={s.name} style={styles.line}>
              <AppText style={{ flex: 1, fontSize: 14 }}>{s.name}</AppText>
              <AppText variant="label" style={{ fontVariant: ['tabular-nums'] }}>{`${Math.round((s.value as number) * 100)} %`}</AppText>
            </View>
          ))}
          {sel.missing.length ? (
            <>
              <AppText variant="caption" muted>
                Para conocerte mejor:
              </AppText>
              {sel.missing.map((s) => (
                <AppText key={s.name} variant="caption">{`• ${s.hint}`}</AppText>
              ))}
            </>
          ) : null}
        </View>
      ) : (
        <AppText variant="caption" muted>
          {`Severa conoce ${known} de ${total} señales de ti. Toca una parte para ver de dónde sale y qué le falta saber. Inspirado en «Deja de ser tú», de Joe Dispenza: una forma de mirarte, no un diagnóstico.`}
        </AppText>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  part: { alignItems: 'center', gap: 6, borderRadius: 18, padding: 8, minWidth: 92 },
  center: { position: 'absolute' },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 28 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 12 },
});
